import { randomUUID } from 'node:crypto'
import { db } from '../client/firestoreClient.js'
import { draftPreviewEnabled } from '../config/publicSite.js'
import {
  EMAIL_MAX,
  PHONE_MAX,
  isValidEmail,
  isValidPhone
} from '../validation/contactMethods.js'
import { hydrateSiteMedia, requireTenantMediaInTransaction } from './mediaService.js'
import { siteBrandingResponse, validateSiteBranding } from '../domain/siteBranding.js'
import { DEFAULT_SITE_THEME, normalizeSiteTheme, validateSiteTheme } from '../domain/siteTheme.js'
import {
  businessProfileResponse,
  hasBusinessProfile,
  validateBusinessProfile
} from '../domain/businessProfile.js'
import { validateBusinessHoursUpdate } from '../domain/businessHours.js'
import { validateSocialLinksUpdate } from '../domain/socialLinks.js'
import { normalizeStoredCustomCss, validateCustomCss } from '../domain/customCss.js'
import {
  SECTION_TYPES,
  SINGLETON_SECTION_TYPES,
  createDefaultSection
} from '../domain/sectionDefaults.js'

const TENANTS = 'tenants'
const SECTION_TYPE_SET = new Set(SECTION_TYPES)

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
  return { tenant, config, home, published }
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

const publicationState = (config, home) => {
  const lastPublishedAt = validTimestamp(config.lastPublishedAt) ? config.lastPublishedAt : undefined
  if (config.status !== 'PUBLISHED' || lastPublishedAt === undefined) {
    return {
      hasUnpublishedChanges: false,
      ...(lastPublishedAt !== undefined ? { lastPublishedAt } : {})
    }
  }
  const workingTimestamps = [config.updatedAt, home.updatedAt].filter(validTimestamp)
  return {
    hasUnpublishedChanges: workingTimestamps.some((updatedAt) => updatedAt > lastPublishedAt),
    lastPublishedAt
  }
}

const toSiteDefinition = (config, home) => {
  validateSectionComposition(home?.sections)
  const definition = {
    status: config.status,
    ...publicationState(config, home),
    pages: [{
      id: home.id,
      slug: home.slug,
      title: home.title,
      sections: Array.isArray(home.sections) ? home.sections.map(siteSectionResponse) : home.sections
    }]
  }
  const businessProfile = businessProfileResponse(config.businessProfile)
  return {
    ...definition,
    branding: siteBrandingResponse(config.branding, definition),
    theme: normalizeSiteTheme(config.theme),
    ...(typeof config.customCss === 'string' ? { customCss: config.customCss } : {}),
    ...(businessProfile ? { businessProfile } : {})
  }
}

const normalizePublishedSiteDefinition = (definition) => {
  const home = Array.isArray(definition?.pages) ? definition.pages.find((page) => page?.slug === '/') : null
  validateSectionComposition(home?.sections)
  const businessProfile = businessProfileResponse(definition?.businessProfile)
  const canonical = definition && typeof definition === 'object' ? { ...definition } : {}
  delete canonical.customCss
  delete canonical.scopedCustomCss
  const normalized = {
    ...canonical,
    branding: siteBrandingResponse(definition?.branding, definition),
    theme: normalizeSiteTheme(definition?.theme),
    ...(typeof definition?.customCss === 'string' ? { customCss: definition.customCss } : {})
  }
  if (businessProfile) normalized.businessProfile = businessProfile
  else delete normalized.businessProfile
  return normalized
}

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
  return {
    ...(eyebrow ? { eyebrow } : {}),
    heading,
    body,
    ...(imageMediaId ? { imageMediaId, imageAlt } : {})
  }
}

