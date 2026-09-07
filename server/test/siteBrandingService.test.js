import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { contrastColor } from '../domain/siteBranding.js'
import {
  _setDb as setSiteDb,
  getPublicSite,
  getSite,
  initializeSite,
  publishSite,
  updateBusinessProfile,
  updateSiteBranding
} from '../services/siteService.js'
import { upsertHomeGallery } from './helpers/legacySiteTestBridge.js'
import { _setDb as setMediaDb, _setStorage } from '../services/mediaService.js'
import { FieldValue } from '../client/firestoreClient.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

let fakeDb
const normalEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }
const previewEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }
const mediaRecord = (id) => ({
  originalFilename: `${id}.png`,
  objectName: `tenants/tenant-1/media/${id}`,
  contentType: 'image/png',
  sizeBytes: 20,
  width: 600,
  height: 300,
  createdAt: 1,
  createdByUserId: 'admin'
})

const isDeleteSentinel = (value) =>
  Boolean(value && typeof value.isEqual === 'function' && value.isEqual(FieldValue.delete()))

const recursiveMergeMaps = (existing, update) => {
  if (update == null || typeof update !== 'object' || Array.isArray(update)) return update
  const next = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...existing }
    : {}
  for (const [key, value] of Object.entries(update)) {
    if (isDeleteSentinel(value)) delete next[key]
    else if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      next[key] && typeof next[key] === 'object' && !Array.isArray(next[key])
    ) {
      next[key] = recursiveMergeMaps(next[key], value)
    } else {
      next[key] = value
    }
  }
  return next
}

const captureTransactionWrites = (db) => {
  const writes = []
  const originalRun = db.runTransaction.bind(db)
  db.runTransaction = (callback) => originalRun(async (transaction) => {
    const origSet = transaction.set
    transaction.set = (ref, value, options) => {
      writes.push({ type: 'set', value, options })
      return origSet(ref, value, options)
    }
    const origUpdate = transaction.update
    transaction.update = (ref, value) => {
      writes.push({ type: 'update', value })
      if (typeof origUpdate === 'function') return origUpdate(ref, value)
      return origSet(ref, value, { merge: true })
    }
    return callback(transaction)
  })
  return writes
}

const brandingFromWrite = (existingBranding, write) => {
  const incoming = write?.value?.branding
  if (!incoming || typeof incoming !== 'object') return existingBranding
  const withoutDeletes = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (!isDeleteSentinel(value)) withoutDeletes[key] = value
  }
  const replacesMap = write.type === 'update' || (write.type === 'set' && !write.options?.merge)
  if (replacesMap) return withoutDeletes
  return recursiveMergeMaps(existingBranding, incoming)
}

const writeDeletesNestedKey = (write, key) => {
  const incoming = write?.value?.branding
  if (!incoming || typeof incoming !== 'object') return false
  if (isDeleteSentinel(incoming[key])) return true
  const replacesMap = write.type === 'update' || (write.type === 'set' && !write.options?.merge)
  return replacesMap && Object.hasOwn(incoming, key) === false
}

beforeEach(() => {
  fakeDb = new FakeDb().seed('tenants/tenant-1', { name: '  Acme Studio  ' })
  setSiteDb(fakeDb)
  setMediaDb(fakeDb)
  _setStorage(new FakeStorage())
})

afterEach(() => {
  setSiteDb()
  setMediaDb()
  _setStorage()
})

test('branding initializes from tenant name with identity-only fields and no tenant mutation', async () => {
  const site = await initializeSite('tenant-1', 'admin')
  assert.deepEqual(site.branding, {
    siteName: 'Acme Studio'
  })
  assert.equal(fakeDb.data('tenants/tenant-1').name, '  Acme Studio  ')
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config').branding, site.branding)

  const longName = `  ${'X'.repeat(100)}  `
  fakeDb.seed('tenants/tenant-long', { name: longName })
  const longSite = await initializeSite('tenant-long', 'admin')
  assert.equal(longSite.branding.siteName, 'X'.repeat(80))
  assert.equal(fakeDb.data('tenants/tenant-long').name, longName)
})

