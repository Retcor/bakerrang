import test from 'node:test'
import assert from 'node:assert/strict'

const headerStore = {
  set host (value: string) { globalThis.__rendererTestHost = value },
  get host () { return globalThis.__rendererTestHost as string }
}
headerStore.host = ''

const { GET: originFavicon } = await import('../app/favicon.ico/route.ts')
const { GET: tenantFavicon } = await import('../app/site/[tenantId]/favicon.ico/route.ts')

const faviconSrc = 'https://media.example.com/favicon.png'
const publishedWithFavicon = {
  status: 'PUBLISHED',
  branding: { siteName: 'Acme', faviconMediaId: 'ico', faviconSrc },
  pages: []
}
const publishedWithoutFavicon = {
  status: 'PUBLISHED',
  branding: { siteName: 'Acme' },
  pages: []
}
const draftWithFavicon = {
  status: 'DRAFT',
  branding: { siteName: 'Working', faviconMediaId: 'ico', faviconSrc },
  pages: []
}

const tenantParams = { params: Promise.resolve({ tenantId: 'tenant-1' }) }

async function withEnv (run: () => Promise<void>) {
  const originalFetch = globalThis.fetch
  const originalBase = process.env.SITE_API_BASE_URL
  const originalOrigin = process.env.SITE_PUBLIC_ORIGIN
  process.env.SITE_API_BASE_URL = 'https://api.example'
  process.env.SITE_PUBLIC_ORIGIN = 'https://sites.example.com'
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
    headerStore.host = ''
    if (originalBase === undefined) delete process.env.SITE_API_BASE_URL
    else process.env.SITE_API_BASE_URL = originalBase
    if (originalOrigin === undefined) delete process.env.SITE_PUBLIC_ORIGIN
    else process.env.SITE_PUBLIC_ORIGIN = originalOrigin
  }
}

function mockApi (routes: Record<string, unknown>) {
  const calls: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    if (Object.prototype.hasOwnProperty.call(routes, url)) {
      const body = routes[url]
      return body === null ? new Response(null, { status: 404 }) : Response.json(body)
    }
    return new Response(null, { status: 404 })
  }) as typeof fetch
  return calls
}

test('custom host with published faviconSrc redirects to that URL', async () => {
  await withEnv(async () => {
    headerStore.host = 'active.example'
    const calls = mockApi({
      'https://api.example/public/domains/active.example': { tenantId: 'tenant-1', canonicalHost: 'active.example' },
      'https://api.example/public/sites/tenant-1/published': publishedWithFavicon
    })
    const response = await originFavicon()
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('location'), faviconSrc)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(calls.includes('https://api.example/public/domains/active.example'), true)
    assert.equal(calls.includes('https://api.example/public/sites/tenant-1/published'), true)
  })
})

test('custom host without favicon, unpublished, or unknown host returns 204', async () => {
  await withEnv(async () => {
    headerStore.host = 'active.example'
    mockApi({
      'https://api.example/public/domains/active.example': { tenantId: 'tenant-1', canonicalHost: 'active.example' },
      'https://api.example/public/sites/tenant-1/published': publishedWithoutFavicon
    })
    const noFavicon = await originFavicon()
    assert.equal(noFavicon.status, 204)
    assert.equal(noFavicon.headers.get('cache-control'), 'no-store')
    assert.equal(noFavicon.headers.get('location'), null)

    mockApi({
      'https://api.example/public/domains/active.example': { tenantId: 'tenant-1', canonicalHost: 'active.example' },
      'https://api.example/public/sites/tenant-1/published': draftWithFavicon
    })
    assert.equal((await originFavicon()).status, 204)

    mockApi({
      'https://api.example/public/domains/active.example': { tenantId: 'tenant-1', canonicalHost: 'active.example' }
    })
    assert.equal((await originFavicon()).status, 204)

    headerStore.host = 'unknown.example'
    mockApi({})
    assert.equal((await originFavicon()).status, 204)
  })
})

test('shared origin-root favicon is 204 even if a tenant has a favicon', async () => {
  await withEnv(async () => {
    headerStore.host = 'sites.example.com'
    const calls = mockApi({
      'https://api.example/public/domains/sites.example.com': { tenantId: 'tenant-1', canonicalHost: 'sites.example.com' },
      'https://api.example/public/sites/tenant-1/published': publishedWithFavicon
    })
    const response = await originFavicon()
    assert.equal(response.status, 204)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(calls.some((url) => url.includes('/public/sites/')), false)
  })
})

test('shared tenant favicon path redirects through getPublicSite', async () => {
  await withEnv(async () => {
    headerStore.host = 'sites.example.com'
    const calls = mockApi({
      'https://api.example/public/sites/tenant-1': publishedWithFavicon
    })
    const response = await tenantFavicon(new Request('https://sites.example.com/site/tenant-1/favicon.ico'), tenantParams)
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('location'), faviconSrc)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(calls.includes('https://api.example/public/sites/tenant-1'), true)
    assert.equal(calls.some((url) => url.endsWith('/published')), false)
  })
})

test('unknown tenant on the shared favicon path returns 204 never 404', async () => {
  await withEnv(async () => {
    headerStore.host = 'sites.example.com'
    mockApi({})
    const response = await tenantFavicon(
      new Request('https://sites.example.com/site/missing/favicon.ico'),
      { params: Promise.resolve({ tenantId: 'missing' }) }
    )
    assert.equal(response.status, 204)
    assert.notEqual(response.status, 404)
  })
})

test('non-shared host on the tenant favicon path returns 204', async () => {
  await withEnv(async () => {
    headerStore.host = 'active.example'
    mockApi({
      'https://api.example/public/sites/tenant-1': publishedWithFavicon
    })
    const response = await tenantFavicon(
      new Request('https://active.example/site/tenant-1/favicon.ico'),
      tenantParams
    )
    assert.equal(response.status, 204)
  })
})