const validateContactAction = (action) => {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw httpError(400, 'Contact action is required')
  }
  if (!['email', 'phone', 'url', 'leadForm'].includes(action.type)) {
    throw httpError(400, 'Contact action type is not supported')
  }
  if (action.type === 'leadForm') return { type: 'leadForm' }
  if (typeof action.value !== 'string' || !action.value.trim()) {
    throw httpError(400, 'Contact action value is required')
  }

  const value = action.value.trim()
  if (action.type === 'email') {
    if (value.length > EMAIL_MAX) {
      throw httpError(400, 'Contact email must be 254 characters or fewer')
    }
    if (!isValidEmail(value)) throw httpError(400, 'Contact email is invalid')
    return { type: 'email', value }
  }

  if (action.type === 'phone') {
    if (value.length > PHONE_MAX) {
      throw httpError(400, 'Contact phone must be 50 characters or fewer')
    }
    if (!isValidPhone(value)) throw httpError(400, 'Contact phone is invalid')
    return { type: 'phone', value }
  }

  if (value.length > 2048) {
    throw httpError(400, 'Contact URL must be 2048 characters or fewer')
  }
  try {
    const parsedUrl = new URL(value)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw httpError(400, 'Contact URL must use http or https')
    }
    return { type: 'url', value: parsedUrl.toString() }
  } catch (error) {
    if (error.status === 400) throw error
    throw httpError(400, 'Contact URL must use http or https')
  }
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

