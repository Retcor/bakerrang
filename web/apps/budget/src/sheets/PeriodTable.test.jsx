// @vitest-environment jsdom
import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { daysFromCivil } from '../plan/dates.js'
import { PeriodTable, periodLine } from './PeriodTable.jsx'

afterEach(cleanup)

const bill = (id, name, amountCents) => ({ id, name, amountCents, category: 'utility', active: true, autoPay: false })

describe('Budget pay-period ledger', () => {
  it('places Today chronologically between bill rows', () => {
    const period = {
      id: 'pay@2026-09-18',
      day: daysFromCivil(2026, 9, 18),
      end: daysFromCivil(2026, 10, 1),
      today: daysFromCivil(2026, 9, 26),
      payday: { id: 'pay', name: 'Acme payroll', amountCents: 214000 },
      coveredCents: 6386,
      leftCents: 207614,
      carried: false,
      later: 0,
      bills: [
        { bill: bill('phone', 'Phone', 4837), day: daysFromCivil(2026, 9, 22), inMonth: true },
        { bill: bill('stream', 'Streaming', 1549), day: daysFromCivil(2026, 9, 27), inMonth: true }
      ]
    }
    const { container } = render(<PeriodTable period={period} />)
    const text = container.querySelector('tbody').textContent
    expect(text.indexOf('Phone')).toBeLessThan(text.indexOf('Today'))
    expect(text.indexOf('Today')).toBeLessThan(text.indexOf('Streaming'))
  })

  it('uses singular and plural later-bill wording', () => {
    const base = { day: daysFromCivil(2026, 9, 15), end: daysFromCivil(2026, 9, 17), carried: false }
    expect(periodLine({ ...base, later: 1 })).toContain('1 bill due later is paid from here')
    expect(periodLine({ ...base, later: 2 })).toContain('2 bills due later are paid from here')
  })
})
