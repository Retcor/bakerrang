import { fetchPublicDomain } from '../../lib/domainApi.ts'
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

  const url = `https://${domain.canonicalHost}/`
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `  <url><loc>${url}</loc></url>\n` +
    '</urlset>\n'
  return new Response(body, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/xml; charset=utf-8'
    }
  })
}
