import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb as setSiteDb,
  composeHomeSections,
  getPublicSite,
  getSite,
  initializeSite,
  publishSite,
  upsertHomeAbout,
  upsertHomeServices
} from '../services/siteService.js'
import { _setDb as setMediaDb, _setStorage } from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

let fakeDb
const normalEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }
const previewEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }
const tenantPath = (tenantId = 'tenant-1') => `tenants/${tenantId}`
const homePath = (tenantId = 'tenant-1') => `${tenantPath(tenantId)}/site/config/pages/home`
const mediaPath = (mediaId, tenantId = 'tenant-1') => `${tenantPath(tenantId)}/media/${mediaId}`
const aboutSection = (site) => site.pages[0].sections.find((section) => section.type === 'about')
const input = (overrides = {}) => ({ heading: 'Our story', body: 'First paragraph.\n\nSecond paragraph.', ...overrides })
const mediaRecord = (mediaId, tenantId = 'tenant-1') => ({
  originalFilename: `${mediaId}.png`,
  objectName: `tenants/${tenantId}/media/${mediaId}`,
  contentType: 'image/png',
  sizeBytes: 40,
  width: 800,
  height: 600,
  createdAt: 10,
  createdByUserId: 'platform'
})

beforeEach(async () => {
  fakeDb = new FakeDb().seed(tenantPath(), { name: 'Business' })
  setSiteDb(fakeDb)
  setMediaDb(fakeDb)
  _setStorage(new FakeStorage())
  await initializeSite('tenant-1', 'platform')
})

afterEach(() => {
  setSiteDb()
  setMediaDb()
  _setStorage()
})

test('About validates, trims, persists only canonical fields, and handles optional values', async () => {
  const created = await upsertHomeAbout('tenant-1', input({
    eyebrow: '  Who we are  ',
    heading: '  Our story  ',
    body: '  First.\n\nSecond.  ',
    imageAlt: 'ignored without an image',
    arbitraryHtml: '<script>alert(1)</script>'
  }))
  assert.deepEqual(aboutSection(created), {
    id: 'about',
    type: 'about',
    content: { eyebrow: 'Who we are', heading: 'Our story', body: 'First.\n\nSecond.' }
  })
  assert.deepEqual(aboutSection({ pages: [{ sections: fakeDb.data(homePath()).sections }] }), aboutSection(created))

  const withoutEyebrow = await upsertHomeAbout('tenant-1', input({ eyebrow: '   ' }))
  assert.equal(aboutSection(withoutEyebrow).content.eyebrow, undefined)
})

test('About enforces required fields and every field limit', async () => {
  const invalid = [
    [input({ eyebrow: 1 }), 'About eyebrow must be a string'],
    [input({ eyebrow: 'x'.repeat(61) }), 'About eyebrow must be 60 characters or fewer'],
    [{ body: 'Body' }, 'About heading is required'],
    [input({ heading: '   ' }), 'About heading is required'],
    [input({ heading: 'x'.repeat(121) }), 'About heading must be 120 characters or fewer'],
    [{ heading: 'Heading' }, 'About body is required'],
    [input({ body: '   ' }), 'About body is required'],
    [input({ body: 'x'.repeat(2001) }), 'About body must be 2000 characters or fewer'],
    [input({ imageMediaId: 1 }), 'About image must be a string'],
    [input({ imageMediaId: 'image-1' }), 'About image alt text is required'],
    [input({ imageMediaId: 'image-1', imageAlt: 'x'.repeat(251) }), 'About image alt text must be 250 characters or fewer']
  ]
  for (const [value, message] of invalid) {
    await assert.rejects(upsertHomeAbout('tenant-1', value), { status: 400, message })
  }
})

