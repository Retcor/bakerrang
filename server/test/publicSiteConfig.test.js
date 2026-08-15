import test from 'node:test'
import assert from 'node:assert/strict'
import { draftPreviewEnabled } from '../config/publicSite.js'

test('draft preview requires an explicit true flag outside production', () => {
  assert.equal(draftPreviewEnabled({ NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }), true)
  assert.equal(draftPreviewEnabled({ NODE_ENV: 'development' }), false)
  assert.equal(draftPreviewEnabled({ NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }), false)
})

test('production is an unconditional ceiling for draft preview', () => {
  assert.equal(draftPreviewEnabled({ NODE_ENV: 'production', ALLOW_DRAFT_PUBLIC_SITES: 'true' }), false)
  assert.equal(draftPreviewEnabled({ NODE_ENV: 'production' }), false)
})
