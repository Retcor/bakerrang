import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cors from 'cors'
import {
  buildAllowedOrigins,
  createCorsOptionsDelegate,
  isActiveCustomSiteOrigin,
  isOriginAllowed
} from '../config/origins.js'

test('CORS allowlist includes client, portal, renderer, and chatbot origins', () => {
  const origins = buildAllowedOrigins({
    CLIENT_DOMAIN: 'http://localhost:3000',
    PORTAL_DOMAIN: 'http://localhost:3001',
    SITE_RENDERER_DOMAIN: 'http://localhost:3002',
    CHATBOT_ORIGIN: 'https://chat.example.com'
  })

  assert.deepEqual(origins, [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://chat.example.com'
  ])
  assert.equal(isOriginAllowed('http://localhost:3000', origins), true)
  assert.equal(isOriginAllowed('http://localhost:3001', origins), true)
  assert.equal(isOriginAllowed('http://localhost:3002', origins), true)
  assert.equal(isOriginAllowed('https://chat.example.com', origins), true)
  assert.equal(isOriginAllowed('https://unrelated.example.com', origins), false)
  assert.equal(isOriginAllowed(undefined, origins), true)
})

const allowedOrigins = buildAllowedOrigins({ SITE_RENDERER_DOMAIN: 'http://localhost:3002' })
const app = express()
app.use(cors({
  origin: (origin, callback) => isOriginAllowed(origin, allowedOrigins)
    ? callback(null, true)
    : callback(new Error('CORS rejected')),
  credentials: true
}))
app.post('/public/sites/:tenantId/leads', (req, res) => res.sendStatus(201))
app.use((error, req, res, next) => res.status(403).json({ error: error.message }))
const server = app.listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}`

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('renderer-origin JSON POST preflight succeeds and disallowed origins get no access', async () => {
  const allowed = await fetch(`${baseUrl}/public/sites/tenant-1/leads`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:3002',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type'
    }
  })
  assert.equal(allowed.status, 204)
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3002')
  assert.match(allowed.headers.get('access-control-allow-methods'), /POST/)

  const denied = await fetch(`${baseUrl}/public/sites/tenant-1/leads`, {
    method: 'OPTIONS',
    headers: {
      origin: 'https://unrelated.example.com',
      'access-control-request-method': 'POST'
    }
  })
  assert.equal(denied.status, 403)
  assert.equal(denied.headers.has('access-control-allow-origin'), false)
})

test('custom origin validation requires an ACTIVE canonical registry result for the target tenant', async () => {
  const resolve = async (hostname) => {
    if (hostname === 'active.example') {
      return { tenantId: 'tenant-1', canonicalHost: 'active.example' }
    }
    throw Object.assign(new Error('Domain not found'), { status: 404 })
  }
  assert.equal(await isActiveCustomSiteOrigin('https://active.example', resolve, 'tenant-1', {
    NODE_ENV: 'production'
  }), true)
  assert.equal(await isActiveCustomSiteOrigin('https://active.example', resolve, 'tenant-2', {
    NODE_ENV: 'production'
  }), false)
  assert.equal(await isActiveCustomSiteOrigin('https://inactive.example', resolve, 'tenant-1', {
    NODE_ENV: 'production'
  }), false)
  assert.equal(await isActiveCustomSiteOrigin('http://active.example', resolve, 'tenant-1', {
    NODE_ENV: 'production'
  }), false)
  assert.equal(await isActiveCustomSiteOrigin('https://active.example:8443', resolve, 'tenant-1', {
    NODE_ENV: 'production'
  }), false)
  assert.equal(await isActiveCustomSiteOrigin('https://active.example/path', resolve, 'tenant-1', {
    NODE_ENV: 'production'
  }), false)
})

test('custom-domain CORS is exact-route scoped, tenant-bound, and preserves static origins', async () => {
  const domainStates = new Map([
    ['active-a.example', { tenantId: 'tenant-a', status: 'ACTIVE' }],
    ['pending.example', { tenantId: 'tenant-a', status: 'PENDING_VERIFICATION' }],
    ['verified.example', { tenantId: 'tenant-a', status: 'VERIFIED' }],
    ['disabled.example', { tenantId: 'tenant-a', status: 'DISABLED' }]
  ])
  let resolverCalls = 0
  const resolveActiveDomain = async (hostname) => {
    resolverCalls += 1
    const record = domainStates.get(hostname)
    if (!record || record.status !== 'ACTIVE') {
      throw Object.assign(new Error('Domain not found'), { status: 404 })
    }
    return { tenantId: record.tenantId, canonicalHost: hostname }
  }
  const scopedApp = express()
  scopedApp.use(cors(createCorsOptionsDelegate({
    allowedOrigins: ['https://portal.example'],
    resolveActiveDomain,
    env: { NODE_ENV: 'production' }
  })))
  scopedApp.use(express.json())
  scopedApp.post('/public/sites/:tenantId/leads', (req, res) => res.sendStatus(201))
  scopedApp.get('/tenants/:tenantId', (req, res) => res.json({ id: req.params.tenantId }))
  scopedApp.get('/public/sites/:tenantId', (req, res) => res.json({ id: req.params.tenantId }))
  scopedApp.use((error, req, res, next) => res.status(403).json({ error: error.message }))
  const scopedServer = scopedApp.listen(0, '127.0.0.1')
  await new Promise((resolve) => scopedServer.once('listening', resolve))
  const scopedBaseUrl = `http://127.0.0.1:${scopedServer.address().port}`

  try {
    const matching = await fetch(`${scopedBaseUrl}/public/sites/tenant-a/leads`, {
      method: 'POST', headers: { origin: 'https://active-a.example', 'content-type': 'application/json' }, body: '{}'
    })
    assert.equal(matching.status, 201)
    assert.equal(matching.headers.get('access-control-allow-origin'), 'https://active-a.example')

    const mismatched = await fetch(`${scopedBaseUrl}/public/sites/tenant-b/leads`, {
      method: 'POST', headers: { origin: 'https://active-a.example', 'content-type': 'application/json' }, body: '{}'
    })
    assert.equal(mismatched.status, 403)
    assert.equal(mismatched.headers.has('access-control-allow-origin'), false)

    resolverCalls = 0
    for (const path of ['/tenants/tenant-a', '/public/sites/tenant-a']) {
      const unrelated = await fetch(`${scopedBaseUrl}${path}`, {
        headers: { origin: 'https://active-a.example' }
      })
      assert.equal(unrelated.status, 403)
      assert.equal(unrelated.headers.has('access-control-allow-origin'), false)
    }
    const arbitrary = await fetch(`${scopedBaseUrl}/tenants/tenant-a`, {
      headers: { origin: 'https://random-example.com' }
    })
    assert.equal(arbitrary.status, 403)
    assert.equal(resolverCalls, 0)

    for (const hostname of [
      'pending.example', 'verified.example', 'disabled.example', 'removed.example'
    ]) {
      const denied = await fetch(`${scopedBaseUrl}/public/sites/tenant-a/leads`, {
        method: 'POST', headers: { origin: `https://${hostname}`, 'content-type': 'application/json' }, body: '{}'
      })
      assert.equal(denied.status, 403)
      assert.equal(denied.headers.has('access-control-allow-origin'), false)
    }

    for (const origin of [
      'http://active-a.example',
      'https://active-a.example:8443',
      'https://active-a.example/path',
      'https://user@active-a.example',
      'not an origin'
    ]) {
      const denied = await fetch(`${scopedBaseUrl}/public/sites/tenant-a/leads`, {
        method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}'
      })
      assert.equal(denied.status, 403)
      assert.equal(denied.headers.has('access-control-allow-origin'), false)
    }

    resolverCalls = 0
    const firstParty = await fetch(`${scopedBaseUrl}/tenants/tenant-a`, {
      headers: { origin: 'https://portal.example' }
    })
    assert.equal(firstParty.status, 200)
    assert.equal(firstParty.headers.get('access-control-allow-origin'), 'https://portal.example')
    assert.equal(resolverCalls, 0)

    const validPreflight = await fetch(`${scopedBaseUrl}/public/sites/tenant-a/leads`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://active-a.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    })
    assert.equal(validPreflight.status, 204)
    assert.equal(validPreflight.headers.get('access-control-allow-origin'), 'https://active-a.example')

    const mismatchPreflight = await fetch(`${scopedBaseUrl}/public/sites/tenant-b/leads`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://active-a.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    })
    assert.equal(mismatchPreflight.status, 403)
    assert.equal(mismatchPreflight.headers.has('access-control-allow-origin'), false)
  } finally {
    await new Promise((resolve, reject) => scopedServer.close((error) => error ? reject(error) : resolve()))
  }
})
