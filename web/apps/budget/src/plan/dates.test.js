import { describe, expect, it } from 'vitest'
import { civilFromDays, daysFromCivil, daysInMonth, parseISO, weekday } from './dates.js'

describe('Budget civil dates', () => {
  it('round trips month boundaries from 2000 through 2100', () => {
    for (let year = 2000; year <= 2100; year += 1) for (let month = 1; month <= 12; month += 1) for (const day of [1, daysInMonth(year, month)]) expect(civilFromDays(daysFromCivil(year, month, day))).toEqual({ year, month, day })
  })
  it('handles Gregorian leap years and weekdays', () => {
    expect(daysInMonth(2000, 2)).toBe(29); expect(daysInMonth(2100, 2)).toBe(28); expect(daysInMonth(2024, 2)).toBe(29)
    expect(weekday(daysFromCivil(1970, 1, 1))).toBe(4)
    expect(weekday(daysFromCivil(2026, 9, 26))).toBe(6)
  })
  it('strictly parses date-only values', () => {
    expect(parseISO('2026-02-28')).not.toBeNull()
    expect(parseISO('2026-02-30')).toBeNull(); expect(parseISO('2026-13-01')).toBeNull(); expect(parseISO('26-09-01')).toBeNull()
  })
})
