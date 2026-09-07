import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  getPublicSite,
  getPublishedSiteDefinition,
  getSite,
  initializeSite,
  publishSite,
  unpublishSite,
  updateSiteBranding
} from '../services/siteService.js'
import { updateHomeHero, upsertHomeContact, upsertHomeServices } from './helpers/legacySiteTestBridge.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb

beforeEach(() => {
  fakeDb = new FakeDb()
  _setDb(fakeDb)
})

afterEach(() => {
  _setDb()
})

test('initializeSite rejects a missing tenant without writing site data', async () => {
  await assert.rejects(initializeSite('missing', 'platform-admin'), {
    status: 404,
    message: 'Tenant not found'
  })
  assert.deepEqual(fakeDb.paths(), [])
})

test('initializeSite atomically creates the exact config and home page shapes', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Baker Street Cafe' })

  const site = await initializeSite('tenant-1', 'platform-admin')
  const config = fakeDb.data('tenants/tenant-1/site/config')
  const home = fakeDb.data('tenants/tenant-1/site/config/pages/home')

  assert.deepEqual(Object.keys(config).sort(), [
    'branding',
    'createdAt',
    'createdByUserId',
    'pageOrder',
    'status',
    'theme',
    'updatedAt'
  ])
  assert.equal(config.status, 'DRAFT')
  assert.deepEqual(config.pageOrder, ['home'])
  assert.equal(config.createdByUserId, 'platform-admin')
  assert.equal(config.createdAt, config.updatedAt)
  assert.deepEqual(config.branding, {
    siteName: 'Baker Street Cafe'
  })
  assert.deepEqual(config.theme, {
    colors: {
      primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033'
    },
    headingFont: 'inter',
    bodyFont: 'inter',
    cornerStyle: 'soft',
    contentWidth: 'standard',
    sectionSpacing: 'comfortable'
  })

  assert.deepEqual(Object.keys(home).sort(), [
    'createdAt',
    'id',
    'sections',
    'slug',
    'title',
    'updatedAt'
  ])
  assert.equal(home.id, 'home')
  assert.equal(home.slug, '/')
  assert.equal(home.title, 'Home')
  assert.equal(home.createdAt, home.updatedAt)
  assert.equal(home.sections.length, 1)
  assert.deepEqual(home.sections[0], {
    id: home.sections[0].id,
    type: 'hero',
    hidden: false,
    content: { title: 'Baker Street Cafe' }
  })
  assert.equal(Object.hasOwn(home.sections[0].content, 'subtitle'), false)
  assert.equal(Object.hasOwn(home.sections[0].content, 'ctaLabel'), false)

  assert.deepEqual(site, {
    status: 'DRAFT',
    hasUnpublishedChanges: false,
    branding: {
      siteName: 'Baker Street Cafe'
    },
    theme: config.theme,
    pages: [{
      id: 'home',
      slug: '/',
      title: 'Home',
      sections: [{
        id: home.sections[0].id,
        type: 'hero',
        hidden: false,
        content: { title: 'Baker Street Cafe' }
      }]
    }]
  })
})

test('duplicate initialization returns 409 and leaves existing documents unchanged', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Original Name' })
  await initializeSite('tenant-1', 'first-admin')
  const originalPaths = fakeDb.paths()
  const originalConfig = fakeDb.data('tenants/tenant-1/site/config')
  const originalHome = fakeDb.data('tenants/tenant-1/site/config/pages/home')
  fakeDb.seed('tenants/tenant-1', { name: 'Changed Name' })

  await assert.rejects(initializeSite('tenant-1', 'second-admin'), {
    status: 409,
    message: 'Site already initialized'
  })
  assert.deepEqual(fakeDb.paths(), originalPaths)
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config'), originalConfig)
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/pages/home'), originalHome)
})

test('getSite returns the aggregate definition including slug and hides metadata', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'One' })
  const initialized = await initializeSite('tenant-1', 'admin')

  assert.deepEqual(await getSite('tenant-1'), initialized)
  assert.equal(Object.hasOwn(initialized, 'createdAt'), false)
  assert.equal(Object.hasOwn(initialized.pages[0], 'updatedAt'), false)
  await assert.rejects(getSite('missing'), {
    status: 404,
    message: 'Site not initialized'
  })
})

const normalPublicEnv = {
  NODE_ENV: 'development',
  ALLOW_DRAFT_PUBLIC_SITES: 'false'
}

const previewEnv = {
  NODE_ENV: 'development',
  ALLOW_DRAFT_PUBLIC_SITES: 'true'
}

