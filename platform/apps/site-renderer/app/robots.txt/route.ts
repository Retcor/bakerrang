import { fetchPublicDomain } from '../../lib/domainApi.ts'
import { normalizeRequestHost, requestMatchesSharedOrigin } from '../../lib/requestHost.ts'
import { indexingEnvironmentEnabled, resolveSharedPublicOrigin } from '../../lib/siteUrl.ts'

export const dynamic = 'force-dynamic'

const disallow = 'User-agent: *\nDisallow: /\n'

export async function GET (request: Request): Promise<Response> {
  let body = disallow
  if (indexingEnvironmentEnabled()) {
    const rawHost = request.headers.get('host')
    const sharedOrigin = resolveSharedPublicOrigin()
    if (requestMatchesSharedOrigin(rawHost, sharedOrigin)) {
      body = 'User-agent: *\nAllow: /site/\nDisallow: /\n'
    } else {
      const hostname = normalizeRequestHost(rawHost)
      const domain = hostname ? await fetchPublicDomain(hostname) : null
      if (domain) {
        body = `User-agent: *\nAllow: /\nSitemap: https://${domain.canonicalHost}/sitemap.xml\n`
      }
    }
  }
  return new Response(body, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8'
    }
  })
}
