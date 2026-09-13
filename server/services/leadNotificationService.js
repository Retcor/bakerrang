import { isValidEmail } from '../validation/contactMethods.js'
import { db } from '../client/firestoreClient.js'
import defaultSender from './notificationSender.js'

const OUTBOX = 'leadNotifications'
const BATCH_SIZE = 25
const LEASE_MS = 120000
const RETRY_DELAYS = [2 * 60 * 1000, 10 * 60 * 1000, 40 * 60 * 1000, 2 * 60 * 60 * 1000]
let firestore = db
let sender = defaultSender
let clock = () => Date.now()

export const _setDb = (nextDb) => { firestore = nextDb || db }
export const _setSender = (nextSender) => { sender = nextSender || defaultSender }
export const _setClock = (nextClock) => { clock = nextClock || (() => Date.now()) }

const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0
const cleanEmail = (value) => {
  if (!nonEmptyString(value)) return null
  const email = value.trim()
  return isValidEmail(email) ? email : null
}

const cleanRecipients = (value) => {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  return value.reduce((recipients, candidate) => {
    const email = cleanEmail(candidate)
    const key = email?.toLocaleLowerCase('en-US')
    if (email && !seen.has(key)) {
      seen.add(key)
      recipients.push(email)
    }
    return recipients
  }, [])
}

