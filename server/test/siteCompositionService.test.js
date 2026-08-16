import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb as setSiteDb,
  composeHomeSections,
  getPublicSite,
  initializeSite,
  publishSite
} from '../services/siteService.js'
import {
  _setDb as setMediaDb,
  _setStorage
} from '../services/mediaService.js'
import {
  _setDb as setLeadDb,
  createPublicLead
} from '../services/leadService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

let fakeDb
let fakeStorage
const tenantPath = 'tenants/tenant-1'
const configPath = `${tenantPath}/site/config`
const homePath = `${configPath}/pages/home`
const publishedPath = `${configPath}/published/current`
const mediaPath = `${tenantPath}/media/media-1`
const normalEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }
const previewEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }

const sectionTypes = (site) => site.pages[0].sections.map((section) => section.type)
const leadPaths = () => fakeDb.paths().filter((path) => path.startsWith(`${tenantPath}/leads/`))
const fullSections = () => ([
  {
    id: 'hero',
    type: 'hero',
    content: { title: 'Business', futureContent: 'hero-content' },
    futureSection: 'hero-section'
  },
  {
    id: 'services',
    type: 'services',
    content: { title: 'Services', items: [{ id: 'service-1', name: 'Service' }] },
    futureSection: 'services-section'
  },
  {
    id: 'gallery',
    type: 'gallery',
    content: { title: 'Gallery', items: [{ id: 'gallery-1', mediaId: 'media-1', altText: 'Work' }] },
    futureSection: 'gallery-section'
  },
  {
    id: 'testimonials',
    type: 'testimonials',
    content: { title: 'Testimonials', items: [{ id: 'testimonial-1', customerName: 'Jane', quote: 'Great.' }] },
    futureSection: 'testimonials-section'
  },
  {
    id: 'contact',
    type: 'contact',
    content: { title: 'Contact', buttonLabel: 'Contact', action: { type: 'leadForm' } },
    futureSection: 'contact-section'
  }
])

const seedFullHome = () => {
  const home = fakeDb.data(homePath)
  fakeDb.seed(homePath, { ...home, sections: fullSections(), updatedAt: 1 })
  fakeDb.seed(configPath, { ...fakeDb.data(configPath), updatedAt: 1 })
}

beforeEach(async () => {
  fakeDb = new FakeDb().seed(tenantPath, { name: 'Business' })
  fakeStorage = new FakeStorage()
  setSiteDb(fakeDb)
  setMediaDb(fakeDb)
  setLeadDb(fakeDb)
  _setStorage(fakeStorage)
  await initializeSite('tenant-1', 'platform')
  fakeDb.seed(mediaPath, {
    originalFilename: 'work.png',
    objectName: 'tenants/tenant-1/media/media-1',
    contentType: 'image/png',
    sizeBytes: 40,
    width: 640,
    height: 480,
    createdAt: 10,
    createdByUserId: 'platform'
  })
  seedFullHome()
})

afterEach(() => {
  setLeadDb()
  setMediaDb()
  _setStorage()
  setSiteDb()
})

test('composition validates every request shape before mutation', async () => {
  const invalid = [
    [{}, 'Composition sectionIds must be an array'],
    [{ sectionIds: null }, 'Composition sectionIds must be an array'],
    [{ sectionIds: [] }, 'Hero section is required'],
    [{ sectionIds: [1] }, 'Section id must be a non-empty string'],
    [{ sectionIds: [''] }, 'Section id must be a non-empty string'],
    [{ sectionIds: ['   '] }, 'Section id must be a non-empty string'],
    [{ sectionIds: ['hero', ' hero '] }, 'Unknown section id'],
    [{ sectionIds: ['hero', 'bogus'] }, 'Unknown section id'],
    [{ sectionIds: ['hero', 'services', 'services'] }, 'Duplicate section id'],
    [{ sectionIds: ['services'] }, 'Hero section is required'],
    [{ sectionIds: ['services', 'hero'] }, 'Hero section must be first'],
    [{ sectionIds: ['hero', 'hero'] }, 'Duplicate section id'],
    [{ sectionIds: ['hero', 'services', 'gallery', 'testimonials', 'contact', 'bogus'] }, 'Composition cannot exceed 5 sections']
  ]
  for (const [input, message] of invalid) {
    const homeBefore = fakeDb.data(homePath)
    const configBefore = fakeDb.data(configPath)
    await assert.rejects(composeHomeSections('tenant-1', input), { status: 400, message })
    assert.deepEqual(fakeDb.data(homePath), homeBefore)
    assert.deepEqual(fakeDb.data(configPath), configBefore)
  }
})

test('composition cannot create a canonical section that is currently absent', async () => {
  const home = fakeDb.data(homePath)
  fakeDb.seed(homePath, { ...home, sections: fullSections().slice(0, 2) })
  const before = fakeDb.data(homePath)
  await assert.rejects(composeHomeSections('tenant-1', {
    sectionIds: ['hero', 'services', 'contact']
  }), { status: 400, message: 'Unknown section id' })
  assert.deepEqual(fakeDb.data(homePath), before)
})

