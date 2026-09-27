import { civilFromDays, daysFromCivil, daysInMonth, monthBounds, parseISO } from './dates.js'

const monthly = (rule, year, month) => {
  if (!rule) return null
  if (rule.rule === 'first') return daysFromCivil(year, month, 1)
  const last = daysInMonth(year, month)
  if (rule.rule === 'last') return daysFromCivil(year, month, last)
  return rule.rule === 'day' ? daysFromCivil(year, month, Math.min(rule.day, last)) : null
}

const monthlyInWindow = (rule, lo, hi) => {
  const start = civilFromDays(lo); const end = civilFromDays(hi); const out = []
  for (let index = start.year * 12 + start.month - 1; index <= end.year * 12 + end.month - 1; index += 1) {
    const year = Math.floor(index / 12); const month = index % 12 + 1
    const day = monthly(rule, year, month)
    if (day >= lo && day <= hi) out.push(day)
  }
  return out
}

const intervalInWindow = (anchor, interval, lo, hi) => {
  const first = anchor + Math.ceil((lo - anchor) / interval) * interval
  const out = []
  for (let day = first; day <= hi; day += interval) out.push(day)
  return out
}

export const paydayOccurrences = (payday, lo, hi) => {
  if (payday.issues?.length || payday.amountCents === null || !payday.schedule) return []
  const schedule = payday.schedule
  if (schedule.frequency === 'monthly') return monthlyInWindow(schedule, lo, hi)
  const anchor = parseISO(schedule.anchorDate)
  return anchor === null ? [] : intervalInWindow(anchor, schedule.frequency === 'weekly' ? 7 : 14, lo, hi)
}

export const billOccurrences = (bill, lo, hi) => {
  if (!bill.active || bill.issues?.length || bill.amountCents === null || !bill.due) return []
  if (bill.category === 'one-time') { const day = parseISO(bill.due.date); return day !== null && day >= lo && day <= hi ? [day] : [] }
  let occurrences = monthlyInWindow(bill.due, lo, hi)
  if (bill.category === 'debt' && bill.lastPaymentMonth) {
    occurrences = occurrences.filter((day) => {
      const civil = civilFromDays(day)
      return `${civil.year}-${String(civil.month).padStart(2, '0')}` <= bill.lastPaymentMonth
    })
  }
  return occurrences
}

export const occurrencesInMonth = (entry, month, kind) => { const { first, last } = monthBounds(month); return kind === 'payday' ? paydayOccurrences(entry, first, last) : billOccurrences(entry, first, last) }
