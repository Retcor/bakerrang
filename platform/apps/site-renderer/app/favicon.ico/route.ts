import { headers } from 'next/headers'
import { getPublishedSite } from '../../lib/api'
import { resolveRequestDomain } from '../../lib/domains'
import { faviconResponse } from '../../lib/faviconResponse'
import { requestMatchesSharedOrigin } from '../../lib/requestHost'
import { publishedSiteOrNull } from '../../lib/siteApi'
import { resolveSharedPublicOrigin } from '../../lib/siteUrl'

export const dynamic = 'force-dynamic'

export async function GET (): Promise<Response> {
  if (requestMatchesSharedOrigin((await headers()).get('host'), resolveSharedPublicOrigin())) {
    return faviconResponse(null)
  }
  const domain = await resolveRequestDomain()
  if (!domain) return faviconResponse(null)
  const site = publishedSiteOrNull(await getPublishedSite(domain.tenantId))
  return faviconResponse(site?.branding?.faviconSrc)
}