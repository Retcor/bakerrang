import type { SiteDefinition } from '@bakerrang/site-schema'

function baseUrl (): string {
  const value = process.env.SITE_API_BASE_URL
  if (!value) throw new Error('SITE_API_BASE_URL is not configured')
  return value.replace(/\/$/, '')
}

async function fetchSitePath (tenantId: string, suffix = ''): Promise<SiteDefinition | null> {
  let response: Response
  try {
    response = await fetch(
      `${baseUrl()}/public/sites/${encodeURIComponent(tenantId)}${suffix}`,
      { cache: 'no-store' }
    )
  } catch {
    throw new Error('Unable to load public site')
  }
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Unable to load public site')
  try {
    return await response.json() as SiteDefinition
  } catch {
    throw new Error('Unable to load public site')
  }
}

export const fetchPublicSite = (tenantId: string) => fetchSitePath(tenantId)

export const fetchPublishedSite = (tenantId: string) => fetchSitePath(tenantId, '/published')

export const publishedSiteOrNull = (site: SiteDefinition | null): SiteDefinition | null =>
  site?.status === 'PUBLISHED' ? site : null
