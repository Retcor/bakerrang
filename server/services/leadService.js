import { randomUUID } from 'node:crypto'
import { db } from '../client/firestoreClient.js'
import { getPublishedSiteDefinition } from './siteService.js'
import {
  isValidEmail,
  isValidPhone
} from '../validation/contactMethods.js'
import { isLeadStatus } from '../domain/leadStatus.js'

const TENANTS = 'tenants'
let firestore = db

export const _setDb = (nextDb) => {
  firestore = nextDb || db
}

const httpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0
const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const requireTenantExists = async (tenantId) => {
  const snapshot = await firestore.collection(TENANTS).doc(tenantId).get()
  if (!snapshot.exists) throw httpError(404, 'Tenant not found')
}

const summaryFrom = (snapshot) => {
  const value = snapshot.data()
  if (
    !nonEmptyString(value.name) ||
    !isLeadStatus(value.status) ||
    !nonEmptyString(value.source) ||
    !finiteNumber(value.createdAt) ||
    !finiteNumber(value.updatedAt)
  ) return null

  return {
    id: snapshot.id,
    name: value.name,
    ...(nonEmptyString(value.email) ? { email: value.email } : {}),
    ...(nonEmptyString(value.phone) ? { phone: value.phone } : {}),
    status: value.status,
    source: value.source,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
}

const detailFrom = (snapshot) => {
  const value = snapshot.data()
  if (
    !nonEmptyString(value.name) ||
    !nonEmptyString(value.message) ||
    !isLeadStatus(value.status) ||
    !nonEmptyString(value.source) ||
    !finiteNumber(value.createdAt) ||
    !finiteNumber(value.updatedAt)
  ) throw httpError(500, 'Lead data invalid')

  return {
    id: snapshot.id,
    name: value.name,
    ...(nonEmptyString(value.email) ? { email: value.email } : {}),
    ...(nonEmptyString(value.phone) ? { phone: value.phone } : {}),
    message: value.message,
    status: value.status,
    source: value.source,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
}

const noteFrom = (snapshot) => {
  const value = snapshot.data()
  if (
    !nonEmptyString(value.text) ||
    !Number.isSafeInteger(value.createdAt) ||
    value.createdAt < 0 ||
    !nonEmptyString(value.createdByUserId)
  ) return null

  return {
    id: snapshot.id,
    text: value.text,
    createdAt: value.createdAt,
    createdByUserId: value.createdByUserId
  }
}

const requirePublishedLeadForm = async (tenantId) => {
  let site
  try {
    site = await getPublishedSiteDefinition(tenantId)
  } catch (error) {
    if (error.status === 404) throw httpError(404, 'Site not found')
    throw error
  }

  const home = Array.isArray(site.pages)
    ? site.pages.find((page) => page && page.slug === '/')
    : null
  const sections = home && Array.isArray(home.sections) ? home.sections : []
  const related = sections.filter((section) =>
    section && (section.id === 'contact' || section.type === 'contact')
  )
  if (
    related.length !== 1 ||
    related[0].id !== 'contact' ||
    related[0].type !== 'contact' ||
    !related[0].content ||
    !related[0].content.action ||
    related[0].content.action.type !== 'leadForm'
  ) {
    throw httpError(404, 'Site not found')
  }
}

const validateLead = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof body.name !== 'string' || !body.name.trim()) {
    throw httpError(400, 'Lead name is required')
  }
  const name = body.name.trim()
  if (name.length > 120) throw httpError(400, 'Lead name must be 120 characters or fewer')

  let email
  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    if (typeof body.email !== 'string') throw httpError(400, 'Lead email is invalid')
    email = body.email.trim()
    if (email && !isValidEmail(email)) throw httpError(400, 'Lead email is invalid')
  }

  let phone
  if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
    if (typeof body.phone !== 'string') throw httpError(400, 'Lead phone is invalid')
    phone = body.phone.trim()
    if (phone && !isValidPhone(phone)) throw httpError(400, 'Lead phone is invalid')
  }

  if (!email && !phone) throw httpError(400, 'A phone number or email address is required')

  if (typeof body.message !== 'string' || !body.message.trim()) {
    throw httpError(400, 'Lead message is required')
  }
  const message = body.message.trim()
  if (message.length > 2000) {
    throw httpError(400, 'Lead message must be 2000 characters or fewer')
  }

  return {
    name,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    message
  }
}

const validateNote = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof body.text !== 'string' || !body.text.trim()) {
    throw httpError(400, 'Lead note is required')
  }
  const text = body.text.trim()
  if (text.length > 2000) {
    throw httpError(400, 'Lead note must be 2000 characters or fewer')
  }
  return text
}

