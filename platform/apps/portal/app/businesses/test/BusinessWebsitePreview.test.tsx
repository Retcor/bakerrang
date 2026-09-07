import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const site: SiteDefinition = {
  status: 'DRAFT',
  branding: { siteName: 'Bakery' },
  theme: {
    colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' },
    headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft',
    contentWidth: 'standard', sectionSpacing: 'comfortable'
  },
  pages: [{
    id: 'home', slug: '/', title: 'Home',
    sections: [{ id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Welcome' } }]
  }]
}

const mocks = vi.hoisted(() => ({
  getSite: vi.fn(),
  getSiteDomain: vi.fn(),
  createSitePreviewToken: vi.fn(),
  updateCustomCss: vi.fn(),
  publishSite: vi.fn(),
  unpublishSite: vi.fn()
}))

const navigation = vi.hoisted(() => ({
  pathname: '/businesses/tenant-1/website',
  search: '',
  replace: vi.fn()
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search)
}))

vi.mock('../../../lib/site', () => ({
  getSite: mocks.getSite,
  getSiteDomain: mocks.getSiteDomain,
  createSitePreviewToken: mocks.createSitePreviewToken,
  initializeSite: vi.fn(),
  publishSite: mocks.publishSite,
  unpublishSite: mocks.unpublishSite,
  updateBusinessProfile: vi.fn(),
  updateHomeHero: vi.fn(),
  upsertHomeAbout: vi.fn(),
  upsertHomeFaq: vi.fn(),
  updateHomeServices: vi.fn(),
  updateHomeContact: vi.fn(),
  updateHomeGallery: vi.fn(),
  updateHomeTestimonials: vi.fn(),
  updateHomeComposition: vi.fn(),
  updateSiteBranding: vi.fn(),
  updateSiteTheme: vi.fn(),
  updateCustomCss: mocks.updateCustomCss
}))

import { BusinessWebsite } from '../BusinessWebsite'

describe('working-site preview launch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SITE_PREVIEW_ORIGIN', 'https://sites-dev.bakerrang.com')
    mocks.getSite.mockResolvedValue(site)
    mocks.getSiteDomain.mockResolvedValue(null)
    mocks.createSitePreviewToken.mockResolvedValue({ token: 'token value', expiresAt: 1234 })
    mocks.updateCustomCss.mockResolvedValue(site)
    mocks.publishSite.mockResolvedValue({ ...site, status: 'PUBLISHED', hasUnpublishedChanges: false, lastPublishedAt: 100 })
    mocks.unpublishSite.mockResolvedValue(site)
    navigation.pathname = '/businesses/tenant-1/website'
    navigation.search = ''
  })

  it('shows Preview changes only for an initialized site and opens before minting', async () => {
    const sequence: string[] = []
    const popup = { close: vi.fn(), location: { href: 'about:blank' }, opener: window }
    vi.spyOn(window, 'open').mockImplementation(() => {
      sequence.push('open')
      return popup as unknown as Window
    })
    mocks.createSitePreviewToken.mockImplementation(async () => {
      sequence.push('mint')
      return { token: 'token value', expiresAt: 1234 }
    })

    render(<BusinessWebsite autoLoad tenantId="tenant/one" />)
    const button = await screen.findByRole('button', { name: 'Preview changes' })
    expect(screen.getByRole('heading', { name: 'Website Overview' })).toBeInTheDocument()
    expect(screen.getByText('1 page · 1 section')).toBeInTheDocument()
    fireEvent.click(button)

    expect(sequence).toEqual(['open', 'mint'])
    await waitFor(() => expect(popup.location.href).toBe(
      'https://sites-dev.bakerrang.com/preview/tenant%2Fone/page/home?token=token+value'
    ))
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank')
    expect(popup.opener).toBeNull()
  })

  it('closes the temporary tab and shows an error when minting fails', async () => {
    const popup = { close: vi.fn(), location: { href: 'about:blank' }, opener: window }
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    mocks.createSitePreviewToken.mockRejectedValueOnce(new Error('failed'))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Preview changes' }))
    await screen.findByText('Unable to open the website preview. Please try again.')
    expect(popup.close).toHaveBeenCalledOnce()
  })

  it('still mints a fresh token and exposes a clickable fallback when popups are blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Preview changes' }))
    const fallback = await screen.findByRole('link', { name: 'Open preview' })
    expect(fallback).toHaveAttribute(
      'href', 'https://sites-dev.bakerrang.com/preview/tenant-1/page/home?token=token+value'
    )
    expect(mocks.createSitePreviewToken).toHaveBeenCalledWith('tenant-1')
  })

  it('mints a fresh token for each repeated Preview click', async () => {
    const popups = [
      { close: vi.fn(), location: { href: 'about:blank' }, opener: window },
      { close: vi.fn(), location: { href: 'about:blank' }, opener: window }
    ]
    vi.spyOn(window, 'open')
      .mockReturnValueOnce(popups[0] as unknown as Window)
      .mockReturnValueOnce(popups[1] as unknown as Window)
    mocks.createSitePreviewToken
      .mockResolvedValueOnce({ token: 'first-token', expiresAt: 1234 })
      .mockResolvedValueOnce({ token: 'second-token', expiresAt: 2345 })

    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Preview changes' }))
    await waitFor(() => expect(popups[0].location.href).toContain('token=first-token'))

    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }))
    await waitFor(() => expect(popups[1].location.href).toContain('token=second-token'))

    expect(mocks.createSitePreviewToken).toHaveBeenCalledTimes(2)
    expect(popups[0].opener).toBeNull()
    expect(popups[1].opener).toBeNull()
  })

  it('keeps existing editors available and integrates Custom CSS under Advanced', async () => {
    const updated: SiteDefinition = {
      ...site,
      customCss: '[data-br-site] { color: rebeccapurple; }',
      scopedCustomCss: '[data-br-tenant="tenant-1"] [data-br-site] { color: rebeccapurple; }'
    }
    mocks.updateCustomCss.mockResolvedValue(updated)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)

    const desktopNav = await screen.findByRole('navigation', { name: 'Website editor navigation' })
    for (const name of ['Branding', 'Theme', 'Business Profile', 'Business Hours', 'Social Profiles', 'Pages']) {
      expect(within(desktopNav).getByRole('button', { name })).toBeInTheDocument()
    }
    const advanced = within(desktopNav).getByRole('heading', { name: 'Advanced' }).closest('section')
    fireEvent.click(within(advanced as HTMLElement).getByRole('button', { name: 'Custom CSS' }))
    fireEvent.change(screen.getByLabelText('Custom CSS'), { target: { value: updated.customCss } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Changes saved.')
    expect(mocks.updateCustomCss).toHaveBeenCalledWith('tenant-1', { customCss: updated.customCss })
    expect(screen.getByLabelText('Custom CSS')).toHaveValue(updated.customCss)
    expect(navigation.replace).toHaveBeenCalledWith('/businesses/tenant-1/website?editor=customCss', { scroll: false })
    expect(mocks.getSite).toHaveBeenCalledTimes(1)
  })
})
