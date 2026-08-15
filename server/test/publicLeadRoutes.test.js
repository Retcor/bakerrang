import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { csrfProtection } from '../middleware/security.js'
import { createPublicLeadRouter } from '../routes/publicLeads.js'

let server
let baseUrl
let limiterCalls = 0
const serviceCalls = []

const error = (status, message) => Object.assign(new Error(message), { status })
const service = {
  createPublicLead: async (tenantId, body) => {
    serviceCalls.push({ tenantId, body })
    if (tenantId === 'invalid') throw error(400, 'Lead name is required')
    if (tenantId === 'missing') throw error(404, 'Site not found')
    return { success: true }
  }
}

before(async () => {
  const app = express()
  app.use((req, res, next) => {
    req.isAuthenticated = () => false
    next()
  })
  app.use(csrfProtection)
  app.use('/public', createPublicLeadRouter({
    leadService: service,
    publicLeadLimiter: (req, res, next) => {
      limiterCalls += 1
      next()
    }
  }))
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

const post = (tenantId, body) => fetch(`${baseUrl}/public/sites/${tenantId}/leads`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
})

test('anonymous lead route needs no session or CSRF token and returns minimal success', async () => {
  const response = await post('tenant-1', { name: 'Visitor' })
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { success: true })
  assert.deepEqual(serviceCalls.at(-1), {
    tenantId: 'tenant-1', body: { name: 'Visitor' }
  })
  assert.equal(limiterCalls, 1)
})

test('public lead route preserves validation and eligibility statuses', async () => {
  const invalid = await post('invalid', {})
  assert.equal(invalid.status, 400)
  assert.deepEqual(await invalid.json(), { error: 'Lead name is required' })
  const missing = await post('missing', {})
  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { error: 'Site not found' })
})

test('public lead router remains write-only', async () => {
  const response = await fetch(`${baseUrl}/public/sites/tenant-1/leads`)
  assert.equal(response.status, 404)
})

test('public lead route bounds anonymous JSON bodies at 16 KB', async () => {
  const callsBefore = serviceCalls.length
  const response = await post('tenant-1', { message: 'x'.repeat(17 * 1024) })
  assert.equal(response.status, 413)
  assert.deepEqual(await response.json(), { error: 'Request body too large' })
  assert.equal(serviceCalls.length, callsBefore)
})

test('public lead limiter allows ten hourly attempts per client and tenant', async () => {
  const limitedApp = express()
  limitedApp.use('/public', createPublicLeadRouter({ leadService: service }))
  const limitedServer = limitedApp.listen(0, '127.0.0.1')
  await new Promise((resolve) => limitedServer.once('listening', resolve))
  const limitedBaseUrl = `http://127.0.0.1:${limitedServer.address().port}`
  const limitedPost = (tenantId) => fetch(`${limitedBaseUrl}/public/sites/${tenantId}/leads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  })

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal((await limitedPost('rate-tenant')).status, 201)
    }
    assert.equal((await limitedPost('rate-tenant')).status, 429)
    assert.equal((await limitedPost('other-tenant')).status, 201)
  } finally {
    await new Promise((resolve, reject) => limitedServer.close((error) => error ? reject(error) : resolve()))
  }
})
