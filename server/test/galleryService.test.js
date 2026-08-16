import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb as setSiteDb,
  getPublicSite,
  getSite,
  initializeSite,
  publishSite,
  upsertHomeContact,
  upsertHomeGallery,
  upsertHomeServices
} from '../services/siteService.js'
import {
  _setDb as setMediaDb,
  _setStorage,
  listMedia
} from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

let fakeDb
let fakeStorage
const normalEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }
const previewEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }
const tenantPath = (tenantId = 'tenant-1') => `tenants/${tenantId}`
const homePath = (tenantId = 'tenant-1') => `${tenantPath(tenantId)}/site/config/pages/home`
const publishedPath = (tenantId = 'tenant-1') => `${tenantPath(tenantId)}/site/config/published/current`
const mediaPath = (mediaId, tenantId = 'tenant-1') => `${tenantPath(tenantId)}/media/${mediaId}`
const mediaRecord = (mediaId, overrides = {}) => ({
  originalFilename: `${mediaId}.png`,
  objectName: `tenants/tenant-1/media/${mediaId}`,
  contentType: 'image/png',
  sizeBytes: 40,
  width: 640,
  height: 480,
  createdAt: 10,
  createdByUserId: 'platform',
  ...overrides
})
const gallerySection = (site) => site.pages[0].sections.find((section) => section.type === 'gallery')

beforeEach(async () => {
  fakeDb = new FakeDb().seed(tenantPath(), { name: 'Business' })
  fakeStorage = new FakeStorage()
  setSiteDb(fakeDb)
  setMediaDb(fakeDb)
  _setStorage(fakeStorage)
  await initializeSite('tenant-1', 'platform')
})

afterEach(() => {
  setSiteDb()
  setMediaDb()
  _setStorage()
})

test('upsertHomeGallery inserts before Contact and persists provider-neutral items', async () => {
  await upsertHomeServices('tenant-1', { title: 'Services', items: [{ name: 'One' }] })
  await upsertHomeContact('tenant-1', {
    title: 'Contact', buttonLabel: 'Email', action: { type: 'email', value: 'hello@example.com' }
  })
  fakeDb.seed(mediaPath('media-a'), mediaRecord('media-a'))
  const result = await upsertHomeGallery('tenant-1', {
    title: '  Recent Work  ',
    items: [{ mediaId: 'media-a', altText: '  Finished kitchen  ', src: 'https://evil.test/x' }]
  })
  assert.deepEqual(result.pages[0].sections.map((section) => section.type), [
    'hero', 'services', 'gallery', 'contact'
  ])
  const hydrated = gallerySection(result)
  assert.equal(hydrated.content.title, 'Recent Work')
  assert.equal(hydrated.content.items[0].altText, 'Finished kitchen')
  assert.equal(hydrated.content.items[0].src, 'https://media.test/tenants/tenant-1/media/media-a')

  const persisted = fakeDb.data(homePath()).sections.find((section) => section.type === 'gallery')
  assert.deepEqual(Object.keys(persisted.content.items[0]).sort(), ['altText', 'id', 'mediaId'])
  assert.equal(persisted.content.items[0].src, undefined)
})

test('Gallery appends without Contact and preserves its existing section index', async () => {
  fakeDb.seed(mediaPath('media-a'), mediaRecord('media-a'))
  fakeDb.seed(mediaPath('media-b'), mediaRecord('media-b'))
  const first = await upsertHomeGallery('tenant-1', {
    title: 'Gallery', items: [{ mediaId: 'media-a', altText: 'A' }]
  })
  assert.deepEqual(first.pages[0].sections.map((section) => section.type), ['hero', 'gallery'])
  const itemId = gallerySection(first).content.items[0].id
  await upsertHomeServices('tenant-1', { title: 'Services', items: [{ name: 'One' }] })
  const updated = await upsertHomeGallery('tenant-1', {
    title: 'Updated', items: [{ id: itemId, mediaId: 'media-b', altText: 'B' }]
  })
  assert.deepEqual(updated.pages[0].sections.map((section) => section.type), [
    'hero', 'services', 'gallery'
  ])
})

