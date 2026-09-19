import type { SiteDefinition } from '@bakerrang/site-schema'
import { findHomePage } from '@bakerrang/site-schema'
import { PublicPage } from './PublicPage'
import type { SiteNavigationContext } from '../lib/navigation'
import type { RenderMode } from '@bakerrang/site-runtime'

export function PublicHome ({ mode, navigationContext = { kind: 'customDomain' }, previewToken, site, siteBaseUrl, tenantId = '' }: {
  mode?: RenderMode
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
  return <PublicPage mode={mode} navigationContext={navigationContext} page={home} preview={Boolean(previewToken)} site={site} siteBaseUrl={siteBaseUrl} tenantId={tenantId} />
}
