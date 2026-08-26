import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSocialLinks, SOCIAL_PLATFORMS, validateSocialLinks } from '../domain/socialLinks.js'
import {
  _setDb as setSiteDb,
  getPublicSite,
  getSite,
  initializeSite,
  publishSite,
  updateBusinessHours,
  updateBusinessProfile,
  updateSocialLinks
} from '../services/siteService.js'
import { _setDb as setMediaDb, _setStorage } from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

const configPath = 'tenants/tenant-1/site/config'
const normalEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }
const previewEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }
const socialLinks = (suffix = 'a') => ([
  { platform: 'instagram', url: `https://instagram.com/${suffix}` },
  { platform: 'facebook', url: `https://facebook.com/${suffix}` }
])
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

test('Social Links accepts one link and every supported platform in canonical order', () => {
  assert.deepEqual(validateSocialLinks([socialLinks()[0]]), [socialLinks()[0]])
  const all = SOCIAL_PLATFORMS.map((platform) => ({ platform, url: `https://example.com/${platform}` }))
  assert.deepEqual(validateSocialLinks(all), all)
})

test('Social Links strictly rejects unsupported, duplicate, missing, malformed, unsafe, and overlong URLs', () => {
  for (const links of [
    [{ platform: 'threads', url: 'https://example.com/profile' }],
    [socialLinks()[0], { ...socialLinks()[0], url: 'https://example.com/duplicate' }],
    [{ platform: 'instagram' }],
    [{ platform: 'instagram', url: 'not a URL' }],
    [{ platform: 'instagram', url: 'http://instagram.com/example' }],
    [{ platform: 'instagram', url: 'javascript:alert(1)' }],
    [{ platform: 'instagram', url: 'data:text/plain,test' }],
    [{ platform: 'instagram', url: 'mailto:test@example.com' }],
    [{ platform: 'instagram', url: 'ftp://example.com/profile' }],
    [{ platform: 'instagram', url: '/relative' }],
    [{ platform: 'instagram', url: '   ' }],
    [{ platform: 'instagram', url: `https://example.com/${'x'.repeat(301)}` }]
  ]) assert.throws(() => validateSocialLinks(links), { status: 400 })
})

test('old working and published snapshots without Social Links remain unchanged', async () => {
  assert.equal((await getSite('tenant-1')).businessProfile?.socialLinks, undefined)
  await publishSite('tenant-1', 'admin')
  assert.equal((await getPublicSite('tenant-1', normalEnv)).businessProfile?.socialLinks, undefined)
})

test('Social Links trims safe values and drops unknown item fields from canonical writes', async () => {
  const result = await updateSocialLinks('tenant-1', {
    socialLinks: [{
      platform: 'linkedin',
      url: '  https://linkedin.com/company/example  ',
      label: 'Ignored'
    }],
    ignored: true
  })
  assert.deepEqual(result.businessProfile.socialLinks, [{
    platform: 'linkedin',
    url: 'https://linkedin.com/company/example'
  }])
  assert.deepEqual(fakeDb.data(configPath).businessProfile.socialLinks, result.businessProfile.socialLinks)
})

test('read sanitization omits non-arrays and invalid entries, keeps the first duplicate deterministically', async () => {
  await updateBusinessProfile('tenant-1', { phone: '+1 303 555 0100' })
  let config = fakeDb.data(configPath)
  config.businessProfile.socialLinks = 'invalid'
  fakeDb.seed(configPath, config)
  assert.equal((await getSite('tenant-1')).businessProfile.socialLinks, undefined)
  assert.equal(normalizeSocialLinks('invalid'), undefined)

  config = fakeDb.data(configPath)
  config.businessProfile.socialLinks = [
    { platform: 'instagram', url: 'https://instagram.com/first' },
    { platform: 'instagram', url: 'https://instagram.com/second' },
    { platform: 'x', url: 'http://x.com/unsafe' },
    { platform: 'unknown', url: 'https://example.com' },
    null,
    { platform: 'youtube', url: 'https://youtube.com/@valid', extra: true }
  ]
  fakeDb.seed(configPath, config)
  assert.deepEqual((await getSite('tenant-1')).businessProfile.socialLinks, [
    { platform: 'instagram', url: 'https://instagram.com/first' },
    { platform: 'youtube', url: 'https://youtube.com/@valid' }
  ])
})

test('focused Social mutation changes only Social Links and preserves all unrelated and future profile fields', async () => {
  const profile = {
    description: 'Description',
    phone: '+1 303 555 0100',
    email: 'public@example.com',
    address: { city: 'Denver', region: 'CO' },
    serviceAreas: ['Denver'],
    socialImageMediaId: 'media-id',
    businessHours: hours(),
    futureField: { preserved: true }
  }
  fakeDb.seed(configPath, { ...fakeDb.data(configPath), businessProfile: profile })
  await updateSocialLinks('tenant-1', { socialLinks: socialLinks() })
  assert.deepEqual(fakeDb.data(configPath).businessProfile, { ...profile, socialLinks: socialLinks() })
  await updateSocialLinks('tenant-1', { socialLinks: [] })
  assert.deepEqual(fakeDb.data(configPath).businessProfile, profile)
  await updateSocialLinks('tenant-1', { socialLinks: null })
  assert.deepEqual(fakeDb.data(configPath).businessProfile, profile)
})

test('general Profile and both focused mutations preserve Business Hours and Social Links independently', async () => {
  await updateBusinessHours('tenant-1', { businessHours: hours(), homepage: { enabled: false } })
  await updateSocialLinks('tenant-1', { socialLinks: socialLinks() })
  await updateBusinessHours('tenant-1', {
    businessHours: { ...hours(), monday: { open: '10:00', close: '18:00' } },
    homepage: { enabled: false }
  })
  assert.deepEqual(fakeDb.data(configPath).businessProfile.socialLinks, socialLinks())
  await updateSocialLinks('tenant-1', { socialLinks: socialLinks('b') })
  assert.deepEqual(fakeDb.data(configPath).businessProfile.businessHours.monday, {
    open: '10:00', close: '18:00'
  })
  await updateBusinessProfile('tenant-1', { email: 'replacement@example.com' })
  assert.deepEqual(fakeDb.data(configPath).businessProfile, {
    email: 'replacement@example.com',
    businessHours: { ...hours(), monday: { open: '10:00', close: '18:00' } },
    socialLinks: socialLinks('b')
  })
})

test('working and published Social Links remain isolated through Preview until republish', async () => {
  await updateBusinessProfile('tenant-1', { phone: '+1 303 555 0100' })
  await updateSocialLinks('tenant-1', { socialLinks: socialLinks('a') })
  await publishSite('tenant-1', 'admin')
  await updateSocialLinks('tenant-1', { socialLinks: socialLinks('b') })
  assert.deepEqual((await getPublicSite('tenant-1', previewEnv)).businessProfile.socialLinks, socialLinks('b'))
  assert.deepEqual((await getPublicSite('tenant-1', normalEnv)).businessProfile.socialLinks, socialLinks('a'))
  await publishSite('tenant-1', 'admin')
  assert.deepEqual((await getPublicSite('tenant-1', normalEnv)).businessProfile.socialLinks, socialLinks('b'))
})
