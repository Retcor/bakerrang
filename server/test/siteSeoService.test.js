import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  createPage,
  deletePage,
  getSite,
  initializeSite,
  publishSite,
  updatePageSeo,
  updateSiteSeo
} from '../services/siteService.js'
import { _setDb as setMediaDb, _setStorage as setMediaStorage, deleteUnusedMedia } from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

let fakeDb
let fakeStorage
beforeEach(() => {
  fakeDb = new FakeDb()
  fakeStorage = new FakeStorage()
  _setDb(fakeDb)
  setMediaDb(fakeDb)
  setMediaStorage(fakeStorage)
  fakeDb.seed('tenants/tenant-1', { name: 'SEO Test' })
})
afterEach(() => { _setDb(); setMediaDb(); setMediaStorage() })

const seedMedia = (id) => fakeDb.seed(`tenants/tenant-1/media/${id}`, {
  originalFilename: 'image.png', objectName: `tenants/tenant-1/media/${id}`, contentType: 'image/png', sizeBytes: 1, width: 1200, height: 630, createdAt: 1, createdByUserId: 'admin'
})

test('site SEO normalizes legacy reads without repair and atomically updates its canonical social image', async () => {
  await initializeSite('tenant-1', 'admin')
  const configPath = 'tenants/tenant-1/site/config'
  const config = fakeDb.data(configPath)
  config.businessProfile = { phone: '+1 303 555 0199', businessHours: { monday: { closed: true } } }
  fakeDb.seed(configPath, config)
  assert.equal((await getSite('tenant-1')).seo, undefined)
  assert.equal(Object.hasOwn(fakeDb.data(configPath), 'seo'), false)
  seedMedia('social')
  const site = await updateSiteSeo('tenant-1', { defaultDescription: '  Site description  ', indexable: false, socialImageMediaId: 'social' })
  assert.deepEqual(site.seo, { defaultDescription: 'Site description', indexable: false })
  assert.equal(site.businessProfile?.socialImageMediaId, 'social')
  assert.equal(fakeDb.data(configPath).businessProfile.phone, '+1 303 555 0199')
  assert.equal(fakeDb.data(configPath).businessProfile.businessHours.monday.closed, true)
  await updateSiteSeo('tenant-1', { defaultDescription: '   ', indexable: true, socialImageMediaId: null })
  assert.deepEqual(fakeDb.data(configPath).seo, { indexable: true })
  assert.equal(Object.hasOwn(fakeDb.data(configPath).businessProfile, 'socialImageMediaId'), false)
  for (const input of [{ defaultDescription: 'x'.repeat(501) }, { indexable: 'yes' }, { unknown: true }, { socialImageMediaId: 'missing' }]) {
    await assert.rejects(updateSiteSeo('tenant-1', input), { status: 400 })
  }
})

test('page SEO is page-id-owned, validates media transactionally, and publishes coherently', async () => {
  await initializeSite('tenant-1', 'admin')
  const page = await createPage('tenant-1', { title: 'Services', slug: 'services' })
  seedMedia('page-image')
  const home = await updatePageSeo('tenant-1', 'home', { title: '  Home SEO  ', description: '  Home description ', noIndex: true })
  assert.deepEqual(home.pages.find((item) => item.id === 'home')?.seo, { title: 'Home SEO', description: 'Home description', noIndex: true })
  const saved = await updatePageSeo('tenant-1', page.pageId, { title: ' Services SEO ', description: ' Details ', socialImageMediaId: 'page-image' })
  const stored = fakeDb.data(`tenants/tenant-1/site/config/pages/${page.pageId}`)
  assert.equal(stored.title, 'Services')
  assert.equal(stored.slug, 'services')
  assert.deepEqual(stored.sections, [])
  assert.deepEqual(stored.seo, { title: 'Services SEO', description: 'Details', socialImageMediaId: 'page-image' })
  assert.equal(Object.hasOwn(stored.seo, 'socialImageSrc'), false)
  assert.match(saved.pages.find((item) => item.id === page.pageId)?.seo?.socialImageSrc || '', /page-image/)
  for (const input of [{ title: 'x'.repeat(121) }, { description: 'x'.repeat(501) }, { noIndex: 'no' }, { unknown: true }, { socialImageMediaId: 'missing' }]) {
    await assert.rejects(updatePageSeo('tenant-1', page.pageId, input), { status: 400 })
  }
  await assert.rejects(updatePageSeo('tenant-1', 'missing', { title: 'No' }), { status: 404 })
  await publishSite('tenant-1', 'admin')
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current').siteDefinition.pages.find((item) => item.id === page.pageId)?.seo, stored.seo)
})

