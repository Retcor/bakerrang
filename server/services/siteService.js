import { randomUUID } from 'node:crypto'
import { db } from '../client/firestoreClient.js'
import { draftPreviewEnabled } from '../config/publicSite.js'
import {
  EMAIL_MAX,
  PHONE_MAX,
  isValidEmail,
  isValidPhone
} from '../validation/contactMethods.js'
import { collectSiteMediaIds, hydrateSiteMedia, requireTenantMediaInTransaction } from './mediaService.js'
import { siteBrandingResponse, validateSiteBranding } from '../domain/siteBranding.js'
import { DEFAULT_SITE_THEME, normalizeSiteTheme, validateSiteTheme } from '../domain/siteTheme.js'
import {
  businessProfileResponse,
  hasBusinessProfile,
  validateBusinessProfile
} from '../domain/businessProfile.js'
import { validateBusinessHours, validateBusinessHoursUpdate } from '../domain/businessHours.js'
import { validateSocialLinks, validateSocialLinksUpdate } from '../domain/socialLinks.js'
import { normalizeStoredCustomCss, validateCustomCss } from '../domain/customCss.js'
import {
  SECTION_TYPES,
  SINGLETON_SECTION_TYPES,
  createDefaultSection
} from '../domain/sectionDefaults.js'
import { SITE_TEMPLATES, getSiteTemplate, siteTemplateMetadata } from '../domain/siteTemplates.js'

const TENANTS = 'tenants'
const SECTION_TYPE_SET = new Set(SECTION_TYPES)
export const MAX_PAGES = 25
export const MAX_PUBLISHED_REVISIONS = 10
// A deliberately conservative buffer below Firestore's 1 MiB document limit.
export const MAX_PUBLISHED_SNAPSHOT_BYTES = 900 * 1024
export const RESERVED_PAGE_SLUGS = new Set(['preview', 'site'])

const DEFAULT_SITE_HEADER = Object.freeze({
  brandDisplay: 'logo',
  navigation: { items: [] }
})

const DEFAULT_SITE_FOOTER = Object.freeze({
  showBranding: true,
  navigationMode: 'header',
  showBusinessContact: false,
  showSocialLinks: true,
  showCopyright: true
})

let firestore = db

export const _setDb = (nextDb) => {
  firestore = nextDb || db
}

const httpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const refsFor = (tenantId) => {
  const tenant = firestore.collection(TENANTS).doc(tenantId)
  const config = tenant.collection('site').doc('config')
  const home = config.collection('pages').doc('home')
  const published = config.collection('published').doc('current')
  const revision = (revisionId) => config.collection('revisions').doc(revisionId)
  const revisionIndex = config.collection('revisionIndex').doc('current')
  const revisionMedia = (revisionId) => config.collection('revisionMedia').doc(revisionId)
  const page = (pageId) => config.collection('pages').doc(pageId)
  return { tenant, config, home, page, published, revision, revisionIndex, revisionMedia }
}

const siteSectionResponse = (section) => {
  if (section?.type === 'businessHours') {
    const content = section.content && typeof section.content === 'object' && !Array.isArray(section.content)
      ? section.content
      : {}
    const heading = typeof content.heading === 'string' ? content.heading.trim().slice(0, 120) : ''
    const intro = typeof content.intro === 'string' ? content.intro.trim().slice(0, 300) : ''
    return {
      id: section.id,
      type: 'businessHours',
      hidden: section.hidden,
      content: {
        ...(heading ? { heading } : {}),
        ...(intro ? { intro } : {})
      }
    }
  }
  if (section?.type === 'faq') {
    const content = section.content && typeof section.content === 'object' ? section.content : {}
    return {
      id: section.id,
      type: 'faq',
      hidden: section.hidden,
      content: {
        heading: content.heading,
        ...(typeof content.intro === 'string' && content.intro ? { intro: content.intro } : {}),
        items: (Array.isArray(content.items) ? content.items : []).map((item) => ({
          id: item?.id,
          question: item?.question,
          answer: item?.answer
        }))
      }
    }
  }
  if (section?.type !== 'testimonials') return section
  const content = section.content && typeof section.content === 'object' ? section.content : {}
  return {
    id: section.id,
    type: 'testimonials',
    hidden: section.hidden,
    content: {
      title: content.title,
      items: (Array.isArray(content.items) ? content.items : []).map((item) => ({
        id: item?.id,
        customerName: item?.customerName,
        quote: item?.quote
      }))
    }
  }
}

const validTimestamp = (value) => Number.isSafeInteger(value) && value >= 0

const pageOrderFrom = (config, status = 500) => {
  if (!Object.prototype.hasOwnProperty.call(config || {}, 'pageOrder')) return ['home']
  const order = config.pageOrder
  if (!Array.isArray(order) || order.length === 0 || order.length > MAX_PAGES || order[0] !== 'home' || new Set(order).size !== order.length || order.some((id) => typeof id !== 'string' || !id)) {
    throw httpError(status, 'Site page order is invalid')
  }
  return order
}

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const rejectUnknownFields = (value, allowed, label) => {
  if (!isObject(value)) throw httpError(400, `${label} must be an object`)
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw httpError(400, `${label} has unknown fields`)
}

const optionalSeoText = (value, key, label, maximum) => {
  if (!own(value, key)) return undefined
  if (typeof value[key] !== 'string') throw httpError(400, `${label} must be a string`)
  const text = value[key].trim()
  if (text.length > maximum) throw httpError(400, `${label} must be ${maximum} characters or fewer`)
  return text || undefined
}

const normalizeSeoText = (value, maximum) => typeof value === 'string' && value.trim() && value.trim().length <= maximum
  ? value.trim()
  : undefined

const normalizeSiteSeo = (input) => {
  if (!isObject(input)) return undefined
  const value = input
  const defaultDescription = normalizeSeoText(value.defaultDescription, 500)
  return { ...(defaultDescription ? { defaultDescription } : {}), indexable: value.indexable !== false }
}

const validateSiteSeo = (input) => {
  rejectUnknownFields(input, ['defaultDescription', 'indexable', 'socialImageMediaId'], 'SEO settings')
  const defaultDescription = optionalSeoText(input, 'defaultDescription', 'SEO default description', 500)
  if (own(input, 'indexable') && typeof input.indexable !== 'boolean') throw httpError(400, 'SEO indexable must be boolean')
  let socialImageMediaId
  if (own(input, 'socialImageMediaId')) {
    if (input.socialImageMediaId !== null && typeof input.socialImageMediaId !== 'string') throw httpError(400, 'SEO social image is invalid')
    socialImageMediaId = typeof input.socialImageMediaId === 'string' ? input.socialImageMediaId.trim() : ''
  }
  return {
    seo: { ...(defaultDescription ? { defaultDescription } : {}), indexable: input.indexable !== false },
    hasSocialImageMediaId: own(input, 'socialImageMediaId'),
    socialImageMediaId
  }
}

const normalizePageSeo = (input) => {
  const value = isObject(input) ? input : {}
  const title = normalizeSeoText(value.title, 120)
  const description = normalizeSeoText(value.description, 500)
  const socialImageMediaId = normalizeSeoText(value.socialImageMediaId, 200)
  const seo = {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(socialImageMediaId ? { socialImageMediaId } : {}),
    ...(value.noIndex === true ? { noIndex: true } : {})
  }
  return Object.keys(seo).length ? seo : undefined
}

const validatePageSeo = (input) => {
  rejectUnknownFields(input, ['title', 'description', 'socialImageMediaId', 'noIndex'], 'Page SEO')
  const title = optionalSeoText(input, 'title', 'Page SEO title', 120)
  const description = optionalSeoText(input, 'description', 'Page SEO description', 500)
  if (own(input, 'noIndex') && typeof input.noIndex !== 'boolean') throw httpError(400, 'Page SEO noIndex must be boolean')
  let socialImageMediaId
  if (own(input, 'socialImageMediaId')) {
    if (input.socialImageMediaId !== null && typeof input.socialImageMediaId !== 'string') throw httpError(400, 'Page SEO social image is invalid')
    socialImageMediaId = typeof input.socialImageMediaId === 'string' ? input.socialImageMediaId.trim() : ''
  }
  const seo = {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(socialImageMediaId ? { socialImageMediaId } : {}),
    ...(input.noIndex === true ? { noIndex: true } : {})
  }
  return Object.keys(seo).length ? seo : undefined
}

const normalizeNavigationItems = (items, pageOrder) => {
  if (!Array.isArray(items)) return []
  const knownPageIds = new Set(pageOrder)
  const seen = new Set()
  const normalized = []
  for (const item of items) {
    if (!isObject(item) || typeof item.pageId !== 'string' || !item.pageId || !knownPageIds.has(item.pageId) || seen.has(item.pageId)) continue
    const label = typeof item.label === 'string' ? item.label.trim() : ''
    if (typeof item.label === 'string' && label.length > 60) continue
    seen.add(item.pageId)
    normalized.push({ pageId: item.pageId, ...(label ? { label } : {}) })
  }
  return normalized
}

const validateNavigationItems = (items, pageOrder, label) => {
  if (!Array.isArray(items)) throw httpError(400, `${label} items must be an array`)
  const knownPageIds = new Set(pageOrder)
  const seen = new Set()
  return items.map((item) => {
    rejectUnknownFields(item, ['pageId', 'label'], `${label} item`)
    if (typeof item.pageId !== 'string' || !item.pageId) throw httpError(400, `${label} page id is required`)
    if (!knownPageIds.has(item.pageId)) throw httpError(400, `${label} page reference is invalid`)
    if (seen.has(item.pageId)) throw httpError(400, `${label} contains duplicate page references`)
    seen.add(item.pageId)
    if (own(item, 'label') && typeof item.label !== 'string') throw httpError(400, `${label} label must be a string`)
    const itemLabel = typeof item.label === 'string' ? item.label.trim() : ''
    if (itemLabel.length > 60) throw httpError(400, `${label} label must be 60 characters or fewer`)
    return { pageId: item.pageId, ...(itemLabel ? { label: itemLabel } : {}) }
  })
}

