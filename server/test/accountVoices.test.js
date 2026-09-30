import assert from 'node:assert/strict'
import test, { after, afterEach, before, beforeEach } from 'node:test'
import cookieParser from 'cookie-parser'
import express from 'express'
import textToSpeechRouter from '../routes/textToSpeech.js'
import { isAuthenticated } from '../routes/auth.js'
import { csrfProtection } from '../middleware/security.js'
import { _setDb, _setHttpClient, setPrimaryVoice } from '../services/textToSpeechService.js'
import { FakeDb } from './helpers/fakeDb.js'

const MIB = 1024 * 1024
let firestore
let providerCalls
let providerHandler
let voiceCounter

const providerOk = async (options) => {
  if (options.url.endsWith('/v1/voices/add')) return { data: { voice_id: `voice-${++voiceCounter}` } }
  return { data: {} }
}

const buildApp = ({ csrf = false } = {}) => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use((req, res, next) => {
    const id = req.get('x-test-user')
    req.user = id ? { id, email: `${id}@example.test` } : undefined
    req.isAuthenticated = () => Boolean(id)
    req.sessionID = 'session-1'
    next()
  })
  if (csrf) app.use(csrfProtection)
  app.use('/text/to/speech', isAuthenticated, textToSpeechRouter)
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }))
  return app
}

let server
let baseUrl
let csrfServer
let csrfUrl
const listen = async (app) => {
  const instance = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => instance.once('listening', resolve))
  return { instance, url: `http://127.0.0.1:${instance.address().port}` }
}

before(async () => {
  ({ instance: server, url: baseUrl } = await listen(buildApp()));
  ({ instance: csrfServer, url: csrfUrl } = await listen(buildApp({ csrf: true })))
})
beforeEach(() => {
  firestore = new FakeDb()
  providerCalls = []
  providerHandler = providerOk
  voiceCounter = 0
  _setDb(firestore)
  _setHttpClient(async (options) => { providerCalls.push(options); return providerHandler(options) })
})
afterEach(() => { _setDb(); _setHttpClient() })
after(async () => {
  await Promise.all([server, csrfServer].map((instance) => new Promise((resolve, reject) => instance.close((error) => error ? reject(error) : resolve()))))
})

const seedVoice = (id, user, extra = {}) => firestore.seed(`voices/${id}`, {
  id, userId: user, name: `Voice ${id}`, description: `About ${id}`, isPrimary: false, createdAt: 1, updatedAt: 1, ...extra
})
const voiceDocs = (user) => firestore.paths().filter((path) => path.startsWith('voices/') && firestore.data(path).userId === user)
const primaries = (user) => voiceDocs(user).filter((path) => firestore.data(path).isPrimary === true)

