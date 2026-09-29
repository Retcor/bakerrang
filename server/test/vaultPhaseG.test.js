import assert from 'node:assert/strict'
import test, { after, afterEach, before, beforeEach } from 'node:test'
import express from 'express'
import vaultRouter from '../routes/vault.js'
import { isAuthenticated } from '../routes/auth.js'
import { noStore } from '../middleware/contentSecurity.js'
import { _setDb } from '../services/vaultService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { cleanVaultKdf, VAULT_KDF } from '../domain/vaultKdf.js'
import { cleanCipherBlob } from '../domain/vaultShapes.js'
import { assertKdfSupported } from '../../web/apps/passwords/src/vault/kdf.js'

let firestore
let server
let baseUrl
const app = express()
app.use(express.json())
app.use((req, res, next) => { const id = req.get('x-test-user'); req.user = id ? { id, email: `${id}@example.test` } : undefined; req.isAuthenticated = () => Boolean(id); next() })
app.use('/vault', noStore, isAuthenticated, vaultRouter)

before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); baseUrl = `http://127.0.0.1:${server.address().port}` })
beforeEach(() => { firestore = new FakeDb(); _setDb(firestore) })
afterEach(() => _setDb())
after(async () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))

const request = (path, { user = 'A', body, ...options } = {}) => fetch(`${baseUrl}/vault${path}`, {
  ...options,
  headers: { ...(user ? { 'x-test-user': user } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
  body: body === undefined ? undefined : JSON.stringify(body)
})
const blob = (ct = 'AAAAAAAAAAAAAAAAAAAAAA==') => ({ iv: 'AAAAAAAAAAAAAAAA', ct })
const kdf = () => ({ ...VAULT_KDF, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' })
const vault = (overrides = {}) => ({ kdf: kdf(), protectedVaultKey: blob(), ...overrides })
const item = (overrides = {}) => ({ folderId: null, ciphertext: blob('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), wrappedItemKey: blob(), ...overrides })
const keys = (char) => ({ publicKey: char.repeat(392), protectedPrivateKey: blob() })

test('exact KDF and cipher shapes reject drift and strip unknown keys', () => {
  assert.deepEqual(cleanVaultKdf(kdf()), kdf())
  for (const [field, value] of [['iterations', 4], ['memory', 65537], ['parallelism', 2], ['hashLength', 31], ['algo', 'argon2i'], ['salt', 'AAAAAAAAAAAAAAAAAAAA']]) {
    assert.equal(cleanVaultKdf({ ...kdf(), [field]: value }), null)
  }
  assert.deepEqual(cleanCipherBlob({ ...blob(), extra: 'ignored' }), blob())
  assert.equal(cleanCipherBlob({ ...blob(), iv: 'short' }), null)
  assert.equal(cleanCipherBlob({ ...blob(), ct: 'AAAA' }), null)
})

test('server and browser KDF policy have identical acceptance verdicts', () => {
  const exact = kdf()
  const variants = [exact, { ...exact, future: true },
    ...[['iterations', 2], ['iterations', 4], ['memory', 65535], ['memory', 65537], ['memory', 131072], ['memory', 1048576], ['parallelism', 0], ['parallelism', 2], ['hashLength', 31], ['hashLength', 33], ['algo', 'argon2d'], ['algo', 'argon2i'], ['algo', undefined], ['salt', Buffer.alloc(15).toString('base64')], ['salt', Buffer.alloc(17).toString('base64')], ['salt', 'bad'], ['salt', undefined], ['iterations', '3'], ['iterations', 3.5], ['iterations', -1], ['iterations', null]].map(([field, value]) => ({ ...exact, [field]: value }))]
  for (const candidate of variants) {
    let browserAccepts = true
    try { assertKdfSupported(candidate) } catch { browserAccepts = false }
    assert.equal(browserAccepts, cleanVaultKdf(candidate) !== null, JSON.stringify(candidate))
  }
})

test('both vault key routes reject every unsupported KDF without writing', async () => {
  const exact = kdf()
  const variants = [
    ['iterations', 2], ['iterations', 4], ['memory', 65535], ['memory', 65537], ['memory', 131072], ['memory', 1048576],
    ['parallelism', 0], ['parallelism', 2], ['hashLength', 31], ['hashLength', 33], ['algo', 'argon2d'], ['algo', 'argon2i'], ['algo', undefined],
    ['salt', Buffer.alloc(15).toString('base64')], ['salt', Buffer.alloc(17).toString('base64')], ['salt', 'bad'], ['salt', undefined],
    ['iterations', '3'], ['iterations', 3.5], ['iterations', -1], ['iterations', null]
  ]
  for (const [field, value] of variants) {
    const bad = { ...exact, [field]: value }
    assert.equal((await request('/', { method: 'POST', body: vault({ kdf: bad }) })).status, 400, `${field}: ${value}`)
    assert.equal(firestore.data('vaults/A'), undefined)
  }
  assert.equal((await request('/', { method: 'POST', body: vault() })).status, 201)
  for (const [field, value] of variants) {
    const bad = { ...exact, [field]: value }
    assert.equal((await request('/key', { method: 'PUT', body: { ...vault({ kdf: bad }), expectedKeyRev: 0 } })).status, 400, `${field}: ${value}`)
    assert.equal(firestore.data('vaults/A').keyRev, 0)
  }
})

test('no-store, server ids, v1 request shape and item revision conflict', async () => {
  const unauthorized = await request('/', { user: null })
  assert.equal(unauthorized.status, 401); assert.equal(unauthorized.headers.get('cache-control'), 'no-store')
  const made = await request('/', { method: 'POST', body: vault() })
  assert.equal(made.status, 201); assert.equal(made.headers.get('cache-control'), 'no-store')
  const response = await request('/items', { method: 'POST', body: item({ id: 'forged', ciphertext: { ...item().ciphertext, extra: 'ignored' } }) })
  const created = await response.json()
  assert.equal(response.status, 200); assert.notEqual(created.id, 'forged'); assert.equal(created.rev, 1)
  assert.deepEqual(created.ciphertext, item().ciphertext)
  const changed = await request(`/items/${created.id}`, { method: 'PUT', body: { ...item(), expectedRev: 1 } })
  assert.equal((await changed.json()).rev, 2)
  const stale = await request(`/items/${created.id}`, { method: 'PUT', body: { ...item(), expectedRev: 1 } })
  assert.equal(stale.status, 409); assert.equal(stale.headers.get('cache-control'), 'no-store')
  const body = await stale.json(); assert.equal(body.code, 'conflict'); assert.equal(body.current.rev, 2)
  const legacy = await request(`/items/${created.id}`, { method: 'PUT', body: item() })
  assert.equal((await legacy.json()).rev, 3)
  const invalid = await request('/items/bad%2Fid', { method: 'PUT', body: item() })
  assert.equal(invalid.status, 400)
})

test('two stale item writers yield one winner, and another owner cannot access the item', async () => {
  const created = await (await request('/items', { method: 'POST', body: item() })).json()
  let arrivals = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  firestore.beforeCommit = async () => { arrivals++; if (arrivals === 2) release(); await gate }
  const [first, second] = await Promise.all([
    request(`/items/${created.id}`, { method: 'PUT', body: { ...item(), expectedRev: 1 } }),
    request(`/items/${created.id}`, { method: 'PUT', body: { ...item(), expectedRev: 1 } })
  ])
  assert.deepEqual([first.status, second.status].sort(), [200, 409])
  firestore.beforeCommit = null
  assert.equal(firestore.data(`vaults/A/items/${created.id}`).rev, 2)
  assert.equal((await request(`/items/${created.id}`, { user: 'B', method: 'PUT', body: item() })).status, 404)
  assert.equal((await request(`/items/${created.id}`, { user: 'B', method: 'DELETE' })).status, 404)
  assert.equal((await request(`/shared/A/items/${created.id}`, { user: 'B', method: 'PUT', body: { ciphertext: blob() } })).status, 403)
})

test('sharing keys have one atomic winner; retry is idempotent and a third pair conflicts', async () => {
  firestore.seed('vaults/A', { ...vault(), createdAt: 1 })
  let arrivals = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  firestore.beforeCommit = async () => { arrivals++; if (arrivals === 2) release(); await gate }
  const [first, second] = await Promise.all([
    request('/keys', { method: 'POST', body: keys('A') }),
    request('/keys', { method: 'POST', body: keys('B') })
  ])
  assert.deepEqual([first.status, second.status].sort(), [200, 409])
  const winner = firestore.data('vaults/A').publicKey
  assert.ok([keys('A').publicKey, keys('B').publicKey].includes(winner))
  const loser = first.status === 409 ? first : second
  assert.deepEqual(await loser.json(), { error: 'Sharing keys already set', code: 'keys_exist' })
  firestore.beforeCommit = null
  const retry = await request('/keys', { method: 'POST', body: keys(winner[0]) })
  assert.equal(retry.status, 200)
  const third = await request('/keys', { method: 'POST', body: keys('C') })
  assert.equal(third.status, 409); assert.equal(firestore.data('vaults/A').publicKey, winner)
})

test('public-key lookup uses POST and distinguishes missing user from missing vault keys', async () => {
  assert.equal((await request('/pubkey', { method: 'POST', body: { email: 'missing@example.test' } })).status, 404)
  firestore.seed('users/B', { emailLower: 'b@example.test' })
  assert.equal((await request('/pubkey', { method: 'POST', body: { email: 'B@example.test' } })).status, 409)
  firestore.seed('vaults/B', { ...vault(), publicKey: keys('B').publicKey })
  const result = await request('/pubkey', { method: 'POST', body: { email: 'B@example.test' } })
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { userId: 'B', email: 'b@example.test', publicKey: keys('B').publicKey })
})

test('vault key CAS validates KDF and records a revisioned change', async () => {
  const invalid = await request('/', { method: 'POST', body: vault({ kdf: { ...kdf(), memory: 1048576 } }) })
  assert.equal(invalid.status, 400); assert.equal(firestore.data('vaults/A'), undefined)
  await request('/', { method: 'POST', body: vault() })
  const missingRev = await request('/key', { method: 'PUT', body: vault() })
  assert.equal(missingRev.status, 400)
  const updated = await request('/key', { method: 'PUT', body: { ...vault(), expectedKeyRev: 0 } })
  assert.equal(updated.status, 200); assert.equal((await updated.json()).keyRev, 1)
  const stale = await request('/key', { method: 'PUT', body: { ...vault(), expectedKeyRev: 0 } })
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'conflict')
  assert.equal(firestore.paths().filter((path) => path.startsWith('vaults/A/audit/')).length, 1)
})

test('folder revisions and owner moves preserve server-owned revisions', async () => {
  const created = await request('/folders', { method: 'POST', body: { id: 'forged', parentId: null, ciphertext: blob(), rev: 99 } })
  assert.equal(created.status, 200)
  const folder = await created.json()
  assert.notEqual(folder.id, 'forged'); assert.equal(folder.rev, 1)
  const edited = await request(`/folders/${folder.id}`, { method: 'PUT', body: { parentId: null, ciphertext: blob(), expectedRev: 1 } })
  assert.equal((await edited.json()).rev, 2)
  const stale = await request(`/folders/${folder.id}`, { method: 'PUT', body: { parentId: null, ciphertext: blob(), expectedRev: 1 } })
  assert.equal(stale.status, 409); assert.equal((await stale.json()).current.rev, 2)
  const moved = await request('/folders/reorder', { method: 'PUT', body: { updates: [{ id: folder.id, parentId: null, position: 2 }] } })
  assert.equal(moved.status, 200); assert.equal(firestore.data(`vaults/A/folders/${folder.id}`).rev, 3)
  const createdItem = await (await request('/items', { method: 'POST', body: item() })).json()
  const move = await request('/items/move', { method: 'PUT', body: { ids: [createdItem.id], folderId: folder.id } })
  assert.equal(move.status, 200); assert.equal((await move.json()).revs[createdItem.id], 2)
  const wrong = await request('/items/move', { method: 'PUT', body: { ids: [createdItem.id, 'absent'], folderId: null } })
  assert.equal(wrong.status, 404); assert.equal(firestore.data(`vaults/A/items/${createdItem.id}`).rev, 2)
})

test('shared subtree access, view-only writes, and co-recipient history redaction', async () => {
  firestore.seed('vaults/A/folders/root', { parentId: null, ciphertext: blob(), sharedName: blob(), rev: 1 })
  firestore.seed('vaults/A/folders/child', { parentId: 'root', sharedName: blob(), rev: 1 })
  firestore.seed('vaults/A/items/entry', { folderId: 'child', ciphertext: blob(), folderWrappedItemKey: blob(), createdAt: 1, updatedAt: 1, rev: 0 })
  firestore.seed('vault_shares/share1', { id: 'share1', ownerId: 'A', recipientUserId: 'B', folderId: 'root', permission: 'view', wrappedFolderKey: 'AAAA', contentRev: 1 })
  firestore.seed('vaults/A/audit/private', { action: 'item.update', targetId: 'entry', folderId: 'private', actorId: 'C', actorEmail: 'C@example.test', createdAt: 1, snapshot: item() })
  firestore.seed('vaults/A/audit/shared', { action: 'item.update', targetId: 'entry', folderId: 'child', actorId: 'C', actorEmail: 'C@example.test', createdAt: 2, snapshot: item() })
  const tree = await request('/shared/A/tree/root', { user: 'B' })
  assert.equal(tree.status, 200)
  const body = await tree.json()
  assert.deepEqual(body.folders.map((folder) => folder.id).sort(), ['child', 'root'])
  assert.equal(body.items[0].rev, 0)
  assert.equal((await request('/shared/A/tree/root', { user: 'C' })).status, 403)
  const viewOnly = await request('/shared/A/items/entry', { user: 'B', method: 'PUT', body: { ciphertext: blob() } })
  assert.equal(viewOnly.status, 403)
  const history = await request('/shared/A/audit/item/entry', { user: 'B' })
  assert.equal(history.status, 200)
  const rows = await history.json()
  assert.equal(rows.length, 1); assert.equal(rows[0].actorId, null); assert.equal(rows[0].actorEmail, null)
  firestore.seed('vault_shares/share1', { ...firestore.data('vault_shares/share1'), permission: 'edit' })
  const write = await request('/shared/A/items/entry', { user: 'B', method: 'PUT', body: { ciphertext: blob(), expectedRev: 0 } })
  assert.equal(write.status, 200); assert.equal((await write.json()).rev, 1)
  const conflict = await request('/shared/A/items/entry', { user: 'B', method: 'PUT', body: { ciphertext: blob(), expectedRev: 0 } })
  assert.equal(conflict.status, 409); assert.equal((await conflict.json()).code, 'conflict')
  assert.equal((await request('/shared/A/folders', { user: 'B', method: 'POST', body: { ciphertext: blob() } })).status, 404)
  assert.equal((await request('/shares/share1', { method: 'DELETE' })).status, 200)
  assert.equal((await request('/shared/A/tree/root', { user: 'B' })).status, 403)
})

test('audit queries reject malformed pagination and all vault errors are no-store', async () => {
  for (const query of ['?limit=0', '?limit=201', '?limit=1.5', '?before=0', '?before=abc']) {
    const response = await request(`/audit${query}`)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid query' })
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
  assert.equal((await request('/pubkey', { method: 'POST', body: { email: 'bad' } })).status, 400)
  assert.equal((await request('/pubkey?email=bad')).status, 400)
})

test('unexpected failures disclose neither bodies nor identifiers and retain no-store', async () => {
  const captured = []
  const original = console.error
  console.error = (...args) => captured.push(args)
  try {
    _setDb({ collection () { throw new Error('synthetic-secret-sentinel') } })
    const response = await request('/items')
    assert.equal(response.status, 500)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { error: 'Vault operation failed' })
    assert.equal(JSON.stringify(captured).includes('synthetic-secret-sentinel'), false)
    assert.match(captured[0][0], /^\[vault\] get \/items failed$/)
  } finally { console.error = original }
})

test('bulk delete removes only my listed entries, and skips missing ones', async () => {
  firestore.seed('vaults/A/items/one', item({ rev: 1 }))
  firestore.seed('vaults/A/items/two', item({ rev: 1 }))
  firestore.seed('vaults/A/items/keep', item({ rev: 1 }))
  firestore.seed('vaults/B/items/one', item({ rev: 1 }))
  assert.equal((await request('/items/bulk-delete', { method: 'POST', body: { ids: ['one', 'one'] } })).status, 400)
  assert.equal((await request('/items/bulk-delete', { method: 'POST', body: { ids: [] } })).status, 400)
  const response = await request('/items/bulk-delete', { method: 'POST', body: { ids: ['one', 'two', 'gone'] } })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { deleted: 2 })
  assert.equal(firestore.data('vaults/A/items/one'), undefined)
  assert.equal(firestore.data('vaults/A/items/two'), undefined)
  assert.ok(firestore.data('vaults/A/items/keep'))
  assert.ok(firestore.data('vaults/B/items/one'))
})
