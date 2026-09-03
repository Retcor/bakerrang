import { randomUUID } from 'node:crypto'
import { db } from '../client/firestoreClient.js'
import { draftPreviewEnabled } from '../config/publicSite.js'
import {
  EMAIL_MAX,
  PHONE_MAX,
  isValidEmail,
  isValidPhone
} from '../validation/contactMethods.js'
import { hydrateSiteMedia, requireGalleryMedia, requireTenantMedia } from './mediaService.js'
import {
  DEFAULT_SITE_ACCENT_COLOR,
  DEFAULT_SITE_PRIMARY_COLOR,
  siteBrandingResponse,
  validateSiteBranding
} from '../domain/siteBranding.js'
import { DEFAULT_SITE_THEME, normalizeSiteTheme, validateSiteTheme } from '../domain/siteTheme.js'
import {
  businessProfileResponse,
  hasBusinessProfile,
  validateBusinessProfile
} from '../domain/businessProfile.js'
import { validateBusinessHoursUpdate } from '../domain/businessHours.js'
import { validateSocialLinksUpdate } from '../domain/socialLinks.js'
import { normalizeStoredCustomCss, validateCustomCss } from '../domain/customCss.js'

const TENANTS = 'tenants'
const CANONICAL_SECTION_IDS = new Set([
  'hero',
  'about',
  'services',
  'gallery',
  'testimonials',
  'faq',
  'businessHours',
  'contact'
])

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
  if (section?.id === 'businessHours' && section?.type === 'businessHours') {
    const content = section.content && typeof section.content === 'object' && !Array.isArray(section.content)
      ? section.content
      : {}
    const heading = typeof content.heading === 'string' ? content.heading.trim().slice(0, 120) : ''
    const intro = typeof content.intro === 'string' ? content.intro.trim().slice(0, 300) : ''
    return {
      id: 'businessHours',
      type: 'businessHours',
      content: {
        ...(heading ? { heading } : {}),
        ...(intro ? { intro } : {})
      }
    }
  }
  if (section?.id === 'faq' && section?.type === 'faq') {
    const content = section.content && typeof section.content === 'object' ? section.content : {}
    return {
      id: 'faq',
      type: 'faq',
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
  if (section?.id !== 'testimonials' || section?.type !== 'testimonials') return section
  const content = section.content && typeof section.content === 'object' ? section.content : {}
  return {
    id: 'testimonials',
    type: 'testimonials',
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
    theme: normalizeSiteTheme(config.theme, config.branding),
    ...(typeof config.customCss === 'string' ? { customCss: config.customCss } : {}),
    ...(businessProfile ? { businessProfile } : {})
  }
}

const normalizePublishedSiteDefinition = (definition) => {
  const businessProfile = businessProfileResponse(definition?.businessProfile)
  const canonical = definition && typeof definition === 'object' ? { ...definition } : {}
  delete canonical.customCss
  delete canonical.scopedCustomCss
  const normalized = {
    ...canonical,
    branding: siteBrandingResponse(definition?.branding, definition),
    theme: normalizeSiteTheme(definition?.theme, definition?.branding),
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

const validateCompositionInput = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (!Array.isArray(body.sectionIds)) {
    throw httpError(400, 'Composition sectionIds must be an array')
  }
  if (body.sectionIds.length > CANONICAL_SECTION_IDS.size) {
    throw httpError(400, `Composition cannot exceed ${CANONICAL_SECTION_IDS.size} sections`)
  }

  const seen = new Set()
  for (const id of body.sectionIds) {
    if (typeof id !== 'string' || !id.trim()) {
      throw httpError(400, 'Section id must be a non-empty string')
    }
    if (!CANONICAL_SECTION_IDS.has(id)) throw httpError(400, 'Unknown section id')
    if (seen.has(id)) throw httpError(400, 'Duplicate section id')
    seen.add(id)
  }
  if (!seen.has('hero')) throw httpError(400, 'Hero section is required')
  if (body.sectionIds[0] !== 'hero') throw httpError(400, 'Hero section must be first')
  return body.sectionIds
}

const mapCanonicalSections = (sections) => {
  if (!Array.isArray(sections)) throw httpError(500, 'Home sections invalid')
  const byId = new Map()
  for (const section of sections) {
    if (
      !section ||
      typeof section !== 'object' ||
      typeof section.id !== 'string' ||
      typeof section.type !== 'string' ||
      !CANONICAL_SECTION_IDS.has(section.id) ||
      !CANONICAL_SECTION_IDS.has(section.type) ||
      section.id !== section.type ||
      byId.has(section.id)
    ) {
      throw httpError(500, 'Home sections invalid')
    }
    byId.set(section.id, section)
  }
  if (
    !byId.has('hero') ||
    sections[0]?.id !== 'hero' ||
    sections[0]?.type !== 'hero'
  ) {
    throw httpError(500, 'Home sections invalid')
  }
  return byId
}

const requireHeroIndex = (sections) => {
  const heroIndex = sections.findIndex((section) =>
    section.id === 'hero' && section.type === 'hero'
  )
  if (heroIndex === -1) throw httpError(500, 'Home hero section missing')
  return heroIndex
}

const mutateWorkingHome = async (tenantId, transformSections) => {
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
    const sections = Array.isArray(home.sections) ? home.sections : []
    const nextSections = transformSections(sections)
    const nextHome = {
      ...home,
      sections: nextSections,
      updatedAt: now
    }
    const nextConfig = { ...config, updatedAt: now }

    transaction.set(homeRef, nextHome)
    transaction.set(configRef, { updatedAt: now }, { merge: true })
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
        siteName: String(tenantSnapshot.data().name || '').trim().slice(0, 80) || 'Website',
        primaryColor: DEFAULT_SITE_PRIMARY_COLOR,
        accentColor: DEFAULT_SITE_ACCENT_COLOR
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
      sections: [{
        id: 'hero',
        type: 'hero',
        content: {
          title: tenantSnapshot.data().name
        }
      }],
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
  if (identity.logoMediaId) {
    await requireTenantMedia(tenantId, [identity.logoMediaId], 'Logo image not found')
  }
  if (identity.faviconMediaId) {
    await requireTenantMedia(tenantId, [identity.faviconMediaId], 'Favicon image not found')
  }
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
    const storedBranding = configSnapshot.data().branding || {}
    const branding = {
      siteName: identity.siteName,
      ...(typeof storedBranding.primaryColor === 'string' ? { primaryColor: storedBranding.primaryColor } : {}),
      ...(typeof storedBranding.accentColor === 'string' ? { accentColor: storedBranding.accentColor } : {}),
      ...(identity.primaryColor ? { primaryColor: identity.primaryColor } : {}),
      ...(identity.accentColor ? { accentColor: identity.accentColor } : {}),
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
  if (businessProfile.socialImageMediaId) {
    await requireTenantMedia(tenantId, [businessProfile.socialImageMediaId], 'Social image not found')
  }
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

export const updateBusinessHours = async (tenantId, input) => {
  const update = validateBusinessHoursUpdate(input)
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
    const home = homeSnapshot.data()
    const sections = Array.isArray(home.sections) ? home.sections : []
    mapCanonicalSections(sections)
    const hoursIndexes = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.id === 'businessHours' || section.type === 'businessHours')
    if (hoursIndexes.length > 1 || (hoursIndexes.length === 1 && (
      hoursIndexes[0].section.id !== 'businessHours' || hoursIndexes[0].section.type !== 'businessHours'
    ))) throw httpError(500, 'Home Business Hours section invalid')

    const nextProfile = { ...(config.businessProfile || {}) }
    if (update.businessHours) nextProfile.businessHours = update.businessHours
    else delete nextProfile.businessHours

    const nextSections = [...sections]
    const existing = hoursIndexes[0]
    if (!update.businessHours || !update.homepage.enabled) {
      if (existing) nextSections.splice(existing.index, 1)
    } else {
      const section = {
        id: 'businessHours',
        type: 'businessHours',
        content: {
          ...(update.homepage.heading ? { heading: update.homepage.heading } : {}),
          ...(update.homepage.intro ? { intro: update.homepage.intro } : {})
        }
      }
      if (existing) nextSections[existing.index] = section
      else {
        const contactIndex = nextSections.findIndex((item) => item.id === 'contact' && item.type === 'contact')
        if (contactIndex === -1) nextSections.push(section)
        else nextSections.splice(contactIndex, 0, section)
      }
    }

    const nextConfig = { ...config, updatedAt: now }
    if (hasBusinessProfile(nextProfile)) nextConfig.businessProfile = nextProfile
    else delete nextConfig.businessProfile
    const nextHome = { ...home, sections: nextSections, updatedAt: now }
    transaction.set(refs.config, nextConfig)
    transaction.set(refs.home, nextHome)
    definition = toSiteDefinition(nextConfig, nextHome)
  })

  return finalizeSiteDefinitionRead(tenantId, definition)
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

export const updateHomeHero = async (tenantId, input) => {
  const { title, subtitle, subtitleSupplied } = validateHeroInput(input)
  return mutateWorkingHome(tenantId, (sections) => {
    const heroIndex = requireHeroIndex(sections)

    const hero = sections[heroIndex]
    const nextContent = { ...hero.content, title }
    if (subtitleSupplied) {
      if (subtitle) nextContent.subtitle = subtitle
      else delete nextContent.subtitle
    }

    const nextSections = [...sections]
    nextSections[heroIndex] = {
      ...hero,
      content: nextContent
    }
    return nextSections
  })
}

export const upsertHomeServices = async (tenantId, input) => {
  const { title, items } = validateServicesInput(input)
  return mutateWorkingHome(tenantId, (sections) => {
    const servicesIndexes = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.id === 'services' || section.type === 'services')

    if (servicesIndexes.length > 1 || (servicesIndexes.length === 1 && (
      servicesIndexes[0].section.id !== 'services' ||
      servicesIndexes[0].section.type !== 'services'
    ))) {
      throw httpError(500, 'Home services section invalid')
    }

    const existingServices = servicesIndexes[0]
    const storedItems = existingServices && Array.isArray(existingServices.section.content?.items)
      ? existingServices.section.content.items
      : []
    const storedById = new Map(storedItems.map((item) => [item.id, item]))
    const resolvedItems = items.map((item) => {
      if (!Object.prototype.hasOwnProperty.call(item, 'id')) {
        return {
          id: randomUUID(),
          name: item.name,
          ...(item.description ? { description: item.description } : {})
        }
      }

      const stored = storedById.get(item.id)
      if (!stored) throw httpError(400, 'Unknown service item id')
      const next = { ...stored, name: item.name }
      if (item.description) next.description = item.description
      else delete next.description
      return next
    })

    const nextSections = [...sections]
    if (existingServices) {
      nextSections[existingServices.index] = {
        ...existingServices.section,
        content: {
          ...existingServices.section.content,
          title,
          items: resolvedItems
        }
      }
    } else {
      const heroIndex = requireHeroIndex(sections)
      const aboutIndex = sections.findIndex((section) => section.id === 'about' && section.type === 'about')
      nextSections.splice(aboutIndex === -1 ? heroIndex + 1 : aboutIndex + 1, 0, {
        id: 'services',
        type: 'services',
        content: { title, items: resolvedItems }
      })
    }
    return nextSections
  })
}

export const upsertHomeAbout = async (tenantId, input) => {
  const content = validateAboutInput(input)
  if (content.imageMediaId) {
    await requireTenantMedia(tenantId, [content.imageMediaId], 'About image not found')
  }
  return mutateWorkingHome(tenantId, (sections) => {
    const aboutIndexes = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.id === 'about' || section.type === 'about')
    if (aboutIndexes.length > 1 || (aboutIndexes.length === 1 && (
      aboutIndexes[0].section.id !== 'about' || aboutIndexes[0].section.type !== 'about'
    ))) {
      throw httpError(500, 'Home about section invalid')
    }

    const existingAbout = aboutIndexes[0]
    const nextSections = [...sections]
    if (existingAbout) {
      nextSections[existingAbout.index] = { id: 'about', type: 'about', content }
    } else {
      const heroIndex = requireHeroIndex(sections)
      nextSections.splice(heroIndex + 1, 0, { id: 'about', type: 'about', content })
    }
    return nextSections
  })
}

