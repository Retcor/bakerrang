import type { SiteDefinition } from '@bakerrang/site-schema'
import { describe, expect, it } from 'vitest'
import { isSitePreviewChildMessage, isSitePreviewParentMessage } from '../sitePreviewFrameProtocol'

const site = { pages: [{ id: 'home', slug: '/', title: 'Home', sections: [] }] } as unknown as SiteDefinition

describe('site preview frame protocol', () => {
  it('accepts only typed render payloads with a real page', () => {
    expect(isSitePreviewParentMessage({ type: 'INIT', siteDefinition: site, pageId: 'home' })).toBe(true)
    expect(isSitePreviewParentMessage({ type: 'UPDATE_SITE', siteDefinition: site, pageId: 'missing' })).toBe(false)
    expect(isSitePreviewParentMessage({ type: 'RUN_COMMAND', command: 'alert(1)' })).toBe(false)
  })

  it('accepts only the READY handshake and prepared selection events', () => {
    expect(isSitePreviewChildMessage({ type: 'READY' })).toBe(true)
    expect(isSitePreviewChildMessage({ type: 'PAGE_SELECTED', pageId: 'services' })).toBe(true)
    expect(isSitePreviewChildMessage({ type: 'SECTION_SELECTED', sectionId: 'hero' })).toBe(true)
    expect(isSitePreviewChildMessage({ type: 'NAVIGATE', href: 'https://example.com' })).toBe(false)
  })
})
