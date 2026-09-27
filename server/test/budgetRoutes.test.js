import assert from 'node:assert/strict'
import test, { after, afterEach, before, beforeEach } from 'node:test'
import express from 'express'
import budgetRouter from '../routes/budget.js'
import { isAuthenticated } from '../routes/auth.js'
import { noStore } from '../middleware/contentSecurity.js'
import { _setDb } from '../services/budgetService.js'
import { FakeDb } from './helpers/fakeDb.js'

let firestore
let server
let baseUrl

const app = express()
app.use(express.json())
app.use((req, res, next) => { const id = req.get('x-test-user'); req.user = id ? { id } : undefined; req.isAuthenticated = () => Boolean(id); next() })
app.use('/budget', noStore, isAuthenticated, budgetRouter)

before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); baseUrl = `http://127.0.0.1:${server.address().port}` })
beforeEach(() => { firestore = new FakeDb(); _setDb(firestore) })
afterEach(() => _setDb())
after(async () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))

const request = (path, { user = 'A', body, ...options } = {}) => fetch(`${baseUrl}${path}`, { ...options, headers: { ...(user ? { 'x-test-user': user } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) })
const payday = (overrides = {}) => ({ requestId: '11111111-1111-4111-8111-111111111111', name: 'Acme', amountCents: 214000, schedule: { frequency: 'biweekly', anchorDate: '2026-09-04' }, ...overrides })
const bill = (overrides = {}) => ({ requestId: '22222222-2222-4222-8222-222222222222', category: 'utility', name: 'Rent', amountCents: 145000, due: { rule: 'day', day: 1 }, paydayId: null, autoPay: true, active: true, notes: '', url: '', ...overrides })

test('Budget routes require auth and set no-store on the auth error', async () => {
  const response = await request('/budget/plan', { user: null })
  assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('missing plan is empty and does not create a document', async () => {
  const response = await request('/budget/plan')
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { paydays: [], bills: [] }); assert.equal(firestore.paths().length, 0)
})

test('create is idempotent and update detects revisions while preserving unknown fields', async () => {
  const created = await request('/budget/bills', { method: 'POST', body: bill() })
  assert.equal(created.status, 201); const first = (await created.json()).bill
  assert.equal(first.rev, 1); assert.match(first.id, /^[0-9a-f-]{36}$/)
  const repeated = await request('/budget/bills', { method: 'POST', body: bill({ amountCents: 1 }) })
  assert.equal(repeated.status, 200); assert.deepEqual((await repeated.json()).bill, first)
  const stored = firestore.data('budget/A'); stored.items[0].futureField = 'keep'; firestore.seed('budget/A', stored)
  const updated = await request(`/budget/bills/${first.id}`, { method: 'PUT', body: { ...bill({ requestId: undefined, amountCents: 150000 }), expectedRev: 1 } })
  assert.equal(updated.status, 200); assert.equal((await updated.json()).bill.rev, 2); assert.equal(firestore.data('budget/A').items[0].futureField, 'keep')
  const stale = await request(`/budget/bills/${first.id}`, { method: 'PUT', body: { ...bill({ requestId: undefined }), expectedRev: 1 } })
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'conflict')
})

test('payday delete unpins bills and bumps their revision atomically', async () => {
  const payResponse = await request('/budget/paydays', { method: 'POST', body: payday() }); const pay = (await payResponse.json()).payday
  const billResponse = await request('/budget/bills', { method: 'POST', body: bill({ paydayId: pay.id }) }); const madeBill = (await billResponse.json()).bill
  const removed = await request(`/budget/paydays/${pay.id}`, { method: 'DELETE' })
  assert.deepEqual(await removed.json(), { deleted: true, unpinned: [{ id: madeBill.id, rev: 2 }] })
  assert.equal(firestore.data('budget/A').items[0].paydayId, null)
})

test('legacy replace preserves server metadata and returns the unchanged legacy shape', async () => {
  const created = await request('/budget/bills', { method: 'POST', body: bill() }); const current = (await created.json()).bill
  const legacy = { id: current.id, name: 'Legacy rent', amount: 1550, category: 'utility', dayType: 'fixed', day: 1, active: true, requestId: 'forged', rev: 99 }
  const response = await request('/budget/item', { method: 'POST', body: legacy })
  assert.deepEqual(await response.json(), legacy)
  const stored = firestore.data('budget/A').items[0]
  assert.equal(stored.requestId, bill().requestId); assert.equal(stored.rev, 2); assert.equal(stored.amount, 1550)
  const retry = await request('/budget/bills', { method: 'POST', body: bill() })
  assert.equal(retry.status, 200); assert.equal((await retry.json()).bill.amountCents, 155000)
  assert.equal(firestore.data('budget/A').items.length, 1)
})

test('payday request ids survive hostile legacy replacement and keep creates idempotent', async () => {
  const created = await request('/budget/paydays', { method: 'POST', body: payday() }); const current = (await created.json()).payday
  const legacy = { id: current.id, name: 'Legacy payroll', amount: 2200, frequency: 'monthly', dayType: 'fixed', day: 15, requestId: 'forged', rev: 99 }
  const replaced = await request('/budget/payday', { method: 'POST', body: legacy })
  assert.deepEqual(await replaced.json(), legacy)
  const stored = firestore.data('budget/A').paydays[0]
  assert.equal(stored.requestId, payday().requestId); assert.equal(stored.rev, 2); assert.equal(stored.amount, 2200)
  const retry = await request('/budget/paydays', { method: 'POST', body: payday() })
  assert.equal(retry.status, 200); assert.equal((await retry.json()).payday.amountCents, 220000)
  assert.equal(firestore.data('budget/A').paydays.length, 1)
})

test('legacy creates cannot choose revision or seed server-owned metadata', async () => {
  const legacy = { id: 'legacy', name: 'Legacy bill', amount: 10, category: 'utility', dayType: 'fixed', day: 1, active: true, requestId: 'forged', rev: 99 }
  const response = await request('/budget/item', { method: 'POST', body: legacy })
  assert.deepEqual(await response.json(), legacy)
  const stored = firestore.data('budget/A').items[0]
  assert.equal(stored.rev, 1); assert.equal(Object.prototype.hasOwnProperty.call(stored, 'requestId'), false)
})

test('ids never cross user document ownership boundaries', async () => {
  firestore.seed('budget/B', { userId: 'B', items: [{ id: 'foreign', category: 'utility', name: 'Private', amount: 1, dayType: 'fixed', day: 1, active: true, rev: 1 }], paydays: [] })
  const response = await request('/budget/bills/foreign', { method: 'DELETE', user: 'A' })
  assert.equal(response.status, 404); assert.equal(firestore.data('budget/B').items.length, 1)
})

test('validation, not-found, conflict, limit, and unexpected errors are all no-store', async () => {
  const invalid = await request('/budget/bills', { method: 'POST', body: {} })
  assert.equal(invalid.status, 400); assert.equal(invalid.headers.get('cache-control'), 'no-store')
  const missing = await request('/budget/bills/missing', { method: 'DELETE' })
  assert.equal(missing.status, 404); assert.equal(missing.headers.get('cache-control'), 'no-store')
  const created = await request('/budget/bills', { method: 'POST', body: bill() }); const current = (await created.json()).bill
  const conflict = await request(`/budget/bills/${current.id}`, { method: 'PUT', body: { ...bill({ requestId: undefined }), expectedRev: 0 } })
  assert.equal(conflict.status, 409); assert.equal(conflict.headers.get('cache-control'), 'no-store')
  firestore.seed('budget/A', { userId: 'A', items: [], paydays: Array.from({ length: 20 }, (_, index) => ({ id: `p${index}` })) })
  const limit = await request('/budget/paydays', { method: 'POST', body: payday() })
  assert.equal(limit.status, 409); assert.equal(limit.headers.get('cache-control'), 'no-store'); assert.equal((await limit.json()).code, 'limit')

  const logged = []; const original = console.error
  console.error = (...values) => logged.push(values)
  try {
    firestore.runTransaction = async () => { throw Object.assign(new Error('Rent 145000 must stay private'), { code: 13 }) }
    const failed = await request('/budget/bills', { method: 'POST', body: bill() })
    assert.equal(failed.status, 500); assert.equal(failed.headers.get('cache-control'), 'no-store')
  } finally { console.error = original }
  const text = JSON.stringify(logged)
  assert.equal(text.includes('Rent'), false); assert.equal(text.includes('145000'), false)
})

test('transaction retries preserve concurrent writes from new and legacy clients', async () => {
  const race = () => {
    let arrivals = 0; let release
    const gate = new Promise((resolve) => { release = resolve })
    firestore.beforeCommit = async () => { arrivals += 1; if (arrivals === 2) release(); await gate }
  }
  race()
  const secondBill = bill({ requestId: '33333333-3333-4333-8333-333333333333', name: 'Electric' })
  const [first, second] = await Promise.all([
    request('/budget/bills', { method: 'POST', body: bill() }),
    request('/budget/bills', { method: 'POST', body: secondBill })
  ])
  assert.equal(first.status, 201); assert.equal(second.status, 201); assert.equal(firestore.data('budget/A').items.length, 2)

  firestore.beforeCommit = null
  race()
  const legacy = { id: 'legacy', name: 'Water', amount: 20, category: 'utility', dayType: 'fixed', day: 5, active: true }
  const thirdBill = bill({ requestId: '44444444-4444-4444-8444-444444444444', name: 'Phone' })
  const [legacyResponse, newResponse] = await Promise.all([
    request('/budget/item', { method: 'POST', body: legacy }),
    request('/budget/bills', { method: 'POST', body: thirdBill })
  ])
  assert.equal(legacyResponse.status, 200); assert.deepEqual(await legacyResponse.json(), legacy)
  assert.equal(newResponse.status, 201)
  assert.deepEqual(new Set(firestore.data('budget/A').items.map(({ name }) => name)), new Set(['Rent', 'Electric', 'Water', 'Phone']))
})

test('legacy deletes keep their compatible success response', async () => {
  firestore.seed('budget/A', { userId: 'A', items: [{ id: 'old' }], paydays: [{ id: 'pay' }] })
  const item = await request('/budget/item/old', { method: 'DELETE' }); const paydayResponse = await request('/budget/payday/pay', { method: 'DELETE' })
  assert.deepEqual(await item.json(), { success: true }); assert.deepEqual(await paydayResponse.json(), { success: true })
})
