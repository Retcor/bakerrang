import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  _setDb,
  applySiteTemplate,
  createPage,
  getPublicSite,
  getPublishedSiteDefinition,
  getSite,
  initializeSite,
  listSiteRevisions,
  listSiteTemplates,
  materializeSiteTemplate,
  publishSite,
  restoreSiteRevision,
  unpublishSite,
  updateSiteBranding,
  updateBusinessProfile,
  updateCustomCss,
  updatePage,
  updatePageSeo,
  updateSiteFooter,
  updateSiteHeader,
  updateSiteSeo,
  updateSiteTheme,
  validateSiteTemplate
} from '../services/siteService.js'
import { updateHomeHero, upsertHomeContact, upsertHomeServices } from './helpers/legacySiteTestBridge.js'
import { FakeDb } from './helpers/fakeDb.js'
import { SITE_TEMPLATES } from '../domain/siteTemplates.js'
import { _setDb as setMediaDb } from '../services/mediaService.js'

let fakeDb

beforeEach(() => {
  fakeDb = new FakeDb()
  _setDb(fakeDb)
  setMediaDb(fakeDb)
})

afterEach(() => {
  _setDb()
  setMediaDb()
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
    'footer',
    'header',
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
  assert.deepEqual(config.header, { brandDisplay: 'logo', navigation: { items: [] } })
  assert.deepEqual(config.footer, {
    showBranding: true,
    navigationMode: 'header',
    showBusinessContact: false,
    showSocialLinks: true,
    showCopyright: true
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
    header: config.header,
    footer: config.footer,
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
  const revision = fakeDb.data(`tenants/tenant-1/site/config/revisions/${snapshot.revisionId}`)
  const revisionIndex = fakeDb.data('tenants/tenant-1/site/config/revisionIndex/current')
  const revisionMedia = fakeDb.data(`tenants/tenant-1/site/config/revisionMedia/${snapshot.revisionId}`)

  assert.deepEqual(Object.keys(snapshot).sort(), [
    'publishedAt',
    'publishedByUserId',
    'revisionId',
    'siteDefinition'
  ])
  assert.match(snapshot.revisionId, /^[0-9a-f-]{36}$/i)
  assert.deepEqual(snapshot.siteDefinition, {
    status: published.status,
    pages: published.pages,
    branding: published.branding,
    theme: published.theme,
    header: published.header,
    footer: published.footer
  })
  assert.deepEqual(Object.keys(published), [
    'status', 'hasUnpublishedChanges', 'lastPublishedAt', 'pages', 'branding', 'theme', 'header', 'footer'
  ])
  assert.deepEqual(Object.keys(published.pages[0]).sort(), ['id', 'sections', 'slug', 'title'])
  assert.equal(published.status, 'PUBLISHED')
  assert.equal(published.hasUnpublishedChanges, false)
  assert.equal(published.lastPublishedAt, snapshot.publishedAt)
  assert.equal(Object.hasOwn(snapshot.siteDefinition, 'hasUnpublishedChanges'), false)
  assert.equal(Object.hasOwn(snapshot.siteDefinition, 'lastPublishedAt'), false)
  assert.equal(snapshot.publishedByUserId, 'publisher')
  assert.deepEqual(revision, snapshot)
  assert.deepEqual(revisionIndex.entries, [{
    revisionId: snapshot.revisionId,
    publishedAt: snapshot.publishedAt,
    publishedByUserId: snapshot.publishedByUserId,
    pageCount: 1
  }])
  assert.deepEqual(revisionMedia, { mediaIds: [] })
  assert.equal(config.status, 'PUBLISHED')
  assert.equal(config.updatedAt, snapshot.publishedAt)
  assert.equal(config.lastPublishedAt, snapshot.publishedAt)
  assert.equal(config.lastPublishedByUserId, 'publisher')
  assert.notEqual(config.updatedAt, 1)
})

test('published revisions are immutable, retained newest-first, and restore only Working', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Revision A' })
  await initializeSite('tenant-1', 'admin')
  const first = await publishSite('tenant-1', 'publisher-a')
  const firstCurrent = fakeDb.data('tenants/tenant-1/site/config/published/current')
  const firstRevision = fakeDb.data(`tenants/tenant-1/site/config/revisions/${firstCurrent.revisionId}`)

  await updateSiteBranding('tenant-1', { siteName: 'Revision B' })
  const second = await publishSite('tenant-1', 'publisher-b')
  const secondCurrent = fakeDb.data('tenants/tenant-1/site/config/published/current')
  const listed = await listSiteRevisions('tenant-1')

  assert.equal(listed.revisions.length, 2)
  assert.equal(listed.revisions[0].revisionId, secondCurrent.revisionId)
  assert.equal(listed.revisions[0].isCurrent, true)
  assert.equal(listed.revisions[1].revisionId, firstCurrent.revisionId)
  assert.equal(listed.revisions[1].isCurrent, false)
  assert.deepEqual(fakeDb.data(`tenants/tenant-1/site/config/revisions/${firstCurrent.revisionId}`), firstRevision)

  const restored = await restoreSiteRevision('tenant-1', firstCurrent.revisionId)
  assert.equal(restored.branding.siteName, first.branding.siteName)
  assert.equal((await getSite('tenant-1')).branding.siteName, first.branding.siteName)
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), secondCurrent)
  assert.equal((await getPublishedSiteDefinition('tenant-1')).branding.siteName, second.branding.siteName)
})