const headerText = (value, fallback) => {
  if (!nonEmptyString(value)) return fallback
  return value.trim().replace(/[\r\n]+/g, ' ').slice(0, 160) || fallback
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const leadLines = (lead, siteName, portalDomain) => {
  const received = new Date(lead.createdAt).toISOString()
  const fields = [
    ['Business', siteName],
    ['Name', lead.name],
    ...(lead.email ? [['Email', lead.email]] : []),
    ...(lead.phone ? [['Phone', lead.phone]] : []),
    ['Message', lead.message],
    ['Received', received]
  ]
  let portalLink = null
  if (nonEmptyString(portalDomain)) {
    try { portalLink = new URL('/leads', new URL(portalDomain).origin).href } catch {}
  }
  return { fields, portalLink }
}

const deliverySnapshot = ({ tenantId, leadId, lead, config, tenant, portalDomain }) => {
  // No Portal settings surface exists yet. Operators may set the server-owned
  // config value { leadNotifications: { enabled?: boolean, recipients?: [] } }.
  const settings = config?.leadNotifications && typeof config.leadNotifications === 'object'
    ? config.leadNotifications
    : {}
  if (settings.enabled === false) return { skipped: 'DISABLED' }
  const recipients = cleanRecipients(settings.recipients)
  const fallback = cleanEmail(config?.businessProfile?.email)
  if (recipients.length === 0 && fallback) recipients.push(fallback)
  if (recipients.length === 0) return { skipped: 'NO_RECIPIENT' }

  const siteName = headerText(config?.branding?.siteName || tenant?.name, 'Website')
  const { fields, portalLink } = leadLines(lead, siteName, portalDomain)
  const text = `${fields.map(([label, value]) => `${label}: ${value}`).join('\n')}\n${portalLink ? `\nView leads: ${portalLink}` : ''}`
  const html = `<h1>New website lead</h1><dl>${fields.map(([label, value]) =>
    `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl>${portalLink
      ? `<p><a href="${escapeHtml(portalLink)}">View leads</a></p>`
      : ''}`
  return {
    recipients,
    ...(cleanEmail(lead.email) ? { replyTo: lead.email } : {}),
    subject: `New website lead — ${siteName}`,
    text,
    html,
    idempotencyKey: `lead-notification/${tenantId}/${leadId}`
  }
}

export const pendingLeadNotification = ({ tenantId, leadId, lead, now }) => ({
  tenantId,
  leadId,
  status: 'PENDING',
  attempts: 0,
  createdAt: now,
  nextAttemptAt: now,
  lead: {
    name: lead.name,
    ...(lead.email ? { email: lead.email } : {}),
    ...(lead.phone ? { phone: lead.phone } : {}),
    message: lead.message,
    createdAt: now
  }
})

const errorText = (error) => String(error?.response?.data?.message || error?.message || 'Email delivery failed')
  .replace(/[\r\n]+/g, ' ')
  .slice(0, 500)

const claim = async (candidateId, now, env) => firestore.runTransaction(async (transaction) => {
  const outboxRef = firestore.collection(OUTBOX).doc(candidateId)
  const outboxSnapshot = await transaction.get(outboxRef)
  if (!outboxSnapshot.exists) return null
  const outbox = outboxSnapshot.data()
  if (['SENT', 'FAILED', 'SKIPPED'].includes(outbox.status)) return null
  if (outbox.status === 'PENDING' && outbox.nextAttemptAt > now) return null
  if (outbox.status === 'PROCESSING' && outbox.leaseUntil > now) return null
  if (!['PENDING', 'PROCESSING'].includes(outbox.status)) return null

  let snapshot = outbox.deliverySnapshot
  if (!snapshot) {
    const tenantRef = firestore.collection('tenants').doc(outbox.tenantId)
    const configRef = tenantRef.collection('site').doc('config')
    const [tenantSnapshot, configSnapshot] = await Promise.all([
      transaction.get(tenantRef), transaction.get(configRef)
    ])
    const resolved = deliverySnapshot({
      tenantId: outbox.tenantId,
      leadId: outbox.leadId,
      lead: outbox.lead,
      tenant: tenantSnapshot.exists ? tenantSnapshot.data() : {},
      config: configSnapshot.exists ? configSnapshot.data() : {},
      portalDomain: env.PORTAL_DOMAIN
    })
    if (resolved.skipped) {
      transaction.set(outboxRef, { status: 'SKIPPED', skipReason: resolved.skipped, leaseUntil: null }, { merge: true })
      return null
    }
    snapshot = resolved
  }

  const leaseUntil = now + LEASE_MS
  const attempts = (Number.isSafeInteger(outbox.attempts) ? outbox.attempts : 0) + 1
  transaction.set(outboxRef, {
    deliverySnapshot: snapshot,
    attempts,
    status: 'PROCESSING',
    leaseUntil,
    lastError: null
  }, { merge: true })
  return { id: candidateId, snapshot, attempts, leaseUntil }
})

const settleSuccess = async (job, now) => firestore.runTransaction(async (transaction) => {
  const ref = firestore.collection(OUTBOX).doc(job.id)
  const snapshot = await transaction.get(ref)
  const outbox = snapshot.exists ? snapshot.data() : null
  if (!outbox || outbox.status !== 'PROCESSING' || outbox.leaseUntil !== job.leaseUntil) return false
  transaction.set(ref, { status: 'SENT', sentAt: now, leaseUntil: null, lastError: null }, { merge: true })
  return true
})

const settleFailure = async (job, error, now) => firestore.runTransaction(async (transaction) => {
  const ref = firestore.collection(OUTBOX).doc(job.id)
  const snapshot = await transaction.get(ref)
  const outbox = snapshot.exists ? snapshot.data() : null
  if (!outbox || outbox.status !== 'PROCESSING' || outbox.leaseUntil !== job.leaseUntil) return false
  const lastError = errorText(error)
  if (job.attempts >= 5) {
    transaction.set(ref, { status: 'FAILED', lastError, leaseUntil: null }, { merge: true })
  } else {
    transaction.set(ref, {
      status: 'PENDING',
      nextAttemptAt: now + RETRY_DELAYS[Math.min(job.attempts - 1, RETRY_DELAYS.length - 1)],
      lastError,
      leaseUntil: null
    }, { merge: true })
  }
  return true
})

export const processLeadNotification = async (candidateId, { now = clock(), env = process.env } = {}) => {
  const job = await claim(candidateId, now, env)
  if (!job) return { claimed: false, sent: false }
  try {
    await sender(job.snapshot)
    return { claimed: true, sent: await settleSuccess(job, clock()) }
  } catch (error) {
    await settleFailure(job, error, clock())
    return { claimed: true, sent: false, failed: true }
  }
}

export const drainLeadNotifications = async ({ env = process.env, now = clock() } = {}) => {
  const notifications = firestore.collection(OUTBOX)
  const [pending, processing] = await Promise.all([
    notifications.where('status', '==', 'PENDING').orderBy('nextAttemptAt', 'asc').limit(BATCH_SIZE).get(),
    notifications.where('status', '==', 'PROCESSING').orderBy('leaseUntil', 'asc').limit(BATCH_SIZE).get()
  ])
  const ids = [...new Set([...pending.docs, ...processing.docs].map((doc) => doc.id))]
  const counts = { discovered: ids.length, claimed: 0, sent: 0, failed: 0 }
  for (const id of ids) {
    const result = await processLeadNotification(id, { now, env })
    if (result.claimed) counts.claimed += 1
    if (result.sent) counts.sent += 1
    if (result.failed) counts.failed += 1
  }
  return counts
}

export const notificationConstants = Object.freeze({ BATCH_SIZE, LEASE_MS, RETRY_DELAYS })
