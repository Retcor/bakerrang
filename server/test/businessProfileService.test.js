import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb as setSiteDb,
  getPublicSite,
  getSite,
  initializeSite,
  publishSite,
  updateBusinessProfile,
  upsertHomeContact,
  updateHomeHero
} from '../services/siteService.js'
import { _setDb as setMediaDb, _setStorage } from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

let fakeDb
const normalEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }
const previewEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }

beforeEach(async () => {
  fakeDb = new FakeDb().seed('tenants/tenant-1', { name: 'Business' })
  setSiteDb(fakeDb)
  setMediaDb(fakeDb)
  _setStorage(new FakeStorage())
  await initializeSite('tenant-1', 'admin')
})

afterEach(() => {
  setSiteDb()
  setMediaDb()
  _setStorage()
})

test('profile validates, trims, deduplicates, and persists only approved public fields', async () => {
  const site = await updateBusinessProfile('tenant-1', {
    description: '  Public description  ',
    phone: ' +1 (303) 555-0123 ',
    email: ' public@example.com ',
    address: { line1: ' 1 Main ', line2: '', city: ' Denver ', region: ' CO ', ignored: true },
    serviceAreas: [' Denver ', 'BOULDER', 'denver', ' Boulder '],
    ignored: 'drop me'
  })
  assert.deepEqual(site.businessProfile, {
    description: 'Public description',
    phone: '+1 (303) 555-0123',
    email: 'public@example.com',
    address: { line1: '1 Main', city: 'Denver', region: 'CO' },
    serviceAreas: ['Denver', 'BOULDER']
  })
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config').businessProfile, site.businessProfile)
})

test('profile rejects invalid field types, bounds, contact methods, address, and service areas', async () => {
  for (const input of [
    { description: 'x'.repeat(301) },
    { phone: '123' },
    { email: 'invalid' },
    { address: { line1: 'Somewhere' } },
    { address: 'Denver' },
    { serviceAreas: 'Denver' },
    { serviceAreas: [''] },
    { serviceAreas: Array.from({ length: 21 }, (_, index) => `Area ${index}`) },
    { socialImageMediaId: 42 }
  ]) await assert.rejects(updateBusinessProfile('tenant-1', input), { status: 400 })
})

test('full-state profile saves clear omitted fields and remove the empty profile property', async () => {
  await updateBusinessProfile('tenant-1', {
    phone: '+1 303 555 0123', email: 'public@example.com', serviceAreas: ['Denver']
  })
  await updateBusinessProfile('tenant-1', { email: 'remaining@example.com' })
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config').businessProfile, {
    email: 'remaining@example.com'
  })
  await updateBusinessProfile('tenant-1', {
    description: '', phone: '', email: '', address: {}, serviceAreas: [], socialImageMediaId: null
  })
  assert.equal(Object.hasOwn(fakeDb.data('tenants/tenant-1/site/config'), 'businessProfile'), false)
  assert.equal(Object.hasOwn(await getSite('tenant-1'), 'businessProfile'), false)
})

test('profile never infers public identity facts from presentation sections', async () => {
  await updateHomeHero('tenant-1', { title: 'Title', subtitle: 'Not a meta description' })
  await upsertHomeContact('tenant-1', {
    title: 'Call', buttonLabel: 'Call', action: { type: 'phone', value: '+1 303 555 0123' }
  })
  const site = await getSite('tenant-1')
  assert.equal(Object.hasOwn(site, 'businessProfile'), false)
  assert.equal(Object.hasOwn(fakeDb.data('tenants/tenant-1/site/config'), 'businessProfile'), false)
})

test('working and published profile snapshots remain isolated until republish', async () => {
  await updateBusinessProfile('tenant-1', { description: 'A', phone: '+1 303 555 0101' })
  await publishSite('tenant-1', 'admin')
  const snapshot = fakeDb.data('tenants/tenant-1/site/config/published/current')
  await updateBusinessProfile('tenant-1', { description: 'B', email: 'b@example.com' })
  assert.equal((await getSite('tenant-1')).businessProfile.description, 'B')
  assert.equal((await getPublicSite('tenant-1', previewEnv)).businessProfile.description, 'B')
  assert.equal((await getPublicSite('tenant-1', normalEnv)).businessProfile.description, 'A')
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), snapshot)
  await publishSite('tenant-1', 'admin')
  assert.equal((await getPublicSite('tenant-1', normalEnv)).businessProfile.description, 'B')
})

test('legacy and malformed optional profiles are omitted without repair writes', async () => {
  await publishSite('tenant-1', 'admin')
  const publishedPath = 'tenants/tenant-1/site/config/published/current'
  const snapshot = fakeDb.data(publishedPath)
  delete snapshot.siteDefinition.businessProfile
  fakeDb.seed(publishedPath, snapshot)
  assert.equal(Object.hasOwn(await getPublicSite('tenant-1', normalEnv), 'businessProfile'), false)
  assert.deepEqual(fakeDb.data(publishedPath), snapshot)

  const config = fakeDb.data('tenants/tenant-1/site/config')
  config.businessProfile = { description: 12, address: {}, serviceAreas: [null, ''] }
  fakeDb.seed('tenants/tenant-1/site/config', config)
  assert.equal(Object.hasOwn(await getSite('tenant-1'), 'businessProfile'), false)
})

test('social image requires same-tenant Media, hydrates safely, and persists only mediaId', async () => {
  await assert.rejects(updateBusinessProfile('tenant-1', { socialImageMediaId: 'missing' }), {
    status: 400,
    message: 'Social image not found'
  })
  fakeDb.seed('tenants/tenant-1/media/social', {
    originalFilename: 'social.png',
    objectName: 'tenants/tenant-1/media/social',
    contentType: 'image/png',
    sizeBytes: 20,
    width: 1200,
    height: 630,
    createdAt: 1,
    createdByUserId: 'admin'
  })
  const site = await updateBusinessProfile('tenant-1', { socialImageMediaId: 'social' })
  assert.deepEqual(site.businessProfile, {
    socialImageMediaId: 'social',
    socialImageSrc: 'https://media.test/tenants/tenant-1/media/social',
    socialImageWidth: 1200,
    socialImageHeight: 630
  })
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config').businessProfile, {
    socialImageMediaId: 'social'
  })
})
