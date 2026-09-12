import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import * as sites from '../services/siteService.js'
import * as media from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'
const tenant = 'tenant-1'
const configPath = `tenants/${tenant}/site/config`
const homePath = `${configPath}/pages/home`
const publishedPath = `${configPath}/published/current`
const mediaPath = `tenants/${tenant}/media/image`
const record = { originalFilename: 'image.png', objectName: mediaPath, contentType: 'image/png', sizeBytes: 1, width: 1, height: 1, createdAt: 1, createdByUserId: 'admin' }
let db
let storage
beforeEach(async () => {
  db = new FakeDb().seed(`tenants/${tenant}`, { name: 'Business' }).seed(mediaPath, record)
  storage = new FakeStorage()
  storage.objects.set(mediaPath, Buffer.from('bytes'))
  sites._setDb(db)
  media._setDb(db)
  media._setStorage(storage)
  await sites.initializeSite(tenant, 'admin')
})
afterEach(() => { sites._setDb(); media._setDb(); media._setStorage() })
const remove = () => media.deleteUnusedMedia(tenant, 'image')
const sectionByType = (type) => db.data(homePath).sections.find((section) => section.type === type)
const updateType = async (type, content) => {
  let section = sectionByType(type)
  if (!section) {
    await sites.addSection(tenant, 'home', type)
    section = sectionByType(type)
  }
  return sites.updateSectionContent(tenant, 'home', section.id, content)
}
const writers = [
  ['Logo', (id = 'image') => sites.updateSiteBranding(tenant, { siteName: 'Business', logoMediaId: id })],
  ['Favicon', (id = 'image') => sites.updateSiteBranding(tenant, { siteName: 'Business', faviconMediaId: id })],
  ['Social', (id = 'image') => sites.updateBusinessProfile(tenant, { socialImageMediaId: id })],
  ['About', (id = 'image') => updateType('about', { heading: 'About', body: 'Body', imageMediaId: id, imageAlt: 'Image' })],
  ['Gallery', (id = 'image') => updateType('gallery', { title: 'Gallery', items: [{ mediaId: id, altText: 'Image' }] })],
  ['Logos', (id = 'image') => updateType('logos', { heading: 'Trusted by', items: [{ mediaId: id, altText: 'Logo' }] })]
]
const refs = () => {
  const config = db.data(configPath)
  const pageOrder = config.pageOrder || ['home']
  const pages = pageOrder.map((pageId) => db.data(`${configPath}/pages/${pageId}`))
  return [
    ...media.collectSiteMediaIds({ ...config, pages }),
    ...media.collectSiteMediaIds(db.data(publishedPath)?.siteDefinition)
  ]
}
const assertIntact = () => {
  assert.ok(refs().includes('image'))
  assert.equal(db.data(mediaPath).deletion, undefined)
  assert.ok(storage.objects.has(mediaPath))
  assert.equal(storage.deletes.length, 0)
}
const assertRemoved = () => {
  assert.equal(refs().includes('image'), false)
  assert.equal(db.data(mediaPath), undefined)
  assert.equal(storage.objects.has(mediaPath), false)
}
const onceBeforeCommit = (action) => { db.beforeCommit = async () => { db.beforeCommit = null; await action() } }
for (const [name, write] of writers) {
  test(`${name}: writer commits in deletion gap; retried delete blocks`, async () => {
    const attempts = db.transactionAttempts
    onceBeforeCommit(write)
    await assert.rejects(remove(), { status: 400 })
    assertIntact()
    assert.equal(db.transactionAttempts - attempts, ['About', 'Gallery', 'Logos'].includes(name) ? 4 : 3)
  })
  test(`${name}: deletion commits in writer gap; writer rejects`, async () => {
    onceBeforeCommit(remove)
    await assert.rejects(write(), { status: 400, message: name === 'Logos' ? 'Logo image not found' : `${name} image not found` })
    assertRemoved()
  })
  test(`${name}: pending media rejects references with storage retained`, async () => {
    storage.deleteError = new Error('unavailable')
    await assert.rejects(remove(), { status: 502 })
    await assert.rejects(write(), { status: 400, message: name === 'Logos' ? 'Logo image not found' : `${name} image not found` })
    assert.equal(refs().includes('image'), false)
    assert.ok(storage.objects.has(mediaPath))
    assert.equal(db.data(mediaPath).deletion.state, 'PENDING')
  })
}
test('duplicate commits in deletion gap and copied media keeps deletion blocked', async () => {
  await writers[4][1]()
  const gallery = sectionByType('gallery')
  onceBeforeCommit(() => sites.duplicateSection(tenant, 'home', gallery.id))
  await assert.rejects(remove(), { status: 400, message: 'Image is still used as the working gallery' })
  assertIntact()
})

