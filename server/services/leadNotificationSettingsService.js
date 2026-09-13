import { db } from '../client/firestoreClient.js'
import { isValidEmail } from '../validation/contactMethods.js'
import { writeAuditEvent } from './auditService.js'

const TENANTS = 'tenants'
const MAX_RECIPIENTS = 10
let firestore = db

export const _setDb = (nextDb) => { firestore = nextDb || db }

const httpError = (status, message) => Object.assign(new Error(message), { status })

const normalizedEmail = (value) => {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return isValidEmail(email) ? email : null
}

const responseFrom = (value) => {
  const seen = new Set()
  const recipients = Array.isArray(value?.recipients)
    ? value.recipients.reduce((items, value) => {
      const email = normalizedEmail(value)
      if (email && !seen.has(email) && items.length < MAX_RECIPIENTS) {
        seen.add(email)
        items.push(email)
      }
      return items
    }, [])
    : []
  return { enabled: value?.enabled !== false, recipients }
}

const validateSettings = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof body.enabled !== 'boolean') throw httpError(400, 'Notifications enabled must be true or false')
  if (!Array.isArray(body.recipients)) throw httpError(400, 'Recipients must be an array')
  if (body.recipients.length > MAX_RECIPIENTS) {
    throw httpError(400, `Recipients cannot exceed ${MAX_RECIPIENTS} addresses`)
  }
  const seen = new Set()
  const recipients = body.recipients.map((value) => {
    const email = normalizedEmail(value)
    if (!email) throw httpError(400, 'Recipient email is invalid')
    if (seen.has(email)) throw httpError(400, 'Recipient emails must be unique')
    seen.add(email)
    return email
  })
  return { enabled: body.enabled, recipients }
}

export const getLeadNotificationSettings = async (tenantId) => {
  const tenantRef = firestore.collection(TENANTS).doc(tenantId)
  const configRef = tenantRef.collection('site').doc('config')
  const [tenant, config] = await Promise.all([tenantRef.get(), configRef.get()])
  if (!tenant.exists) throw httpError(404, 'Tenant not found')
  return responseFrom(config.exists ? config.data()?.leadNotifications : undefined)
}

export const updateLeadNotificationSettings = async (tenantId, input, actor) => {
  const settings = validateSettings(input)
  const tenantRef = firestore.collection(TENANTS).doc(tenantId)
  const configRef = tenantRef.collection('site').doc('config')
  return firestore.runTransaction(async (transaction) => {
    const [tenant, config] = await Promise.all([transaction.get(tenantRef), transaction.get(configRef)])
    if (!tenant.exists) throw httpError(404, 'Tenant not found')
    const nextConfig = { ...(config.exists ? config.data() : {}), leadNotifications: settings }
    transaction.set(configRef, nextConfig)
    if (actor) writeAuditEvent({ firestore, transaction, tenantId, actor, action: 'leadNotifications.update', entityType: 'leadNotifications', summary: 'Updated lead notification settings', metadata: { enabled: settings.enabled, recipientCount: settings.recipients.length } })
    return settings
  })
}

export const leadNotificationRecipientLimit = MAX_RECIPIENTS
