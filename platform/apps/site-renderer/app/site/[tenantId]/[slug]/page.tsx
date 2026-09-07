import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { findPageBySlug } from '@bakerrang/site-schema'
import { PublicPage } from '../../../../components/PublicPage'
import { getPublicSite } from '../../../../lib/api'
import { getTenantDomain } from '../../../../lib/domains'
import { pageMetadata } from '../../../../lib/seo'
import { requestMatchesSharedOrigin } from '../../../../lib/requestHost'
import { resolveSharedPublicOrigin, resolveSiteBaseUrl, sharedSiteRedirectTarget } from '../../../../lib/siteUrl'

const allowed = async () => requestMatchesSharedOrigin((await headers()).get('host'), resolveSharedPublicOrigin())
export async function generateMetadata ({ params }: { params: Promise<{ tenantId: string, slug: string }> }): Promise<Metadata> {
  if (!(await allowed())) return { title: 'Website', robots: { index: false, follow: false } }
  const { tenantId, slug } = await params; const [site, domain] = await Promise.all([getPublicSite(tenantId), getTenantDomain(tenantId)])
  const page = site ? findPageBySlug(site, slug) : undefined
  return site && page ? pageMetadata(site, page, tenantId, process.env, domain.canonicalHost) : { title: 'Website', robots: { index: false, follow: false } }
}
export default async function TenantSlugPage ({ params }: { params: Promise<{ tenantId: string, slug: string }> }) {
  if (!(await allowed())) notFound()
  const { tenantId, slug } = await params; const [site, domain] = await Promise.all([getPublicSite(tenantId), getTenantDomain(tenantId)])
  const page = site ? findPageBySlug(site, slug) : undefined
  if (!site || !page) notFound()
  const redirect = sharedSiteRedirectTarget(site.status, domain.canonicalHost, `/${slug}`)
  if (redirect) permanentRedirect(redirect)
  return <PublicPage page={page} site={site} siteBaseUrl={resolveSiteBaseUrl(tenantId)} sitePath={`/site/${encodeURIComponent(tenantId)}`} tenantId={tenantId} />
}
