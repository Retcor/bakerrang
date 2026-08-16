import { randomUUID } from 'node:crypto'
import { imageSize } from 'image-size'
import { db } from '../client/firestoreClient.js'
import { gcsStorage } from '../client/gcsClient.js'

const TENANTS = 'tenants'
const CACHE_CONTROL = 'public, max-age=31536000, immutable'
const DECLARED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const CANONICAL_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

let firestore = db
let objectStorage = gcsStorage

export const _setDb = (nextDb) => {
  firestore = nextDb || db
}

export const _setStorage = (nextStorage) => {
  objectStorage = nextStorage || gcsStorage
}

const httpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0
const positiveSafeInteger = (value) => Number.isSafeInteger(value) && value > 0
const timestamp = (value) => Number.isSafeInteger(value) && value >= 0

const normalizeFilename = (value) => {
  if (typeof value !== 'string') return 'image'
  const filename = value.split(/[\\/]/).at(-1).replaceAll('\0', '').trim().slice(0, 255)
  return filename || 'image'
}

const inspectImage = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw httpError(400, 'Image file is required')
  }
  if (!DECLARED_TYPES.has(file.mimetype)) {
    throw httpError(400, 'Image must be JPEG, PNG, or WebP')
  }

  let detected
  try {
    detected = imageSize(file.buffer)
  } catch {
    throw httpError(400, 'Image file is invalid')
  }
  const contentType = CANONICAL_TYPES[detected.type]
  if (!contentType || contentType !== file.mimetype) {
    throw httpError(400, 'Image content does not match its declared type')
  }
  if (!positiveSafeInteger(detected.width) || !positiveSafeInteger(detected.height)) {
    throw httpError(400, 'Image dimensions are invalid')
  }
  return { contentType, width: detected.width, height: detected.height }
}

const mediaData = (snapshot) => {
  const value = snapshot.data()
  if (
    !nonEmptyString(value.originalFilename) ||
    !nonEmptyString(value.objectName) ||
    !Object.values(CANONICAL_TYPES).includes(value.contentType) ||
    !positiveSafeInteger(value.sizeBytes) ||
    !positiveSafeInteger(value.width) ||
    !positiveSafeInteger(value.height) ||
    !timestamp(value.createdAt) ||
    !nonEmptyString(value.createdByUserId)
  ) return null
  return value
}

const mediaResponse = (snapshot) => {
  const value = mediaData(snapshot)
  if (!value) return null
  return {
    id: snapshot.id,
    originalFilename: value.originalFilename,
    contentType: value.contentType,
    sizeBytes: value.sizeBytes,
    width: value.width,
    height: value.height,
    createdAt: value.createdAt,
    src: objectStorage.publicUrl(value.objectName)
  }
}

const tenantRef = (tenantId) => firestore.collection(TENANTS).doc(tenantId)
const mediaRef = (tenantId, mediaId) => tenantRef(tenantId).collection('media').doc(mediaId)

const requireTenant = async (tenantId) => {
  const snapshot = await tenantRef(tenantId).get()
  if (!snapshot.exists) throw httpError(404, 'Tenant not found')
}

export const createMedia = async (tenantId, file, actorUserId) => {
  const image = inspectImage(file)
  await requireTenant(tenantId)

  const mediaId = randomUUID()
  const objectName = `tenants/${tenantId}/media/${mediaId}`
  const metadata = {
    originalFilename: normalizeFilename(file.originalname),
    objectName,
    contentType: image.contentType,
    sizeBytes: file.buffer.length,
    width: image.width,
    height: image.height,
    createdAt: Date.now(),
    createdByUserId: actorUserId
  }

  try {
    await objectStorage.putObject({
      objectName,
      bytes: file.buffer,
      contentType: image.contentType,
      cacheControl: CACHE_CONTROL,
      preconditionOpts: { ifGenerationMatch: 0 }
    })
  } catch (error) {
    if (error && (error.code === 412 || error.status === 412)) {
      throw httpError(409, 'Media upload conflict')
    }
    throw error
  }

  const ref = mediaRef(tenantId, mediaId)
  try {
    await ref.set(metadata)
  } catch (error) {
    try {
      const confirmation = await ref.get()
      if (confirmation.exists) {
        const confirmed = mediaResponse(confirmation)
        if (confirmed && confirmation.data().objectName === objectName) return confirmed
        throw error
      }
      await objectStorage.deleteObject(objectName).catch(() => {})
    } catch {
      // Ambiguous metadata outcome: preserve the object rather than risk
      // deleting bytes that committed metadata may reference.
    }
    throw error
  }

  return {
    id: mediaId,
    originalFilename: metadata.originalFilename,
    contentType: metadata.contentType,
    sizeBytes: metadata.sizeBytes,
    width: metadata.width,
    height: metadata.height,
    createdAt: metadata.createdAt,
    src: objectStorage.publicUrl(objectName)
  }
}