test('a concurrent Page-B media reference forces deletion to retry and then blocks it', async () => {
  onceBeforeCommit(async () => {
    const { pageId } = await sites.createPage(tenant, { title: 'Page B', slug: 'page-b' })
    const { sectionId } = await sites.addSection(tenant, pageId, 'gallery')
    await sites.updateSectionContent(tenant, pageId, sectionId, {
      title: 'Gallery', items: [{ mediaId: 'image', altText: 'Image' }]
    })
  })
  await assert.rejects(remove(), { status: 400, message: 'Image is still used as the working gallery' })
  assertIntact()
  assert.ok(db.transactionAttempts >= 4)
})

test('old unguarded writer pattern demonstrably leaves a dangling reference', async () => {
  await media.requireTenantMedia(tenant, ['image'])
  await remove()
  await db.runTransaction(async (tx) => {
    const ref = db.collection('tenants').doc(tenant).collection('site').doc('config')
    const config = (await tx.get(ref)).data()
    tx.set(ref, { ...config, branding: { ...config.branding, faviconMediaId: 'image' } })
  })
  assert.ok(refs().includes('image'))
  assert.equal(db.data(mediaPath), undefined)
  assert.equal(storage.objects.has(mediaPath), false)
})
for (const [name, edit] of [
  ['publish', () => sites.publishSite(tenant, 'admin')],
  ['composition', () => sites.setSectionVisibility(tenant, 'home', sectionByType('hero').id, false)],
  ['hero', () => sites.updateSectionContent(tenant, 'home', sectionByType('hero').id, { title: 'New title' })]
]) {
  test(`${name} commits first; deletion cannot leave references`, async () => { onceBeforeCommit(edit); await remove(); assertRemoved() })
  test(`${name} commits last; cannot resurrect deleted references`, async () => { onceBeforeCommit(remove); await edit(); assertRemoved() })
}
test('published reference retained after unpublish blocks deletion', async () => {
  await writers[1][1]()
  await sites.publishSite(tenant, 'admin')
  await sites.updateSiteBranding(tenant, { siteName: 'Business' })
  await sites.unpublishSite(tenant)
  await assert.rejects(remove(), { status: 400, message: 'Image is still used in published revision history' })
  assertIntact()
})

test('a retained revision manifest protects media without scanning historical snapshots and releases it after pruning', async () => {
  await writers[1][1]()
  await sites.publishSite(tenant, 'publisher')
  await sites.updateSiteBranding(tenant, { siteName: 'Business' })
  await sites.publishSite(tenant, 'publisher')

  await assert.rejects(remove(), { status: 400, message: 'Image is still used in published revision history' })
  assert.ok(db.data(mediaPath))
  assert.ok(storage.objects.has(mediaPath))

  for (let index = 0; index < 9; index += 1) await sites.publishSite(tenant, 'publisher')
  await remove()
  assertRemoved()
})

test('prune and media deletion serialize on the revision index before the last retained manifest disappears', async () => {
  await writers[1][1]()
  await sites.publishSite(tenant, 'publisher')
  await sites.updateSiteBranding(tenant, { siteName: 'Business' })
  for (let index = 0; index < 9; index += 1) await sites.publishSite(tenant, 'publisher')

  onceBeforeCommit(async () => {
    await assert.rejects(remove(), { status: 400, message: 'Image is still used in published revision history' })
  })
  await sites.publishSite(tenant, 'publisher')
  await remove()
  assertRemoved()
})

