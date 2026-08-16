import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SiteContainer, SiteShell } from '@bakerrang/site-components'
import { findHomePage, isContactSection } from '@bakerrang/site-schema'
import { LeadForm } from '../../../../components/LeadForm'
import { getPublicSite } from '../../../../lib/api'
import { contactMetadata } from '../../../../lib/seo'

export interface ContactPageProps {
  params: Promise<{ tenantId: string }>
}

export async function generateMetadata ({ params }: ContactPageProps): Promise<Metadata> {
  const { tenantId } = await params
  const site = await getPublicSite(tenantId)
  return site ? contactMetadata(site, tenantId) : { title: 'Contact', robots: { index: false, follow: false } }
}

export default async function ContactPage ({ params }: ContactPageProps) {
  const { tenantId } = await params
  const site = await getPublicSite(tenantId)
  if (!site) notFound()

  const contact = findHomePage(site)?.sections.find(isContactSection)
  if (!contact || contact.content.action.type !== 'leadForm') notFound()

  return (
    <SiteShell currentPage="contact" site={site} tenantId={tenantId}>
      <main className="bg-site-bg py-16 sm:py-24">
        <SiteContainer>
          <div className="mx-auto max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-site-fg">{contact.content.title}</h1>
            {contact.content.text && <p className="mt-4 text-lg leading-8 text-site-muted">{contact.content.text}</p>}
            <div className="mt-8">
              <LeadForm tenantId={tenantId} />
            </div>
          </div>
        </SiteContainer>
      </main>
    </SiteShell>
  )
}
