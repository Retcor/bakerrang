import type { SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { isContactSection } from '@bakerrang/site-schema'
import { SiteShell } from '@bakerrang/site-components'
import { BusinessJsonLd } from './BusinessJsonLd'
import { LeadForm } from './LeadForm'
import { SectionRenderer } from './SectionRenderer'

export function PublicPage ({ page, preview = false, site, siteBaseUrl, sitePath, tenantId }: {
  page: SitePage
  preview?: boolean
  site: SiteDefinition
  siteBaseUrl: string | null
  sitePath: string
  tenantId: string
}) {
  const contact = page.sections.find((section) => !section.hidden && isContactSection(section))
  return (
    <SiteShell activePage={page} site={site} sitePath={sitePath}>
      {page.id === 'home' && <BusinessJsonLd site={site} siteBaseUrl={siteBaseUrl} />}
      <main data-br-role="main">
        {page.sections.filter((section) => !section.hidden).map((section) => (
          <SectionRenderer
            businessHours={site.businessProfile?.businessHours}
            heroContactHref={contact ? `#section-${contact.id}` : undefined}
            key={section.id}
            leadForm={section.type === 'contact' && section.content.action.type === 'leadForm' ? <LeadForm preview={preview} tenantId={tenantId} /> : undefined}
            section={section}
          />
        ))}
      </main>
    </SiteShell>
  )
}
