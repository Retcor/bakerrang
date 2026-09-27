import { describe, expect, it } from 'vitest'
import { allocateMonth } from './allocate.js'
import { daysFromCivil } from './dates.js'

const paydays = [
  { id: 'pd-acme', name: 'Acme payroll', amountCents: 214000, schedule: { frequency: 'biweekly', anchorDate: '2026-09-04' }, rev: 3 },
  { id: 'pd-tutor', name: 'Tutoring', amountCents: 38000, schedule: { frequency: 'monthly', rule: 'day', day: 15 }, rev: 1 }
]
const bill = (id, name, amountCents, due, extra = {}) => ({ id, category: 'utility', name, amountCents, due, autoPay: false, active: true, paydayId: null, ...extra })
const bills = [
  bill('rent', 'Rent', 145000, { rule: 'day', day: 1 }), bill('elec', 'Electric', 9618, { rule: 'day', day: 9 }),
  bill('net', 'Internet', 6500, { rule: 'day', day: 12 }), bill('phone', 'Phone', 4837, { rule: 'day', day: 22 }),
  bill('stream', 'Streaming', 1549, { rule: 'day', day: 27 }), bill('water', 'Water', 4120, { rule: 'last' }),
  bill('car', 'Car loan', 31840, { rule: 'day', day: 5 }, { category: 'debt', lastPaymentMonth: '2027-03' }),
  bill('card', 'Credit card', 15000, { rule: 'day', day: 20 }, { category: 'debt', paydayId: 'pd-tutor' }),
  bill('dent', 'Dentist', 26000, { rule: 'date', date: '2026-09-16' }, { category: 'one-time' }),
  bill('reg', 'Car registration', 8650, { rule: 'date', date: '2026-10-01' }, { category: 'one-time' })
]

describe('paycheck allocation', () => {
  it('matches the approved September 2026 fixture', () => {
    const view = allocateMonth({ paydays, bills }, { year: 2026, month: 9 }, daysFromCivil(2026, 9, 26))
    const tutoring = view.periods.find((period) => period.payday.id === 'pd-tutor' && period.day === daysFromCivil(2026, 9, 15))
    expect(tutoring.end).toBe(daysFromCivil(2026, 9, 17))
    expect(tutoring.bills.map(({ bill }) => bill.name)).toEqual(['Dentist', 'Credit card'])
    expect(tutoring.bills[1]).toMatchObject({ pinned: true, afterWindow: true })
    expect(tutoring.coveredCents).toBe(41000); expect(tutoring.leftCents).toBe(-3000)
    expect(view.statement).toEqual({ paychecksCents: 466000, billsCents: 244464, netCents: 221536 })
    expect(view.periods.find((period) => period.day === daysFromCivil(2026, 9, 18)).bills.some(({ bill }) => bill.id === 'card')).toBe(false)
  })
  it('leaves due bills uncovered when there are no paydays', () => {
    expect(allocateMonth({ paydays: [], bills: [bill('x', 'Bill', 100, { rule: 'day', day: 2 })] }, { year: 2026, month: 9 }).uncovered).toHaveLength(1)
  })
  it('uses the last payday in stored order when occurrences tie', () => {
    const tied = paydays.map((payday, index) => ({ ...payday, id: `p${index}`, schedule: { frequency: 'monthly', rule: 'day', day: 1 } }))
    const view = allocateMonth({ paydays: tied, bills: [bill('x', 'Bill', 100, { rule: 'day', day: 2 })] }, { year: 2026, month: 9 })
    expect(view.periods.find((period) => period.bills.length)?.payday.id).toBe('p1')
  })
  it('carries a prior-month paycheck into the viewed month without counting it as received', () => {
    const view = allocateMonth({ paydays: [{ id: 'p', name: 'Payroll', amountCents: 100000, schedule: { frequency: 'biweekly', anchorDate: '2026-09-25' } }], bills: [bill('rent', 'Rent', 60000, { rule: 'day', day: 1 })] }, { year: 2026, month: 10 })
    const carried = view.periods.find((period) => period.carried)
    expect(carried.day).toBe(daysFromCivil(2026, 9, 25))
    expect(carried.bills.map(({ bill: entry }) => entry.id)).toContain('rent')
    expect(view.statement).toEqual({ paychecksCents: 200000, billsCents: 60000, netCents: 140000 })
  })
})
