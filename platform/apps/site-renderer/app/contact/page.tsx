import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findHomePage, isContactSection } from '@bakerrang/site-schema'
import { PublicContact } from '../../components/PublicContact'
import { getPublishedSite } from '../../lib/api'
import { publishedSiteOrNull } from '../../lib/siteApi'
import { resolveRequestDomain } from '../../lib/domains'
import { contactMetadata } from '../../lib/seo'

const customContact = async () => {
  const domain = await resolveRequestDomain()
  if (!domain) return null
  const site = publishedSiteOrNull(await getPublishedSite(domain.tenantId))
  if (!site) return null
  const contact = findHomePage(site)?.sections.find(isContactSection)
  if (!contact || contact.content.action.type !== 'leadForm') return null
  return { contact, domain, site }
}

export async function generateMetadata (): Promise<Metadata> {
  const resolved = await customContact()
  return resolved
    ? contactMetadata(resolved.site, resolved.domain.tenantId, process.env, resolved.domain.canonicalHost)
    : { title: 'Contact', robots: { index: false, follow: false } }
}

export default async function CustomDomainContactPage () {
  const resolved = await customContact()
  if (!resolved) notFound()
  return (
    <PublicContact
      contact={resolved.contact}
      site={resolved.site}
      sitePath=""
      tenantId={resolved.domain.tenantId}
    />
  )
}
