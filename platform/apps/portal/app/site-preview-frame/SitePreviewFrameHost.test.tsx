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
    { id: 'home', slug: '/', title: 'Home', sections: [{ id: 'hero', type: 'hero', hidden: false, content: { title } }, { id: 'contact', type: 'contact', hidden: false, content: { title: 'Contact', buttonLabel: 'Contact', action: { type: 'leadForm' } } }] },
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

  it('keeps editor lead forms and links inert while reporting internal and section selection', async () => {
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
  })

  it('inserts tenant scoped custom CSS in the iframe document only', async () => {
    render(<SitePreviewFrameHost />)
    deliver({ type: 'INIT', siteDefinition: site(), pageId: 'home' })
    expect(await screen.findByText('Welcome')).toBeInTheDocument()
    expect(document.querySelector('#br-custom-css')).toHaveTextContent('rebeccapurple')
  })
})
