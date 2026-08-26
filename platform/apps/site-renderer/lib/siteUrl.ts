export type PublicSiteEnvironment = Record<string, string | undefined>

export function resolveSharedPublicOrigin (env: PublicSiteEnvironment = process.env): string | null {
  const value = env.SITE_PUBLIC_ORIGIN
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) return null
    return url.origin
  } catch {
    return null
  }
}

export function resolveSiteBaseUrl (
  tenantId: string,
  env: PublicSiteEnvironment = process.env,
  canonicalHost?: string | null
): string | null {
  if (canonicalHost) {
    const normalized = canonicalHost.toLowerCase()
    if (
      normalized.length <= 253 &&
      normalized.includes('.') &&
      normalized.split('.').every((label) => (
        label.length >= 1 && label.length <= 63 && /^[a-z0-9-]+$/.test(label) &&
        !label.startsWith('-') && !label.endsWith('-')
      ))
    ) return `https://${normalized}/`
    return null
  }
  const origin = resolveSharedPublicOrigin(env)
  if (!origin) return null
  return new URL(`/site/${encodeURIComponent(tenantId)}`, `${origin}/`).toString()
}

export function appendSitePath (siteBaseUrl: string, path: string): string {
  return new URL(path.replace(/^\/+/, ''), `${siteBaseUrl.replace(/\/+$/, '')}/`).toString()
}

export function sharedSiteRedirectTarget (
  siteStatus: string,
  canonicalHost: string | null,
  path: '/' | '/contact'
): string | null {
  if (siteStatus !== 'PUBLISHED' || !canonicalHost) return null
  const base = resolveSiteBaseUrl('', {}, canonicalHost)
  if (!base) return null
  return new URL(path, `${base}/`).toString()
}

export function indexingEnvironmentEnabled (env: PublicSiteEnvironment = process.env): boolean {
  return env.SITE_PUBLIC_INDEXING_ENABLED === 'true'
}

export function publicIndexingEnabled (env: PublicSiteEnvironment = process.env): boolean {
  return indexingEnvironmentEnabled(env) && resolveSharedPublicOrigin(env) !== null
}
