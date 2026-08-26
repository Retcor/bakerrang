import test from 'node:test'
import assert from 'node:assert/strict'
import { contactMetadata, homeMetadata, localBusinessData, serializeJsonLd } from '../lib/seo.ts'
import { appendSitePath, indexingEnvironmentEnabled, publicIndexingEnabled, resolveSharedPublicOrigin, resolveSiteBaseUrl } from '../lib/siteUrl.ts'

const site = (businessProfile: Record<string, unknown> | undefined = undefined, status = 'PUBLISHED') => ({
  status,
  branding: {
    siteName: 'Acme & Sons',
    primaryColor: '#112233',
    accentColor: '#445566',
    logoMediaId: 'logo',
    logoSrc: 'https://media.example.com/logo.png',
    logoWidth: 400,
    logoHeight: 200
  },
  ...(businessProfile ? { businessProfile } : {}),
  pages: [{
    id: 'home',
    slug: '/',
    title: 'Home',
    sections: [
      { id: 'hero', type: 'hero', content: { title: 'Hero', subtitle: 'Never infer this' } },
      { id: 'contact', type: 'contact', content: { title: 'Contact', buttonLabel: 'Call', action: { type: 'phone', value: '+1 303 555 0123' } } }
    ]
  }]
}) as never

const indexedEnv = {
  SITE_PUBLIC_ORIGIN: 'https://sites.example.com',
  SITE_PUBLIC_INDEXING_ENABLED: 'true'
}

test('site URL resolver validates a true origin and owns the shared-path seam', () => {
  assert.equal(resolveSiteBaseUrl('abc', indexedEnv), 'https://sites.example.com/site/abc')
  assert.equal(appendSitePath('https://sites.example.com/site/abc', '/contact'),
    'https://sites.example.com/site/abc/contact')
  assert.equal(resolveSharedPublicOrigin({ SITE_PUBLIC_ORIGIN: 'https://sites.example.com/' }),
    'https://sites.example.com')
  for (const value of [
    '', 'sites.example.com', 'ftp://sites.example.com', 'https://user@sites.example.com',
    'https://sites.example.com/path', 'https://sites.example.com?q=1', 'https://sites.example.com#x'
  ]) assert.equal(resolveSiteBaseUrl('abc', { SITE_PUBLIC_ORIGIN: value }), null)
})

test('indexing and robots.txt fail closed unless flag and origin are both valid', () => {
  assert.equal(indexingEnvironmentEnabled({ SITE_PUBLIC_INDEXING_ENABLED: 'true' }), true)
  assert.equal(publicIndexingEnabled({}), false)
  assert.equal(publicIndexingEnabled({ SITE_PUBLIC_INDEXING_ENABLED: 'true' }), false)
  assert.equal(publicIndexingEnabled({ ...indexedEnv, SITE_PUBLIC_INDEXING_ENABLED: 'TRUE' }), false)
  assert.equal(publicIndexingEnabled(indexedEnv), true)

})

test('trusted custom canonical hosts do not depend on shared-origin validity', () => {
  assert.equal(resolveSiteBaseUrl('abc', {
    SITE_PUBLIC_ORIGIN: 'invalid'
  }, 'example.com'), 'https://example.com/')
  assert.equal(resolveSiteBaseUrl('abc', indexedEnv, 'bad host'), null)

  const metadata = homeMetadata(site({ phone: '+1 303 555 0123' }), 'abc', {
    SITE_PUBLIC_ORIGIN: 'invalid', SITE_PUBLIC_INDEXING_ENABLED: 'true'
  }, 'example.com')
  assert.deepEqual(metadata.alternates, { canonical: 'https://example.com/' })
  assert.equal(metadata.openGraph?.url, 'https://example.com/')
  assert.deepEqual(metadata.robots, { index: true, follow: true })
  assert.equal(localBusinessData(site({ phone: '+1 303 555 0123' }), 'https://example.com/')?.url,
    'https://example.com/')
})

