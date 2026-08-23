export const SOCIAL_PLATFORMS = Object.freeze([
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'x'
])

const URL_MAX = 300
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

const httpError = (message) => {
  const error = new Error(message)
  error.status = 400
  return error
}

const validHttpsUrl = (value) => {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > URL_MAX || !/^https:\/\//i.test(trimmed)) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

const normalizeItem = (input, strict, index) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    if (strict) throw httpError(`Social link ${index + 1} is invalid`)
    return undefined
  }
  if (!SOCIAL_PLATFORMS.includes(input.platform)) {
    if (strict) throw httpError(`Social link ${index + 1} platform is not supported`)
    return undefined
  }
  if (!own(input, 'url') || typeof input.url !== 'string' || !input.url.trim()) {
    if (strict) throw httpError(`${input.platform} URL is required`)
    return undefined
  }
  const url = input.url.trim()
  if (url.length > URL_MAX) {
    if (strict) throw httpError(`${input.platform} URL must be ${URL_MAX} characters or fewer`)
    return undefined
  }
  if (!validHttpsUrl(url)) {
    if (strict) throw httpError(`${input.platform} URL must use HTTPS`)
    return undefined
  }
  return { platform: input.platform, url }
}

export const validateSocialLinks = (input) => {
  if (!Array.isArray(input)) throw httpError('Social links must be an array')
  if (input.length > SOCIAL_PLATFORMS.length) {
    throw httpError(`Social links cannot exceed ${SOCIAL_PLATFORMS.length} items`)
  }
  const seen = new Set()
  return input.map((item, index) => {
    const normalized = normalizeItem(item, true, index)
    if (seen.has(normalized.platform)) throw httpError(`Duplicate ${normalized.platform} social link`)
    seen.add(normalized.platform)
    return normalized
  })
}

export const normalizeSocialLinks = (input) => {
  if (!Array.isArray(input)) return undefined
  const seen = new Set()
  const links = []
  for (let index = 0; index < input.length; index += 1) {
    const normalized = normalizeItem(input[index], false, index)
    if (!normalized || seen.has(normalized.platform)) continue
    seen.add(normalized.platform)
    links.push(normalized)
  }
  return links.length ? links : undefined
}

export const validateSocialLinksUpdate = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !own(input, 'socialLinks')) {
    throw httpError('Social links are required')
  }
  if (input.socialLinks === null) return null
  const links = validateSocialLinks(input.socialLinks)
  return links.length ? links : null
}
