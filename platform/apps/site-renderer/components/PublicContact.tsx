import type { ContactSection, SiteDefinition } from '@bakerrang/site-schema'
import { SiteContainer, SiteShell } from '@bakerrang/site-components'
import { LeadForm } from './LeadForm'

export function PublicContact ({ contact, site, sitePath, tenantId }: {
  contact: ContactSection
  site: SiteDefinition
  sitePath: string
  tenantId: string
}) {
  return (
    <SiteShell currentPage="contact" site={site} sitePath={sitePath}>
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
