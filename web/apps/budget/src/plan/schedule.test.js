import { describe, expect, it } from 'vitest'
import { daysFromCivil } from './dates.js'
import { billOccurrences, paydayOccurrences } from './schedule.js'

describe('Budget schedules', () => {
  const feb = [daysFromCivil(2026, 2, 1), daysFromCivil(2026, 2, 28)]
  it('clamps monthly day 31 for bills and paydays', () => {
    expect(paydayOccurrences({ amountCents: 1, schedule: { frequency: 'monthly', rule: 'day', day: 31 } }, ...feb)).toEqual([feb[1]])
    expect(billOccurrences({ active: true, amountCents: 1, category: 'utility', due: { rule: 'day', day: 31 } }, ...feb)).toEqual([feb[1]])
  })
  it('clamps days 29, 30, and 31 across leap and non-leap February', () => {
    const occurrences = (year, day) => paydayOccurrences({ amountCents: 1, schedule: { frequency: 'monthly', rule: 'day', day } }, daysFromCivil(year, 2, 1), daysFromCivil(year, 2, year % 4 === 0 ? 29 : 28))
    expect(occurrences(2028, 29)).toEqual([daysFromCivil(2028, 2, 29)])
    expect(occurrences(2027, 29)).toEqual([daysFromCivil(2027, 2, 28)])
    expect(occurrences(2028, 30)).toEqual([daysFromCivil(2028, 2, 29)])
    expect(occurrences(2027, 31)).toEqual([daysFromCivil(2027, 2, 28)])
  })
  it('supports first and last monthly rules', () => {
    const lo = daysFromCivil(2028, 2, 1); const hi = daysFromCivil(2028, 2, 29)
    expect(paydayOccurrences({ amountCents: 1, schedule: { frequency: 'monthly', rule: 'first' } }, lo, hi)).toEqual([lo])
    expect(paydayOccurrences({ amountCents: 1, schedule: { frequency: 'monthly', rule: 'last' } }, lo, hi)).toEqual([hi])
  })
  it('projects interval schedules backward and forward from an anchor', () => {
    const lo = daysFromCivil(2026, 8, 20); const hi = daysFromCivil(2026, 10, 3)
    expect(paydayOccurrences({ amountCents: 1, schedule: { frequency: 'biweekly', anchorDate: '2026-09-04' } }, lo, hi)).toEqual(['2026-08-21', '2026-09-04', '2026-09-18', '2026-10-02'].map((value) => daysFromCivil(...value.split('-').map(Number))))
  })
  it('projects weekly schedules before their anchor', () => {
    const lo = daysFromCivil(2026, 8, 20); const hi = daysFromCivil(2026, 9, 5)
    expect(paydayOccurrences({ amountCents: 1, schedule: { frequency: 'weekly', anchorDate: '2026-09-04' } }, lo, hi)).toEqual(['2026-08-21', '2026-08-28', '2026-09-04'].map((value) => daysFromCivil(...value.split('-').map(Number))))
  })
  it('ends debts inclusively and places one-offs on their exact date', () => {
    const lo = daysFromCivil(2027, 3, 1); const hi = daysFromCivil(2027, 4, 30)
    expect(billOccurrences({ active: true, amountCents: 1, category: 'debt', due: { rule: 'day', day: 10 }, lastPaymentMonth: '2027-03' }, lo, hi)).toHaveLength(1)
    expect(billOccurrences({ active: true, amountCents: 1, category: 'one-time', due: { rule: 'date', date: '2026-10-01' } }, daysFromCivil(2026, 9, 1), daysFromCivil(2026, 10, 31))).toEqual([daysFromCivil(2026, 10, 1)])
  })
})
