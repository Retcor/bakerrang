import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import {
  _setDb,
  getPublicSite,
  getPublishedSiteDefinition,
  getSite,
  initializeSite,
  publishSite,
  updateBusinessProfile,
  updateCustomCss,
  updateHomeHero,
  updateSiteBranding,
  updateSiteTheme
} from '../services/siteService.js'
import { FakeDb } from './helpers/fakeDb.js'

const configPath = (tenantId) => `tenants/${tenantId}/site/config`
const homePath = (tenantId) => `${configPath(tenantId)}/pages/home`
const publishedPath = (tenantId) => `${configPath(tenantId)}/published/current`
const publicEnv = { NODE_ENV: 'production' }

const hours = () => ({
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' },
  thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' },
  saturday: { closed: true },
  sunday: { closed: true }
})

let fakeDb

beforeEach(() => {
  fakeDb = new FakeDb()
    .seed('tenants/tenant-a', { name: 'Tenant A' })
    .seed('tenants/tenant-b', { name: 'Tenant B' })
  _setDb(fakeDb)
})

afterEach(() => _setDb())

test('focused Custom CSS save stores raw CSS and preserves config, profile, future fields, and Home', async () => {
  await initializeSite('tenant-a', 'admin')
  const originalConfig = fakeDb.data(configPath('tenant-a'))
  const originalHome = fakeDb.data(homePath('tenant-a'))
  const businessProfile = {
    description: 'Original profile',
    businessHours: hours(),
    socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/tenant-a' }]
  }
  fakeDb.seed(configPath('tenant-a'), {
    ...originalConfig,
    businessProfile,
    futureConfigField: { retained: true }
  })

  const raw = 'body.brand { color: red; }'
  const result = await updateCustomCss('tenant-a', { customCss: raw, ignored: 'drop' })
  const stored = fakeDb.data(configPath('tenant-a'))
  assert.equal(stored.customCss, raw)
  assert.deepEqual(stored.branding, originalConfig.branding)
  assert.deepEqual(stored.theme, originalConfig.theme)
  assert.deepEqual(stored.businessProfile, businessProfile)
  assert.deepEqual(stored.futureConfigField, { retained: true })
  assert.deepEqual(fakeDb.data(homePath('tenant-a')), originalHome)
  assert.equal(result.customCss, raw)
  assert.equal(result.scopedCustomCss, '[data-br-site].brand{color:red}')

  await updateSiteTheme('tenant-a', stored.theme)
  await updateSiteBranding('tenant-a', { siteName: 'Renamed' })
  await updateBusinessProfile('tenant-a', { description: 'Updated profile' })
  await updateHomeHero('tenant-a', { title: 'Updated Hero' })
  assert.equal(fakeDb.data(configPath('tenant-a')).customCss, raw)
  assert.deepEqual(fakeDb.data(configPath('tenant-a')).futureConfigField, { retained: true })
})

test('focused Custom CSS validation rejects unsafe input and null or blank values remove the field', async () => {
  await initializeSite('tenant-a', 'admin')
  await assert.rejects(updateCustomCss('tenant-a', { customCss: '@import "https://example.com/x.css";' }), {
    status: 400,
    code: 'INVALID_CUSTOM_CSS'
  })
  await assert.rejects(updateCustomCss('tenant-a', { customCss: 'a'.repeat((20 * 1024) + 1) }), {
    status: 400,
    code: 'INVALID_CUSTOM_CSS'
  })
  assert.equal(Object.hasOwn(fakeDb.data(configPath('tenant-a')), 'customCss'), false)

  for (const clearValue of [null, '', ' \n\t ']) {
    await updateCustomCss('tenant-a', { customCss: '.card { color: red; }' })
    const result = await updateCustomCss('tenant-a', { customCss: clearValue })
    assert.equal(Object.hasOwn(fakeDb.data(configPath('tenant-a')), 'customCss'), false)
    assert.equal(Object.hasOwn(result, 'customCss'), false)
    assert.equal(Object.hasOwn(result, 'scopedCustomCss'), false)
  }
})