test('branding ignores retired colors and enforces identity/media validation', async () => {
  await initializeSite('tenant-1', 'admin')
  for (const input of [
    { siteName: '' },
    { siteName: 'A'.repeat(81) }
  ]) await assert.rejects(updateSiteBranding('tenant-1', input), { status: 400 })
  await assert.rejects(updateSiteBranding('tenant-1', {
    siteName: 'Site', logoMediaId: 'missing'
  }), { status: 400, message: 'Logo image not found' })

  fakeDb.seed('tenants/tenant-1/media/logo', mediaRecord('logo'))
  const site = await updateSiteBranding('tenant-1', {
    siteName: '  New Name  ', primaryColor: 'not-a-color', accentColor: 'also-not-a-color', logoMediaId: 'logo'
  })
  assert.equal(Object.hasOwn(site.branding, 'primaryColor'), false)
  assert.equal(Object.hasOwn(site.branding, 'accentColor'), false)
  assert.equal(site.branding.logoSrc, 'https://media.test/tenants/tenant-1/media/logo')
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config').branding, {
    siteName: 'New Name', logoMediaId: 'logo'
  })
})

test('working branding stays isolated from public reads until republish', async () => {
  await initializeSite('tenant-1', 'admin')
  await updateSiteBranding('tenant-1', {
    siteName: 'Version A'
  })
  await publishSite('tenant-1', 'admin')
  await updateSiteBranding('tenant-1', {
    siteName: 'Version B'
  })
  assert.equal((await getSite('tenant-1')).branding.siteName, 'Version B')
  assert.equal((await getPublicSite('tenant-1', previewEnv)).branding.siteName, 'Version B')
  assert.equal((await getPublicSite('tenant-1', normalEnv)).branding.siteName, 'Version A')
  await publishSite('tenant-1', 'admin')
  assert.equal((await getPublicSite('tenant-1', normalEnv)).branding.siteName, 'Version B')
})

test('legacy working and published sites derive branding from their own Hero snapshot without repair writes', async () => {
  fakeDb.seed('tenants/tenant-1/site/config', { status: 'PUBLISHED', createdAt: 1, updatedAt: 1 })
  fakeDb.seed('tenants/tenant-1/site/config/pages/home', {
    id: 'home', slug: '/', title: 'Home', sections: [{ id: 'hero', type: 'hero', hidden: false, content: { title: 'Working Hero' } }]
  })
  fakeDb.seed('tenants/tenant-1/site/config/published/current', {
    siteDefinition: {
      status: 'PUBLISHED',
      pages: [{ id: 'home', slug: '/', title: 'Home', sections: [{ id: 'hero', type: 'hero', hidden: false, content: { title: 'Published Hero' } }] }]
    },
    publishedAt: 1,
    publishedByUserId: 'admin'
  })
  assert.equal((await getSite('tenant-1')).branding.siteName, 'Working Hero')
  assert.equal((await getPublicSite('tenant-1', normalEnv)).branding.siteName, 'Published Hero')
  assert.equal(Object.hasOwn(fakeDb.data('tenants/tenant-1/site/config'), 'branding'), false)
  assert.equal(Object.hasOwn(fakeDb.data('tenants/tenant-1/site/config/published/current').siteDefinition, 'branding'), false)
})

