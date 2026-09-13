import assert from 'node:assert/strict'
import test from 'node:test'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { resolveSiteNavigation } from '../lib/navigation.ts'

const site = (): SiteDefinition => ({
  status: 'PUBLISHED',
  branding: { siteName: 'Bakery' },
  theme: {
    colors: { primary: '#111111', accent: '#222222', background: '#ffffff', text: '#000000' },
    headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable'
  },
  header: {
    brandDisplay: 'logo',
    navigation: { items: [{ pageId: 'services' }, { pageId: 'home', label: 'Welcome' }] },
    cta: { buttonLabel: 'Email us', action: { type: 'email', value: 'hello@example.com' } }
  },
  footer: { showBranding: true, navigationMode: 'custom', navigationItems: [{ pageId: 'home' }], showBusinessContact: false, showSocialLinks: true, showCopyright: true },
  pages: [
    { id: 'home', slug: '/', title: 'Home', sections: [] },
    { id: 'services', slug: 'services', title: 'Services', sections: [] }
  ]
})

test('navigation resolves Page identities, current state, labels, and all route contexts centrally', () => {
  const definition = site()
  const services = definition.pages[1]
  assert.deepEqual(resolveSiteNavigation(definition, services, { kind: 'customDomain' }), {
    homeHref: '/',
    headerItems: [
      { pageId: 'services', label: 'Services', href: '/services', current: true },
      { pageId: 'home', label: 'Welcome', href: '/', current: false }
    ],
    footerItems: [{ pageId: 'home', label: 'Home', href: '/', current: false }]
  })
  assert.equal(resolveSiteNavigation(definition, services, { kind: 'sharedHost', tenantId: 'tenant-1' }).headerItems[0].href, '/site/tenant-1/services')
  const preview = resolveSiteNavigation(definition, services, { kind: 'preview', tenantId: 'tenant-1', token: 'preview-token' })
  assert.equal(preview.homeHref, '/preview/tenant-1?token=preview-token')
  assert.equal(preview.headerItems[0].href, '/preview/tenant-1/page/services?token=preview-token')
})

test('Header navigation never derives from sections and Footer header mode reuses the resolved Header collection', () => {
  const definition = site()
  definition.pages[1].sections = [{ id: 'contact', type: 'contact', hidden: false, content: { title: 'Contact', buttonLabel: 'Contact', action: { type: 'email', value: 'hello@example.com' } } }]
  definition.header!.navigation.items = []
  definition.footer!.navigationMode = 'header'
  const resolved = resolveSiteNavigation(definition, definition.pages[1], { kind: 'customDomain' })
  assert.deepEqual(resolved.headerItems, [])
  assert.deepEqual(resolved.footerItems, [])
})