test('published revision retention keeps current and prunes the oldest revision', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Retention' })
  await initializeSite('tenant-1', 'admin')
  const ids = []
  for (let index = 0; index < 11; index += 1) {
    await updateSiteBranding('tenant-1', { siteName: `Retention ${index}` })
    await publishSite('tenant-1', 'publisher')
    ids.push(fakeDb.data('tenants/tenant-1/site/config/published/current').revisionId)
  }
  const index = fakeDb.data('tenants/tenant-1/site/config/revisionIndex/current')
  assert.equal(index.entries.length, 10)
  assert.equal(index.entries[0].revisionId, ids.at(-1))
  assert.equal(fakeDb.data(`tenants/tenant-1/site/config/revisions/${ids[0]}`), undefined)
  await assert.rejects(restoreSiteRevision('tenant-1', ids[0]), { status: 404 })
})

test('restore replaces the full working site with historical globals, pages, SEO, and stable ids', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Restore' })
  await initializeSite('tenant-1', 'admin')
  const { pageId: historicalPageId } = await createPage('tenant-1', { title: 'History page', slug: 'history' })
  await updateHomeHero('tenant-1', { title: 'Historical hero' })
  await updateSiteBranding('tenant-1', { siteName: 'Historical brand' })
  await updateBusinessProfile('tenant-1', { description: 'Historical profile', phone: '+15555550100' })
  await updateSiteSeo('tenant-1', { defaultDescription: 'Historical SEO', indexable: false })
  await updatePageSeo('tenant-1', historicalPageId, { title: 'Historical page SEO', noIndex: true })
  await updateSiteHeader('tenant-1', { brandDisplay: 'name', navigation: { items: [{ pageId: historicalPageId }] } })
  await updateSiteFooter('tenant-1', { showBranding: false, navigationMode: 'custom', navigationItems: [{ pageId: historicalPageId }], showBusinessContact: true, showSocialLinks: false, showCopyright: true, text: 'Historical footer' })
  await updateSiteTheme('tenant-1', { colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'lora', bodyFont: 'inter', cornerStyle: 'square', contentWidth: 'wide', sectionSpacing: 'spacious' })
  await updateCustomCss('tenant-1', { customCss: '[data-br-site] { color: red; }' })
  await publishSite('tenant-1', 'publisher-a')
  const historicalCurrent = fakeDb.data('tenants/tenant-1/site/config/published/current')
  const historicalPage = fakeDb.data(`tenants/tenant-1/site/config/pages/${historicalPageId}`)

  await updateHomeHero('tenant-1', { title: 'Working B' })
  await updateSiteBranding('tenant-1', { siteName: 'Working B' })
  const { pageId: displacedPageId } = await createPage('tenant-1', { title: 'Displaced', slug: 'displaced' })
  await publishSite('tenant-1', 'publisher-b')
  const currentBeforeRestore = fakeDb.data('tenants/tenant-1/site/config/published/current')

  const restored = await restoreSiteRevision('tenant-1', historicalCurrent.revisionId)
  assert.equal(restored.branding.siteName, 'Historical brand')
  assert.equal(restored.businessProfile.description, 'Historical profile')
  assert.equal(restored.seo.defaultDescription, 'Historical SEO')
  assert.equal(restored.customCss, '[data-br-site] { color: red; }')
  assert.equal(restored.theme.headingFont, 'lora')
  assert.deepEqual(restored.pages.map((page) => page.id), ['home', historicalPageId])
  assert.equal(restored.pages[0].sections[0].content.title, 'Historical hero')
  assert.deepEqual(restored.pages[1].seo, { title: 'Historical page SEO', noIndex: true })
  assert.deepEqual(fakeDb.data(`tenants/tenant-1/site/config/pages/${historicalPageId}`).sections, historicalPage.sections)
  assert.equal(fakeDb.data(`tenants/tenant-1/site/config/pages/${displacedPageId}`), undefined)
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), currentBeforeRestore)
})

