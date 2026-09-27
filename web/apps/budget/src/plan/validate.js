import { parseISO, parseMonth } from './dates.js'
import { MAX_CENTS } from './money.js'

const CATEGORIES = new Set(['utility', 'debt', 'one-time'])
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const codePoints = (value) => [...value].length
const hasControl = (value) => [...value].some((character) => character.codePointAt(0) <= 31 || character.codePointAt(0) === 127)
const validName = (value) => typeof value === 'string' && value.trim() && codePoints(value.trim()) <= 80 && !hasControl(value)
const validCents = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS
const validText = (value, max) => typeof value === 'string' && codePoints(value.trim()) <= max && !hasControl(value)
const validUrl = (value) => {
  if (typeof value !== 'string' || codePoints(value.trim()) > 1000) return false
  if (!value.trim()) return true
  try { const url = new URL(value.trim()); return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password } catch { return false }
}
const validSchedule = (value) => {
  if (!plainObject(value)) return false
  if (value.frequency === 'monthly') return value.rule === 'first' || value.rule === 'last' || (value.rule === 'day' && Number.isInteger(value.day) && value.day >= 1 && value.day <= 31)
  return (value.frequency === 'weekly' || value.frequency === 'biweekly') && parseISO(value.anchorDate) !== null
}
const validDue = (value, category) => {
  if (!plainObject(value)) return false
  if (category === 'one-time') return value.rule === 'date' && parseISO(value.date) !== null
  return value.rule === 'first' || value.rule === 'last' || (value.rule === 'day' && Number.isInteger(value.day) && value.day >= 1 && value.day <= 31)
}

export const validateEntry = (kind, value, paydayIds = new Set(), { create = true } = {}) => {
  if (!plainObject(value)) return 'body'
  if (create && value.requestId !== undefined && (typeof value.requestId !== 'string' || !UUID_V4.test(value.requestId))) return 'requestId'
  if (kind !== 'payday' && !CATEGORIES.has(value.category)) return 'category'
  if (!validName(value.name)) return 'name'
  if (!validCents(value.amountCents)) return 'amountCents'
  if (kind === 'payday') {
    if (!validSchedule(value.schedule)) return 'schedule'
    if (!create && (!Number.isInteger(value.expectedRev) || value.expectedRev < 0)) return 'expectedRev'
    return null
  }
  if (!validDue(value.due, value.category)) return 'due'
  const lastPaymentMonth = value.lastPaymentMonth ?? null
  if (value.category === 'debt' ? lastPaymentMonth !== null && parseMonth(lastPaymentMonth) === null : lastPaymentMonth !== null) return 'lastPaymentMonth'
  const balanceCents = value.balanceCents ?? null
  if (value.category === 'debt' ? balanceCents !== null && !validCents(balanceCents) : balanceCents !== null) return 'balanceCents'
  const paydayId = value.paydayId ?? null
  if (paydayId !== null && (typeof paydayId !== 'string' || !paydayIds.has(paydayId))) return 'paydayId'
  if (typeof (value.autoPay ?? false) !== 'boolean') return 'autoPay'
  if (typeof (value.active ?? true) !== 'boolean') return 'active'
  if (!validUrl(value.url ?? '')) return 'url'
  if (!validText(value.notes ?? '', 300)) return 'notes'
  if (!create && (!Number.isInteger(value.expectedRev) || value.expectedRev < 0)) return 'expectedRev'
  return null
}
