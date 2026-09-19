import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { PREVIEW_FORM_MESSAGE, SectionRenderer, SitePageRenderer, canInterceptNavigation, resolveSiteNavigation, submitLeadForContext } from '../src/index.ts'

const site = (): SiteDefinition => ({
  status: 'PUBLISHED',
  branding: { siteName: 'Bakery' },
  theme: { colors: { primary: '#112233', accent: '#445566', background: '#ffffff', text: '#111111' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
  header: { brandDisplay: 'logo', navigation: { items: [{ pageId: 'services' }, { pageId: 'home', label: 'Welcome' }] } },
  footer: { showBranding: true, navigationMode: 'custom', navigationItems: [{ pageId: 'home' }], showBusinessContact: false, showSocialLinks: true, showCopyright: true },
  pages: [
    { id: 'home', slug: '/', title: 'Home', sections: [
      { id: 'hero-one', type: 'hero', hidden: false, content: { title: 'Hero' } },
      { id: 'hidden-services', type: 'services', hidden: true, content: { title: 'Hidden', items: [] } },
      { id: 'services-one', type: 'services', hidden: false, content: { title: 'Services', items: [{ id: 'service', name: 'Cakes' }] } }
    ] },
    { id: 'services', slug: 'services', title: 'Services page', sections: [] }
  ]
})

test('SectionRenderer dispatches known section types to the shared visual components', () => {
  const html = renderToStaticMarkup(createElement(SectionRenderer, { section: site().pages[0].sections[0] }))
  assert.match(html, /data-br-section="hero"/)
  assert.match(html, /Hero/)
})

test('SitePageRenderer preserves section visibility and source order', () => {
  const definition = site()
  const html = renderToStaticMarkup(createElement(SitePageRenderer, {
    context: { mode: 'PUBLIC', navigation: { kind: 'customDomain' } }, page: definition.pages[0], site: definition
  }))
  assert.doesNotMatch(html, /Hidden|hidden-services/)
  assert.ok(html.indexOf('data-br-section="hero"') < html.indexOf('data-br-section="services"'))
  assert.match(html, /data-br-section="services"/)
})

test('navigation retains custom-domain, shared-host, and preview paths', () => {
  const definition = site()
  const activePage = definition.pages[1]
  assert.equal(resolveSiteNavigation(definition, activePage, { kind: 'customDomain' }).headerItems[0].href, '/services')
  assert.equal(resolveSiteNavigation(definition, activePage, { kind: 'sharedHost', tenantId: 'tenant-1' }).headerItems[0].href, '/site/tenant-1/services')
  assert.equal(resolveSiteNavigation(definition, activePage, { kind: 'preview', tenantId: 'tenant-1', token: 'a b' }).headerItems[0].href, '/preview/tenant-1/page/services?token=a%20b')
})

test('PUBLIC navigation remains server-renderable while editor navigation may intercept', () => {
  const publicContext = { mode: 'PUBLIC' as const, navigation: { kind: 'customDomain' as const }, onSelectPage: () => undefined }
  const editorContext = { ...publicContext, mode: 'EDITOR' as const }
  assert.equal(canInterceptNavigation(publicContext), false)
  assert.equal(canInterceptNavigation(editorContext), true)

  const html = renderToStaticMarkup(createElement(SitePageRenderer, { context: publicContext, page: site().pages[0], site: site() }))
  assert.match(html, /href="\/services"/)
  assert.doesNotMatch(html, /data-br-editor-selection|selected<\/span>/)
})

test('selected-section chrome is emitted only for the EDITOR render mode', () => {
  const definition = site()
  const context = { mode: 'EDITOR' as const, navigation: { kind: 'customDomain' as const }, onSelectSection: () => undefined, selectedSectionId: 'hero-one' }
  const editorHtml = renderToStaticMarkup(createElement(SitePageRenderer, { context, page: definition.pages[0], site: definition }))
  assert.match(editorHtml, /data-br-editor-selection="hero-one"/)
  assert.match(editorHtml, /Hero • selected/)

  const previewHtml = renderToStaticMarkup(createElement(SitePageRenderer, { context: { ...context, mode: 'WORKING_PREVIEW' as const }, page: definition.pages[0], site: definition }))
  assert.doesNotMatch(previewHtml, /data-br-editor-selection|selected<\/span>/)
})

test('PUBLIC lead submissions retain their side effect while editor modes are inert', async () => {
  let submissions = 0
  const submit = async () => { submissions += 1 }
  assert.equal(await submitLeadForContext('PUBLIC', submit), null)
  assert.equal(submissions, 1)
  assert.equal(await submitLeadForContext('EDITOR', submit), PREVIEW_FORM_MESSAGE)
  assert.equal(await submitLeadForContext('WORKING_PREVIEW', submit), PREVIEW_FORM_MESSAGE)
  assert.equal(await submitLeadForContext('TEMPLATE_PREVIEW', submit), PREVIEW_FORM_MESSAGE)
  assert.equal(submissions, 1)
})

test('runtime source is independent of apps, server, and storage infrastructure', async () => {
  const src = path.join(import.meta.dirname, '..', 'src')
  const files = await readdir(src)
  const source = await Promise.all(files.filter((file) => file.endsWith('.ts') || file.endsWith('.tsx')).map(async (file) => readFile(path.join(src, file), 'utf8')))
  assert.doesNotMatch(source.join('\n'), /apps\/(portal|site-renderer)|from ['"](?:\.\.\/)+server|Firestore|GCS|tenant storage/i)
})
