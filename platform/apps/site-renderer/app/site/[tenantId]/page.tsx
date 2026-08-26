import { headers } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { findHomePage } from '@bakerrang/site-schema'
import { PublicHome } from '../../../components/PublicHome'
import { getPublicSite } from '../../../lib/api'
import { getTenantDomain } from '../../../lib/domains'
import { homeMetadata } from '../../../lib/seo'
import { requestMatchesSharedOrigin } from '../../../lib/requestHost'
import { resolveSharedPublicOrigin, resolveSiteBaseUrl, sharedSiteRedirectTarget } from '../../../lib/siteUrl'

export interface TenantSitePageProps {
  params: Promise<{ tenantId: string }>
}

const sharedHostAllowed = async () => requestMatchesSharedOrigin(
  (await headers()).get('host'),
  resolveSharedPublicOrigin()
)

export async function generateMetadata ({ params }: TenantSitePageProps): Promise<Metadata> {
  if (!(await sharedHostAllowed())) return { title: 'Website', robots: { index: false, follow: false } }
  const { tenantId } = await params
  const [site, domain] = await Promise.all([getPublicSite(tenantId), getTenantDomain(tenantId)])
  return site
    ? homeMetadata(site, tenantId, process.env, domain.canonicalHost)
    : { title: 'Website', robots: { index: false, follow: false } }
}

export default async function TenantSitePage ({ params }: TenantSitePageProps) {
  if (!(await sharedHostAllowed())) notFound()
  const { tenantId } = await params
  const [site, domain] = await Promise.all([getPublicSite(tenantId), getTenantDomain(tenantId)])
  if (!site || !findHomePage(site)) notFound()
  const redirectTarget = sharedSiteRedirectTarget(site.status, domain.canonicalHost, '/')
  if (redirectTarget) permanentRedirect(redirectTarget)
  return (
    <PublicHome
      site={site}
      siteBaseUrl={resolveSiteBaseUrl(tenantId)}
      sitePath={`/site/${encodeURIComponent(tenantId)}`}
    />
  )
}
