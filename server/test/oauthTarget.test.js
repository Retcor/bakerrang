import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GOOGLE_CALLBACK_AUTH_OPTIONS,
  createOAuthCallbackHandler,
  rememberOAuthTarget
} from '../routes/auth.js'
import {
  consumeOAuthTarget,
  isValidOAuthTarget,
  oauthTargetFromQuery,
  resolveOAuthTarget
} from '../config/oauthTargets.js'
import { buildGoogleStrategyOptions } from '../config/googleOAuth.js'

const env = {
  CLIENT_DOMAIN: 'http://localhost:3000',
  PORTAL_DOMAIN: 'http://localhost:3001'
}

const response = () => ({
  statusCode: 200,
  body: null,
  redirectUrl: null,
  status (statusCode) {
    this.statusCode = statusCode
    return this
  },
  json (body) {
    this.body = body
    return this
  },
  redirect (url) {
    this.redirectUrl = url
    return this
  }
})

test('OAuth targets are a closed symbolic set and never arbitrary URLs', () => {
  assert.equal(oauthTargetFromQuery(undefined), 'client')
  assert.equal(oauthTargetFromQuery('client'), 'client')
  assert.equal(oauthTargetFromQuery('portal'), 'portal')
  assert.equal(resolveOAuthTarget('client', env), env.CLIENT_DOMAIN)
  assert.equal(resolveOAuthTarget('portal', env), env.PORTAL_DOMAIN)
  assert.equal(isValidOAuthTarget('client'), true)
  assert.equal(isValidOAuthTarget('portal'), true)
  assert.equal(isValidOAuthTarget('https://evil.example'), false)
  assert.throws(() => oauthTargetFromQuery('https://evil.example'), { status: 400 })
  assert.throws(() => resolveOAuthTarget('https://evil.example', env), { status: 500 })
})

test('a valid target with missing configuration fails safely', async () => {
  const res = response()
  let saved = false
  let continued = false
  const originalError = console.error
  console.error = () => {}
  try {
    await rememberOAuthTarget({ CLIENT_DOMAIN: env.CLIENT_DOMAIN })({
      query: { target: 'portal' },
      session: { save: () => { saved = true } }
    }, res, () => { continued = true })
  } finally {
    console.error = originalError
  }

  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, { error: 'OAuth configuration error' })
  assert.equal(saved, false)
  assert.equal(continued, false)
})

test('login entry stores the target and saves the session before continuing to Google', async () => {
  const events = []
  const session = {
    save (callback) {
      events.push(`save:${this.oauthTarget}`)
      callback()
    }
  }
  await rememberOAuthTarget(env)({ query: { target: 'portal' }, session }, response(), () => {
    events.push('next')
  })

  assert.equal(session.oauthTarget, 'portal')
  assert.deepEqual(events, ['save:portal', 'next'])

  const defaultSession = {
    save (callback) { callback() }
  }
  await rememberOAuthTarget(env)({ query: {}, session: defaultSession }, response(), () => {})
  assert.equal(defaultSession.oauthTarget, 'client')
})

test('invalid login target returns 400 without saving or continuing', async () => {
  const res = response()
  let saved = false
  let continued = false
  await rememberOAuthTarget(env)({
    query: { target: 'javascript:alert(1)' },
    session: { save: () => { saved = true } }
  }, res, () => { continued = true })

  assert.equal(res.statusCode, 400)
  assert.equal(saved, false)
  assert.equal(continued, false)
})

test('callback consumes, clears, and persists target before redirecting', async () => {
  const events = []
  const session = {
    oauthTarget: 'portal',
    save (callback) {
      events.push(`save:${String(this.oauthTarget)}`)
      callback()
    }
  }
  const res = response()
  const handler = createOAuthCallbackHandler({
    env,
    storeUser: async () => { events.push('store-user') }
  })

  await handler({ user: { id: 'user-1' }, session }, res, () => {})

  assert.equal(session.oauthTarget, undefined)
  assert.equal(res.redirectUrl, env.PORTAL_DOMAIN)
  assert.deepEqual(events, ['store-user', 'save:undefined'])

  const defaultSession = { save: (callback) => callback() }
  const defaultRes = response()
  await handler({ user: { id: 'user-1' }, session: defaultSession }, defaultRes, () => {})
  assert.equal(defaultRes.redirectUrl, env.CLIENT_DOMAIN)
})

test('consumeOAuthTarget clears one-time state', () => {
  const session = { oauthTarget: 'portal', unrelated: true }
  assert.equal(consumeOAuthTarget(session, env), env.PORTAL_DOMAIN)
  assert.deepEqual(session, { unrelated: true })
})

test('Passport callback explicitly preserves pre-login session information', () => {
  assert.equal(GOOGLE_CALLBACK_AUTH_OPTIONS.keepSessionInfo, true)
})

test('Google strategy uses Passport OAuth2 session-backed state protection', () => {
  const options = buildGoogleStrategyOptions({
    GOOGLE_OAUTH_CLIENT_ID: 'client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
    SERVER_DOMAIN: 'http://localhost:8080'
  })
  assert.equal(options.state, true)
  assert.equal(options.callbackURL, 'http://localhost:8080/auth/google/callback')
})