test('first post-history publish captures a legacy current snapshot with its original metadata', async () => {
  const originalNow = Date.now
  let now = 100
  Date.now = () => now
  try {
    fakeDb.seed('tenants/tenant-1', { name: 'Legacy A' })
    await initializeSite('tenant-1', 'admin')
    await publishSite('tenant-1', 'publisher-a')
    const legacyCurrent = fakeDb.data('tenants/tenant-1/site/config/published/current')
    const oldRevisionId = legacyCurrent.revisionId
    delete legacyCurrent.revisionId
    fakeDb.seed('tenants/tenant-1/site/config/published/current', legacyCurrent)
    fakeDb.remove(`tenants/tenant-1/site/config/revisions/${oldRevisionId}`)
    fakeDb.remove(`tenants/tenant-1/site/config/revisionMedia/${oldRevisionId}`)
    fakeDb.remove('tenants/tenant-1/site/config/revisionIndex/current')

    now = 200
    await updateSiteBranding('tenant-1', { siteName: 'Legacy B' })
    now = 300
    await publishSite('tenant-1', 'publisher-b')

    const index = fakeDb.data('tenants/tenant-1/site/config/revisionIndex/current').entries
    const current = fakeDb.data('tenants/tenant-1/site/config/published/current')
    const baseline = fakeDb.data(`tenants/tenant-1/site/config/revisions/${index[1].revisionId}`)
    assert.equal(index.length, 2)
    assert.equal(index[0].revisionId, current.revisionId)
    assert.equal(baseline.publishedAt, 100)
    assert.equal(baseline.publishedByUserId, 'publisher-a')
    assert.equal(baseline.siteDefinition.branding.siteName, 'Legacy A')
    assert.deepEqual(fakeDb.data(`tenants/tenant-1/site/config/revisionMedia/${baseline.revisionId}`).mediaIds, [])
  } finally {
    Date.now = originalNow
  }
})

test('restore rejects a malformed retained revision without repairing or changing Working', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Corrupt revision' })
  await initializeSite('tenant-1', 'admin')
  await publishSite('tenant-1', 'publisher')
  const current = fakeDb.data('tenants/tenant-1/site/config/published/current')
  const revisionPath = `tenants/tenant-1/site/config/revisions/${current.revisionId}`
  const corrupt = fakeDb.data(revisionPath)
  fakeDb.seed(revisionPath, { ...corrupt, siteDefinition: { status: 'PUBLISHED', pages: [] } })
  const workingBefore = fakeDb.data('tenants/tenant-1/site/config')

  await assert.rejects(restoreSiteRevision('tenant-1', current.revisionId), {
    status: 500,
    message: 'Published revision is invalid'
  })
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config'), workingBefore)
})

