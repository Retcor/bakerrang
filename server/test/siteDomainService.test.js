import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeRegistrationHostname,
  normalizeRequestHostname
} from '../domain/siteDomain.js'
import {
  _setDb,
  _setDnsResolver,
  _setTokenGenerator,
  activateSiteDomain,
  disableSiteDomain,
  getActiveDomainForTenant,
  getSiteDomain,
  registerSiteDomain,
  removeSiteDomain,
  resolveActiveDomain,
  verifySiteDomain
} from '../services/siteDomainService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb

beforeEach(() => {
  fakeDb = new FakeDb()
    .seed('tenants/tenant-1', { name: 'One' })
    .seed('tenants/tenant-2', { name: 'Two' })
  _setDb(fakeDb)
  _setTokenGenerator(() => 'a'.repeat(64))
  _setDnsResolver(async () => [['a'.repeat(64)]])
})

afterEach(() => {
  _setDb()
  _setDnsResolver()
  _setTokenGenerator()
})

test('registration and request hostname normalization are deliberately separate', () => {
  assert.equal(normalizeRegistrationHostname('Example.COM'), 'example.com')
  assert.equal(normalizeRegistrationHostname('example.com.'), 'example.com')
  assert.equal(normalizeRegistrationHostname('münich.example'), 'xn--mnich-kva.example')
  assert.equal(normalizeRegistrationHostname('example.xn--p1ai'), 'example.xn--p1ai')
  assert.equal(normalizeRequestHostname('Example.COM:443'), 'example.com')

  for (const value of [
    'https://example.com', 'http://example.com', 'example.com/path', 'example.com?x=y',
    'example.com:443', 'user@example.com', '*.example.com', 'localhost', '127.0.0.1',
    '[2001:db8::1]', 'example .com', 'example..com', '-bad.example', 'bad-.example'
  ]) assert.throws(() => normalizeRegistrationHostname(value), { status: 400 })
})

test('registration atomically creates the authoritative record and tenant pointer', async () => {
  const domain = await registerSiteDomain('tenant-1', { hostname: 'Example.COM' }, 'admin-1')
  assert.equal(domain.hostname, 'example.com')
  assert.equal(domain.status, 'PENDING_VERIFICATION')
  assert.match(domain.verificationToken, /^[a-f0-9]{64}$/)
  assert.deepEqual(fakeDb.data('tenantSiteDomains/tenant-1'), { hostname: 'example.com' })
  assert.equal(fakeDb.data('siteDomains/example.com').tenantId, 'tenant-1')
})

test('registration enforces global hostname and one-domain-per-tenant conflicts', async () => {
  await registerSiteDomain('tenant-1', { hostname: 'example.com' }, 'admin-1')
  await assert.rejects(
    registerSiteDomain('tenant-2', { hostname: 'example.com' }, 'admin-2'),
    { status: 409, message: 'Hostname is already in use' }
  )
  await assert.rejects(
    registerSiteDomain('tenant-1', { hostname: 'other.example' }, 'admin-1'),
    { status: 409, message: 'Remove the existing custom domain before adding another' }
  )
})

test('same-host PUT is idempotent without token or lifecycle reset', async () => {
  await registerSiteDomain('tenant-1', { hostname: 'example.com' }, 'admin-1')
  await verifySiteDomain('tenant-1', 'admin-1')
  const active = await activateSiteDomain('tenant-1', 'admin-1')
  const repeated = await registerSiteDomain('tenant-1', { hostname: 'EXAMPLE.COM.' }, 'admin-2')
  assert.equal(repeated.status, 'ACTIVE')
  assert.equal(repeated.verificationToken, active.verificationToken)
  assert.equal(repeated.activatedAt, active.activatedAt)
})

test('verification flattens chunked and multiple TXT records', async () => {
  await registerSiteDomain('tenant-1', { hostname: 'example.com' }, 'admin-1')
  _setDnsResolver(async (name) => {
    assert.equal(name, '_bakerrang-verification.example.com')
    return [['unrelated'], ['a'.repeat(20), 'a'.repeat(44)]]
  })
  assert.equal((await verifySiteDomain('tenant-1', 'admin-1')).status, 'VERIFIED')
})

