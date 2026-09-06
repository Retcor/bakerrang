import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb as setSiteDb,
  getPublicSite,
  getSite,
  initializeSite,
  publishSite
} from '../services/siteService.js'
import { composeHomeSections, upsertHomeContact, upsertHomeFaq, upsertHomeServices } from './helpers/legacySiteTestBridge.js'
import { _setDb as setMediaDb, _setStorage } from '../services/mediaService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

let fakeDb
const normalEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }
const previewEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }
const tenantPath = 'tenants/tenant-1'
const homePath = `${tenantPath}/site/config/pages/home`
const faqSection = (site) => site.pages[0].sections.find((section) => section.type === 'faq')
const input = (overrides = {}) => ({
  heading: 'Frequently Asked Questions',
  intro: 'Helpful answers.',
  items: [{ question: 'When are you open?', answer: 'Every weekday.' }],
  ...overrides
})

beforeEach(async () => {
  fakeDb = new FakeDb().seed(tenantPath, { name: 'Business' })
  setSiteDb(fakeDb)
  setMediaDb(fakeDb)
  _setStorage(new FakeStorage())
  await initializeSite('tenant-1', 'platform')
})

afterEach(() => {
  setSiteDb()
  setMediaDb()
  _setStorage()
})

test('FAQ validates, trims, persists canonical fields, and creates server IDs', async () => {
  const result = await upsertHomeFaq('tenant-1', input({
    heading: '  FAQ  ',
    intro: '  Answers  ',
    arbitraryHtml: '<script />',
    items: [{ question: '  Question?  ', answer: '  Answer.  ', temporaryKey: 'browser-only' }]
  }))
  const faq = faqSection(result)
  assert.match(faq.id, /^[0-9a-f-]{36}$/)
  assert.equal(faq.type, 'faq')
  assert.equal(faq.hidden, false)
  assert.match(faq.content.items[0].id, /^[0-9a-f-]{36}$/)
  assert.deepEqual(faq.content, {
    heading: 'FAQ',
    intro: 'Answers',
    items: [{ id: faq.content.items[0].id, question: 'Question?', answer: 'Answer.' }]
  })
  assert.deepEqual(faqSection({ pages: [{ sections: fakeDb.data(homePath).sections }] }), faq)
})

test('FAQ enforces every content and identity limit', async () => {
  const validItem = { question: 'Question?', answer: 'Answer.' }
  const invalid = [
    [{ items: [validItem] }, 'FAQ heading is required'],
    [input({ heading: '   ' }), 'FAQ heading is required'],
    [input({ heading: 'x'.repeat(121) }), 'FAQ heading must be 120 characters or fewer'],
    [input({ intro: 1 }), 'FAQ intro must be a string'],
    [input({ intro: 'x'.repeat(301) }), 'FAQ intro must be 300 characters or fewer'],
    [input({ items: undefined }), 'FAQ items must be an array'],
    [input({ items: [] }), 'FAQ must include at least one question'],
    [input({ items: Array.from({ length: 21 }, () => validItem) }), 'FAQ cannot exceed 20 questions'],
    [input({ items: [{ answer: 'Answer' }] }), 'FAQ question is required'],
    [input({ items: [{ question: '   ', answer: 'Answer' }] }), 'FAQ question is required'],
    [input({ items: [{ question: 'x'.repeat(201), answer: 'Answer' }] }), 'FAQ question must be 200 characters or fewer'],
    [input({ items: [{ question: 'Question' }] }), 'FAQ answer is required'],
    [input({ items: [{ question: 'Question', answer: '   ' }] }), 'FAQ answer is required'],
    [input({ items: [{ question: 'Question', answer: 'x'.repeat(1001) }] }), 'FAQ answer must be 1000 characters or fewer'],
    [input({ items: [{ id: '', question: 'Question', answer: 'Answer' }] }), 'FAQ item id must be a non-empty string']
  ]
  for (const [value, message] of invalid) await assert.rejects(upsertHomeFaq('tenant-1', value), { status: 400, message })
})

