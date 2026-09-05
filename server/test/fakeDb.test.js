import test from 'node:test'
import assert from 'node:assert/strict'
import { FakeDb } from './helpers/fakeDb.js'

test('fake transaction detects absent read creation and discards stale buffered writes', async () => {
  const db = new FakeDb()
  const a = db.collection('test').doc('a')
  const b = db.collection('test').doc('b')
  let calls = 0
  db.beforeCommit = async () => { db.beforeCommit = null; await a.set({ value: 7 }) }
  await db.runTransaction(async (tx) => {
    calls++
    const [snapshot] = await tx.getAll(a)
    tx.set(b, { value: snapshot.exists ? snapshot.data().value : 0 })
  })
  assert.equal(calls, 2)
  assert.deepEqual(db.data('test/b'), { value: 7 })
})
test('fake forbids reads after writes and does not apply any buffered writes', async () => {
  const db = new FakeDb()
  const a = db.collection('test').doc('a')
  await assert.rejects(db.runTransaction(async (tx) => { tx.set(a, { value: 1 }); await tx.get(a) }), /reads must precede/)
  assert.equal(db.data('test/a'), undefined)
})
test('fake snapshots are immutable and retries are bounded with no stale writes', async () => {
  const db = new FakeDb().seed('test/a', { value: 0 })
  const a = db.collection('test').doc('a')
  const snapshot = await a.get()
  db.beforeCommit = () => db.write('test/a', { value: 2 })
  await assert.rejects(db.runTransaction(async (tx) => { await tx.get(a); tx.set(db.collection('test').doc('b'), { value: 1 }) }), { code: 10 })
  assert.equal(db.transactionAttempts, 5)
  assert.deepEqual(snapshot.data(), { value: 0 })
  assert.equal(db.data('test/b'), undefined)
})
