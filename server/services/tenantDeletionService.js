import { db } from '../client/firestoreClient.js'
import { gcsStorage } from '../client/gcsClient.js'

const TENANTS = 'tenants'
const JOBS = 'tenantDeletionJobs'
const OUTBOX = 'leadNotifications'
const DOMAINS = 'siteDomains'
const DOMAIN_POINTERS = 'tenantSiteDomains'

let firestore = db
let objectStorage = gcsStorage

export const _setDb = (nextDb) => { firestore = nextDb || db }
export const _setStorage = (nextStorage) => { objectStorage = nextStorage || gcsStorage }

const httpError = (status, message) => Object.assign(new Error(message), { status })
const tenantRef = (tenantId) => firestore.collection(TENANTS).doc(tenantId)
const jobRef = (tenantId) => firestore.collection(JOBS).doc(tenantId)
const mediaPrefix = (tenantId) => `tenants/${tenantId}/media/`

const jobResponse = (snapshot) => ({ tenantId: snapshot.data().tenantId, status: snapshot.data().status })

const requireJob = async (tenantId) => {
  const snapshot = await jobRef(tenantId).get()
  if (!snapshot.exists || snapshot.data()?.tenantId !== tenantId) {
    throw httpError(404, 'Tenant deletion was not authorized')
  }
  return snapshot
}

export const authorizeTenantDeletion = async (tenantId, confirmation, requestedByUserId) => {
  if (typeof confirmation !== 'string') throw httpError(400, 'Tenant name confirmation is required')
  const now = Date.now()
  await firestore.runTransaction(async (transaction) => {
    const tenantSnapshot = await transaction.get(tenantRef(tenantId))
    if (!tenantSnapshot.exists) throw httpError(404, 'Tenant not found')
    const tenant = tenantSnapshot.data()
    if (tenant?.status !== 'ACTIVE') throw httpError(409, 'Tenant is not active')
    if (tenant.name !== confirmation) throw httpError(400, 'Tenant name confirmation does not match')

    transaction.set(tenantRef(tenantId), { status: 'PENDING_DELETE', updatedAt: now }, { merge: true })
    transaction.set(jobRef(tenantId), {
      tenantId,
      status: 'PENDING_DELETE',
      requestedAt: now,
      requestedByUserId,
      updatedAt: now
    })
  })
}

const updateJob = async (tenantId, status, extra = {}) => {
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef(tenantId))
    if (!snapshot.exists || snapshot.data()?.tenantId !== tenantId) {
      throw httpError(404, 'Tenant deletion was not authorized')
    }
    transaction.set(jobRef(tenantId), { status, updatedAt: Date.now(), ...extra }, { merge: true })
  })
}

const deleteMatchingOutbox = async (tenantId) => {
  const snapshot = await firestore.collection(OUTBOX).where('tenantId', '==', tenantId).get()
  await Promise.all(snapshot.docs.map(async (doc) => {
    if (doc.data()?.tenantId === tenantId) await doc.ref.delete()
  }))
}

const deleteMatchingDomains = async (tenantId) => {
  const snapshot = await firestore.collection(DOMAINS).where('tenantId', '==', tenantId).get()
  await Promise.all(snapshot.docs.map(async (doc) => {
    if (doc.data()?.tenantId === tenantId) await doc.ref.delete()
  }))
  await firestore.collection(DOMAIN_POINTERS).doc(tenantId).delete()
}

const failJob = async (tenantId) => {
  try {
    await updateJob(tenantId, 'FAILED', { lastError: 'Tenant deletion cleanup failed' })
  } catch {
    // The original cleanup failure is still the meaningful request failure.
  }
}

export const runTenantDeletion = async (tenantId) => {
  const existing = await requireJob(tenantId)
  if (existing.data().status === 'COMPLETE') return jobResponse(existing)

  try {
    await updateJob(tenantId, 'DELETING', { lastError: null })
    await deleteMatchingOutbox(tenantId)
    await deleteMatchingDomains(tenantId)
    await objectStorage.deleteFiles({ prefix: mediaPrefix(tenantId) })
    await firestore.recursiveDelete(tenantRef(tenantId))
    await updateJob(tenantId, 'COMPLETE', { lastError: null })
    return { tenantId, status: 'COMPLETE' }
  } catch (error) {
    await failJob(tenantId)
    throw httpError(500, 'Tenant deletion failed')
  }
}

export const deleteTenant = async (tenantId, confirmation, requestedByUserId) => {
  await authorizeTenantDeletion(tenantId, confirmation, requestedByUserId)
  return runTenantDeletion(tenantId)
}

export const resumeTenantDeletion = async (tenantId) => {
  const existing = await requireJob(tenantId)
  if (existing.data().status === 'COMPLETE') return jobResponse(existing)
  if (!['PENDING_DELETE', 'DELETING', 'FAILED'].includes(existing.data().status)) {
    throw httpError(409, 'Tenant deletion cannot be resumed')
  }
  return runTenantDeletion(tenantId)
}

export const getTenantDeletion = async (tenantId) => jobResponse(await requireJob(tenantId))

export const tenantDeletionConstants = Object.freeze({ mediaPrefix })
