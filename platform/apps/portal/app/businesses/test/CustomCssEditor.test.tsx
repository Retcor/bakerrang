import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api'

const mocks = vi.hoisted(() => ({ updateCustomCss: vi.fn() }))
vi.mock('../../../lib/site', () => ({ updateCustomCss: mocks.updateCustomCss }))

import { CUSTOM_CSS_MAX_BYTES, CustomCssEditor, customCssByteLength } from '../CustomCssEditor'

const theme = {
  colors: { primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033' },
  headingFont: 'inter' as const, bodyFont: 'inter' as const, cornerStyle: 'soft' as const,
  contentWidth: 'standard' as const, sectionSpacing: 'comfortable' as const
}

const site = (customCss?: string, scopedCustomCss?: string): SiteDefinition => ({
  status: 'DRAFT',
  branding: { siteName: 'Bakery' },
  theme,
  ...(customCss === undefined ? {} : { customCss }),
  ...(scopedCustomCss === undefined ? {} : { scopedCustomCss }),
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
    { id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Welcome' } }
  ] }]
})

describe('Custom CSS editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts empty and requires an explicit edit before saving', () => {
    render(<CustomCssEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" />)
    expect(screen.getByLabelText('Custom CSS')).toHaveValue('')
    expect(screen.getByText('0 bytes / 20 KB')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('loads only canonical raw CSS and never the derived scoped CSS', () => {
    const raw = '/* raw */\n[data-br-site] { color: red; }'
    const scoped = '[data-br-tenant="tenant-1"] { color: blue; }'
    render(<CustomCssEditor onCancel={() => undefined} onSaved={() => undefined} site={site(raw, scoped)} tenantId="tenant-1" />)
    expect(screen.getByLabelText('Custom CSS')).toHaveValue(raw)
    expect(screen.getByLabelText('Custom CSS')).not.toHaveValue(scoped)
  })

  it('saves raw CSS byte-for-byte and returns the full server definition without changing theme', async () => {
    const raw = '/* keep spaces */\n[data-br-site] { color: red; }  \n'
    const returned = site(raw, '[data-br-site]{color:red}')
    mocks.updateCustomCss.mockResolvedValue(returned)
    const onSaved = vi.fn()
    render(<CustomCssEditor onCancel={() => undefined} onSaved={onSaved} site={site()} tenantId="tenant/one" />)
    fireEvent.change(screen.getByLabelText('Custom CSS'), { target: { value: raw } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateCustomCss).toHaveBeenCalledWith('tenant/one', { customCss: raw }))
    expect(onSaved).toHaveBeenCalledWith(returned)
    expect(returned.theme).toEqual(theme)
  })

  it('Clear changes local state only, then Save sends the canonical null removal', async () => {
    const initial = '[data-br-site] { color: red; }'
    const returned = site()
    mocks.updateCustomCss.mockResolvedValue(returned)
    render(<CustomCssEditor onCancel={() => undefined} onSaved={() => undefined} site={site(initial)} tenantId="tenant-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByLabelText('Custom CSS')).toHaveValue('')
    expect(screen.getByText('Cleared locally. Save Custom CSS to remove it from Preview.')).toBeInTheDocument()
    expect(mocks.updateCustomCss).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateCustomCss).toHaveBeenCalledWith('tenant-1', { customCss: null }))
  })

  it('surfaces server policy errors directly and preserves the unsaved textarea', async () => {
    const raw = '[data-br-site] { background: url(https://example.com/a.png); }'
    mocks.updateCustomCss.mockRejectedValue(new ApiError(400, { error: 'Remote CSS resources are not allowed.' }))
    render(<CustomCssEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" />)
    fireEvent.change(screen.getByLabelText('Custom CSS'), { target: { value: raw } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Remote CSS resources are not allowed.')
    expect(screen.getByLabelText('Custom CSS')).toHaveValue(raw)
  })

  it('counts UTF-8 bytes and disables Save only after the 20 KB limit', () => {
    const withinLimit = 'é'.repeat(CUSTOM_CSS_MAX_BYTES / 2)
    const overLimit = `${withinLimit}é`
    expect(customCssByteLength(withinLimit)).toBe(CUSTOM_CSS_MAX_BYTES)
    expect(customCssByteLength(overLimit)).toBe(CUSTOM_CSS_MAX_BYTES + 2)

    render(<CustomCssEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" />)
    fireEvent.change(screen.getByLabelText('Custom CSS'), { target: { value: withinLimit } })
    expect(screen.getByText(`${CUSTOM_CSS_MAX_BYTES} bytes / 20 KB`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Custom CSS'), { target: { value: overLimit } })
    expect(screen.getByText(`${CUSTOM_CSS_MAX_BYTES + 2} bytes / 20 KB — Limit exceeded`)).toBeInTheDocument()
    expect(screen.getByText('Custom CSS exceeds the 20 KB UTF-8 limit. Reduce it before saving.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('documents supported stable selectors and keeps long content contained', () => {
    render(<CustomCssEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" />)
    fireEvent.click(screen.getByText('Stable selector reference'))
    for (const selector of [
      '[data-br-site]', '[data-br-section="hero"]', '[data-br-section="faq"]',
      '[data-br-section="businessHours"]', '[data-br-role="card"]', '[data-br-role="form"]'
    ]) expect(screen.getByText(selector)).toBeInTheDocument()
    expect(screen.getByText('Example CSS').closest('details')).toHaveClass('min-w-0')
    expect(screen.getByLabelText('Custom CSS')).toHaveClass('max-w-full', 'overflow-x-auto')
  })
})
