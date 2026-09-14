import type { SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { SitePageRenderer, type RenderContext } from '@bakerrang/site-runtime'
import { BusinessJsonLd } from './BusinessJsonLd'
import { LeadForm } from './LeadForm'
import type { SiteNavigationContext } from '../lib/navigation'

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
  const context: RenderContext = { mode: preview ? 'TEMPLATE_PREVIEW' : 'PUBLIC', navigation: navigationContext }
  return <SitePageRenderer beforeMain={page.id === 'home' ? <BusinessJsonLd site={site} siteBaseUrl={siteBaseUrl} /> : undefined} context={context} leadForm={<LeadForm context={context} tenantId={tenantId} />} page={page} site={site} />
}