test('restore retries against concurrent working edits and publishes without altering the live current revision', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Revision A' })
  await initializeSite('tenant-1', 'admin')
  await publishSite('tenant-1', 'publisher-a')
  const revisionA = fakeDb.data('tenants/tenant-1/site/config/published/current').revisionId
  await updateSiteBranding('tenant-1', { siteName: 'Working B' })

  const attemptsBeforeEdit = fakeDb.transactionAttempts
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await updateSiteBranding('tenant-1', { siteName: 'Concurrent edit' })
  }
  await restoreSiteRevision('tenant-1', revisionA)
  assert.equal((await getSite('tenant-1')).branding.siteName, 'Revision A')
  assert.ok(fakeDb.transactionAttempts - attemptsBeforeEdit >= 3)

  await updateSiteBranding('tenant-1', { siteName: 'Working C' })
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await publishSite('tenant-1', 'publisher-b')
  }
  await restoreSiteRevision('tenant-1', revisionA)
  const live = fakeDb.data('tenants/tenant-1/site/config/published/current')
  assert.equal((await getSite('tenant-1')).branding.siteName, 'Revision A')
  assert.equal((await getPublishedSiteDefinition('tenant-1')).branding.siteName, 'Working C')
  assert.notEqual(live.revisionId, revisionA)
})

test('restore retries then rejects when a concurrent publish prunes its selected revision', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Revision 0' })
  await initializeSite('tenant-1', 'admin')
  const revisionIds = []
  for (let index = 0; index < 10; index += 1) {
    await updateSiteBranding('tenant-1', { siteName: `Revision ${index}` })
    await publishSite('tenant-1', 'publisher')
    revisionIds.push(fakeDb.data('tenants/tenant-1/site/config/published/current').revisionId)
  }
  fakeDb.beforeCommit = async () => {
    fakeDb.beforeCommit = null
    await publishSite('tenant-1', 'publisher')
  }
  await assert.rejects(restoreSiteRevision('tenant-1', revisionIds[0]), {
    status: 404,
    message: 'Published revision not found'
  })
  assert.equal(fakeDb.data(`tenants/tenant-1/site/config/revisions/${revisionIds[0]}`), undefined)
})