test('logo, social image, and Gallery hydrate through one batch while storage remains provider-neutral', async () => {
  await initializeSite('tenant-1', 'admin')
  fakeDb.seed('tenants/tenant-1/media/logo', mediaRecord('logo'))
  fakeDb.seed('tenants/tenant-1/media/favicon', mediaRecord('favicon'))
  fakeDb.seed('tenants/tenant-1/media/gallery', mediaRecord('gallery'))
  fakeDb.seed('tenants/tenant-1/media/social', mediaRecord('social'))
  await updateSiteBranding('tenant-1', {
    siteName: 'Site', logoMediaId: 'logo', faviconMediaId: 'favicon'
  })
  await upsertHomeGallery('tenant-1', {
    title: 'Work', items: [{ mediaId: 'gallery', altText: 'A project' }]
  })
  await updateBusinessProfile('tenant-1', { socialImageMediaId: 'social' })
  const originalGetAll = fakeDb.getAll.bind(fakeDb)
  const batches = []
  fakeDb.getAll = async (...refs) => {
    batches.push(refs.map((ref) => ref.id))
    return originalGetAll(...refs)
  }
  const site = await getSite('tenant-1')
  assert.deepEqual(batches, [['home'], ['logo', 'favicon', 'social', 'gallery']])
  assert.equal(site.branding.logoSrc, 'https://media.test/tenants/tenant-1/media/logo')
  assert.equal(site.pages[0].sections.find((section) => section.type === 'gallery').content.items[0].src,
    'https://media.test/tenants/tenant-1/media/gallery')
  assert.equal(site.businessProfile.socialImageSrc,
    'https://media.test/tenants/tenant-1/media/social')
  const stored = fakeDb.data('tenants/tenant-1/site/config')
  assert.equal(Object.hasOwn(stored.branding, 'logoSrc'), false)
  assert.deepEqual(stored.businessProfile, { socialImageMediaId: 'social' })

  fakeDb.records.delete('tenants/tenant-1/media/logo')
  fakeDb.records.delete('tenants/tenant-1/media/favicon')
  const missingLogo = await getSite('tenant-1')
  assert.equal(missingLogo.branding.logoMediaId, 'logo')
  assert.equal(Object.hasOwn(missingLogo.branding, 'logoSrc'), false)
  assert.equal(missingLogo.branding.faviconMediaId, 'favicon')
  assert.equal(Object.hasOwn(missingLogo.branding, 'faviconSrc'), false)
})

test('favicon branding validates ownership, persists without src, and clears independently of logo', async () => {
  await initializeSite('tenant-1', 'admin')
  await assert.rejects(updateSiteBranding('tenant-1', {
    siteName: 'Site', faviconMediaId: 'missing'
  }), { status: 400, message: 'Favicon image not found' })
  await assert.rejects(updateSiteBranding('tenant-1', {
    siteName: 'Site', faviconMediaId: 1
  }), { status: 400, message: 'Favicon image is invalid' })

  fakeDb.seed('tenants/tenant-1/media/logo', mediaRecord('logo'))
  fakeDb.seed('tenants/tenant-1/media/favicon', mediaRecord('favicon'))
  const site = await updateSiteBranding('tenant-1', {
    siteName: 'Site', logoMediaId: 'logo', faviconMediaId: 'favicon'
  })
  assert.equal(site.branding.faviconMediaId, 'favicon')
  assert.equal(site.branding.faviconSrc, 'https://media.test/tenants/tenant-1/media/favicon')
  assert.equal(Object.hasOwn(fakeDb.data('tenants/tenant-1/site/config').branding, 'faviconSrc'), false)
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config').branding, {
    siteName: 'Site', logoMediaId: 'logo', faviconMediaId: 'favicon'
  })

  const droppedFavicon = await updateSiteBranding('tenant-1', {
    siteName: 'Site', logoMediaId: 'logo'
  })
  assert.equal(droppedFavicon.branding.logoMediaId, 'logo')
  assert.equal(Object.hasOwn(droppedFavicon.branding, 'faviconMediaId'), false)
  assert.equal(Object.hasOwn(fakeDb.data('tenants/tenant-1/site/config').branding, 'faviconMediaId'), false)
  assert.equal(fakeDb.data('tenants/tenant-1/site/config').branding.logoMediaId, 'logo')

  const restored = await updateSiteBranding('tenant-1', {
    siteName: 'Site', logoMediaId: 'logo', faviconMediaId: 'favicon'
  })
  assert.equal(restored.branding.faviconMediaId, 'favicon')
  const droppedLogo = await updateSiteBranding('tenant-1', {
    siteName: 'Site', faviconMediaId: 'favicon'
  })
  assert.equal(droppedLogo.branding.faviconMediaId, 'favicon')
  assert.equal(Object.hasOwn(droppedLogo.branding, 'logoMediaId'), false)
  assert.equal(fakeDb.data('tenants/tenant-1/site/config').branding.faviconMediaId, 'favicon')
})

