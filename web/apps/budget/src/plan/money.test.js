import { describe, expect, it } from 'vitest'
import { formatCents, parseMoney, toCents } from './money.js'

describe('Budget money', () => {
  it.each([['1234.5', 123450], ['1,234.50', 123450], ['$ 12', 1200], ['.5', 50], ['0', 0]])('parses %s', (text, cents) => expect(parseMoney(text)).toBe(cents))
  it.each(['-1', '1e3', '1.234', '1,23', '12,3456', '', '10000000'])('rejects %s', (text) => expect(parseMoney(text)).toBeNull())
  it('formats cents without floating arithmetic', () => {
    expect(formatCents(0)).toBe('$0.00')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(123456789)).toBe('$1,234,567.89')
    expect(formatCents(-3000)).toBe('−$30.00')
    expect(formatCents(3000, { signed: true })).toBe('+$30.00')
  })
  it.each([[1.005, 101], [0.285, 29], [12.345, 1235], [0.1 + 0.2, 30], [-2.5, -250]])('normalizes %s', (value, cents) => expect(toCents(value)).toBe(cents))
  it('round trips stored dollar values across the supported range', () => {
    const samples = [0, 1, 99, 100, 999999999]
    for (let index = 0; index < 10000; index += 1) samples.push((index * 104729) % 1000000000)
    for (const cents of samples) expect(toCents(cents / 100)).toBe(cents)
  })
})
