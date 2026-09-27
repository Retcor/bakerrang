export const SERVER_OWNED_FIELDS = Object.freeze(['requestId'])

export const MAX_PAYDAYS = 20
export const MAX_BILLS = 250
export const MAX_CENTS = 999999999

const CATEGORIES = new Set(['utility', 'debt', 'one-time'])
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_MONTH = /^(\d{4})-(\d{2})$/

const codePoints = (value) => [...value].length
const hasControl = (value) => [...value].some((character) => character.codePointAt(0) <= 31 || character.codePointAt(0) === 127)
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export const daysInMonth = (year, month) => {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export const isCivilDate = (value) => {
  const match = typeof value === 'string' && value.match(ISO_DATE)
  if (!match) return false
  const [, ys, ms, ds] = match
  const year = Number(ys); const month = Number(ms); const day = Number(ds)
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

export const isCivilMonth = (value) => {
  const match = typeof value === 'string' && value.match(ISO_MONTH)
  if (!match) return false
  const year = Number(match[1]); const month = Number(match[2])
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12
}

export const toCents = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e11) return null
  return Math.sign(value) * Math.round(Number((Math.abs(value) * 100).toPrecision(15)))
}

const revOf = (value) => Number.isInteger(value) && value >= 0 ? value : 0
const stringOrEmpty = (value) => typeof value === 'string' ? value : ''
const issueResult = (value, issues) => issues.length ? { ...value, issues } : value

export const normalizePayday = (stored = {}) => {
  const issues = []
  const amountCents = toCents(stored.amount)
  if (amountCents === null) issues.push('amount')
  else if (amountCents < 0) issues.push('negative')
  const name = stringOrEmpty(stored.name)
  if (!name) issues.push('name')
  let schedule = null
  if (stored.frequency === 'monthly') {
    if (stored.dayType === 'first' || stored.dayType === 'last') schedule = { frequency: 'monthly', rule: stored.dayType }
    else {
      const parsed = Number.parseInt(stored.day, 10)
      if (Number.isFinite(parsed) && parsed >= 1) schedule = { frequency: 'monthly', rule: 'day', day: Math.min(parsed, 31) }
    }
  } else if ((stored.frequency === 'weekly' || stored.frequency === 'biweekly') && isCivilDate(stored.startDate)) {
    schedule = { frequency: stored.frequency, anchorDate: stored.startDate }
  }
  if (!schedule) issues.push('schedule')
  return issueResult({ id: stringOrEmpty(stored.id), name, amountCents, schedule, rev: revOf(stored.rev) }, issues)
}

export const normalizeBill = (stored = {}, paydayIds = new Set()) => {
  const issues = []
  const rawCategory = stored.category
  const category = CATEGORIES.has(rawCategory) ? rawCategory : 'utility'
  if (category !== rawCategory) issues.push('category')
  const amountCents = toCents(stored.amount)
  if (amountCents === null) issues.push('amount')
  else if (amountCents < 0) issues.push('negative')
  const name = stringOrEmpty(stored.name)
  if (!name) issues.push('name')
  let due = null
  if (category === 'one-time') {
    if (isCivilDate(stored.day)) due = { rule: 'date', date: stored.day }
  } else if (stored.dayType === 'first' || stored.dayType === 'last') {
    due = { rule: stored.dayType }
  } else {
    const parsed = Number.parseInt(stored.day, 10)
    if (Number.isFinite(parsed) && parsed >= 1) due = { rule: 'day', day: Math.min(parsed, 31) }
  }
  if (!due) issues.push('due')
  let lastPaymentMonth = null
  if (typeof stored.endDate === 'string' && isCivilDate(stored.endDate)) lastPaymentMonth = stored.endDate.slice(0, 7)
  const balanceCents = typeof stored.balance === 'number' && Number.isFinite(stored.balance) ? toCents(stored.balance) : null
  const paydayId = typeof stored.paydayId === 'string' && paydayIds.has(stored.paydayId) ? stored.paydayId : null
  const value = {
    id: stringOrEmpty(stored.id),
    category,
    name,
    amountCents,
    due,
    paydayId,
    autoPay: Boolean(stored.autoPay),
    active: Boolean(stored.active),
    notes: stringOrEmpty(stored.notes),
    url: stringOrEmpty(stored.url),
    rev: revOf(stored.rev)
  }
  if (category === 'debt') Object.assign(value, { lastPaymentMonth, balanceCents })
  return issueResult(value, issues)
}

export const normalizePlan = (stored = {}) => {
  const paydays = Array.isArray(stored.paydays) ? stored.paydays.map(normalizePayday) : []
  const ids = new Set(paydays.map(({ id }) => id))
  const bills = Array.isArray(stored.items) ? stored.items.map((item) => normalizeBill(item, ids)) : []
  return { paydays, bills }
}

const invalid = (kind, field) => ({ ok: false, error: `Invalid ${kind}`, field })
const validName = (value) => typeof value === 'string' && value.trim() && codePoints(value.trim()) <= 80 && !hasControl(value)
const validCents = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS
const validText = (value, max) => typeof value === 'string' && codePoints(value.trim()) <= max && !hasControl(value)

