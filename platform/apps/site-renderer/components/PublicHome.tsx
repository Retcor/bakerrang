import type { SiteDefinition } from '@bakerrang/site-schema'
import { findHomePage } from '@bakerrang/site-schema'
import { PublicPage } from './PublicPage'

export function PublicHome ({ previewToken, site, siteBaseUrl, sitePath, tenantId = '' }: {
  previewToken?: string
  site: SiteDefinition
  siteBaseUrl: string | null
  sitePath: string
  tenantId?: string
}) {
  const home = findHomePage(site)
  if (!home) return null
  return <PublicPage page={home} preview={Boolean(previewToken)} site={site} siteBaseUrl={siteBaseUrl} sitePath={sitePath} tenantId={tenantId} />
}
