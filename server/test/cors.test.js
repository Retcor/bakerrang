import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cors from 'cors'
import { buildAllowedOrigins, isOriginAllowed } from '../config/origins.js'

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