test('publish creates a sanitized snapshot and persists publication audit metadata', async () => {
  await assert.rejects(publishSite('missing', 'admin'), {
    status: 404,
    message: 'Site not initialized'
  })

  fakeDb.seed('tenants/tenant-1', { name: 'Version A' })
  await initializeSite('tenant-1', 'creator')
  const originalConfig = fakeDb.data('tenants/tenant-1/site/config')
  originalConfig.updatedAt = 1
  fakeDb.seed('tenants/tenant-1/site/config', originalConfig)

  const published = await publishSite('tenant-1', 'publisher')
  const snapshot = fakeDb.data('tenants/tenant-1/site/config/published/current')
  const config = fakeDb.data('tenants/tenant-1/site/config')

  assert.deepEqual(Object.keys(snapshot).sort(), [
    'publishedAt',
    'publishedByUserId',
    'siteDefinition'
  ])
  assert.deepEqual(snapshot.siteDefinition, {
    status: published.status,
    pages: published.pages,
    branding: published.branding,
    theme: published.theme
  })
  assert.deepEqual(Object.keys(published), [
    'status', 'hasUnpublishedChanges', 'lastPublishedAt', 'pages', 'branding', 'theme'
  ])
  assert.deepEqual(Object.keys(published.pages[0]).sort(), ['id', 'sections', 'slug', 'title'])
  assert.equal(published.status, 'PUBLISHED')
  assert.equal(published.hasUnpublishedChanges, false)
  assert.equal(published.lastPublishedAt, snapshot.publishedAt)
  assert.equal(Object.hasOwn(snapshot.siteDefinition, 'hasUnpublishedChanges'), false)
  assert.equal(Object.hasOwn(snapshot.siteDefinition, 'lastPublishedAt'), false)
  assert.equal(snapshot.publishedByUserId, 'publisher')
  assert.equal(config.status, 'PUBLISHED')
  assert.equal(config.updatedAt, snapshot.publishedAt)
  assert.equal(config.lastPublishedAt, snapshot.publishedAt)
  assert.equal(config.lastPublishedByUserId, 'publisher')
  assert.notEqual(config.updatedAt, 1)
})

test('publication status follows config and home working timestamps across publish cycles', async () => {
  const originalNow = Date.now
  let now = 100
  Date.now = () => now
  try {
    fakeDb.seed('tenants/tenant-1', { name: 'Version A' })
    const draft = await initializeSite('tenant-1', 'admin')
    assert.equal(draft.hasUnpublishedChanges, false)
    assert.equal(Object.hasOwn(draft, 'lastPublishedAt'), false)

    now = 200
    const published = await publishSite('tenant-1', 'publisher')
    assert.equal(published.status, 'PUBLISHED')
    assert.equal(published.hasUnpublishedChanges, false)
    assert.equal(published.lastPublishedAt, 200)

    now = 300
    const configEdit = await updateSiteBranding('tenant-1', { siteName: 'Version B' })
    assert.equal(configEdit.hasUnpublishedChanges, true)
    assert.equal(configEdit.lastPublishedAt, 200)

    now = 400
    const republished = await publishSite('tenant-1', 'republisher')
    assert.equal(republished.hasUnpublishedChanges, false)
    assert.equal(republished.lastPublishedAt, 400)

    now = 500
    const homeEdit = await updateHomeHero('tenant-1', { title: 'Version C' })
    assert.equal(homeEdit.hasUnpublishedChanges, true)
    assert.equal(homeEdit.lastPublishedAt, 400)
  } finally {
    Date.now = originalNow
  }
})

test('published legacy data without a usable publication timestamp fails conservatively', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Legacy' })
  await initializeSite('tenant-1', 'admin')
  const config = fakeDb.data('tenants/tenant-1/site/config')
  const home = fakeDb.data('tenants/tenant-1/site/config/pages/home')
  delete config.lastPublishedAt
  fakeDb.seed('tenants/tenant-1/site/config', { ...config, status: 'PUBLISHED', updatedAt: 900 })
  fakeDb.seed('tenants/tenant-1/site/config/pages/home', { ...home, updatedAt: 1000 })

  const legacy = await getSite('tenant-1')
  assert.equal(legacy.status, 'PUBLISHED')
  assert.equal(legacy.hasUnpublishedChanges, false)
  assert.equal(Object.hasOwn(legacy, 'lastPublishedAt'), false)
})

test('published snapshot isolates live content until an explicit republish', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Version A' })
  await initializeSite('tenant-1', 'admin')
  await publishSite('tenant-1', 'admin')
  const originalSnapshot = fakeDb.data('tenants/tenant-1/site/config/published/current')

  assert.equal((await getPublicSite('tenant-1', normalPublicEnv))
    .pages[0].sections[0].content.title, 'Version A')

  await updateHomeHero('tenant-1', { title: 'Version B' })
  assert.equal((await getSite('tenant-1')).pages[0].sections[0].content.title, 'Version B')
  assert.equal((await getPublicSite('tenant-1', normalPublicEnv))
    .pages[0].sections[0].content.title, 'Version A')
  assert.deepEqual(
    fakeDb.data('tenants/tenant-1/site/config/published/current'),
    originalSnapshot
  )

  await publishSite('tenant-1', 'republisher')
  assert.equal((await getPublicSite('tenant-1', normalPublicEnv))
    .pages[0].sections[0].content.title, 'Version B')
  assert.equal(fakeDb.data('tenants/tenant-1/site/config/published/current')
    .publishedByUserId, 'republisher')
})

