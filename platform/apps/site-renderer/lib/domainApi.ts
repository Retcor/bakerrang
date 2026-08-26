import { normalizeRequestHost } from './requestHost.ts'

export interface PublicDomainResolution {
  tenantId: string
  canonicalHost: string
}

export interface TenantDomainResolution {
  canonicalHost: string | null
}

function apiBaseUrl (): string {
  const value = process.env.SITE_API_BASE_URL
  if (!value) throw new Error('SITE_API_BASE_URL is not configured')
  return value.replace(/\/$/, '')
}

async function routingJson<T> (path: string): Promise<T | null> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { cache: 'no-store' })
  } catch {
    throw new Error('Unable to resolve site routing')
  }
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Unable to resolve site routing')
  try {
    return await response.json() as T
  } catch {
    throw new Error('Unable to resolve site routing')
  }
}

export async function fetchPublicDomain (hostname: string): Promise<PublicDomainResolution | null> {
  const resolved = await routingJson<PublicDomainResolution>(
    `/public/domains/${encodeURIComponent(hostname)}`
  )
  if (!resolved) return null
  const canonicalHost = normalizeRequestHost(resolved.canonicalHost)
  if (!canonicalHost || canonicalHost !== resolved.canonicalHost || typeof resolved.tenantId !== 'string') {
    throw new Error('Unable to resolve site routing')
  }
  return { tenantId: resolved.tenantId, canonicalHost }
}

export async function fetchTenantDomain (tenantId: string): Promise<TenantDomainResolution> {
  const resolved = await routingJson<TenantDomainResolution>(
    `/public/sites/${encodeURIComponent(tenantId)}/domain`
  )
  if (!resolved?.canonicalHost) return { canonicalHost: null }
  const canonicalHost = normalizeRequestHost(resolved.canonicalHost)
  if (!canonicalHost || canonicalHost !== resolved.canonicalHost) {
    throw new Error('Unable to resolve site routing')
  }
  return { canonicalHost }
}
