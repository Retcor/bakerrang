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
import {
  businessProfileResponse,
  hasBusinessProfile,
  validateBusinessProfile
} from '../domain/businessProfile.js'

const TENANTS = 'tenants'
const CANONICAL_SECTION_IDS = new Set([
  'hero',
  'services',
  'gallery',
  'testimonials',
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

const toSiteDefinition = (config, home) => {
  const definition = {
    status: config.status,
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
    ...(businessProfile ? { businessProfile } : {})
  }
}

const normalizePublishedSiteDefinition = (definition) => {
  const businessProfile = businessProfileResponse(definition?.businessProfile)
  const normalized = {
    ...definition,
    branding: siteBrandingResponse(definition?.branding, definition)
  }
  if (businessProfile) normalized.businessProfile = businessProfile
  else delete normalized.businessProfile
  return normalized
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

const validateCompositionInput = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (!Array.isArray(body.sectionIds)) {
    throw httpError(400, 'Composition sectionIds must be an array')
  }
  if (body.sectionIds.length > CANONICAL_SECTION_IDS.size) {
    throw httpError(400, 'Composition cannot exceed 5 sections')
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

  return hydrateSiteMedia(tenantId, definition)
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

  return hydrateSiteMedia(tenantId, definition)
}

export const getSite = async (tenantId) => {
  const refs = refsFor(tenantId)
  const [configSnapshot, homeSnapshot] = await Promise.all([
    refs.config.get(),
    refs.home.get()
  ])

  if (!configSnapshot.exists) throw httpError(404, 'Site not initialized')
  if (!homeSnapshot.exists) throw httpError(500, 'Site home page missing')

  return hydrateSiteMedia(tenantId, toSiteDefinition(configSnapshot.data(), homeSnapshot.data()))
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

  return hydrateSiteMedia(tenantId, normalizePublishedSiteDefinition(snapshot.siteDefinition))
}

export const updateSiteBranding = async (tenantId, input) => {
  const branding = validateSiteBranding(input)
  if (branding.logoMediaId) {
    await requireTenantMedia(tenantId, [branding.logoMediaId], 'Logo image not found')
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
    const nextConfig = { ...configSnapshot.data(), branding, updatedAt: now }
    transaction.set(refs.config, { branding, updatedAt: now }, { merge: true })
    definition = toSiteDefinition(nextConfig, homeSnapshot.data())
  })
  return hydrateSiteMedia(tenantId, definition)
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
    const nextConfig = { ...configSnapshot.data(), updatedAt: now }
    if (hasBusinessProfile(businessProfile)) nextConfig.businessProfile = businessProfile
    else delete nextConfig.businessProfile
    transaction.set(refs.config, nextConfig)
    definition = toSiteDefinition(nextConfig, homeSnapshot.data())
  })
  return hydrateSiteMedia(tenantId, definition)
}

export const getPublicSite = async (tenantId, env = process.env) => {
  if (draftPreviewEnabled(env)) {
    try {
      const working = await getSite(tenantId)
      return { ...working, status: 'DRAFT' }
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

    const workingDefinition = toSiteDefinition(configSnapshot.data(), homeSnapshot.data())
    publishedDefinition = { ...workingDefinition, status: 'PUBLISHED' }

    transaction.set(refs.published, {
      siteDefinition: publishedDefinition,
      publishedAt: now,
      publishedByUserId: actorUserId
    })
    transaction.set(refs.config, {
      status: 'PUBLISHED',
      updatedAt: now,
      lastPublishedAt: now,
      lastPublishedByUserId: actorUserId
    }, { merge: true })
  })

  return hydrateSiteMedia(tenantId, publishedDefinition)
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

    draftDefinition = {
      ...toSiteDefinition(configSnapshot.data(), homeSnapshot.data()),
      status: 'DRAFT'
    }

    transaction.set(refs.config, {
      status: 'DRAFT',
      updatedAt: now,
      lastUnpublishedAt: now,
      lastUnpublishedByUserId: actorUserId
    }, { merge: true })
  })

  return hydrateSiteMedia(tenantId, draftDefinition)
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
      nextSections.splice(heroIndex + 1, 0, {
        id: 'services',
        type: 'services',
        content: { title, items: resolvedItems }
      })
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
