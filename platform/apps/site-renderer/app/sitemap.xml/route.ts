import { fetchPublicDomain } from '../../lib/domainApi.ts'
import { getPublishedSite } from '../../lib/api.ts'
import { normalizeRequestHost, requestMatchesSharedOrigin } from '../../lib/requestHost.ts'
import { indexingEnvironmentEnabled, resolveSharedPublicOrigin } from '../../lib/siteUrl.ts'

export const dynamic = 'force-dynamic'

export async function GET (request: Request): Promise<Response> {
  const rawHost = request.headers.get('host')
  if (
    !indexingEnvironmentEnabled() ||
    requestMatchesSharedOrigin(rawHost, resolveSharedPublicOrigin())
  ) return new Response('Not found', { status: 404 })

  const hostname = normalizeRequestHost(rawHost)
  const domain = hostname ? await fetchPublicDomain(hostname) : null
  if (!domain) return new Response('Not found', { status: 404 })

  const site = await getPublishedSite(domain.tenantId)
  if (!site) return new Response('Not found', { status: 404 })
  const urls = site.seo?.indexable === false
    ? []
    : site.pages.filter((page) => page.seo?.noIndex !== true).map((page) => `https://${domain.canonicalHost}/${page.id === 'home' ? '' : page.slug}`)
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((url) => `  <url><loc>${url}</loc></url>\n`).join('') +
    '</urlset>\n'
  return new Response(body, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/xml; charset=utf-8'
    }
  })
}