test('Gallery validates title, bounds, contextual alt text, and duplicate media', async () => {
  fakeDb.seed(mediaPath('media-a'), mediaRecord('media-a'))
  const invalid = [
    [{ title: '', items: [{ mediaId: 'media-a', altText: 'A' }] }, 'Gallery title is required'],
    [{ title: 'x'.repeat(101), items: [{ mediaId: 'media-a', altText: 'A' }] }, 'Gallery title must be 100 characters or fewer'],
    [{ title: 'Gallery', items: [] }, 'Gallery must include at least one image'],
    [{ title: 'Gallery', items: [{ mediaId: 'media-a' }] }, 'Gallery image alt text is required'],
    [{ title: 'Gallery', items: [{ mediaId: 'media-a', altText: '   ' }] }, 'Gallery image alt text is required'],
    [{ title: 'Gallery', items: [{ mediaId: 'media-a', altText: 'x'.repeat(251) }] }, 'Gallery image alt text must be 250 characters or fewer'],
    [{ title: 'Gallery', items: [{ mediaId: 'media-a', altText: 'A' }, { mediaId: 'media-a', altText: 'B' }] }, 'Duplicate gallery image']
  ]
  for (const [input, message] of invalid) {
    await assert.rejects(upsertHomeGallery('tenant-1', input), { status: 400, message })
  }
  await assert.rejects(upsertHomeGallery('tenant-1', {
    title: 'Gallery',
    items: Array.from({ length: 21 }, (_, index) => ({ mediaId: `media-${index}`, altText: 'A' }))
  }), { status: 400, message: 'Gallery cannot exceed 20 images' })
})

test('Gallery enforces same-tenant Media ownership with batched getAll', async () => {
  fakeDb.seed(tenantPath('tenant-2'), { name: 'Other' })
  fakeDb.seed(mediaPath('foreign', 'tenant-2'), mediaRecord('foreign', {
    objectName: 'tenants/tenant-2/media/foreign'
  }))
  await assert.rejects(upsertHomeGallery('tenant-1', {
    title: 'Gallery', items: [{ mediaId: 'missing', altText: 'Missing' }]
  }), { status: 400, message: 'Gallery image not found' })
  await assert.rejects(upsertHomeGallery('tenant-1', {
    title: 'Gallery', items: [{ mediaId: 'foreign', altText: 'Foreign' }]
  }), { status: 400, message: 'Gallery image not found' })
})

test('Gallery item identities are server-owned, stable, and corruption-aware', async () => {
  fakeDb.seed(mediaPath('media-a'), mediaRecord('media-a'))
  fakeDb.seed(mediaPath('media-b'), mediaRecord('media-b'))
  const first = await upsertHomeGallery('tenant-1', {
    title: 'Gallery', items: [{ mediaId: 'media-a', altText: 'A' }]
  })
  const id = gallerySection(first).content.items[0].id
  assert.match(id, /^[0-9a-f-]{36}$/)

  const updated = await upsertHomeGallery('tenant-1', {
    title: 'Gallery',
    items: [{ id, mediaId: 'media-b', altText: 'B', src: 'https://evil.test', width: 1, height: 1 }]
  })
  assert.equal(gallerySection(updated).content.items[0].id, id)
  const stored = fakeDb.data(homePath()).sections.find((section) => section.type === 'gallery')
  assert.deepEqual(stored.content.items[0], { id, mediaId: 'media-b', altText: 'B' })

  await assert.rejects(upsertHomeGallery('tenant-1', {
    title: 'Gallery', items: [{ id: 'unknown', mediaId: 'media-a', altText: 'A' }]
  }), { status: 400, message: 'Unknown gallery item id' })
  await assert.rejects(upsertHomeGallery('tenant-1', {
    title: 'Gallery',
    items: [
      { id, mediaId: 'media-a', altText: 'A' },
      { id, mediaId: 'media-b', altText: 'B' }
    ]
  }), { status: 400, message: 'Duplicate gallery item id' })

  const home = fakeDb.data(homePath())
  home.sections.find((section) => section.type === 'gallery').content.items.push({
    id, mediaId: 'media-a', altText: 'Duplicate stored id'
  })
  fakeDb.seed(homePath(), home)
  await assert.rejects(upsertHomeGallery('tenant-1', {
    title: 'Gallery', items: [{ id, mediaId: 'media-a', altText: 'A' }]
  }), { status: 500, message: 'Home gallery section invalid' })
})

