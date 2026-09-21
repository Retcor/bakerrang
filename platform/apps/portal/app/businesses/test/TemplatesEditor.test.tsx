import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSiteTemplates: vi.fn(), applySiteTemplate: vi.fn() }))
vi.mock('../../../lib/site', () => ({ getSiteTemplates: mocks.getSiteTemplates, applySiteTemplate: mocks.applySiteTemplate }))
import { TemplatesEditor, siteWithTemplatePreview, templateMatchesSite } from '../TemplatesEditor'

const theme = { colors: { primary: '#112233', accent: '#445566', background: '#ffffff', text: '#111111' }, headingFont: 'inter' as const, bodyFont: 'inter' as const, cornerStyle: 'soft' as const, contentWidth: 'standard' as const, sectionSpacing: 'comfortable' as const }
const site: SiteDefinition = { status: 'PUBLISHED', branding: { siteName: 'Bakery' }, theme, customCss: '.hero { color: red }', scopedCustomCss: '[data-br-site] .hero { color: red }', header: { brandDisplay: 'name', navigation: { items: [{ pageId: 'home' }] } }, footer: { showBranding: true, navigationMode: 'custom', navigationItems: [{ pageId: 'home', label: 'Start' }], showBusinessContact: true, showSocialLinks: true, showCopyright: true, text: 'Keep me' }, pages: [{ id: 'home', slug: '/', title: 'Home', seo: { title: 'Keep SEO' }, sections: [{ id: 'hero', type: 'hero', hidden: false, content: { title: 'Keep content' } }] }] }
const templates = [
  { id: 'modern', version: 1, name: 'Modern', description: 'Clean styling.', tags: ['Modern'], preview: { theme, header: { brandDisplay: 'name' as const }, footer: { showBranding: true, showBusinessContact: true, showSocialLinks: true, showCopyright: true } } },
  { id: 'bold', version: 1, name: 'Bold', description: 'Bold styling.', tags: ['Bold'], preview: { theme: { ...theme, colors: { ...theme.colors, primary: '#aa0000' } }, header: { brandDisplay: 'logo' as const }, footer: { showBranding: false, showBusinessContact: false, showSocialLinks: false, showCopyright: false } } }
]

function renderEditor () { const onSaved = vi.fn(); render(<TemplatesEditor onBack={vi.fn()} onSaved={onSaved} site={site} tenantId="tenant/one" />); return { onSaved } }

describe('TemplatesEditor', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getSiteTemplates.mockResolvedValue(templates) })

  it('renders real-site previews, exact preservation copy, and derives Current from owned fields', async () => {
    renderEditor()
    expect(await screen.findByText('Each preview is your real site restyled with that template.')).toBeInTheDocument()
    expect(screen.getByText(/Your pages, words and photos stay exactly as they are/)).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current style' })).toBeDisabled()
    expect(screen.getAllByTitle(/template preview/)).toHaveLength(2)
    expect(screen.getAllByTitle(/template preview/)[0]?.closest('section')).toHaveAttribute('data-preview-mode', 'TEMPLATE_PREVIEW')
    expect(screen.queryByText(/layout/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('heading', { name: 'Bold' }))
    expect(mocks.applySiteTemplate).not.toHaveBeenCalled()
  })

  it('builds previews by changing only template-owned presentation fields', () => {
    const preview = siteWithTemplatePreview(site, templates[1])
    expect(preview.theme).toEqual(templates[1].preview.theme)
    expect(preview.pages).toBe(site.pages)
    expect(preview.customCss).toBe(site.customCss)
    expect(preview.scopedCustomCss).toBe(site.scopedCustomCss)
    expect(preview.header?.navigation).toEqual(site.header?.navigation)
    expect(preview.footer?.navigationMode).toBe('custom')
    expect(preview.footer?.navigationItems).toEqual(site.footer?.navigationItems)
    expect(preview.footer?.text).toBe('Keep me')
    expect(templateMatchesSite(preview, templates[1])).toBe(true)
    expect(templateMatchesSite({ ...preview, theme: { ...preview.theme, cornerStyle: 'rounded' } }, templates[1])).toBe(false)
  })

  it('removes the derived Current badge after a Theme-owned field changes', async () => {
    const props = { onBack: vi.fn(), onSaved: vi.fn(), tenantId: 'tenant/one' }
    const { rerender } = render(<TemplatesEditor {...props} site={site} />)
    expect(await screen.findByText('Current')).toBeInTheDocument()
    rerender(<TemplatesEditor {...props} site={{ ...site, theme: { ...site.theme, cornerStyle: 'rounded' } }} />)
    expect(screen.queryByText('Current')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Apply template' })).toHaveLength(2)
  })

  it('sends current content and scoped Custom CSS through TEMPLATE_PREVIEW', async () => {
    renderEditor()
    const frame = await screen.findByTitle('Bold template preview') as HTMLIFrameElement
    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')
    // Re-dispatch inside waitFor: under load the frame's window `message` listener may not be
    // attached the instant we fire, and a one-shot READY would be lost (the READY→INIT handshake
    // is guarded by readySourceRef, so extra dispatches are harmless once it lands).
    await waitFor(() => {
      fireEvent(window, new MessageEvent('message', { origin: window.location.origin, source: frame.contentWindow, data: { type: 'READY' } }))
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'INIT',
        mode: 'TEMPLATE_PREVIEW',
        siteDefinition: expect.objectContaining({ customCss: site.customCss, scopedCustomCss: site.scopedCustomCss, pages: site.pages })
      }), window.location.origin)
    })
  })

  it('confirms once and installs the canonical response', async () => {
    const canonical = siteWithTemplatePreview(site, templates[1])
    mocks.applySiteTemplate.mockResolvedValue(canonical)
    const { onSaved } = renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Apply template' }))
    const dialog = screen.getByRole('dialog', { name: 'Apply “Bold”?' })
    expect(dialog).toHaveTextContent('keeps every page, section, word, photo, page SEO setting, branding detail, Business Profile value, Custom CSS rule, navigation item, lead, and Media Library asset')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply Template' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(canonical))
    expect(mocks.applySiteTemplate).toHaveBeenCalledOnce()
    expect(mocks.applySiteTemplate).toHaveBeenCalledWith('tenant/one', 'bold')
  })

  it('retries catalog and reports apply failures without leaving the tool', async () => {
    mocks.getSiteTemplates.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(templates)
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apply template' }))
    mocks.applySiteTemplate.mockRejectedValueOnce(new Error('failed'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply Template' }))
    expect(await screen.findByText('Unable to apply this template. Please try again.')).toBeInTheDocument()
  })
})