test('preview always returns current working content labeled DRAFT', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Version A' })
  await initializeSite('tenant-1', 'admin')
  await publishSite('tenant-1', 'admin')
  await updateHomeHero('tenant-1', { title: 'Version B' })

  const live = await getPublicSite('tenant-1', normalPublicEnv)
  assert.equal(live.status, 'PUBLISHED')
  assert.equal(live.pages[0].sections[0].content.title, 'Version A')

  const preview = await getPublicSite('tenant-1', previewEnv)
  assert.equal(preview.status, 'DRAFT')
  assert.equal(preview.hasUnpublishedChanges, false)
  assert.equal(preview.pages[0].sections[0].content.title, 'Version B')

  const strictPublished = await getPublishedSiteDefinition('tenant-1')
  assert.equal(strictPublished.status, 'PUBLISHED')
  assert.equal(strictPublished.pages[0].sections[0].content.title, 'Version A')

  const production = await getPublicSite('tenant-1', {
    NODE_ENV: 'production',
    ALLOW_DRAFT_PUBLIC_SITES: 'true'
  })
  assert.equal(production.status, 'PUBLISHED')
  assert.equal(production.pages[0].sections[0].content.title, 'Version A')

  await publishSite('tenant-1', 'republisher')
  assert.equal((await getPublishedSiteDefinition('tenant-1'))
    .pages[0].sections[0].content.title, 'Version B')
})

test('normal public reads fail closed for missing or malformed snapshots', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Working Copy' })
  await initializeSite('tenant-1', 'admin')
  const config = fakeDb.data('tenants/tenant-1/site/config')
  fakeDb.seed('tenants/tenant-1/site/config', { ...config, status: 'PUBLISHED' })

  await assert.rejects(getPublicSite('tenant-1', normalPublicEnv), {
    status: 404,
    message: 'Site not found'
  })
  await assert.rejects(getPublishedSiteDefinition('tenant-1'), {
    status: 404,
    message: 'Site not found'
  })

  fakeDb.seed('tenants/tenant-1/site/config/published/current', { publishedAt: 1 })
  await assert.rejects(getPublicSite('tenant-1', normalPublicEnv), {
    status: 404,
    message: 'Site not found'
  })

  fakeDb.seed('tenants/tenant-1/site/config/published/current', {
    siteDefinition: { status: 'DRAFT', pages: [] }
  })
  await assert.rejects(getPublicSite('tenant-1', normalPublicEnv), {
    status: 404,
    message: 'Site not found'
  })
})

test('unpublish returns working DRAFT, retains snapshot, and hides normal public access', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Published Site' })
  await initializeSite('tenant-1', 'admin')
  await publishSite('tenant-1', 'publisher')
  const retainedSnapshot = fakeDb.data('tenants/tenant-1/site/config/published/current')

  const draft = await unpublishSite('tenant-1', 'unpublisher')
  const config = fakeDb.data('tenants/tenant-1/site/config')
  assert.equal(draft.status, 'DRAFT')
  assert.equal(config.status, 'DRAFT')
  assert.equal(config.lastUnpublishedAt, config.updatedAt)
  assert.equal(config.lastUnpublishedByUserId, 'unpublisher')
  assert.deepEqual(
    fakeDb.data('tenants/tenant-1/site/config/published/current'),
    retainedSnapshot
  )
  await assert.rejects(getPublicSite('tenant-1', normalPublicEnv), {
    status: 404,
    message: 'Site not found'
  })
  assert.equal((await getPublicSite('tenant-1', previewEnv)).status, 'DRAFT')

  await assert.rejects(unpublishSite('missing', 'admin'), {
    status: 404,
    message: 'Site not initialized'
  })
})

test('getPublicSite normalizes a missing site to the public 404', async () => {
  for (const env of [normalPublicEnv, previewEnv]) {
    await assert.rejects(getPublicSite('missing', env), {
      status: 404,
      message: 'Site not found'
    })
  }
})

test('updateHomeHero validates title and subtitle authoritatively', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Initial' })
  await initializeSite('tenant-1', 'admin')

  for (const input of [{}, { title: null }, { title: 123 }, { title: '   ' }]) {
    await assert.rejects(updateHomeHero('tenant-1', input), {
      status: 400,
      message: 'Hero title is required'
    })
  }
  await assert.rejects(updateHomeHero('tenant-1', { title: 'x'.repeat(201) }), {
    status: 400,
    message: 'Hero title must be 200 characters or fewer'
  })
  await assert.rejects(updateHomeHero('tenant-1', {
    title: 'Valid',
    subtitle: 'x'.repeat(501)
  }), {
    status: 400,
    message: 'Hero subtitle must be 500 characters or fewer'
  })
  for (const subtitle of [null, 123]) {
    await assert.rejects(updateHomeHero('tenant-1', { title: 'Valid', subtitle }), {
      status: 400,
      message: 'Hero subtitle must be a string'
    })
  }

  const updated = await updateHomeHero('tenant-1', {
    title: '  Trimmed title  ',
    ignored: 'not persisted',
    ctaLabel: 'not accepted'
  })
  assert.equal(updated.pages[0].sections[0].content.title, 'Trimmed title')
  assert.equal(updated.pages[0].sections[0].content.ctaLabel, 'not accepted')
})

