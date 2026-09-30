import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cookieParser from 'cookie-parser'
import { createAccountRouter } from '../routes/account.js'
import { isAuthenticated } from '../routes/auth.js'
import { noStore } from '../middleware/contentSecurity.js'
import { csrfProtection } from '../middleware/security.js'
import { FakeDb } from './helpers/fakeDb.js'
import realApp from '../app.js'

const seedUser = () => ({
  id: 'user-1',
  displayName: 'Baker Rang',
  email: 'baker@example.test',
  emailLower: 'baker@example.test',
  photo: 'https://example.test/photo.png',
  platformRole: 'PLATFORM_ADMIN',
  preferences: { locale: 'en' }
})
const vaultSettings = () => ({ settings: { autoLockMs: 900000, inlineAutofill: true }, kdf: { algo: 'argon2id' } })

const firestore = new FakeDb()
  .seed('users/user-1', seedUser())
  .seed('vaults/user-1', vaultSettings())
  .seed('licenses/user-1', { licenses: ['dormant-license'] })

const mount = (database) => {
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    const userId = req.get('x-test-user')
    req.user = userId ? { id: userId } : undefined
    req.isAuthenticated = () => Boolean(req.user)
    next()
  })
  app.use('/account', noStore, isAuthenticated, createAccountRouter({ firestore: database }))
  return app
}