test('legacy baseline capture cannot race a media delete past its retained manifest', async () => {
  await writers[1][1]()
  await sites.publishSite(tenant, 'publisher-a')
  const legacy = db.data(publishedPath)
  const oldRevisionId = legacy.revisionId
  delete legacy.revisionId
  db.seed(publishedPath, legacy)
  db.remove(`${configPath}/revisions/${oldRevisionId}`)
  db.remove(`${configPath}/revisionMedia/${oldRevisionId}`)
  db.remove(`${configPath}/revisionIndex/current`)
  await sites.updateSiteBranding(tenant, { siteName: 'Business' })

  onceBeforeCommit(async () => {
    await assert.rejects(remove(), { status: 400, message: 'Image is still used as the published favicon' })
  })
  await sites.publishSite(tenant, 'publisher-b')
  const baseline = db.data(`${configPath}/revisionIndex/current`).entries[1]
  assert.deepEqual(db.data(`${configPath}/revisionMedia/${baseline.revisionId}`), { mediaIds: ['image'] })
  assert.ok(db.data(mediaPath))
  assert.ok(storage.objects.has(mediaPath))
  assert.equal(storage.deletes.length, 0)
})
test('duplicate deletes that observed marker converge; fresh request404', async () => {
  const original = storage.deleteObject.bind(storage)
  let first = true
  storage.deleteObject = async (name) => {
    if (first) { first = false; await remove() }
    return original(name)
  }
  await remove()
  assertRemoved()
  assert.equal(storage.deletes.length, 2)
  await assert.rejects(remove(), { status: 404, message: 'Media not found' })
})
for (const ambiguous of [false, true]) {
  test(`storage failure (ambiguous=${ambiguous}) retains recovery and retry converges`, async () => {
    storage[ambiguous ? 'afterDeleteError' : 'deleteError'] = new Error('secret provider detail')
    await assert.rejects(remove(), { status: 502, expose: true, message: 'Image bytes were not deleted. Retry the deletion.' })
    assert.equal(db.data(mediaPath).deletion.state, 'PENDING')
    assert.equal(storage.objects.has(mediaPath), !ambiguous)
    const listed = await media.listMedia(tenant)
    assert.deepEqual(listed.media, [])
    assert.deepEqual(listed.pendingDeletions, [{ id: 'image', originalFilename: 'image.png', createdAt: 1 }])
    storage.deleteError = null
    storage.afterDeleteError = null
    await remove()
    assertRemoved()
  })
  test(`finalization failure (ambiguous=${ambiguous}) is recoverable`, async () => {
    const original = db.remove.bind(db)
    db.remove = (path) => { if (ambiguous) original(path); throw new Error('metadata error') }
    await assert.rejects(remove(), { status: 502, expose: true, message: 'Image cleanup did not finish. Retry the deletion.' })
    assert.equal(storage.objects.has(mediaPath), false)
    assert.equal(refs().includes('image'), false)
    db.remove = original
    if (ambiguous) await assert.rejects(remove(), { status: 404 })
    else { assert.equal(db.data(mediaPath).deletion.state, 'PENDING'); await remove() }
    assertRemoved()
  })
}
test('ambiguous marker commit never touches storage; reload/retry recovers', async () => {
  db.afterCommit = () => { throw new Error('acknowledgement lost') }
  await assert.rejects(remove(), /acknowledgement lost/)
  assert.equal(storage.deletes.length, 0)
  assert.equal(db.data(mediaPath).deletion.state, 'PENDING')
  assert.equal((await media.listMedia(tenant)).pendingDeletions[0].id, 'image')
  db.afterCommit = null
  await remove()
  assertRemoved()
})
test('retry exhaustion does not persist buffered marker or touch storage', async () => {
  db.beforeCommit = () => db.write(configPath, { ...db.data(configPath), updatedAt: 1 })
  await assert.rejects(remove(), { code: 10 })
  assert.equal(storage.deletes.length, 0)
  assert.equal(db.data(mediaPath).deletion, undefined)
  assert.ok(storage.objects.has(mediaPath))
})
test('pending hydration removes URLs and Gallery/Logo items from working and published reads', async () => {
  for (const [, write] of writers) await write()
  await sites.updateSiteBranding(tenant, { siteName: 'Business', logoMediaId: 'image', faviconMediaId: 'image' })
  const before = await sites.getSite(tenant)
  assert.ok(before.branding.logoSrc)
  assert.ok(before.branding.faviconSrc)
  await sites.publishSite(tenant, 'admin')
  db.write(mediaPath, { deletion: { state: 'PENDING', requestedAt: 10 } }, { merge: true })
  for (const definition of [await sites.getSite(tenant), await sites.getPublishedSiteDefinition(tenant)]) {
    assert.equal(definition.branding.logoSrc, undefined)
    assert.equal(definition.branding.faviconSrc, undefined)
    assert.equal(definition.businessProfile.socialImageSrc, undefined)
    assert.equal(definition.pages[0].sections.find((s) => s.type === 'about').content.imageSrc, undefined)
    assert.deepEqual(definition.pages[0].sections.find((s) => s.type === 'gallery').content.items, [])
    assert.deepEqual(definition.pages[0].sections.find((s) => s.type === 'logos').content.items, [])
  }
})
test('pending query finds old items beyond newest50 and is bounded and tenant scoped', async () => {
  for (let i = 0; i < 60; i++) db.seed(`tenants/${tenant}/media/new-${i}`, { ...record, createdAt: 100 + i })
  for (let i = 0; i < 28; i++) db.seed(`tenants/${tenant}/media/pending-${i}`, { ...record, deletion: { state: 'PENDING' } })
  db.seed('tenants/other', { name: 'Other' }).seed('tenants/other/media/other-image', { ...record, deletion: { state: 'PENDING' } })
  const result = await media.listMedia(tenant)
  assert.equal(result.media.length, 50)
  assert.equal(result.pendingDeletions.length, 25)
  assert.equal(result.pendingHasMore, true)
  assert.ok(result.pendingDeletions.every((item) => item.id.startsWith('pending-') && Object.keys(item).length === 3))
  await assert.rejects(media.deleteUnusedMedia(tenant, 'other-image'), { status: 404 })
  assert.ok(db.data('tenants/other/media/other-image'))
  assert.equal(storage.deletes.length, 0)
})

