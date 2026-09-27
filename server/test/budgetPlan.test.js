import assert from 'node:assert/strict'
import test from 'node:test'
import { billToStored, normalizeBill, normalizePayday, normalizePlan, paydayToStored, toCents, validateBill, validatePayday } from '../domain/budgetPlan.js'

test('legacy money normalization uses the locked decimal rounding rule', () => {
  assert.deepEqual([1.005, 0.285, 12.345, 0.1 + 0.2, -2.5].map(toCents), [101, 29, 1235, 30, -250])
  for (const value of [NaN, Infinity, '12', null]) assert.equal(toCents(value), null)
})

test('normalization is total and flags malformed legacy values without dropping them', () => {
  const plan = normalizePlan({
    paydays: [{ id: 'p', name: 9, amount: '100', frequency: 'monthly', dayType: 'fixed', day: 45 }],
    items: [
      { id: 'a', category: 'mystery', amount: -2.5, name: null, dayType: 'fixed', day: null, active: true, paydayId: 'missing' },
      { id: 'b', category: 'utility', amount: 12, name: 'Last', dayType: 'last', day: 'garbage', active: true },
      { id: 'c', category: 'one-time', amount: 1, name: 'Bad date', day: '2026-02-30', active: true }
    ]
  })
  assert.equal(plan.paydays.length, 1)
  assert.deepEqual(plan.paydays[0].issues, ['amount', 'name'])
  assert.deepEqual(plan.paydays[0].schedule, { frequency: 'monthly', rule: 'day', day: 31 })
  assert.equal(plan.bills.length, 3)
  assert.deepEqual(plan.bills[0], { id: 'a', category: 'utility', name: '', amountCents: -250, due: null, paydayId: null, autoPay: false, active: true, notes: '', url: '', rev: 0, issues: ['category', 'negative', 'name', 'due'] })
  assert.deepEqual(plan.bills[1].due, { rule: 'last' })
  assert.equal(plan.bills[2].due, null)
})

test('new API mapping writes exactly the legacy-compatible schedule and bill fields', () => {
  assert.deepEqual(paydayToStored({ name: 'Work', amountCents: 12345, schedule: { frequency: 'monthly', rule: 'last' } }), { name: 'Work', amount: 123.45, frequency: 'monthly', dayType: 'last', day: null, startDate: null })
  assert.deepEqual(paydayToStored({ name: 'Work', amountCents: 100, schedule: { frequency: 'biweekly', anchorDate: '2026-09-04' } }), { name: 'Work', amount: 1, frequency: 'biweekly', dayType: null, day: null, startDate: '2026-09-04' })
  assert.deepEqual(billToStored({ category: 'debt', name: 'Loan', amountCents: 1000, due: { rule: 'first' }, notes: '', url: '', autoPay: false, active: true, balanceCents: 286400, lastPaymentMonth: '2027-03', paydayId: null }), { category: 'debt', name: 'Loan', amount: 10, dayType: 'first', day: null, notes: '', url: '', autoPay: false, active: true, balance: 2864, endDate: '2027-03-31', paydayId: null })
})

test('validators reject the first invalid field in contract order', () => {
  assert.deepEqual(validatePayday([], { create: true }), { ok: false, error: 'Invalid payday', field: 'body' })
  assert.equal(validatePayday({ requestId: 'bad', name: '', amountCents: -1 }, { create: true }).field, 'requestId')
  const base = { category: 'utility', name: 'Rent', amountCents: 100, due: { rule: 'day', day: 1 } }
  assert.equal(validateBill({ ...base, category: 'other' }).field, 'category')
  assert.equal(validateBill({ ...base, name: ' ' }).field, 'name')
  assert.equal(validateBill({ ...base, amountCents: 1.2 }).field, 'amountCents')
  assert.equal(validateBill({ ...base, due: { rule: 'day', day: 32 } }).field, 'due')
  assert.equal(validateBill({ ...base, paydayId: 'missing' }, new Set()).field, 'paydayId')
  assert.equal(validateBill({ ...base, url: 'javascript:alert(1)' }).field, 'url')
  assert.equal(validateBill({ ...base, notes: 'x'.repeat(301) }).field, 'notes')
})

test('normalizers preserve valid first/last rules regardless of old day values', () => {
  assert.deepEqual(normalizeBill({ id: 'b', category: 'utility', name: 'Bill', amount: 1, dayType: 'first', day: 'first', active: true }).due, { rule: 'first' })
  assert.deepEqual(normalizePayday({ id: 'p', name: 'Pay', amount: 1, frequency: 'monthly', dayType: 'last', day: null }).schedule, { frequency: 'monthly', rule: 'last' })
})