test('Custom CSS follows the working and published snapshot lifecycle without persisting scoped output', async () => {
  await initializeSite('tenant-a', 'admin')
  const rawA = 'body { color: red; }'
  const rawB = 'body { color: blue; }'
  await updateCustomCss('tenant-a', { customCss: rawA })
  await publishSite('tenant-a', 'publisher')
  let snapshot = fakeDb.data(publishedPath('tenant-a')).siteDefinition
  assert.equal(snapshot.customCss, rawA)
  assert.equal(Object.hasOwn(snapshot, 'scopedCustomCss'), false)

  await updateCustomCss('tenant-a', { customCss: rawB })
  assert.equal((await getSite('tenant-a')).customCss, rawB)
  assert.equal((await getSite('tenant-a')).scopedCustomCss, '[data-br-site]{color:blue}')
  assert.equal((await getPublicSite('tenant-a', publicEnv)).customCss, rawA)
  assert.equal((await getPublicSite('tenant-a', publicEnv)).scopedCustomCss, '[data-br-site]{color:red}')

  await publishSite('tenant-a', 'publisher')
  assert.equal((await getPublicSite('tenant-a', publicEnv)).customCss, rawB)
  await updateCustomCss('tenant-a', { customCss: null })
  assert.equal(Object.hasOwn(await getSite('tenant-a'), 'customCss'), false)
  assert.equal((await getPublicSite('tenant-a', publicEnv)).customCss, rawB)

  await publishSite('tenant-a', 'publisher')
  const publicSite = await getPublicSite('tenant-a', publicEnv)
  assert.equal(Object.hasOwn(publicSite, 'customCss'), false)
  assert.equal(Object.hasOwn(publicSite, 'scopedCustomCss'), false)
  snapshot = fakeDb.data(publishedPath('tenant-a')).siteDefinition
  assert.equal(Object.hasOwn(snapshot, 'customCss'), false)
  assert.equal(Object.hasOwn(snapshot, 'scopedCustomCss'), false)
})

test('read finalization fails corrupt CSS closed without repairing storage or trusting persisted scoped CSS', async () => {
  await initializeSite('tenant-a', 'admin')
  const unsafe = '[data-br-site]{background:url("https://example.com/tracker.png")}'
  const config = fakeDb.data(configPath('tenant-a'))
  fakeDb.seed(configPath('tenant-a'), { ...config, customCss: unsafe })
  const working = await getSite('tenant-a')
  assert.equal(working.customCss, unsafe)
  assert.equal(Object.hasOwn(working, 'scopedCustomCss'), false)
  assert.equal(fakeDb.data(configPath('tenant-a')).customCss, unsafe)

  fakeDb.seed(configPath('tenant-a'), { ...config, status: 'PUBLISHED' })
  fakeDb.seed(publishedPath('tenant-a'), {
    siteDefinition: {
      status: 'PUBLISHED',
      branding: config.branding,
      theme: config.theme,
      customCss: unsafe,
      scopedCustomCss: 'body{display:none}',
      pages: []
    }
  })
  const published = await getPublishedSiteDefinition('tenant-a')
  assert.equal(published.customCss, unsafe)
  assert.equal(Object.hasOwn(published, 'scopedCustomCss'), false)
  assert.equal(fakeDb.data(publishedPath('tenant-a')).siteDefinition.scopedCustomCss, 'body{display:none}')
})

test('Custom CSS finalization and publishing remain isolated per tenant', async () => {
  await initializeSite('tenant-a', 'admin')
  await initializeSite('tenant-b', 'admin')
  await updateCustomCss('tenant-a', { customCss: 'h1 { color: red; }' })
  await updateCustomCss('tenant-b', { customCss: 'h1 { color: blue; }' })

  const [siteA, siteB] = await Promise.all([getSite('tenant-a'), getSite('tenant-b')])
  assert.equal(siteA.scopedCustomCss, '[data-br-site] h1{color:red}')
  assert.equal(siteB.scopedCustomCss, '[data-br-site] h1{color:blue}')
  await publishSite('tenant-a', 'publisher')
  assert.equal(fakeDb.data(configPath('tenant-b')).customCss, 'h1 { color: blue; }')
  assert.equal((await getSite('tenant-b')).scopedCustomCss, '[data-br-site] h1{color:blue}')
})

test('hostile but valid Preview CSS remains confined to the tenant scope', async () => {
  await initializeSite('tenant-a', 'admin')
  const result = await updateCustomCss('tenant-a', {
    customCss: '* { opacity: .5 } [data-br-site] { position: fixed; inset: 0; z-index: 999999 } [data-br-site] * { display: none }'
  })
  assert.equal(
    result.scopedCustomCss,
    '[data-br-site] *{opacity:.5}[data-br-site]{position:fixed;inset:0;z-index:999999}[data-br-site] *{display:none}'
  )
})
