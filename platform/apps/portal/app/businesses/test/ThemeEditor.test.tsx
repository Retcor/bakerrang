import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateSiteTheme: vi.fn(),
  updateSiteBranding: vi.fn(),
  getMedia: vi.fn(async () => ({ media: [], hasMore: false })),
  uploadMedia: vi.fn()
}))

vi.mock('../../../lib/site', () => ({
  updateSiteTheme: mocks.updateSiteTheme,
  updateSiteBranding: mocks.updateSiteBranding
}))
vi.mock('../../../lib/media', () => ({
  getMedia: mocks.getMedia,
  uploadMedia: mocks.uploadMedia
}))

import { BrandingEditor } from '../BrandingEditor'
import { ThemeEditor } from '../ThemeEditor'

const site: SiteDefinition = {
  status: 'PUBLISHED',
  branding: { siteName: 'Bakery', primaryColor: '#112233', accentColor: '#445566' },
  theme: {
    colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' },
    headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft',
    contentWidth: 'standard', sectionSpacing: 'comfortable'
  },
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [] }]
}

describe('Theme editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMedia.mockResolvedValue({ media: [], hasMore: false })
    mocks.updateSiteTheme.mockResolvedValue(site)
  })

  it('loads current values and synchronizes color picker and hex controls', () => {
    render(<ThemeEditor onCancel={() => undefined} onSaved={() => undefined} site={site} tenantId="tenant-1" />)
    expect(screen.getByLabelText('Primary color hex')).toHaveValue('#112233')
    fireEvent.change(screen.getByLabelText('Primary color picker'), { target: { value: '#abcdef' } })
    expect(screen.getByLabelText('Primary color hex')).toHaveValue('#abcdef')
    fireEvent.change(screen.getByLabelText('Accent color hex'), { target: { value: '#123456' } })
    expect(screen.getByLabelText('Accent color picker')).toHaveValue('#123456')
  })

  it('rejects invalid hex client-side', () => {
    render(<ThemeEditor onCancel={() => undefined} onSaved={() => undefined} site={site} tenantId="tenant-1" />)
    fireEvent.change(screen.getByLabelText('Primary color hex'), { target: { value: 'rgb(0,0,0)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Colors must use the #RRGGBB format.')
    expect(mocks.updateSiteTheme).not.toHaveBeenCalled()
  })

  it('saves colors, fonts, corner style, width, and spacing and returns the result', async () => {
    const onSaved = vi.fn()
    render(<ThemeEditor onCancel={() => undefined} onSaved={onSaved} site={site} tenantId="tenant-1" />)
    fireEvent.change(screen.getByLabelText('Primary color hex'), { target: { value: '#AABBCC' } })
    fireEvent.change(screen.getByLabelText('Heading font'), { target: { value: 'playfair' } })
    fireEvent.change(screen.getByLabelText('Body font'), { target: { value: 'lora' } })
    fireEvent.click(screen.getByLabelText('rounded'))
    fireEvent.click(screen.getByLabelText('wide'))
    fireEvent.click(screen.getByLabelText('spacious'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSiteTheme).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      colors: expect.objectContaining({ primary: '#aabbcc' }),
      headingFont: 'playfair', bodyFont: 'lora', cornerStyle: 'rounded',
      contentWidth: 'wide', sectionSpacing: 'spacious'
    })))
    expect(onSaved).toHaveBeenCalledWith(site)
  })

  it('Reset changes only the form and low contrast warns without blocking Save', async () => {
    render(<ThemeEditor onCancel={() => undefined} onSaved={() => undefined} site={site} tenantId="tenant-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(screen.getByLabelText('Primary color hex')).toHaveValue('#334155')
    expect(mocks.updateSiteTheme).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Background color hex'), { target: { value: '#777777' } })
    fireEvent.change(screen.getByLabelText('Text color hex'), { target: { value: '#777777' } })
    expect(screen.getByText('This text may be difficult to read on the selected background.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteTheme).toHaveBeenCalledOnce())
  })

  it('Branding is identity-only and exposes no color controls', async () => {
    render(<BrandingEditor onCancel={() => undefined} onSaved={() => undefined} site={site} tenantId="tenant-1" />)
    await waitFor(() => expect(mocks.getMedia).toHaveBeenCalled())
    expect(screen.getByLabelText('Site Name')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Primary Color/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Accent Color/i)).not.toBeInTheDocument()
  })
})
