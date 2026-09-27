export const MAX_CENTS = 999999999

export const toCents = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e11) return null
  return Math.sign(value) * Math.round(Number((Math.abs(value) * 100).toPrecision(15)))
}

export const parseMoney = (input) => {
  if (typeof input !== 'string') return null
  let value = input.trim()
  if (value.startsWith('$')) value = value.slice(1).trim()
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d{0,2})?$/.test(value) || !/\d/.test(value)) return null
  const compact = value.replaceAll(',', '')
  const [whole = '0', fraction = ''] = compact.split('.')
  const cents = Number(whole || '0') * 100 + Number((fraction + '00').slice(0, 2))
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null
}

export const formatCents = (cents, { signed = false } = {}) => {
  if (!Number.isSafeInteger(cents)) return '—'
  const absolute = Math.abs(cents)
  const money = `$${Math.floor(absolute / 100).toLocaleString('en-US')}.${String(absolute % 100).padStart(2, '0')}`
  if (cents < 0) return `−${money}`
  return signed && cents > 0 ? `+${money}` : money
}
