import { headers } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { findHomePage, isContactSection } from '@bakerrang/site-schema'
import { PublicContact } from '../../../../components/PublicContact'
import { getPublicSite } from '../../../../lib/api'
import { getTenantDomain } from '../../../../lib/domains'
import { contactMetadata } from '../../../../lib/seo'
import { requestMatchesSharedOrigin } from '../../../../lib/requestHost'
import { resolveSharedPublicOrigin, sharedSiteRedirectTarget } from '../../../../lib/siteUrl'

export interface ContactPageProps {
  params: Promise<{ tenantId: string }>
}

const sharedHostAllowed = async () => requestMatchesSharedOrigin(
  (await headers()).get('host'),
  resolveSharedPublicOrigin()
)

export async function generateMetadata ({ params }: ContactPageProps): Promise<Metadata> {
  if (!(await sharedHostAllowed())) return { title: 'Contact', robots: { index: false, follow: false } }
  const { tenantId } = await params
  const [site, domain] = await Promise.all([getPublicSite(tenantId), getTenantDomain(tenantId)])
  return site
    ? contactMetadata(site, tenantId, process.env, domain.canonicalHost)
    : { title: 'Contact', robots: { index: false, follow: false } }
}

export default async function ContactPage ({ params }: ContactPageProps) {
  if (!(await sharedHostAllowed())) notFound()
  const { tenantId } = await params
  const [site, domain] = await Promise.all([getPublicSite(tenantId), getTenantDomain(tenantId)])
  if (!site) notFound()

  const redirectTarget = sharedSiteRedirectTarget(site.status, domain.canonicalHost, '/contact')
  if (redirectTarget) permanentRedirect(redirectTarget)

  const contact = findHomePage(site)?.sections.find(isContactSection)
  if (!contact || contact.content.action.type !== 'leadForm') notFound()

  return (
    <PublicContact
      contact={contact}
      site={site}
      sitePath={`/site/${encodeURIComponent(tenantId)}`}
      tenantId={tenantId}
    />
  )
}
