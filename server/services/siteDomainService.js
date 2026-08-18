import { randomBytes } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import { db } from '../client/firestoreClient.js'
import {
  normalizeRegistrationHostname,
  normalizeRequestHostname,
  siteDomainResponse
} from '../domain/siteDomain.js'

const SITE_DOMAINS = 'siteDomains'
const TENANT_SITE_DOMAINS = 'tenantSiteDomains'
const TENANTS = 'tenants'

const httpError = (status, message) => Object.assign(new Error(message), { status })
const defaultToken = () => randomBytes(32).toString('hex')

let firestore = db
let dnsResolver = resolveTxt
let tokenGenerator = defaultToken

export const _setDb = (nextDb) => { firestore = nextDb || db }
export const _setDnsResolver = (resolver) => { dnsResolver = resolver || resolveTxt }
export const _setTokenGenerator = (generator) => { tokenGenerator = generator || defaultToken }

const refsFor = (tenantId, hostname) => ({
  tenant: firestore.collection(TENANTS).doc(tenantId),
  pointer: firestore.collection(TENANT_SITE_DOMAINS).doc(tenantId),
  domain: hostname ? firestore.collection(SITE_DOMAINS).doc(hostname) : null
})

const getPointedDomain = async (tenantId) => {
  const pointer = await refsFor(tenantId).pointer.get()
  if (!pointer.exists || typeof pointer.data()?.hostname !== 'string') return null
  const domain = await refsFor(tenantId, pointer.data().hostname).domain.get()
  if (!domain.exists || domain.data()?.tenantId !== tenantId) return null
  return domain.data()
}

export const getSiteDomain = async (tenantId) => {
  const record = await getPointedDomain(tenantId)
  return record ? siteDomainResponse(record) : null
}

export const registerSiteDomain = async (tenantId, input, actorUserId) => {
  const hostname = normalizeRegistrationHostname(input?.hostname)
  const refs = refsFor(tenantId, hostname)
  let result

  await firestore.runTransaction(async (transaction) => {
    const [tenantSnapshot, pointerSnapshot, domainSnapshot] = await Promise.all([
      transaction.get(refs.tenant),
      transaction.get(refs.pointer),
      transaction.get(refs.domain)
    ])
    if (!tenantSnapshot.exists) throw httpError(404, 'Tenant not found')

    const pointerHostname = pointerSnapshot.exists ? pointerSnapshot.data()?.hostname : null
    const existing = domainSnapshot.exists ? domainSnapshot.data() : null
    if (existing && existing.tenantId !== tenantId) {
      throw httpError(409, 'Hostname is already in use')
    }
    if (pointerHostname && pointerHostname !== hostname) {
      throw httpError(409, 'Remove the existing custom domain before adding another')
    }
    if (existing) {
      result = existing
      return
    }
    if (pointerHostname === hostname) {
      throw httpError(409, 'Custom domain registry is inconsistent')
    }

    const now = Date.now()
    result = {
      hostname,
      tenantId,
      status: 'PENDING_VERIFICATION',
      verificationToken: tokenGenerator(),
      createdAt: now,
      createdByUserId: actorUserId,
      updatedAt: now
    }
    transaction.set(refs.domain, result)
    transaction.set(refs.pointer, { hostname })
  })

  console.info(`Site domain registered: ${hostname} for tenant ${tenantId}`)
  return siteDomainResponse(result)
}

const verificationRecords = async (hostname) => {
  const name = `_bakerrang-verification.${hostname}`
  try {
    const records = await dnsResolver(name)
    return records.map((chunks) => chunks.join(''))
  } catch (error) {
    if (error?.code === 'ENOTFOUND' || error?.code === 'ENODATA') {
      throw httpError(409, 'TXT verification record is not visible yet')
    }
    throw httpError(409, 'DNS lookup temporarily failed. Please try again')
  }
}

