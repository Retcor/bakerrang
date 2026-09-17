import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const site: SiteDefinition = { status: 'DRAFT', branding: { siteName: 'Bakery' }, theme: { colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' }, pages: [{ id: 'home', slug: '/', title: 'Home', sections: [{ id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Welcome' } }] }] }
const mocks = vi.hoisted(() => ({ getSite: vi.fn(), getSiteDomain: vi.fn(), createSitePreviewToken: vi.fn(), publishSite: vi.fn(), unpublishSite: vi.fn() }))
const navigation = vi.hoisted(() => ({ pathname: '/businesses/tenant-1/website', search: '', replace: vi.fn() }))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ replace: navigation.replace }), useSearchParams: () => new URLSearchParams(navigation.search) }))
vi.mock('../../../lib/site', () => ({ ...mocks, initializeSite: vi.fn(), updateSectionContent: vi.fn(), updateBusinessProfile: vi.fn(), updateHomeHero: vi.fn(), upsertHomeAbout: vi.fn(), upsertHomeFaq: vi.fn(), updateHomeServices: vi.fn(), updateHomeContact: vi.fn(), updateHomeGallery: vi.fn(), updateHomeTestimonials: vi.fn(), updateHomeComposition: vi.fn(), updateSiteBranding: vi.fn(), updateSiteTheme: vi.fn(), updateBusinessHours: vi.fn(), updateSocialLinks: vi.fn(), updateCustomCss: vi.fn(), updatePage: vi.fn(), updateSiteHeader: vi.fn(), updateSiteFooter: vi.fn(), updateSiteSeo: vi.fn(), updatePageSeo: vi.fn(), getSiteTemplates: vi.fn(), applySiteTemplate: vi.fn(), getSiteRevisions: vi.fn(), restoreSiteRevision: vi.fn() }))

import { BusinessWebsite } from '../BusinessWebsite'

describe('working-site preview launch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SITE_PREVIEW_ORIGIN', 'https://sites-dev.bakerrang.com')
    mocks.getSite.mockResolvedValue(site)
    mocks.getSiteDomain.mockResolvedValue(null)
    mocks.createSitePreviewToken.mockResolvedValue({ token: 'token value', expiresAt: 1234 })
    mocks.publishSite.mockResolvedValue(site)
    mocks.unpublishSite.mockResolvedValue(site)
  })

  it('opens an independent working-site preview from the canvas toolbar', async () => {
    const popup = { close: vi.fn(), location: { href: 'about:blank' }, opener: window }
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    render(<BusinessWebsite autoLoad tenantId="tenant/one" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }))
    await waitFor(() => expect(popup.location.href).toBe('https://sites-dev.bakerrang.com/preview/tenant%2Fone/page/home?token=token+value'))
    expect(mocks.createSitePreviewToken).toHaveBeenCalledWith('tenant/one')
    expect(popup.opener).toBeNull()
  })
})