const normalizeSiteHeader = (input, pageOrder) => {
  const value = isObject(input) ? input : {}
  const brandDisplay = ['logo', 'logoAndName', 'name'].includes(value.brandDisplay) ? value.brandDisplay : DEFAULT_SITE_HEADER.brandDisplay
  const items = normalizeNavigationItems(value.navigation?.items, pageOrder)
  let cta
  try {
    if (isObject(value.cta) && typeof value.cta.buttonLabel === 'string') {
      const buttonLabel = value.cta.buttonLabel.trim()
      if (buttonLabel && buttonLabel.length <= 60) cta = { buttonLabel, action: validateLinkAction(value.cta.action, 'Header CTA') }
    }
  } catch {}
  return { brandDisplay, navigation: { items }, ...(cta ? { cta } : {}) }
}

const normalizeSiteFooter = (input, pageOrder) => {
  const value = isObject(input) ? input : {}
  const navigationMode = ['header', 'custom', 'none'].includes(value.navigationMode) ? value.navigationMode : DEFAULT_SITE_FOOTER.navigationMode
  const text = typeof value.text === 'string' ? value.text.trim().slice(0, 200) : ''
  const footer = {
    showBranding: typeof value.showBranding === 'boolean' ? value.showBranding : DEFAULT_SITE_FOOTER.showBranding,
    navigationMode,
    showBusinessContact: typeof value.showBusinessContact === 'boolean' ? value.showBusinessContact : DEFAULT_SITE_FOOTER.showBusinessContact,
    showSocialLinks: typeof value.showSocialLinks === 'boolean' ? value.showSocialLinks : DEFAULT_SITE_FOOTER.showSocialLinks,
    showCopyright: typeof value.showCopyright === 'boolean' ? value.showCopyright : DEFAULT_SITE_FOOTER.showCopyright,
    ...(text ? { text } : {})
  }
  if (navigationMode === 'custom') footer.navigationItems = normalizeNavigationItems(value.navigationItems, pageOrder)
  return footer
}

const validateSiteHeader = (input, pageOrder) => {
  rejectUnknownFields(input, ['brandDisplay', 'navigation', 'cta'], 'Header')
  if (!['logo', 'logoAndName', 'name'].includes(input.brandDisplay)) throw httpError(400, 'Header brand display is invalid')
  rejectUnknownFields(input.navigation, ['items'], 'Header navigation')
  const header = { brandDisplay: input.brandDisplay, navigation: { items: validateNavigationItems(input.navigation.items, pageOrder, 'Header navigation') } }
  if (!own(input, 'cta')) return header
  rejectUnknownFields(input.cta, ['buttonLabel', 'action'], 'Header CTA')
  if (typeof input.cta.buttonLabel !== 'string' || !input.cta.buttonLabel.trim()) throw httpError(400, 'Header CTA button label is required')
  const buttonLabel = input.cta.buttonLabel.trim()
  if (buttonLabel.length > 60) throw httpError(400, 'Header CTA button label must be 60 characters or fewer')
  rejectUnknownFields(input.cta.action, ['type', 'value'], 'Header CTA action')
  return { ...header, cta: { buttonLabel, action: validateLinkAction(input.cta.action, 'Header CTA') } }
}

const validateSiteFooter = (input, pageOrder) => {
  rejectUnknownFields(input, ['showBranding', 'navigationMode', 'navigationItems', 'showBusinessContact', 'showSocialLinks', 'text', 'showCopyright'], 'Footer')
  for (const key of ['showBranding', 'showBusinessContact', 'showSocialLinks', 'showCopyright']) {
    if (typeof input[key] !== 'boolean') throw httpError(400, `Footer ${key} must be boolean`)
  }
  if (!['header', 'custom', 'none'].includes(input.navigationMode)) throw httpError(400, 'Footer navigation mode is invalid')
  if (own(input, 'text') && typeof input.text !== 'string') throw httpError(400, 'Footer text must be a string')
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (text.length > 200) throw httpError(400, 'Footer text must be 200 characters or fewer')
  const footer = {
    showBranding: input.showBranding,
    navigationMode: input.navigationMode,
    showBusinessContact: input.showBusinessContact,
    showSocialLinks: input.showSocialLinks,
    showCopyright: input.showCopyright,
    ...(text ? { text } : {})
  }
  if (input.navigationMode === 'custom') footer.navigationItems = validateNavigationItems(input.navigationItems, pageOrder, 'Footer navigation')
  return footer
}

const pageResponse = (page) => ({
  id: page.id,
  slug: page.slug,
  title: page.title,
  sections: Array.isArray(page.sections) ? page.sections.map(siteSectionResponse) : page.sections,
  ...(normalizePageSeo(page.seo) ? { seo: normalizePageSeo(page.seo) } : {})
})

const publicationState = (config, pages) => {
  const lastPublishedAt = validTimestamp(config.lastPublishedAt) ? config.lastPublishedAt : undefined
  if (config.status !== 'PUBLISHED' || lastPublishedAt === undefined) {
    return {
      hasUnpublishedChanges: false,
      ...(lastPublishedAt !== undefined ? { lastPublishedAt } : {})
    }
  }
  const workingTimestamps = [config.updatedAt, ...pages.map((page) => page.updatedAt)].filter(validTimestamp)
  return {
    hasUnpublishedChanges: workingTimestamps.some((updatedAt) => updatedAt > lastPublishedAt),
    lastPublishedAt
  }
}

const toSiteDefinition = (config, pages) => {
  const pageOrder = pageOrderFrom(config)
  if (!Array.isArray(pages) || pages.length !== pageOrder.length) throw httpError(500, 'Site pages are invalid')
  const byId = new Map(pages.map((page) => [page?.id, page]))
  const orderedPages = pageOrder.map((id) => {
    const page = byId.get(id)
    if (!page || page.id !== id) throw httpError(500, pageOrder.length === 1 && pageOrder[0] === 'home' ? 'Site home page missing' : 'Site page is missing')
    if (id === 'home' && (page.slug !== '/' || page.title !== 'Home')) throw httpError(500, 'Site home page is invalid')
    if (id !== 'home') validatePageRecord(page, 500)
    validateSectionComposition(page.sections, id)
    return page
  })
  const definition = {
    status: config.status,
    ...publicationState(config, orderedPages),
    pages: orderedPages.map(pageResponse)
  }
  const businessProfile = businessProfileResponse(config.businessProfile)
  return {
    ...definition,
    branding: siteBrandingResponse(config.branding, definition),
    theme: normalizeSiteTheme(config.theme),
    ...(normalizeSiteSeo(config.seo) ? { seo: normalizeSiteSeo(config.seo) } : {}),
    header: normalizeSiteHeader(config.header, pageOrder),
    footer: normalizeSiteFooter(config.footer, pageOrder),
    ...(typeof config.customCss === 'string' ? { customCss: config.customCss } : {}),
    ...(businessProfile ? { businessProfile } : {})
  }
}

const normalizePublishedSiteDefinition = (definition) => {
  const pages = Array.isArray(definition?.pages) ? definition.pages : []
  const home = pages.find((page) => page?.id === 'home')
  if (!home || home.slug !== '/' || home.title !== 'Home') throw httpError(500, 'Home sections invalid')
  for (const page of pages) {
    if (page?.id !== 'home') validatePageRecord(page, 500)
    validateSectionComposition(page?.sections, page?.id)
  }
  const businessProfile = businessProfileResponse(definition?.businessProfile)
  const canonical = definition && typeof definition === 'object' ? { ...definition } : {}
  delete canonical.customCss
  delete canonical.scopedCustomCss
  delete canonical.seo
  const normalized = {
    ...canonical,
    pages: pages.map(pageResponse),
    branding: siteBrandingResponse(definition?.branding, definition),
    theme: normalizeSiteTheme(definition?.theme),
    ...(normalizeSiteSeo(definition?.seo) ? { seo: normalizeSiteSeo(definition?.seo) } : {}),
    header: normalizeSiteHeader(definition?.header, pages.map((page) => page.id)),
    footer: normalizeSiteFooter(definition?.footer, pages.map((page) => page.id)),
    ...(typeof definition?.customCss === 'string' ? { customCss: definition.customCss } : {})
  }
  if (businessProfile) normalized.businessProfile = businessProfile
  else delete normalized.businessProfile
  return normalized
}

const revisionError = () => httpError(500, 'Published revision is invalid')

