import 'server-only'

import type { SiteDefinition } from '@bakerrang/site-schema'

function baseUrl (): string {
  const value = process.env.SITE_API_BASE_URL
  if (!value) throw new Error('SITE_API_BASE_URL is not configured')
  return value.replace(/\/$/, '')
}

export async function getPublicSite (tenantId: string): Promise<SiteDefinition | null> {
  const encodedTenantId = encodeURIComponent(tenantId)
  let response: Response

  try {
    response = await fetch(`${baseUrl()}/public/sites/${encodedTenantId}`, {
      cache: 'no-store'
    })
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
