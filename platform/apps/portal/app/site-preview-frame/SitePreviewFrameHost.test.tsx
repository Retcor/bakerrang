import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PREVIEW_FORM_MESSAGE } from '@bakerrang/site-runtime'
import { SitePreviewFrameHost } from './SitePreviewFrameHost'

const site = (title = 'Welcome'): SiteDefinition => ({
  status: 'DRAFT',
  branding: { siteName: 'Bakery' },
  theme: { colors: { primary: '#112233', accent: '#445566', background: '#ffffff', text: '#111111' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
  header: { brandDisplay: 'name', navigation: { items: [{ pageId: 'services' }] }, cta: { buttonLabel: 'Visit', action: { type: 'url', value: 'https://example.com' } } },
  pages: [
    { id: 'home', slug: '/', title: 'Home', sections: [{ id: 'hero', type: 'hero', hidden: false, content: { title } }, { id: 'cta', type: 'cta', hidden: false, content: { heading: 'Ready?', buttonLabel: 'Email bakery', action: { type: 'email', value: 'hello@example.com' } } }, { id: 'contact', type: 'contact', hidden: false, content: { title: 'Contact', buttonLabel: 'Contact', action: { type: 'leadForm' } } }] },
    { id: 'services', slug: 'services', title: 'Services', sections: [] }
  ],
  scopedCustomCss: '[data-br-site]{color:rebeccapurple}'
})

const deliver = (data: unknown, origin = window.location.origin) => fireEvent(window, new MessageEvent('message', { origin, data }))

describe('site-preview-frame host', () => {
  it('announces READY only after mounting its parent-message listener', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage')
    render(<SitePreviewFrameHost />)
    expect(postMessage).toHaveBeenCalledWith({ type: 'READY' }, window.location.origin)

    deliver({ type: 'INIT', siteDefinition: site(), pageId: 'home' })
    expect(screen.getByText('Welcome')).toBeInTheDocument()
  })

  it('renders only postMessage-delivered site data, updates it, and never fetches site data', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    render(<SitePreviewFrameHost />)
    expect(screen.queryByText('Welcome')).toBeNull()
    deliver({ type: 'INIT', siteDefinition: site(), pageId: 'home' })
    expect(await screen.findByText('Welcome')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    deliver({ type: 'UPDATE_SITE', siteDefinition: site('Updated'), pageId: 'home' })
    expect(await screen.findByText('Updated')).toBeInTheDocument()
  })

  it('ignores invalid-origin and unknown messages', () => {
    render(<SitePreviewFrameHost />)
    deliver({ type: 'INIT', siteDefinition: site(), pageId: 'home' }, 'https://elsewhere.example')
    deliver({ type: 'UNKNOWN', siteDefinition: site(), pageId: 'home' })
    expect(screen.queryByText('Welcome')).toBeNull()
  })

  it('in EDITOR mode intercepts iframe navigation while reporting internal and section selection', async () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage')
    render(<SitePreviewFrameHost />)
    deliver({ type: 'INIT', siteDefinition: site(), pageId: 'home' })
    await screen.findByText('Welcome')

    fireEvent.submit(document.querySelector('form[data-br-role="form"]') as HTMLFormElement)
    expect(await screen.findByText(PREVIEW_FORM_MESSAGE)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('link', { name: 'Services' })[0] as HTMLAnchorElement)
    expect(postMessage).toHaveBeenCalledWith({ type: 'PAGE_SELECTED', pageId: 'services' }, window.location.origin)
    fireEvent.click(screen.getByText('Welcome'))
    expect(postMessage).toHaveBeenCalledWith({ type: 'SECTION_SELECTED', sectionId: 'hero' }, window.location.origin)

    const external = screen.getByRole('link', { name: 'Visit' })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    external.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)

    const cta = screen.getByRole('link', { name: 'Email bakery' })
    const ctaClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    cta.dispatchEvent(ctaClick)
    expect(ctaClick.defaultPrevented).toBe(true)
  })

  it('renders and updates editor-only selection chrome from the existing preview message', async () => {
    render(<SitePreviewFrameHost />)
    deliver({ type: 'INIT', siteDefinition: site(), pageId: 'home', selectedSectionId: 'hero' })
    expect(await screen.findByText('Hero • selected')).toBeInTheDocument()
    expect(document.querySelector('[data-br-editor-selection="hero"] [data-br-editor-selection-outline]')).toHaveStyle({ border: '2px solid #ffd500' })

    deliver({ type: 'UPDATE_SITE', siteDefinition: site(), pageId: 'home', selectedSectionId: 'contact' })
    expect(await screen.findByText('Contact • selected')).toBeInTheDocument()
    expect(document.querySelector('[data-br-editor-selection="hero"]')).toBeNull()
    expect(document.querySelector('[data-br-editor-selection="contact"]')).toBeInTheDocument()
  })

  it('inserts tenant scoped custom CSS in the iframe document only', async () => {
    render(<SitePreviewFrameHost />)
    deliver({ type: 'INIT', siteDefinition: site(), pageId: 'home' })
    expect(await screen.findByText('Welcome')).toBeInTheDocument()
    expect(document.querySelector('#br-custom-css')).toHaveTextContent('rebeccapurple')
  })

  it.each(['TEMPLATE_PREVIEW', 'WORKING_PREVIEW'] as const)('keeps %s read-only without editor selection chrome or callbacks', async (mode) => {
    const postMessage = vi.spyOn(window.parent, 'postMessage')
    const fetch = vi.spyOn(globalThis, 'fetch')
    render(<SitePreviewFrameHost />)
    deliver({ type: 'INIT', siteDefinition: site(), pageId: 'home', selectedSectionId: 'hero', mode })
    expect(await screen.findByText('Welcome')).toBeInTheDocument()
    expect(screen.queryByText('Hero • selected')).not.toBeInTheDocument()
    postMessage.mockClear()
    fetch.mockClear()
    fireEvent.submit(document.querySelector('form[data-br-role="form"]') as HTMLFormElement)
    fireEvent.click(screen.getByText('Welcome'))
    fireEvent.click(screen.getAllByRole('link', { name: 'Services' })[0] as HTMLAnchorElement)
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SECTION_SELECTED' }), expect.anything())
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'PAGE_SELECTED' }), expect.anything())
    expect(fetch).not.toHaveBeenCalled()
  })
})
