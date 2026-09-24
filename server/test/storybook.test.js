import test, { after, afterEach, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import storybookRouter from '../routes/storybook.js'
import { isAuthenticated } from '../routes/auth.js'
import { _setDb } from '../services/storybookService.js'
import { FakeDb } from './helpers/fakeDb.js'

let firestore
let server
let baseUrl

const story = (overrides = {}) => ({
  id: 'story-a',
  title: '  A bright story  ',
  prompt: 'a bright story',
  createdAt: '2026-09-22T12:00:00.000Z',
  thumbnail: 'thumb-a',
  pages: [{ reply: '**First sentence.** Second sentence.', image: 'image-a' }],
  ...overrides
})

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use((req, res, next) => {
  const userId = req.get('x-test-user')
  req.user = userId ? { id: userId } : undefined
  req.isAuthenticated = () => Boolean(req.user)
  next()
})
app.use('/storybook', isAuthenticated, storybookRouter)
app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }))

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

beforeEach(() => {
  firestore = new FakeDb()
  _setDb(firestore)
})

afterEach(() => _setDb())

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

const request = (path, { userId, body, ...options } = {}) => fetch(`${baseUrl}${path}`, {
  ...options,
  headers: {
    ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    ...(userId ? { 'x-test-user': userId } : {})
  },
  body: body !== undefined ? JSON.stringify(body) : undefined
})

test('story routes require authentication', async () => {
  assert.equal((await request('/storybook')).status, 401)
  assert.equal((await request('/storybook/story-a')).status, 401)
})

test('owner can create and perform the legacy compatible full-story update', async () => {
  const create = await request('/storybook', { userId: 'A', method: 'POST', body: story({ userId: 'B', arbitrary: true }) })
  assert.equal(create.status, 200)
  assert.equal(firestore.data('storybooks/story-a').userId, 'A')
  assert.equal(Object.hasOwn(firestore.data('storybooks/story-a'), 'arbitrary'), false)
  assert.equal((await create.json()).title, 'A bright story')

  const update = await request('/storybook', {
    userId: 'A',
    method: 'POST',
    body: story({ title: 'Owner renamed this through legacy save', pages: [{ reply: 'Updated.', image: null }] })
  })
  assert.equal(update.status, 200)
  assert.equal(firestore.data('storybooks/story-a').title, 'Owner renamed this through legacy save')
  assert.deepEqual(firestore.data('storybooks/story-a').pages, [{ reply: 'Updated.', image: null }])
})

test('foreign user cannot overwrite a story, including with a forged body userId', async () => {
  firestore.seed('storybooks/story-a', { ...story({ title: 'A original' }), userId: 'A' })
  const before = firestore.data('storybooks/story-a')

  for (const body of [story({ title: 'Stolen' }), story({ title: 'Still stolen', userId: 'A' })]) {
    const response = await request('/storybook', { userId: 'B', method: 'POST', body })
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: 'Story not found' })
    assert.deepEqual(firestore.data('storybooks/story-a'), before)
  }
})

test('single-story read, rename, and delete are owner-only and hide existence', async () => {
  firestore.seed('storybooks/story-a', { ...story({ title: 'Owner story' }), userId: 'A' })

  assert.equal((await request('/storybook/story-a', { userId: 'A' })).status, 200)
  for (const userId of ['B']) {
    assert.deepEqual(await (await request('/storybook/story-a', { userId })).json(), { error: 'Story not found' })
    assert.equal((await request('/storybook/story-a', { userId, method: 'PATCH', body: { title: 'No' } })).status, 404)
    assert.equal((await request('/storybook/story-a', { userId, method: 'DELETE' })).status, 404)
    assert.equal(firestore.data('storybooks/story-a').title, 'Owner story')
  }
  assert.equal((await request('/storybook/missing', { userId: 'A' })).status, 404)

  const rename = await request('/storybook/story-a', { userId: 'A', method: 'PATCH', body: { title: '  New title  ' } })
  assert.equal(rename.status, 200)
  assert.equal((await rename.json()).title, 'New title')
  assert.equal(firestore.data('storybooks/story-a').title, 'New title')

  assert.equal((await request('/storybook/story-a', { userId: 'A', method: 'DELETE' })).status, 200)
  assert.equal(firestore.data('storybooks/story-a'), undefined)
  assert.equal((await request('/storybook/story-a', { userId: 'A', method: 'DELETE' })).status, 404)
})

