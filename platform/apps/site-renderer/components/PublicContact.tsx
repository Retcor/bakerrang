import type { ContactSection, SiteDefinition } from '@bakerrang/site-schema'
import { SiteContainer, SiteShell } from '@bakerrang/site-components'
import { LeadForm } from './LeadForm'

export function PublicContact ({ contact, preview = false, site, sitePath, tenantId }: {
  contact: ContactSection
  preview?: boolean
  site: SiteDefinition
  sitePath: string
  tenantId: string
}) {
  return (
    <SiteShell currentPage="contact" site={site} sitePath={sitePath}>
      <main className="site-section bg-site-bg" data-br-role="main">
        <SiteContainer>
          <div className="mx-auto max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-site-fg" data-br-role="section-heading">{contact.content.title}</h1>
            {contact.content.text && <p className="mt-4 text-lg leading-8 text-site-muted">{contact.content.text}</p>}
            <div className="mt-8">
              <LeadForm preview={preview} tenantId={tenantId} />
            </div>
          </div>
        </SiteContainer>
      </main>
    </SiteShell>
  )
}
