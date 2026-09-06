import type { SiteDefinition } from '@bakerrang/site-schema'
import { findHomePage, isContactSection } from '@bakerrang/site-schema'
import { SiteShell } from '@bakerrang/site-components'
import { BusinessJsonLd } from './BusinessJsonLd'
import { SectionRenderer } from './SectionRenderer'

export function PublicHome ({ previewToken, site, siteBaseUrl, sitePath }: {
  previewToken?: string
  site: SiteDefinition
  siteBaseUrl: string | null
  sitePath: string
}) {
  const home = findHomePage(site)
  if (!home) return null
  const contact = home.sections.find((section) => !section.hidden && isContactSection(section))
  return (
    <SiteShell currentPage="home" site={site} sitePath={sitePath}>
      <BusinessJsonLd site={site} siteBaseUrl={siteBaseUrl} />
      <main data-br-role="main">
        {home.sections.filter((section) => !section.hidden).map((section) => (
          <SectionRenderer
            businessHours={site.businessProfile?.businessHours}
            heroContactHref={contact ? `#section-${contact.id}` : undefined}
            key={section.id}
            previewToken={previewToken}
            section={section}
            sitePath={sitePath}
          />
        ))}
      </main>
    </SiteShell>
  )
}
