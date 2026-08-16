import {
  EMAIL_MAX,
  PHONE_MAX,
  isValidEmail,
  isValidPhone
} from '../validation/contactMethods.js'

const DESCRIPTION_MAX = 300
const ADDRESS_LIMITS = {
  line1: 160,
  line2: 160,
  city: 120,
  region: 120,
  postalCode: 32,
  country: 120
}
const SERVICE_AREA_MAX = 20
const SERVICE_AREA_LENGTH = 120

const httpError = (message) => {
  const error = new Error(message)
  error.status = 400
  return error
}

const optionalString = (body, key, label, max) => {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return undefined
  if (typeof body[key] !== 'string') throw httpError(`${label} must be a string`)
  const value = body[key].trim()
  if (value.length > max) throw httpError(`${label} must be ${max} characters or fewer`)
  return value || undefined
}

const sanitizeString = (value, max) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed && trimmed.length <= max ? trimmed : undefined
}

const validateAddress = (input) => {
  if (input === undefined || input === null) return undefined
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw httpError('Address must be an object')
  }
  const address = {}
  for (const [key, max] of Object.entries(ADDRESS_LIMITS)) {
    const value = optionalString(input, key, `Address ${key}`, max)
    if (value) address[key] = value
  }
  if (Object.keys(address).length === 0) return undefined
  if (!address.city) throw httpError('Address city is required when an address is provided')
  return address
}

const sanitizeAddress = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
  const city = sanitizeString(input.city, ADDRESS_LIMITS.city)
  if (!city) return undefined
  const address = { city }
  for (const [key, max] of Object.entries(ADDRESS_LIMITS)) {
    if (key === 'city') continue
    const value = sanitizeString(input[key], max)
    if (value) address[key] = value
  }
  return address
}

const cleanServiceAreas = (values, strict) => {
  if (!Array.isArray(values)) {
    if (strict) throw httpError('Service areas must be an array')
    return undefined
  }
  if (strict && values.length > SERVICE_AREA_MAX) {
    throw httpError(`Service areas cannot exceed ${SERVICE_AREA_MAX} items`)
  }
  const areas = []
  const seen = new Set()
  for (const value of values) {
    if (typeof value !== 'string') {
      if (strict) throw httpError('Each service area must be a string')
      continue
    }
    const area = value.trim()
    if (!area || area.length > SERVICE_AREA_LENGTH) {
      if (strict) throw httpError(`Each service area must be 1 to ${SERVICE_AREA_LENGTH} characters`)
      continue
    }
    const key = area.toLocaleLowerCase('en-US')
    if (seen.has(key)) continue
    seen.add(key)
    areas.push(area)
    if (!strict && areas.length === SERVICE_AREA_MAX) break
  }
  return areas.length > 0 ? areas : undefined
}

export const hasBusinessProfile = (profile) =>
  Boolean(profile && Object.keys(profile).length > 0)

export const validateBusinessProfile = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const profile = {}
  const description = optionalString(body, 'description', 'Description', DESCRIPTION_MAX)
  if (description) profile.description = description

  const phone = optionalString(body, 'phone', 'Phone', PHONE_MAX)
  if (phone && !isValidPhone(phone)) throw httpError('Phone is invalid')
  if (phone) profile.phone = phone

  const email = optionalString(body, 'email', 'Email', EMAIL_MAX)
  if (email && !isValidEmail(email)) throw httpError('Email is invalid')
  if (email) profile.email = email

  const address = validateAddress(body.address)
  if (address) profile.address = address

  if (Object.prototype.hasOwnProperty.call(body, 'serviceAreas')) {
    const serviceAreas = cleanServiceAreas(body.serviceAreas, true)
    if (serviceAreas) profile.serviceAreas = serviceAreas
  }

  if (Object.prototype.hasOwnProperty.call(body, 'socialImageMediaId')) {
    if (body.socialImageMediaId !== null && typeof body.socialImageMediaId !== 'string') {
      throw httpError('Social image is invalid')
    }
    const socialImageMediaId = typeof body.socialImageMediaId === 'string'
      ? body.socialImageMediaId.trim()
      : ''
    if (socialImageMediaId) profile.socialImageMediaId = socialImageMediaId
  }
  return profile
}

export const businessProfileResponse = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
  const profile = {}
  const description = sanitizeString(input.description, DESCRIPTION_MAX)
  if (description) profile.description = description
  const phone = sanitizeString(input.phone, PHONE_MAX)
  if (phone && isValidPhone(phone)) profile.phone = phone
  const email = sanitizeString(input.email, EMAIL_MAX)
  if (email && isValidEmail(email)) profile.email = email
  const address = sanitizeAddress(input.address)
  if (address) profile.address = address
  const serviceAreas = cleanServiceAreas(input.serviceAreas, false)
  if (serviceAreas) profile.serviceAreas = serviceAreas
  const socialImageMediaId = sanitizeString(input.socialImageMediaId, 200)
  if (socialImageMediaId) profile.socialImageMediaId = socialImageMediaId
  return hasBusinessProfile(profile) ? profile : undefined
}
