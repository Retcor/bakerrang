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
import { THEME_PRESETS } from '../../../lib/themePresets'
import { previewForeground, themeColorContrast } from '../../../lib/theme'

const site: SiteDefinition = {
  status: 'PUBLISHED',
  branding: { siteName: 'Bakery' },
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

  it('renders every curated preset and applies one only to the local Theme form', () => {
    render(<ThemeEditor onCancel={() => undefined} onSaved={() => undefined} site={site} tenantId="tenant-1" />)
    for (const preset of THEME_PRESETS) expect(screen.getByRole('button', { name: `Apply ${preset.name}` })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Apply Midnight' }))
    expect(screen.getByLabelText('Primary color hex')).toHaveValue('#60a5fa')
    expect(screen.getByLabelText('Background color hex')).toHaveValue('#111827')
    expect(screen.getByLabelText('Heading font')).toHaveValue('montserrat')
    expect(mocks.updateSiteTheme).not.toHaveBeenCalled()
  })

  it('keeps every curated preset within valid Theme choices and readable derived colors', () => {
    const fonts = new Set(['inter', 'poppins', 'montserrat', 'workSans', 'lora', 'merriweather', 'playfair', 'sourceSerif'])
    const corners = new Set(['rounded', 'soft', 'square'])
    const widths = new Set(['narrow', 'standard', 'wide'])
    const spacings = new Set(['compact', 'comfortable', 'spacious'])

    for (const { theme } of THEME_PRESETS) {
      for (const value of Object.values(theme.colors)) expect(value).toMatch(/^#[0-9a-f]{6}$/)
      expect(fonts.has(theme.headingFont)).toBe(true)
      expect(fonts.has(theme.bodyFont)).toBe(true)
      expect(corners.has(theme.cornerStyle)).toBe(true)
      expect(widths.has(theme.contentWidth)).toBe(true)
      expect(spacings.has(theme.sectionSpacing)).toBe(true)
      expect(themeColorContrast(theme.colors.text, theme.colors.background)).toBeGreaterThanOrEqual(4.5)
      expect(themeColorContrast(theme.colors.primary, previewForeground(theme.colors.primary))).toBeGreaterThanOrEqual(4.5)
      expect(themeColorContrast(theme.colors.accent, previewForeground(theme.colors.accent))).toBeGreaterThanOrEqual(4.5)
    }

    const midnight = THEME_PRESETS.find(({ name }) => name === 'Midnight')!.theme
    expect(midnight.colors.background).toBe('#111827')
  })

  it('confirms a dirty preset overwrite, preserves edits when canceled, then saves the customized normal Theme object', async () => {
    const onSaved = vi.fn()
    render(<ThemeEditor onCancel={() => undefined} onSaved={onSaved} site={site} tenantId="tenant-1" />)
    fireEvent.change(screen.getByLabelText('Primary color hex'), { target: { value: '#abcdef' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply Classic' }))
    expect(screen.getByRole('dialog', { name: 'Apply Classic theme?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByLabelText('Primary color hex')).toHaveValue('#abcdef')
    fireEvent.click(screen.getByRole('button', { name: 'Apply Classic' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply preset' }))
    expect(screen.getByLabelText('Primary color hex')).toHaveValue('#6b4f3b')
    fireEvent.change(screen.getByLabelText('Body font'), { target: { value: 'lora' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteTheme).toHaveBeenCalledWith('tenant-1', {
      ...THEME_PRESETS.find((preset) => preset.name === 'Classic')!.theme,
      bodyFont: 'lora'
    }))
    expect(onSaved).toHaveBeenCalledWith(site)
    expect(JSON.stringify(mocks.updateSiteTheme.mock.calls[0]?.[1])).not.toContain('preset')
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