test('full and summary lists never expose another user stories', async () => {
  firestore.seed('storybooks/a1', { ...story({ id: 'a1' }), userId: 'A' })
  firestore.seed('storybooks/b1', { ...story({ id: 'b1', title: 'B story' }), userId: 'B' })

  const full = await (await request('/storybook', { userId: 'B' })).json()
  const summary = await (await request('/storybook?view=summary', { userId: 'B' })).json()
  assert.deepEqual(full.map((item) => item.id), ['b1'])
  assert.deepEqual(summary.map((item) => item.id), ['b1'])
})

test('summary uses the exact public shape, deterministic ordering, formatting, and null thumbnail', async () => {
  firestore.seed('storybooks/z-last', {
    id: 'z-last', userId: 'A', title: ' ', createdAt: '', thumbnail: '', pages: 'legacy-malformed', prompt: 'private'
  })
  firestore.seed('storybooks/b-tie', {
    ...story({ id: 'b-tie', title: '  B tie  ', createdAt: '2026-09-22T12:00:00.000Z', thumbnail: null }), userId: 'A'
  })
  firestore.seed('storybooks/a-tie', {
    ...story({
      id: 'a-tie',
      title: '  A tie  ',
      createdAt: '2026-09-22T12:00:00.000Z',
      pages: [{ reply: '# Heading\n__This__ is the first sentence! “Then comes more.” ' + 'word '.repeat(80), image: 'private-image' }]
    }),
    userId: 'A'
  })

  const response = await request('/storybook?view=summary', { userId: 'A' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const payload = await response.json()
  assert.deepEqual(payload.map((item) => item.id), ['a-tie', 'b-tie', 'z-last'])
  assert.deepEqual(Object.keys(payload[0]), ['id', 'title', 'createdAt', 'pageCount', 'excerpt', 'thumbnail'])
  assert.equal(payload[0].title, 'A tie')
  assert.equal(payload[0].excerpt, 'This is the first sentence!')
  assert.equal(payload[0].pageCount, 1)
  assert.equal(payload[1].thumbnail, null)
  assert.deepEqual(payload[2], {
    id: 'z-last', title: 'Untitled story', createdAt: '', pageCount: 0, excerpt: '', thumbnail: null
  })
  for (const item of payload) {
    assert.equal(Object.hasOwn(item, 'pages'), false)
    assert.equal(Object.hasOwn(item, 'prompt'), false)
    assert.equal(Object.hasOwn(item, 'userId'), false)
  }
})

test('summary caps long first sentences at a word boundary', async () => {
  firestore.seed('storybooks/long', {
    ...story({ id: 'long', pages: [{ reply: 'word '.repeat(80), image: null }] }), userId: 'A'
  })
  const [item] = await (await request('/storybook?view=summary', { userId: 'A' })).json()
  assert.ok(item.excerpt.length <= 160)
  assert.match(item.excerpt, /…$/)
})

test('validation remains strict for saves and title-only patches', async () => {
  const invalidStories = [
    story({ id: 'bad id' }),
    story({ id: 'x'.repeat(65) }),
    story({ title: ' ' }),
    story({ pages: [] }),
    story({ pages: Array.from({ length: 21 }, () => ({ reply: 'x', image: null })) }),
    story({ pages: [{ reply: 'x'.repeat(5001), image: null }] })
  ]
  for (const body of invalidStories) {
    assert.equal((await request('/storybook', { userId: 'A', method: 'POST', body })).status, 400)
  }

  firestore.seed('storybooks/story-a', { ...story(), userId: 'A' })
  for (const body of [{ title: '' }, { title: 'x'.repeat(121) }, { title: 'ok', prompt: 'not allowed' }]) {
    assert.equal((await request('/storybook/story-a', { userId: 'A', method: 'PATCH', body })).status, 400)
  }
})

test('Firestore size rejection maps to the compatible 413 response', async () => {
  firestore.beforeTransactionSet = () => {
    throw Object.assign(new Error('INVALID_ARGUMENT: maximum document size exceeded'), { code: 3 })
  }
  const response = await request('/storybook', { userId: 'A', method: 'POST', body: story() })
  assert.equal(response.status, 413)
  assert.deepEqual(await response.json(), { error: 'Story is too large to save' })
  assert.equal(firestore.data('storybooks/story-a'), undefined)
})

test('legacy full-list response remains unchanged when view is absent or unknown', async () => {
  const stored = { ...story(), userId: 'A', legacyField: 'preserved' }
  firestore.seed('storybooks/story-a', stored)
  assert.deepEqual(await (await request('/storybook', { userId: 'A' })).json(), [stored])
  assert.deepEqual(await (await request('/storybook?view=anything-else', { userId: 'A' })).json(), [stored])
})