test('updateHomeHero treats content as full state and normalizes subtitle', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Initial' })
  await initializeSite('tenant-1', 'admin')
  await updateHomeHero('tenant-1', { title: 'Initial', subtitle: 'Existing' })

  let updated = await updateHomeHero('tenant-1', { title: 'Changed' })
  assert.equal(updated.status, 'DRAFT')
  assert.equal(updated.pages[0].sections[0].content.subtitle, undefined)

  updated = await updateHomeHero('tenant-1', {
    title: 'Changed',
    subtitle: '  New subtitle  '
  })
  assert.equal(updated.pages[0].sections[0].content.subtitle, 'New subtitle')

  updated = await updateHomeHero('tenant-1', { title: 'Changed', subtitle: '   ' })
  assert.equal(Object.hasOwn(updated.pages[0].sections[0].content, 'subtitle'), false)
})

test('updateHomeHero preserves content, section order, metadata, timestamps, and status', async () => {
  const configPath = 'tenants/tenant-1/site/config'
  const homePath = 'tenants/tenant-1/site/config/pages/home'
  fakeDb.seed(configPath, {
    status: 'PUBLISHED',
    createdAt: 10,
    updatedAt: 20,
    createdByUserId: 'creator',
    lastPublishedAt: 15,
    lastPublishedByUserId: 'publisher'
  })
  fakeDb.seed(homePath, {
    id: 'home',
    slug: '/',
    title: 'Home',
    createdAt: 11,
    updatedAt: 21,
    customPageField: true,
    sections: [
      {
        id: 'hero',
        type: 'hero',
        hidden: false,
        customSectionField: 'preserved',
        content: {
          title: 'Old',
          subtitle: 'Existing',
          ctaLabel: 'Keep me',
          futureField: true
        }
      },
      { id: 'after', type: 'about', hidden: false, content: { heading: 'After', body: 'Body' } }
    ]
  })

  const updated = await updateHomeHero('tenant-1', {
    title: '  New title  ',
    subtitle: ' Updated subtitle ',
    ctaLabel: 'Attacker value'
  })
  const config = fakeDb.data(configPath)
  const home = fakeDb.data(homePath)
  const hero = home.sections[0]

  assert.equal(updated.status, 'PUBLISHED')
  assert.deepEqual(home.sections.map((section) => section.id), ['hero', 'after'])
  assert.equal(hero.id, 'hero')
  assert.equal(hero.type, 'hero')
  assert.equal(hero.customSectionField, 'preserved')
  assert.deepEqual(hero.content, {
    title: 'New title',
    subtitle: 'Updated subtitle',
    ctaLabel: 'Attacker value'
  })
  assert.equal(home.customPageField, true)
  assert.equal(home.createdAt, 11)
  assert.notEqual(home.updatedAt, 21)
  assert.equal(config.createdAt, 10)
  assert.equal(config.createdByUserId, 'creator')
  assert.equal(config.status, 'PUBLISHED')
  assert.equal(config.lastPublishedAt, 15)
  assert.equal(config.lastPublishedByUserId, 'publisher')
  assert.equal(config.updatedAt, home.updatedAt)
})

test('updateHomeHero reports missing site, Home, and Hero explicitly', async () => {
  await assert.rejects(updateHomeHero('missing', { title: 'Valid' }), {
    status: 404,
    message: 'Site not initialized'
  })

  fakeDb.seed('tenants/no-home/site/config', { status: 'DRAFT' })
  await assert.rejects(updateHomeHero('no-home', { title: 'Valid' }), {
    status: 500,
    message: 'Site home page missing'
  })

  fakeDb.seed('tenants/no-hero/site/config', { status: 'DRAFT' })
  fakeDb.seed('tenants/no-hero/site/config/pages/home', {
    id: 'home',
    slug: '/',
    title: 'Home',
    sections: [{ id: 'other', type: 'about', hidden: false, content: { heading: 'About', body: 'Body' } }]
  })
  await assert.rejects(updateHomeHero('no-hero', { title: 'Valid' }), {
    status: 500,
    message: 'Home sections invalid'
  })
})

const servicesSection = (site) => site.pages[0].sections.find((section) =>
  section.type === 'services'
)

