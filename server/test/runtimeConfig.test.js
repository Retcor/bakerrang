import assert from 'node:assert/strict'
import test from 'node:test'
import { validateServerRuntimeConfig } from '../config/runtimeConfig.js'

const validEnv = {
  CLIENT_DOMAIN: 'https://app-dev.bakerrang.com',
  FIRESTORE_PROJECT_ID: 'bakerrang-dev',
  GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  MEDIA_BUCKET_NAME: 'bakerrang-dev-media-marketing',
  PORTAL_DOMAIN: 'https://portal-dev.bakerrang.com',
  SERVER_DOMAIN: 'https://api-dev.bakerrang.com',
  SESSION_SECRET: 'session-secret',
  SITE_RENDERER_DOMAIN: 'https://sites-dev.bakerrang.com'
}

test('server runtime validation returns only safe normalized identifiers', () => {
  assert.deepEqual(validateServerRuntimeConfig({
    ...validEnv,
    FIRESTORE_PROJECT_ID: ' bakerrang-dev ',
    MEDIA_BUCKET_NAME: ' dev-media '
  }), {
    firestoreProjectId: 'bakerrang-dev',
    mediaBucketName: 'dev-media',
    serverOrigin: 'https://api-dev.bakerrang.com'
  })
})

test('server runtime validation fails clearly for each required value', () => {
  for (const name of [
    'FIRESTORE_PROJECT_ID',
    'MEDIA_BUCKET_NAME',
    'SESSION_SECRET',
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'SERVER_DOMAIN',
    'PORTAL_DOMAIN',
    'SITE_RENDERER_DOMAIN'
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

test('legacy client origin is optional but validated when configured', () => {
  const withoutClient = { ...validEnv }
  delete withoutClient.CLIENT_DOMAIN
  assert.doesNotThrow(() => validateServerRuntimeConfig(withoutClient))
  assert.doesNotThrow(() => validateServerRuntimeConfig({ ...validEnv, CLIENT_DOMAIN: undefined }))
  assert.doesNotThrow(() => validateServerRuntimeConfig({ ...validEnv, CLIENT_DOMAIN: '   ' }))
  assert.doesNotThrow(() => validateServerRuntimeConfig(validEnv))
  assert.throws(
    () => validateServerRuntimeConfig({ ...validEnv, CLIENT_DOMAIN: 'legacy-client.example.com/path' }),
    /CLIENT_DOMAIN must be a valid absolute HTTP\/HTTPS origin/
  )
})

test('preview signing remains required only in production', () => {
  assert.doesNotThrow(() => validateServerRuntimeConfig({ ...validEnv, NODE_ENV: 'development' }))
  assert.throws(
    () => validateServerRuntimeConfig({ ...validEnv, NODE_ENV: 'production' }),
    /PREVIEW_TOKEN_SECRET is not set/
  )
  assert.doesNotThrow(() => validateServerRuntimeConfig({
    ...validEnv,
    NODE_ENV: 'production',
    PREVIEW_TOKEN_SECRET: 'preview-secret',
    RESEND_API_KEY: 'resend-key',
    LEAD_NOTIFICATION_FROM: 'leads@example.com',
    INTERNAL_DRAIN_TOKEN: 'drain-token'
  }))
})
