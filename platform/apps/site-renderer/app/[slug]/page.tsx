import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findPageBySlug } from '@bakerrang/site-schema'
import { PublicPage } from '../../components/PublicPage'
import { getPublishedSite } from '../../lib/api'
import { resolveRequestDomain } from '../../lib/domains'
import { pageMetadata } from '../../lib/seo'
import { resolveSiteBaseUrl } from '../../lib/siteUrl'

export async function generateMetadata ({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, domain] = await Promise.all([params, resolveRequestDomain()])
  if (!domain) return { title: 'Website', robots: { index: false, follow: false } }
  const site = await getPublishedSite(domain.tenantId)
  const page = site ? findPageBySlug(site, slug) : undefined
  return site && page ? pageMetadata(site, page, domain.tenantId, process.env, domain.canonicalHost) : { title: 'Website', robots: { index: false, follow: false } }
}

export default async function CustomDomainPage ({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, domain] = await Promise.all([params, resolveRequestDomain()])
  if (!domain) notFound()
  const site = await getPublishedSite(domain.tenantId)
  const page = site ? findPageBySlug(site, slug) : undefined
  if (!site || !page) notFound()
  return <PublicPage navigationContext={{ kind: 'customDomain' }} page={page} site={site} siteBaseUrl={resolveSiteBaseUrl(domain.tenantId, process.env, domain.canonicalHost)} tenantId={domain.tenantId} />
}
