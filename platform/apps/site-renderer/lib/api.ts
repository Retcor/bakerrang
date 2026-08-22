import 'server-only'

import { cache } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { fetchPreviewSite, fetchPublicSite, fetchPublishedSite } from './siteApi'

export const getPublicSite = cache(async (tenantId: string): Promise<SiteDefinition | null> => {
  return fetchPublicSite(tenantId)
})

export const getPublishedSite = cache(async (tenantId: string): Promise<SiteDefinition | null> => {
  return fetchPublishedSite(tenantId)
})

export const getPreviewSite = cache(async (tenantId: string, token: string): Promise<SiteDefinition | null> => {
  return fetchPreviewSite(tenantId, token)
})