test('section removal overlapping deletion permits deletion only after reference removal commits', async () => {
  await writers[3][1]()
  onceBeforeCommit(async () => { await assert.rejects(remove(), { status: 400 }); assertIntact() })
  await sites.removeSection(tenant, 'home', sectionByType('about').id)
  await remove()
  assertRemoved()
})

test('list read skew keeps a newly pending id out of active results', async () => {
  const ref = db.collection('tenants').doc(tenant).collection('media')
  const queryPrototype = Object.getPrototypeOf(ref.orderBy('createdAt'))
  const original = queryPrototype.get
  queryPrototype.get = async function () {
    const result = await original.call(this)
    if (this.orderField === 'createdAt') db.write(mediaPath, { deletion: { state: 'PENDING' } }, { merge: true })
    return result
  }
  try {
    const listed = await media.listMedia(tenant)
    assert.deepEqual(listed.media, [])
    assert.equal(listed.pendingDeletions[0].id, 'image')
  } finally { queryPrototype.get = original }
})

for (const [name, write] of writers) {
  for (const deletionFirst of [false, true]) {
    test(name + ': existing reference replacement, deletionFirst=' + deletionFirst, async () => {
      const otherPath = 'tenants/' + tenant + '/media/other'
      db.seed(otherPath, { ...record, objectName: otherPath })
      storage.objects.set(otherPath, Buffer.from('other'))
      await write('other')
      assert.ok(refs().includes('other'))
      if (deletionFirst) {
        onceBeforeCommit(remove)
        await assert.rejects(write(), { status: 400, message: name === 'Logos' ? 'Logo image not found' : name + ' image not found' })
        assert.ok(refs().includes('other'))
        assertRemoved()
      } else {
        onceBeforeCommit(write)
        await assert.rejects(remove(), { status: 400 })
        assertIntact()
      }
      assert.ok(db.data(otherPath))
      assert.ok(storage.objects.has(otherPath))
    })
  }
}
