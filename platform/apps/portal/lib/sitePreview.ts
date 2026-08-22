export function sitePreviewOrigin (): string {
  const value = process.env.NEXT_PUBLIC_SITE_PREVIEW_ORIGIN
  if (!value) throw new Error('NEXT_PUBLIC_SITE_PREVIEW_ORIGIN is not configured')
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) throw new Error()
    return url.origin
  } catch {
    throw new Error('NEXT_PUBLIC_SITE_PREVIEW_ORIGIN is invalid')
  }
}

export function sitePreviewUrl (tenantId: string, token: string): string {
  const path = `/preview/${encodeURIComponent(tenantId)}`
  const url = new URL(path, `${sitePreviewOrigin()}/`)
  url.searchParams.set('token', token)
  return url.toString()
}
