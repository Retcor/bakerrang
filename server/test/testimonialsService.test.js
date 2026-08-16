import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  getPublicSite,
  getSite,
  initializeSite,
  publishSite,
  upsertHomeTestimonials
} from '../services/siteService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb
const normalEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'false' }
const previewEnv = { NODE_ENV: 'development', ALLOW_DRAFT_PUBLIC_SITES: 'true' }
const tenantPath = 'tenants/tenant-1'
const homePath = `${tenantPath}/site/config/pages/home`
const publishedPath = `${tenantPath}/site/config/published/current`
const testimonialsSection = (site) => site.pages[0].sections.find((section) => section.type === 'testimonials')
const inputItem = (overrides = {}) => ({ customerName: 'Jane Smith', quote: 'Excellent work.', ...overrides })

beforeEach(async () => {
  fakeDb = new FakeDb().seed(tenantPath, { name: 'Business' })
  _setDb(fakeDb)
  await initializeSite('tenant-1', 'platform')
})

afterEach(() => _setDb())

test('Testimonials validates its title, item bounds, names, and quotes', async () => {
  const invalid = [
    [{ items: [inputItem()] }, 'Testimonials title is required'],
    [{ title: '   ', items: [inputItem()] }, 'Testimonials title is required'],
    [{ title: 'x'.repeat(101), items: [inputItem()] }, 'Testimonials title must be 100 characters or fewer'],
    [{ title: 'Testimonials' }, 'Testimonials items must be an array'],
    [{ title: 'Testimonials', items: {} }, 'Testimonials items must be an array'],
    [{ title: 'Testimonials', items: [] }, 'Testimonials must include at least one testimonial'],
    [{ title: 'Testimonials', items: [inputItem({ customerName: undefined })] }, 'Testimonial name is required'],
    [{ title: 'Testimonials', items: [inputItem({ customerName: '   ' })] }, 'Testimonial name is required'],
    [{ title: 'Testimonials', items: [inputItem({ customerName: 'x'.repeat(121) })] }, 'Testimonial name must be 120 characters or fewer'],
    [{ title: 'Testimonials', items: [inputItem({ quote: undefined })] }, 'Testimonial quote is required'],
    [{ title: 'Testimonials', items: [inputItem({ quote: '   ' })] }, 'Testimonial quote is required'],
    [{ title: 'Testimonials', items: [inputItem({ quote: 'x'.repeat(1001) })] }, 'Testimonial quote must be 1000 characters or fewer']
  ]
  for (const [input, message] of invalid) {
    await assert.rejects(upsertHomeTestimonials('tenant-1', input), { status: 400, message })
  }
  await assert.rejects(upsertHomeTestimonials('tenant-1', {
    title: 'Testimonials',
    items: Array.from({ length: 11 }, (_, index) => inputItem({ customerName: `Customer ${index}` }))
  }), { status: 400, message: 'Testimonials cannot exceed 10 testimonials' })
})

test('Testimonials trims input, owns new identities, and drops unknown client fields', async () => {
  const result = await upsertHomeTestimonials('tenant-1', {
    title: '  What Customers Say  ',
    items: [{ customerName: '  Jane Smith  ', quote: '  Excellent work.  ', hackedField: true }]
  })
  const section = testimonialsSection(result)
  assert.equal(section.content.title, 'What Customers Say')
  assert.match(section.content.items[0].id, /^[0-9a-f-]{36}$/)
  assert.equal(section.content.items[0].customerName, 'Jane Smith')
  assert.equal(section.content.items[0].quote, 'Excellent work.')

  const persisted = fakeDb.data(homePath).sections.find((item) => item.type === 'testimonials')
  assert.deepEqual(Object.keys(persisted.content.items[0]).sort(), ['customerName', 'id', 'quote'])
})

test('Testimonials preserves authoritative ids, stored metadata, request order, and removal semantics', async () => {
  const first = await upsertHomeTestimonials('tenant-1', {
    title: 'Testimonials',
    items: [inputItem({ customerName: 'A' }), inputItem({ customerName: 'B', quote: 'Second' })]
  })
  const [aId, bId] = testimonialsSection(first).content.items.map((item) => item.id)
  const home = fakeDb.data(homePath)
  home.sections.find((section) => section.type === 'testimonials').content.items[0].futureServerField = 'keep'
  fakeDb.seed(homePath, home)

  await assert.rejects(upsertHomeTestimonials('tenant-1', {
    title: 'Testimonials', items: [inputItem({ id: 'unknown' })]
  }), { status: 400, message: 'Unknown testimonial item id' })
  await assert.rejects(upsertHomeTestimonials('tenant-1', {
    title: 'Testimonials',
    items: [inputItem({ id: aId }), inputItem({ id: aId, customerName: 'Duplicate' })]
  }), { status: 400, message: 'Duplicate testimonial item id' })

  const reordered = await upsertHomeTestimonials('tenant-1', {
    title: 'Updated',
    items: [
      inputItem({ id: bId, customerName: 'B updated', quote: 'Second updated', hackedField: true }),
      inputItem({ id: aId, customerName: 'A updated', quote: 'First updated' })
    ]
  })
  assert.deepEqual(testimonialsSection(reordered).content.items.map((item) => item.id), [bId, aId])
  const persisted = fakeDb.data(homePath).sections.find((section) => section.type === 'testimonials')
  assert.equal(persisted.content.items[1].futureServerField, 'keep')
  assert.equal(persisted.content.items[0].hackedField, undefined)
  assert.deepEqual(Object.keys(testimonialsSection(reordered).content.items[1]).sort(), [
    'customerName', 'id', 'quote'
  ])

  await upsertHomeTestimonials('tenant-1', {
    title: 'Updated', items: [inputItem({ id: aId, customerName: 'A only' })]
  })
  assert.deepEqual(
    fakeDb.data(homePath).sections.find((section) => section.type === 'testimonials').content.items.map((item) => item.id),
    [aId]
  )
})