test('page SEO media references and deletion retry instead of creating dangling media', async () => {
  await initializeSite('tenant-1', 'admin')
  seedMedia('race-image')
  const mediaPath = 'tenants/tenant-1/media/race-image'
  fakeStorage.objects.set(fakeDb.data(mediaPath).objectName, Buffer.from('image'))

  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await updatePageSeo('tenant-1', 'home', { socialImageMediaId: 'race-image' })
  }
  await assert.rejects(deleteUnusedMedia('tenant-1', 'race-image'), {
    status: 400, message: 'Image is still used as the working page SEO social image'
  })
  assert.ok(fakeDb.data(mediaPath))
  assert.ok(fakeStorage.objects.has(fakeDb.data(mediaPath).objectName))

  await updatePageSeo('tenant-1', 'home', {})
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await deleteUnusedMedia('tenant-1', 'race-image')
  }
  await assert.rejects(updatePageSeo('tenant-1', 'home', { socialImageMediaId: 'race-image' }), {
    status: 400, message: 'Page SEO social image not found'
  })
  assert.equal(fakeDb.data(mediaPath), undefined)
})

test('site SEO social-image mutation retries against concurrent media deletion', async () => {
  await initializeSite('tenant-1', 'admin')
  seedMedia('site-race-image')
  const mediaPath = 'tenants/tenant-1/media/site-race-image'
  fakeStorage.objects.set(fakeDb.data(mediaPath).objectName, Buffer.from('image'))

  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await updateSiteSeo('tenant-1', { socialImageMediaId: 'site-race-image' })
  }
  await assert.rejects(deleteUnusedMedia('tenant-1', 'site-race-image'), {
    status: 400, message: 'Image is still used as the working social image'
  })

  await updateSiteSeo('tenant-1', { socialImageMediaId: null })
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await deleteUnusedMedia('tenant-1', 'site-race-image')
  }
  await assert.rejects(updateSiteSeo('tenant-1', { socialImageMediaId: 'site-race-image' }), {
    status: 400, message: 'SEO social image not found'
  })
  assert.equal(fakeDb.data(mediaPath), undefined)
})

test('publish retries so its snapshot contains the concurrently saved page SEO', async () => {
  await initializeSite('tenant-1', 'admin')
  const page = await createPage('tenant-1', { title: 'Services', slug: 'services' })
  await updatePageSeo('tenant-1', page.pageId, { title: 'Before publish' })
  const attempts = fakeDb.transactionAttempts
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await updatePageSeo('tenant-1', page.pageId, { title: 'Published title', noIndex: true })
  }

  await publishSite('tenant-1', 'admin')

  assert.equal(fakeDb.transactionAttempts - attempts, 3)
  assert.deepEqual(
    fakeDb.data('tenants/tenant-1/site/config/published/current').siteDefinition.pages.find((item) => item.id === page.pageId)?.seo,
    { title: 'Published title', noIndex: true }
  )
})

test('publish retries so its snapshot contains concurrently saved site SEO', async () => {
  await initializeSite('tenant-1', 'admin')
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await updateSiteSeo('tenant-1', { defaultDescription: 'Published global description', indexable: false })
  }

  await publishSite('tenant-1', 'admin')

  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current').siteDefinition.seo, {
    defaultDescription: 'Published global description', indexable: false
  })
})

test('page SEO retries against a concurrent page deletion and cannot recreate the page', async () => {
  await initializeSite('tenant-1', 'admin')
  const page = await createPage('tenant-1', { title: 'Services', slug: 'services' })
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await deletePage('tenant-1', page.pageId)
  }

  await assert.rejects(updatePageSeo('tenant-1', page.pageId, { title: 'Stale write' }), {
    status: 404, message: 'Page not found'
  })
  assert.equal(fakeDb.data(`tenants/tenant-1/site/config/pages/${page.pageId}`), undefined)
})
