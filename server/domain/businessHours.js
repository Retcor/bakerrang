export const WEEKDAY_KEYS = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
])
// Test for CI/CD
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

const httpError = (message) => {
  const error = new Error(message)
  error.status = 400
  return error
}

const normalizeDay = (input, strict, label) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    if (strict) throw httpError(`${label} hours are invalid`)
    return undefined
  }
  const keys = Object.keys(input)
  if (input.closed === true) {
    if (keys.length !== 1 || keys[0] !== 'closed') {
      if (strict) throw httpError(`${label} closed hours are invalid`)
      return undefined
    }
    return { closed: true }
  }
  if (keys.length !== 2 || !own(input, 'open') || !own(input, 'close')) {
    if (strict) throw httpError(`${label} open hours are invalid`)
    return undefined
  }
  if (typeof input.open !== 'string' || !TIME.test(input.open) ||
      typeof input.close !== 'string' || !TIME.test(input.close)) {
    if (strict) throw httpError(`${label} times must use HH:MM`)
    return undefined
  }
  if (input.close <= input.open) {
    if (strict) throw httpError(`${label} closing time must be later than opening time`)
    return undefined
  }
  return { open: input.open, close: input.close }
}

const normalizeHours = (input, strict) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    if (strict) throw httpError('Business hours must be an object')
    return undefined
  }
  const keys = Object.keys(input)
  if (keys.length !== WEEKDAY_KEYS.length || keys.some((key) => !WEEKDAY_KEYS.includes(key))) {
    if (strict) throw httpError('Business hours must include exactly Monday through Sunday')
    return undefined
  }
  const hours = {}
  for (const key of WEEKDAY_KEYS) {
    if (!own(input, key)) {
      if (strict) throw httpError('Business hours must include exactly Monday through Sunday')
      return undefined
    }
    const day = normalizeDay(input[key], strict, key[0].toUpperCase() + key.slice(1))
    if (!day) return undefined
    hours[key] = day
  }
  return hours
}

export const validateBusinessHours = (input) => normalizeHours(input, true)
export const normalizeBusinessHours = (input) => normalizeHours(input, false)

const optionalText = (input, key, label, max) => {
  if (!own(input, key)) return undefined
  if (typeof input[key] !== 'string') throw httpError(`${label} must be a string`)
  const value = input[key].trim()
  if (value.length > max) throw httpError(`${label} must be ${max} characters or fewer`)
  return value || undefined
}

export const validateBusinessHoursUpdate = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw httpError('Business hours update is invalid')
  }
  if (!own(input, 'businessHours') || (input.businessHours !== null && typeof input.businessHours !== 'object')) {
    throw httpError('Business hours are required')
  }
  if (!input.homepage || typeof input.homepage !== 'object' || Array.isArray(input.homepage)) {
    throw httpError('Homepage settings are required')
  }
  if (typeof input.homepage.enabled !== 'boolean') {
    throw httpError('Homepage enabled must be true or false')
  }
  if (input.businessHours === null && input.homepage.enabled) {
    throw httpError('Business hours are required to show the homepage section')
  }
  const heading = optionalText(input.homepage, 'heading', 'Business Hours heading', 120)
  const intro = optionalText(input.homepage, 'intro', 'Business Hours intro', 300)
  return {
    businessHours: input.businessHours === null ? null : validateBusinessHours(input.businessHours),
    homepage: {
      enabled: input.homepage.enabled,
      ...(heading ? { heading } : {}),
      ...(intro ? { intro } : {})
    }
  }
}