export const upsertHomeContact = async (tenantId, input) => {
  const content = validateContactInput(input)
  return mutateWorkingHome(tenantId, (sections) => {
    const contactIndexes = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.id === 'contact' || section.type === 'contact')

    if (contactIndexes.length > 1 || (contactIndexes.length === 1 && (
      contactIndexes[0].section.id !== 'contact' ||
      contactIndexes[0].section.type !== 'contact'
    ))) {
      throw httpError(500, 'Home contact section invalid')
    }

    const existingContact = contactIndexes[0]
    const nextSections = [...sections]
    if (existingContact) {
      const nextContent = {
        ...existingContact.section.content,
        title: content.title,
        buttonLabel: content.buttonLabel,
        action: content.action
      }
      if (content.text) nextContent.text = content.text
      else delete nextContent.text
      nextSections[existingContact.index] = {
        ...existingContact.section,
        content: nextContent
      }
    } else {
      nextSections.push({ id: 'contact', type: 'contact', content })
    }
    return nextSections
  })
}

export const upsertHomeGallery = async (tenantId, input) => {
  const { title, items } = validateGalleryInput(input)
  await requireGalleryMedia(tenantId, items.map((item) => item.mediaId))

  return mutateWorkingHome(tenantId, (sections) => {
    const galleryIndexes = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.id === 'gallery' || section.type === 'gallery')

    if (galleryIndexes.length > 1 || (galleryIndexes.length === 1 && (
      galleryIndexes[0].section.id !== 'gallery' ||
      galleryIndexes[0].section.type !== 'gallery'
    ))) {
      throw httpError(500, 'Home gallery section invalid')
    }

    const existingGallery = galleryIndexes[0]
    const storedItems = existingGallery && Array.isArray(existingGallery.section.content?.items)
      ? existingGallery.section.content.items
      : []
    const storedIds = new Set()
    for (const item of storedItems) {
      if (!item || typeof item.id !== 'string' || !item.id || storedIds.has(item.id)) {
        throw httpError(500, 'Home gallery section invalid')
      }
      storedIds.add(item.id)
    }
    const storedById = new Map(storedItems.map((item) => [item.id, item]))
    const resolvedItems = items.map((item) => {
      if (!Object.prototype.hasOwnProperty.call(item, 'id')) {
        return { id: randomUUID(), mediaId: item.mediaId, altText: item.altText }
      }
      const stored = storedById.get(item.id)
      if (!stored) throw httpError(400, 'Unknown gallery item id')
      const next = { ...stored, mediaId: item.mediaId, altText: item.altText }
      delete next.src
      delete next.width
      delete next.height
      delete next.objectName
      delete next.bucket
      return next
    })

    const nextSections = [...sections]
    if (existingGallery) {
      nextSections[existingGallery.index] = {
        ...existingGallery.section,
        content: {
          ...existingGallery.section.content,
          title,
          items: resolvedItems
        }
      }
    } else {
      const contactIndex = sections.findIndex((section) =>
        section.id === 'contact' || section.type === 'contact'
      )
      const gallery = {
        id: 'gallery',
        type: 'gallery',
        content: { title, items: resolvedItems }
      }
      if (contactIndex === -1) nextSections.push(gallery)
      else nextSections.splice(contactIndex, 0, gallery)
    }
    return nextSections
  })
}