export const listMedia = async (tenantId) => {
  await requireTenant(tenantId)
  const snapshot = await tenantRef(tenantId).collection('media')
    .orderBy('createdAt', 'desc')
    .limit(51)
    .get()
  return {
    media: snapshot.docs.slice(0, 50).map(mediaResponse).filter(Boolean),
    hasMore: snapshot.docs.length > 50
  }
}

export const requireTenantMedia = async (tenantId, mediaIds, message = 'Media not found') => {
  const snapshots = await firestore.getAll(...mediaIds.map((id) => mediaRef(tenantId, id)))
  if (snapshots.some((snapshot) => !snapshot.exists || !mediaData(snapshot))) {
    throw httpError(400, message)
  }
}

export const requireGalleryMedia = (tenantId, mediaIds) =>
  requireTenantMedia(tenantId, mediaIds, 'Gallery image not found')

export const hydrateSiteMedia = async (tenantId, definition) => {
  const galleryItems = []
  for (const page of Array.isArray(definition?.pages) ? definition.pages : []) {
    for (const section of Array.isArray(page?.sections) ? page.sections : []) {
      if (section?.id === 'gallery' && section?.type === 'gallery' && Array.isArray(section.content?.items)) {
        galleryItems.push(...section.content.items)
      }
    }
  }
  const logoMediaId = nonEmptyString(definition?.branding?.logoMediaId)
    ? definition.branding.logoMediaId
    : null
  const socialImageMediaId = nonEmptyString(definition?.businessProfile?.socialImageMediaId)
    ? definition.businessProfile.socialImageMediaId
    : null
  const mediaIds = [...new Set([
    ...(logoMediaId ? [logoMediaId] : []),
    ...(socialImageMediaId ? [socialImageMediaId] : []),
    ...galleryItems.map((item) => item?.mediaId).filter(nonEmptyString)
  ])]
  const snapshots = mediaIds.length > 0
    ? await firestore.getAll(...mediaIds.map((id) => mediaRef(tenantId, id)))
    : []
  const resolved = new Map()
  snapshots.forEach((snapshot) => {
    const value = snapshot.exists && mediaData(snapshot)
    if (value) resolved.set(snapshot.id, value)
  })

  return {
    ...definition,
    branding: {
      ...definition.branding,
      ...(logoMediaId && resolved.has(logoMediaId)
        ? {
            logoSrc: objectStorage.publicUrl(resolved.get(logoMediaId).objectName),
            logoWidth: resolved.get(logoMediaId).width,
            logoHeight: resolved.get(logoMediaId).height
          }
        : {})
    },
    ...(definition.businessProfile
      ? {
          businessProfile: {
            ...definition.businessProfile,
            ...(socialImageMediaId && resolved.has(socialImageMediaId)
              ? {
                  socialImageSrc: objectStorage.publicUrl(resolved.get(socialImageMediaId).objectName),
                  socialImageWidth: resolved.get(socialImageMediaId).width,
                  socialImageHeight: resolved.get(socialImageMediaId).height
                }
              : {})
          }
        }
      : {}),
    pages: (Array.isArray(definition?.pages) ? definition.pages : []).map((page) => ({
      ...page,
      sections: (Array.isArray(page?.sections) ? page.sections : []).map((section) => {
        if (section?.id !== 'gallery' || section?.type !== 'gallery') return section
        const items = (Array.isArray(section.content?.items) ? section.content.items : [])
          .map((item) => {
            const media = item && resolved.get(item.mediaId)
            if (!media || !nonEmptyString(item.id) || !nonEmptyString(item.altText)) return null
            return {
              id: item.id,
              mediaId: item.mediaId,
              altText: item.altText,
              src: objectStorage.publicUrl(media.objectName),
              width: media.width,
              height: media.height
            }
          })
          .filter(Boolean)
        return {
          ...section,
          content: { ...section.content, items }
        }
      })
    }))
  }
}
