import type { Metadata } from 'next'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { brandingIcons } from './seo.ts'
import { requestMatchesSharedOrigin } from './requestHost.ts'
import { resolveSharedPublicOrigin, type PublicSiteEnvironment } from './siteUrl.ts'

export function previewHostAllowed (
  requestHost: string | null | undefined,
  env: PublicSiteEnvironment = process.env
): boolean {
  return requestMatchesSharedOrigin(requestHost, resolveSharedPublicOrigin(env))
}

export function previewPath (tenantId: string, token: string, pageId = 'home'): string {
  const base = pageId === 'home' ? `/preview/${encodeURIComponent(tenantId)}` : `/preview/${encodeURIComponent(tenantId)}/page/${encodeURIComponent(pageId)}`
  return `${base}?${new URLSearchParams({ token }).toString()}`
}

export function previewMetadata (title = 'Website Preview', site?: SiteDefinition | null): Metadata {
  return {
    title,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    ...brandingIcons(site)
  }
}

export async function resolvePreviewMetadata (
  props: {
    params: Promise<{ tenantId: string }>
    searchParams: Promise<{ token?: string | string[] }>
  },
  title?: string
): Promise<Metadata> {
  const query = await props.searchParams
  const token = typeof query.token === 'string' && query.token ? query.token : null
  if (!token) return previewMetadata(title)
  try {
    const { tenantId } = await props.params
    const { getPreviewSite } = await import('./api.ts')
    const site = await getPreviewSite(tenantId, token)
    return previewMetadata(title, site)
  } catch {
    return previewMetadata(title)
  }
}