test('omit-to-clear deletes nested branding media ids under recursive Firestore merge', async () => {
  await initializeSite('tenant-1', 'admin')
  fakeDb.seed('tenants/tenant-1/media/logo', mediaRecord('logo'))
  fakeDb.seed('tenants/tenant-1/media/favicon', mediaRecord('favicon'))
  await updateSiteBranding('tenant-1', {
    siteName: 'Site', logoMediaId: 'logo', faviconMediaId: 'favicon'
  })

  const writes = captureTransactionWrites(fakeDb)
  const beforeClearFavicon = fakeDb.data('tenants/tenant-1/site/config').branding
  await updateSiteBranding('tenant-1', { siteName: 'Site', logoMediaId: 'logo' })
  const clearFaviconWrite = writes.at(-1)
  const afterClearFavicon = brandingFromWrite(beforeClearFavicon, clearFaviconWrite)
  assert.equal(writeDeletesNestedKey(clearFaviconWrite, 'faviconMediaId'), true)
  assert.equal(writeDeletesNestedKey(clearFaviconWrite, 'logoMediaId'), false)
  assert.equal(Object.hasOwn(afterClearFavicon, 'faviconMediaId'), false)
  assert.equal(afterClearFavicon.logoMediaId, 'logo')

  writes.length = 0
  await updateSiteBranding('tenant-1', {
    siteName: 'Site', logoMediaId: 'logo', faviconMediaId: 'favicon'
  })
  const beforeClearLogo = fakeDb.data('tenants/tenant-1/site/config').branding
  writes.length = 0
  await updateSiteBranding('tenant-1', { siteName: 'Site', faviconMediaId: 'favicon' })
  const clearLogoWrite = writes.at(-1)
  const afterClearLogo = brandingFromWrite(beforeClearLogo, clearLogoWrite)
  assert.equal(writeDeletesNestedKey(clearLogoWrite, 'logoMediaId'), true)
  assert.equal(writeDeletesNestedKey(clearLogoWrite, 'faviconMediaId'), false)
  assert.equal(Object.hasOwn(afterClearLogo, 'logoMediaId'), false)
  assert.equal(afterClearLogo.faviconMediaId, 'favicon')
})

test('working favicon stays isolated from public reads until republish', async () => {
  await initializeSite('tenant-1', 'admin')
  fakeDb.seed('tenants/tenant-1/media/favicon-a', mediaRecord('favicon-a'))
  fakeDb.seed('tenants/tenant-1/media/favicon-b', mediaRecord('favicon-b'))
  await updateSiteBranding('tenant-1', { siteName: 'Site', faviconMediaId: 'favicon-a' })
  await publishSite('tenant-1', 'admin')
  const publishedA = await getPublicSite('tenant-1', normalEnv)
  assert.equal(publishedA.branding.faviconMediaId, 'favicon-a')
  assert.equal(publishedA.branding.faviconSrc, 'https://media.test/tenants/tenant-1/media/favicon-a')

  await updateSiteBranding('tenant-1', { siteName: 'Site', faviconMediaId: 'favicon-b' })
  assert.equal((await getSite('tenant-1')).branding.faviconSrc, 'https://media.test/tenants/tenant-1/media/favicon-b')
  assert.equal((await getPublicSite('tenant-1', previewEnv)).branding.faviconSrc,
    'https://media.test/tenants/tenant-1/media/favicon-b')
  const stillA = await getPublicSite('tenant-1', normalEnv)
  assert.equal(stillA.branding.faviconMediaId, 'favicon-a')
  assert.equal(stillA.branding.faviconSrc, 'https://media.test/tenants/tenant-1/media/favicon-a')

  await publishSite('tenant-1', 'admin')
  assert.equal((await getPublicSite('tenant-1', normalEnv)).branding.faviconSrc,
    'https://media.test/tenants/tenant-1/media/favicon-b')
})

test('contrast helper chooses the better white or near-black foreground', () => {
  assert.equal(contrastColor('#000000'), '#ffffff')
  assert.equal(contrastColor('#ffffff'), '#111827')
  assert.equal(contrastColor('#FFD500'), '#111827')
})