const validateRevisionDefinition = (definition) => {
  try {
    if (!isObject(definition) || definition.status !== 'PUBLISHED' || !Array.isArray(definition.pages) || definition.pages.length === 0 || definition.pages.length > MAX_PAGES) throw revisionError()
    const pages = structuredClone(definition.pages)
    const pageOrder = pages.map((page) => page?.id)
    if (pageOrder[0] !== 'home' || new Set(pageOrder).size !== pageOrder.length) throw revisionError()
    for (const page of pages) {
      if (!isObject(page) || typeof page.id !== 'string' || !page.id) throw revisionError()
      if (page.id === 'home') {
        if (page.slug !== '/' || page.title !== 'Home') throw revisionError()
      } else validatePageRecord(page, 500)
      validateSectionComposition(page.sections, page.id, 500)
      if (page.seo !== undefined) page.seo = validatePageSeo(page.seo)
    }
    for (const page of pages) requireUniquePageSlug(pages, page.slug, page.id)
    const branding = validateSiteBranding(definition.branding)
    const theme = validateSiteTheme(definition.theme)
    const header = validateSiteHeader(definition.header, pageOrder)
    const footer = validateSiteFooter(definition.footer, pageOrder)
    const validatedSiteSeo = definition.seo === undefined ? undefined : validateSiteSeo(definition.seo).seo
    let businessProfile
    if (definition.businessProfile !== undefined) {
      if (!isObject(definition.businessProfile)) throw revisionError()
      businessProfile = validateBusinessProfile(definition.businessProfile)
      if (Object.hasOwn(definition.businessProfile, 'businessHours')) businessProfile.businessHours = validateBusinessHours(definition.businessProfile.businessHours)
      if (Object.hasOwn(definition.businessProfile, 'socialLinks')) businessProfile.socialLinks = validateSocialLinks(definition.businessProfile.socialLinks)
    }
    const customCss = definition.customCss === undefined ? undefined : validateCustomCss(definition.customCss)
    return {
      pages,
      pageOrder,
      branding,
      theme,
      header,
      footer,
      ...(validatedSiteSeo ? { seo: validatedSiteSeo } : {}),
      ...(businessProfile && hasBusinessProfile(businessProfile) ? { businessProfile } : {}),
      ...(customCss ? { customCss } : {})
    }
  } catch (error) {
    if (error?.status === 500) throw error
    throw revisionError()
  }
}

const revisionEntries = (value) => Array.isArray(value?.entries)
  ? value.entries.filter((entry) => isObject(entry) && typeof entry.revisionId === 'string' && entry.revisionId && validTimestamp(entry.publishedAt) && typeof entry.publishedByUserId === 'string' && Number.isSafeInteger(entry.pageCount) && entry.pageCount >= 0)
  : []

export const finalizeSiteDefinitionRead = async (tenantId, definition) => {
  const canonical = { ...definition }
  delete canonical.scopedCustomCss
  const hydrated = await hydrateSiteMedia(tenantId, canonical)
  const scopedCustomCss = normalizeStoredCustomCss(canonical.customCss)
  return {
    ...hydrated,
    ...(scopedCustomCss ? { scopedCustomCss } : {})
  }
}

const validateHeroInput = (input) => {
  const body = input && typeof input === 'object' ? input : {}
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw httpError(400, 'Hero title is required')
  }

  const title = body.title.trim()
  if (title.length > 200) {
    throw httpError(400, 'Hero title must be 200 characters or fewer')
  }

  const subtitleSupplied = Object.prototype.hasOwnProperty.call(body, 'subtitle')
  let subtitle
  if (subtitleSupplied) {
    if (typeof body.subtitle !== 'string') {
      throw httpError(400, 'Hero subtitle must be a string')
    }
    subtitle = body.subtitle.trim()
    if (subtitle.length > 500) {
      throw httpError(400, 'Hero subtitle must be 500 characters or fewer')
    }
  }

  return { title, subtitle, subtitleSupplied }
}

const validateServicesInput = (input) => {
  const body = input && typeof input === 'object' ? input : {}
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw httpError(400, 'Services title is required')
  }
  const title = body.title.trim()
  if (title.length > 100) {
    throw httpError(400, 'Services title must be 100 characters or fewer')
  }
  if (!Array.isArray(body.items)) throw httpError(400, 'Services items must be an array')
  if (body.items.length === 0) throw httpError(400, 'Services must include at least one item')
  if (body.items.length > 20) throw httpError(400, 'Services cannot exceed 20 items')

  const suppliedIds = new Set()
  const items = body.items.map((item) => {
    const value = item && typeof item === 'object' ? item : {}
    const idSupplied = Object.prototype.hasOwnProperty.call(value, 'id')
    if (idSupplied && typeof value.id !== 'string') {
      throw httpError(400, 'Service item id must be a string')
    }
    if (idSupplied) {
      if (suppliedIds.has(value.id)) throw httpError(400, 'Duplicate service item id')
      suppliedIds.add(value.id)
    }
    if (typeof value.name !== 'string' || !value.name.trim()) {
      throw httpError(400, 'Service name is required')
    }
    const name = value.name.trim()
    if (name.length > 120) {
      throw httpError(400, 'Service name must be 120 characters or fewer')
    }

    const descriptionSupplied = Object.prototype.hasOwnProperty.call(value, 'description')
    let description
    if (descriptionSupplied) {
      if (typeof value.description !== 'string') {
        throw httpError(400, 'Service description must be a string')
      }
      description = value.description.trim()
      if (description.length > 500) {
        throw httpError(400, 'Service description must be 500 characters or fewer')
      }
    }

    return {
      ...(idSupplied ? { id: value.id } : {}),
      name,
      ...(description ? { description } : {})
    }
  })

  return { title, items }
}

const validateAboutInput = (input) => {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  let eyebrow
  if (Object.prototype.hasOwnProperty.call(value, 'eyebrow')) {
    if (typeof value.eyebrow !== 'string') throw httpError(400, 'About eyebrow must be a string')
    eyebrow = value.eyebrow.trim()
    if (eyebrow.length > 60) throw httpError(400, 'About eyebrow must be 60 characters or fewer')
  }
  if (typeof value.heading !== 'string' || !value.heading.trim()) {
    throw httpError(400, 'About heading is required')
  }
  const heading = value.heading.trim()
  if (heading.length > 120) throw httpError(400, 'About heading must be 120 characters or fewer')
  if (typeof value.body !== 'string' || !value.body.trim()) {
    throw httpError(400, 'About body is required')
  }
  const body = value.body.trim()
  if (body.length > 2000) throw httpError(400, 'About body must be 2000 characters or fewer')

  let imageMediaId
  if (Object.prototype.hasOwnProperty.call(value, 'imageMediaId')) {
    if (typeof value.imageMediaId !== 'string') throw httpError(400, 'About image must be a string')
    imageMediaId = value.imageMediaId.trim()
  }
  let imageAlt
  if (imageMediaId) {
    if (typeof value.imageAlt !== 'string' || !value.imageAlt.trim()) {
      throw httpError(400, 'About image alt text is required')
    }
    imageAlt = value.imageAlt.trim()
    if (imageAlt.length > 250) {
      throw httpError(400, 'About image alt text must be 250 characters or fewer')
    }
  }
  let imagePosition
  if (Object.prototype.hasOwnProperty.call(value, 'imagePosition')) {
    if (!['left', 'right'].includes(value.imagePosition)) throw httpError(400, 'About image position is not supported')
    imagePosition = value.imagePosition
  }
  const actionFields = validateOptionalSectionAction(value, 'About')
  return {
    ...(eyebrow ? { eyebrow } : {}),
    heading,
    body,
    ...(imageMediaId ? { imageMediaId, imageAlt } : {}),
    ...(imagePosition ? { imagePosition } : {}),
    ...actionFields
  }
}

const validateLinkAction = (action, label = 'Link') => {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw httpError(400, `${label} action is required`)
  }
  if (!['email', 'phone', 'url'].includes(action.type)) throw httpError(400, `${label} action type is not supported`)
  if (typeof action.value !== 'string' || !action.value.trim()) {
    throw httpError(400, `${label} action value is required`)
  }

  const value = action.value.trim()
  if (action.type === 'email') {
    if (value.length > EMAIL_MAX) {
      throw httpError(400, `${label} email must be 254 characters or fewer`)
    }
    if (!isValidEmail(value)) throw httpError(400, `${label} email is invalid`)
    return { type: 'email', value }
  }

  if (action.type === 'phone') {
    if (value.length > PHONE_MAX) {
      throw httpError(400, `${label} phone must be 50 characters or fewer`)
    }
    if (!isValidPhone(value)) throw httpError(400, `${label} phone is invalid`)
    return { type: 'phone', value }
  }

  if (value.length > 2048) {
    throw httpError(400, `${label} URL must be 2048 characters or fewer`)
  }
  try {
    const parsedUrl = new URL(value)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw httpError(400, `${label} URL must use http or https`)
    }
    return { type: 'url', value: parsedUrl.toString() }
  } catch (error) {
    if (error.status === 400) throw error
    throw httpError(400, `${label} URL must use http or https`)
  }
}

const validateContactAction = (action) => {
  if (action?.type === 'leadForm') return { type: 'leadForm' }
  return validateLinkAction(action, 'Contact')
}

const validateOptionalSectionAction = (body, label) => {
  const hasLabel = Object.prototype.hasOwnProperty.call(body, 'buttonLabel')
  const hasAction = Object.prototype.hasOwnProperty.call(body, 'action')
  if (hasLabel !== hasAction) throw httpError(400, `${label} button label and action must be provided together`)
  if (!hasLabel) return {}
  if (typeof body.buttonLabel !== 'string') throw httpError(400, `${label} button label must be a string`)
  const buttonLabel = body.buttonLabel.trim()
  if (!buttonLabel) throw httpError(400, `${label} button label is required`)
  if (buttonLabel.length > 60) throw httpError(400, `${label} button label must be 60 characters or fewer`)
  return { buttonLabel, action: validateLinkAction(body.action, label) }
}

