import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api'

const mocks = vi.hoisted(() => ({ updateSiteHeader: vi.fn(), updateSiteFooter: vi.fn() }))
vi.mock('../../../lib/site', () => mocks)

import { FooterEditor } from '../FooterEditor'
import { HeaderEditor } from '../HeaderEditor'

const site: SiteDefinition = {
  status: 'DRAFT', branding: { siteName: 'Bakery' }, theme: {
    colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable'
  },
  header: { brandDisplay: 'logo', navigation: { items: [{ pageId: 'home' }] } },
  footer: { showBranding: true, navigationMode: 'header', showBusinessContact: false, showSocialLinks: true, showCopyright: true },
  pages: [{ id: 'home', title: 'Home', slug: '/', sections: [] }, { id: 'about', title: 'About us', slug: 'about', sections: [] }, { id: 'contact', title: 'Contact', slug: 'contact', sections: [] }]
}

describe('Header and Footer editors', () => {
  it('builds a page-id header menu, trims an empty label, validates CTA locally, and saves only allowed CTA data', async () => {
    const saved = structuredClone(site)
    saved.header = { brandDisplay: 'logoAndName', navigation: { items: [{ pageId: 'home' }, { pageId: 'about' }, { pageId: 'contact' }] }, cta: { buttonLabel: 'Email us', action: { type: 'email', value: 'hello@example.com' } } }
    mocks.updateSiteHeader.mockResolvedValue(saved)
    const dirty = vi.fn()
    render(<HeaderEditor onCancel={() => undefined} onDirtyChange={dirty} onPreview={() => undefined} onSaved={() => undefined} site={site} tenantId="tenant-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add all' }))
    const menu = screen.getByRole('list', { name: 'Header navigation items' })
    expect(within(menu).getByText('About us')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview Home' })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Move Contact up'))
    fireEvent.click(screen.getByLabelText('Move Contact down'))
    fireEvent.click(screen.getByLabelText('Remove Contact'))
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add page to Header navigation' })).getByRole('button', { name: /^Contact/ }))
    fireEvent.change(screen.getByLabelText('Display label for About us'), { target: { value: '  ' } })
    fireEvent.click(screen.getByLabelText('Show a header CTA'))
    fireEvent.change(screen.getByLabelText('CTA button label'), { target: { value: 'Email us' } })
    fireEvent.change(screen.getByLabelText('CTA destination'), { target: { value: 'not-an-email' } })
    expect(screen.getByText('The CTA needs a label and a valid destination before it can be saved.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('CTA destination'), { target: { value: ' hello@example.com ' } })
    fireEvent.click(screen.getByLabelText('Logo and name'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteHeader).toHaveBeenCalledWith('tenant-1', saved.header))
    expect(dirty).toHaveBeenCalledWith(true)
  })

  it('keeps a stale header draft and its error after the authoritative server rejects it', async () => {
    mocks.updateSiteHeader.mockRejectedValueOnce(new ApiError(400, { error: 'Header navigation page reference is invalid' }))
    const stale = structuredClone(site)
    stale.pages = stale.pages.filter((page) => page.id !== 'about')
    stale.header = { brandDisplay: 'logo', navigation: { items: [{ pageId: 'about' }] } }
    render(<HeaderEditor onCancel={() => undefined} onPreview={() => undefined} onSaved={() => undefined} site={stale} tenantId="tenant-1" />)
    expect(screen.getByText('Unavailable page')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Display label for unavailable page'), { target: { value: 'Old page' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Header navigation page reference is invalid')).toBeInTheDocument()
    expect(screen.getByLabelText('Display label for unavailable page')).toHaveValue('Old page')
  })

  it('switches Footer navigation modes without copying Header items and saves custom page references', async () => {
    const saved = structuredClone(site)
    saved.footer = { showBranding: false, navigationMode: 'custom', navigationItems: [{ pageId: 'contact' }], showBusinessContact: true, showSocialLinks: false, showCopyright: false, text: 'Fresh every day.' }
    mocks.updateSiteFooter.mockResolvedValue(saved)
    render(<FooterEditor onCancel={() => undefined} onPreview={() => undefined} onSaved={() => undefined} site={site} tenantId="tenant-1" />)
    expect(screen.getByText('The footer will always reuse the current Header navigation. Edit it in Header & Navigation.')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Custom navigation'))
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add page to Footer navigation' })).getByRole('button', { name: /^Contact/ }))
    fireEvent.click(screen.getByLabelText('Show branding'))
    fireEvent.click(screen.getByLabelText('Show business contact'))
    fireEvent.click(screen.getByLabelText('Show social links'))
    fireEvent.click(screen.getByLabelText('Show copyright'))
    fireEvent.change(screen.getByLabelText('Footer text'), { target: { value: 'Fresh every day.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteFooter).toHaveBeenCalledWith('tenant-1', saved.footer))
  })
})