export const createPublicLead = async (tenantId, input) => {
  await requirePublishedLeadForm(tenantId)

  if (typeof input?.website === 'string' && input.website.trim().length > 0) {
    return { success: true }
  }

  const lead = validateLead(input)
  const now = Date.now()
  const leadId = randomUUID()
  await firestore.collection(TENANTS).doc(tenantId).collection('leads').doc(leadId).set({
    ...lead,
    status: 'NEW',
    source: 'WEBSITE',
    createdAt: now,
    updatedAt: now
  })

  return { success: true }
}

export const listTenantLeads = async (tenantId) => {
  await requireTenantExists(tenantId)
  const snapshot = await firestore.collection(TENANTS).doc(tenantId)
    .collection('leads')
    .orderBy('createdAt', 'desc')
    .limit(51)
    .get()
  const hasMore = snapshot.docs.length > 50
  const leads = snapshot.docs.slice(0, 50).map(summaryFrom).filter(Boolean)
  return { leads, hasMore }
}

export const getTenantLead = async (tenantId, leadId) => {
  await requireTenantExists(tenantId)
  const snapshot = await firestore.collection(TENANTS).doc(tenantId)
    .collection('leads').doc(leadId).get()
  if (!snapshot.exists) throw httpError(404, 'Lead not found')
  return detailFrom(snapshot)
}

const validateStatusUpdate = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof body.status !== 'string') throw httpError(400, 'Lead status is required')
  if (!isLeadStatus(body.status)) throw httpError(400, 'Lead status is not supported')
  if (!Object.prototype.hasOwnProperty.call(body, 'expectedUpdatedAt')) {
    throw httpError(400, 'expectedUpdatedAt is required')
  }
  if (!Number.isSafeInteger(body.expectedUpdatedAt) || body.expectedUpdatedAt < 0) {
    throw httpError(400, 'expectedUpdatedAt must be a non-negative safe integer')
  }
  return { status: body.status, expectedUpdatedAt: body.expectedUpdatedAt }
}

export const updateLeadStatus = async (tenantId, leadId, input) => {
  const update = validateStatusUpdate(input)
  const tenantRef = firestore.collection(TENANTS).doc(tenantId)
  const leadRef = tenantRef.collection('leads').doc(leadId)

  return firestore.runTransaction(async (transaction) => {
    const [tenantSnapshot, leadSnapshot] = await Promise.all([
      transaction.get(tenantRef),
      transaction.get(leadRef)
    ])

    if (!tenantSnapshot.exists) throw httpError(404, 'Tenant not found')
    if (!leadSnapshot.exists) throw httpError(404, 'Lead not found')

    const current = detailFrom(leadSnapshot)
    if (current.updatedAt !== update.expectedUpdatedAt) {
      throw httpError(409, 'Lead has changed. Refresh and try again.')
    }
    if (current.status === update.status) return current

    const updatedAt = Math.max(Date.now(), current.updatedAt + 1)
    transaction.set(leadRef, { status: update.status, updatedAt }, { merge: true })
    return { ...current, status: update.status, updatedAt }
  })
}

export const createLeadNote = async (tenantId, leadId, input, actorUserId) => {
  const text = validateNote(input)
  const noteId = randomUUID()
  const createdAt = Date.now()
  const note = { text, createdAt, createdByUserId: actorUserId }
  const tenantRef = firestore.collection(TENANTS).doc(tenantId)
  const leadRef = tenantRef.collection('leads').doc(leadId)
  const noteRef = leadRef.collection('notes').doc(noteId)

  await firestore.runTransaction(async (transaction) => {
    const [tenantSnapshot, leadSnapshot] = await Promise.all([
      transaction.get(tenantRef),
      transaction.get(leadRef)
    ])

    if (!tenantSnapshot.exists) throw httpError(404, 'Tenant not found')
    if (!leadSnapshot.exists) throw httpError(404, 'Lead not found')
    transaction.set(noteRef, note)
  })

  return { id: noteId, text, createdAt, createdByUserId: actorUserId }
}

export const listLeadNotes = async (tenantId, leadId) => {
  const tenantRef = firestore.collection(TENANTS).doc(tenantId)
  const leadRef = tenantRef.collection('leads').doc(leadId)
  const [tenantSnapshot, leadSnapshot] = await Promise.all([
    tenantRef.get(),
    leadRef.get()
  ])
  if (!tenantSnapshot.exists) throw httpError(404, 'Tenant not found')
  if (!leadSnapshot.exists) throw httpError(404, 'Lead not found')

  const snapshot = await leadRef.collection('notes')
    .orderBy('createdAt', 'desc')
    .limit(51)
    .get()
  const hasMore = snapshot.docs.length > 50
  const notes = snapshot.docs.slice(0, 50).map(noteFrom).filter(Boolean)
  return { notes, hasMore }
}
