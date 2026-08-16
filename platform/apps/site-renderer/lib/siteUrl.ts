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
  env: PublicSiteEnvironment = process.env
): string | null {
  const origin = resolveSharedPublicOrigin(env)
  if (!origin) return null
  return new URL(`/site/${encodeURIComponent(tenantId)}`, `${origin}/`).toString()
}

export function appendSitePath (siteBaseUrl: string, path: string): string {
  return new URL(path.replace(/^\/+/, ''), `${siteBaseUrl.replace(/\/+$/, '')}/`).toString()
}

export function publicIndexingEnabled (env: PublicSiteEnvironment = process.env): boolean {
  return env.SITE_PUBLIC_INDEXING_ENABLED === 'true' && resolveSharedPublicOrigin(env) !== null
}
