import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const site: SiteDefinition = {
  status: 'DRAFT',
  branding: { siteName: 'Bakery', primaryColor: '#112233', accentColor: '#445566' },
  theme: {
    colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' },
    headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft',
    contentWidth: 'standard', sectionSpacing: 'comfortable'
  },
  pages: [{
    id: 'home', slug: '/', title: 'Home',
    sections: [{ id: 'hero', type: 'hero', content: { title: 'Welcome' } }]
  }]
}

const mocks = vi.hoisted(() => ({
  getSite: vi.fn(),
  createSitePreviewToken: vi.fn(),
  updateCustomCss: vi.fn()
}))

vi.mock('../../../lib/site', () => ({
  getSite: mocks.getSite,
  createSitePreviewToken: mocks.createSitePreviewToken,
  initializeSite: vi.fn(),
  publishSite: vi.fn(),
  unpublishSite: vi.fn(),
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
    mocks.createSitePreviewToken.mockResolvedValue({ token: 'token value', expiresAt: 1234 })
    mocks.updateCustomCss.mockResolvedValue(site)
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
    const homepageContent = screen.getByRole('heading', { name: 'Homepage content' }).closest('section')
    expect(homepageContent).not.toBeNull()
    expect(within(homepageContent as HTMLElement).getByRole('button', { name: 'Add About' })).toBeInTheDocument()
    expect(within(homepageContent as HTMLElement).getByRole('button', { name: 'Add FAQ' })).toBeInTheDocument()
    fireEvent.click(button)

    expect(sequence).toEqual(['open', 'mint'])
    await waitFor(() => expect(popup.location.href).toBe(
      'https://sites-dev.bakerrang.com/preview/tenant%2Fone?token=token+value'
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
      'href', 'https://sites-dev.bakerrang.com/preview/tenant-1?token=token+value'
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

    const foundation = (await screen.findByRole('heading', { name: 'Site foundation' })).closest('section')
    expect(foundation).not.toBeNull()
    for (const name of ['Branding', 'Theme', 'Business Profile', 'Business Hours', 'Social Profiles', 'Manage Sections']) {
      expect(within(foundation as HTMLElement).getByRole('button', { name })).toBeInTheDocument()
    }
    const advanced = screen.getByRole('heading', { name: 'Advanced' }).closest('section')
    fireEvent.click(within(advanced as HTMLElement).getByRole('button', { name: 'Edit Custom CSS' }))
    fireEvent.change(screen.getByLabelText('Custom CSS'), { target: { value: updated.customCss } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Custom CSS' }))

    await screen.findByText('Changes saved.')
    expect(mocks.updateCustomCss).toHaveBeenCalledWith('tenant-1', { customCss: updated.customCss })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Custom CSS' }))
    expect(screen.getByLabelText('Custom CSS')).toHaveValue(updated.customCss)
  })
})
