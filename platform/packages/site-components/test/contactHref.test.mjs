import test from 'node:test'
import assert from 'node:assert/strict'
import { contactHref } from '../src/contactHref.ts'

test('contactHref creates safe email and canonical phone links', () => {
  assert.equal(contactHref({ type: 'email', value: 'hello@example.com' }), 'mailto:hello@example.com')
  assert.equal(contactHref({ type: 'phone', value: '+1 (801) 555-1234' }), 'tel:+18015551234')
  assert.equal(contactHref({ type: 'phone', value: '(801) 555-1234' }), 'tel:8015551234')
})

test('contactHref parses HTTP URLs and rejects other schemes', () => {
  assert.equal(contactHref({ type: 'url', value: 'HTTPS://EXAMPLE.COM' }), 'https://example.com/')
  for (const value of ['javascript:alert(1)', 'data:text/plain,hello', 'ftp://example.com', '/contact']) {
    assert.equal(contactHref({ type: 'url', value }), null)
  }
})

test('contactHref fails closed for malformed runtime actions', () => {
  for (const action of [undefined, null, 'email', [], {}, { type: 'email' }, { type: 'unknown', value: 'x' }]) {
    assert.equal(contactHref(action), null)
  }
  assert.equal(contactHref({ type: 'email', value: 'not an email' }), null)
  assert.equal(contactHref({ type: 'phone', value: '801-CALL-NOW' }), null)
  assert.equal(contactHref({ type: 'leadForm' }), null)
})