export const upsertHomeTestimonials = async (tenantId, input) => {
  const { title, items } = validateTestimonialsInput(input)
  return mutateWorkingHome(tenantId, (sections) => {
    const testimonialsIndexes = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.id === 'testimonials' || section.type === 'testimonials')

    if (testimonialsIndexes.length > 1 || (testimonialsIndexes.length === 1 && (
      testimonialsIndexes[0].section.id !== 'testimonials' ||
      testimonialsIndexes[0].section.type !== 'testimonials'
    ))) {
      throw httpError(500, 'Home testimonials section invalid')
    }

    const existingTestimonials = testimonialsIndexes[0]
    const storedItems = existingTestimonials?.section.content?.items
    if (existingTestimonials && !Array.isArray(storedItems)) {
      throw httpError(500, 'Home testimonials section invalid')
    }
    const storedIds = new Set()
    for (const item of storedItems || []) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        !item.id.trim() ||
        storedIds.has(item.id)
      ) {
        throw httpError(500, 'Home testimonials section invalid')
      }
      storedIds.add(item.id)
    }
    const storedById = new Map((storedItems || []).map((item) => [item.id, item]))
    const resolvedItems = items.map((item) => {
      if (!Object.prototype.hasOwnProperty.call(item, 'id')) {
        return { id: randomUUID(), customerName: item.customerName, quote: item.quote }
      }
      const stored = storedById.get(item.id)
      if (!stored) throw httpError(400, 'Unknown testimonial item id')
      return { ...stored, customerName: item.customerName, quote: item.quote }
    })

    const nextSections = [...sections]
    if (existingTestimonials) {
      nextSections[existingTestimonials.index] = {
        ...existingTestimonials.section,
        content: {
          ...existingTestimonials.section.content,
          title,
          items: resolvedItems
        }
      }
    } else {
      const contactIndex = sections.findIndex((section) =>
        section.id === 'contact' || section.type === 'contact'
      )
      const testimonials = {
        id: 'testimonials',
        type: 'testimonials',
        content: { title, items: resolvedItems }
      }
      if (contactIndex === -1) nextSections.push(testimonials)
      else nextSections.splice(contactIndex, 0, testimonials)
    }
    return nextSections
  })
}

