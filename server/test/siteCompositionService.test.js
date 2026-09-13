import test from 'node:test'
import assert from 'node:assert/strict'
import * as sites from '../services/siteService.js'

test('the stale full-array composition mutation is retired', () => {
  assert.equal(sites.composeHomeSections, undefined)
})
