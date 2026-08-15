import { notFound } from 'next/navigation'
import { Container } from '@bakerrang/ui'
import { findHomePage, isContactSection } from '@bakerrang/site-schema'
import { LeadForm } from '../../../../components/LeadForm'
import { getPublicSite } from '../../../../lib/api'

export interface ContactPageProps {
  params: Promise<{ tenantId: string }>
}

export default async function ContactPage ({ params }: ContactPageProps) {
  const { tenantId } = await params
  const site = await getPublicSite(tenantId)
  if (!site) notFound()

  const contact = findHomePage(site)?.sections.find(isContactSection)
  if (!contact || contact.content.action.type !== 'leadForm') notFound()

  return (
    <main className="py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-fg">{contact.content.title}</h1>
          {contact.content.text && <p className="mt-4 text-lg leading-8 text-fg-muted">{contact.content.text}</p>}
          <div className="mt-8">
            <LeadForm tenantId={tenantId} />
          </div>
        </div>
      </Container>
    </main>
  )
}
