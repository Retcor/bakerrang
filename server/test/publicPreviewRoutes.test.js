import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createPublicSiteRouter } from '../routes/publicSites.js'
import { createPreviewToken, verifyPreviewToken } from '../services/previewTokenService.js'

let server
let baseUrl
const secret = 'preview-route-test-secret'
const now = 1_800_000_000_000
const calls = []
const definition = {
  status: 'DRAFT',
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [] }]
}

before(async () => {
  const app = express()
  app.use('/public', createPublicSiteRouter({
    previewTokenService: {
      verifyPreviewToken: (token) => verifyPreviewToken(token, { secret, now })
    },
    siteService: {
      getSite: async (tenantId) => {
        calls.push(tenantId)
        if (tenantId === 'missing') {
          throw Object.assign(new Error('Site not found'), { status: 404 })
        }
        return definition
      },
      getPublicSite: async () => ({ status: 'PUBLISHED' }),
      getPublishedSiteDefinition: async () => ({ status: 'PUBLISHED' })
    },
    siteDomainService: {
      resolveActiveDomain: async () => null,
      getActiveDomainForTenant: async () => null
    }
  }))
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

const previewRequest = (tenantId, token) => fetch(`${baseUrl}/public/preview/${tenantId}`, {
  headers: token ? { authorization: `Bearer ${token}` } : {}
})

test('valid preview bearer returns the working definition with no-store', async () => {
  const { token } = createPreviewToken('tenant-1', { secret, now })
  const response = await previewRequest('tenant-1', token)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), definition)
})

test('missing, invalid, expired, and wrong-tenant preview bearers fail before site reads', async () => {
  const valid = createPreviewToken('tenant-1', { secret, now }).token
  const expired = createPreviewToken('tenant-1', {
    secret, now: now - (16 * 60 * 1000)
  }).token
  const beforeCalls = calls.length
  for (const [tenantId, token] of [
    ['tenant-1', undefined],
    ['tenant-1', 'invalid'],
    ['tenant-1', expired],
    ['tenant-2', valid]
  ]) {
    const response = await previewRequest(tenantId, token)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Preview authorization failed' })
  }
  assert.equal(calls.length, beforeCalls)
})

test('a valid token maps a missing working site to 404', async () => {
  const token = createPreviewToken('missing', { secret, now }).token
  const response = await previewRequest('missing', token)
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'Site not found' })
})

test('working preview reads are independent of ALLOW_DRAFT_PUBLIC_SITES', async () => {
  const original = process.env.ALLOW_DRAFT_PUBLIC_SITES
  process.env.ALLOW_DRAFT_PUBLIC_SITES = 'false'
  try {
    const token = createPreviewToken('tenant-1', { secret, now }).token
    assert.equal((await previewRequest('tenant-1', token)).status, 200)
  } finally {
    if (original === undefined) delete process.env.ALLOW_DRAFT_PUBLIC_SITES
    else process.env.ALLOW_DRAFT_PUBLIC_SITES = original
  }
})
