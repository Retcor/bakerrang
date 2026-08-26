import { domainToASCII } from 'node:url'

const validDnsHostname = (value: string): string | null => {
  const withoutTerminalDot = value.endsWith('.') ? value.slice(0, -1) : value
  if (!withoutTerminalDot || withoutTerminalDot.endsWith('.')) return null
  const hostname = domainToASCII(withoutTerminalDot).toLowerCase()
  if (!hostname || hostname.length > 253) return null
  const labels = hostname.split('.')
  if (labels.length < 2) return null
  if (labels.some((label) => (
    label.length < 1 || label.length > 63 || !/^[a-z0-9-]+$/.test(label) ||
    label.startsWith('-') || label.endsWith('-')
  ))) return null
  return hostname
}

export function normalizeRequestHost (value: string | null | undefined): string | null {
  if (!value || /\s|[/\\?#@*\[\]]/.test(value)) return null
  let hostname = value
  const portMatch = hostname.match(/^(.+):(\d{1,5})$/)
  if (portMatch) {
    const port = Number(portMatch[2])
    if (port < 1 || port > 65535) return null
    hostname = portMatch[1]
  } else if (hostname.includes(':')) {
    return null
  }
  return validDnsHostname(hostname)
}

export function requestHostnameFromHeaders (requestHeaders: Pick<Headers, 'get'>): string | null {
  return normalizeRequestHost(requestHeaders.get('host'))
}

export function requestMatchesSharedOrigin (
  requestHost: string | null | undefined,
  sharedOrigin: string | null
): boolean {
  if (!requestHost || !sharedOrigin) return false
  try {
    const expected = new URL(sharedOrigin)
    const normalizeAuthority = (authority: string) => {
      if (/\s|[/\\?#@\[\]]/.test(authority)) return null
      const match = authority.toLowerCase().match(/^([^:]+?)(?:\.(?=:|$))?(?::(\d{1,5}))?$/)
      if (!match) return null
      const port = match[2]
      const defaultPort = expected.protocol === 'https:' ? '443' : expected.protocol === 'http:' ? '80' : ''
      return `${match[1]}${port && port !== defaultPort ? `:${port}` : ''}`
    }
    return normalizeAuthority(requestHost) === normalizeAuthority(expected.host)
  } catch {
    return false
  }
}
