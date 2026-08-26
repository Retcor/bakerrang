import assert from 'node:assert/strict'
import test from 'node:test'
import {
  requireHttpOrigin,
  validatePortalBuildConfig,
  validateRendererBuildConfig,
  validateRendererRuntimeConfig
} from '../../../scripts/config-validation.mjs'

test('HTTP origin validation requires a clean absolute HTTP or HTTPS origin', () => {
  assert.equal(requireHttpOrigin({ API_ORIGIN: ' https://api.example.com/ ' }, 'API_ORIGIN'), 'https://api.example.com')
  for (const value of [undefined, '', 'ftp://api.example.com', 'https://user@example.com', 'https://api.example.com/path']) {
    assert.throws(
      () => requireHttpOrigin({ API_ORIGIN: value }, 'API_ORIGIN'),
      /API_ORIGIN (?:is required|must be a valid absolute HTTP\/HTTPS origin)/
    )
  }
})

test('Portal build validation requires its functional origins and keeps domain targets optional', () => {
  const env = {
    NEXT_PUBLIC_API_BASE_URL: 'https://api-dev.bakerrang.com',
    NEXT_PUBLIC_SITE_PREVIEW_ORIGIN: 'https://sites-dev.bakerrang.com'
  }
  assert.deepEqual(validatePortalBuildConfig(env), {
    apiBaseUrl: 'https://api-dev.bakerrang.com',
    previewOrigin: 'https://sites-dev.bakerrang.com'
  })
  assert.throws(
    () => validatePortalBuildConfig({ ...env, CUSTOM_DOMAIN_IPV4_ADDRESS: 'not-an-ip' }),
    /CUSTOM_DOMAIN_IPV4_ADDRESS/
  )
})

test('renderer build validation requires the client lead-submission API origin', () => {
  assert.deepEqual(validateRendererBuildConfig({
    NEXT_PUBLIC_SITE_API_BASE_URL: 'https://api-dev.bakerrang.com'
  }), { publicApiBaseUrl: 'https://api-dev.bakerrang.com' })
  assert.throws(() => validateRendererBuildConfig({}), /NEXT_PUBLIC_SITE_API_BASE_URL is required/)
})

test('renderer runtime always requires clean API and shared public origins', () => {
  assert.deepEqual(validateRendererRuntimeConfig({
    SITE_API_BASE_URL: 'https://api-dev.bakerrang.com',
    SITE_PUBLIC_ORIGIN: 'https://sites-dev.bakerrang.com',
    SITE_PUBLIC_INDEXING_ENABLED: 'false'
  }), {
    apiBaseUrl: 'https://api-dev.bakerrang.com',
    indexingEnabled: false,
    publicOrigin: 'https://sites-dev.bakerrang.com'
  })
  assert.throws(() => validateRendererRuntimeConfig({}), /SITE_API_BASE_URL is required/)
  for (const SITE_PUBLIC_ORIGIN of [undefined, '   ']) {
    assert.throws(() => validateRendererRuntimeConfig({
      SITE_API_BASE_URL: 'https://api-dev.bakerrang.com',
      SITE_PUBLIC_ORIGIN
    }), /SITE_PUBLIC_ORIGIN is required/)
  }
  assert.throws(() => validateRendererRuntimeConfig({
    SITE_API_BASE_URL: 'https://api-dev.bakerrang.com',
    SITE_PUBLIC_ORIGIN: 'invalid'
  }), /SITE_PUBLIC_ORIGIN must be a valid absolute HTTP\/HTTPS origin/)
})

test('renderer indexing remains enabled only by the exact true value', () => {
  const baseEnv = {
    SITE_API_BASE_URL: 'https://api-dev.bakerrang.com',
    SITE_PUBLIC_ORIGIN: 'https://sites-dev.bakerrang.com'
  }
  for (const SITE_PUBLIC_INDEXING_ENABLED of [undefined, 'false', 'garbage', 'TRUE']) {
    assert.equal(validateRendererRuntimeConfig({
      ...baseEnv,
      SITE_PUBLIC_INDEXING_ENABLED
    }).indexingEnabled, false)
  }
  assert.equal(validateRendererRuntimeConfig({
    ...baseEnv,
    SITE_PUBLIC_INDEXING_ENABLED: 'true'
  }).indexingEnabled, true)
})