test('publish writes one bounded media manifest for hundreds of referenced media ids', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Many media' })
  await initializeSite('tenant-1', 'admin')
  const mediaRecord = (id) => ({
    originalFilename: `${id}.png`,
    objectName: `tenants/tenant-1/media/${id}`,
    contentType: 'image/png',
    sizeBytes: 1,
    width: 1,
    height: 1,
    createdAt: 1,
    createdByUserId: 'admin'
  })
  for (let pageIndex = 0; pageIndex < 24; pageIndex += 1) {
    const { pageId } = await createPage('tenant-1', { title: `Page ${pageIndex}`, slug: `page-${pageIndex}` })
    const items = Array.from({ length: 20 }, (_, itemIndex) => {
      const id = `image-${pageIndex}-${itemIndex}`
      fakeDb.seed(`tenants/tenant-1/media/${id}`, mediaRecord(id))
      return { id: randomUUID(), mediaId: id, altText: id }
    })
    const page = fakeDb.data(`tenants/tenant-1/site/config/pages/${pageId}`)
    fakeDb.seed(`tenants/tenant-1/site/config/pages/${pageId}`, {
      ...page,
      sections: [{ id: randomUUID(), type: 'gallery', hidden: false, content: { title: 'Gallery', items } }]
    })
  }
  let writes
  fakeDb.beforeCommit = ({ writes: transactionWrites }) => {
    fakeDb.beforeCommit = null
    writes = transactionWrites
  }
  await publishSite('tenant-1', 'publisher')
  assert.equal(writes.filter((write) => write.ref.path.includes('/revisionMedia/')).length, 1)
  assert.equal(writes.filter((write) => write.ref.path.includes('/media/')).length, 0)
  assert.equal(fakeDb.data('tenants/tenant-1/site/config/revisionMedia/' + fakeDb.data('tenants/tenant-1/site/config/published/current').revisionId).mediaIds.length, 480)
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

test('curated site template catalog exposes metadata only and validates each source template', async () => {
  const templates = await listSiteTemplates()
  assert.deepEqual(templates.map((template) => template.id), [
    'modern-local-service', 'classic-professional', 'bold-contractor'
  ])
  for (const [index, template] of templates.entries()) {
    assert.deepEqual(Object.keys(template).sort(), ['description', 'id', 'name', 'tags', 'version'])
    assert.equal(validateSiteTemplate(SITE_TEMPLATES[index]), true)
    assert.equal(JSON.stringify(SITE_TEMPLATES[index]).includes('mediaId'), false)
    assert.equal(JSON.stringify(SITE_TEMPLATES[index]).includes('testimonials'), false)
    assert.equal(JSON.stringify(SITE_TEMPLATES[index]).includes('stats'), false)
  }
})

test('materialized templates reject invalid runtime Page composition instead of repairing it', () => {
  const config = { status: 'DRAFT', branding: { siteName: 'Website' } }
  const invalidTemplate = (mutate) => {
    const template = structuredClone(SITE_TEMPLATES[0])
    mutate(template)
    assert.throws(() => materializeSiteTemplate(template, config, 10), { status: 500 })
  }

  invalidTemplate((template) => { template.pages[1].slug = 'Invalid slug' })
  invalidTemplate((template) => { template.pages[1].slug = template.pages[2].slug })
  invalidTemplate((template) => { template.pages[1].sections.unshift({ type: 'hero', hidden: false, content: { title: 'Not Home' } }) })
  invalidTemplate((template) => { template.pages[0].sections.push(structuredClone(template.pages[0].sections.at(-1))) })
  invalidTemplate((template) => { template.pages[0].sections[0].hidden = true })
  invalidTemplate((template) => { template.header.navigation.items[0].pageKey = 'unknown-page' })
})

test('applying a site template replaces working pages and preserves tenant-owned configuration', async () => {
  const originalNow = Date.now
  let now = 50
  Date.now = () => now
  try {
    fakeDb.seed('tenants/tenant-1', { name: 'Template customer' })
    await initializeSite('tenant-1', 'admin')
    now = 100
    await publishSite('tenant-1', 'publisher')
    const publishedBeforeApply = fakeDb.data('tenants/tenant-1/site/config/published/current')
    const original = fakeDb.data('tenants/tenant-1/site/config')
    fakeDb.seed('tenants/tenant-1/site/config', {
      ...original,
      branding: { siteName: 'Kept name' },
      businessProfile: { phone: '+15555550100' },
      seo: { defaultDescription: 'Keep global SEO', indexable: false },
      customCss: '.kept { color: red; }',
      pageOrder: ['home', 'old-page']
    })
    fakeDb.seed('tenants/tenant-1/site/config/pages/old-page', {
      id: 'old-page', slug: 'old-page', title: 'Old page', sections: [], createdAt: 50, updatedAt: 50, seo: { title: 'Old SEO' }
    })

    now = 200
    const applied = await applySiteTemplate('tenant-1', 'modern-local-service')
    const config = fakeDb.data('tenants/tenant-1/site/config')
    assert.equal(applied.status, 'PUBLISHED')
    assert.equal(applied.hasUnpublishedChanges, true)
    assert.equal(applied.lastPublishedAt, 100)
    assert.deepEqual(config.branding, { siteName: 'Kept name' })
    assert.deepEqual(config.businessProfile, { phone: '+15555550100' })
    assert.deepEqual(config.seo, { defaultDescription: 'Keep global SEO', indexable: false })
    assert.equal(config.customCss, '.kept { color: red; }')
    assert.equal(config.lastPublishedAt, 100)
    assert.equal(config.lastPublishedByUserId, 'publisher')
    assert.equal(config.updatedAt, 200)
    assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), publishedBeforeApply)
    assert.equal(fakeDb.data('tenants/tenant-1/site/config/published/current').publishedAt, publishedBeforeApply.publishedAt)
    assert.equal(applied.pages.some((page) => page.id !== 'home' && publishedBeforeApply.siteDefinition.pages.some((publishedPage) => publishedPage.id === page.id)), false)
    assert.equal(fakeDb.data('tenants/tenant-1/site/config/pages/old-page'), undefined)
    assert.equal(applied.pages[0].id, 'home')
    assert.ok(applied.pages.slice(1).every((page) => page.id !== 'home'))
    assert.ok(applied.pages.every((page) => !Object.hasOwn(page, 'seo')))
    assert.ok(config.pageOrder.every((pageId) => !Object.hasOwn(fakeDb.data(`tenants/tenant-1/site/config/pages/${pageId}`), 'seo')))

    const pageIds = new Set(applied.pages.map((page) => page.id))
    for (const item of [...applied.header.navigation.items, ...applied.footer.navigationItems]) {
      assert.ok(pageIds.has(item.pageId))
      assert.equal(Object.hasOwn(item, 'pageKey'), false)
    }
    const sections = applied.pages.flatMap((page) => page.sections)
    assert.equal(new Set(sections.map((section) => section.id)).size, sections.length)
    const itemIds = sections.flatMap((section) => section.content.items || []).map((item) => item.id)
    assert.equal(new Set(itemIds).size, itemIds.length)
  } finally {
    Date.now = originalNow
  }
})

