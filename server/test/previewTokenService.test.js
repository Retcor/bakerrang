import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createPreviewToken,
  previewTokenTtlSeconds,
  verifyPreviewToken
} from '../services/previewTokenService.js'

const secret = 'test-preview-secret'
const now = 1_800_000_000_000

test('preview tokens sign and verify tenant, issued-at, and 15-minute expiry claims', () => {
  const signed = createPreviewToken('tenant-1', { secret, now })
  assert.equal(signed.expiresAt, now / 1000 + previewTokenTtlSeconds)
  assert.deepEqual(verifyPreviewToken(signed.token, { secret, now }), {
    tenantId: 'tenant-1', iat: now / 1000, exp: signed.expiresAt
  })
})

test('preview tokens reject expiry, tampering, malformed values, and wrong versions generically', () => {
  const { token } = createPreviewToken('tenant-1', { secret, now })
  const invalid = [
    token.replace(/.$/, token.endsWith('a') ? 'b' : 'a'),
    'malformed',
    token.replace(/^v1\./, 'v2.')
  ]
  for (const value of invalid) {
    assert.throws(() => verifyPreviewToken(value, { secret, now }), {
      status: 401, message: 'Preview authorization failed'
    })
  }
  assert.throws(() => verifyPreviewToken(token, {
    secret, now: now + (previewTokenTtlSeconds * 1000)
  }), { status: 401, message: 'Preview authorization failed' })
})

test('preview token operations fail closed when the secret is missing', () => {
  const original = process.env.PREVIEW_TOKEN_SECRET
  delete process.env.PREVIEW_TOKEN_SECRET
  try {
    assert.throws(() => createPreviewToken('tenant-1'), /PREVIEW_TOKEN_SECRET/)
    assert.throws(() => verifyPreviewToken('v1.payload.signature'), /PREVIEW_TOKEN_SECRET/)
  } finally {
    if (original !== undefined) process.env.PREVIEW_TOKEN_SECRET = original
  }
})
