import assert from 'node:assert/strict'
import test from 'node:test'
import { validateServerRuntimeConfig } from '../config/runtimeConfig.js'

const validEnv = {
  FIRESTORE_PROJECT_ID: 'bakerrang-dev',
  GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  LAUNCHER_DOMAIN: 'https://launch-dev.bakerrang.com',
  SERVER_DOMAIN: 'https://api-dev.bakerrang.com',
  SESSION_SECRET: 'session-secret'
}

test('server runtime validation returns only safe normalized identifiers', () => {
  assert.deepEqual(validateServerRuntimeConfig({
    ...validEnv,
    FIRESTORE_PROJECT_ID: ' bakerrang-dev '
  }), {
    firestoreProjectId: 'bakerrang-dev',
    serverOrigin: 'https://api-dev.bakerrang.com'
  })
})

test('server runtime validation fails clearly for each required value', () => {
  for (const name of [
    'FIRESTORE_PROJECT_ID',
    'SESSION_SECRET',
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'SERVER_DOMAIN'
  ]) {
    assert.throws(
      () => validateServerRuntimeConfig({ ...validEnv, [name]: '   ' }),
      new RegExp(`${name} is (?:required|not set)`)
    )
  }
  assert.throws(
    () => validateServerRuntimeConfig({ ...validEnv, SERVER_DOMAIN: 'api-dev.bakerrang.com/path' }),
    /SERVER_DOMAIN must be a valid absolute HTTP\/HTTPS origin/
  )
})

test('launcher origin is optional but validated when configured', () => {
  assert.doesNotThrow(() => validateServerRuntimeConfig({ ...validEnv, LAUNCHER_DOMAIN: undefined }))
  assert.doesNotThrow(() => validateServerRuntimeConfig({ ...validEnv, LAUNCHER_DOMAIN: '   ' }))
  assert.throws(
    () => validateServerRuntimeConfig({ ...validEnv, LAUNCHER_DOMAIN: 'launch.example.com/path' }),
    /LAUNCHER_DOMAIN must be a valid absolute HTTP\/HTTPS origin/
  )
})

test('production no longer requires the retired platform secrets', () => {
  assert.doesNotThrow(() => validateServerRuntimeConfig({ ...validEnv, NODE_ENV: 'production' }))
})
