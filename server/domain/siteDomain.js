import { isIP } from 'node:net'
import { domainToASCII } from 'node:url'

export const SITE_DOMAIN_STATUSES = Object.freeze([
  'PENDING_VERIFICATION',
  'VERIFIED',
  'ACTIVE',
  'DISABLED'
])

const invalidHostname = () => {
  const error = new Error('Enter a valid hostname without a URL, path, port, or wildcard')
  error.status = 400
  return error
}

const hasReservedCharacter = (value) =>
  [':', '/', '?', '#', '@', '*', '[', ']', '\\'].some((character) => value.includes(character))

const normalizeDnsHostname = (value) => {
  if (typeof value !== 'string' || !value || /\s/.test(value)) throw invalidHostname()
  const withoutTerminalDot = value.endsWith('.') ? value.slice(0, -1) : value
  if (!withoutTerminalDot || withoutTerminalDot.endsWith('.')) throw invalidHostname()

  const hostname = domainToASCII(withoutTerminalDot).toLowerCase()
  if (!hostname || hostname.length > 253 || isIP(hostname)) throw invalidHostname()
  const labels = hostname.split('.')
  if (labels.length < 2) throw invalidHostname()
  for (const label of labels) {
    if (
      label.length < 1 ||
      label.length > 63 ||
      !/^[a-z0-9-]+$/.test(label) ||
      label.startsWith('-') ||
      label.endsWith('-')
    ) throw invalidHostname()
  }
  return hostname
}

export const normalizeRegistrationHostname = (value) => {
  if (
    typeof value !== 'string' ||
    hasReservedCharacter(value)
  ) throw invalidHostname()
  return normalizeDnsHostname(value)
}

export const normalizeRequestHostname = (value) => {
  if (typeof value !== 'string' || !value || /\s/.test(value) ||
    ['/', '\\', '?', '#', '@', '*', '[', ']'].some((character) => value.includes(character))) {
    throw invalidHostname()
  }
  let hostname = value
  const portMatch = hostname.match(/^(.+):(\d{1,5})$/)
  if (portMatch) {
    const port = Number(portMatch[2])
    if (port < 1 || port > 65535) throw invalidHostname()
    hostname = portMatch[1]
  } else if (hostname.includes(':')) {
    throw invalidHostname()
  }
  return normalizeDnsHostname(hostname)
}

export const siteDomainResponse = (record) => ({
  hostname: record.hostname,
  tenantId: record.tenantId,
  status: record.status,
  verificationToken: record.verificationToken,
  createdAt: record.createdAt,
  createdByUserId: record.createdByUserId,
  updatedAt: record.updatedAt,
  ...(record.verifiedAt ? { verifiedAt: record.verifiedAt } : {}),
  ...(record.verifiedByUserId ? { verifiedByUserId: record.verifiedByUserId } : {}),
  ...(record.activatedAt ? { activatedAt: record.activatedAt } : {}),
  ...(record.activatedByUserId ? { activatedByUserId: record.activatedByUserId } : {}),
  ...(record.disabledAt ? { disabledAt: record.disabledAt } : {}),
  ...(record.disabledByUserId ? { disabledByUserId: record.disabledByUserId } : {})
})
