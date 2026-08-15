import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { isAuthenticated } from '../routes/auth.js'
import { createTenantRouter } from '../routes/tenants.js'
import {
  createRequirePlatformAdmin,
  requireTenantRole
} from '../middleware/tenantAuth.js'

let server
let baseUrl

const platformRoles = new Map([['platform', 'PLATFORM_ADMIN']])
const memberships = new Map([
  ['tenant-1/staff', { userId: 'staff', role: 'STAFF' }],
  ['tenant-1/admin', { userId: 'admin', role: 'ADMIN' }],
  ['tenant-1/owner', { userId: 'owner', role: 'OWNER' }]
])

const authDeps = {
  getPlatformRole: async (userId) => platformRoles.get(userId),
  getMembership: async (tenantId, userId) => memberships.get(`${tenantId}/${userId}`) || null
}

const notFound = () => Object.assign(new Error('Tenant not found'), { status: 404 })

const calls = []
const siteDefinition = {
  status: 'DRAFT',
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [] }]
}
const service = {
  createTenant: async (actorId, body) => {
    calls.push({ operation: 'createTenant', actorId, body })
    return { id: 'created-tenant', name: body.name, status: 'ACTIVE' }
  },
  listTenants: async () => [],
  getTenant: async (tenantId) => {
    if (tenantId === 'missing') throw notFound()
    return { id: tenantId, name: 'Tenant' }
  },
  addMember: async (tenantId, body, actorId) => {
    calls.push({ operation: 'addMember', tenantId, body, actorId })
    return { userId: body.userId, role: body.role }
  },
  listMembers: async () => []
}

const sites = {
  initializeSite: async (tenantId, actorId) => {
    calls.push({ operation: 'initializeSite', tenantId, actorId })
    return siteDefinition
  },
  getSite: async () => siteDefinition,
  publishSite: async (tenantId, actorId) => {
    calls.push({ operation: 'publishSite', tenantId, actorId })
    return { ...siteDefinition, status: 'PUBLISHED' }
  },
  unpublishSite: async (tenantId, actorId) => {
    calls.push({ operation: 'unpublishSite', tenantId, actorId })
    return siteDefinition
  },
  updateHomeHero: async (tenantId, body) => {
    calls.push({ operation: 'updateHomeHero', tenantId, body })
    return siteDefinition
  },
  upsertHomeServices: async (tenantId, body) => {
    calls.push({ operation: 'upsertHomeServices', tenantId, body })
    return siteDefinition
  },
  upsertHomeContact: async (tenantId, body) => {
    calls.push({ operation: 'upsertHomeContact', tenantId, body })
    return siteDefinition
  }
}

before(async () => {
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    const userId = req.headers['x-test-user']
    req.isAuthenticated = () => Boolean(userId)
    if (userId) req.user = { id: userId, platformRole: req.headers['x-session-role'] }
    next()
  })
  app.use('/tenants', isAuthenticated, createTenantRouter({
    tenantService: service,
    siteService: sites,
    requirePlatformAdmin: createRequirePlatformAdmin(authDeps),
    requireTenantRole: (roles) => requireTenantRole(roles, authDeps)
  }))
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

const request = async (path, { userId, method = 'GET', body, sessionRole } = {}) => {
  const headers = {}
  if (userId) headers['x-test-user'] = userId
  if (sessionRole) headers['x-session-role'] = sessionRole
  if (body) headers['content-type'] = 'application/json'
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
}

test('tenant routes reject unauthenticated and non-platform tenant creation', async () => {
  assert.equal((await request('/tenants', { method: 'POST', body: { name: 'One' } })).status, 401)
  assert.equal((await request('/tenants', {
    userId: 'ordinary',
    sessionRole: 'PLATFORM_ADMIN',
    method: 'POST',
    body: { name: 'One' }
  })).status, 403)
})

test('PLATFORM_ADMIN can create/list tenants and access a tenant without membership', async () => {
  const created = await request('/tenants', {
    userId: 'platform',
    method: 'POST',
    body: { name: 'One' }
  })
  assert.equal(created.status, 201)
  assert.equal((await created.json()).status, 'ACTIVE')
  assert.equal((await request('/tenants', { userId: 'platform' })).status, 200)
  assert.equal((await request('/tenants/tenant-1', { userId: 'platform' })).status, 200)
})

test('tenant read and member-list permissions match STAFF, ADMIN, and OWNER rules', async () => {
  assert.equal((await request('/tenants/tenant-1', { userId: 'ordinary' })).status, 403)

  for (const userId of ['staff', 'admin', 'owner']) {
    assert.equal((await request('/tenants/tenant-1', { userId })).status, 200)
  }

  assert.equal((await request('/tenants/tenant-1/members', { userId: 'staff' })).status, 403)
  assert.equal((await request('/tenants/tenant-1/members', { userId: 'admin' })).status, 200)
  assert.equal((await request('/tenants/tenant-1/members', { userId: 'owner' })).status, 200)
})

