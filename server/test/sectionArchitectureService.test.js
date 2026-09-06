import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  addSection as addSectionCommand,
  duplicateSection as duplicateSectionCommand,
  getSite,
  initializeSite,
  moveSection,
  publishSite,
  removeSection,
  setSectionVisibility,
  updateBusinessHours,
  updateSectionContent,
  validateSectionComposition
} from '../services/siteService.js'
import { _setDb as setMediaDb, _setStorage, collectSiteMediaIds, deleteUnusedMedia } from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

let db
const home = (site) => site.pages[0]
const byType = (site, type) => home(site).sections.filter((section) => section.type === type)
const addSection = async (...args) => (await addSectionCommand(...args)).site
const duplicateSection = async (...args) => (await duplicateSectionCommand(...args)).site

beforeEach(async () => {
  db = new FakeDb().seed('tenants/tenant-1', { name: 'Bakery' }).seed('tenants/tenant-2', { name: 'Other' })
  _setDb(db)
  setMediaDb(db)
  _setStorage(new FakeStorage())
  await initializeSite('tenant-1', 'admin')
  await initializeSite('tenant-2', 'admin')
})

afterEach(() => {
  _setDb()
  setMediaDb()
  _setStorage()
})

test('initialize uses an opaque stable Hero id with required visible state', async () => {
  const section = db.data('tenants/tenant-1/site/config/pages/home').sections[0]
  assert.match(section.id, /^[0-9a-f-]{36}$/)
  assert.equal(section.type, 'hero')
  assert.equal(section.hidden, false)
})

test('add and duplicate return the exact created section id', async () => {
  const added = await addSectionCommand('tenant-1', 'home', 'gallery')
  assert.equal(added.site.pages[0].sections.find((section) => section.id === added.sectionId)?.type, 'gallery')
  const duplicated = await duplicateSectionCommand('tenant-1', 'home', added.sectionId)
  assert.equal(duplicated.site.pages[0].sections.find((section) => section.id === duplicated.sectionId)?.type, 'gallery')
  assert.notEqual(duplicated.sectionId, added.sectionId)
})

test('instance commands allow repeated galleries and services while enforcing singleton and Hero rules', async () => {
  let site = await addSection('tenant-1', 'home', 'gallery')
  site = await addSection('tenant-1', 'home', 'gallery')
  site = await addSection('tenant-1', 'home', 'services')
  site = await addSection('tenant-1', 'home', 'services')
  assert.equal(byType(site, 'gallery').length, 2)
  assert.equal(byType(site, 'services').length, 2)
  const hero = byType(site, 'hero')[0]
  await assert.rejects(addSection('tenant-1', 'home', 'hero'), { status: 409 })
  await assert.rejects(removeSection('tenant-1', 'home', hero.id), { status: 400 })
  await assert.rejects(setSectionVisibility('tenant-1', 'home', hero.id, true), { status: 400 })
  await assert.rejects(moveSection('tenant-1', 'home', hero.id, 'down'), { status: 400 })
})

test('server-owned defaults add every optional type without fabricating media', async () => {
  let site
  for (const type of ['about', 'services', 'gallery', 'testimonials', 'faq', 'contact']) {
    site = await addSection('tenant-1', 'home', type)
    const added = byType(site, type)[0]
    assert.match(added.id, /^[0-9a-f-]{36}$/)
    assert.equal(added.hidden, false)
    assert.deepEqual(collectSiteMediaIds(site), [])
  }
  await updateBusinessHours('tenant-1', {
    businessHours: Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => [day, { closed: true }])),
    homepage: { enabled: false }
  })
  site = await addSection('tenant-1', 'home', 'businessHours')
  assert.equal(byType(site, 'businessHours')[0].hidden, false)
})

test('duplicate owns a new section id and nested ids but preserves media references', async () => {
  db.seed('tenants/tenant-1/media/image-1', {
    originalFilename: 'one.png',
    objectName: 'one',
    contentType: 'image/png',
    sizeBytes: 1,
    width: 1,
    height: 1,
    createdAt: 1,
    createdByUserId: 'admin'
  })
  let site = await addSection('tenant-1', 'home', 'gallery')
  const gallery = byType(site, 'gallery')[0]
  site = await updateSectionContent('tenant-1', 'home', gallery.id, {
    title: 'Work', items: [{ mediaId: 'image-1', altText: 'Work' }]
  })
  const source = byType(site, 'gallery')[0]
  site = await duplicateSection('tenant-1', 'home', source.id)
  const [original, copy] = byType(site, 'gallery')
  assert.notEqual(copy.id, original.id)
  assert.notEqual(copy.content.items[0].id, original.content.items[0].id)
  assert.equal(copy.content.items[0].mediaId, original.content.items[0].mediaId)
  assert.deepEqual(collectSiteMediaIds(site), ['image-1'])
})

test('hidden repeated-section media remains protected from deletion', async () => {
  db.seed('tenants/tenant-1/media/image-1', {
    originalFilename: 'one.png',
    objectName: 'one',
    contentType: 'image/png',
    sizeBytes: 1,
    width: 1,
    height: 1,
    createdAt: 1,
    createdByUserId: 'admin'
  })
  const site = await addSection('tenant-1', 'home', 'gallery')
  const gallery = byType(site, 'gallery')[0]
  await updateSectionContent('tenant-1', 'home', gallery.id, { title: 'Hidden work', items: [{ mediaId: 'image-1', altText: 'Work' }] })
  await setSectionVisibility('tenant-1', 'home', gallery.id, true)
  await assert.rejects(deleteUnusedMedia('tenant-1', 'image-1'), { status: 400, message: 'Image is still used as the working gallery' })
})

