import { randomUUID } from 'crypto'
import { db } from '../client/firestoreClient.js'

const TENANTS = 'tenants'
const USERS = 'users'
const MEMBERS = 'members'

export const TENANT_ROLES = Object.freeze(['OWNER', 'ADMIN', 'STAFF'])

let firestore = db

// Test seam for the dependency-free node:test suites. Production always uses
// the shared Firestore client imported above.
export const _setDb = (nextDb) => {
  firestore = nextDb || db
}

const httpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const tenantRef = (tenantId) => firestore.collection(TENANTS).doc(tenantId)
const memberRef = (tenantId, userId) => tenantRef(tenantId).collection(MEMBERS).doc(userId)

const validateName = (name) => {
  if (typeof name !== 'string') throw httpError(400, 'Tenant name is required')
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 200) {
    throw httpError(400, 'Tenant name must be between 1 and 200 characters')
  }
  return trimmed
}

const validateUserId = (userId) => {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw httpError(400, 'userId is required')
  }
  return userId.trim()
}

const validateRole = (role) => {
  if (!TENANT_ROLES.includes(role)) {
    throw httpError(400, 'role must be OWNER, ADMIN, or STAFF')
  }
  return role
}

export const createTenant = async (createdByUserId, body = {}) => {
  const tenantId = randomUUID()
  const now = Date.now()
  const record = {
    name: validateName(body && body.name),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    createdByUserId
  }

  await tenantRef(tenantId).set(record)
  return { id: tenantId, ...record }
}

export const listTenants = async () => {
  const snapshot = await firestore.collection(TENANTS).get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

export const getTenant = async (tenantId) => {
  const snapshot = await tenantRef(tenantId).get()
  if (!snapshot.exists) throw httpError(404, 'Tenant not found')
  return { id: snapshot.id, ...snapshot.data() }
}

export const getPlatformRole = async (userId) => {
  const snapshot = await firestore.collection(USERS).doc(userId).get()
  return snapshot.exists ? snapshot.data().platformRole : null
}

export const getMembership = async (tenantId, userId) => {
  const snapshot = await memberRef(tenantId, userId).get()
  return snapshot.exists ? snapshot.data() : null
}

export const addMember = async (tenantId, body = {}, createdByUserId) => {
  const userId = validateUserId(body && body.userId)
  const role = validateRole(body && body.role)
  const now = Date.now()
  const record = {
    userId,
    role,
    createdAt: now,
    updatedAt: now,
    createdByUserId
  }

  await firestore.runTransaction(async (transaction) => {
    const targetTenantRef = tenantRef(tenantId)
    const targetUserRef = firestore.collection(USERS).doc(userId)
    const targetMemberRef = memberRef(tenantId, userId)
    const [tenantSnapshot, userSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(targetTenantRef),
      transaction.get(targetUserRef),
      transaction.get(targetMemberRef)
    ])

    if (!tenantSnapshot.exists) throw httpError(404, 'Tenant not found')
    if (!userSnapshot.exists) throw httpError(404, 'User not found')
    if (memberSnapshot.exists) throw httpError(409, 'Tenant membership already exists')

    transaction.set(targetMemberRef, record)
  })

  return record
}

export const listMembers = async (tenantId) => {
  // Keep missing-tenant behavior explicit instead of returning an ambiguous
  // empty member list.
  await getTenant(tenantId)
  const snapshot = await tenantRef(tenantId).collection(MEMBERS).get()
  return snapshot.docs.map((doc) => doc.data())
}
