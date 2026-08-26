import type { Metadata } from 'next'
import { requestMatchesSharedOrigin } from './requestHost.ts'
import { resolveSharedPublicOrigin, type PublicSiteEnvironment } from './siteUrl.ts'

export function previewHostAllowed (
  requestHost: string | null | undefined,
  env: PublicSiteEnvironment = process.env
): boolean {
  return requestMatchesSharedOrigin(requestHost, resolveSharedPublicOrigin(env))
}

export function previewPath (tenantId: string, token: string, contact = false): string {
  const base = `/preview/${encodeURIComponent(tenantId)}${contact ? '/contact' : ''}`
  return `${base}?${new URLSearchParams({ token }).toString()}`
}

export function previewMetadata (title = 'Website Preview'): Metadata {
  return {
    title,
    robots: { index: false, follow: false },
    referrer: 'no-referrer'
  }
}
