import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  createPage,
  deletePage,
  getPublishedSiteDefinition,
  getSite,
  initializeSite,
  publishSite,
  updatePage,
  updateSiteFooter,
  updateSiteHeader
} from '../services/siteService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb

beforeEach(() => {
  fakeDb = new FakeDb()
  _setDb(fakeDb)
  fakeDb.seed('tenants/tenant-1', { name: 'Navigation Test' })
})

afterEach(() => _setDb())

const header = (items, extras = {}) => ({ brandDisplay: 'logo', navigation: { items }, ...extras })
const footer = (overrides = {}) => ({
  showBranding: true,
  navigationMode: 'header',
  showBusinessContact: false,
  showSocialLinks: true,
  showCopyright: true,
  ...overrides
})

test('Header and Footer normalize missing config on read without a repair write', async () => {
  await initializeSite('tenant-1', 'admin')
  const configPath = 'tenants/tenant-1/site/config'
  const config = fakeDb.data(configPath)
  delete config.header
  delete config.footer
  fakeDb.seed(configPath, config)

  const site = await getSite('tenant-1')
  assert.deepEqual(site.header, { brandDisplay: 'logo', navigation: { items: [] } })
  assert.deepEqual(site.footer, footer())
  assert.equal(Object.hasOwn(fakeDb.data(configPath), 'header'), false)
  assert.equal(Object.hasOwn(fakeDb.data(configPath), 'footer'), false)
})

test('Header and Footer validate page-only references, labels, CTA, modes, and duplicate identity', async () => {
  await initializeSite('tenant-1', 'admin')
  const services = await createPage('tenant-1', { title: 'Services', slug: 'services' })
  const savedHeader = await updateSiteHeader('tenant-1', header([
    { pageId: 'home', label: '  Start  ' },
    { pageId: services.pageId, label: '   ' }
  ], { cta: { buttonLabel: ' Call us ', action: { type: 'phone', value: '+1 (303) 555-0199' } } }))
  assert.deepEqual(savedHeader.header, {
    brandDisplay: 'logo',
    navigation: { items: [{ pageId: 'home', label: 'Start' }, { pageId: services.pageId }] },
    cta: { buttonLabel: 'Call us', action: { type: 'phone', value: '+1 (303) 555-0199' } }
  })
  const savedFooter = await updateSiteFooter('tenant-1', footer({
    navigationMode: 'custom',
    navigationItems: [{ pageId: services.pageId, label: ' Offerings ' }],
    text: '  Fresh every day.  '
  }))
  assert.deepEqual(savedFooter.footer.navigationItems, [{ pageId: services.pageId, label: 'Offerings' }])
  assert.equal(savedFooter.footer.text, 'Fresh every day.')

  for (const invalid of [
    header([{ pageId: 'missing' }]),
    header([{ pageId: services.pageId }, { pageId: services.pageId }]),
    header([{ pageId: services.pageId, id: 'not-allowed' }]),
    header([], { cta: { buttonLabel: 'Form', action: { type: 'leadForm' } } }),
    { brandDisplay: 'logo', navigation: { items: [] }, cta: { buttonLabel: 'Half' } }
  ]) await assert.rejects(updateSiteHeader('tenant-1', invalid), { status: 400 })
  for (const invalid of [
    footer({ navigationMode: 'custom', navigationItems: [{ pageId: 'missing' }] }),
    footer({ navigationMode: 'custom', navigationItems: [{ pageId: services.pageId }, { pageId: services.pageId }] }),
    footer({ navigationMode: 'unknown' }),
    footer({ text: 'x'.repeat(201) })
  ]) await assert.rejects(updateSiteFooter('tenant-1', invalid), { status: 400 })
})

test('Page deletion auto-prunes working header and custom Footer while leaving published unchanged', async () => {
  await initializeSite('tenant-1', 'admin')
  const b = await createPage('tenant-1', { title: 'B', slug: 'b' })
  const c = await createPage('tenant-1', { title: 'C', slug: 'c' })
  await updateSiteHeader('tenant-1', header([{ pageId: 'home' }, { pageId: b.pageId, label: 'Bee' }, { pageId: c.pageId }]))
  await updateSiteFooter('tenant-1', footer({ navigationMode: 'custom', navigationItems: [{ pageId: b.pageId, label: 'Footer B' }, { pageId: c.pageId }] }))
  await publishSite('tenant-1', 'admin')
  const publishedBefore = fakeDb.data('tenants/tenant-1/site/config/published/current')

  const working = await deletePage('tenant-1', b.pageId)
  assert.deepEqual(working.header.navigation.items, [{ pageId: 'home' }, { pageId: c.pageId }])
  assert.deepEqual(working.footer.navigationItems, [{ pageId: c.pageId }])
  const storedConfig = fakeDb.data('tenants/tenant-1/site/config')
  assert.deepEqual(storedConfig.pageOrder, ['home', c.pageId])
  assert.deepEqual(storedConfig.header.navigation.items, [{ pageId: 'home' }, { pageId: c.pageId }])
  assert.deepEqual(storedConfig.footer.navigationItems, [{ pageId: c.pageId }])
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), publishedBefore)
  assert.equal(fakeDb.data(`tenants/tenant-1/site/config/pages/${b.pageId}`), undefined)
  await publishSite('tenant-1', 'admin')
  assert.deepEqual((await getPublishedSiteDefinition('tenant-1')).header.navigation.items, [{ pageId: 'home' }, { pageId: c.pageId }])
})

test('Page slug and title changes retain the pageId navigation reference across publication boundaries', async () => {
  await initializeSite('tenant-1', 'admin')
  const services = await createPage('tenant-1', { title: 'Services', slug: 'services' })
  await updateSiteHeader('tenant-1', header([{ pageId: services.pageId }, { pageId: 'home', label: 'Welcome' }]))
  await publishSite('tenant-1', 'admin')
  await updatePage('tenant-1', services.pageId, { title: 'Installation', slug: 'what-we-do' })

  assert.deepEqual((await getSite('tenant-1')).header.navigation.items, [{ pageId: services.pageId }, { pageId: 'home', label: 'Welcome' }])
  assert.equal((await getPublishedSiteDefinition('tenant-1')).pages.find((page) => page.id === services.pageId)?.slug, 'services')
  await publishSite('tenant-1', 'admin')
  assert.equal((await getPublishedSiteDefinition('tenant-1')).pages.find((page) => page.id === services.pageId)?.title, 'Installation')
})

test('Header save rejects a deleted page after transaction retry and publish captures a concurrent Header update', async () => {
  await initializeSite('tenant-1', 'admin')
  const page = await createPage('tenant-1', { title: 'Services', slug: 'services' })
  let interleaved = false
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    interleaved = true
    await deletePage('tenant-1', page.pageId)
  }
  await assert.rejects(updateSiteHeader('tenant-1', header([{ pageId: page.pageId }])), { status: 400 })
  assert.equal(interleaved, true)

  const next = await createPage('tenant-1', { title: 'Contact', slug: 'contact' })
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await updateSiteHeader('tenant-1', header([{ pageId: next.pageId }]))
  }
  await publishSite('tenant-1', 'admin')
  assert.deepEqual((await getPublishedSiteDefinition('tenant-1')).header.navigation.items, [{ pageId: next.pageId }])
})
