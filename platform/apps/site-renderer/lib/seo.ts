import type { Metadata } from 'next'
import type { BusinessProfile, SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { appendSitePath, indexingEnvironmentEnabled, publicIndexingEnabled, resolveSiteBaseUrl, type PublicSiteEnvironment } from './siteUrl.ts'

const schemaDays = {
  monday: 'https://schema.org/Monday',
  tuesday: 'https://schema.org/Tuesday',
  wednesday: 'https://schema.org/Wednesday',
  thursday: 'https://schema.org/Thursday',
  friday: 'https://schema.org/Friday',
  saturday: 'https://schema.org/Saturday',
  sunday: 'https://schema.org/Sunday'
} as const

const safeSocialUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value)) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

export function brandingIcons (site?: SiteDefinition | null): Pick<Metadata, 'icons'> {
  const src = site?.branding?.faviconSrc
  return src ? { icons: { icon: src } } : {}
}

const siteSocialImage = (profile: BusinessProfile | undefined) => {
  if (!profile?.socialImageMediaId || !profile.socialImageSrc) return undefined
  return {
    url: profile.socialImageSrc,
    ...(profile.socialImageWidth ? { width: profile.socialImageWidth } : {}),
    ...(profile.socialImageHeight ? { height: profile.socialImageHeight } : {})
  }
}

const pageSocialImage = (page: SitePage) => {
  if (!page.seo?.socialImageMediaId || !page.seo.socialImageSrc) return undefined
  return {
    url: page.seo.socialImageSrc,
    ...(page.seo.socialImageWidth ? { width: page.seo.socialImageWidth } : {}),
    ...(page.seo.socialImageHeight ? { height: page.seo.socialImageHeight } : {})
  }
}

export interface PageMetadataContext {
  canonicalHost?: string | null
  env?: PublicSiteEnvironment
  preview?: boolean
  tenantId: string
}

/** The sole policy for Home, Page, shared-host, custom-domain, and Preview metadata. */
export function resolvePageMetadata (
  site: SiteDefinition,
  page: SitePage,
  { canonicalHost, env = process.env, preview = false, tenantId }: PageMetadataContext
): Metadata {
  const title = page.seo?.title || (page.id === 'home'
    ? site.branding.siteName
    : `${page.title} | ${site.branding.siteName}`)
  const description = page.seo?.description || site.seo?.defaultDescription || site.businessProfile?.description
  const image = pageSocialImage(page) || siteSocialImage(site.businessProfile)
  const baseUrl = preview ? null : resolveSiteBaseUrl(tenantId, env, canonicalHost)
  const canonical = baseUrl ? (page.id === 'home' ? baseUrl : appendSitePath(baseUrl, page.slug)) : undefined
  const environmentIndexable = canonicalHost ? indexingEnvironmentEnabled(env) : publicIndexingEnabled(env)
  const publicReady = site.status === 'PUBLISHED' && baseUrl !== null
  const operatorBlocked = site.seo?.indexable === false || page.seo?.noIndex === true
  const robots = preview
    ? { index: false, follow: false }
    : !environmentIndexable || !publicReady
        ? { index: false, follow: false }
        : operatorBlocked
            ? { index: false, follow: true }
            : { index: true, follow: true }

  return {
    title,
    ...(description ? { description } : {}),
    robots,
    ...(preview
      ? { referrer: 'no-referrer' as const }
      : canonical
          ? { alternates: { canonical } }
          : {}),
    openGraph: {
      title,
      ...(description ? { description } : {}),
      ...(!preview && canonical ? { url: canonical } : {}),
      siteName: site.branding.siteName,
      type: 'website',
      ...(image ? { images: [image] } : {})
    },
    twitter: {
      title,
      ...(description ? { description } : {}),
      card: image ? 'summary_large_image' : 'summary',
      ...(image ? { images: [image.url] } : {})
    },
    ...brandingIcons(site)
  }
}

export function homeMetadata (
  site: SiteDefinition,
  tenantId: string,
  env: PublicSiteEnvironment = process.env,
  canonicalHost?: string | null
): Metadata {
  const page = site.pages.find((candidate) => candidate.id === 'home')
  return page
    ? resolvePageMetadata(site, page, { tenantId, env, canonicalHost })
    : { title: 'Website', robots: { index: false, follow: false } }
}

export function pageMetadata (
  site: SiteDefinition,
  page: SitePage,
  tenantId: string,
  env: PublicSiteEnvironment = process.env,
  canonicalHost?: string | null
): Metadata {
  return resolvePageMetadata(site, page, { tenantId, env, canonicalHost })
}

export function localBusinessData (site: SiteDefinition, siteBaseUrl: string | null): Record<string, unknown> | null {
  const profile = site.businessProfile
  if (!profile || !(profile.phone || profile.email || profile.address || profile.serviceAreas?.length)) {
    return null
  }
  const address = profile.address
    ? {
        '@type': 'PostalAddress',
        ...(profile.address.line1 || profile.address.line2
          ? { streetAddress: [profile.address.line1, profile.address.line2].filter(Boolean).join(', ') }
          : {}),
        addressLocality: profile.address.city,
        ...(profile.address.region ? { addressRegion: profile.address.region } : {}),
        ...(profile.address.postalCode ? { postalCode: profile.address.postalCode } : {}),
        ...(profile.address.country ? { addressCountry: profile.address.country } : {})
      }
    : undefined
  const openingHoursSpecification = profile.businessHours
    ? Object.entries(schemaDays).flatMap(([day, dayOfWeek]) => {
        const hours = profile.businessHours?.[day as keyof typeof schemaDays]
        return hours && !('closed' in hours)
          ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek, opens: hours.open, closes: hours.close }]
          : []
      })
    : []
  const sameAs = (Array.isArray(profile.socialLinks) ? profile.socialLinks : [])
    .flatMap((link) => link && safeSocialUrl(link.url) ? [link.url] : [])
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.branding.siteName,
    ...(siteBaseUrl ? { url: siteBaseUrl } : {}),
    ...(profile.description ? { description: profile.description } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(profile.email ? { email: profile.email } : {}),
    ...(address ? { address } : {}),
    ...(profile.serviceAreas?.length ? { areaServed: profile.serviceAreas } : {}),
    ...(openingHoursSpecification.length ? { openingHoursSpecification } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(site.branding.logoSrc ? { logo: site.branding.logoSrc } : {}),
    ...(profile.socialImageMediaId && profile.socialImageSrc ? { image: profile.socialImageSrc } : {})
  }
}

export function serializeJsonLd (data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/[<>&]/g, (character) => ({
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026'
  })[character] as string)
}
