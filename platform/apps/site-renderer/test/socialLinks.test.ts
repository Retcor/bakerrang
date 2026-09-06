import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { isSafeSocialUrl } from '../../../packages/site-components/src/socialLinks.ts'
import { localBusinessData } from '../lib/seo.ts'

const source = async (relative: string) => readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
const links = [
  { platform: 'instagram', url: 'https://instagram.com/example' },
  { platform: 'facebook', url: 'https://facebook.com/example' },
  { platform: 'linkedin', url: 'https://linkedin.com/company/example' },
  { platform: 'youtube', url: 'https://youtube.com/@example' },
  { platform: 'tiktok', url: 'https://tiktok.com/@example' },
  { platform: 'x', url: 'https://x.com/example' }
] as const

const site = (socialLinks: unknown, operational = true) => ({
  status: 'PUBLISHED',
  branding: { siteName: 'Bakery' },
  businessProfile: {
    ...(operational ? { phone: '+1 303 555 0100' } : {}),
    ...(socialLinks !== undefined ? { socialLinks } : {})
  },
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
    { id: 'hero', type: 'hero', content: { title: 'Welcome' } }
  ] }]
}) as never

test('Footer receives canonical profile links and renders restrained safe accessible icons in array order', async () => {
  const shell = await source('../../../packages/site-components/src/SiteShell.tsx')
  const footer = await source('../../../packages/site-components/src/SiteFooter.tsx')
  assert.match(shell, /socialLinks=\{site\.businessProfile\?\.socialLinks\}/)
  assert.match(footer, /safeSocialLinks\.map\(\(link\) => <a/)
  assert.match(footer, /aria-label=\{socialLabels\[link\.platform\]\}/)
  assert.match(footer, /href=\{link\.url\}/)
  assert.match(footer, /rel="noopener noreferrer"/)
  assert.match(footer, /target="_blank"/)
  assert.match(footer, /safeSocialLinks\.length > 0/)
  assert.match(footer, /aria-label="Social profiles"/)
  assert.match(footer, /flex flex-col gap-4 sm:items-end/)
  for (const platform of ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x']) {
    assert.match(footer, new RegExp(`platform === '${platform}'|${platform}:`))
  }
  assert.doesNotMatch(footer, />\{link\.url\}</)
})

test('Footer URL defense permits only absolute HTTPS social destinations', () => {
  assert.equal(isSafeSocialUrl('https://instagram.com/example'), true)
  for (const value of [undefined, '', 'https:', 'http://example.com', 'javascript:alert(1)', 'data:text/plain,x', 'mailto:a@b.com', '/relative']) {
    assert.equal(isSafeSocialUrl(value), false)
  }
})

test('LocalBusiness sameAs preserves canonical order and omits unsafe, missing, empty, and social-only data', () => {
  assert.deepEqual(localBusinessData(site(links), null)?.sameAs, links.map((link) => link.url))
  assert.equal(localBusinessData(site(undefined), null)?.sameAs, undefined)
  assert.equal(localBusinessData(site([]), null)?.sameAs, undefined)
  assert.deepEqual(localBusinessData(site([
    { platform: 'instagram', url: 'javascript:alert(1)' },
    { platform: 'facebook', url: 'https://facebook.com/valid' },
    { platform: 'x', url: 'http://x.com/unsafe' }
  ]), null)?.sameAs, ['https://facebook.com/valid'])
  assert.equal(localBusinessData(site(links, false), null), null)
})
