import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createRequirePlatformAdmin,
  requireTenantRole
} from '../middleware/tenantAuth.js'

const invoke = async (middleware, req = {}) => {
  let nextCalled = false
  const response = {
    statusCode: 200,
    body: null,
    status (statusCode) {
      this.statusCode = statusCode
      return this
    },
    json (body) {
      this.body = body
      return this
    }
  }
  await middleware(req, response, () => { nextCalled = true })
  return { nextCalled, response, req }
}

test('requirePlatformAdmin trusts only a fresh platform-role lookup', async () => {
  let storedRole = null
  const middleware = createRequirePlatformAdmin({
    getPlatformRole: async () => storedRole
  })
  const request = { user: { id: 'user-1', platformRole: 'PLATFORM_ADMIN' } }

  const denied = await invoke(middleware, request)
  assert.equal(denied.response.statusCode, 403)
  assert.equal(denied.nextCalled, false)

  storedRole = 'PLATFORM_ADMIN'
  request.user.platformRole = null
  const allowed = await invoke(middleware, request)
  assert.equal(allowed.nextCalled, true)
})

test('requireTenantRole implements STAFF, ADMIN, OWNER, non-member, and platform bypass rules', async () => {
  const roles = new Map()
  const memberships = new Map()
  let membershipReads = 0
  const deps = {
    getPlatformRole: async (userId) => roles.get(userId),
    getMembership: async (tenantId, userId) => {
      membershipReads++
      return memberships.get(`${tenantId}/${userId}`) || null
    }
  }
  const tenantReader = requireTenantRole(['OWNER', 'ADMIN', 'STAFF'], deps)
  const memberReader = requireTenantRole(['OWNER', 'ADMIN'], deps)
  const requestFor = (userId) => ({
    user: { id: userId, tenantRole: 'OWNER' },
    params: { tenantId: 'tenant-1' }
  })

  assert.equal((await invoke(tenantReader, requestFor('ordinary'))).response.statusCode, 403)

  memberships.set('tenant-1/staff', { userId: 'staff', role: 'STAFF' })
  assert.equal((await invoke(tenantReader, requestFor('staff'))).nextCalled, true)
  assert.equal((await invoke(memberReader, requestFor('staff'))).response.statusCode, 403)

  for (const role of ['ADMIN', 'OWNER']) {
    const userId = role.toLowerCase()
    memberships.set(`tenant-1/${userId}`, { userId, role })
    assert.equal((await invoke(tenantReader, requestFor(userId))).nextCalled, true)
    assert.equal((await invoke(memberReader, requestFor(userId))).nextCalled, true)
  }

  roles.set('platform', 'PLATFORM_ADMIN')
  const readsBeforeBypass = membershipReads
  assert.equal((await invoke(memberReader, requestFor('platform'))).nextCalled, true)
  assert.equal(membershipReads, readsBeforeBypass)
})

test('tenant authorization observes membership changes on every request', async () => {
  let storedMembership = { role: 'ADMIN' }
  const middleware = requireTenantRole(['OWNER', 'ADMIN'], {
    getPlatformRole: async () => null,
    getMembership: async () => storedMembership
  })
  const request = {
    user: { id: 'user-1', role: 'OWNER' },
    params: { tenantId: 'tenant-1' }
  }

  assert.equal((await invoke(middleware, request)).nextCalled, true)
  storedMembership = null
  assert.equal((await invoke(middleware, request)).response.statusCode, 403)
})

test('authorization middleware rejects missing authentication and hides datastore failures', async () => {
  const platformAdmin = createRequirePlatformAdmin({
    getPlatformRole: async () => { throw new Error('sensitive datastore detail') }
  })
  assert.equal((await invoke(platformAdmin, {})).response.statusCode, 401)

  const originalError = console.error
  console.error = () => {}
  try {
    const failed = await invoke(platformAdmin, { user: { id: 'user-1' } })
    assert.equal(failed.response.statusCode, 500)
    assert.deepEqual(failed.response.body, { error: 'Authorization check failed' })
  } finally {
    console.error = originalError
  }
})