test('composition fails closed on whole-array stored structural corruption', async () => {
  const validHome = fakeDb.data(homePath)
  const hero = fullSections()[0]
  const services = fullSections()[1]
  const corruptArrays = [
    [hero, { id: 'about', type: 'about', content: {} }],
    [hero, services, structuredClone(services)],
    [hero, { id: 'services', type: 'gallery', content: {} }],
    [hero, ...fullSections().slice(1), structuredClone(fullSections().at(-1))],
    fullSections().slice(1),
    [services, hero]
  ]

  for (const sections of corruptArrays) {
    fakeDb.seed(homePath, { ...validHome, sections })
    const before = fakeDb.data(homePath)
    await assert.rejects(composeHomeSections('tenant-1', { sectionIds: ['hero'] }), {
      status: 500,
      message: 'Home sections invalid'
    })
    assert.deepEqual(fakeDb.data(homePath), before)
  }
})

test('composition reorders exact stored section objects and advances only working timestamps', async () => {
  const beforeHome = fakeDb.data(homePath)
  const beforeConfig = fakeDb.data(configPath)
  const beforeById = new Map(beforeHome.sections.map((section) => [section.id, section]))
  const result = await composeHomeSections('tenant-1', {
    sectionIds: ['hero', 'testimonials', 'gallery', 'contact', 'services']
  })

  assert.deepEqual(sectionTypes(result), ['hero', 'testimonials', 'gallery', 'contact', 'services'])
  const afterHome = fakeDb.data(homePath)
  assert.deepEqual(afterHome.sections.map((section) => section.id), [
    'hero', 'testimonials', 'gallery', 'contact', 'services'
  ])
  for (const section of afterHome.sections) assert.deepEqual(section, beforeById.get(section.id))
  assert.ok(afterHome.updatedAt > beforeHome.updatedAt)
  const afterConfig = fakeDb.data(configPath)
  assert.ok(afterConfig.updatedAt > beforeConfig.updatedAt)
  assert.equal(afterConfig.status, beforeConfig.status)
  assert.equal(afterConfig.lastPublishedAt, beforeConfig.lastPublishedAt)
  assert.equal(afterConfig.lastPublishedByUserId, beforeConfig.lastPublishedByUserId)
})

test('composition removes optional sections through omission and permits Hero-only', async () => {
  const beforeById = new Map(fakeDb.data(homePath).sections.map((section) => [section.id, section]))
  await composeHomeSections('tenant-1', {
    sectionIds: ['hero', 'gallery', 'testimonials']
  })
  let stored = fakeDb.data(homePath).sections
  assert.deepEqual(stored.map((section) => section.id), ['hero', 'gallery', 'testimonials'])
  for (const section of stored) assert.deepEqual(section, beforeById.get(section.id))

  const heroOnly = await composeHomeSections('tenant-1', { sectionIds: ['hero'] })
  assert.deepEqual(sectionTypes(heroOnly), ['hero'])
  stored = fakeDb.data(homePath).sections
  assert.deepEqual(stored, [beforeById.get('hero')])
})

test('composition preserves published state until republish', async () => {
  await publishSite('tenant-1', 'platform')
  const publishedBefore = structuredClone(fakeDb.data(publishedPath))
  const mediaBefore = fakeDb.data(mediaPath)

  await composeHomeSections('tenant-1', {
    sectionIds: ['hero', 'testimonials', 'gallery']
  })
  assert.deepEqual(fakeDb.data(publishedPath), publishedBefore)
  assert.deepEqual(fakeDb.data(mediaPath), mediaBefore)
  assert.equal(fakeStorage.deletes.length, 0)
  assert.deepEqual(sectionTypes(await getPublicSite('tenant-1', normalEnv)), [
    'hero', 'services', 'gallery', 'testimonials', 'contact'
  ])
  assert.deepEqual(sectionTypes(await getPublicSite('tenant-1', previewEnv)), [
    'hero', 'testimonials', 'gallery'
  ])

  await publishSite('tenant-1', 'platform')
  assert.deepEqual(sectionTypes(await getPublicSite('tenant-1', normalEnv)), [
    'hero', 'testimonials', 'gallery'
  ])
  assert.deepEqual(fakeDb.data(mediaPath), mediaBefore)
})

test('removing Gallery preserves Media metadata and invokes no storage deletion', async () => {
  const mediaBefore = fakeDb.data(mediaPath)
  await composeHomeSections('tenant-1', {
    sectionIds: ['hero', 'services', 'testimonials', 'contact']
  })
  assert.deepEqual(fakeDb.data(homePath).sections.map((section) => section.id), [
    'hero', 'services', 'testimonials', 'contact'
  ])
  assert.deepEqual(fakeDb.data(mediaPath), mediaBefore)
  assert.equal(fakeStorage.deletes.length, 0)
})

test('published lead-form authority survives working Contact removal only until republish', async () => {
  await publishSite('tenant-1', 'platform')
  await composeHomeSections('tenant-1', {
    sectionIds: ['hero', 'services', 'gallery', 'testimonials']
  })
  await createPublicLead('tenant-1', {
    name: 'Allowed', email: 'allowed@example.com', message: 'Published form remains live'
  })
  assert.equal(leadPaths().length, 1)

  await publishSite('tenant-1', 'platform')
  await assert.rejects(createPublicLead('tenant-1', {
    name: 'Blocked', email: 'blocked@example.com', message: 'No published form'
  }), { status: 404, message: 'Site not found' })
  assert.equal(leadPaths().length, 1)
})
