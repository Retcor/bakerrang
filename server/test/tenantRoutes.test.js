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
  ['tenant-1/owner', { userId: 'owner', role: 'OWNER' }],
  ['tenant-2/other-member', { userId: 'other-member', role: 'STAFF' }]
])

const authDeps = {
  getPlatformRole: async (userId) => platformRoles.get(userId),
  getMembership: async (tenantId, userId) => memberships.get(`${tenantId}/${userId}`) || null
}

const notFound = () => Object.assign(new Error('Tenant not found'), { status: 404 })

const calls = []
const siteDefinition = {
  status: 'DRAFT',
  branding: { siteName: 'Tenant', primaryColor: '#334155', accentColor: '#0f766e' },
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
  updateSiteBranding: async (tenantId, body) => {
    calls.push({ operation: 'updateSiteBranding', tenantId, body })
    return siteDefinition
  },
  updateBusinessProfile: async (tenantId, body) => {
    calls.push({ operation: 'updateBusinessProfile', tenantId, body })
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
  },
  upsertHomeGallery: async (tenantId, body) => {
    calls.push({ operation: 'upsertHomeGallery', tenantId, body })
    return siteDefinition
  },
  upsertHomeTestimonials: async (tenantId, body) => {
    calls.push({ operation: 'upsertHomeTestimonials', tenantId, body })
    return siteDefinition
  },
  composeHomeSections: async (tenantId, body) => {
    calls.push({ operation: 'composeHomeSections', tenantId, body })
    return siteDefinition
  }
}

const media = {
  listMedia: async (tenantId) => {
    calls.push({ operation: 'listMedia', tenantId })
    return { media: [], hasMore: false }
  },
  createMedia: async (tenantId, file, actorUserId) => {
    calls.push({
      operation: 'createMedia',
      tenantId,
      actorUserId,
      file: { originalname: file.originalname, mimetype: file.mimetype, size: file.size }
    })
    return {
      id: 'media-1',
      originalFilename: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
      width: 2,
      height: 3,
      createdAt: 20,
      src: 'https://media.test/media-1'
    }
  }
}

