import { describe, expect, it } from 'vitest'
import { validateBill, validatePayday } from '../../../../../server/domain/budgetPlan.js'
import { validateEntry } from './validate.js'

const payday = { requestId: '11111111-1111-4111-8111-111111111111', name: 'Pay', amountCents: 100000, schedule: { frequency: 'monthly', rule: 'day', day: 1 } }
const bill = { requestId: '22222222-2222-4222-8222-222222222222', category: 'utility', name: 'Rent', amountCents: 50000, due: { rule: 'day', day: 2 }, paydayId: null, autoPay: false, active: true, notes: '', url: '' }

describe('Budget client/server validation drift', () => {
  it.each([
    ['body', null],
    ['requestId', { ...bill, requestId: 'bad' }],
    ['category', { ...bill, category: 'other' }],
    ['name', { ...bill, name: ' ' }],
    ['amountCents', { ...bill, amountCents: 1.2 }],
    ['due', { ...bill, due: { rule: 'day', day: 32 } }],
    ['lastPaymentMonth', { ...bill, lastPaymentMonth: '2027-03' }],
    ['balanceCents', { ...bill, balanceCents: 1 }],
    ['paydayId', { ...bill, paydayId: 'missing' }],
    ['autoPay', { ...bill, autoPay: 'yes' }],
    ['active', { ...bill, active: 1 }],
    ['url', { ...bill, url: 'javascript:alert(1)' }],
    ['notes', { ...bill, notes: 'x'.repeat(301) }]
  ])('matches the server bill verdict for %s', (field, value) => {
    expect(validateEntry('bill', value)).toBe(field)
    expect(validateBill(value, new Set(), { create: true })).toMatchObject({ ok: false, field })
  })

  it.each([
    ['requestId', { ...payday, requestId: 'bad' }],
    ['name', { ...payday, name: '' }],
    ['amountCents', { ...payday, amountCents: -1 }],
    ['schedule', { ...payday, schedule: { frequency: 'weekly', anchorDate: '2026-02-30' } }]
  ])('matches the server payday verdict for %s', (field, value) => {
    expect(validateEntry('payday', value)).toBe(field)
    expect(validatePayday(value, { create: true })).toMatchObject({ ok: false, field })
  })

  it('accepts the same complete create and update shapes', () => {
    expect(validateEntry('bill', bill)).toBeNull()
    expect(validateBill(bill, new Set()).ok).toBe(true)
    const update = { ...payday, requestId: undefined, expectedRev: 0 }
    expect(validateEntry('payday', update, new Set(), { create: false })).toBeNull()
    expect(validatePayday(update, { create: false }).ok).toBe(true)
  })
})
