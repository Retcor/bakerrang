import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SitePreviewFrame } from '../SitePreviewFrame'

const site = (title = 'Welcome'): SiteDefinition => ({
  status: 'DRAFT',
  branding: { siteName: 'Bakery' },
  theme: { colors: { primary: '#112233', accent: '#445566', background: '#ffffff', text: '#111111' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [{ id: 'hero', type: 'hero', hidden: false, content: { title } }] }]
})

const ready = (frame: HTMLIFrameElement, origin = window.location.origin, source: MessageEventSource | null = frame.contentWindow) =>
  fireEvent(window, new MessageEvent('message', { data: { type: 'READY' }, origin, source }))

describe('Portal SitePreviewFrame', () => {
  it('waits for READY, then sends exactly one INIT with the current hydrated site', () => {
    const { rerender } = render(<SitePreviewFrame pageId="home" site={site()} />)
    const frame = screen.getByTitle('Website preview') as HTMLIFrameElement
    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')
    expect(postMessage).not.toHaveBeenCalled()

    const latest = site('Latest before handshake')
    rerender(<SitePreviewFrame pageId="home" site={latest} />)
    expect(postMessage).not.toHaveBeenCalled()
    ready(frame)
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenCalledWith({ type: 'INIT', siteDefinition: latest, pageId: 'home', mode: 'EDITOR' }, window.location.origin)

    ready(frame)
    expect(postMessage).toHaveBeenCalledTimes(1)
  })

  it('keeps the READY source when load follows the handshake and sends later selection updates', () => {
    const currentSite = site()
    const { rerender } = render(<SitePreviewFrame pageId="home" selectedSectionId="hero" site={currentSite} />)
    const frame = screen.getByTitle('Website preview') as HTMLIFrameElement
    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')
    ready(frame)
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'INIT', siteDefinition: currentSite, pageId: 'home', mode: 'EDITOR', selectedSectionId: 'hero' }, window.location.origin)

    fireEvent.load(frame)
    expect(postMessage).toHaveBeenCalledTimes(1)
    rerender(<SitePreviewFrame pageId="home" selectedSectionId="about" site={currentSite} />)
    expect(postMessage).toHaveBeenCalledTimes(2)
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'UPDATE_SITE', siteDefinition: currentSite, pageId: 'home', mode: 'EDITOR', selectedSectionId: 'about' }, window.location.origin)
  })

  it('sends the active editor section through the established preview update channel', () => {
    const { rerender } = render(<SitePreviewFrame pageId="home" selectedSectionId="hero" site={site()} />)
    const frame = screen.getByTitle('Website preview') as HTMLIFrameElement
    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')
    ready(frame)
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'INIT', siteDefinition: site(), pageId: 'home', mode: 'EDITOR', selectedSectionId: 'hero' }, window.location.origin)

    rerender(<SitePreviewFrame pageId="home" selectedSectionId={undefined} site={site()} />)
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'UPDATE_SITE', siteDefinition: site(), pageId: 'home', mode: 'EDITOR' }, window.location.origin)
  })

  it('ignores READY from another origin or a same-origin window other than the iframe', () => {
    render(<SitePreviewFrame pageId="home" site={site()} />)
    const frame = screen.getByTitle('Website preview') as HTMLIFrameElement
    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')
    ready(frame, 'https://elsewhere.example')
    ready(frame, window.location.origin, window)
    expect(postMessage).not.toHaveBeenCalled()

    ready(frame)
    expect(postMessage).toHaveBeenCalledTimes(1)
  })

  it('accepts only same-origin typed selection events from the expected iframe', () => {
    const pageSelected = vi.fn()
    const sectionSelected = vi.fn()
    render(<SitePreviewFrame onPageSelected={pageSelected} onSectionSelected={sectionSelected} pageId="home" site={site()} />)
    const frame = screen.getByTitle('Website preview') as HTMLIFrameElement
    const send = (data: unknown, origin = window.location.origin, source: MessageEventSource | null = frame.contentWindow) =>
      fireEvent(window, new MessageEvent('message', { origin, data, source }))
    send({ type: 'PAGE_SELECTED', pageId: 'other' }, 'https://elsewhere.example')
    send({ type: 'UNKNOWN' })
    send({ type: 'PAGE_SELECTED', pageId: 'other' }, window.location.origin, window)
    expect(pageSelected).not.toHaveBeenCalled()
    expect(sectionSelected).not.toHaveBeenCalled()

    send({ type: 'PAGE_SELECTED', pageId: 'services' })
    send({ type: 'SECTION_SELECTED', sectionId: 'hero' })
    expect(pageSelected).toHaveBeenCalledWith('services')
    expect(sectionSelected).toHaveBeenCalledWith('hero')
  })

  it('keeps scoped custom CSS out of the Portal parent document', () => {
    render(<SitePreviewFrame pageId="home" site={{ ...site(), scopedCustomCss: '[data-br-site]{color:rebeccapurple}' }} />)
    expect(document.querySelector('#br-custom-css')).toBeNull()
  })

  it('sends non-editor modes and ignores selection messages in read-only previews', () => {
    const pageSelected = vi.fn()
    const sectionSelected = vi.fn()
    render(<SitePreviewFrame mode="TEMPLATE_PREVIEW" onPageSelected={pageSelected} onSectionSelected={sectionSelected} pageId="home" selectedSectionId="hero" site={site()} title="Template preview" />)
    const frame = screen.getByTitle('Template preview') as HTMLIFrameElement
    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')
    ready(frame)
    expect(postMessage).toHaveBeenCalledWith({ type: 'INIT', siteDefinition: site(), pageId: 'home', mode: 'TEMPLATE_PREVIEW' }, window.location.origin)
    fireEvent(window, new MessageEvent('message', { origin: window.location.origin, source: frame.contentWindow, data: { type: 'SECTION_SELECTED', sectionId: 'hero' } }))
    expect(pageSelected).not.toHaveBeenCalled()
    expect(sectionSelected).not.toHaveBeenCalled()
  })
})
