import { randomUUID } from 'node:crypto'
import { db } from '../client/firestoreClient.js'
import { getPublishedSiteDefinition } from './siteService.js'
import {
  isValidEmail,
  isValidPhone
} from '../validation/contactMethods.js'

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
    !nonEmptyString(value.status) ||
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
    !nonEmptyString(value.status) ||
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