test('home metadata uses only explicit profile description and social image', () => {
  const metadata = homeMetadata(site({
    description: 'Explicit description',
    socialImageMediaId: 'social',
    socialImageSrc: 'https://media.example.com/social.png',
    socialImageWidth: 1200,
    socialImageHeight: 630
  }), 'abc', indexedEnv)
  assert.equal(metadata.title, 'Acme & Sons')
  assert.equal(metadata.description, 'Explicit description')
  assert.deepEqual(metadata.alternates, { canonical: 'https://sites.example.com/site/abc' })
  assert.equal(metadata.openGraph?.url, 'https://sites.example.com/site/abc')
  assert.deepEqual(metadata.openGraph?.images, [{
    url: 'https://media.example.com/social.png', width: 1200, height: 630
  }])
  assert.equal((metadata.twitter as { card?: string })?.card, 'summary_large_image')
  assert.deepEqual(metadata.robots, { index: true, follow: true })

  const legacy = homeMetadata(site(), 'abc', indexedEnv)
  assert.equal(legacy.description, undefined)
  assert.equal(legacy.openGraph?.description, undefined)
  assert.equal(legacy.openGraph?.images, undefined)
  assert.equal((legacy.twitter as { card?: string })?.card, 'summary')
})

test('preview and invalid-origin metadata are noindex with no inferred presentation copy', () => {
  const preview = homeMetadata(site(undefined, 'DRAFT'), 'abc', indexedEnv)
  assert.deepEqual(preview.robots, { index: false, follow: false })
  assert.equal(preview.description, undefined)
  const invalid = homeMetadata(site({ description: 'Explicit' }), 'abc', {
    SITE_PUBLIC_ORIGIN: 'invalid', SITE_PUBLIC_INDEXING_ENABLED: 'true'
  })
  assert.deepEqual(invalid.robots, { index: false, follow: false })
  assert.equal(invalid.alternates, undefined)
  assert.equal(invalid.openGraph?.url, undefined)
})

test('Contact metadata remains noindex/follow and uses the resolved tenant base', () => {
  const metadata = contactMetadata(site(), 'abc', indexedEnv)
  assert.equal(metadata.title, 'Contact | Acme & Sons')
  assert.deepEqual(metadata.robots, { index: false, follow: true })
  assert.deepEqual(metadata.alternates, {
    canonical: 'https://sites.example.com/site/abc/contact'
  })
  assert.deepEqual(contactMetadata(site(undefined, 'DRAFT'), 'abc', indexedEnv).robots, {
    index: false, follow: false
  })
  assert.deepEqual(contactMetadata(site(), 'abc', {
    SITE_PUBLIC_ORIGIN: 'invalid', SITE_PUBLIC_INDEXING_ENABLED: 'true'
  }).robots, { index: false, follow: false })
})

test('LocalBusiness requires an explicit operational fact and omits empty fields', () => {
  assert.equal(localBusinessData(site(), 'https://sites.example.com/site/abc'), null)
  assert.equal(localBusinessData(site({ description: 'Only copy' }), null), null)
  assert.equal(localBusinessData(site({ socialImageMediaId: 'social', socialImageSrc: 'https://media/social' }), null), null)

  for (const profile of [
    { phone: '+1 303 555 0123' },
    { email: 'public@example.com' },
    { address: { city: 'Denver', country: 'US' } },
    { serviceAreas: ['Denver'] }
  ]) assert.equal(localBusinessData(site(profile), null)?.['@type'], 'LocalBusiness')

  const data = localBusinessData(site({
    description: 'Explicit',
    phone: '+1 303 555 0123',
    address: { line1: '1 Main', line2: 'Suite 2', city: 'Denver', region: 'CO', postalCode: '80202', country: 'US' },
    serviceAreas: ['Denver'],
    socialImageMediaId: 'social',
    socialImageSrc: 'https://media.example.com/social.png'
  }), 'https://sites.example.com/site/abc')
  assert.equal(data?.['@context'], 'https://schema.org')
  assert.equal(data?.description, 'Explicit')
  assert.deepEqual(data?.address, {
    '@type': 'PostalAddress', streetAddress: '1 Main, Suite 2', addressLocality: 'Denver',
    addressRegion: 'CO', postalCode: '80202', addressCountry: 'US'
  })
  assert.deepEqual(data?.areaServed, ['Denver'])
  assert.equal(data?.image, 'https://media.example.com/social.png')
})

test('JSON-LD serialization escapes script-breaking characters without losing quotes', () => {
  const serialized = serializeJsonLd({ value: '</script><tag>&"quoted"' })
  assert.equal(serialized.includes('</script>'), false)
  assert.equal(serialized.includes('<'), false)
  assert.equal(serialized.includes('>'), false)
  assert.equal(serialized.includes('&'), false)
  assert.deepEqual(JSON.parse(serialized), { value: '</script><tag>&"quoted"' })
})