test('Gallery reserved identity corruption fails controlled', async () => {
  fakeDb.seed(mediaPath('media-a'), mediaRecord('media-a'))
  for (const corrupt of [
    { id: 'gallery', type: 'future', content: {} },
    { id: 'future', type: 'gallery', content: {} }
  ]) {
    const home = fakeDb.data(homePath())
    home.sections = [home.sections[0], corrupt]
    fakeDb.seed(homePath(), home)
    await assert.rejects(upsertHomeGallery('tenant-1', {
      title: 'Gallery', items: [{ mediaId: 'media-a', altText: 'A' }]
    }), { status: 500, message: 'Home gallery section invalid' })
  }
})

test('working, preview, published, and republished Gallery states stay isolated', async () => {
  for (const id of ['a', 'b', 'c']) fakeDb.seed(mediaPath(id), mediaRecord(id))
  const first = await upsertHomeGallery('tenant-1', {
    title: 'Gallery',
    items: [{ mediaId: 'a', altText: 'A' }, { mediaId: 'b', altText: 'B' }]
  })
  const [aId] = gallerySection(first).content.items.map((item) => item.id)
  await publishSite('tenant-1', 'platform')
  const publishedBefore = structuredClone(fakeDb.data(publishedPath()))

  await upsertHomeGallery('tenant-1', {
    title: 'Gallery',
    items: [{ id: aId, mediaId: 'a', altText: 'A' }, { mediaId: 'c', altText: 'C' }]
  })
  const ids = (site) => gallerySection(site).content.items.map((item) => item.mediaId)
  assert.deepEqual(ids(await getSite('tenant-1')), ['a', 'c'])
  assert.deepEqual(ids(await getPublicSite('tenant-1', previewEnv)), ['a', 'c'])
  assert.deepEqual(ids(await getPublicSite('tenant-1', normalEnv)), ['a', 'b'])
  assert.deepEqual(fakeDb.data(publishedPath()), publishedBefore)

  await publishSite('tenant-1', 'platform')
  assert.deepEqual(ids(await getPublicSite('tenant-1', normalEnv)), ['a', 'c'])
  const persistedSnapshotItems = gallerySection(fakeDb.data(publishedPath()).siteDefinition).content.items
  assert.equal(persistedSnapshotItems.some((item) => Object.hasOwn(item, 'src')), false)
})

test('authenticated hydration preserves selected Media outside the recent 50 window', async () => {
  for (let index = 1; index <= 51; index += 1) {
    fakeDb.seed(mediaPath(`media-${index}`), mediaRecord(`media-${index}`, { createdAt: index }))
  }
  await upsertHomeGallery('tenant-1', {
    title: 'Gallery', items: [{ mediaId: 'media-1', altText: 'Old selected image' }]
  })
  const library = await listMedia('tenant-1')
  assert.equal(library.media.some((item) => item.id === 'media-1'), false)
  const selected = gallerySection(await getSite('tenant-1')).content.items[0]
  assert.equal(selected.mediaId, 'media-1')
  assert.equal(selected.src, 'https://media.test/tenants/tenant-1/media/media-1')
  assert.equal(selected.width, 640)
  assert.equal(selected.height, 480)
})

test('Gallery hydration skips missing or malformed Media and strips arbitrary URLs', async () => {
  fakeDb.seed(mediaPath('valid'), mediaRecord('valid'))
  fakeDb.seed(mediaPath('bad'), mediaRecord('bad', { width: -1 }))
  const home = fakeDb.data(homePath())
  home.sections.push({
    id: 'gallery',
    type: 'gallery',
    content: {
      title: 'Gallery',
      items: [
        { id: 'one', mediaId: 'valid', altText: 'Valid', src: 'https://evil.test' },
        { id: 'two', mediaId: 'missing', altText: 'Missing', src: 'https://evil.test' },
        { id: 'three', mediaId: 'bad', altText: 'Bad', src: 'https://evil.test' }
      ]
    }
  })
  fakeDb.seed(homePath(), home)
  const items = gallerySection(await getSite('tenant-1')).content.items
  assert.deepEqual(items, [{
    id: 'one',
    mediaId: 'valid',
    altText: 'Valid',
    src: 'https://media.test/tenants/tenant-1/media/valid',
    width: 640,
    height: 480
  }])
})
