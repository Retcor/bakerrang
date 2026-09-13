import type { SiteDefinition } from '@bakerrang/site-schema'
import { findHomePage } from '@bakerrang/site-schema'
import { PublicPage } from './PublicPage'
import type { SiteNavigationContext } from '../lib/navigation'

export function PublicHome ({ navigationContext = { kind: 'customDomain' }, previewToken, site, siteBaseUrl, tenantId = '' }: {
  navigationContext?: SiteNavigationContext
  previewToken?: string
  site: SiteDefinition
  siteBaseUrl: string | null
  /** Legacy compatibility only; route generation uses navigationContext. */
  sitePath?: string
  tenantId?: string
}) {
  const home = findHomePage(site)
  if (!home) return null
  return <PublicPage navigationContext={navigationContext} page={home} preview={Boolean(previewToken)} site={site} siteBaseUrl={siteBaseUrl} tenantId={tenantId} />
}