test('move, visibility, edit, and removal target only the requested stable id', async () => {
  let site = await addSection('tenant-1', 'home', 'about')
  const about = byType(site, 'about')[0]
  site = await addSection('tenant-1', 'home', 'faq')
  site = await moveSection('tenant-1', 'home', about.id, 'down')
  assert.equal(home(site).sections[2].id, about.id)
  site = await setSectionVisibility('tenant-1', 'home', about.id, true)
  assert.equal(home(site).sections.find((section) => section.id === about.id).hidden, true)
  site = await updateSectionContent('tenant-1', 'home', about.id, { heading: 'Story', body: 'Body' })
  assert.equal(home(site).sections.find((section) => section.id === about.id).content.heading, 'Story')
  site = await removeSection('tenant-1', 'home', about.id)
  assert.equal(home(site).sections.some((section) => section.id === about.id), false)
})

test('working instance changes leave published untouched until publish snapshots ids, order, and hidden', async () => {
  const site = await addSection('tenant-1', 'home', 'about')
  const about = byType(site, 'about')[0]
  await publishSite('tenant-1', 'admin')
  await setSectionVisibility('tenant-1', 'home', about.id, true)
  assert.equal(db.data('tenants/tenant-1/site/config/published/current').siteDefinition.pages[0].sections.find((section) => section.id === about.id).hidden, false)
  await publishSite('tenant-1', 'admin')
  assert.equal(db.data('tenants/tenant-1/site/config/published/current').siteDefinition.pages[0].sections.find((section) => section.id === about.id).hidden, true)
})

test('composition validation rejects malformed envelopes and singleton violations deterministically', () => {
  const hero = { id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Hero' } }
  const invalid = [
    [{ ...hero, id: '' }],
    [{ ...hero, hidden: undefined }],
    [{ ...hero, hidden: 'false' }],
    [{ ...hero, type: 'unknown' }],
    [hero, { ...hero }],
    [{ id: 'about-id', type: 'about', hidden: false, content: { heading: 'A', body: 'B' } }],
    [{ ...hero, hidden: true }],
    [{ id: 'about-id', type: 'about', hidden: false, content: { heading: 'A', body: 'B' } }, hero],
    [hero, { id: 'contact-1', type: 'contact', hidden: false, content: { title: 'C', buttonLabel: 'C', action: { type: 'leadForm' } } }, { id: 'contact-2', type: 'contact', hidden: false, content: { title: 'C', buttonLabel: 'C', action: { type: 'leadForm' } } }]
  ]
  for (const sections of invalid) assert.throws(() => validateSectionComposition(sections), { status: 500, message: 'Home sections invalid' })
})

test('tenant isolation and unknown instance ids are enforced', async () => {
  const site = await addSection('tenant-1', 'home', 'about')
  const id = byType(site, 'about')[0].id
  await assert.rejects(updateSectionContent('tenant-2', 'home', id, { heading: 'No', body: 'No' }), { status: 400, message: 'Unknown section id' })
  await assert.rejects(removeSection('tenant-1', 'home', 'missing'), { status: 400, message: 'Unknown section id' })
})

test('targeted concurrent move/delete and duplicate/edit retry against fresh Home state', async () => {
  let site = await addSection('tenant-1', 'home', 'about')
  site = await addSection('tenant-1', 'home', 'services')
  site = await addSection('tenant-1', 'home', 'faq')
  const about = byType(site, 'about')[0]
  const services = byType(site, 'services')[0]
  const faq = byType(site, 'faq')[0]
  await Promise.all([
    moveSection('tenant-1', 'home', faq.id, 'up'),
    removeSection('tenant-1', 'home', about.id)
  ])
  site = await duplicateSection('tenant-1', 'home', services.id)
  await Promise.all([
    duplicateSection('tenant-1', 'home', services.id),
    updateSectionContent('tenant-1', 'home', services.id, { title: 'Updated', items: [{ name: 'One' }] })
  ])
  const stored = db.data('tenants/tenant-1/site/config/pages/home').sections
  assert.equal(stored.some((section) => section.id === about.id), false)
  assert.equal(stored.find((section) => section.id === services.id).content.title, 'Updated')
  assert.equal(stored.filter((section) => section.type === 'services').length, 3)
})

test('two concurrent targeted moves preserve all identities and keep Hero pinned', async () => {
  let site = await addSection('tenant-1', 'home', 'about')
  const heroId = home(site).sections[0].id
  const about = byType(site, 'about')[0]
  site = await addSection('tenant-1', 'home', 'faq')
  const faq = byType(site, 'faq')[0]
  site = await addSection('tenant-1', 'home', 'services')
  const services = byType(site, 'services')[0]

  await Promise.all([
    moveSection('tenant-1', 'home', services.id, 'up'),
    moveSection('tenant-1', 'home', about.id, 'down')
  ])

  const ids = home(await getSite('tenant-1')).sections.map((section) => section.id)
  assert.equal(ids[0], heroId)
  assert.deepEqual(new Set(ids.slice(1)), new Set([about.id, faq.id, services.id]))
})