export const verifySiteDomain = async (tenantId, actorUserId) => {
  const current = await getPointedDomain(tenantId)
  if (!current) throw httpError(404, 'Custom domain not found')
  if (current.status === 'VERIFIED') return siteDomainResponse(current)
  if (!['PENDING_VERIFICATION', 'DISABLED'].includes(current.status)) {
    throw httpError(409, 'Domain cannot be verified in its current state')
  }

  const records = await verificationRecords(current.hostname)
  if (!records.length) throw httpError(409, 'TXT verification record is not visible yet')
  if (!records.includes(current.verificationToken)) {
    throw httpError(422, 'TXT verification token does not match')
  }

  const refs = refsFor(tenantId, current.hostname)
  let result
  await firestore.runTransaction(async (transaction) => {
    const [pointerSnapshot, domainSnapshot] = await Promise.all([
      transaction.get(refs.pointer),
      transaction.get(refs.domain)
    ])
    if (
      !pointerSnapshot.exists ||
      pointerSnapshot.data()?.hostname !== current.hostname ||
      !domainSnapshot.exists ||
      domainSnapshot.data()?.tenantId !== tenantId
    ) throw httpError(404, 'Custom domain not found')
    const record = domainSnapshot.data()
    if (record.verificationToken !== current.verificationToken) {
      throw httpError(409, 'Domain verification changed. Please retry')
    }
    if (!['PENDING_VERIFICATION', 'DISABLED'].includes(record.status)) {
      throw httpError(409, 'Domain cannot be verified in its current state')
    }
    const now = Date.now()
    result = {
      ...record,
      status: 'VERIFIED',
      verifiedAt: now,
      verifiedByUserId: actorUserId,
      updatedAt: now
    }
    transaction.set(refs.domain, result)
  })
  console.info(`Site domain verified: ${current.hostname} for tenant ${tenantId}`)
  return siteDomainResponse(result)
}

const transitionPointedDomain = async (tenantId, transition) => {
  const pointerRef = refsFor(tenantId).pointer
  let result
  await firestore.runTransaction(async (transaction) => {
    const pointerSnapshot = await transaction.get(pointerRef)
    if (!pointerSnapshot.exists || typeof pointerSnapshot.data()?.hostname !== 'string') {
      throw httpError(404, 'Custom domain not found')
    }
    const hostname = pointerSnapshot.data().hostname
    const domainRef = refsFor(tenantId, hostname).domain
    const domainSnapshot = await transaction.get(domainRef)
    if (!domainSnapshot.exists || domainSnapshot.data()?.tenantId !== tenantId) {
      throw httpError(404, 'Custom domain not found')
    }
    result = transition(domainSnapshot.data())
    transaction.set(domainRef, result)
  })
  return result
}

export const activateSiteDomain = async (tenantId, actorUserId) => {
  const result = await transitionPointedDomain(tenantId, (record) => {
    if (record.status !== 'VERIFIED') {
      throw httpError(409, 'Domain must be freshly verified before activation')
    }
    const now = Date.now()
    return {
      ...record,
      status: 'ACTIVE',
      activatedAt: now,
      activatedByUserId: actorUserId,
      updatedAt: now
    }
  })
  console.info(`Site domain activated: ${result.hostname} for tenant ${tenantId}`)
  return siteDomainResponse(result)
}

export const disableSiteDomain = async (tenantId, actorUserId) => {
  const result = await transitionPointedDomain(tenantId, (record) => {
    if (record.status !== 'ACTIVE') throw httpError(409, 'Only an active domain can be disabled')
    const now = Date.now()
    const next = {
      ...record,
      status: 'DISABLED',
      verificationToken: tokenGenerator(),
      disabledAt: now,
      disabledByUserId: actorUserId,
      updatedAt: now
    }
    delete next.verifiedAt
    delete next.verifiedByUserId
    return next
  })
  console.info(`Site domain disabled: ${result.hostname} for tenant ${tenantId}`)
  return siteDomainResponse(result)
}

export const removeSiteDomain = async (tenantId) => {
  const pointerRef = refsFor(tenantId).pointer
  let hostname
  await firestore.runTransaction(async (transaction) => {
    const pointerSnapshot = await transaction.get(pointerRef)
    if (!pointerSnapshot.exists || typeof pointerSnapshot.data()?.hostname !== 'string') {
      throw httpError(404, 'Custom domain not found')
    }
    hostname = pointerSnapshot.data().hostname
    const domainRef = refsFor(tenantId, hostname).domain
    const domainSnapshot = await transaction.get(domainRef)
    if (!domainSnapshot.exists || domainSnapshot.data()?.tenantId !== tenantId) {
      throw httpError(404, 'Custom domain not found')
    }
    transaction.delete(domainRef)
    transaction.delete(pointerRef)
  })
  console.info(`Site domain removed: ${hostname} for tenant ${tenantId}`)
  return { removed: true }
}

export const resolveActiveDomain = async (requestHostname) => {
  let hostname
  try {
    hostname = normalizeRequestHostname(requestHostname)
  } catch {
    throw httpError(404, 'Domain not found')
  }
  const snapshot = await firestore
    .collection(SITE_DOMAINS)
    .doc(hostname)
    .get()
  const record = snapshot.exists ? snapshot.data() : null
  if (!record || record.status !== 'ACTIVE' || record.hostname !== hostname) {
    throw httpError(404, 'Domain not found')
  }
  return { tenantId: record.tenantId, canonicalHost: record.hostname }
}

export const getActiveDomainForTenant = async (tenantId) => {
  const record = await getPointedDomain(tenantId)
  return { canonicalHost: record?.status === 'ACTIVE' ? record.hostname : null }
}