test('FAQ retains stable IDs through edits and child reorder and rejects invalid IDs', async () => {
  const created = faqSection(await upsertHomeFaq('tenant-1', input({
    items: [
      { question: 'First?', answer: 'First.' },
      { question: 'Second?', answer: 'Second.' }
    ]
  })))
  const [first, second] = created.content.items
  const reordered = faqSection(await upsertHomeFaq('tenant-1', input({
    items: [
      { id: second.id, question: 'Second updated?', answer: 'Second updated.' },
      { id: first.id, question: 'First?', answer: 'First.' }
    ]
  })))
  assert.deepEqual(reordered.content.items.map(({ id }) => id), [second.id, first.id])
  await assert.rejects(upsertHomeFaq('tenant-1', input({
    items: [{ id: 'unknown', question: 'Question?', answer: 'Answer.' }]
  })), { status: 400, message: 'Unknown faq item id' })
  await assert.rejects(upsertHomeFaq('tenant-1', input({
    items: [
      { id: first.id, question: 'One?', answer: 'One.' },
      { id: first.id, question: 'Two?', answer: 'Two.' }
    ]
  })), { status: 400, message: 'Duplicate FAQ item id' })
})

test('FAQ insertion and independent section/item composition preserve their respective orders', async () => {
  await upsertHomeServices('tenant-1', { title: 'Services', items: [{ name: 'One' }] })
  await upsertHomeContact('tenant-1', { title: 'Contact', buttonLabel: 'Contact', action: { type: 'leadForm' } })
  const created = await upsertHomeFaq('tenant-1', input({
    items: [
      { question: 'First?', answer: 'First.' }, { question: 'Second?', answer: 'Second.' }
    ]
  }))
  assert.deepEqual(created.pages[0].sections.map(({ type }) => type), ['hero', 'services', 'contact', 'faq'])
  const ids = faqSection(created).content.items.map(({ id }) => id)

  await composeHomeSections('tenant-1', { sectionIds: ['hero', 'faq', 'services', 'contact'] })
  assert.deepEqual(faqSection(await getSite('tenant-1')).content.items.map(({ id }) => id), ids)
  const edited = await upsertHomeFaq('tenant-1', input({
    items: [
      { id: ids[1], question: 'Second?', answer: 'Second.' },
      { id: ids[0], question: 'First?', answer: 'First.' }
    ]
  }))
  assert.deepEqual(edited.pages[0].sections.map(({ type }) => type), ['hero', 'faq', 'services', 'contact'])

  await composeHomeSections('tenant-1', { sectionIds: ['hero', 'services', 'contact'] })
  const readded = await upsertHomeFaq('tenant-1', input())
  assert.deepEqual(readded.pages[0].sections.map(({ type }) => type), ['hero', 'services', 'contact', 'faq'])
  assert.notEqual(faqSection(readded).content.items[0].id, ids[0])
})

test('FAQ rejects malformed canonical state and appends when Contact is absent', async () => {
  const appended = await upsertHomeFaq('tenant-1', input())
  assert.deepEqual(appended.pages[0].sections.map(({ type }) => type), ['hero', 'faq'])
  const original = fakeDb.data(homePath)
  for (const corrupt of [
    [{ id: 'faq', type: 'future', hidden: false, content: {} }],
    [faqSection(appended), faqSection(appended)],
    [{ id: 'faq', type: 'faq', hidden: false, content: { heading: 'FAQ', items: [{ id: 'same' }, { id: 'same' }] } }]
  ]) {
    fakeDb.seed(homePath, { ...original, sections: [original.sections[0], ...corrupt] })
    await assert.rejects(upsertHomeFaq('tenant-1', input()), { status: 500, message: 'Home sections invalid' })
  }
})

test('FAQ uses existing WORKING, Preview, publish, removal, and backwards-compatible snapshot lifecycle', async () => {
  assert.equal(faqSection(await getSite('tenant-1')), undefined)
  await publishSite('tenant-1', 'platform')
  assert.equal(faqSection(await getPublicSite('tenant-1', normalEnv)), undefined)

  await upsertHomeFaq('tenant-1', input({ heading: 'Working B' }))
  assert.equal(faqSection(await getPublicSite('tenant-1', previewEnv)).content.heading, 'Working B')
  assert.equal(faqSection(await getPublicSite('tenant-1', normalEnv)), undefined)
  await publishSite('tenant-1', 'platform')
  assert.equal(faqSection(await getPublicSite('tenant-1', normalEnv)).content.heading, 'Working B')

  await composeHomeSections('tenant-1', { sectionIds: ['hero'] })
  assert.equal(faqSection(await getSite('tenant-1')), undefined)
  assert.equal(faqSection(await getPublicSite('tenant-1', normalEnv)).content.heading, 'Working B')
})