test('About accepts only same-tenant Media and hydrates provider-neutral image data', async () => {
  fakeDb.seed(tenantPath('tenant-2'), { name: 'Other' })
  fakeDb.seed(mediaPath('foreign', 'tenant-2'), mediaRecord('foreign', 'tenant-2'))
  for (const mediaId of ['missing', 'foreign']) {
    await assert.rejects(upsertHomeAbout('tenant-1', input({ imageMediaId: mediaId, imageAlt: 'Alt' })), {
      status: 400,
      message: 'About image not found'
    })
  }

  fakeDb.seed(mediaPath('about-image'), mediaRecord('about-image'))
  const result = await upsertHomeAbout('tenant-1', input({
    imageMediaId: 'about-image', imageAlt: 'Bakers preparing bread', imageSrc: 'https://evil.test'
  }))
  assert.deepEqual(aboutSection(result).content, {
    heading: 'Our story',
    body: 'First paragraph.\n\nSecond paragraph.',
    imageMediaId: 'about-image',
    imageAlt: 'Bakers preparing bread',
    imageSrc: 'https://media.test/tenants/tenant-1/media/about-image',
    imageWidth: 800,
    imageHeight: 600
  })
  const persisted = aboutSection({ pages: [{ sections: fakeDb.data(homePath()).sections }] }).content
  assert.deepEqual(Object.keys(persisted).sort(), ['body', 'heading', 'imageAlt', 'imageMediaId'])
})

test('unresolved About media degrades to text-only and strips stored hydrated fields', async () => {
  const home = fakeDb.data(homePath())
  home.sections.push({
    id: 'about',
    type: 'about',
    content: {
      heading: 'About',
      body: 'Text',
      imageMediaId: 'missing',
      imageAlt: 'Missing',
      imageSrc: 'https://evil.test',
      imageWidth: 1,
      imageHeight: 1
    }
  })
  fakeDb.seed(homePath(), home)
  const content = aboutSection(await getSite('tenant-1')).content
  assert.equal(content.imageMediaId, 'missing')
  assert.equal(content.imageSrc, undefined)
  assert.equal(content.imageWidth, undefined)
  assert.equal(content.imageHeight, undefined)
})

test('About is canonical, single-instance, inserted after Hero, and updates in place', async () => {
  await upsertHomeServices('tenant-1', { title: 'Services', items: [{ name: 'One' }] })
  const created = await upsertHomeAbout('tenant-1', input())
  assert.deepEqual(created.pages[0].sections.map((section) => section.type), ['hero', 'about', 'services'])

  await composeHomeSections('tenant-1', { sectionIds: ['hero', 'services', 'about'] })
  const updated = await upsertHomeAbout('tenant-1', input({ heading: 'Updated' }))
  assert.deepEqual(updated.pages[0].sections.map((section) => section.type), ['hero', 'services', 'about'])
  assert.equal(aboutSection(updated).content.heading, 'Updated')

  const original = fakeDb.data(homePath())
  for (const corrupt of [
    [{ id: 'about', type: 'future', content: {} }],
    [{ id: 'future', type: 'about', content: {} }],
    [aboutSection(updated), aboutSection(updated)]
  ]) {
    fakeDb.seed(homePath(), { ...original, sections: [original.sections[0], ...corrupt] })
    await assert.rejects(upsertHomeAbout('tenant-1', input()), {
      status: 500,
      message: 'Home about section invalid'
    })
  }
})

test('About remove/re-add and WORKING/PUBLISHED lifecycle use existing composition snapshots', async () => {
  await upsertHomeAbout('tenant-1', input({ heading: 'Published A' }))
  await publishSite('tenant-1', 'platform')
  await upsertHomeAbout('tenant-1', input({ heading: 'Working B' }))
  assert.equal(aboutSection(await getPublicSite('tenant-1', previewEnv)).content.heading, 'Working B')
  assert.equal(aboutSection(await getPublicSite('tenant-1', normalEnv)).content.heading, 'Published A')

  await composeHomeSections('tenant-1', { sectionIds: ['hero'] })
  assert.equal(aboutSection(await getSite('tenant-1')), undefined)
  assert.equal(aboutSection(await getPublicSite('tenant-1', normalEnv)).content.heading, 'Published A')
  const readded = await upsertHomeAbout('tenant-1', input({ heading: 'Re-added' }))
  assert.deepEqual(readded.pages[0].sections.map((section) => section.type), ['hero', 'about'])
  await publishSite('tenant-1', 'platform')
  assert.equal(aboutSection(await getPublicSite('tenant-1', normalEnv)).content.heading, 'Re-added')
})

test('old working and published sites without About remain unchanged', async () => {
  assert.deepEqual((await getSite('tenant-1')).pages[0].sections.map((section) => section.type), ['hero'])
  await publishSite('tenant-1', 'platform')
  assert.deepEqual((await getPublicSite('tenant-1', normalEnv)).pages[0].sections.map((section) => section.type), ['hero'])
})
