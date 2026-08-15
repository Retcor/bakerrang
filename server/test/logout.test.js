import test from 'node:test'
import assert from 'node:assert/strict'
import authRouter, { logoutHandler } from '../routes/auth.js'
import { csrfProtection } from '../middleware/security.js'

const response = () => ({
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
})

test('GET and POST logout routes share the same logout handler', () => {
  const logoutRoutes = authRouter.stack
    .filter((layer) => layer.route && layer.route.path === '/logout')

  assert.deepEqual(logoutRoutes.map((layer) => Object.keys(layer.route.methods)), [
    ['get'],
    ['post']
  ])
  assert.equal(logoutRoutes[0].route.stack[0].handle, logoutHandler)
  assert.equal(logoutRoutes[1].route.stack[0].handle, logoutHandler)
})

test('logout handler invokes Passport logout semantics', () => {
  const res = response()
  let called = false
  logoutHandler({
    logout (callback) {
      called = true
      callback()
    }
  }, res)

  assert.equal(called, true)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { message: 'Logged out successfully!' })
})

test('authenticated POST logout is not skipped by CSRF middleware', () => {
  let nextError
  csrfProtection({
    method: 'POST',
    path: '/auth/logout',
    headers: {},
    cookies: {},
    sessionID: 'session-1',
    isAuthenticated: () => true
  }, response(), (error) => { nextError = error })

  assert.ok(nextError)
  assert.equal(nextError.code, 'EBADCSRFTOKEN')
})
