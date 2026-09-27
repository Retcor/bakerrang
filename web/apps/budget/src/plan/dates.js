const floorDiv = (a, b) => Math.floor(a / b)

export const daysInMonth = (year, month) => {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export const daysFromCivil = (year, month, day) => {
  const y = year - (month <= 2 ? 1 : 0)
  const era = floorDiv(y, 400)
  const yoe = y - era * 400
  const mp = month + (month > 2 ? -3 : 9)
  const doy = floorDiv(153 * mp + 2, 5) + day - 1
  const doe = yoe * 365 + floorDiv(yoe, 4) - floorDiv(yoe, 100) + doy
  return era * 146097 + doe - 719468
}

export const civilFromDays = (value) => {
  const z = value + 719468
  const era = floorDiv(z, 146097)
  const doe = z - era * 146097
  const yoe = floorDiv(doe - floorDiv(doe, 1460) + floorDiv(doe, 36524) - floorDiv(doe, 146096), 365)
  let year = yoe + era * 400
  const doy = doe - (365 * yoe + floorDiv(yoe, 4) - floorDiv(yoe, 100))
  const mp = floorDiv(5 * doy + 2, 153)
  const day = doy - floorDiv(153 * mp + 2, 5) + 1
  const month = mp + (mp < 10 ? 3 : -9)
  year += month <= 2 ? 1 : 0
  return { year, month, day }
}

export const parseISO = (value) => {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return daysFromCivil(year, month, day)
}

export const parseMonth = (value) => {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1]); const month = Number(match[2])
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 ? { year, month } : null
}

export const isoDate = (dayNumber) => {
  const { year, month, day } = civilFromDays(dayNumber)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export const monthId = ({ year, month }) => `${year}-${String(month).padStart(2, '0')}`
export const monthBounds = ({ year, month }) => ({ first: daysFromCivil(year, month, 1), last: daysFromCivil(year, month, daysInMonth(year, month)) })
export const weekday = (dayNumber) => ((dayNumber % 7) + 11) % 7
export const localToday = () => { const now = new Date(); return daysFromCivil(now.getFullYear(), now.getMonth() + 1, now.getDate()) }
export const shiftMonth = ({ year, month }, delta) => { const index = year * 12 + month - 1 + delta; return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 } }