const validSchedule = (value) => {
  if (!plainObject(value)) return false
  if (value.frequency === 'monthly') {
    if (value.rule === 'first' || value.rule === 'last') return true
    return value.rule === 'day' && Number.isInteger(value.day) && value.day >= 1 && value.day <= 31
  }
  return (value.frequency === 'weekly' || value.frequency === 'biweekly') && isCivilDate(value.anchorDate)
}

const validDue = (value, category) => {
  if (!plainObject(value)) return false
  if (category === 'one-time') return value.rule === 'date' && isCivilDate(value.date)
  if (value.rule === 'first' || value.rule === 'last') return true
  return value.rule === 'day' && Number.isInteger(value.day) && value.day >= 1 && value.day <= 31
}

const validUrl = (value) => {
  if (typeof value !== 'string' || codePoints(value.trim()) > 1000) return false
  if (!value.trim()) return true
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
  } catch { return false }
}

export const validatePayday = (body, { create = true } = {}) => {
  if (!plainObject(body)) return invalid('payday', 'body')
  if (create && body.requestId !== undefined && (typeof body.requestId !== 'string' || !UUID_V4.test(body.requestId))) return invalid('payday', 'requestId')
  if (!validName(body.name)) return invalid('payday', 'name')
  if (!validCents(body.amountCents)) return invalid('payday', 'amountCents')
  if (!validSchedule(body.schedule)) return invalid('payday', 'schedule')
  if (!create && (!Number.isInteger(body.expectedRev) || body.expectedRev < 0)) return invalid('payday', 'expectedRev')
  return { ok: true, value: { requestId: body.requestId, name: body.name.trim(), amountCents: body.amountCents, schedule: body.schedule, expectedRev: body.expectedRev } }
}

export const validateBill = (body, paydayIds = new Set(), { create = true } = {}) => {
  if (!plainObject(body)) return invalid('bill', 'body')
  if (create && body.requestId !== undefined && (typeof body.requestId !== 'string' || !UUID_V4.test(body.requestId))) return invalid('bill', 'requestId')
  if (!CATEGORIES.has(body.category)) return invalid('bill', 'category')
  if (!validName(body.name)) return invalid('bill', 'name')
  if (!validCents(body.amountCents)) return invalid('bill', 'amountCents')
  if (!validDue(body.due, body.category)) return invalid('bill', 'due')
  const lastPaymentMonth = body.lastPaymentMonth ?? null
  if (body.category === 'debt' ? lastPaymentMonth !== null && !isCivilMonth(lastPaymentMonth) : lastPaymentMonth !== null) return invalid('bill', 'lastPaymentMonth')
  const balanceCents = body.balanceCents ?? null
  if (body.category === 'debt' ? balanceCents !== null && !validCents(balanceCents) : balanceCents !== null) return invalid('bill', 'balanceCents')
  const paydayId = body.paydayId ?? null
  if (paydayId !== null && (typeof paydayId !== 'string' || !paydayIds.has(paydayId))) return invalid('bill', 'paydayId')
  const autoPay = body.autoPay ?? false; const active = body.active ?? true
  if (typeof autoPay !== 'boolean') return invalid('bill', 'autoPay')
  if (typeof active !== 'boolean') return invalid('bill', 'active')
  const url = body.url ?? ''; const notes = body.notes ?? ''
  if (!validUrl(url)) return invalid('bill', 'url')
  if (!validText(notes, 300)) return invalid('bill', 'notes')
  if (!create && (!Number.isInteger(body.expectedRev) || body.expectedRev < 0)) return invalid('bill', 'expectedRev')
  return { ok: true, value: { requestId: body.requestId, category: body.category, name: body.name.trim(), amountCents: body.amountCents, due: body.due, lastPaymentMonth, balanceCents, paydayId, autoPay, active, url: url.trim(), notes: notes.trim(), expectedRev: body.expectedRev } }
}

export const paydayToStored = (value) => {
  const common = { name: value.name, amount: value.amountCents / 100 }
  if (value.schedule.frequency === 'monthly') return { ...common, frequency: 'monthly', dayType: value.schedule.rule === 'day' ? 'fixed' : value.schedule.rule, day: value.schedule.rule === 'day' ? value.schedule.day : null, startDate: null }
  return { ...common, frequency: value.schedule.frequency, dayType: null, day: null, startDate: value.schedule.anchorDate }
}

export const billToStored = (value) => {
  let dayType; let day
  if (value.category === 'one-time') { dayType = 'specific'; day = value.due.date } else if (value.due.rule === 'day') { dayType = 'fixed'; day = value.due.day } else { dayType = value.due.rule; day = null }
  let endDate = null
  if (value.category === 'debt' && value.lastPaymentMonth) {
    const [year, month] = value.lastPaymentMonth.split('-').map(Number)
    endDate = `${value.lastPaymentMonth}-${String(daysInMonth(year, month)).padStart(2, '0')}`
  }
  return {
    category: value.category,
    name: value.name,
    amount: value.amountCents / 100,
    dayType,
    day,
    notes: value.notes,
    url: value.url,
    autoPay: value.autoPay,
    active: value.active,
    balance: value.category === 'debt' && value.balanceCents !== null ? value.balanceCents / 100 : null,
    endDate,
    paydayId: value.paydayId
  }
}

export const stripServerOwned = (body) => Object.fromEntries(Object.entries(plainObject(body) ? body : {}).filter(([key]) => key !== 'rev' && !SERVER_OWNED_FIELDS.includes(key)))