const call = (path, { user = 'A', method = 'GET', body, form, url = baseUrl, headers = {} } = {}) => fetch(`${url}/text/to/speech${path}`, {
  method,
  headers: { ...(user ? { 'x-test-user': user } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
  body: form || (body === undefined ? undefined : JSON.stringify(body))
})

const sample = (type = 'audio/webm;codecs=opus', bytes = 2048) => ({ type, bytes })
const createForm = ({ name = 'Reading voice', description = 'Kitchen table', consent, samples = [sample()], extra = {} } = {}) => {
  const form = new FormData()
  if (name !== null) form.append('name', name)
  if (description !== undefined) form.append('description', description)
  if (consent !== undefined) form.append('consent', consent)
  for (const [key, value] of Object.entries(extra)) form.append(key, value)
  samples.forEach(({ type, bytes }, index) => form.append('files', new Blob([Buffer.alloc(bytes, 1)], { type }), `take-${index}.mp3`))
  return form
}
const create = (options = {}, user = 'A', url = baseUrl) => call('/v1/voice', { user, method: 'POST', form: createForm(options), url })

test('GET /v1/voices returns only the sanitized shape, drops stray stored fields, is no-store, and needs auth', async () => {
  seedVoice('v1', 'A', { isPrimary: true, secretNote: 'never returned', consentConfirmedAt: 5 })
  seedVoice('v2', 'A', { isPrimary: 'yes', description: undefined })
  seedVoice('other', 'B')
  const response = await call('/v1/voices')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const voices = await response.json()
  assert.deepEqual(voices.sort((a, b) => a.id.localeCompare(b.id)), [
    { id: 'v1', name: 'Voice v1', description: 'About v1', isPrimary: true },
    { id: 'v2', name: 'Voice v2', description: '', isPrimary: false }
  ])
  const anonymous = await call('/v1/voices', { user: null })
  assert.equal(anonymous.status, 401)
})

test('create validates name, description, sample count, type and size without contacting the provider', async () => {
  const cases = [
    [createForm({ samples: [] }), 400, { error: 'Invalid voice', field: 'files' }],
    [createForm({ samples: [sample(), sample(), sample(), sample()] }), 400, { error: 'Invalid voice', field: 'files' }],
    [createForm({ samples: [sample('audio/mpeg', 10 * MIB + 1)] }), 413, { error: 'Samples are too large', field: 'files' }],
    [createForm({ samples: [sample('text/plain')] }), 400, { error: 'Invalid voice', field: 'files' }],
    [createForm({ samples: [sample('application/octet-stream')] }), 400, { error: 'Invalid voice', field: 'files' }],
    [createForm({ samples: [sample('audio/mpeg', 9 * MIB), sample('audio/mpeg', 9 * MIB), sample('audio/mpeg', 9 * MIB)] }), 413, { error: 'Samples are too large', field: 'files' }],
    [createForm({ name: '   ' }), 400, { error: 'Invalid voice', field: 'name' }],
    [createForm({ name: null }), 400, { error: 'Invalid voice', field: 'name' }],
    [createForm({ name: 'n'.repeat(61) }), 400, { error: 'Invalid voice', field: 'name' }],
    [createForm({ description: 'd'.repeat(201) }), 400, { error: 'Invalid voice', field: 'description' }],
    [createForm({ extra: { evil: 'x'.repeat(2049) } }), 400, { error: 'Invalid voice', field: 'name' }],
    [createForm({ extra: { a: '1', b: '2', c: '3', d: '4', e: '5' } }), 400, { error: 'Invalid voice', field: 'name' }]
  ]
  for (const [form, status, body] of cases) {
    const response = await call('/v1/voice', { method: 'POST', form })
    assert.equal(response.status, status, JSON.stringify(body))
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), body)
  }
  assert.equal(providerCalls.length, 0)
  assert.deepEqual(firestore.paths(), [])
})

test('every allowlisted sample type is accepted, including codec suffixes', async () => {
  for (const type of ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-flac']) {
    const response = await create({ samples: [sample(type)] }, `type-${type}`)
    assert.equal(response.status, 200, type)
  }
})

test('create stores exactly the whitelisted fields, the first voice is primary, and the provider never sees a user id', async () => {
  const first = await create({ name: '  My voice  ', description: ' Desk ', consent: 'true', extra: { evil: 'admin', userId: 'B', isPrimary: 'false' } })
  assert.equal(first.status, 200)
  assert.equal(first.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await first.json(), { id: 'voice-1', name: 'My voice', description: 'Desk', isPrimary: true })

  const second = await create({ name: 'Second' })
  assert.deepEqual(await second.json(), { id: 'voice-2', name: 'Second', description: 'Kitchen table', isPrimary: false })

  const stored = firestore.data('voices/voice-1')
  assert.deepEqual(Object.keys(stored).sort(), ['consentConfirmedAt', 'createdAt', 'description', 'id', 'isPrimary', 'name', 'updatedAt', 'userId'])
  assert.equal(stored.userId, 'A')
  assert.equal(typeof stored.consentConfirmedAt, 'number')
  assert.equal(Object.hasOwn(firestore.data('voices/voice-2'), 'consentConfirmedAt'), false)

  const [addCall] = providerCalls
  assert.match(addCall.url, /\/v1\/voices\/add$/)
  assert.deepEqual([...addCall.data.keys()].sort(), ['description', 'files', 'name'])
  assert.equal(addCall.data.get('name'), 'My voice')
  assert.equal(JSON.stringify([...addCall.data.entries()].map(([k, v]) => typeof v === 'string' ? v : v.name)).includes('take-0'), false)
  assert.equal(JSON.stringify([...addCall.data.values()].filter((v) => typeof v === 'string')).includes('"A"'), false)
})

test('another user with no voices gets their own primary; primaries never cross accounts', async () => {
  await create({}, 'A')
  await create({}, 'B')
  assert.equal(primaries('A').length, 1)
  assert.equal(primaries('B').length, 1)
})

test('a provider failure returns a fixed 502, stores nothing and leaks nothing', async (t) => {
  const secret = 'sk-elevenlabs-secret'
  const logged = []
  t.mock.method(console, 'error', (...args) => logged.push(JSON.stringify(args)))
  providerHandler = async () => { throw Object.assign(new Error(secret), { response: { status: 500, data: secret }, config: { headers: { 'xi-api-key': secret } } }) }
  const response = await create({ description: 'private description text' })
  assert.equal(response.status, 502)
  const text = await response.text()
  assert.deepEqual(JSON.parse(text), { error: "Voice couldn't be created" })
  assert.equal(text.includes(secret), false)
  assert.equal(logged.join('').includes(secret), false)
  assert.equal(logged.join('').includes('private description text'), false)
  assert.deepEqual(firestore.paths(), [])
})