const contentValidators = {
  hero: validateHeroInput,
  about: validateAboutInput,
  services: validateServicesInput,
  gallery: validateGalleryInput,
  testimonials: validateTestimonialsInput,
  faq: validateFaqInput,
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

export const validateSectionComposition = (sections, status = 500) => {
  const invalid = (message = 'Home sections invalid') => { throw httpError(status, message) }
  if (!Array.isArray(sections) || sections.length === 0) invalid()
  const ids = new Set()
  const counts = new Map()
  for (const section of sections) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) invalid()
    if (typeof section.id !== 'string' || !section.id.trim() || ids.has(section.id)) invalid()
    if (typeof section.type !== 'string' || !SECTION_TYPE_SET.has(section.type)) invalid()
    if (typeof section.hidden !== 'boolean') invalid()
    ids.add(section.id)
    counts.set(section.type, (counts.get(section.type) || 0) + 1)
    if (['services', 'gallery', 'testimonials', 'faq'].includes(section.type) && Array.isArray(section.content?.items)) {
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
  if ((counts.get('hero') || 0) !== 1 || sections[0]?.type !== 'hero' || sections[0]?.hidden !== false) invalid()
  return new Map(sections.map((section) => [section.id, section]))
}

const requirePageId = (pageId) => {
  if (pageId !== 'home') throw httpError(400, 'Only the home page is supported')
}

const requireSection = (sections, sectionId) => {
  const index = sections.findIndex((section) => section.id === sectionId)
  if (index === -1) throw httpError(400, 'Unknown section id')
  return { section: sections[index], index }
}

const mutateWorkingHome = async (tenantId, transformSections, mediaRequirement) => {
  const { config: configRef, home: homeRef } = refsFor(tenantId)
  const now = Date.now()
  let definition

  await firestore.runTransaction(async (transaction) => {
    const [configSnapshot, homeSnapshot] = await Promise.all([
      transaction.get(configRef),
      transaction.get(homeRef)
    ])

    if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
    if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')

    const config = configSnapshot.data()
    const home = homeSnapshot.data()
    const sections = home.sections
    validateSectionComposition(sections)
    const nextSections = transformSections(sections, config)
    validateSectionComposition(nextSections)
    if (mediaRequirement) {
      const mediaIds = typeof mediaRequirement.mediaIds === 'function'
        ? mediaRequirement.mediaIds(nextSections)
        : mediaRequirement.mediaIds
      const message = typeof mediaRequirement.message === 'function' ? mediaRequirement.message() : mediaRequirement.message
      await requireTenantMediaInTransaction(transaction, tenantId, [...new Set(mediaIds || [])], message)
    }
    const nextHome = {
      ...home,
      sections: nextSections,
      updatedAt: now
    }
    const nextConfig = mediaRequirement?.configTransform
      ? { ...mediaRequirement.configTransform(config), updatedAt: now }
      : { ...config, updatedAt: now }

    transaction.set(homeRef, nextHome)
    transaction.set(configRef, nextConfig)
    definition = toSiteDefinition(nextConfig, nextHome)
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
    definition = toSiteDefinition(config, home)
  })

  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const getSite = async (tenantId) => {
  const refs = refsFor(tenantId)
  const [configSnapshot, homeSnapshot] = await Promise.all([
    refs.config.get(),
    refs.home.get()
  ])

  if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
  if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')

  return finalizeSiteDefinitionRead(tenantId, toSiteDefinition(configSnapshot.data(), homeSnapshot.data()))
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
    const [configSnapshot, homeSnapshot] = await Promise.all([
      transaction.get(refs.config),
      transaction.get(refs.home)
    ])
    if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
    if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')
    const branding = {
      siteName: identity.siteName,
      ...(identity.logoMediaId ? { logoMediaId: identity.logoMediaId } : {}),
      ...(identity.faviconMediaId ? { faviconMediaId: identity.faviconMediaId } : {})
    }
    const nextConfig = { ...configSnapshot.data(), branding, updatedAt: now }
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, homeSnapshot.data())
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updateSiteTheme = async (tenantId, input) => {
  const theme = validateSiteTheme(input)
  const refs = refsFor(tenantId)
  const now = Date.now()
  let definition
  await firestore.runTransaction(async (transaction) => {
    const [configSnapshot, homeSnapshot] = await Promise.all([
      transaction.get(refs.config),
      transaction.get(refs.home)
    ])
    if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
    if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')
    const nextConfig = { ...configSnapshot.data(), theme, updatedAt: now }
    transaction.set(refs.config, { theme, updatedAt: now }, { merge: true })
    definition = toSiteDefinition(nextConfig, homeSnapshot.data())
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
    const [configSnapshot, homeSnapshot] = await Promise.all([
      transaction.get(refs.config),
      transaction.get(refs.home)
    ])
    if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
    if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')
    const storedProfile = businessProfileResponse(configSnapshot.data().businessProfile)
    const compatibleProfile = {
      ...businessProfile,
      ...(storedProfile?.businessHours ? { businessHours: storedProfile.businessHours } : {}),
      ...(storedProfile?.socialLinks ? { socialLinks: storedProfile.socialLinks } : {})
    }
    const nextConfig = { ...configSnapshot.data(), updatedAt: now }
    if (hasBusinessProfile(compatibleProfile)) nextConfig.businessProfile = compatibleProfile
    else delete nextConfig.businessProfile
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, homeSnapshot.data())
  })
  return finalizeSiteDefinitionRead(tenantId, definition)
}

export const updateBusinessHours = async (tenantId, input, sectionId) => {
  const update = validateBusinessHoursUpdate(input)
  return mutateWorkingHome(tenantId, (sections) => {
    const nextSections = [...sections]
    const existing = sectionId ? requireSection(sections, sectionId) : null
    if (existing && existing.section.type !== 'businessHours') throw httpError(400, 'Section is not Business Hours')
    if (!existing && sections.some((section) => section.type === 'businessHours')) {
      throw httpError(400, 'Business Hours section id is required')
    }
    if (!update.businessHours || !update.homepage.enabled) {
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
    const [configSnapshot, homeSnapshot] = await Promise.all([
      transaction.get(refs.config),
      transaction.get(refs.home)
    ])
    if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
    if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')

    const config = configSnapshot.data()
    const nextProfile = { ...(config.businessProfile || {}) }
    if (socialLinks) nextProfile.socialLinks = socialLinks
    else delete nextProfile.socialLinks
    const nextConfig = { ...config, updatedAt: now }
    if (hasBusinessProfile(nextProfile)) nextConfig.businessProfile = nextProfile
    else delete nextConfig.businessProfile
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, homeSnapshot.data())
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
    const [configSnapshot, homeSnapshot] = await Promise.all([
      transaction.get(refs.config),
      transaction.get(refs.home)
    ])
    if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
    if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')

    const nextConfig = { ...configSnapshot.data(), updatedAt: now }
    if (customCss) nextConfig.customCss = customCss
    else delete nextConfig.customCss
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, homeSnapshot.data())
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
    const [configSnapshot, homeSnapshot] = await Promise.all([
      transaction.get(refs.config),
      transaction.get(refs.home)
    ])

    if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
    if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')

    const config = configSnapshot.data()
    const home = homeSnapshot.data()
    const workingDefinition = toSiteDefinition(config, home)
    const canonicalWorkingDefinition = { ...workingDefinition }
    delete canonicalWorkingDefinition.hasUnpublishedChanges
    delete canonicalWorkingDefinition.lastPublishedAt
    const storedPublishedDefinition = { ...canonicalWorkingDefinition, status: 'PUBLISHED' }
    const nextConfig = {
      ...config,
      status: 'PUBLISHED',
      updatedAt: now,
      lastPublishedAt: now,
      lastPublishedByUserId: actorUserId
    }
    publishedDefinition = toSiteDefinition(nextConfig, home)

    transaction.set(refs.published, {
      siteDefinition: storedPublishedDefinition,
      publishedAt: now,
      publishedByUserId: actorUserId
    })
    transaction.set(refs.config, nextConfig)
  })

  return finalizeSiteDefinitionRead(tenantId, publishedDefinition)
}

