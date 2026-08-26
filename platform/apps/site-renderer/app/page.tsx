import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicHome } from '../components/PublicHome'
import { getPublishedSite } from '../lib/api'
import { publishedSiteOrNull } from '../lib/siteApi'
import { resolveRequestDomain } from '../lib/domains'
import { homeMetadata } from '../lib/seo'
import { resolveSiteBaseUrl } from '../lib/siteUrl'

const customSite = async () => {
  const domain = await resolveRequestDomain()
  if (!domain) return null
  const site = publishedSiteOrNull(await getPublishedSite(domain.tenantId))
  if (!site) return null
  return { domain, site }
}

export async function generateMetadata (): Promise<Metadata> {
  const resolved = await customSite()
  return resolved
    ? homeMetadata(resolved.site, resolved.domain.tenantId, process.env, resolved.domain.canonicalHost)
    : { title: 'Website', robots: { index: false, follow: false } }
}

export default async function CustomDomainHomePage () {
  const resolved = await customSite()
  if (!resolved) notFound()
  return (
    <PublicHome
      site={resolved.site}
      siteBaseUrl={resolveSiteBaseUrl(
        resolved.domain.tenantId,
        process.env,
        resolved.domain.canonicalHost
      )}
      sitePath=""
    />
  )
}
