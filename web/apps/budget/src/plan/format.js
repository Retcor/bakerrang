import { civilFromDays, weekday } from './dates.js'
import { formatCents } from './money.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const shortDate = (day) => { const c = civilFromDays(day); return `${MONTHS[c.month - 1]} ${c.day}` }
export const bandDate = (day) => `${DAYS[weekday(day)]}, ${shortDate(day)}`
export const dueDate = (day) => ({ weekday: DAYS[weekday(day)], date: shortDate(day) })
export const monthLabel = ({ year, month }) => `${MONTHS_LONG[month - 1]} ${year}`
export const monthName = (month) => MONTHS_LONG[month - 1]
export const scheduleLabel = (entry) => {
  const schedule = entry.schedule
  if (!schedule) return 'Needs a schedule'
  if (schedule.frequency === 'weekly') return `Every week from ${schedule.anchorDate}`
  if (schedule.frequency === 'biweekly') return `Every 2 weeks from ${schedule.anchorDate}`
  if (schedule.rule === 'first') return 'Monthly · first day'
  if (schedule.rule === 'last') return 'Monthly · last day'
  return `Monthly · day ${schedule.day}`
}
export { formatCents }
