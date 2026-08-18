import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchPublicDomain, fetchTenantDomain } from '../lib/domainApi.ts'
import { normalizeRequestHost, requestHostnameFromHeaders, requestMatchesSharedOrigin } from '../lib/requestHost.ts'
import { GET as robots } from '../app/robots.txt/route.ts'
import { GET as sitemap } from '../app/sitemap.xml/route.ts'
import { siteNavigationPaths } from '../../../packages/site-components/src/sitePath.ts'
import { sharedSiteRedirectTarget } from '../lib/siteUrl.ts'
import { fetchPublicSite, fetchPublishedSite, publishedSiteOrNull } from '../lib/siteApi.ts'

test('request host normalization uses Host-compatible port handling without accepting malformed input', () => {
  assert.equal(normalizeRequestHost('Example.COM:3002'), 'example.com')
  assert.equal(normalizeRequestHost('example.com.'), 'example.com')
  assert.equal(normalizeRequestHost('münich.example'), 'xn--mnich-kva.example')
  for (const value of [
    'https://example.com', 'example.com/path', 'user@example.com', '*.example.com',
    '[2001:db8::1]', 'localhost', 'example.com:99999'
  ]) assert.equal(normalizeRequestHost(value), null)
  assert.equal(requestMatchesSharedOrigin('sites.example.com', 'https://sites.example.com'), true)
  assert.equal(requestMatchesSharedOrigin('sites.example.com:443', 'https://sites.example.com'), true)
  assert.equal(requestMatchesSharedOrigin('custom.example', 'https://sites.example.com'), false)
  assert.equal(requestMatchesSharedOrigin('localhost:3002', 'http://localhost:3002'), true)

  const forwarded = new Headers({
    host: 'active.example',
    'x-forwarded-host': 'attacker.example'
  })
  assert.equal(requestHostnameFromHeaders(forwarded), 'active.example')
})

test('shared and custom navigation paths remain on their rendered host shape', () => {
  assert.deepEqual(siteNavigationPaths('', 'home'), {
    homeHref: '/', sectionPrefix: '', contactPageHref: '/contact'
  })
  assert.deepEqual(siteNavigationPaths('', 'contact'), {
    homeHref: '/', sectionPrefix: '/', contactPageHref: '/contact'
  })
  assert.deepEqual(siteNavigationPaths('/site/tenant-1', 'contact'), {
    homeHref: '/site/tenant-1',
    sectionPrefix: '/site/tenant-1',
    contactPageHref: '/site/tenant-1/contact'
  })
})

test('shared published redirects are permanentRedirect-ready and preview never redirects', () => {
  assert.equal(sharedSiteRedirectTarget('PUBLISHED', 'example.com', '/'), 'https://example.com/')
  assert.equal(sharedSiteRedirectTarget('PUBLISHED', 'example.com', '/contact'),
    'https://example.com/contact')
  assert.equal(sharedSiteRedirectTarget('DRAFT', 'example.com', '/'), null)
  assert.equal(sharedSiteRedirectTarget('PUBLISHED', null, '/'), null)
})

test('domain API accepts only sanitized canonical routing responses', async () => {
  const originalFetch = globalThis.fetch
  const originalBase = process.env.SITE_API_BASE_URL
  process.env.SITE_API_BASE_URL = 'https://api.example'
  try {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/public/domains/active.example')) {
        return Response.json({
          tenantId: 'tenant-1', canonicalHost: 'active.example', verificationToken: 'ignored'
        })
      }
      if (url.endsWith('/public/sites/tenant-1/domain')) {
        return Response.json({ canonicalHost: 'active.example' })
      }
      return new Response(null, { status: 404 })
    }) as typeof fetch
    assert.deepEqual(await fetchPublicDomain('active.example'), {
      tenantId: 'tenant-1', canonicalHost: 'active.example'
    })
    assert.equal(await fetchPublicDomain('unknown.example'), null)
    assert.deepEqual(await fetchTenantDomain('tenant-1'), { canonicalHost: 'active.example' })
    assert.deepEqual(await fetchTenantDomain('tenant-2'), { canonicalHost: null })
  } finally {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.SITE_API_BASE_URL
    else process.env.SITE_API_BASE_URL = originalBase
  }
})

