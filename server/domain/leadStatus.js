export const LEAD_STATUSES = Object.freeze([
  'NEW',
  'CONTACTED',
  'QUOTED',
  'WON',
  'LOST'
])

export const isLeadStatus = (value) => LEAD_STATUSES.includes(value)
