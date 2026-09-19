import type { ReactNode } from 'react'
import type { SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { isContactSection } from '@bakerrang/site-schema'
import { SiteShell } from '@bakerrang/site-components'
import { resolveSiteNavigation } from './navigation'
import { canInterceptNavigation, type RenderContext } from './renderContext'
import { SectionRenderer } from './SectionRenderer'
import { SectionSelectionBoundary } from './SectionSelectionBoundary'

function editorSectionLabel (type: string) {
  if (type === 'businessHours') return 'Business Hours'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

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
  const interceptNavigation = canInterceptNavigation(context)
  return (
    <SiteShell
      activePage={page}
      footerNav={navigation.footerItems}
      homeHref={navigation.homeHref}
      interceptNavigation={interceptNavigation}
      onNavigate={interceptNavigation ? context.onNavigate : undefined}
      onSelectPage={interceptNavigation ? context.onSelectPage : undefined}
      primaryNav={navigation.headerItems}
      site={site}
    >
      {beforeMain}
      <main data-br-role="main">
        {page.sections.filter((section) => !section.hidden).map((section) => {
          const rendered = <SectionRenderer businessHours={site.businessProfile?.businessHours} heroContactHref={contact ? `#section-${contact.id}` : undefined} key={section.id} leadForm={section.type === 'contact' && section.content.action.type === 'leadForm' ? leadForm : undefined} section={section} />
          return context.onSelectSection && context.mode !== 'PUBLIC'
            ? <SectionSelectionBoundary key={section.id} label={editorSectionLabel(section.type)} onSelect={context.onSelectSection} sectionId={section.id} selected={context.mode === 'EDITOR' && context.selectedSectionId === section.id}>{rendered}</SectionSelectionBoundary>
            : rendered
        })}
      </main>
    </SiteShell>
  )
}