test('upsertHomeServices validates the full request and server-owned ids', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Business' })
  await initializeSite('tenant-1', 'admin')

  for (const input of [{}, { title: null, items: [] }, { title: ' ', items: [] }]) {
    await assert.rejects(upsertHomeServices('tenant-1', input), {
      status: 400,
      message: 'Services title is required'
    })
  }
  await assert.rejects(upsertHomeServices('tenant-1', { title: 'x'.repeat(101), items: [] }), {
    status: 400,
    message: 'Services title must be 100 characters or fewer'
  })
  await assert.rejects(upsertHomeServices('tenant-1', { title: 'Services' }), {
    status: 400,
    message: 'Services items must be an array'
  })
  await assert.rejects(upsertHomeServices('tenant-1', { title: 'Services', items: [] }), {
    status: 400,
    message: 'Services must include at least one item'
  })
  await assert.rejects(upsertHomeServices('tenant-1', {
    title: 'Services',
    items: Array.from({ length: 21 }, () => ({ name: 'Item' }))
  }), { status: 400, message: 'Services cannot exceed 20 items' })

  for (const item of [{}, { name: null }, { name: ' ' }]) {
    await assert.rejects(upsertHomeServices('tenant-1', { title: 'Services', items: [item] }), {
      status: 400,
      message: 'Service name is required'
    })
  }
  await assert.rejects(upsertHomeServices('tenant-1', {
    title: 'Services', items: [{ name: 'x'.repeat(121) }]
  }), { status: 400, message: 'Service name must be 120 characters or fewer' })
  for (const description of [null, 123]) {
    await assert.rejects(upsertHomeServices('tenant-1', {
      title: 'Services', items: [{ name: 'Item', description }]
    }), { status: 400, message: 'Service description must be a string' })
  }
  await assert.rejects(upsertHomeServices('tenant-1', {
    title: 'Services', items: [{ name: 'Item', description: 'x'.repeat(501) }]
  }), { status: 400, message: 'Service description must be 500 characters or fewer' })
  await assert.rejects(upsertHomeServices('tenant-1', {
    title: 'Services', items: [{ id: 1, name: 'Item' }]
  }), { status: 400, message: 'Service item id must be a string' })
  await assert.rejects(upsertHomeServices('tenant-1', {
    title: 'Services',
    items: [{ id: 'same', name: 'One' }, { id: 'same', name: 'Two' }]
  }), { status: 400, message: 'Duplicate service item id' })
  await assert.rejects(upsertHomeServices('tenant-1', {
    title: 'Services', items: [{ id: 'client-created', name: 'Item' }]
  }), { status: 400, message: 'Unknown services item id' })
  await assert.rejects(upsertHomeServices('tenant-1', {
    title: 'Services', items: [{ id: '', name: 'Item' }]
  }), { status: 400, message: 'Unknown services item id' })
})

test('upsertHomeServices appends by default with generated ids and request order', async () => {
  const configPath = 'tenants/tenant-1/site/config'
  const homePath = 'tenants/tenant-1/site/config/pages/home'
  fakeDb.seed(configPath, { status: 'DRAFT', createdAt: 10, updatedAt: 20, createdByUserId: 'admin' })
  fakeDb.seed(homePath, {
    id: 'home',
    slug: '/',
    title: 'Home',
    createdAt: 11,
    updatedAt: 21,
    sections: [
      { id: 'hero', type: 'hero', hidden: false, content: { title: 'Hero' } },
      { id: 'after', type: 'about', hidden: false, content: { heading: 'After', body: 'Body' } }
    ]
  })

  const updated = await upsertHomeServices('tenant-1', {
    title: '  Our Services  ',
    ignored: true,
    items: [
      { name: '  Second  ', description: '  Description  ', future: 'ignored' },
      { name: 'First', description: '   ' }
    ]
  })
  const services = servicesSection(updated)
  const home = fakeDb.data(homePath)
  const config = fakeDb.data(configPath)

  assert.deepEqual(home.sections.map((section) => section.id), ['hero', 'after', services.id])
  assert.equal(services.content.title, 'Our Services')
  assert.deepEqual(services.content.items.map((item) => item.name), ['Second', 'First'])
  assert.match(services.content.items[0].id, /^[0-9a-f-]{36}$/)
  assert.match(services.content.items[1].id, /^[0-9a-f-]{36}$/)
  assert.equal(services.content.items[0].description, 'Description')
  assert.equal(Object.hasOwn(services.content.items[1], 'description'), false)
  assert.equal(Object.hasOwn(services.content.items[0], 'future'), false)
  assert.equal(home.createdAt, 11)
  assert.notEqual(home.updatedAt, 21)
  assert.equal(config.createdAt, 10)
  assert.equal(config.status, 'DRAFT')
  assert.equal(config.updatedAt, home.updatedAt)
})

test('upsertHomeServices preserves identity and metadata with full-state descriptions', async () => {
  const configPath = 'tenants/tenant-1/site/config'
  const homePath = 'tenants/tenant-1/site/config/pages/home'
  fakeDb.seed(configPath, {
    status: 'PUBLISHED',
    createdAt: 1,
    updatedAt: 2,
    lastPublishedAt: 2
  })
  fakeDb.seed(homePath, {
    id: 'home',
    slug: '/',
    title: 'Home',
    createdAt: 1,
    updatedAt: 2,
    sections: [
      { id: 'hero', type: 'hero', hidden: false, content: { title: 'Hero' } },
      { id: 'middle', type: 'about', hidden: false, content: { heading: 'Middle', body: 'Body' } },
      {
        id: 'services',
        type: 'services',
        hidden: false,
        sectionFuture: true,
        content: {
          title: 'Old',
          contentFuture: true,
          items: [
            { id: 'abc', name: 'Existing', description: 'Existing description', futureField: 'keep' },
            { id: 'remove', name: 'Remove me' }
          ]
        }
      },
      { id: 'after', type: 'about', hidden: false, content: { heading: 'After', body: 'Body' } }
    ]
  })

  let updated = await upsertHomeServices('tenant-1', {
    title: 'Changed', items: [{ id: 'abc', name: 'Changed' }]
  })
  let services = servicesSection(updated)
  assert.deepEqual(updated.pages[0].sections.map((section) => section.id), ['hero', 'middle', 'services', 'after'])
  assert.equal(services.sectionFuture, true)
  assert.equal(services.content.contentFuture, undefined)
  assert.deepEqual(services.content.items, [{ id: 'abc', name: 'Changed' }])

  updated = await upsertHomeServices('tenant-1', {
    title: 'Changed',
    items: [{ id: 'abc', name: 'Changed', description: '  New description  ' }]
  })
  services = servicesSection(updated)
  assert.equal(services.content.items[0].description, 'New description')

  updated = await upsertHomeServices('tenant-1', {
    title: 'Changed',
    items: [{ id: 'abc', name: 'Changed', description: '   ' }]
  })
  services = servicesSection(updated)
  assert.equal(Object.hasOwn(services.content.items[0], 'description'), false)
  assert.equal(updated.status, 'PUBLISHED')
})