test('domain API rejects raw or malformed canonical host values', async () => {
  const originalFetch = globalThis.fetch
  const originalBase = process.env.SITE_API_BASE_URL
  process.env.SITE_API_BASE_URL = 'https://api.example'
  try {
    globalThis.fetch = (async () => Response.json({
      tenantId: 'tenant-1', canonicalHost: 'Raw.Example'
    })) as typeof fetch
    await assert.rejects(fetchPublicDomain('raw.example'), { message: 'Unable to resolve site routing' })
  } finally {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.SITE_API_BASE_URL
    else process.env.SITE_API_BASE_URL = originalBase
  }
})

test('preview-capable and published-only renderer fetches use isolated API paths', async () => {
  const originalFetch = globalThis.fetch
  const originalBase = process.env.SITE_API_BASE_URL
  process.env.SITE_API_BASE_URL = 'https://api.example'
  const draft = { status: 'DRAFT', pages: [{ sections: [{ content: { title: 'Working' } }] }] }
  const published = { status: 'PUBLISHED', pages: [{ sections: [{ content: { title: 'Published' } }] }] }
  try {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/public/sites/tenant-1/published')) return Response.json(published)
      if (url.endsWith('/public/sites/tenant-1')) return Response.json(draft)
      return new Response(null, { status: 404 })
    }) as typeof fetch

    assert.deepEqual(await fetchPublicSite('tenant-1'), draft)
    assert.deepEqual(await fetchPublishedSite('tenant-1'), published)
    assert.equal(publishedSiteOrNull(draft as never), null)
    assert.deepEqual(publishedSiteOrNull(published as never), published)
    assert.equal(await fetchPublishedSite('missing'), null)
  } finally {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.SITE_API_BASE_URL
    else process.env.SITE_API_BASE_URL = originalBase
  }
})

test('host-aware robots and sitemap fail closed and trust the API canonical host', async () => {
  const originalFetch = globalThis.fetch
  const originalBase = process.env.SITE_API_BASE_URL
  const originalOrigin = process.env.SITE_PUBLIC_ORIGIN
  const originalIndexing = process.env.SITE_PUBLIC_INDEXING_ENABLED
  process.env.SITE_API_BASE_URL = 'https://api.example'
  process.env.SITE_PUBLIC_ORIGIN = 'https://sites.example.com'
  process.env.SITE_PUBLIC_INDEXING_ENABLED = 'true'
  try {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      return url.endsWith('/public/domains/active.example')
        ? Response.json({ tenantId: 'tenant-1', canonicalHost: 'active.example' })
        : new Response(null, { status: 404 })
    }) as typeof fetch

    const customRobots = await robots(new Request('https://ignored/robots.txt', {
      headers: { host: 'ACTIVE.EXAMPLE' }
    }))
    assert.equal(await customRobots.text(),
      'User-agent: *\nAllow: /\nSitemap: https://active.example/sitemap.xml\n')

    const customSitemap = await sitemap(new Request('https://ignored/sitemap.xml', {
      headers: { host: 'active.example' }
    }))
    assert.equal(customSitemap.status, 200)
    assert.match(await customSitemap.text(), /<loc>https:\/\/active\.example\/<\/loc>/)

    const sharedRobots = await robots(new Request('https://ignored/robots.txt', {
      headers: { host: 'sites.example.com' }
    }))
    assert.equal(await sharedRobots.text(), 'User-agent: *\nAllow: /site/\nDisallow: /\n')
    assert.equal((await sitemap(new Request('https://ignored/sitemap.xml', {
      headers: { host: 'sites.example.com' }
    }))).status, 404)

    const unknown = await robots(new Request('https://ignored/robots.txt', {
      headers: { host: 'unknown.example' }
    }))
    assert.equal(await unknown.text(), 'User-agent: *\nDisallow: /\n')

    process.env.SITE_PUBLIC_INDEXING_ENABLED = 'false'
    const disabled = await robots(new Request('https://ignored/robots.txt', {
      headers: { host: 'active.example' }
    }))
    assert.equal(await disabled.text(), 'User-agent: *\nDisallow: /\n')
    assert.equal((await sitemap(new Request('https://ignored/sitemap.xml', {
      headers: { host: 'active.example' }
    }))).status, 404)
  } finally {
    globalThis.fetch = originalFetch
    for (const [key, value] of [
      ['SITE_API_BASE_URL', originalBase],
      ['SITE_PUBLIC_ORIGIN', originalOrigin],
      ['SITE_PUBLIC_INDEXING_ENABLED', originalIndexing]
    ] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