const leadSummary = {
  id: 'lead-1',
  name: 'Visitor',
  status: 'NEW',
  source: 'WEBSITE',
  createdAt: 10,
  updatedAt: 10
}
const leads = {
  listTenantLeads: async (tenantId) => {
    calls.push({ operation: 'listTenantLeads', tenantId })
    if (tenantId === 'missing') throw notFound()
    return { leads: [leadSummary], hasMore: false }
  },
  getTenantLead: async (tenantId, leadId) => {
    calls.push({ operation: 'getTenantLead', tenantId, leadId })
    if (tenantId === 'missing') throw notFound()
    if (leadId === 'missing') {
      throw Object.assign(new Error('Lead not found'), { status: 404 })
    }
    return { ...leadSummary, message: 'Hello' }
  },
  updateLeadStatus: async (tenantId, leadId, body) => {
    calls.push({ operation: 'updateLeadStatus', tenantId, leadId, body })
    if (tenantId === 'missing') throw notFound()
    if (leadId === 'missing') {
      throw Object.assign(new Error('Lead not found'), { status: 404 })
    }
    return { ...leadSummary, message: 'Hello', status: body.status, updatedAt: 11 }
  },
  listLeadNotes: async (tenantId, leadId) => {
    calls.push({ operation: 'listLeadNotes', tenantId, leadId })
    if (tenantId === 'missing') throw notFound()
    if (leadId === 'missing') {
      throw Object.assign(new Error('Lead not found'), { status: 404 })
    }
    return { notes: [], hasMore: false }
  },
  createLeadNote: async (tenantId, leadId, body, actorUserId) => {
    calls.push({ operation: 'createLeadNote', tenantId, leadId, body, actorUserId })
    if (tenantId === 'missing') throw notFound()
    if (leadId === 'missing') {
      throw Object.assign(new Error('Lead not found'), { status: 404 })
    }
    return { id: 'note-1', text: body.text, createdAt: 20, createdByUserId: actorUserId }
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
    leadService: leads,
    mediaService: media,
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
  const multipart = body instanceof FormData
  if (userId) headers['x-test-user'] = userId
  if (sessionRole) headers['x-session-role'] = sessionRole
  if (body && !multipart) headers['content-type'] = 'application/json'
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: multipart ? body : body ? JSON.stringify(body) : undefined
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

test('only PLATFORM_ADMIN can PUT branding and the route forwards tenantId and body', async () => {
  const path = '/tenants/tenant-1/site/branding'
  const body = { siteName: 'Site', primaryColor: '#112233', accentColor: '#445566' }
  assert.equal((await request(path, { method: 'PUT', body })).status, 401)
  for (const userId of ['staff', 'admin', 'owner', 'ordinary']) {
    assert.equal((await request(path, { userId, method: 'PUT', body })).status, 403)
  }
  const response = await request(path, { userId: 'platform', method: 'PUT', body })
  assert.equal(response.status, 200)
  assert.deepEqual(calls.at(-1), { operation: 'updateSiteBranding', tenantId: 'tenant-1', body })
})

test('only PLATFORM_ADMIN can PUT Business Profile and the route forwards tenantId and body', async () => {
  const path = '/tenants/tenant-1/site/profile'
  const body = { description: 'Public description', serviceAreas: ['Denver'] }
  assert.equal((await request(path, { method: 'PUT', body })).status, 401)
  for (const userId of ['staff', 'admin', 'owner', 'ordinary']) {
    assert.equal((await request(path, { userId, method: 'PUT', body })).status, 403)
  }
  const response = await request(path, { userId: 'platform', method: 'PUT', body })
  assert.equal(response.status, 200)
  assert.deepEqual(calls.at(-1), { operation: 'updateBusinessProfile', tenantId: 'tenant-1', body })
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

test('only PLATFORM_ADMIN can PUT Gallery and the route forwards tenantId and body', async () => {
  const path = '/tenants/tenant-1/site/pages/home/sections/gallery'
  const body = { title: 'Gallery', items: [{ mediaId: 'media-1', altText: 'Project' }] }
  assert.equal((await request(path, { method: 'PUT', body })).status, 401)
  for (const userId of ['staff', 'admin', 'owner', 'ordinary']) {
    assert.equal((await request(path, { userId, method: 'PUT', body })).status, 403)
  }
  const response = await request(path, { userId: 'platform', method: 'PUT', body })
  assert.equal(response.status, 200)
  assert.deepEqual(calls.at(-1), { operation: 'upsertHomeGallery', tenantId: 'tenant-1', body })
})

test('only PLATFORM_ADMIN can PUT Testimonials and the route forwards tenantId and body', async () => {
  const path = '/tenants/tenant-1/site/pages/home/sections/testimonials'
  const body = { title: 'Testimonials', items: [{ customerName: 'Jane', quote: 'Excellent work.' }] }
  assert.equal((await request(path, { method: 'PUT', body })).status, 401)
  for (const userId of ['staff', 'admin', 'owner', 'ordinary']) {
    assert.equal((await request(path, { userId, method: 'PUT', body })).status, 403)
  }
  const response = await request(path, { userId: 'platform', method: 'PUT', body })
  assert.equal(response.status, 200)
  assert.deepEqual(calls.at(-1), {
    operation: 'upsertHomeTestimonials', tenantId: 'tenant-1', body
  })
})

test('only PLATFORM_ADMIN can PUT Home composition and the route forwards tenantId and body', async () => {
  const path = '/tenants/tenant-1/site/pages/home/composition'
  const body = { sectionIds: ['hero', 'testimonials', 'contact'] }
  assert.equal((await request(path, { method: 'PUT', body })).status, 401)
  for (const userId of ['staff', 'admin', 'owner', 'ordinary']) {
    assert.equal((await request(path, { userId, method: 'PUT', body })).status, 403)
  }
  const response = await request(path, { userId: 'platform', method: 'PUT', body })
  assert.equal(response.status, 200)
  assert.deepEqual(calls.at(-1), { operation: 'composeHomeSections', tenantId: 'tenant-1', body })
})

test('only PLATFORM_ADMIN can list and upload tenant Media with no-store', async () => {
  for (const userId of ['staff', 'admin', 'owner', 'ordinary']) {
    assert.equal((await request('/tenants/tenant-1/media', { userId })).status, 403)
    const deniedForm = new FormData()
    deniedForm.append('file', new Blob(['image'], { type: 'image/png' }), 'image.png')
    assert.equal((await request('/tenants/tenant-1/media', {
      userId, method: 'POST', body: deniedForm
    })).status, 403)
  }

  const listed = await request('/tenants/tenant-1/media', { userId: 'platform' })
  assert.equal(listed.status, 200)
  assert.equal(listed.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await listed.json(), { media: [], hasMore: false })

  const form = new FormData()
  form.append('file', new Blob(['image'], { type: 'image/png' }), 'image.png')
  const uploaded = await request('/tenants/tenant-1/media', {
    userId: 'platform', method: 'POST', body: form
  })
  assert.equal(uploaded.status, 201)
  assert.equal(uploaded.headers.get('cache-control'), 'no-store')
  assert.equal((await uploaded.json()).id, 'media-1')
  assert.deepEqual(calls.at(-1), {
    operation: 'createMedia',
    tenantId: 'tenant-1',
    actorUserId: 'platform',
    file: { originalname: 'image.png', mimetype: 'image/png', size: 5 }
  })
})

test('Media upload rejects files over 10 MB with 413 before the service', async () => {
  const callsBefore = calls.length
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], {
    type: 'image/png'
  }), 'large.png')
  const response = await request('/tenants/tenant-1/media', {
    userId: 'platform', method: 'POST', body: form
  })
  assert.equal(response.status, 413)
  assert.deepEqual(await response.json(), { error: 'Image must be 10 MB or smaller' })
  assert.equal(calls.length, callsBefore)
})

test('lead list and detail allow every tenant read role and PLATFORM_ADMIN', async () => {
  for (const userId of ['staff', 'admin', 'owner', 'platform']) {
    const list = await request('/tenants/tenant-1/leads', { userId })
    assert.equal(list.status, 200)
    assert.deepEqual(await list.json(), { leads: [leadSummary], hasMore: false })
    assert.equal(list.headers.get('cache-control'), 'no-store')

    const detail = await request('/tenants/tenant-1/leads/lead-1', { userId })
    assert.equal(detail.status, 200)
    assert.deepEqual(await detail.json(), { ...leadSummary, message: 'Hello' })
  }
})

test('lead reads reject unauthenticated, non-member, and cross-tenant users', async () => {
  for (const path of ['/tenants/tenant-1/leads', '/tenants/tenant-1/leads/lead-1']) {
    assert.equal((await request(path)).status, 401)
    assert.equal((await request(path, { userId: 'ordinary' })).status, 403)
    assert.equal((await request(path, { userId: 'other-member' })).status, 403)
  }
})

test('lead routes preserve tenant and lead not-found distinctions after authorization', async () => {
  const missingList = await request('/tenants/missing/leads', { userId: 'platform' })
  assert.equal(missingList.status, 404)
  assert.deepEqual(await missingList.json(), { error: 'Tenant not found' })

  const missingTenantDetail = await request('/tenants/missing/leads/some-lead', { userId: 'platform' })
  assert.equal(missingTenantDetail.status, 404)
  assert.deepEqual(await missingTenantDetail.json(), { error: 'Tenant not found' })

  const missingLead = await request('/tenants/tenant-1/leads/missing', { userId: 'platform' })
  assert.equal(missingLead.status, 404)
  assert.deepEqual(await missingLead.json(), { error: 'Lead not found' })

  assert.equal((await request('/tenants/missing/leads', { userId: 'ordinary' })).status, 403)
})

test('lead status PATCH allows every tenant role and PLATFORM_ADMIN with no-store', async () => {
  const body = { status: 'CONTACTED', expectedUpdatedAt: 10, ignored: true }
  for (const userId of ['staff', 'admin', 'owner', 'platform']) {
    const response = await request('/tenants/tenant-1/leads/lead-1', {
      userId, method: 'PATCH', body
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal((await response.json()).status, 'CONTACTED')
    assert.deepEqual(calls.at(-1), {
      operation: 'updateLeadStatus', tenantId: 'tenant-1', leadId: 'lead-1', body
    })
  }
})

test('lead status PATCH rejects unauthenticated, non-member, and cross-tenant users', async () => {
  const options = { method: 'PATCH', body: { status: 'CONTACTED', expectedUpdatedAt: 10 } }
  assert.equal((await request('/tenants/tenant-1/leads/lead-1', options)).status, 401)
  for (const userId of ['ordinary', 'other-member']) {
    assert.equal((await request('/tenants/tenant-1/leads/lead-1', {
      ...options, userId
    })).status, 403)
  }
})

test('lead status PATCH preserves tenant and lead not-found distinctions', async () => {
  const options = {
    userId: 'platform', method: 'PATCH', body: { status: 'CONTACTED', expectedUpdatedAt: 10 }
  }
  const missingTenant = await request('/tenants/missing/leads/lead-1', options)
  assert.equal(missingTenant.status, 404)
  assert.deepEqual(await missingTenant.json(), { error: 'Tenant not found' })

  const missingLead = await request('/tenants/tenant-1/leads/missing', options)
  assert.equal(missingLead.status, 404)
  assert.deepEqual(await missingLead.json(), { error: 'Lead not found' })
})

test('lead Note GET and POST allow every tenant role and PLATFORM_ADMIN', async () => {
  for (const userId of ['staff', 'admin', 'owner', 'platform']) {
    const list = await request('/tenants/tenant-1/leads/lead-1/notes', { userId })
    assert.equal(list.status, 200)
    assert.equal(list.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await list.json(), { notes: [], hasMore: false })

    const body = { text: 'Called customer.', createdByUserId: 'spoofed' }
    const created = await request('/tenants/tenant-1/leads/lead-1/notes', {
      userId, method: 'POST', body
    })
    assert.equal(created.status, 201)
    assert.equal(created.headers.get('cache-control'), 'no-store')
    assert.equal((await created.json()).createdByUserId, userId)
    assert.deepEqual(calls.at(-1), {
      operation: 'createLeadNote', tenantId: 'tenant-1', leadId: 'lead-1', body, actorUserId: userId
    })
  }
})

test('lead Note routes reject unauthenticated, non-member, and cross-tenant users', async () => {
  for (const method of ['GET', 'POST']) {
    const options = { method, body: method === 'POST' ? { text: 'Note' } : undefined }
    const path = '/tenants/tenant-1/leads/lead-1/notes'
    assert.equal((await request(path, options)).status, 401)
    for (const userId of ['ordinary', 'other-member']) {
      assert.equal((await request(path, { ...options, userId })).status, 403)
    }
  }
})

test('lead Note routes preserve tenant and lead not-found distinctions', async () => {
  for (const method of ['GET', 'POST']) {
    const options = {
      userId: 'platform', method, body: method === 'POST' ? { text: 'Note' } : undefined
    }
    const missingTenant = await request('/tenants/missing/leads/lead-1/notes', options)
    assert.equal(missingTenant.status, 404)
    assert.deepEqual(await missingTenant.json(), { error: 'Tenant not found' })

    const missingLead = await request('/tenants/tenant-1/leads/missing/notes', options)
    assert.equal(missingLead.status, 404)
    assert.deepEqual(await missingLead.json(), { error: 'Lead not found' })
  }
})
