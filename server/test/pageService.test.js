import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  MAX_PAGES,
  MAX_PUBLISHED_SNAPSHOT_BYTES,
  addSection,
  createPage,
  deletePage,
  getPublishedSiteDefinition,
  getSite,
  initializeSite,
  movePage,
  moveSection,
  publishSite,
  setSectionVisibility,
  updatePage,
  updateSectionContent
} from '../services/siteService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb

beforeEach(() => {
  fakeDb = new FakeDb()
  _setDb(fakeDb)
  fakeDb.seed('tenants/tenant-1', { name: 'Page test business' })
  fakeDb.seed('tenants/tenant-2', { name: 'Other business' })
})

afterEach(() => _setDb())

const page = async (title, slug) => createPage('tenant-1', { title, slug })

test('page CRUD uses UUID identity, authoritative pageOrder, canonical slugs, and Home restrictions', async () => {
  await initializeSite('tenant-1', 'admin')
  const created = await page('Contact us', 'contact')
  assert.match(created.pageId, /^[0-9a-f-]{36}$/)
  assert.equal(created.site.pages[1].id, created.pageId)
  assert.deepEqual(created.site.pages[1], {
    id: created.pageId, slug: 'contact', title: 'Contact us', sections: []
  })
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config').pageOrder, ['home', created.pageId])
  assert.equal(fakeDb.data(`tenants/tenant-1/site/config/pages/${created.pageId}`).slug, 'contact')

  const renamed = await updatePage('tenant-1', created.pageId, { title: 'Get in touch' })
  assert.deepEqual(renamed.pages.map(({ id, slug, title }) => ({ id, slug, title })), [
    { id: 'home', slug: '/', title: 'Home' },
    { id: created.pageId, slug: 'contact', title: 'Get in touch' }
  ])
  await assert.rejects(createPage('tenant-1', { title: 'Again', slug: 'contact' }), {
    status: 409, message: 'Page slug is already in use'
  })
  for (const slug of ['Not-canonical', 'two--hyphens', '-leading', 'trailing-', 'site', 'preview']) {
    await assert.rejects(createPage('tenant-1', { title: 'Invalid', slug }), { status: 400 })
  }
  await assert.rejects(updatePage('tenant-1', 'home', { title: 'Not Home' }), { status: 400 })
  await assert.rejects(updatePage('tenant-1', 'home', { slug: 'welcome' }), { status: 400 })
  await assert.rejects(movePage('tenant-1', 'home', 'down'), { status: 400 })
  await assert.rejects(deletePage('tenant-1', 'home'), { status: 400 })
})

test('page membership mutations preserve Home at index zero and leave old published pages live until publish', async () => {
  await initializeSite('tenant-1', 'admin')
  const first = await page('First', 'first')
  const second = await page('Second', 'second')
  const moved = await movePage('tenant-1', second.pageId, 'up')
  assert.deepEqual(moved.pages.map((item) => item.id), ['home', second.pageId, first.pageId])
  await assert.rejects(movePage('tenant-1', second.pageId, 'up'), { status: 400 })
  await publishSite('tenant-1', 'admin')
  await deletePage('tenant-1', second.pageId)
  assert.deepEqual((await getSite('tenant-1')).pages.map((item) => item.id), ['home', first.pageId])
  assert.deepEqual((await getPublishedSiteDefinition('tenant-1')).pages.map((item) => item.id), ['home', second.pageId, first.pageId])
  await publishSite('tenant-1', 'admin')
  assert.deepEqual((await getPublishedSiteDefinition('tenant-1')).pages.map((item) => item.id), ['home', first.pageId])
})