test('template materialization regenerates every persisted identifier, including nested item ids', () => {
  const template = {
    ...SITE_TEMPLATES[0],
    header: { brandDisplay: 'logo', navigation: { items: [{ pageKey: 'home' }] } },
    footer: {
      showBranding: true,
      navigationMode: 'custom',
      navigationItems: [{ pageKey: 'home' }],
      showBusinessContact: false,
      showSocialLinks: true,
      showCopyright: true
    },
    pages: [{
      key: 'home',
      slug: '/',
      title: 'Home',
      sections: [
        { type: 'hero', hidden: false, content: { title: 'Start' } },
        { type: 'services', hidden: false, content: { title: 'Services', items: [{ name: 'One' }] } },
        { type: 'gallery', hidden: false, content: { title: 'Gallery', items: [{ mediaId: 'test-media', altText: 'Test image' }] } },
        { type: 'testimonials', hidden: false, content: { title: 'Testimonials', items: [{ customerName: 'Name', quote: 'Quote' }] } },
        { type: 'faq', hidden: false, content: { heading: 'FAQ', items: [{ question: 'Question', answer: 'Answer' }] } },
        { type: 'process', hidden: false, content: { items: [{ title: 'Step' }] } },
        { type: 'stats', hidden: false, content: { items: [{ value: '1', label: 'One' }] } },
        { type: 'logos', hidden: false, content: { items: [{ mediaId: 'test-logo', altText: 'Test logo' }] } }
      ]
    }]
  }
  const config = { status: 'DRAFT', branding: { siteName: 'Website' } }
  const first = materializeSiteTemplate(template, config, 10)
  const second = materializeSiteTemplate(template, config, 10)
  const ids = (result) => result.pages.flatMap((page) => page.sections).flatMap((section) => [section.id, ...(section.content.items || []).map((item) => item.id)])
  assert.equal(new Set(ids(first)).size, ids(first).length)
  assert.equal(ids(first).some((id) => ids(second).includes(id)), false)
  const preserved = materializeSiteTemplate(SITE_TEMPLATES[0], {
    status: 'PUBLISHED',
    branding: { siteName: 'Kept', logoMediaId: 'logo-1', faviconMediaId: 'favicon-1' },
    businessProfile: { socialImageMediaId: 'social-1' },
    seo: { defaultDescription: 'Kept' },
    customCss: '.kept {}',
    lastPublishedAt: 1,
    lastPublishedByUserId: 'publisher'
  }, 10)
  assert.deepEqual(preserved.config.branding, { siteName: 'Kept', logoMediaId: 'logo-1', faviconMediaId: 'favicon-1' })
  assert.deepEqual(preserved.config.businessProfile, { socialImageMediaId: 'social-1' })
  assert.equal(preserved.config.customCss, '.kept {}')
  assert.equal(preserved.config.lastPublishedAt, 1)
})

test('template application regenerates ids within Firestore retry callbacks without duplicate persisted pages', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Retry customer' })
  await initializeSite('tenant-1', 'admin')
  fakeDb.beforeCommit = ({ attempt }) => {
    if (attempt === 1) {
      const config = fakeDb.data('tenants/tenant-1/site/config')
      fakeDb.seed('tenants/tenant-1/site/config', { ...config, updatedAt: config.updatedAt + 1 })
    }
  }
  const applied = await applySiteTemplate('tenant-1', 'bold-contractor')
  assert.equal(fakeDb.transactionAttempts, 3) // initialization plus one retry and a successful apply.
  const storedPageIds = fakeDb.data('tenants/tenant-1/site/config').pageOrder
  assert.deepEqual(storedPageIds, applied.pages.map((page) => page.id))
  assert.equal(new Set(storedPageIds).size, storedPageIds.length)
})