test('upsertHomeServices rejects missing documents and invalid reserved section states', async () => {
  const valid = { title: 'Services', items: [{ name: 'One' }] }
  await assert.rejects(upsertHomeServices('missing', valid), {
    status: 404, message: 'Site not initialized'
  })
  fakeDb.seed('tenants/no-home/site/config', { status: 'DRAFT' })
  await assert.rejects(upsertHomeServices('no-home', valid), {
    status: 500, message: 'Site home page missing'
  })
  fakeDb.seed('tenants/no-hero/site/config', { status: 'DRAFT' })
  fakeDb.seed('tenants/no-hero/site/config/pages/home', { sections: [] })
  await assert.rejects(upsertHomeServices('no-hero', valid), {
    status: 500, message: 'Home sections invalid'
  })

  const cases = [
    [
      { id: 'hero', type: 'hero', hidden: true, content: { title: 'Hero' } }
    ],
    [{ id: 'services', type: 'services', hidden: false, content: { title: 'Services', items: [] } }],
    [
      { id: 'hero', type: 'hero', hidden: false, content: { title: 'Hero' } },
      { id: 'hero', type: 'services', hidden: false, content: { title: 'Services', items: [] } }
    ]
  ]
  for (const [index, sections] of cases.entries()) {
    const tenantId = `invalid-${index}`
    fakeDb.seed(`tenants/${tenantId}/site/config`, { status: 'DRAFT' })
    fakeDb.seed(`tenants/${tenantId}/site/config/pages/home`, { sections })
    await assert.rejects(upsertHomeServices(tenantId, valid), {
      status: 500, message: 'Home sections invalid'
    })
  }
})

test('Services working edits remain isolated until republish', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Business' })
  await initializeSite('tenant-1', 'admin')
  let working = await upsertHomeServices('tenant-1', {
    title: 'Services', items: [{ name: 'A' }, { name: 'B' }]
  })
  const [a] = servicesSection(working).content.items
  await publishSite('tenant-1', 'admin')
  const originalSnapshot = fakeDb.data('tenants/tenant-1/site/config/published/current')
  assert.deepEqual(servicesSection(await getPublicSite('tenant-1', normalPublicEnv))
    .content.items.map((item) => item.name), ['A', 'B'])

  working = await upsertHomeServices('tenant-1', {
    title: 'Services', items: [{ id: a.id, name: 'A renamed' }, { name: 'C' }]
  })
  assert.deepEqual(servicesSection(working).content.items.map((item) => item.name), ['A renamed', 'C'])
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), originalSnapshot)
  assert.deepEqual(servicesSection(await getPublicSite('tenant-1', normalPublicEnv))
    .content.items.map((item) => item.name), ['A', 'B'])
  assert.deepEqual(servicesSection(await getSite('tenant-1')).content.items.map((item) => item.name), ['A renamed', 'C'])
  const preview = await getPublicSite('tenant-1', previewEnv)
  assert.equal(preview.status, 'DRAFT')
  assert.deepEqual(servicesSection(preview).content.items.map((item) => item.name), ['A renamed', 'C'])

  await publishSite('tenant-1', 'admin')
  assert.deepEqual(servicesSection(await getPublicSite('tenant-1', normalPublicEnv))
    .content.items.map((item) => item.name), ['A renamed', 'C'])
})

const contactSection = (site) => site.pages[0].sections.find((section) =>
  section.type === 'contact'
)

const validContact = (overrides = {}) => ({
  title: 'Contact Us',
  text: 'We would be glad to hear from you.',
  buttonLabel: 'Get in touch',
  action: { type: 'email', value: 'hello@example.com' },
  ...overrides
})

test('upsertHomeContact validates and canonicalizes email actions', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Business' })
  await initializeSite('tenant-1', 'admin')

  const updated = await upsertHomeContact('tenant-1', validContact({
    action: { type: 'email', value: '  hello@example.com  ', ignored: true }
  }))
  assert.deepEqual(contactSection(updated).content.action, {
    type: 'email', value: 'hello@example.com'
  })
  assert.equal(updated.status, 'DRAFT')

  const invalidEmails = [
    'missing-at.example.com',
    'a@localhost',
    'a b@example.com',
    'a\tb@example.com',
    'a\nb@example.com',
    'a?b@example.com',
    'a#b@example.com',
    'a/b@example.com'
  ]
  for (const value of invalidEmails) {
    await assert.rejects(upsertHomeContact('tenant-1', validContact({
      action: { type: 'email', value }
    })), { status: 400, message: 'Contact email is invalid' })
  }
  await assert.rejects(upsertHomeContact('tenant-1', validContact({
    action: { type: 'email', value: `${'a'.repeat(243)}@example.com` }
  })), { status: 400, message: 'Contact email must be 254 characters or fewer' })
})

