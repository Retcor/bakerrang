export const EMAIL_MAX = 254
export const PHONE_MAX = 50

const emailPattern = /^[A-Za-z0-9.!$%&'*+=^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/

export const isValidEmail = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= EMAIL_MAX &&
  emailPattern.test(value)

export const dialDigits = (value) =>
  typeof value === 'string' ? value.replace(/[()\-.\s]/g, '') : ''

export const isValidPhone = (value) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > PHONE_MAX) return false
  return /^\+?[\d()\-.\s]+$/.test(value) && /^\+?\d{7,15}$/.test(dialDigits(value))
}