test('Publish retries after Apply commits and snapshots one coherent template generation', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Publication race' })
  await initializeSite('tenant-1', 'admin')
  let interleaved = false
  let publishAttempts = 0
  let applied
  fakeDb.beforeCommit = async ({ writes }) => {
    const publishing = writes.some((write) => write.ref.path.endsWith('/published/current'))
    if (publishing) publishAttempts++
    if (publishing && !interleaved) {
      interleaved = true
      applied = await applySiteTemplate('tenant-1', 'classic-professional')
    }
  }

  await publishSite('tenant-1', 'publisher')
  const config = fakeDb.data('tenants/tenant-1/site/config')
  const snapshot = fakeDb.data('tenants/tenant-1/site/config/published/current').siteDefinition
  const publishedPageIds = snapshot.pages.map((page) => page.id)
  assert.equal(publishAttempts, 2)
  assert.deepEqual(publishedPageIds, config.pageOrder)
  assert.equal(snapshot.pages[0].id, 'home')
  assert.ok(config.pageOrder.slice(1).every((pageId) => snapshot.pages.some((page) => page.id === pageId)))
  for (const item of snapshot.header.navigation.items) assert.ok(publishedPageIds.includes(item.pageId))
  for (const item of snapshot.footer.navigationItems) assert.ok(publishedPageIds.includes(item.pageId))
  assert.deepEqual(snapshot.pages, applied.pages)
  assert.deepEqual(snapshot.header, applied.header)
  assert.deepEqual(snapshot.footer, applied.footer)
  assert.equal(JSON.stringify(snapshot).includes('pageKey'), false)
  assert.equal(snapshot.pages.some((page) => page.sections.some((section) => section.content?.title === 'Publication race')), false)
})

test('Apply retries around a preserved Business Profile update without overwriting it', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Preservation race' })
  await initializeSite('tenant-1', 'admin')
  let interleaved = false
  let applyAttempts = 0
  fakeDb.beforeCommit = async ({ writes }) => {
    const applying = writes.some((write) => write.ref.path.endsWith('/pages/home'))
    if (applying) applyAttempts++
    if (applying && !interleaved) {
      interleaved = true
      await updateBusinessProfile('tenant-1', { phone: '+17205550100' })
    }
  }

  const applied = await applySiteTemplate('tenant-1', 'bold-contractor')
  const config = fakeDb.data('tenants/tenant-1/site/config')
  assert.equal(applyAttempts, 2)
  assert.equal(config.businessProfile.phone, '+17205550100')
  assert.deepEqual(config.theme, SITE_TEMPLATES[2].theme)
  assert.deepEqual(config.pageOrder, applied.pages.map((page) => page.id))
  assert.deepEqual(applied.header.navigation.items.map((item) => item.pageId), config.header.navigation.items.map((item) => item.pageId))
})

test('Apply retries around a Page edit and intentionally supersedes the old Page generation', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Page race' })
  await initializeSite('tenant-1', 'admin')
  const { pageId } = await createPage('tenant-1', { title: 'Legacy page', slug: 'legacy-page' })
  let interleaved = false
  let applyAttempts = 0
  fakeDb.beforeCommit = async ({ writes }) => {
    const applying = writes.some((write) => write.ref.path.endsWith('/pages/home'))
    if (applying) applyAttempts++
    if (applying && !interleaved) {
      interleaved = true
      await updatePage('tenant-1', pageId, { title: 'Concurrent legacy edit' })
    }
  }

  const applied = await applySiteTemplate('tenant-1', 'modern-local-service')
  const config = fakeDb.data('tenants/tenant-1/site/config')
  assert.equal(applyAttempts, 2)
  assert.deepEqual(config.pageOrder, applied.pages.map((page) => page.id))
  assert.equal(fakeDb.data(`tenants/tenant-1/site/config/pages/${pageId}`), undefined)
  assert.equal(applied.pages.some((page) => page.title === 'Concurrent legacy edit'), false)
  assert.equal(applied.pages.some((page) => page.slug === 'legacy-page'), false)
})