test('verification maps absent, mismatched, and transient DNS results to controlled errors', async () => {
  await registerSiteDomain('tenant-1', { hostname: 'example.com' }, 'admin-1')
  _setDnsResolver(async () => { throw Object.assign(new Error('raw'), { code: 'ENODATA' }) })
  await assert.rejects(verifySiteDomain('tenant-1', 'admin-1'), {
    status: 409, message: 'TXT verification record is not visible yet'
  })
  _setDnsResolver(async () => [['wrong']])
  await assert.rejects(verifySiteDomain('tenant-1', 'admin-1'), {
    status: 422, message: 'TXT verification token does not match'
  })
  _setDnsResolver(async () => { throw Object.assign(new Error('secret resolver detail'), { code: 'SERVFAIL' }) })
  await assert.rejects(verifySiteDomain('tenant-1', 'admin-1'), {
    status: 409, message: 'DNS lookup temporarily failed. Please try again'
  })
})

test('only VERIFIED activates and disable requires fresh ownership proof', async () => {
  let nextToken = 'a'.repeat(64)
  _setTokenGenerator(() => nextToken)
  await registerSiteDomain('tenant-1', { hostname: 'example.com' }, 'admin-1')
  await assert.rejects(activateSiteDomain('tenant-1', 'admin-1'), { status: 409 })
  await verifySiteDomain('tenant-1', 'admin-1')
  assert.equal((await activateSiteDomain('tenant-1', 'admin-1')).status, 'ACTIVE')

  nextToken = 'b'.repeat(64)
  const disabled = await disableSiteDomain('tenant-1', 'admin-2')
  assert.equal(disabled.status, 'DISABLED')
  assert.equal(disabled.verificationToken, 'b'.repeat(64))
  assert.equal(disabled.verifiedAt, undefined)
  assert.deepEqual(await getActiveDomainForTenant('tenant-1'), { canonicalHost: null })
  await assert.rejects(activateSiteDomain('tenant-1', 'admin-1'), { status: 409 })

  _setDnsResolver(async () => [['b'.repeat(64)]])
  assert.equal((await verifySiteDomain('tenant-1', 'admin-1')).status, 'VERIFIED')
  assert.equal((await activateSiteDomain('tenant-1', 'admin-1')).status, 'ACTIVE')
})

test('public resolution exposes only active routing facts and uses the stored canonical host', async () => {
  await registerSiteDomain('tenant-1', { hostname: 'example.com' }, 'admin-1')
  await assert.rejects(resolveActiveDomain('example.com'), { status: 404 })
  await verifySiteDomain('tenant-1', 'admin-1')
  await assert.rejects(resolveActiveDomain('example.com'), { status: 404 })
  await activateSiteDomain('tenant-1', 'admin-1')
  assert.deepEqual(await resolveActiveDomain('EXAMPLE.COM:443'), {
    tenantId: 'tenant-1', canonicalHost: 'example.com'
  })
  assert.deepEqual(await getActiveDomainForTenant('tenant-1'), { canonicalHost: 'example.com' })
  assert.deepEqual(Object.keys(await resolveActiveDomain('example.com')).sort(), ['canonicalHost', 'tenantId'])
})

test('remove deletes both records and a fresh registration gets a fresh token', async () => {
  let token = 'a'.repeat(64)
  _setTokenGenerator(() => token)
  await registerSiteDomain('tenant-1', { hostname: 'example.com' }, 'admin-1')
  await removeSiteDomain('tenant-1')
  assert.equal(await getSiteDomain('tenant-1'), null)
  assert.equal(fakeDb.data('siteDomains/example.com'), undefined)
  assert.equal(fakeDb.data('tenantSiteDomains/tenant-1'), undefined)

  token = 'b'.repeat(64)
  const fresh = await registerSiteDomain('tenant-2', { hostname: 'example.com' }, 'admin-2')
  assert.equal(fresh.verificationToken, 'b'.repeat(64))
})

test('domain lifecycle never mutates the published snapshot', async () => {
  const snapshot = { siteDefinition: { status: 'PUBLISHED', pages: [{ id: 'home' }] } }
  fakeDb.seed('tenants/tenant-1/site/config/published/current', snapshot)
  const before = fakeDb.data('tenants/tenant-1/site/config/published/current')

  await registerSiteDomain('tenant-1', { hostname: 'example.com' }, 'admin-1')
  await verifySiteDomain('tenant-1', 'admin-1')
  await activateSiteDomain('tenant-1', 'admin-1')
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), before)
  await disableSiteDomain('tenant-1', 'admin-1')
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), before)
  await removeSiteDomain('tenant-1')
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), before)
})
