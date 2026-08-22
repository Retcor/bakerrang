import type { WeekdayKey } from '@bakerrang/site-schema'

export const WEEKDAYS: ReadonlyArray<{ key: WeekdayKey, label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
]

export function formatBusinessTime (time: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) return time
  const hour = Number(match[1])
  const displayHour = hour % 12 || 12
  return `${displayHour}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`
}
