import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBusinessHours, validateBusinessHours } from '../domain/businessHours.js'
import {
  _setDb as setSiteDb,
  getPublicSite,
  getSite,
  initializeSite,
  publishSite,
  updateBusinessHours as updateBusinessHoursService,
  updateBusinessProfile
} from '../services/siteService.js'
import { composeHomeSections, upsertHomeContact } from './helpers/legacySiteTestBridge.js'
import { _setDb as setMediaDb, _setStorage } from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

const open = (open = '09:00', close = '17:00') => ({ open, close })
const closed = () => ({ closed: true })
const schedule = (override = {}) => ({
  monday: open(),
  tuesday: open(),
  wednesday: open(),
  thursday: open(),
  friday: open(),
  saturday: closed(),
  sunday: closed(),
  ...override
})
const update = (businessHours = schedule(), enabled = true, content = {}) => ({
  businessHours,
  homepage: { enabled, ...content }
})

let fakeDb
const configPath = 'tenants/tenant-1/site/config'
const homePath = `${configPath}/pages/home`
const normalEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }
const previewEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }
const updateBusinessHours = (tenantId, input) => updateBusinessHoursService(
  tenantId,
  input,
  fakeDb.data(homePath)?.sections.find((section) => section.type === 'businessHours')?.id
)

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

test('canonical Business Hours accepts complete valid and all-closed schedules', () => {
  assert.deepEqual(validateBusinessHours(schedule()), schedule())
  const allClosed = schedule(Object.fromEntries([
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ].map((day) => [day, closed()])))
  assert.deepEqual(validateBusinessHours(allClosed), allClosed)
})

test('canonical Business Hours strictly rejects incomplete, extra, malformed, hybrid, equal, reverse, and overnight data', () => {
  const missing = schedule()
  delete missing.sunday
  for (const value of [
    missing,
    { ...schedule(), someday: closed() },
    schedule({ monday: open('9:00', '17:00') }),
    schedule({ monday: open('09:00', '09:00') }),
    schedule({ monday: open('17:00', '09:00') }),
    schedule({ monday: open('22:00', '02:00') }),
    schedule({ monday: { closed: true, open: '09:00', close: '17:00' } }),
    schedule({ monday: { open: '09:00', close: '17:00', note: 'extra' } })
  ]) assert.throws(() => validateBusinessHours(value), { status: 400 })
})

test('read normalization returns valid hours and omits malformed or partial stored hours without writes', async () => {
  await updateBusinessProfile('tenant-1', { phone: '+1 303 555 0100' })
  let config = fakeDb.data(configPath)
  config.businessProfile.businessHours = schedule()
  fakeDb.seed(configPath, config)
  assert.deepEqual((await getSite('tenant-1')).businessProfile.businessHours, schedule())

  for (const malformed of [{ monday: open() }, schedule({ monday: open('bad', '17:00') })]) {
    config = fakeDb.data(configPath)
    config.businessProfile.businessHours = malformed
    fakeDb.seed(configPath, config)
    const before = fakeDb.data(configPath)
    assert.equal((await getSite('tenant-1')).businessProfile.businessHours, undefined)
    assert.deepEqual(fakeDb.data(configPath), before)
    assert.equal(normalizeBusinessHours(malformed), undefined)
  }
})

test('focused mutation preserves every unrelated profile field and stores presentation only in the section', async () => {
  const profile = {
    description: 'Description',
    phone: '+1 303 555 0100',
    email: 'public@example.com',
    address: { city: 'Denver', region: 'CO' },
    serviceAreas: ['Denver'],
    socialImageMediaId: 'future-media',
    futureField: { preserved: true }
  }
  const config = fakeDb.data(configPath)
  fakeDb.seed(configPath, { ...config, businessProfile: profile })
  const result = await updateBusinessHours('tenant-1', update(schedule(), true, {
    heading: '  Visit us  ',
    intro: '  Open weekly.  ',
    ignored: 'drop'
  }))
  assert.deepEqual(fakeDb.data(configPath).businessProfile, { ...profile, businessHours: schedule() })
  const section = result.pages[0].sections.find((item) => item.type === 'businessHours')
  assert.deepEqual(section, {
    id: section.id,
    type: 'businessHours',
    hidden: false,
    content: { heading: 'Visit us', intro: 'Open weekly.' }
  })
  assert.equal(Object.hasOwn(section.content, 'businessHours'), false)
})

test('focused section creation inserts before Contact, preserves position when edited, removes presentation independently, and re-enables', async () => {
  await upsertHomeContact('tenant-1', {
    title: 'Contact', buttonLabel: 'Email', action: { type: 'email', value: 'hello@example.com' }
  })
  await updateBusinessHours('tenant-1', update())
  assert.deepEqual(fakeDb.data(homePath).sections.map((item) => item.type), ['hero', 'businessHours', 'contact'])
  await composeHomeSections('tenant-1', { sectionIds: ['hero', 'contact', 'businessHours'] })
  await updateBusinessHours('tenant-1', update(schedule({ monday: open('10:00', '18:00') }), true, { heading: 'New' }))
  assert.deepEqual(fakeDb.data(homePath).sections.map((item) => item.type), ['hero', 'contact', 'businessHours'])
  await updateBusinessHours('tenant-1', update(schedule(), false))
  assert.equal(fakeDb.data(homePath).sections.some((item) => item.type === 'businessHours'), false)
  assert.deepEqual(fakeDb.data(configPath).businessProfile.businessHours, schedule())
  await updateBusinessHours('tenant-1', update())
  assert.deepEqual(fakeDb.data(homePath).sections.map((item) => item.type), ['hero', 'businessHours', 'contact'])
})

test('Contact-absent section appends; generic removal preserves hours; null removes both atomically', async () => {
  await updateBusinessHours('tenant-1', update())
  assert.deepEqual(fakeDb.data(homePath).sections.map((item) => item.type), ['hero', 'businessHours'])
  await composeHomeSections('tenant-1', { sectionIds: ['hero'] })
  assert.deepEqual(fakeDb.data(configPath).businessProfile.businessHours, schedule())
  await updateBusinessHours('tenant-1', update())
  await updateBusinessHours('tenant-1', update(null, false))
  assert.equal(fakeDb.data(configPath).businessProfile?.businessHours, undefined)
  assert.equal(fakeDb.data(homePath).sections.some((item) => item.type === 'businessHours'), false)
})

test('general Business Profile save omitting hours preserves configured hours while replacing legacy fields', async () => {
  await updateBusinessHours('tenant-1', update(schedule(), false))
  await updateBusinessProfile('tenant-1', { email: 'replacement@example.com' })
  assert.deepEqual(fakeDb.data(configPath).businessProfile, {
    email: 'replacement@example.com', businessHours: schedule()
  })
})

test('working and published Business Hours remain isolated through Preview until republish', async () => {
  const hoursA = schedule()
  const hoursB = schedule({ monday: open('10:00', '18:00') })
  await updateBusinessHours('tenant-1', update(hoursA))
  await publishSite('tenant-1', 'admin')
  await updateBusinessHours('tenant-1', update(hoursB))
  assert.deepEqual((await getPublicSite('tenant-1', previewEnv)).businessProfile.businessHours, hoursB)
  assert.deepEqual((await getPublicSite('tenant-1', normalEnv)).businessProfile.businessHours, hoursA)
  await publishSite('tenant-1', 'admin')
  assert.deepEqual((await getPublicSite('tenant-1', normalEnv)).businessProfile.businessHours, hoursB)
})