test('upsertHomeContact validates formatted phone actions and canonical digit limits', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Business' })
  await initializeSite('tenant-1', 'admin')

  const updated = await upsertHomeContact('tenant-1', validContact({
    action: { type: 'phone', value: '  +1 (801) 555-1234  ', ignored: true }
  }))
  assert.deepEqual(contactSection(updated).content.action, {
    type: 'phone', value: '+1 (801) 555-1234'
  })

  for (const value of ['', '123456', '1234567890123456', '801-CALL-NOW', '++18015551234', '801+5551234']) {
    await assert.rejects(upsertHomeContact('tenant-1', validContact({
      action: { type: 'phone', value }
    })), value === ''
      ? { status: 400, message: 'Contact action value is required' }
      : { status: 400, message: 'Contact phone is invalid' })
  }
  await assert.rejects(upsertHomeContact('tenant-1', validContact({
    action: { type: 'phone', value: `+1 ${'(801) 555-1234 '.repeat(4)}` }
  })), { status: 400, message: 'Contact phone must be 50 characters or fewer' })
})

test('upsertHomeContact parses only absolute HTTP and HTTPS actions', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Business' })
  await initializeSite('tenant-1', 'admin')

  for (const [value, expected] of [
    ['http://example.com/contact', 'http://example.com/contact'],
    ['https://example.com/contact', 'https://example.com/contact'],
    ['HtTpS://EXAMPLE.COM', 'https://example.com/']
  ]) {
    const updated = await upsertHomeContact('tenant-1', validContact({
      action: { type: 'url', value, ignored: true }
    }))
    assert.deepEqual(contactSection(updated).content.action, { type: 'url', value: expected })
  }

  for (const value of [
    'javascript:alert(1)',
    'data:text/plain,hello',
    'vbscript:msgbox(1)',
    'ftp://example.com',
    '/contact',
    'not a URL'
  ]) {
    await assert.rejects(upsertHomeContact('tenant-1', validContact({
      action: { type: 'url', value }
    })), { status: 400, message: 'Contact URL must use http or https' })
  }
  await assert.rejects(upsertHomeContact('tenant-1', validContact({
    action: { type: 'url', value: `https://example.com/${'x'.repeat(2030)}` }
  })), { status: 400, message: 'Contact URL must be 2048 characters or fewer' })
})

test('upsertHomeContact validates content and action structure', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Business' })
  await initializeSite('tenant-1', 'admin')

  for (const input of [{}, { title: null }, { title: ' ' }]) {
    await assert.rejects(upsertHomeContact('tenant-1', input), {
      status: 400, message: 'Contact title is required'
    })
  }
  await assert.rejects(upsertHomeContact('tenant-1', validContact({ title: 'x'.repeat(151) })), {
    status: 400, message: 'Contact title must be 150 characters or fewer'
  })
  await assert.rejects(upsertHomeContact('tenant-1', validContact({ text: 123 })), {
    status: 400, message: 'Contact text must be a string'
  })
  await assert.rejects(upsertHomeContact('tenant-1', validContact({ text: 'x'.repeat(501) })), {
    status: 400, message: 'Contact text must be 500 characters or fewer'
  })
  for (const buttonLabel of [null, ' ']) {
    await assert.rejects(upsertHomeContact('tenant-1', validContact({ buttonLabel })), {
      status: 400, message: 'Contact button label is required'
    })
  }
  await assert.rejects(upsertHomeContact('tenant-1', validContact({ buttonLabel: 'x'.repeat(81) })), {
    status: 400, message: 'Contact button label must be 80 characters or fewer'
  })
  for (const action of [undefined, null, [], 'email']) {
    await assert.rejects(upsertHomeContact('tenant-1', validContact({ action })), {
      status: 400, message: 'Contact action is required'
    })
  }
  for (const action of [{}, { type: 'unsupported', value: 'x' }]) {
    await assert.rejects(upsertHomeContact('tenant-1', validContact({ action })), {
      status: 400, message: 'Contact action type is not supported'
    })
  }
  for (const action of [{ type: 'email' }, { type: 'email', value: 123 }, { type: 'email', value: ' ' }]) {
    await assert.rejects(upsertHomeContact('tenant-1', validContact({ action })), {
      status: 400, message: 'Contact action value is required'
    })
  }

  let updated = await upsertHomeContact('tenant-1', validContact({
    action: { type: 'leadForm', value: 'drop me', future: true }
  }))
  assert.deepEqual(contactSection(updated).content.action, { type: 'leadForm' })
  updated = await upsertHomeContact('tenant-1', validContact({
    action: { type: 'leadForm' }
  }))
  assert.deepEqual(contactSection(updated).content.action, { type: 'leadForm' })
})

