import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PREVIEW_FORM_MESSAGE, submitLeadForContext } from '../lib/leadPreview.ts'
import { fetchPreviewSite } from '../lib/siteApi.ts'
import { previewHostAllowed, previewMetadata, previewPath, resolvePreviewMetadata } from '../lib/preview.ts'

test('preview host gate accepts only the configured shared renderer origin', () => {
  const env = { SITE_PUBLIC_ORIGIN: 'https://sites.example.com' }
  assert.equal(previewHostAllowed('sites.example.com', env), true)
  assert.equal(previewHostAllowed('sites.example.com:443', env), true)
  assert.equal(previewHostAllowed('customer.example', env), false)
  assert.equal(previewHostAllowed('sites.example.com', {}), false)
})

test('preview API forwards bearer authorization, disables caching, and maps auth or absence to null', async () => {
  const originalFetch = globalThis.fetch
  const originalBase = process.env.SITE_API_BASE_URL
  process.env.SITE_API_BASE_URL = 'https://api.example'
  const calls: Array<{ url: string, init?: RequestInit }> = []
  const workingTheme = {
    colors: { primary: '#112233', accent: '#445566', background: '#ffffff', text: '#111111' },
    headingFont: 'lora', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'wide',
    sectionSpacing: 'spacious'
  }
  try {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init })
      if (String(input).endsWith('/tenant-1')) return Response.json({ status: 'DRAFT', theme: workingTheme, pages: [] })
      return new Response(null, { status: String(input).endsWith('/expired') ? 401 : 404 })
    }) as typeof fetch

    assert.deepEqual(await fetchPreviewSite('tenant-1', 'secret token'), {
      status: 'DRAFT', theme: workingTheme, pages: []
    })
    assert.equal(calls[0].url, 'https://api.example/public/preview/tenant-1')
    assert.deepEqual(calls[0].init, {
      cache: 'no-store', headers: { authorization: 'Bearer secret token' }
    })
    assert.equal(await fetchPreviewSite('expired', 'token'), null)
    assert.equal(await fetchPreviewSite('missing', 'token'), null)
  } finally {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.SITE_API_BASE_URL
    else process.env.SITE_API_BASE_URL = originalBase
  }
})

test('preview metadata is noindex, nofollow, no-referrer, and has no canonical or OG URL', () => {
  const metadata = previewMetadata()
  assert.deepEqual(metadata.robots, { index: false, follow: false })
  assert.equal(metadata.referrer, 'no-referrer')
  assert.equal(metadata.alternates, undefined)
  assert.equal(metadata.openGraph, undefined)
  assert.equal(Object.hasOwn(metadata, 'icons'), false)
})

const workingFaviconSite = {
  status: 'DRAFT',
  branding: { siteName: 'Working', faviconSrc: 'https://media.example.com/working-favicon.png' },
  pages: []
} as never

const previewProps = (token?: string) => ({
  params: Promise.resolve({ tenantId: 'tenant-1' }),
  searchParams: Promise.resolve(token ? { token } : {})
})

test('previewMetadata includes working icons when faviconSrc is set', () => {
  const metadata = previewMetadata('Website Preview', workingFaviconSite)
  assert.deepEqual(metadata.icons, { icon: 'https://media.example.com/working-favicon.png' })
})

test('preview navigation paths preserve the token on home and contact', () => {
  assert.equal(previewPath('tenant/one', 'a b'), '/preview/tenant%2Fone?token=a+b')
  assert.equal(previewPath('tenant/one', 'a b', true), '/preview/tenant%2Fone/contact?token=a+b')
})

