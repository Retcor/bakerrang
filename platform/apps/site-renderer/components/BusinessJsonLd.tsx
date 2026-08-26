import type { SiteDefinition } from '@bakerrang/site-schema'
import { localBusinessData, serializeJsonLd } from '../lib/seo'

export function BusinessJsonLd ({ site, siteBaseUrl }: { site: SiteDefinition, siteBaseUrl: string | null }) {
  const data = localBusinessData(site, siteBaseUrl)
  if (!data) return null
  return <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} type="application/ld+json" />
}
