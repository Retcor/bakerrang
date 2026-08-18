import 'server-only'

import { cache } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { fetchPublicSite, fetchPublishedSite } from './siteApi'

export const getPublicSite = cache(async (tenantId: string): Promise<SiteDefinition | null> => {
  return fetchPublicSite(tenantId)
})

export const getPublishedSite = cache(async (tenantId: string): Promise<SiteDefinition | null> => {
  return fetchPublishedSite(tenantId)
})
