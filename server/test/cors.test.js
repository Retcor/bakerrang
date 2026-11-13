import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cors from 'cors'
import {
  buildAllowedOrigins,
  createCorsOptionsDelegate,
  isOriginAllowed
} from '../config/origins.js'

test('CORS allowlist includes the web app origins and the chatbot origin', () => {
  const origins = buildAllowedOrigins({
    LAUNCHER_DOMAIN: 'https://launch.bakerrang.com',
    STORYBOOK_DOMAIN: 'https://storybook.bakerrang.com',
    POLYGLOT_DOMAIN: 'https://polyglot.bakerrang.com',
    SIGN_DOMAIN: 'https://sign.bakerrang.com',
    BUDGET_DOMAIN: 'https://budget.bakerrang.com',
    PASSWORDS_DOMAIN: 'https://passwords.bakerrang.com',
    ACCOUNT_DOMAIN: 'https://account.bakerrang.com',
    CHATBOT_ORIGIN: 'https://chat.example.com'
  })

  assert.deepEqual(origins, [
    'https://launch.bakerrang.com',
    'https://storybook.bakerrang.com',
    'https://polyglot.bakerrang.com',
    'https://sign.bakerrang.com',
    'https://budget.bakerrang.com',
    'https://passwords.bakerrang.com',
    'https://account.bakerrang.com',
    'https://chat.example.com'
  ])
  for (const origin of origins) assert.equal(isOriginAllowed(origin, origins), true)
  assert.equal(isOriginAllowed('https://bakerrang.com', origins), false)
  assert.equal(isOriginAllowed('https://unrelated.example.com', origins), false)
  assert.equal(isOriginAllowed(undefined, origins), true)
})

test('retired legacy client and platform origins are no longer allowlisted', () => {
  const origins = buildAllowedOrigins({
    CLIENT_DOMAIN: 'https://bakerrang.com',
    PORTAL_DOMAIN: 'https://portal.bakerrang.com',
    SITE_RENDERER_DOMAIN: 'https://sites.bakerrang.com'
  })
  assert.deepEqual(origins, [])
})

const allowedOrigins = buildAllowedOrigins({ LAUNCHER_DOMAIN: 'https://launch.bakerrang.com' })
const app = express()
app.use(cors(createCorsOptionsDelegate({ allowedOrigins })))
app.get('/health', (req, res) => res.sendStatus(200))
app.use((error, req, res, next) => res.status(403).json({ error: error.message }))
const server = app.listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}`
after(() => server.close())

test('CORS delegate allows configured origins with credentials and rejects others', async () => {
  const allowed = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://launch.bakerrang.com' } })
  assert.equal(allowed.status, 200)
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://launch.bakerrang.com')
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true')

  const denied = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://evil.example' } })
  assert.equal(denied.status, 403)
  assert.equal(denied.headers.get('access-control-allow-origin'), null)
})
