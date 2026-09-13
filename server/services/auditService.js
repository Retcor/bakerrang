import { randomUUID } from 'node:crypto'
import { db } from '../client/firestoreClient.js'

// Audit events are deliberately written through the caller's transaction.  This
// makes an audit record part of the same all-or-nothing operator mutation.
const TENANTS = 'tenants'
const AUDIT_EVENTS = 'auditEvents'

export const actorFromUser = (user) => ({
  id: user?.id,
  email: typeof user?.email === 'string' ? user.email : null,
  name: typeof user?.displayName === 'string' ? user.displayName : null
})

const requireActor = (actor) => {
  if (!actor || typeof actor.id !== 'string' || !actor.id.trim()) {
    throw Object.assign(new Error('Operator actor is required'), { status: 500 })
  }
  return actor
}

const METADATA_KEYS = new Set([
  'tenantName', 'memberRole', 'pageId', 'pageTitle', 'pageSlug', 'sectionId',
  'sectionType', 'templateId', 'templateName', 'revisionId', 'mediaId',
  'originalFilename', 'contentType', 'sizeBytes', 'leadId', 'oldStatus',
  'newStatus', 'changedFields', 'recipientCount', 'cssByteLength', 'pageCount',
  'hidden', 'enabled'
])

const safeMetadata = (metadata) => {
  if (!metadata) return undefined
  if (typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Audit metadata is invalid')
  const safe = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!METADATA_KEYS.has(key)) throw new Error(`Audit metadata field is not allowed: ${key}`)
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) safe[key] = value
    else if (typeof value === 'string' && value.length <= 200) safe[key] = value
    else if (key === 'changedFields' && Array.isArray(value)) safe[key] = value.filter((field) => typeof field === 'string' && field.length <= 100).slice(0, 50)
    else throw new Error(`Audit metadata value is invalid: ${key}`)
  }
  return Object.keys(safe).length ? safe : undefined
}

// This intentionally has no generic request-payload argument. Callers must
// construct small allowlisted metadata objects from validated identifiers.
export const writeAuditEvent = ({ firestore = db, transaction, tenantId, actor, action, entityType, entityId, summary, metadata }) => {
  if (!transaction) throw new Error('Audit events require a Firestore transaction')
  const snapshot = requireActor(actor)
  if (typeof tenantId !== 'string' || !tenantId || typeof action !== 'string' || !action || typeof entityType !== 'string' || !entityType || typeof summary !== 'string' || !summary) {
    throw new Error('Audit event is invalid')
  }
  const eventId = randomUUID()
  const allowedMetadata = safeMetadata(metadata)
  const event = {
    eventId,
    tenantId,
    occurredAt: Date.now(),
    actorUserId: snapshot.id,
    actorEmail: snapshot.email,
    actorName: snapshot.name,
    actorType: 'USER',
    action,
    entityType,
    ...(entityId ? { entityId } : {}),
    summary,
    ...(allowedMetadata ? { metadata: allowedMetadata } : {})
  }
  transaction.set(firestore.collection(TENANTS).doc(tenantId).collection(AUDIT_EVENTS).doc(eventId), event)
  return event
}

const normalizeLimit = (value) => {
  if (value === undefined) return 50
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw Object.assign(new Error('limit must be between 1 and 200'), { status: 400 })
  return Math.min(parsed, 200)
}

const decodeCursor = (cursor) => {
  if (!cursor) return null
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (!Number.isSafeInteger(parsed?.occurredAt) || typeof parsed?.eventId !== 'string' || !parsed.eventId) throw new Error('invalid')
    return parsed
  } catch {
    throw Object.assign(new Error('cursor is invalid'), { status: 400 })
  }
}

const encodeCursor = (event) => Buffer.from(JSON.stringify({ occurredAt: event.occurredAt, eventId: event.id })).toString('base64url')

export const listAuditEvents = async (tenantId, { limit, cursor } = {}, firestore = db) => {
  const pageSize = normalizeLimit(limit)
  const after = decodeCursor(cursor)
  let query = firestore.collection(TENANTS).doc(tenantId).collection(AUDIT_EVENTS)
    .orderBy('occurredAt', 'desc').orderBy('eventId', 'desc').limit(pageSize + 1)
  if (after) query = query.startAfter(after.occurredAt, after.eventId)
  const snapshot = await query.get()
  const events = snapshot.docs.slice(0, pageSize).map((doc) => ({ id: doc.id, ...doc.data() }))
  return {
    events,
    ...(snapshot.docs.length > pageSize ? { nextCursor: encodeCursor(events.at(-1)) } : {})
  }
}