const validateContactInput = (input) => {
  const body = input && typeof input === 'object' ? input : {}
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw httpError(400, 'Contact title is required')
  }
  const title = body.title.trim()
  if (title.length > 150) {
    throw httpError(400, 'Contact title must be 150 characters or fewer')
  }

  let text
  if (Object.prototype.hasOwnProperty.call(body, 'text')) {
    if (typeof body.text !== 'string') {
      throw httpError(400, 'Contact text must be a string')
    }
    text = body.text.trim()
    if (text.length > 500) {
      throw httpError(400, 'Contact text must be 500 characters or fewer')
    }
  }

  if (typeof body.buttonLabel !== 'string' || !body.buttonLabel.trim()) {
    throw httpError(400, 'Contact button label is required')
  }
  const buttonLabel = body.buttonLabel.trim()
  if (buttonLabel.length > 80) {
    throw httpError(400, 'Contact button label must be 80 characters or fewer')
  }

  return {
    title,
    ...(text ? { text } : {}),
    buttonLabel,
    action: validateContactAction(body.action)
  }
}

const validateGalleryInput = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw httpError(400, 'Gallery title is required')
  }
  const title = body.title.trim()
  if (title.length > 100) throw httpError(400, 'Gallery title must be 100 characters or fewer')
  if (!Array.isArray(body.items)) throw httpError(400, 'Gallery items must be an array')
  if (body.items.length === 0) throw httpError(400, 'Gallery must include at least one image')
  if (body.items.length > 20) throw httpError(400, 'Gallery cannot exceed 20 images')

  const suppliedIds = new Set()
  const mediaIds = new Set()
  const items = body.items.map((item) => {
    const value = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
    const idSupplied = Object.prototype.hasOwnProperty.call(value, 'id')
    if (idSupplied && typeof value.id !== 'string') {
      throw httpError(400, 'Gallery item id must be a string')
    }
    if (idSupplied) {
      if (suppliedIds.has(value.id)) throw httpError(400, 'Duplicate gallery item id')
      suppliedIds.add(value.id)
    }
    if (typeof value.mediaId !== 'string' || !value.mediaId.trim()) {
      throw httpError(400, 'Gallery image is required')
    }
    const mediaId = value.mediaId.trim()
    if (mediaIds.has(mediaId)) throw httpError(400, 'Duplicate gallery image')
    mediaIds.add(mediaId)
    if (typeof value.altText !== 'string' || !value.altText.trim()) {
      throw httpError(400, 'Gallery image alt text is required')
    }
    const altText = value.altText.trim()
    if (altText.length > 250) {
      throw httpError(400, 'Gallery image alt text must be 250 characters or fewer')
    }
    return {
      ...(idSupplied ? { id: value.id } : {}),
      mediaId,
      altText
    }
  })
  return { title, items }
}

const validateTestimonialsInput = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw httpError(400, 'Testimonials title is required')
  }
  const title = body.title.trim()
  if (title.length > 100) {
    throw httpError(400, 'Testimonials title must be 100 characters or fewer')
  }
  if (!Array.isArray(body.items)) throw httpError(400, 'Testimonials items must be an array')
  if (body.items.length === 0) {
    throw httpError(400, 'Testimonials must include at least one testimonial')
  }
  if (body.items.length > 10) {
    throw httpError(400, 'Testimonials cannot exceed 10 testimonials')
  }

  const suppliedIds = new Set()
  const items = body.items.map((item) => {
    const value = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
    const idSupplied = Object.prototype.hasOwnProperty.call(value, 'id')
    if (idSupplied && typeof value.id !== 'string') {
      throw httpError(400, 'Testimonial item id must be a string')
    }
    if (idSupplied) {
      if (suppliedIds.has(value.id)) throw httpError(400, 'Duplicate testimonial item id')
      suppliedIds.add(value.id)
    }
    if (typeof value.customerName !== 'string' || !value.customerName.trim()) {
      throw httpError(400, 'Testimonial name is required')
    }
    const customerName = value.customerName.trim()
    if (customerName.length > 120) {
      throw httpError(400, 'Testimonial name must be 120 characters or fewer')
    }
    if (typeof value.quote !== 'string' || !value.quote.trim()) {
      throw httpError(400, 'Testimonial quote is required')
    }
    const quote = value.quote.trim()
    if (quote.length > 1000) {
      throw httpError(400, 'Testimonial quote must be 1000 characters or fewer')
    }
    return {
      ...(idSupplied ? { id: value.id } : {}),
      customerName,
      quote
    }
  })

  return { title, items }
}

const validateFaqInput = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof body.heading !== 'string' || !body.heading.trim()) {
    throw httpError(400, 'FAQ heading is required')
  }
  const heading = body.heading.trim()
  if (heading.length > 120) throw httpError(400, 'FAQ heading must be 120 characters or fewer')

  let intro
  if (Object.prototype.hasOwnProperty.call(body, 'intro')) {
    if (typeof body.intro !== 'string') throw httpError(400, 'FAQ intro must be a string')
    intro = body.intro.trim()
    if (intro.length > 300) throw httpError(400, 'FAQ intro must be 300 characters or fewer')
  }
  if (!Array.isArray(body.items)) throw httpError(400, 'FAQ items must be an array')
  if (body.items.length === 0) throw httpError(400, 'FAQ must include at least one question')
  if (body.items.length > 20) throw httpError(400, 'FAQ cannot exceed 20 questions')

  const suppliedIds = new Set()
  const items = body.items.map((item) => {
    const value = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
    const idSupplied = Object.prototype.hasOwnProperty.call(value, 'id')
    if (idSupplied && (typeof value.id !== 'string' || !value.id.trim())) {
      throw httpError(400, 'FAQ item id must be a non-empty string')
    }
    if (idSupplied) {
      if (suppliedIds.has(value.id)) throw httpError(400, 'Duplicate FAQ item id')
      suppliedIds.add(value.id)
    }
    if (typeof value.question !== 'string' || !value.question.trim()) {
      throw httpError(400, 'FAQ question is required')
    }
    const question = value.question.trim()
    if (question.length > 200) throw httpError(400, 'FAQ question must be 200 characters or fewer')
    if (typeof value.answer !== 'string' || !value.answer.trim()) {
      throw httpError(400, 'FAQ answer is required')
    }
    const answer = value.answer.trim()
    if (answer.length > 1000) throw httpError(400, 'FAQ answer must be 1000 characters or fewer')
    return { ...(idSupplied ? { id: value.id } : {}), question, answer }
  })
  return { heading, ...(intro ? { intro } : {}), items }
}

const optionalText = (body, field, label, max) => {
  if (!Object.prototype.hasOwnProperty.call(body, field)) return undefined
  if (typeof body[field] !== 'string') throw httpError(400, `${label} must be a string`)
  const value = body[field].trim()
  if (value.length > max) throw httpError(400, `${label} must be ${max} characters or fewer`)
  return value || undefined
}

const validateProcessInput = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 8) throw httpError(400, 'Steps must include between 1 and 8 items')
  const ids = new Set()
  const items = body.items.map((item) => {
    const value = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
    const supplied = Object.prototype.hasOwnProperty.call(value, 'id')
    if (supplied && (typeof value.id !== 'string' || !value.id.trim() || ids.has(value.id))) throw httpError(400, 'Step item id is invalid')
    if (supplied) ids.add(value.id)
    if (typeof value.title !== 'string' || !value.title.trim()) throw httpError(400, 'Step title is required')
    const title = value.title.trim()
    if (title.length > 80) throw httpError(400, 'Step title must be 80 characters or fewer')
    const description = optionalText(value, 'description', 'Step description', 300)
    return { ...(supplied ? { id: value.id } : {}), title, ...(description ? { description } : {}) }
  })
  const heading = optionalText(body, 'heading', 'Steps heading', 120)
  const intro = optionalText(body, 'intro', 'Steps intro', 300)
  return { ...(heading ? { heading } : {}), ...(intro ? { intro } : {}), items }
}

const validateStatsInput = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 8) throw httpError(400, 'Highlights must include between 1 and 8 items')
  const ids = new Set()
  const items = body.items.map((item) => {
    const value = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
    const supplied = Object.prototype.hasOwnProperty.call(value, 'id')
    if (supplied && (typeof value.id !== 'string' || !value.id.trim() || ids.has(value.id))) throw httpError(400, 'Highlight item id is invalid')
    if (supplied) ids.add(value.id)
    for (const [field, label, max] of [['value', 'Highlight value', 16], ['label', 'Highlight label', 60]]) {
      if (typeof value[field] !== 'string' || !value[field].trim()) throw httpError(400, `${label} is required`)
      if (value[field].trim().length > max) throw httpError(400, `${label} must be ${max} characters or fewer`)
    }
    return { ...(supplied ? { id: value.id } : {}), value: value.value.trim(), label: value.label.trim() }
  })
  const heading = optionalText(body, 'heading', 'Highlights heading', 120)
  const intro = optionalText(body, 'intro', 'Highlights intro', 300)
  return { ...(heading ? { heading } : {}), ...(intro ? { intro } : {}), items }
}

const validateCtaInput = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof body.heading !== 'string' || !body.heading.trim()) throw httpError(400, 'Call to Action heading is required')
  const heading = body.heading.trim()
  if (heading.length > 120) throw httpError(400, 'Call to Action heading must be 120 characters or fewer')
  const text = optionalText(body, 'body', 'Call to Action body', 300)
  return { heading, ...(text ? { body: text } : {}), ...validateOptionalSectionAction(body, 'Call to Action') }
}