test('if recording the clone fails the provider copy is removed and the client sees the fixed 502', async () => {
  firestore.runTransaction = async () => { throw new Error('write failed') }
  const response = await create()
  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), { error: "Voice couldn't be created" })
  assert.equal(providerCalls.at(-1).method, 'DELETE')
  assert.match(providerCalls.at(-1).url, /\/v1\/voices\/voice-1$/)
})

test('PATCH renames through the provider and merge-writes only name, description and updatedAt', async () => {
  seedVoice('v1', 'A', { isPrimary: true, consentConfirmedAt: 9 })
  const response = await call('/v1/voices/v1', { method: 'PATCH', body: { name: '  Storyteller ', description: 'Warm', userId: 'B', isPrimary: false, evil: 1 } })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { id: 'v1', name: 'Storyteller', description: 'Warm', isPrimary: true })
  const stored = firestore.data('voices/v1')
  assert.deepEqual({ ...stored, updatedAt: 0 }, { id: 'v1', userId: 'A', name: 'Storyteller', description: 'Warm', isPrimary: true, createdAt: 1, updatedAt: 0, consentConfirmedAt: 9 })
  assert.ok(stored.updatedAt > 1)
  const [editCall] = providerCalls
  assert.match(editCall.url, /\/v1\/voices\/v1\/edit$/)
  assert.equal(editCall.data.get('name'), 'Storyteller')
  assert.equal(editCall.data.get('description'), 'Warm')
})

test('PATCH with only a name keeps the description, and only a description keeps the name', async () => {
  seedVoice('v1', 'A')
  await call('/v1/voices/v1', { method: 'PATCH', body: { name: 'Renamed' } })
  assert.equal(firestore.data('voices/v1').description, 'About v1')
  await call('/v1/voices/v1', { method: 'PATCH', body: { description: '' } })
  assert.equal(firestore.data('voices/v1').name, 'Renamed')
  assert.equal(firestore.data('voices/v1').description, '')
})

test('PATCH validates input and answers a missing or foreign voice with 404', async () => {
  seedVoice('v1', 'A')
  seedVoice('theirs', 'B')
  for (const [id, body, status, expected] of [
    ['v1', {}, 400, { error: 'Invalid voice', field: 'name' }],
    ['v1', { unknown: 1 }, 400, { error: 'Invalid voice', field: 'name' }],
    ['v1', { name: '' }, 400, { error: 'Invalid voice', field: 'name' }],
    ['v1', { name: 'x'.repeat(61) }, 400, { error: 'Invalid voice', field: 'name' }],
    ['v1', { description: 'x'.repeat(201) }, 400, { error: 'Invalid voice', field: 'description' }],
    ['v1', { name: 5 }, 400, { error: 'Invalid voice', field: 'name' }],
    ['bad id!', { name: 'x' }, 400, { error: 'Invalid voice' }],
    ['theirs', { name: 'x' }, 404, { error: 'Voice not found' }],
    ['missing', { name: 'x' }, 404, { error: 'Voice not found' }]
  ]) {
    const response = await call(`/v1/voices/${encodeURIComponent(id)}`, { method: 'PATCH', body })
    assert.equal(response.status, status, id)
    assert.deepEqual(await response.json(), expected)
  }
  assert.equal(providerCalls.length, 0)
  assert.equal(firestore.data('voices/theirs').name, 'Voice theirs')
})

test('a provider failure during rename leaves Firestore unchanged', async () => {
  seedVoice('v1', 'A')
  providerHandler = async () => { throw Object.assign(new Error('boom'), { response: { status: 503 } }) }
  const before = firestore.data('voices/v1')
  const response = await call('/v1/voices/v1', { method: 'PATCH', body: { name: 'New' } })
  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), { error: "Voice couldn't be renamed" })
  assert.deepEqual(firestore.data('voices/v1'), before)
})

test('a voice deleted elsewhere while renaming is not recreated', async () => {
  seedVoice('v1', 'A')
  providerHandler = async () => { firestore.remove('voices/v1'); return { data: {} } }
  const response = await call('/v1/voices/v1', { method: 'PATCH', body: { name: 'New' } })
  assert.equal(response.status, 404)
  assert.equal(firestore.data('voices/v1'), undefined)
})