test('Testimonials rejects reserved section and stored identity corruption without repair', async () => {
  const original = fakeDb.data(homePath)
  const corruptSections = [
    [{ id: 'testimonials', type: 'future', content: {} }],
    [{ id: 'future', type: 'testimonials', content: {} }],
    [
      { id: 'testimonials', type: 'testimonials', content: { title: 'One', items: [] } },
      { id: 'testimonials', type: 'testimonials', content: { title: 'Two', items: [] } }
    ],
    [{ id: 'testimonials', type: 'testimonials', content: { title: 'Bad', items: [{ customerName: 'A', quote: 'A' }] } }],
    [{
      id: 'testimonials',
      type: 'testimonials',
      content: {
        title: 'Bad',
        items: [
          { id: 'duplicate', customerName: 'A', quote: 'A' },
          { id: 'duplicate', customerName: 'B', quote: 'B' }
        ]
      }
    }]
  ]
  for (const extraSections of corruptSections) {
    fakeDb.seed(homePath, { ...original, sections: [original.sections[0], ...extraSections] })
    await assert.rejects(upsertHomeTestimonials('tenant-1', {
      title: 'Testimonials', items: [inputItem()]
    }), { status: 500, message: 'Home testimonials section invalid' })
  }
})

test('Testimonials inserts before Contact, appends without it, and preserves an existing index', async () => {
  const home = fakeDb.data(homePath)
  home.sections.push(
    { id: 'services', type: 'services', content: { title: 'Services', items: [] } },
    { id: 'gallery', type: 'gallery', content: { title: 'Gallery', items: [] } },
    { id: 'contact', type: 'contact', content: {} }
  )
  fakeDb.seed(homePath, home)
  const inserted = await upsertHomeTestimonials('tenant-1', {
    title: 'Testimonials', items: [inputItem()]
  })
  assert.deepEqual(inserted.pages[0].sections.map((section) => section.type), [
    'hero', 'services', 'gallery', 'testimonials', 'contact'
  ])
  const id = testimonialsSection(inserted).content.items[0].id
  const edited = await upsertHomeTestimonials('tenant-1', {
    title: 'Updated', items: [inputItem({ id })]
  })
  assert.equal(edited.pages[0].sections.findIndex((section) => section.type === 'testimonials'), 3)

  fakeDb.seed(homePath, { ...home, sections: [home.sections[0]] })
  const appended = await upsertHomeTestimonials('tenant-1', {
    title: 'Testimonials', items: [inputItem()]
  })
  assert.deepEqual(appended.pages[0].sections.map((section) => section.type), ['hero', 'testimonials'])

  fakeDb.seed(homePath, { ...home, sections: [home.sections[0], home.sections.at(-1)] })
  const beforeContact = await upsertHomeTestimonials('tenant-1', {
    title: 'Testimonials', items: [inputItem()]
  })
  assert.deepEqual(beforeContact.pages[0].sections.map((section) => section.type), [
    'hero', 'testimonials', 'contact'
  ])
})

test('working and published Testimonials remain isolated until republish', async () => {
  const first = await upsertHomeTestimonials('tenant-1', {
    title: 'Testimonials',
    items: [inputItem({ customerName: 'A', quote: 'A' }), inputItem({ customerName: 'B', quote: 'B' })]
  })
  const aId = testimonialsSection(first).content.items[0].id
  await publishSite('tenant-1', 'platform')
  const publishedBefore = structuredClone(fakeDb.data(publishedPath))

  await upsertHomeTestimonials('tenant-1', {
    title: 'Testimonials',
    items: [inputItem({ id: aId, customerName: 'A', quote: 'A' }), inputItem({ customerName: 'C', quote: 'C' })]
  })
  const names = (site) => testimonialsSection(site).content.items.map((item) => item.customerName)
  assert.deepEqual(names(await getSite('tenant-1')), ['A', 'C'])
  assert.deepEqual(names(await getPublicSite('tenant-1', previewEnv)), ['A', 'C'])
  assert.deepEqual(names(await getPublicSite('tenant-1', normalEnv)), ['A', 'B'])
  assert.deepEqual(fakeDb.data(publishedPath), publishedBefore)

  await publishSite('tenant-1', 'platform')
  assert.deepEqual(names(await getPublicSite('tenant-1', normalEnv)), ['A', 'C'])
})