const validateLogosInput = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (!Array.isArray(body.items) || body.items.length > 24) throw httpError(400, 'Logos cannot exceed 24 items')
  const ids = new Set()
  const mediaIds = new Set()
  const items = body.items.map((item) => {
    const value = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
    const supplied = Object.prototype.hasOwnProperty.call(value, 'id')
    if (supplied && (typeof value.id !== 'string' || !value.id.trim() || ids.has(value.id))) throw httpError(400, 'Logo item id is invalid')
    if (supplied) ids.add(value.id)
    if (typeof value.mediaId !== 'string' || !value.mediaId.trim()) throw httpError(400, 'Logo image is required')
    const mediaId = value.mediaId.trim()
    if (mediaIds.has(mediaId)) throw httpError(400, 'Duplicate logo image')
    mediaIds.add(mediaId)
    if (typeof value.altText !== 'string' || !value.altText.trim()) throw httpError(400, 'Logo image alt text is required')
    const altText = value.altText.trim()
    if (altText.length > 250) throw httpError(400, 'Logo image alt text must be 250 characters or fewer')
    return { ...(supplied ? { id: value.id } : {}), mediaId, altText }
  })
  const heading = optionalText(body, 'heading', 'Logos heading', 120)
  return { ...(heading ? { heading } : {}), items }
}

const contentValidators = {
  hero: validateHeroInput,
  about: validateAboutInput,
  services: validateServicesInput,
  gallery: validateGalleryInput,
  testimonials: validateTestimonialsInput,
  faq: validateFaqInput,
  process: validateProcessInput,
  stats: validateStatsInput,
  cta: validateCtaInput,
  logos: validateLogosInput,
  contact: validateContactInput,
  businessHours: (content) => {
    if (!content || typeof content !== 'object' || Array.isArray(content)) throw httpError(400, 'Business Hours content is invalid')
    for (const [field, max] of [['heading', 120], ['intro', 300]]) {
      if (Object.prototype.hasOwnProperty.call(content, field) && typeof content[field] !== 'string') {
        throw httpError(400, `Business Hours ${field} must be a string`)
      }
      if (typeof content[field] === 'string' && content[field].trim().length > max) {
        throw httpError(400, `Business Hours ${field} is too long`)
      }
    }
    return content
  }
}

const validateSectionContent = (type, content, { allowEmptyGallery = false } = {}) => {
  if (type === 'hero') {
    const { title, subtitle } = validateHeroInput(content)
    return { title, ...(subtitle ? { subtitle } : {}), ...(typeof content?.ctaLabel === 'string' && content.ctaLabel.trim() ? { ctaLabel: content.ctaLabel.trim() } : {}) }
  }
  if (type === 'gallery' && allowEmptyGallery && content && Array.isArray(content.items) && content.items.length === 0) {
    if (typeof content.title !== 'string' || !content.title.trim() || content.title.trim().length > 100) {
      throw httpError(400, 'Gallery title is required')
    }
    return { title: content.title.trim(), items: [] }
  }
  return contentValidators[type](content)
}

export const validateSectionComposition = (sections, pageId = 'home', status = 500) => {
  // Preserve the old two-argument internal/testing convention.
  if (typeof pageId === 'number') { status = pageId; pageId = 'home' }
  const home = pageId === 'home'
  const invalid = (message = `${home ? 'Home' : 'Page'} sections invalid`) => { throw httpError(status, message) }
  if (!Array.isArray(sections) || (home && sections.length === 0)) invalid()
  const ids = new Set()
  const counts = new Map()
  for (const section of sections) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) invalid()
    if (typeof section.id !== 'string' || !section.id.trim() || ids.has(section.id)) invalid()
    if (typeof section.type !== 'string' || !SECTION_TYPE_SET.has(section.type)) invalid()
    if (typeof section.hidden !== 'boolean') invalid()
    ids.add(section.id)
    counts.set(section.type, (counts.get(section.type) || 0) + 1)
    if (['services', 'gallery', 'testimonials', 'faq', 'process', 'stats', 'logos'].includes(section.type) && Array.isArray(section.content?.items)) {
      const itemIds = new Set()
      for (const item of section.content.items) {
        if (!item || typeof item.id !== 'string' || !item.id.trim() || itemIds.has(item.id)) invalid()
        itemIds.add(item.id)
      }
    }
    try {
      validateSectionContent(section.type, section.content, { allowEmptyGallery: true })
    } catch {
      invalid()
    }
  }
  for (const type of SINGLETON_SECTION_TYPES) {
    if ((counts.get(type) || 0) > 1) invalid()
  }
  if (home) {
    if ((counts.get('hero') || 0) !== 1 || sections[0]?.type !== 'hero' || sections[0]?.hidden !== false) invalid()
  } else if ((counts.get('hero') || 0) !== 0) invalid()
  return new Map(sections.map((section) => [section.id, section]))
}

export const validatePageSlug = (value) => {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 60) {
    throw httpError(400, 'Page slug must be 1 to 60 lowercase letters, numbers, or single hyphens')
  }
  if (RESERVED_PAGE_SLUGS.has(value)) throw httpError(400, 'Page slug is reserved')
  return value
}

export const slugifyPageTitle = (value) => String(value || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 60)

const validatePageRecord = (page, status = 400) => {
  if (!page || typeof page !== 'object' || Array.isArray(page) || typeof page.id !== 'string' || !page.id || page.id === 'home') throw httpError(status, 'Page is invalid')
  if (typeof page.title !== 'string' || !page.title.trim() || page.title.trim().length > 120) throw httpError(status, 'Page title is invalid')
  try { validatePageSlug(page.slug) } catch { throw httpError(status, 'Page slug is invalid') }
  return { ...page, title: page.title.trim() }
}

const TEMPLATE_ITEM_SECTION_TYPES = new Set(['services', 'gallery', 'testimonials', 'faq', 'process', 'stats', 'logos'])

const copyTemplateSection = (templateSection) => {
  const content = structuredClone(templateSection.content)
  if (TEMPLATE_ITEM_SECTION_TYPES.has(templateSection.type) && Array.isArray(content.items)) {
    content.items = content.items.map((item) => ({ ...item, id: randomUUID() }))
  }
  return { id: randomUUID(), type: templateSection.type, hidden: templateSection.hidden, content }
}

const materializeTemplateNavigation = (items, pageIdsByKey, label) => {
  if (!Array.isArray(items)) throw httpError(500, `${label} is invalid`)
  return items.map((item) => {
    if (!isObject(item) || typeof item.pageKey !== 'string' || !pageIdsByKey.has(item.pageKey)) {
      throw httpError(500, `${label} contains an unknown page key`)
    }
    return { pageId: pageIdsByKey.get(item.pageKey), ...(typeof item.label === 'string' ? { label: item.label } : {}) }
  })
}

const validateMaterializedTemplatePages = (pages) => {
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > MAX_PAGES) {
    throw httpError(500, 'Site template pages are invalid')
  }
  const home = pages[0]
  if (!home || home.id !== 'home' || home.slug !== '/' || home.title !== 'Home' || pages.filter((page) => page?.id === 'home').length !== 1) {
    throw httpError(500, 'Site template Home page is invalid')
  }
  for (const page of pages) {
    if (page.id !== 'home') validatePageRecord(page, 500)
    try {
      requireUniquePageSlug(pages, page.slug, page.id)
    } catch {
      throw httpError(500, 'Site template page slug is duplicated')
    }
    validateSectionComposition(page.sections, page.id, 500)
  }
}

export const materializeSiteTemplate = (template, config, now = Date.now()) => {
  if (!template || !Array.isArray(template.pages) || template.pages.length === 0 || template.pages.length > MAX_PAGES) {
    throw httpError(500, 'Site template is invalid')
  }
  const pageIdsByKey = new Map()
  for (const page of template.pages) {
    if (!isObject(page) || typeof page.key !== 'string' || !page.key || pageIdsByKey.has(page.key)) {
      throw httpError(500, 'Site template has invalid page keys')
    }
    pageIdsByKey.set(page.key, page.key === 'home' ? 'home' : randomUUID())
  }
  if (pageIdsByKey.get('home') !== 'home') throw httpError(500, 'Site template must include Home')

  const pageOrder = template.pages.map((page) => pageIdsByKey.get(page.key))
  if (pageOrder[0] !== 'home') throw httpError(500, 'Site template must put Home first')
  const pages = template.pages.map((templatePage) => ({
    id: pageIdsByKey.get(templatePage.key),
    slug: templatePage.slug,
    title: templatePage.key === 'home' ? 'Home' : templatePage.title,
    sections: Array.isArray(templatePage.sections) ? templatePage.sections.map(copyTemplateSection) : [],
    createdAt: now,
    updatedAt: now
  }))
  const header = {
    ...structuredClone(template.header),
    navigation: { items: materializeTemplateNavigation(template.header?.navigation?.items, pageIdsByKey, 'Template header navigation') }
  }
  const footer = {
    ...structuredClone(template.footer),
    ...(template.footer?.navigationMode === 'custom'
      ? { navigationItems: materializeTemplateNavigation(template.footer.navigationItems, pageIdsByKey, 'Template footer navigation') }
      : {})
  }

  // Validate the fully materialized runtime state, not the logical template source.
  validateMaterializedTemplatePages(pages)
  const theme = validateSiteTheme(template.theme)
  validateSiteHeader(header, pageOrder)
  validateSiteFooter(footer, pageOrder)
  const nextConfig = { ...config, theme, header, footer, pageOrder, updatedAt: now }
  const definition = toSiteDefinition(nextConfig, pages)
  return { config: nextConfig, pages, definition }
}

export const validateSiteTemplate = (template) => {
  materializeSiteTemplate(template, { status: 'DRAFT', branding: { siteName: 'Website' } }, 0)
  return true
}

const requireSection = (sections, sectionId) => {
  const index = sections.findIndex((section) => section.id === sectionId)
  if (index === -1) throw httpError(400, 'Unknown section id')
  return { section: sections[index], index }
}

const readPageSnapshots = async (transaction, refs, config) => {
  const order = pageOrderFrom(config)
  const snapshots = await (transaction ? transaction.getAll(...order.map(refs.page)) : firestore.getAll(...order.map(refs.page)))
  if (snapshots.some((snapshot) => !snapshot.exists)) throw httpError(500, order.length === 1 && order[0] === 'home' ? 'Site home page missing' : 'Site page is missing')
  return { order, snapshots }
}

