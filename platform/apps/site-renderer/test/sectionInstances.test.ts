import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { PublicHome } from '../components/PublicHome.tsx'

test('renderer honors instance order, repeated types, hidden state, and prefixed unique anchors', () => {
  const site: SiteDefinition = {
    status: 'DRAFT',
    branding: { siteName: 'Bakery' },
    theme: {
      colors: { primary: '#112233', accent: '#445566', background: '#ffffff', text: '#111111' },
      headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable'
    },
    pages: [{
      id: 'home', slug: '/', title: 'Home', sections: [
        { id: 'hero-uuid', type: 'hero', hidden: false, content: { title: 'Hero' } },
        { id: 'gallery-one', type: 'gallery', hidden: false, content: { title: 'First gallery', items: [{ id: 'one', mediaId: 'm1', altText: 'One', src: 'https://example.test/one.png', width: 10, height: 10 }] } },
        { id: 'services-hidden', type: 'services', hidden: true, content: { title: 'Do not render', items: [{ id: 'hidden', name: 'Hidden' }] } },
        { id: 'services-one', type: 'services', hidden: false, content: { title: 'First services', items: [{ id: 's1', name: 'One' }] } },
        { id: 'gallery-two', type: 'gallery', hidden: false, content: { title: 'Second gallery', items: [{ id: 'two', mediaId: 'm2', altText: 'Two', src: 'https://example.test/two.png', width: 10, height: 10 }] } },
        { id: 'services-two', type: 'services', hidden: false, content: { title: 'Second services', items: [{ id: 's2', name: 'Two' }] } }
      ]
    }]
  }
  const html = renderToStaticMarkup(createElement(PublicHome, { site, siteBaseUrl: null, sitePath: '/site/tenant-1' }))
  assert.equal((html.match(/data-br-section="gallery"/g) || []).length, 2)
  assert.equal((html.match(/data-br-section="services"/g) || []).length, 2)
  assert.doesNotMatch(html, /Do not render|services-hidden/)
  assert.match(html, /id="section-gallery-one"/)
  assert.match(html, /id="section-gallery-two"/)
  assert.ok(html.indexOf('First gallery') < html.indexOf('First services'))
  assert.ok(html.indexOf('First services') < html.indexOf('Second gallery'))
  assert.match(html, /href="#section-gallery-one"/)
})

test('expanded sections render semantic themed markup and retain About legacy image order', () => {
  const site: SiteDefinition = {
    status: 'DRAFT', branding: { siteName: 'Bakery' }, theme: { colors: { primary: '#112233', accent: '#445566', background: '#ffffff', text: '#111111' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
    pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
      { id: 'hero', type: 'hero', hidden: false, content: { title: 'Hero' } },
      { id: 'steps', type: 'process', hidden: false, content: { heading: 'Steps', items: [{ id: 'step', title: 'Plan' }] } },
      { id: 'stats', type: 'stats', hidden: false, content: { heading: 'Highlights', items: [{ id: 'stat', value: '24/7', label: 'Support' }] } },
      { id: 'cta', type: 'cta', hidden: false, content: { heading: 'Talk', buttonLabel: 'Email', action: { type: 'email', value: 'hello@example.com' } } },
      { id: 'logos', type: 'logos', hidden: false, content: { heading: 'Trusted', items: [{ id: 'logo', mediaId: 'm', altText: 'Partner', src: 'https://example.test/logo.png', width: 8, height: 4 }] } },
      { id: 'about', type: 'about', hidden: false, content: { heading: 'About', body: 'Body', imageMediaId: 'a', imageAlt: 'About image', imageSrc: 'https://example.test/about.png', imageWidth: 8, imageHeight: 4 } }
    ] }]
  }
  const html = renderToStaticMarkup(createElement(PublicHome, { site, siteBaseUrl: null, sitePath: '/site/tenant-1' }))
  assert.match(html, /data-br-section="process"/); assert.match(html, /<ol/); assert.match(html, /data-br-section="stats"/); assert.match(html, /<dl/)
  assert.match(html, /data-br-role="cta-button"/); assert.match(html, /href="mailto:hello@example.com"/); assert.match(html, /data-br-role="logo"/)
  assert.match(html, /data-br-section="logos"/); assert.match(html, /data-br-section="about"/); assert.doesNotMatch(html, /order-2/)
})