const listen = async (app) => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` }
}
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))

let server
let baseUrl

before(async () => {
  ({ server, baseUrl } = await listen(mount(firestore)))
})

after(async () => close(server))

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
  ...options,
  headers: {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(options.userId ? { 'x-test-user': options.userId } : {})
  },
  body: options.body ? JSON.stringify(options.body) : undefined
})

test('account preferences require authentication and even the 401 is no-store', async () => {
  const get = await request('/account/preferences')
  assert.equal(get.status, 401)
  assert.equal(get.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await get.json(), { isAuthenticated: false, message: 'User not authenticated' })
  const put = await request('/account/preferences', { method: 'PUT', body: { theme: 'dark' } })
  assert.equal(put.status, 401)
  assert.equal(put.headers.get('cache-control'), 'no-store')
})

test('GET omits theme until an explicit preference is stored and never returns unknown keys', async () => {
  const response = await request('/account/preferences', { userId: 'user-1' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), {})
})

test('PUT accepts each locked theme value and GET reads fresh Firestore data', async () => {
  for (const theme of ['light', 'dark', 'system']) {
    const put = await request('/account/preferences', {
      userId: 'user-1', method: 'PUT', body: { theme }
    })
    assert.equal(put.status, 200)
    assert.equal(put.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await put.json(), { theme })

    const get = await request('/account/preferences', { userId: 'user-1' })
    assert.deepEqual(await get.json(), { theme })
  }
})

test('PUT rejects invalid, missing, and unrelated preference fields', async () => {
  for (const body of [
    {},
    { theme: 'midnight' },
    { theme: null },
    { theme: 'dark', locale: 'fr' },
    { theme: 'dark', licenses: ['x'] },
    { theme: 'dark', autoLockMs: 1 }
  ]) {
    const response = await request('/account/preferences', {
      userId: 'user-1', method: 'PUT', body
    })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'theme must be light, dark, or system' })
  }
})

test('coexistence: a theme write changes only preferences.theme', async () => {
  firestore.seed('users/user-1', seedUser())
  await request('/account/preferences', {
    userId: 'user-1', method: 'PUT', body: { theme: 'light' }
  })

  // Profile, role, sibling preference keys.
  assert.deepEqual(firestore.data('users/user-1'), { ...seedUser(), preferences: { locale: 'en', theme: 'light' } })
  // Passwords-owned settings (a different document) are untouched.
  assert.deepEqual(firestore.data('vaults/user-1'), vaultSettings())
  // Dormant Supermarket data is neither read nor written by Account.
  assert.deepEqual(firestore.data('licenses/user-1'), { licenses: ['dormant-license'] })
  // Unknown stored keys are preserved but never returned.
  const get = await request('/account/preferences', { userId: 'user-1' })
  assert.deepEqual(await get.json(), { theme: 'light' })
})

test('coexistence: a preferences write for a user without a document creates only the theme', async () => {
  await request('/account/preferences', { userId: 'user-2', method: 'PUT', body: { theme: 'dark' } })
  assert.deepEqual(firestore.data('users/user-2'), { preferences: { theme: 'dark' } })
})

test('concurrent theme writes from two apps leave one valid choice and every sibling key', async () => {
  firestore.seed('users/user-3', { ...seedUser(), id: 'user-3' })
  const results = await Promise.all(['dark', 'light', 'system', 'dark'].map((theme) =>
    request('/account/preferences', { userId: 'user-3', method: 'PUT', body: { theme } })))
  assert.deepEqual(results.map((response) => response.status), [200, 200, 200, 200])
  const stored = firestore.data('users/user-3')
  assert.ok(['light', 'dark', 'system'].includes(stored.preferences.theme))
  assert.equal(stored.preferences.locale, 'en')
  assert.equal(stored.platformRole, 'PLATFORM_ADMIN')
})

test('5xx answers a fixed body and logs only {code, name}', async (t) => {
  const secret = 'user-1@example.test super-secret-provider-detail'
  const failing = {
    collection: () => ({
      doc: () => ({ get: async () => { throw Object.assign(new TypeError(secret), { code: 14 }) } })
    }),
    runTransaction: async () => { throw Object.assign(new RangeError(secret), { code: 10 }) }
  }
  const logged = []
  t.mock.method(console, 'error', (...args) => logged.push(args))
  const { server: failingServer, baseUrl: failingUrl } = await listen(mount(failing))
  try {
    const get = await fetch(`${failingUrl}/account/preferences`, { headers: { 'x-test-user': 'user-1' } })
    assert.equal(get.status, 500)
    assert.equal(get.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await get.json(), { error: 'Account request failed' })
    const put = await fetch(`${failingUrl}/account/preferences`, {
      method: 'PUT', headers: { 'x-test-user': 'user-1', 'content-type': 'application/json' }, body: JSON.stringify({ theme: 'dark' })
    })
    assert.equal(put.status, 500)
    assert.deepEqual(await put.json(), { error: 'Account request failed' })
  } finally {
    await close(failingServer)
  }
  assert.deepEqual(logged, [
    ['[account] preferences-get failed', { code: 14, name: 'TypeError' }],
    ['[account] preferences-put failed', { code: 10, name: 'RangeError' }]
  ])
  assert.equal(JSON.stringify(logged).includes(secret), false)
})

test('the real app mounts /account behind noStore and the account limiter (300 per window)', async () => {
  const { server: appServer, baseUrl: appUrl } = await listen(realApp)
  try {
    const response = await fetch(`${appUrl}/account/preferences`)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('ratelimit-limit'), '300')
    // Voice management is no-store even when the request is rejected before its router runs.
    const voices = await fetch(`${appUrl}/text/to/speech/v1/voices`)
    assert.equal(voices.status, 401)
    assert.equal(voices.headers.get('cache-control'), 'no-store')
    const voice = await fetch(`${appUrl}/text/to/speech/v1/voice/abc`, { method: 'DELETE' })
    assert.equal(voice.headers.get('cache-control'), 'no-store')
  } finally {
    await close(appServer)
  }
})

test('a replayed PUT without the CSRF token is rejected before the route runs', async () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use((req, res, next) => { req.user = { id: 'user-1' }; req.isAuthenticated = () => true; req.sessionID = 'session-1'; next() })
  app.use(csrfProtection)
  app.use('/account', noStore, isAuthenticated, createAccountRouter({ firestore: new FakeDb() }))
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }))
  const { server: csrfServer, baseUrl: csrfUrl } = await listen(app)
  try {
    const response = await fetch(`${csrfUrl}/account/preferences`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: 'dark' })
    })
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { code: 'EBADCSRFTOKEN' })
  } finally {
    await close(csrfServer)
  }
})