test('upsertHomeContact appends, preserves position and metadata, and owns its full state', async () => {
  const configPath = 'tenants/tenant-1/site/config'
  const homePath = 'tenants/tenant-1/site/config/pages/home'
  fakeDb.seed(configPath, {
    status: 'PUBLISHED',
    createdAt: 1,
    updatedAt: 2,
    lastPublishedAt: 2,
    lastPublishedByUserId: 'publisher'
  })
  fakeDb.seed(homePath, {
    id: 'home',
    slug: '/',
    title: 'Home',
    createdAt: 1,
    updatedAt: 2,
    sections: [
      { id: 'hero', type: 'hero', hidden: false, content: { title: 'Hero' } },
      { id: 'future', type: 'about', hidden: false, content: { heading: 'Future', body: 'Body' } }
    ]
  })
  fakeDb.seed('tenants/tenant-1/site/config/published/current', { untouched: true })

  let updated = await upsertHomeContact('tenant-1', validContact({ text: '  Initial text  ' }))
  assert.deepEqual(updated.pages[0].sections.map((section) => section.type), ['hero', 'about', 'contact'])
  assert.equal(contactSection(updated).content.text, 'Initial text')

  const stored = fakeDb.data(homePath)
  stored.sections[2].sectionFuture = true
  stored.sections[2].content.contentFuture = true
  fakeDb.seed(homePath, stored)
  updated = await upsertHomeContact('tenant-1', validContact({
    title: ' Updated ',
    text: '   ',
    buttonLabel: ' Email ',
    ignored: true,
    action: { type: 'email', value: 'updated@example.com', ignored: true }
  }))
  const contact = contactSection(updated)
  const config = fakeDb.data(configPath)
  const home = fakeDb.data(homePath)
  assert.deepEqual(updated.pages[0].sections.map((section) => section.type), ['hero', 'about', 'contact'])
  assert.equal(contact.sectionFuture, true)
  assert.equal(contact.content.contentFuture, undefined)
  assert.equal(Object.hasOwn(contact.content, 'text'), false)
  assert.deepEqual(contact.content.action, { type: 'email', value: 'updated@example.com' })
  assert.equal(home.updatedAt, config.updatedAt)
  assert.equal(config.status, 'PUBLISHED')
  assert.equal(config.lastPublishedAt, 2)
  assert.equal(config.lastPublishedByUserId, 'publisher')
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), { untouched: true })
})

test('upsertHomeContact rejects missing documents and invalid reserved section states', async () => {
  await assert.rejects(upsertHomeContact('missing', validContact()), {
    status: 404, message: 'Site not initialized'
  })
  fakeDb.seed('tenants/no-home/site/config', { status: 'DRAFT' })
  await assert.rejects(upsertHomeContact('no-home', validContact()), {
    status: 500, message: 'Site home page missing'
  })

  const cases = [
    [
      { id: 'hero', type: 'hero', hidden: false, content: { title: 'Hero' } },
      { id: 'contact', type: 'contact', hidden: false, content: {} },
      { id: 'other', type: 'contact', hidden: false, content: {} }
    ],
    [{ id: 'contact', type: 'hero', hidden: true, content: { title: 'Hero' } }],
    [{ id: 'other', type: 'contact', hidden: false, content: {} }]
  ]
  for (const [index, sections] of cases.entries()) {
    const tenantId = `invalid-contact-${index}`
    fakeDb.seed(`tenants/${tenantId}/site/config`, { status: 'DRAFT' })
    fakeDb.seed(`tenants/${tenantId}/site/config/pages/home`, { sections })
    await assert.rejects(upsertHomeContact(tenantId, validContact()), {
      status: 500, message: 'Home sections invalid'
    })
  }
})

test('Contact working changes remain isolated until republish', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Business' })
  await initializeSite('tenant-1', 'admin')
  await upsertHomeServices('tenant-1', {
    title: 'Services', items: [{ name: 'One' }]
  })
  await upsertHomeContact('tenant-1', validContact({ title: 'Contact A' }))
  await publishSite('tenant-1', 'admin')
  assert.equal(contactSection(await getPublicSite('tenant-1', normalPublicEnv)).content.title, 'Contact A')

  await upsertHomeContact('tenant-1', validContact({
    title: 'Contact B', action: { type: 'phone', value: '(801) 555-1234' }
  }))
  const originalSnapshot = fakeDb.data('tenants/tenant-1/site/config/published/current')
  assert.equal(contactSection(await getPublicSite('tenant-1', normalPublicEnv)).content.title, 'Contact A')
  assert.equal(contactSection(await getSite('tenant-1')).content.title, 'Contact B')
  const preview = await getPublicSite('tenant-1', previewEnv)
  assert.equal(preview.status, 'DRAFT')
  assert.equal(contactSection(preview).content.title, 'Contact B')
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), originalSnapshot)

  await publishSite('tenant-1', 'admin')
  assert.equal(contactSection(await getPublicSite('tenant-1', normalPublicEnv)).content.title, 'Contact B')
})
