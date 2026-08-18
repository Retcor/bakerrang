import type { Metadata } from 'next'
import type { BusinessProfile, SiteDefinition } from '@bakerrang/site-schema'
import { appendSitePath, indexingEnvironmentEnabled, publicIndexingEnabled, resolveSiteBaseUrl, type PublicSiteEnvironment } from './siteUrl.ts'

const socialImage = (profile: BusinessProfile | undefined) => {
  if (!profile?.socialImageMediaId || !profile.socialImageSrc) return undefined
  return {
    url: profile.socialImageSrc,
    ...(profile.socialImageWidth ? { width: profile.socialImageWidth } : {}),
    ...(profile.socialImageHeight ? { height: profile.socialImageHeight } : {})
  }
}

export function homeMetadata (
  site: SiteDefinition,
  tenantId: string,
  env: PublicSiteEnvironment = process.env,
  canonicalHost?: string | null
): Metadata {
  const title = site.branding.siteName
  const description = site.businessProfile?.description
  const baseUrl = resolveSiteBaseUrl(tenantId, env, canonicalHost)
  const image = socialImage(site.businessProfile)
  const indexable = site.status !== 'DRAFT' && baseUrl !== null && (canonicalHost
    ? indexingEnvironmentEnabled(env)
    : publicIndexingEnabled(env))
  return {
    title,
    ...(description ? { description } : {}),
    robots: { index: indexable, follow: indexable },
    ...(baseUrl ? { alternates: { canonical: baseUrl } } : {}),
    openGraph: {
      title,
      ...(description ? { description } : {}),
      ...(baseUrl ? { url: baseUrl } : {}),
      siteName: title,
      type: 'website',
      ...(image ? { images: [image] } : {})
    },
    twitter: {
      title,
      ...(description ? { description } : {}),
      card: image ? 'summary_large_image' : 'summary',
      ...(image ? { images: [image.url] } : {})
    }
  }
}

export function contactMetadata (
  site: SiteDefinition,
  tenantId: string,
  env: PublicSiteEnvironment = process.env,
  canonicalHost?: string | null
): Metadata {
  const baseUrl = resolveSiteBaseUrl(tenantId, env, canonicalHost)
  return {
    title: `Contact | ${site.branding.siteName}`,
    robots: { index: false, follow: site.status !== 'DRAFT' && baseUrl !== null },
    ...(baseUrl ? { alternates: { canonical: appendSitePath(baseUrl, 'contact') } } : {})
  }
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
