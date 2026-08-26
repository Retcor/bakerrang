import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import {
  fetchPublicDomain,
  fetchTenantDomain,
  type PublicDomainResolution,
  type TenantDomainResolution
} from './domainApi'
import { requestHostnameFromHeaders } from './requestHost'

export type { PublicDomainResolution, TenantDomainResolution } from './domainApi'

export const getPublicDomain = cache(async (hostname: string): Promise<PublicDomainResolution | null> => {
  return fetchPublicDomain(hostname)
})

export const getTenantDomain = cache(async (tenantId: string): Promise<TenantDomainResolution> => {
  return fetchTenantDomain(tenantId)
})

export const resolveRequestDomain = cache(async (): Promise<PublicDomainResolution | null> => {
  const requestHeaders = await headers()
  const hostname = requestHostnameFromHeaders(requestHeaders)
  if (!hostname) return null
  return getPublicDomain(hostname)
})
