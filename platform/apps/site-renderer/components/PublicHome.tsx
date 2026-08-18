import type { SiteDefinition } from '@bakerrang/site-schema'
import { findHomePage, isContactSection } from '@bakerrang/site-schema'
import { SiteShell } from '@bakerrang/site-components'
import { BusinessJsonLd } from './BusinessJsonLd'
import { SectionRenderer } from './SectionRenderer'

export function PublicHome ({ site, siteBaseUrl, sitePath }: {
  site: SiteDefinition
  siteBaseUrl: string | null
  sitePath: string
}) {
  const home = findHomePage(site)
  if (!home) return null
  const hasContact = home.sections.some(isContactSection)
  return (
    <SiteShell currentPage="home" site={site} sitePath={sitePath}>
      <BusinessJsonLd site={site} siteBaseUrl={siteBaseUrl} />
      <main>
        {home.sections.map((section) => (
          <SectionRenderer
            heroContactHref={hasContact ? '#contact' : undefined}
            key={section.id}
            section={section}
            sitePath={sitePath}
          />
        ))}
      </main>
    </SiteShell>
  )
}