test('preview contact is explicitly inert while published lead submission code remains present', async () => {
  assert.equal(PREVIEW_FORM_MESSAGE, "This is a preview — the form isn't active.")
  let submissions = 0
  const submit = async () => { submissions += 1 }
  assert.equal(await submitLeadForContext(true, submit), PREVIEW_FORM_MESSAGE)
  assert.equal(submissions, 0)
  assert.equal(await submitLeadForContext(false, submit), null)
  assert.equal(submissions, 1)
  const source = await readFile(fileURLToPath(new URL('../components/LeadForm.tsx', import.meta.url)), 'utf8')
  assert.match(source, /if \(preview\)[\s\S]*submitLeadForContext\(true[\s\S]*return/)
  assert.match(source, /submitLeadForContext\(false/)
})

test('preview routes are dynamic, use the preview API, and contain no domain redirect path', async () => {
  for (const relative of [
    '../app/preview/[tenantId]/page.tsx',
    '../app/preview/[tenantId]/contact/page.tsx'
  ]) {
    const source = await readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
    assert.match(source, /dynamic = 'force-dynamic'/)
    assert.match(source, /getPreviewSite/)
    assert.doesNotMatch(source, /Redirect|getTenantDomain|resolveRequestDomain/)
  }
})

const previewSiteState: { impl: (tenantId: string, token: string) => Promise<unknown> } = {
  impl: async () => null
}

mock.module('../lib/api.ts', {
  namedExports: {
    getPreviewSite: (tenantId: string, token: string) => previewSiteState.impl(tenantId, token),
    getPublicSite: async () => null,
    getPublishedSite: async () => null
  }
})
mock.module('../components/PreviewFrame.tsx', {
  namedExports: { PreviewFrame: () => null }
})
mock.module('../components/PublicHome.tsx', {
  namedExports: { PublicHome: () => null }
})
mock.module('../components/PublicContact.tsx', {
  namedExports: { PublicContact: () => null }
})

test('resolvePreviewMetadata includes working favicon icons and swallows missing or failed preview loads', async () => {
  previewSiteState.impl = async () => workingFaviconSite
  const withIcons = await resolvePreviewMetadata(previewProps('secret'))
  assert.deepEqual(withIcons.icons, { icon: 'https://media.example.com/working-favicon.png' })

  const missingToken = await resolvePreviewMetadata(previewProps())
  assert.equal(Object.hasOwn(missingToken, 'icons'), false)

  previewSiteState.impl = async () => null
  const missingSite = await resolvePreviewMetadata(previewProps('secret'))
  assert.equal(Object.hasOwn(missingSite, 'icons'), false)

  previewSiteState.impl = async () => { throw new Error('Unable to load site preview') }
  const failed = await resolvePreviewMetadata(previewProps('secret'))
  assert.equal(Object.hasOwn(failed, 'icons'), false)
})

test('preview page generateMetadata functions use working faviconSrc and do not throw', async () => {
  const { generateMetadata: homeGenerateMetadata } = await import('../app/preview/[tenantId]/page.tsx')
  const { generateMetadata: contactGenerateMetadata } = await import('../app/preview/[tenantId]/contact/page.tsx')

  previewSiteState.impl = async () => workingFaviconSite
  const home = await homeGenerateMetadata(previewProps('secret'))
  assert.deepEqual(home.icons, { icon: 'https://media.example.com/working-favicon.png' })
  const contact = await contactGenerateMetadata(previewProps('secret'))
  assert.deepEqual(contact.icons, { icon: 'https://media.example.com/working-favicon.png' })
  assert.equal(contact.title, 'Contact Preview')

  const homeMissingToken = await homeGenerateMetadata(previewProps())
  assert.equal(Object.hasOwn(homeMissingToken, 'icons'), false)
  const contactMissingToken = await contactGenerateMetadata(previewProps())
  assert.equal(Object.hasOwn(contactMissingToken, 'icons'), false)
  assert.equal(contactMissingToken.title, 'Contact Preview')

  previewSiteState.impl = async () => null
  const homeNull = await homeGenerateMetadata(previewProps('secret'))
  assert.equal(Object.hasOwn(homeNull, 'icons'), false)
  const contactNull = await contactGenerateMetadata(previewProps('secret'))
  assert.equal(Object.hasOwn(contactNull, 'icons'), false)
})