export const upsertHomeFaq = async (tenantId, input) => {
  const { heading, intro, items } = validateFaqInput(input)
  return mutateWorkingHome(tenantId, (sections) => {
    const faqIndexes = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.id === 'faq' || section.type === 'faq')
    if (faqIndexes.length > 1 || (faqIndexes.length === 1 && (
      faqIndexes[0].section.id !== 'faq' || faqIndexes[0].section.type !== 'faq'
    ))) {
      throw httpError(500, 'Home FAQ section invalid')
    }

    const existingFaq = faqIndexes[0]
    const storedItems = existingFaq?.section.content?.items
    if (existingFaq && !Array.isArray(storedItems)) throw httpError(500, 'Home FAQ section invalid')
    const storedIds = new Set()
    for (const item of storedItems || []) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id.trim() || storedIds.has(item.id)) {
        throw httpError(500, 'Home FAQ section invalid')
      }
      storedIds.add(item.id)
    }
    const storedById = new Map((storedItems || []).map((item) => [item.id, item]))
    const resolvedItems = items.map((item) => {
      if (!Object.prototype.hasOwnProperty.call(item, 'id')) {
        return { id: randomUUID(), question: item.question, answer: item.answer }
      }
      const stored = storedById.get(item.id)
      if (!stored) throw httpError(400, 'Unknown FAQ item id')
      return { ...stored, question: item.question, answer: item.answer }
    })

    const content = { heading, ...(intro ? { intro } : {}), items: resolvedItems }
    const nextSections = [...sections]
    if (existingFaq) {
      nextSections[existingFaq.index] = { ...existingFaq.section, content }
    } else {
      const contactIndex = sections.findIndex((section) => section.id === 'contact' || section.type === 'contact')
      const faq = { id: 'faq', type: 'faq', content }
      if (contactIndex === -1) nextSections.push(faq)
      else nextSections.splice(contactIndex, 0, faq)
    }
    return nextSections
  })
}

export const composeHomeSections = async (tenantId, input) => {
  const sectionIds = validateCompositionInput(input)
  return mutateWorkingHome(tenantId, (sections) => {
    const storedById = mapCanonicalSections(sections)
    return sectionIds.map((id) => {
      const section = storedById.get(id)
      if (!section) throw httpError(400, 'Unknown section id')
      return section
    })
  })
}
