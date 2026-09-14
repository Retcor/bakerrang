import type { ReactNode } from 'react'
import type { SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { isContactSection } from '@bakerrang/site-schema'
import { SiteShell } from '@bakerrang/site-components'
import { resolveSiteNavigation } from './navigation'
import type { RenderContext } from './renderContext'
import { SectionRenderer } from './SectionRenderer'

export interface SitePageRendererProps {
  context: RenderContext
  page: SitePage
  site: SiteDefinition
  leadForm?: ReactNode
  /** App-owned content such as public-site structured data. */
  beforeMain?: ReactNode
}

export function SitePageRenderer ({ beforeMain, context, leadForm, page, site }: SitePageRendererProps) {
  const contact = page.sections.find((section) => !section.hidden && isContactSection(section))
  const navigation = resolveSiteNavigation(site, page, context.navigation)
  return (
    <SiteShell
      activePage={page}
      footerNav={navigation.footerItems}
      homeHref={navigation.homeHref}
      onNavigate={context.onNavigate}
      onSelectPage={context.onSelectPage}
      primaryNav={navigation.headerItems}
      site={site}
    >
      {beforeMain}
      <main data-br-role="main">
        {page.sections.filter((section) => !section.hidden).map((section) => <SectionRenderer businessHours={site.businessProfile?.businessHours} heroContactHref={contact ? `#section-${contact.id}` : undefined} key={section.id} leadForm={section.type === 'contact' && section.content.action.type === 'leadForm' ? leadForm : undefined} section={section} />)}
      </main>
    </SiteShell>
  )
}
