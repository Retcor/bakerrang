import { civilFromDays, monthBounds, monthId } from './dates.js'
import { billOccurrences, paydayOccurrences } from './schedule.js'

export const allocateMonth = ({ paydays = [], bills = [] }, month, today = null) => {
  const { first, last } = monthBounds(month); const lo = first - 45; const hi = last + 45
  const paydayEvents = paydays.flatMap((payday, index) => paydayOccurrences(payday, lo, hi).map((day) => ({ day, payday, index }))).sort((a, b) => a.day - b.day || a.index - b.index)
  const periods = paydayEvents.map((event, index) => ({
    id: `${event.payday.id}@${event.day}`,
    day: event.day,
    end: paydayEvents[index + 1] ? paydayEvents[index + 1].day - 1 : null,
    payday: event.payday,
    bills: [],
    coveredCents: 0,
    leftCents: event.payday.amountCents,
    carried: event.day < first
  }))
  const billEvents = bills.flatMap((bill, index) => billOccurrences(bill, lo, hi).map((day) => ({ day, bill, index }))).sort((a, b) => a.day - b.day || a.index - b.index)
  const uncovered = []
  for (const event of billEvents) {
    let eligible = periods.filter((period) => period.day <= event.day)
    const pinnedEligible = event.bill.paydayId ? eligible.filter((period) => period.payday.id === event.bill.paydayId) : []
    if (pinnedEligible.length) eligible = pinnedEligible
    const period = eligible.at(-1)
    if (!period) { if (event.day >= first && event.day <= last) uncovered.push({ ...event, inMonth: true }); continue }
    const occurrence = { ...event, pinned: Boolean(event.bill.paydayId && period.payday.id === event.bill.paydayId), afterWindow: period.end !== null && event.day > period.end, inMonth: event.day >= first && event.day <= last }
    period.bills.push(occurrence)
    period.coveredCents += event.bill.amountCents
    period.leftCents -= event.bill.amountCents
  }
  const shown = periods.filter((period) => (period.day >= first && period.day <= last) || period.bills.some((bill) => bill.inMonth))
  for (const period of shown) {
    period.today = today !== null && today >= period.day && (period.end === null || today <= period.end) ? today : null
    period.later = period.bills.filter((bill) => bill.afterWindow).length
  }
  const statement = {
    paychecksCents: paydayEvents.filter(({ day }) => day >= first && day <= last).reduce((sum, event) => sum + event.payday.amountCents, 0),
    billsCents: billEvents.filter(({ day }) => day >= first && day <= last).reduce((sum, event) => sum + event.bill.amountCents, 0)
  }
  statement.netCents = statement.paychecksCents - statement.billsCents
  const issues = bills.filter((bill) => bill.issues?.includes('due')).length
  return { periods: shown, uncovered, statement, issues, monthId: monthId(month), month: civilFromDays(first) }
}