export const unpublishSite = async (tenantId, actorUserId) => {
  const refs = refsFor(tenantId)
  const now = Date.now()
  let draftDefinition

  await firestore.runTransaction(async (transaction) => {
    const [configSnapshot, homeSnapshot] = await Promise.all([
      transaction.get(refs.config),
      transaction.get(refs.home)
    ])

    if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
    if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')

    const nextConfig = {
      ...configSnapshot.data(),
      status: 'DRAFT',
      updatedAt: now,
      lastUnpublishedAt: now,
      lastUnpublishedByUserId: actorUserId
    }
    draftDefinition = toSiteDefinition(nextConfig, homeSnapshot.data())

    transaction.set(refs.config, nextConfig)
  })

  return finalizeSiteDefinitionRead(tenantId, draftDefinition)
}

const sectionMediaIds = (section) => {
  if (section.type === 'about') return section.content.imageMediaId ? [section.content.imageMediaId] : []
  if (section.type === 'gallery') return section.content.items.map((item) => item.mediaId)
  return []
}

const resolveItemIds = (type, content, storedContent) => {
  if (!['services', 'gallery', 'testimonials', 'faq'].includes(type)) return content
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
  requirePageId(pageId)
  if (!SECTION_TYPE_SET.has(type)) throw httpError(400, 'Unknown section type')
  let sectionId
  const site = await mutateWorkingHome(tenantId, (sections, config) => {
    if (SINGLETON_SECTION_TYPES.has(type) && sections.some((section) => section.type === type)) {
      throw httpError(409, `${type} section already exists`)
    }
    if (type === 'businessHours' && !config.businessProfile?.businessHours) {
      throw httpError(400, 'Configure business hours before adding them to the homepage')
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
  requirePageId(pageId)
  return mutateWorkingHome(tenantId, (sections) => {
    const { section, index } = requireSection(sections, sectionId)
    if (section.type === 'hero') throw httpError(400, 'Hero section cannot be removed')
    const next = [...sections]
    next.splice(index, 1)
    return next
  })
}

export const moveSection = async (tenantId, pageId, sectionId, direction) => {
  requirePageId(pageId)
  if (!['up', 'down'].includes(direction)) throw httpError(400, 'Move direction must be up or down')
  return mutateWorkingHome(tenantId, (sections) => {
    const { section, index } = requireSection(sections, sectionId)
    if (section.type === 'hero') throw httpError(400, 'Hero section cannot move')
    const target = direction === 'up' ? index - 1 : index + 1
    if (target <= 0 || target >= sections.length) throw httpError(400, 'Section cannot move in that direction')
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
}

export const duplicateSection = async (tenantId, pageId, sectionId) => {
  requirePageId(pageId)
  let duplicateId
  const site = await mutateWorkingHome(tenantId, (sections) => {
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
  requirePageId(pageId)
  if (typeof hidden !== 'boolean') throw httpError(400, 'hidden must be a boolean')
  return mutateWorkingHome(tenantId, (sections) => {
    const { section, index } = requireSection(sections, sectionId)
    if (section.type === 'hero' && hidden) throw httpError(400, 'Hero section cannot be hidden')
    const next = [...sections]
    next[index] = { ...section, hidden }
    return next
  })
}

export const updateSectionContent = async (tenantId, pageId, sectionId, input) => {
  requirePageId(pageId)
  let mediaIds = []
  let mediaMessage = 'Section media not found'
  return mutateWorkingHome(tenantId, (sections) => {
    const { section, index } = requireSection(sections, sectionId)
    const validated = validateSectionContent(section.type, input)
    const content = resolveItemIds(section.type, validated, section.content)
    const nextSection = { ...section, content }
    mediaIds = sectionMediaIds(nextSection)
    if (section.type === 'about') mediaMessage = 'About image not found'
    if (section.type === 'gallery') mediaMessage = 'Gallery image not found'
    const next = [...sections]
    next[index] = nextSection
    return next
  }, { mediaIds: () => mediaIds, message: () => mediaMessage })
}