test('only PLATFORM_ADMIN can add a member in Step 1.2', async () => {
  for (const userId of ['admin', 'owner']) {
    assert.equal((await request('/tenants/tenant-1/members', {
      userId,
      method: 'POST',
      body: { userId: 'target', role: 'STAFF' }
    })).status, 403)
  }

  const added = await request('/tenants/tenant-1/members', {
    userId: 'platform',
    method: 'POST',
    body: { userId: 'target', role: 'STAFF' }
  })
  assert.equal(added.status, 201)
  assert.equal(calls.at(-1).actorId, 'platform')
})

test('missing tenant returns 404 when platform authorization permits disclosure', async () => {
  assert.equal((await request('/tenants/missing', { userId: 'platform' })).status, 404)
  assert.equal((await request('/tenants/missing', { userId: 'ordinary' })).status, 403)
})

test('only PLATFORM_ADMIN can initialize a site and the actor is passed to the service', async () => {
  assert.equal((await request('/tenants/tenant-1/site', { method: 'POST' })).status, 401)
  assert.equal((await request('/tenants/tenant-1/site', {
    userId: 'ordinary',
    method: 'POST'
  })).status, 403)
  assert.equal((await request('/tenants/tenant-1/site', {
    userId: 'staff',
    method: 'POST'
  })).status, 403)

  const response = await request('/tenants/tenant-1/site', {
    userId: 'platform',
    method: 'POST'
  })
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), siteDefinition)
  assert.deepEqual(calls.at(-1), {
    operation: 'initializeSite',
    tenantId: 'tenant-1',
    actorId: 'platform'
  })
})

test('PLATFORM_ADMIN and tenant OWNER, ADMIN, and STAFF roles may read a site', async () => {
  for (const userId of ['platform', 'owner', 'admin', 'staff']) {
    const response = await request('/tenants/tenant-1/site', { userId })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), siteDefinition)
  }
  assert.equal((await request('/tenants/tenant-1/site', { userId: 'ordinary' })).status, 403)
})

test('only PLATFORM_ADMIN can publish and unpublish a site', async () => {
  for (const operation of ['publish', 'unpublish']) {
    assert.equal((await request(`/tenants/tenant-1/site/${operation}`, {
      method: 'POST'
    })).status, 401)
    assert.equal((await request(`/tenants/tenant-1/site/${operation}`, {
      userId: 'staff',
      method: 'POST'
    })).status, 403)
    assert.equal((await request(`/tenants/tenant-1/site/${operation}`, {
      userId: 'owner',
      method: 'POST'
    })).status, 403)

    const response = await request(`/tenants/tenant-1/site/${operation}`, {
      userId: 'platform',
      method: 'POST'
    })
    assert.equal(response.status, 200)
    assert.deepEqual(calls.at(-1), {
      operation: `${operation}Site`,
      tenantId: 'tenant-1',
      actorId: 'platform'
    })
  }
})

test('only PLATFORM_ADMIN can edit the Home Hero and the route forwards tenantId and body', async () => {
  const path = '/tenants/tenant-1/site/pages/home/sections/hero'
  const body = { title: 'New title', subtitle: 'New subtitle', ignored: true }

  assert.equal((await request(path, { method: 'PATCH', body })).status, 401)
  for (const userId of ['staff', 'admin', 'owner', 'ordinary']) {
    assert.equal((await request(path, { userId, method: 'PATCH', body })).status, 403)
  }

  const response = await request(path, { userId: 'platform', method: 'PATCH', body })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), siteDefinition)
  assert.deepEqual(calls.at(-1), {
    operation: 'updateHomeHero',
    tenantId: 'tenant-1',
    body
  })
})

test('only PLATFORM_ADMIN can PUT Services and the route forwards tenantId and body', async () => {
  const path = '/tenants/tenant-1/site/pages/home/sections/services'
  const body = { title: 'Services', items: [{ name: 'One' }] }

  assert.equal((await request(path, { method: 'PUT', body })).status, 401)
  for (const userId of ['staff', 'admin', 'owner', 'ordinary']) {
    assert.equal((await request(path, { userId, method: 'PUT', body })).status, 403)
  }
  const response = await request(path, { userId: 'platform', method: 'PUT', body })
  assert.equal(response.status, 200)
  assert.deepEqual(calls.at(-1), {
    operation: 'upsertHomeServices', tenantId: 'tenant-1', body
  })
})

test('only PLATFORM_ADMIN can PUT Contact and the route forwards tenantId and body', async () => {
  const path = '/tenants/tenant-1/site/pages/home/sections/contact'
  const body = {
    title: 'Contact Us',
    buttonLabel: 'Email us',
    action: { type: 'email', value: 'hello@example.com' }
  }

  assert.equal((await request(path, { method: 'PUT', body })).status, 401)
  for (const userId of ['staff', 'admin', 'owner', 'ordinary']) {
    assert.equal((await request(path, { userId, method: 'PUT', body })).status, 403)
  }
  const response = await request(path, { userId: 'platform', method: 'PUT', body })
  assert.equal(response.status, 200)
  assert.deepEqual(calls.at(-1), {
    operation: 'upsertHomeContact', tenantId: 'tenant-1', body
  })
})