const pagesFromSnapshots = (order, snapshots) => order.map((id, index) => {
  const page = snapshots[index].data()
  if (!page || page.id !== id) {
    throw httpError(500, order.length === 1 && id === 'home' ? 'Home sections invalid' : 'Site page is invalid')
  }
  return page
})

const readWorkingSite = async (tenantId, transaction) => {
  const refs = refsFor(tenantId)
  const configSnapshot = await (transaction ? transaction.get(refs.config) : refs.config.get())
  if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
  const config = configSnapshot.data()
  const { order, snapshots } = await readPageSnapshots(transaction, refs, config)
  return { refs, config, order, snapshots, pages: pagesFromSnapshots(order, snapshots) }
}

const mutateWorkingPage = async (tenantId, pageId, transformSections, mediaRequirement) => {
  const { config: configRef } = refsFor(tenantId)
  const now = Date.now()
  let definition

  await firestore.runTransaction(async (transaction) => {
    const { refs, config, order, pages } = await readWorkingSite(tenantId, transaction)
    if (!order.includes(pageId)) throw httpError(404, 'Page not found')
    const pageIndex = order.indexOf(pageId)
    const page = pages[pageIndex]
    const sections = page.sections
    validateSectionComposition(sections, pageId)
    const nextSections = transformSections(sections, config)
    validateSectionComposition(nextSections, pageId)
    if (mediaRequirement) {
      const mediaIds = typeof mediaRequirement.mediaIds === 'function'
        ? mediaRequirement.mediaIds(nextSections)
        : mediaRequirement.mediaIds
      const message = typeof mediaRequirement.message === 'function' ? mediaRequirement.message() : mediaRequirement.message
      await requireTenantMediaInTransaction(transaction, tenantId, [...new Set(mediaIds || [])], message)
    }
    const nextPage = {
      ...page,
      sections: nextSections,
      updatedAt: now
    }
    const nextConfig = mediaRequirement?.configTransform
      ? { ...mediaRequirement.configTransform(config), updatedAt: now }
      : { ...config, updatedAt: now }

    transaction.set(refs.page(pageId), nextPage)
    transaction.set(configRef, nextConfig)
    const nextPages = [...pages]
    nextPages[pageIndex] = nextPage
    definition = toSiteDefinition(nextConfig, nextPages)
  })

  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const initializeSite = async (tenantId, actorUserId) => {
  const refs = refsFor(tenantId)
  const now = Date.now()
  let definition

  await firestore.runTransaction(async (transaction) => {
    // Firestore transactions require every read to happen before any write.
    const [tenantSnapshot, configSnapshot] = await Promise.all([
      transaction.get(refs.tenant),
      transaction.get(refs.config)
    ])

    if (!tenantSnapshot.exists) throw httpError(404, 'Tenant not found')
    if (configSnapshot.exists) throw httpError(409, 'Site already initialized')

    const config = {
      status: 'DRAFT',
      branding: {
        siteName: String(tenantSnapshot.data().name || '').trim().slice(0, 80) || 'Website'
      },
      theme: DEFAULT_SITE_THEME,
      header: DEFAULT_SITE_HEADER,
      footer: DEFAULT_SITE_FOOTER,
      pageOrder: ['home'],
      createdAt: now,
      updatedAt: now,
      createdByUserId: actorUserId
    }
    const home = {
      id: 'home',
      slug: '/',
      title: 'Home',
      sections: [createDefaultSection('hero', { siteName: tenantSnapshot.data().name })],
      createdAt: now,
      updatedAt: now
    }

    transaction.set(refs.config, config)
    transaction.set(refs.home, home)
    definition = toSiteDefinition(config, [home])
  })

  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const getSite = async (tenantId) => {
  const { config, pages } = await readWorkingSite(tenantId)
  return finalizeSiteDefinitionRead(tenantId, toSiteDefinition(config, pages))
}

export const listSiteTemplates = async () => SITE_TEMPLATES.map(siteTemplateMetadata)

export const applySiteTemplate = async (tenantId, templateId) => {
  const template = getSiteTemplate(templateId)
  if (!template) throw httpError(404, 'Site template not found')
  let definition

  await firestore.runTransaction(async (transaction) => {
    const { refs, config, order } = await readWorkingSite(tenantId, transaction)
    // Firestore can rerun this callback after contention, so identifiers are minted here.
    const now = Math.max(Date.now(), validTimestamp(config.updatedAt) ? config.updatedAt + 1 : 0)
    const materialized = materializeSiteTemplate(template, config, now)
    const nextPageIds = new Set(materialized.config.pageOrder)
    for (const pageId of order) {
      if (!nextPageIds.has(pageId)) transaction.delete(refs.page(pageId))
    }
    for (const page of materialized.pages) transaction.set(refs.page(page.id), page)
    transaction.set(refs.config, materialized.config)
    definition = materialized.definition
  })

  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const getPublishedSiteDefinition = async (tenantId) => {
  const refs = refsFor(tenantId)
  const configSnapshot = await refs.config.get()
  if (!configSnapshot.exists || configSnapshot.data().status !== 'PUBLISHED') {
    throw httpError(404, 'Site not found')
  }

  const publishedSnapshot = await refs.published.get()
  const snapshot = publishedSnapshot.exists && publishedSnapshot.data()
  if (!snapshot || !snapshot.siteDefinition || snapshot.siteDefinition.status !== 'PUBLISHED') {
    throw httpError(404, 'Site not found')
  }

  return finalizeSiteDefinitionRead(tenantId, normalizePublishedSiteDefinition(snapshot.siteDefinition))
}

export const updateSiteBranding = async (tenantId, input) => {
  const identity = validateSiteBranding(input)
  const refs = refsFor(tenantId)
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    if (identity.logoMediaId) {
      await requireTenantMediaInTransaction(transaction, tenantId, [identity.logoMediaId], 'Logo image not found')
    }
    if (identity.faviconMediaId) {
      await requireTenantMediaInTransaction(transaction, tenantId, [identity.faviconMediaId], 'Favicon image not found')
    }
    const { config, pages } = await readWorkingSite(tenantId, transaction)
    const branding = {
      siteName: identity.siteName,
      ...(identity.logoMediaId ? { logoMediaId: identity.logoMediaId } : {}),
      ...(identity.faviconMediaId ? { faviconMediaId: identity.faviconMediaId } : {})
    }
    const nextConfig = { ...config, branding, updatedAt: now }
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, pages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updateSiteHeader = async (tenantId, input) => {
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    const { refs, config, order, pages } = await readWorkingSite(tenantId, transaction)
    const header = validateSiteHeader(input, order)
    const nextConfig = { ...config, header, updatedAt: now }
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, pages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updateSiteFooter = async (tenantId, input) => {
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    const { refs, config, order, pages } = await readWorkingSite(tenantId, transaction)
    const footer = validateSiteFooter(input, order)
    const nextConfig = { ...config, footer, updatedAt: now }
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, pages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updateSiteTheme = async (tenantId, input) => {
  const theme = validateSiteTheme(input)
  const refs = refsFor(tenantId)
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    const { config, pages } = await readWorkingSite(tenantId, transaction)
    const nextConfig = { ...config, theme, updatedAt: now }
    transaction.set(refs.config, { theme, updatedAt: now }, { merge: true })
    definition = toSiteDefinition(nextConfig, pages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updateSiteSeo = async (tenantId, input) => {
  const update = validateSiteSeo(input)
  const refs = refsFor(tenantId)
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    if (update.socialImageMediaId) await requireTenantMediaInTransaction(transaction, tenantId, [update.socialImageMediaId], 'SEO social image not found')
    const { config, pages } = await readWorkingSite(tenantId, transaction)
    const nextConfig = { ...config, seo: update.seo, updatedAt: now }
    if (update.hasSocialImageMediaId) {
      const profile = { ...(config.businessProfile || {}) }
      if (update.socialImageMediaId) profile.socialImageMediaId = update.socialImageMediaId
      else delete profile.socialImageMediaId
      if (Object.keys(profile).length) nextConfig.businessProfile = profile
      else delete nextConfig.businessProfile
    }
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, pages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updateBusinessProfile = async (tenantId, input) => {
  const businessProfile = validateBusinessProfile(input)
  const refs = refsFor(tenantId)
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    if (businessProfile.socialImageMediaId) {
      await requireTenantMediaInTransaction(transaction, tenantId, [businessProfile.socialImageMediaId], 'Social image not found')
    }
    const { config, pages } = await readWorkingSite(tenantId, transaction)
    const storedProfile = businessProfileResponse(config.businessProfile)
    const compatibleProfile = {
      ...businessProfile,
      ...(storedProfile?.businessHours ? { businessHours: storedProfile.businessHours } : {}),
      ...(storedProfile?.socialLinks ? { socialLinks: storedProfile.socialLinks } : {})
    }
    const nextConfig = { ...config, updatedAt: now }
    if (hasBusinessProfile(compatibleProfile)) nextConfig.businessProfile = compatibleProfile
    else delete nextConfig.businessProfile
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, pages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updateBusinessHours = async (tenantId, input, sectionId) => {
  const update = validateBusinessHoursUpdate(input)
  return mutateWorkingPage(tenantId, 'home', (sections) => {
    const nextSections = [...sections]
    const existing = sectionId ? requireSection(sections, sectionId) : null
    if (existing && existing.section.type !== 'businessHours') throw httpError(400, 'Section is not Business Hours')
    if (!existing && sections.some((section) => section.type === 'businessHours')) {
      throw httpError(400, 'Business Hours section id is required')
    }
    if (update.preserveSections) {
      // The global Site Setup schedule is independent of per-page presentation sections.
    } else if (!update.businessHours || !update.homepage.enabled) {
      if (existing) nextSections.splice(existing.index, 1)
    } else {
      const section = {
        id: existing?.section.id || randomUUID(),
        type: 'businessHours',
        hidden: false,
        content: {
          ...(update.homepage.heading ? { heading: update.homepage.heading } : {}),
          ...(update.homepage.intro ? { intro: update.homepage.intro } : {})
        }
      }
      if (existing) nextSections[existing.index] = section
      else {
        const contactIndex = nextSections.findIndex((item) => item.type === 'contact')
        if (contactIndex === -1) nextSections.push(section)
        else nextSections.splice(contactIndex, 0, section)
      }
    }
    return nextSections
  }, {
    configTransform: (config) => {
      const nextProfile = { ...(config.businessProfile || {}) }
      if (update.businessHours) nextProfile.businessHours = update.businessHours
      else delete nextProfile.businessHours
      const nextConfig = { ...config }
      if (hasBusinessProfile(nextProfile)) nextConfig.businessProfile = nextProfile
      else delete nextConfig.businessProfile
      return nextConfig
    }
  })
}

export const updateSocialLinks = async (tenantId, input) => {
  const socialLinks = validateSocialLinksUpdate(input)
  const refs = refsFor(tenantId)
  const now = Date.now()
  let definition

  await firestore.runTransaction(async (transaction) => {
    const { config, pages } = await readWorkingSite(tenantId, transaction)
    const nextProfile = { ...(config.businessProfile || {}) }
    if (socialLinks) nextProfile.socialLinks = socialLinks
    else delete nextProfile.socialLinks
    const nextConfig = { ...config, updatedAt: now }
    if (hasBusinessProfile(nextProfile)) nextConfig.businessProfile = nextProfile
    else delete nextConfig.businessProfile
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, pages)
  })

  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updateCustomCss = async (tenantId, input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const customCss = body.customCss === null ? undefined : validateCustomCss(body.customCss)
  const refs = refsFor(tenantId)
  const now = Date.now()
  let definition

  await firestore.runTransaction(async (transaction) => {
    const { config, pages } = await readWorkingSite(tenantId, transaction)
    const nextConfig = { ...config, updatedAt: now }
    if (customCss) nextConfig.customCss = customCss
    else delete nextConfig.customCss
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, pages)
  })

  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const getPublicSite = async (tenantId, env = process.env) => {
  if (draftPreviewEnabled(env)) {
    try {
      const working = await getSite(tenantId)
      return { ...working, status: 'DRAFT', hasUnpublishedChanges: false }
    } catch (error) {
      if (error.status === 404) throw httpError(404, 'Site not found')
      throw error
    }
  }

  return getPublishedSiteDefinition(tenantId)
}

export const publishSite = async (tenantId, actorUserId) => {
  const refs = refsFor(tenantId)
  const now = Date.now()
  let publishedDefinition

  await firestore.runTransaction(async (transaction) => {
    const { config, pages } = await readWorkingSite(tenantId, transaction)
    const [currentSnapshot, indexSnapshot] = await Promise.all([
      transaction.get(refs.published),
      transaction.get(refs.revisionIndex)
    ])
    const workingDefinition = toSiteDefinition(config, pages)
    const canonicalWorkingDefinition = { ...workingDefinition }
    delete canonicalWorkingDefinition.hasUnpublishedChanges
    delete canonicalWorkingDefinition.lastPublishedAt
    const storedPublishedDefinition = { ...canonicalWorkingDefinition, status: 'PUBLISHED' }
    await requireTenantMediaInTransaction(transaction, tenantId, collectSiteMediaIds(storedPublishedDefinition), 'Published site media not found')
    const revisionId = randomUUID()
    const publishedRecord = {
      revisionId,
      siteDefinition: storedPublishedDefinition,
      publishedAt: now,
      publishedByUserId: actorUserId
    }
    if (Buffer.byteLength(JSON.stringify(publishedRecord), 'utf8') > MAX_PUBLISHED_SNAPSHOT_BYTES) {
      throw httpError(400, 'Published site is too large to store safely')
    }
    const nextConfig = {
      ...config,
      status: 'PUBLISHED',
      updatedAt: now,
      lastPublishedAt: now,
      lastPublishedByUserId: actorUserId
    }
    publishedDefinition = toSiteDefinition(nextConfig, pages)
    let entries = revisionEntries(indexSnapshot.exists ? indexSnapshot.data() : null)
    const current = currentSnapshot.exists ? currentSnapshot.data() : null
    if (current?.siteDefinition && !current.revisionId) {
      if (!validTimestamp(current.publishedAt) || typeof current.publishedByUserId !== 'string') throw httpError(500, 'Legacy published site is invalid')
      const baselineId = randomUUID()
      const baseline = {
        revisionId: baselineId,
        publishedAt: current.publishedAt,
        publishedByUserId: current.publishedByUserId,
        siteDefinition: structuredClone(current.siteDefinition)
      }
      // Validate before retaining an old live snapshot as an immutable revision.
      validateRevisionDefinition(baseline.siteDefinition)
      transaction.set(refs.revision(baselineId), baseline)
      transaction.set(refs.revisionMedia(baselineId), { mediaIds: collectSiteMediaIds(baseline.siteDefinition) })
      entries = [{ revisionId: baselineId, publishedAt: baseline.publishedAt, publishedByUserId: baseline.publishedByUserId, pageCount: baseline.siteDefinition.pages.length }, ...entries]
    }
    transaction.set(refs.revision(revisionId), publishedRecord)
    transaction.set(refs.revisionMedia(revisionId), { mediaIds: collectSiteMediaIds(storedPublishedDefinition) })
    entries = [{ revisionId, publishedAt: now, publishedByUserId: actorUserId, pageCount: storedPublishedDefinition.pages.length }, ...entries.filter((entry) => entry.revisionId !== revisionId)]
    const retained = entries.slice(0, MAX_PUBLISHED_REVISIONS)
    for (const entry of entries.slice(MAX_PUBLISHED_REVISIONS)) {
      transaction.delete(refs.revision(entry.revisionId))
      transaction.delete(refs.revisionMedia(entry.revisionId))
    }
    transaction.set(refs.published, publishedRecord)
    transaction.set(refs.revisionIndex, { entries: retained })
    transaction.set(refs.config, nextConfig)
  })

  return finalizeSiteDefinitionRead(tenantId, publishedDefinition)
}

export const listSiteRevisions = async (tenantId) => {
  const refs = refsFor(tenantId)
  const [currentSnapshot, indexSnapshot] = await Promise.all([refs.published.get(), refs.revisionIndex.get()])
  const current = currentSnapshot.exists ? currentSnapshot.data() : null
  const entries = revisionEntries(indexSnapshot.exists ? indexSnapshot.data() : null)
  if (current?.siteDefinition && !current.revisionId) {
    return {
      revisions: [{ revisionId: null, publishedAt: current.publishedAt, publishedByUserId: current.publishedByUserId, pageCount: Array.isArray(current.siteDefinition.pages) ? current.siteDefinition.pages.length : 0, isCurrent: true }]
    }
  }
  return { revisions: entries.map((entry) => ({ ...entry, isCurrent: entry.revisionId === current?.revisionId })) }
}

export const restoreSiteRevision = async (tenantId, revisionId) => {
  if (typeof revisionId !== 'string' || !revisionId) throw httpError(404, 'Published revision not found')
  const refs = refsFor(tenantId)
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    const { config, order } = await readWorkingSite(tenantId, transaction)
    const [indexSnapshot, revisionSnapshot] = await Promise.all([
      transaction.get(refs.revisionIndex),
      transaction.get(refs.revision(revisionId))
    ])
    if (!revisionEntries(indexSnapshot.exists ? indexSnapshot.data() : null).some((entry) => entry.revisionId === revisionId) || !revisionSnapshot.exists) {
      throw httpError(404, 'Published revision not found')
    }
    const record = revisionSnapshot.data()
    if (!record || record.revisionId !== revisionId) throw revisionError()
    const historical = validateRevisionDefinition(record.siteDefinition)
    const restoredPages = historical.pages.map((page) => ({ ...page, createdAt: now, updatedAt: now }))
    const nextConfig = {
      ...config,
      status: config.status,
      pageOrder: historical.pageOrder,
      branding: historical.branding,
      theme: historical.theme,
      header: historical.header,
      footer: historical.footer,
      updatedAt: now
    }
    if (historical.seo) nextConfig.seo = historical.seo
    else delete nextConfig.seo
    if (historical.businessProfile) nextConfig.businessProfile = historical.businessProfile
    else delete nextConfig.businessProfile
    if (historical.customCss) nextConfig.customCss = historical.customCss
    else delete nextConfig.customCss
    const restoredIds = new Set(historical.pageOrder)
    for (const pageId of order) if (!restoredIds.has(pageId)) transaction.delete(refs.page(pageId))
    for (const page of restoredPages) transaction.set(refs.page(page.id), page)
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, restoredPages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const unpublishSite = async (tenantId, actorUserId) => {
  const refs = refsFor(tenantId)
  const now = Date.now()
  let draftDefinition

  await firestore.runTransaction(async (transaction) => {
    const { config, pages } = await readWorkingSite(tenantId, transaction)
    const nextConfig = {
      ...config,
      status: 'DRAFT',
      updatedAt: now,
      lastUnpublishedAt: now,
      lastUnpublishedByUserId: actorUserId
    }
    draftDefinition = toSiteDefinition(nextConfig, pages)

    transaction.set(refs.config, nextConfig)
  })

  return finalizeSiteDefinitionRead(tenantId, draftDefinition)
}

const validatePageTitle = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) throw httpError(400, 'Page title must be between 1 and 120 characters')
  return value.trim()
}

const requireUniquePageSlug = (pages, slug, pageId) => {
  if (pages.some((page) => page.id !== pageId && page.slug === slug)) throw httpError(409, 'Page slug is already in use')
}

export const createPage = async (tenantId, input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const title = validatePageTitle(body.title)
  const slug = validatePageSlug(body.slug)
  const pageId = randomUUID()
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    const { refs, config, order, pages } = await readWorkingSite(tenantId, transaction)
    if (order.length >= MAX_PAGES) throw httpError(400, `Sites can have at most ${MAX_PAGES} pages`)
    requireUniquePageSlug(pages, slug, pageId)
    const page = { id: pageId, slug, title, sections: [], createdAt: now, updatedAt: now }
    const nextConfig = { ...config, pageOrder: [...order, pageId], updatedAt: now }
    transaction.set(refs.page(pageId), page)
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, [...pages, page])
  })
  return { site: await finalizeSiteDefinitionRead(tenantId, definition), pageId }
}

export const updatePage = async (tenantId, pageId, input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title')
  const hasSlug = Object.prototype.hasOwnProperty.call(body, 'slug')
  if (!hasTitle && !hasSlug) throw httpError(400, 'Page title or slug is required')
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    const { refs, config, order, pages } = await readWorkingSite(tenantId, transaction)
    if (!order.includes(pageId)) throw httpError(404, 'Page not found')
    if (pageId === 'home') throw httpError(400, 'Home page settings cannot be changed')
    const index = order.indexOf(pageId)
    const current = pages[index]
    const title = hasTitle ? validatePageTitle(body.title) : current.title
    const slug = hasSlug ? validatePageSlug(body.slug) : current.slug
    requireUniquePageSlug(pages, slug, pageId)
    const page = { ...current, title, slug, updatedAt: now }
    const nextPages = [...pages]; nextPages[index] = page
    const nextConfig = { ...config, updatedAt: now }
    transaction.set(refs.page(pageId), page)
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, nextPages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updatePageSeo = async (tenantId, pageId, input) => {
  const seo = validatePageSeo(input)
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    if (seo?.socialImageMediaId) await requireTenantMediaInTransaction(transaction, tenantId, [seo.socialImageMediaId], 'Page SEO social image not found')
    const { refs, config, order, pages } = await readWorkingSite(tenantId, transaction)
    const index = order.indexOf(pageId)
    if (index === -1) throw httpError(404, 'Page not found')
    const page = { ...pages[index], updatedAt: now }
    if (seo) page.seo = seo
    else delete page.seo
    const nextPages = [...pages]; nextPages[index] = page
    const nextConfig = { ...config, updatedAt: now }
    transaction.set(refs.page(pageId), page)
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, nextPages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const movePage = async (tenantId, pageId, direction) => {
  if (!['up', 'down'].includes(direction)) throw httpError(400, 'Move direction must be up or down')
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    const { refs, config, order, pages } = await readWorkingSite(tenantId, transaction)
    const index = order.indexOf(pageId)
    if (index === -1) throw httpError(404, 'Page not found')
    if (pageId === 'home') throw httpError(400, 'Home page cannot move')
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 1 || target >= order.length) throw httpError(400, 'Page cannot move in that direction')
    const nextOrder = [...order]; [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]]
    const byId = new Map(pages.map((page) => [page.id, page]))
    const nextPages = nextOrder.map((id) => byId.get(id))
    const header = normalizeSiteHeader(config.header, nextOrder)
    const footer = normalizeSiteFooter(config.footer, nextOrder)
    const nextConfig = { ...config, pageOrder: nextOrder, header, footer, updatedAt: now }
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, nextPages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const deletePage = async (tenantId, pageId) => {
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    const { refs, config, order, pages } = await readWorkingSite(tenantId, transaction)
    const index = order.indexOf(pageId)
    if (index === -1) throw httpError(404, 'Page not found')
    if (pageId === 'home') throw httpError(400, 'Home page cannot be deleted')
    const nextOrder = order.filter((id) => id !== pageId)
    const nextPages = pages.filter((page) => page.id !== pageId)
    // Persist the normalized navigation, not just the response projection. Otherwise a
    // later read or publish would re-introduce a deleted page from the stored config.
    const header = normalizeSiteHeader(config.header, nextOrder)
    const footer = normalizeSiteFooter(config.footer, nextOrder)
    const nextConfig = { ...config, pageOrder: nextOrder, header, footer, updatedAt: now }
    transaction.delete(refs.page(pageId))
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, nextPages)
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

const sectionMediaIds = (section) => {
  if (section.type === 'about') return section.content.imageMediaId ? [section.content.imageMediaId] : []
  if (section.type === 'gallery') return section.content.items.map((item) => item.mediaId)
  if (section.type === 'logos') return section.content.items.map((item) => item.mediaId)
  return []
}

const resolveItemIds = (type, content, storedContent) => {
  if (!['services', 'gallery', 'testimonials', 'faq', 'process', 'stats', 'logos'].includes(type)) return content
  const storedIds = new Set((storedContent?.items || []).map((item) => item.id))
  return {
    ...content,
    items: content.items.map((item) => {
      if (!Object.prototype.hasOwnProperty.call(item, 'id')) return { ...item, id: randomUUID() }
      if (!storedIds.has(item.id)) throw httpError(400, `Unknown ${type} item id`)
      return item
    })
  }
}

export const addSection = async (tenantId, pageId, type, { afterSectionId } = {}) => {
  if (!SECTION_TYPE_SET.has(type)) throw httpError(400, 'Unknown section type')
  let sectionId
  const site = await mutateWorkingPage(tenantId, pageId, (sections, config) => {
    if (type === 'hero' && pageId !== 'home') throw httpError(400, 'Hero section is only allowed on Home')
    if (SINGLETON_SECTION_TYPES.has(type) && sections.some((section) => section.type === type)) {
      throw httpError(409, `${type} section already exists`)
    }
    if (type === 'businessHours' && !config.businessProfile?.businessHours) {
      throw httpError(400, 'Configure business hours before adding them to a page')
    }
    const section = createDefaultSection(type, { siteName: config.branding?.siteName })
    sectionId = section.id
    const next = [...sections]
    if (afterSectionId === undefined) next.push(section)
    else {
      const { index } = requireSection(sections, afterSectionId)
      next.splice(index + 1, 0, section)
    }
    return next
  })
  return { site, sectionId }
}

export const removeSection = async (tenantId, pageId, sectionId) => {
  return mutateWorkingPage(tenantId, pageId, (sections) => {
    const { section, index } = requireSection(sections, sectionId)
    if (section.type === 'hero') throw httpError(400, 'Hero section cannot be removed')
    const next = [...sections]
    next.splice(index, 1)
    return next
  })
}

export const moveSection = async (tenantId, pageId, sectionId, direction) => {
  if (!['up', 'down'].includes(direction)) throw httpError(400, 'Move direction must be up or down')
  return mutateWorkingPage(tenantId, pageId, (sections) => {
    const { section, index } = requireSection(sections, sectionId)
    if (section.type === 'hero') throw httpError(400, 'Hero section cannot move')
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < (pageId === 'home' ? 1 : 0) || target >= sections.length) throw httpError(400, 'Section cannot move in that direction')
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
}

export const duplicateSection = async (tenantId, pageId, sectionId) => {
  let duplicateId
  const site = await mutateWorkingPage(tenantId, pageId, (sections) => {
    const { section, index } = requireSection(sections, sectionId)
    if (SINGLETON_SECTION_TYPES.has(section.type)) throw httpError(409, `${section.type} section cannot be duplicated`)
    const duplicate = structuredClone(section)
    duplicate.id = randomUUID()
    duplicateId = duplicate.id
    if (Array.isArray(duplicate.content?.items)) {
      duplicate.content.items = duplicate.content.items.map((item) => ({ ...item, id: randomUUID() }))
    }
    const next = [...sections]
    next.splice(index + 1, 0, duplicate)
    return next
  }, {
    mediaIds: (sections) => sectionMediaIds(requireSection(sections, sectionId).section),
    message: 'Section media not found'
  })
  return { site, sectionId: duplicateId }
}

export const setSectionVisibility = async (tenantId, pageId, sectionId, hidden) => {
  if (typeof hidden !== 'boolean') throw httpError(400, 'hidden must be a boolean')
  return mutateWorkingPage(tenantId, pageId, (sections) => {
    const { section, index } = requireSection(sections, sectionId)
    if (section.type === 'hero' && hidden) throw httpError(400, 'Hero section cannot be hidden')
    const next = [...sections]
    next[index] = { ...section, hidden }
    return next
  })
}

export const updateSectionContent = async (tenantId, pageId, sectionId, input) => {
  let mediaIds = []
  let mediaMessage = 'Section media not found'
  return mutateWorkingPage(tenantId, pageId, (sections) => {
    const { section, index } = requireSection(sections, sectionId)
    const validated = validateSectionContent(section.type, input)
    const content = resolveItemIds(section.type, validated, section.content)
    const nextSection = { ...section, content }
    mediaIds = sectionMediaIds(nextSection)
    if (section.type === 'about') mediaMessage = 'About image not found'
    if (section.type === 'gallery') mediaMessage = 'Gallery image not found'
    if (section.type === 'logos') mediaMessage = 'Logo image not found'
    const next = [...sections]
    next[index] = nextSection
    return next
  }, { mediaIds: () => mediaIds, message: () => mediaMessage })
}
