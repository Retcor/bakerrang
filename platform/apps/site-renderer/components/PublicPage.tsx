import type { SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { isContactSection } from '@bakerrang/site-schema'
import { SiteShell } from '@bakerrang/site-components'
import { BusinessJsonLd } from './BusinessJsonLd'
import { LeadForm } from './LeadForm'
import { SectionRenderer } from './SectionRenderer'
import { resolveSiteNavigation, type SiteNavigationContext } from '../lib/navigation'

export function PublicPage ({ navigationContext = { kind: 'customDomain' }, page, preview = false, site, siteBaseUrl, tenantId }: {
  navigationContext?: SiteNavigationContext
  page: SitePage
  preview?: boolean
  site: SiteDefinition
  siteBaseUrl: string | null
  /** Legacy compatibility only; route generation uses navigationContext. */
  sitePath?: string
  tenantId: string
}) {
  const contact = page.sections.find((section) => !section.hidden && isContactSection(section))
  const navigation = resolveSiteNavigation(site, page, navigationContext)
  return (
    <SiteShell activePage={page} footerNav={navigation.footerItems} homeHref={navigation.homeHref} primaryNav={navigation.headerItems} site={site}>
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
