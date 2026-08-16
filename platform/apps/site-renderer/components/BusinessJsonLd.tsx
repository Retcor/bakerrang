import type { SiteDefinition } from '@bakerrang/site-schema'
import { localBusinessData, serializeJsonLd } from '../lib/seo'
import { resolveSiteBaseUrl } from '../lib/siteUrl'

export function BusinessJsonLd ({ site, tenantId }: { site: SiteDefinition, tenantId: string }) {
  const data = localBusinessData(site, resolveSiteBaseUrl(tenantId))
  if (!data) return null
  return <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} type="application/ld+json" />
}