test('page-aware composition permits empty non-Home pages and keeps Hero, Contact, and section commands scoped', async () => {
  await initializeSite('tenant-1', 'admin')
  const first = await page('First', 'first')
  const second = await page('Second', 'second')
  await assert.rejects(addSection('tenant-1', first.pageId, 'hero'), { status: 400 })
  const firstContact = await addSection('tenant-1', first.pageId, 'contact')
  const secondContact = await addSection('tenant-1', second.pageId, 'contact')
  await assert.rejects(addSection('tenant-1', first.pageId, 'contact'), { status: 409 })
  const services = await addSection('tenant-1', first.pageId, 'services')
  await updateSectionContent('tenant-1', first.pageId, services.sectionId, {
    title: 'Services', items: [{ name: 'Bread', description: 'Fresh bread' }]
  })
  await moveSection('tenant-1', first.pageId, services.sectionId, 'up')
  await setSectionVisibility('tenant-1', first.pageId, services.sectionId, true)
  const site = await getSite('tenant-1')
  assert.equal(site.pages.find((item) => item.id === first.pageId).sections.some((item) => item.id === firstContact.sectionId), true)
  assert.equal(site.pages.find((item) => item.id === second.pageId).sections.some((item) => item.id === secondContact.sectionId), true)
  assert.deepEqual(site.pages.find((item) => item.id === second.pageId).sections.map((item) => item.type), ['contact'])
})

test('missing legacy pageOrder reads as Home-only without a read repair, and page creation persists membership', async () => {
  await initializeSite('tenant-1', 'admin')
  const configPath = 'tenants/tenant-1/site/config'
  const config = fakeDb.data(configPath)
  delete config.pageOrder
  fakeDb.seed(configPath, config)
  const legacy = await getSite('tenant-1')
  assert.deepEqual(legacy.pages.map((item) => item.id), ['home'])
  assert.equal(Object.hasOwn(fakeDb.data(configPath), 'pageOrder'), false)
  const created = await page('One page', 'one-page')
  assert.deepEqual(fakeDb.data(configPath).pageOrder, ['home', created.pageId])
})

test('the server page cap includes Home and rejects a twenty-sixth page', async () => {
  await initializeSite('tenant-1', 'admin')
  for (let index = 1; index < MAX_PAGES; index++) {
    await page(`Page ${index}`, `page-${index}`)
  }
  await assert.rejects(page('Too many', 'too-many'), {
    status: 400, message: `Sites can have at most ${MAX_PAGES} pages`
  })
})

test('publish applies a conservative snapshot-size guard without replacing the current publication', async () => {
  await initializeSite('tenant-1', 'admin')
  await publishSite('tenant-1', 'admin')
  const publishedPath = 'tenants/tenant-1/site/config/published/current'
  const before = fakeDb.data(publishedPath)
  const configPath = 'tenants/tenant-1/site/config'
  const config = fakeDb.data(configPath)
  config.customCss = 'a{color:red;}\n'.repeat(Math.ceil(MAX_PUBLISHED_SNAPSHOT_BYTES / 14) + 1)
  fakeDb.seed(configPath, config)
  await assert.rejects(publishSite('tenant-1', 'admin'), {
    status: 400, message: 'Published site is too large to store safely'
  })
  assert.deepEqual(fakeDb.data(publishedPath), before)
})

test('publish retries when a concurrently changed Page B document was already read', async () => {
  await initializeSite('tenant-1', 'admin')
  await page('Page A', 'page-a')
  const pageB = await page('Page B', 'page-b')
  const about = await addSection('tenant-1', pageB.pageId, 'about')
  await updateSectionContent('tenant-1', pageB.pageId, about.sectionId, {
    heading: 'Previous Page B heading', body: 'Previous Page B body'
  })

  const attemptsBeforePublish = fakeDb.transactionAttempts
  let interleaved = false
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    interleaved = true
    await updateSectionContent('tenant-1', pageB.pageId, about.sectionId, {
      heading: 'New Page B heading', body: 'New Page B body'
    })
  }

  await publishSite('tenant-1', 'admin')

  assert.equal(interleaved, true)
  // One concurrent mutation plus two publish attempts proves the optimistic retry.
  assert.equal(fakeDb.transactionAttempts - attemptsBeforePublish, 3)
  const publishedPageB = (await getPublishedSiteDefinition('tenant-1')).pages.find((candidate) => candidate.id === pageB.pageId)
  assert.deepEqual(publishedPageB?.sections.find((candidate) => candidate.id === about.sectionId)?.content, {
    heading: 'New Page B heading', body: 'New Page B body'
  })
})