test('PUT /v1/voices/primary persists directly, makes exactly one primary, and is idempotent', async () => {
  seedVoice('v1', 'A', { isPrimary: true })
  seedVoice('v2', 'A')
  seedVoice('v3', 'A', { isPrimary: true })
  seedVoice('theirs', 'B', { isPrimary: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await call('/v1/voices/primary', { method: 'PUT', body: { voiceId: 'v2' } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual((await response.json()).sort((a, b) => a.id.localeCompare(b.id)).map(({ id, isPrimary }) => [id, isPrimary]), [['v1', false], ['v2', true], ['v3', false]])
    assert.deepEqual(primaries('A'), ['voices/v2'])
  }
  assert.equal(firestore.data('voices/theirs').isPrimary, true)
  assert.equal(providerCalls.length, 0)
  const listed = await (await call('/v1/voices')).json()
  assert.deepEqual(listed.filter((voice) => voice.isPrimary).map((voice) => voice.id), ['v2'])
})

test('primary rejects foreign, missing and malformed ids', async () => {
  seedVoice('v1', 'A', { isPrimary: true })
  seedVoice('theirs', 'B')
  for (const [body, status, expected] of [
    [{ voiceId: 'theirs' }, 404, { error: 'Voice not found' }],
    [{ voiceId: 'missing' }, 404, { error: 'Voice not found' }],
    [{ voiceId: 5 }, 400, { error: 'Invalid voice' }],
    [{}, 400, { error: 'Invalid voice' }]
  ]) {
    const response = await call('/v1/voices/primary', { method: 'PUT', body })
    assert.equal(response.status, status)
    assert.deepEqual(await response.json(), expected)
  }
  assert.equal(firestore.data('voices/v1').isPrimary, true)
  assert.equal(firestore.data('voices/theirs').isPrimary, false)
})

test('a concurrent primary change forces the other to retry and exactly one primary remains', async () => {
  seedVoice('v1', 'A', { isPrimary: true })
  seedVoice('v2', 'A')
  seedVoice('v3', 'A')
  let interleaved = false
  firestore.beforeCommit = async ({ attempt }) => {
    // Another tab picks v3 after this request has read but before it commits.
    if (attempt === 1 && !interleaved) { interleaved = true; await setPrimaryVoice('A', 'v3') }
  }
  const response = await call('/v1/voices/primary', { method: 'PUT', body: { voiceId: 'v2' } })
  assert.equal(response.status, 200)
  assert.deepEqual(primaries('A'), ['voices/v2'])
  assert.ok(firestore.transactionAttempts >= 3, 'the interrupted transaction retried')
})

test('a voice deleted mid-transaction is skipped and never recreated', async () => {
  seedVoice('v1', 'A', { isPrimary: true })
  seedVoice('v2', 'A')
  seedVoice('v3', 'A')
  let fired = false
  firestore.beforeCommit = ({ attempt }) => { if (attempt === 1 && !fired) { fired = true; firestore.remove('voices/v3') } }
  const response = await call('/v1/voices/primary', { method: 'PUT', body: { voiceId: 'v2' } })
  assert.equal(response.status, 200)
  assert.equal(firestore.data('voices/v3'), undefined)
  assert.deepEqual(primaries('A'), ['voices/v2'])
})

test('DELETE removes the provider and Firestore copies and never promotes another voice', async () => {
  seedVoice('v1', 'A', { isPrimary: true })
  seedVoice('v2', 'A')
  const response = await call('/v1/voice/v1', { method: 'DELETE' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.equal(body.success, true)
  assert.match(body.message, /v1/)
  assert.equal(firestore.data('voices/v1'), undefined)
  assert.equal(firestore.data('voices/v2').isPrimary, false)
  assert.equal(providerCalls[0].method, 'DELETE')
  const listed = await (await call('/v1/voices')).json()
  assert.deepEqual(listed.map((voice) => [voice.id, voice.isPrimary]), [['v2', false]])
})

test('DELETE treats a provider 404 as already gone and a provider 500 as a failure that keeps the record', async () => {
  seedVoice('gone', 'A')
  providerHandler = async () => { throw Object.assign(new Error('missing'), { response: { status: 404 } }) }
  assert.equal((await call('/v1/voice/gone', { method: 'DELETE' })).status, 200)
  assert.equal(firestore.data('voices/gone'), undefined)

  seedVoice('stuck', 'A')
  providerHandler = async () => { throw Object.assign(new Error('boom'), { response: { status: 500 } }) }
  const failed = await call('/v1/voice/stuck', { method: 'DELETE' })
  assert.equal(failed.status, 502)
  assert.deepEqual(await failed.json(), { error: "Voice couldn't be deleted" })
  assert.equal(firestore.data('voices/stuck').name, 'Voice stuck')
})

test('DELETE keeps the legacy 403 for a foreign or missing voice and 400 for a malformed id', async () => {
  seedVoice('theirs', 'B')
  for (const id of ['theirs', 'missing']) {
    const response = await call(`/v1/voice/${id}`, { method: 'DELETE' })
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: 'Not authorized to access this voice record.' })
  }
  assert.equal((await call('/v1/voice/bad%20id', { method: 'DELETE' })).status, 400)
  assert.equal(firestore.data('voices/theirs').name, 'Voice theirs')
  assert.equal(providerCalls.length, 0)
})

test('legacy Update All whitelists name, description and isPrimary and skips foreign voices', async () => {
  seedVoice('v1', 'A', { isPrimary: true })
  seedVoice('theirs', 'B')
  const response = await call('/v1/voices', {
    method: 'PUT',
    body: {
      voices: [
        { id: 'v1', name: 'Renamed', description: 'D', isPrimary: false, userId: 'B', evil: 'x', createdAt: 999, consentConfirmedAt: 1 },
        { id: 'theirs', name: 'Hijack', description: '', isPrimary: true },
        { id: 'v1', name: '' }
      ]
    }
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.successes.length, 1)
  assert.equal(body.warnings.length, 2)
  const stored = firestore.data('voices/v1')
  assert.equal(stored.userId, 'A')
  assert.equal(stored.createdAt, 1)
  assert.equal(stored.name, 'Renamed')
  assert.equal(stored.isPrimary, false)
  assert.equal(Object.hasOwn(stored, 'evil'), false)
  assert.equal(Object.hasOwn(stored, 'consentConfirmedAt'), false)
  assert.equal(firestore.data('voices/theirs').name, 'Voice theirs')
  assert.equal((await call('/v1/voices', { method: 'PUT', body: {} })).status, 400)
})

test('legacy create-with-id still edits an owned voice, stores only the whitelist, and refuses others', async () => {
  seedVoice('v1', 'A', { isPrimary: true })
  seedVoice('theirs', 'B')
  const ok = await call('/v1/voice', { method: 'POST', form: createForm({ name: 'Edited', extra: { id: 'v1', userId: 'B' } }) })
  assert.equal(ok.status, 200)
  assert.equal(firestore.data('voices/v1').name, 'Edited')
  assert.equal(firestore.data('voices/v1').userId, 'A')
  const denied = await call('/v1/voice', { method: 'POST', form: createForm({ extra: { id: 'theirs' } }) })
  assert.equal(denied.status, 403)
  assert.equal(firestore.data('voices/theirs').name, 'Voice theirs')
})

test('every new mutation is rejected with 403 when the CSRF token is missing', async () => {
  seedVoice('v1', 'A')
  const attempts = [
    ['/v1/voice', { method: 'POST', form: createForm() }],
    ['/v1/voices/v1', { method: 'PATCH', body: { name: 'x' } }],
    ['/v1/voices/primary', { method: 'PUT', body: { voiceId: 'v1' } }],
    ['/v1/voice/v1', { method: 'DELETE' }]
  ]
  for (const [path, options] of attempts) {
    const response = await call(path, { ...options, url: csrfUrl })
    assert.equal(response.status, 403, path)
    assert.deepEqual(await response.json(), { code: 'EBADCSRFTOKEN' })
  }
  assert.equal(firestore.data('voices/v1').name, 'Voice v1')
  assert.equal(providerCalls.length, 0)
})

test('create is limited to 20 per hour per user, and other users are unaffected', async () => {
  for (let index = 0; index < 20; index++) assert.equal((await create({}, 'limited-user')).status, 200)
  const blocked = await create({}, 'limited-user')
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await blocked.json(), { error: 'Too many requests. Please wait a moment.' })
  assert.equal((await create({}, 'another-user')).status, 200)
})

test('edit-class routes are limited to 60 per 15 minutes per user', async () => {
  seedVoice('v1', 'edit-limited')
  for (let index = 0; index < 60; index++) assert.equal((await call('/v1/voices/v1', { user: 'edit-limited', method: 'PATCH', body: { name: `n${index}` } })).status, 200)
  const blocked = await call('/v1/voices/v1', { user: 'edit-limited', method: 'PATCH', body: { name: 'over' } })
  assert.equal(blocked.status, 429)
})
