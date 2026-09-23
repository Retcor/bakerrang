import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createAccountRouter } from '../routes/account.js'
import { isAuthenticated } from '../routes/auth.js'
import { FakeDb } from './helpers/fakeDb.js'

const firestore = new FakeDb().seed('users/user-1', {
  id: 'user-1',
  displayName: 'Baker Rang',
  platformRole: 'PLATFORM_ADMIN',
  preferences: { locale: 'en' }
})

const app = express()
app.use(express.json())
app.use((req, res, next) => {
  const userId = req.get('x-test-user')
  req.user = userId ? { id: userId } : undefined
  req.isAuthenticated = () => Boolean(req.user)
  next()
})
app.use('/account', isAuthenticated, createAccountRouter({ firestore }))
app.use((error, req, res, next) => res.status(500).json({ error: error.message }))

let server
let baseUrl

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
  ...options,
  headers: {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(options.userId ? { 'x-test-user': options.userId } : {})
  },
  body: options.body ? JSON.stringify(options.body) : undefined
})

test('account preferences require authentication', async () => {
  assert.equal((await request('/account/preferences')).status, 401)
  assert.equal((await request('/account/preferences', {
    method: 'PUT', body: { theme: 'dark' }
  })).status, 401)
})

test('GET omits theme until an explicit preference is stored', async () => {
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
    { theme: 'dark', locale: 'fr' }
  ]) {
    const response = await request('/account/preferences', {
      userId: 'user-1', method: 'PUT', body
    })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'theme must be light, dark, or system' })
  }
})

test('preference writes merge without erasing profile, role, or sibling preferences', async () => {
  await request('/account/preferences', {
    userId: 'user-1', method: 'PUT', body: { theme: 'light' }
  })

  assert.deepEqual(firestore.data('users/user-1'), {
    id: 'user-1',
    displayName: 'Baker Rang',
    platformRole: 'PLATFORM_ADMIN',
    preferences: { locale: 'en', theme: 'light' }
  })
})
