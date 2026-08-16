import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  _setStorage,
  createMedia,
  listMedia
} from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

const images = {
  png: Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000030802000000', 'hex'),
  webp: Buffer.from('524946461600000057454250565038580a00000000000000010000020000', 'hex'),
  jpg: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/9k=', 'base64')
}

let fakeDb
let fakeStorage
const tenantPath = (tenantId = 'tenant-1') => `tenants/${tenantId}`
const mediaPath = (mediaId, tenantId = 'tenant-1') => `${tenantPath(tenantId)}/media/${mediaId}`
const file = (type, buffer = images.png, originalname = 'image.png') => ({
  mimetype: type,
  buffer,
  originalname
})

beforeEach(() => {
  fakeDb = new FakeDb().seed(tenantPath(), { name: 'Business' })
  fakeStorage = new FakeStorage()
  _setDb(fakeDb)
  _setStorage(fakeStorage)
})

afterEach(() => {
  _setDb()
  _setStorage()
})

test('createMedia detects canonical JPEG, PNG, and WebP metadata', async (t) => {
  t.mock.method(Date, 'now', () => 1234)
  const cases = [
    ['image/jpeg', images.jpg, 'photo.jpg', 1, 1],
    ['image/png', images.png, 'photo.png', 2, 3],
    ['image/webp', images.webp, 'photo.webp', 2, 3]
  ]
  for (const [contentType, bytes, originalname, width, height] of cases) {
    const created = await createMedia('tenant-1', file(contentType, bytes, originalname), 'platform')
    assert.equal(created.contentType, contentType)
    assert.equal(created.width, width)
    assert.equal(created.height, height)
    const stored = fakeDb.data(mediaPath(created.id))
    assert.deepEqual(stored, {
      originalFilename: originalname,
      objectName: `tenants/tenant-1/media/${created.id}`,
      contentType,
      sizeBytes: bytes.length,
      width,
      height,
      createdAt: 1234,
      createdByUserId: 'platform'
    })
  }
})

test('createMedia rejects unsupported, mismatched, empty, and malformed images', async () => {
  const invalid = [
    file('image/svg+xml', Buffer.from('<svg/>'), 'image.svg'),
    file('image/gif', Buffer.from('GIF89a'), 'image.gif'),
    file('application/octet-stream', images.png, 'image.bin'),
    file('image/png', Buffer.alloc(0), 'empty.png'),
    file('image/jpeg', images.png, 'mismatch.jpg'),
    file('image/png', Buffer.from('not an image'), 'fake.png')
  ]
  for (const input of invalid) {
    await assert.rejects(createMedia('tenant-1', input, 'platform'), { status: 400 })
  }
  assert.equal(fakeStorage.puts.length, 0)
  assert.equal(fakeDb.paths().some((path) => path.includes('/media/')), false)
})

test('createMedia owns opaque naming, normalizes filename, and requests immutable create-only storage', async () => {
  const first = await createMedia('tenant-1', file('image/png', images.png, '..\\private/path/photo.png'), 'platform')
  const second = await createMedia('tenant-1', file('image/png', images.png, 'photo.png'), 'platform')
  assert.notEqual(first.id, second.id)
  assert.equal(first.originalFilename, 'photo.png')
  assert.equal(fakeStorage.puts[0].objectName, `tenants/tenant-1/media/${first.id}`)
  assert.equal(fakeStorage.puts[0].contentType, 'image/png')
  assert.equal(fakeStorage.puts[0].cacheControl, 'public, max-age=31536000, immutable')
  assert.deepEqual(fakeStorage.puts[0].preconditionOpts, { ifGenerationMatch: 0 })
  assert.equal(Object.hasOwn(fakeDb.data(mediaPath(first.id)), 'id'), false)
})

test('createMedia verifies tenant existence before object storage', async () => {
  await assert.rejects(createMedia('missing', file('image/png'), 'platform'), {
    status: 404, message: 'Tenant not found'
  })
  assert.equal(fakeStorage.puts.length, 0)
})

test('storage failure leaves no metadata and create-only collisions are controlled', async () => {
  fakeStorage.putError = new Error('storage unavailable')
  await assert.rejects(createMedia('tenant-1', file('image/png'), 'platform'), {
    message: 'storage unavailable'
  })
  assert.equal(fakeDb.paths().some((path) => path.includes('/media/')), false)

  fakeStorage.putError = Object.assign(new Error('collision'), { code: 412 })
  await assert.rejects(createMedia('tenant-1', file('image/png'), 'platform'), {
    status: 409, message: 'Media upload conflict'
  })
})

test('definitive metadata failure attempts best-effort object cleanup', async () => {
  class FailingMetadataDb extends FakeDb {
    write (path, value, options) {
      if (path.includes('/media/')) throw new Error('metadata failed')
      return super.write(path, value, options)
    }
  }
  fakeDb = new FailingMetadataDb().seed(tenantPath(), { name: 'Business' })
  _setDb(fakeDb)
  await assert.rejects(createMedia('tenant-1', file('image/png'), 'platform'), {
    message: 'metadata failed'
  })
  assert.equal(fakeStorage.deletes.length, 1)
  assert.equal(fakeStorage.objects.size, 0)
})

test('listMedia is bounded, newest-first, tenant-scoped, and sanitized', async () => {
  fakeDb.seed(tenantPath('tenant-2'), { name: 'Other' })
  const record = (createdAt, overrides = {}) => ({
    originalFilename: `image-${createdAt}.png`,
    objectName: `tenants/tenant-1/media/media-${createdAt}`,
    contentType: 'image/png',
    sizeBytes: images.png.length,
    width: 2,
    height: 3,
    createdAt,
    createdByUserId: 'platform',
    secret: 'drop',
    ...overrides
  })
  for (let index = 1; index <= 51; index += 1) {
    fakeDb.seed(mediaPath(`media-${index}`), record(index))
  }
  fakeDb.seed(mediaPath('foreign', 'tenant-2'), record(100, {
    objectName: 'tenants/tenant-2/media/foreign'
  }))
  const result = await listMedia('tenant-1')
  assert.equal(result.media.length, 50)
  assert.equal(result.hasMore, true)
  assert.equal(result.media[0].id, 'media-51')
  assert.equal(result.media.at(-1).id, 'media-2')
  assert.deepEqual(Object.keys(result.media[0]).sort(), [
    'contentType', 'createdAt', 'height', 'id', 'originalFilename', 'sizeBytes', 'src', 'width'
  ])
  assert.equal(result.media[0].src, 'https://media.test/tenants/tenant-1/media/media-51')
})

test('listMedia handles empty, exact-bound, malformed, and missing-tenant cases', async () => {
  assert.deepEqual(await listMedia('tenant-1'), { media: [], hasMore: false })
  const base = {
    originalFilename: 'image.png',
    objectName: 'object',
    contentType: 'image/png',
    sizeBytes: 20,
    width: 2,
    height: 3,
    createdByUserId: 'platform'
  }
  for (let index = 1; index <= 50; index += 1) {
    fakeDb.seed(mediaPath(`media-${index}`), { ...base, createdAt: index })
  }
  const exact = await listMedia('tenant-1')
  assert.equal(exact.hasMore, false)
  assert.equal(exact.media.length, 50)
  fakeDb.seed(mediaPath('malformed'), { ...base, createdAt: 60, width: -1 })
  const result = await listMedia('tenant-1')
  assert.equal(result.hasMore, true)
  assert.equal(result.media.length, 49)
  await assert.rejects(listMedia('missing'), { status: 404, message: 'Tenant not found' })
})
