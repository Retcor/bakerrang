import type { AnchorHTMLAttributes, ReactNode } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode, href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>
}))
vi.mock('../../_shell/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>
}))
vi.mock('../../../lib/media', () => ({ getMedia: vi.fn().mockResolvedValue({ media: [], hasMore: false }), uploadMedia: vi.fn() }))

import { BusinessOverview } from '../BusinessWorkspace'
import { GalleryEditor } from '../GalleryEditor'
import { SectionCompositionEditor } from '../SectionCompositionEditor'
import { ServicesEditor } from '../ServicesEditor'
import { TestimonialsEditor } from '../TestimonialsEditor'

describe('business workspace polish', () => {
  it('uses action-specific business overview links', () => {
    render(<BusinessOverview tenantId="bakery-1" />)

    expect(screen.getByRole('link', { name: /Manage website/ })).toHaveAttribute('href', '/businesses/bakery-1/website')
    expect(screen.getByRole('link', { name: /Review leads/ })).toHaveAttribute('href', '/businesses/bakery-1/leads')
    expect(screen.getByRole('link', { name: /Manage domain/ })).toHaveAttribute('href', '/businesses/bakery-1/domain')
  })

  it('gives narrow section controls accessible names and touch-sized buttons', () => {
    const site: SiteDefinition = {
      status: 'DRAFT',
      branding: { siteName: 'Bakery', primaryColor: '#112233', accentColor: '#445566' },
      theme: {
        colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' },
        headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft',
        contentWidth: 'standard', sectionSpacing: 'comfortable'
      },
      pages: [{
        id: 'home',
        slug: '/',
        title: 'Home',
        sections: [
          { id: 'hero', type: 'hero', content: { title: 'Welcome' } },
          { id: 'about', type: 'about', content: { heading: 'About', body: 'Our story.' } },
          { id: 'services', type: 'services', content: { title: 'Services', items: [] } },
          { id: 'faq', type: 'faq', content: { heading: 'FAQ', items: [{ id: 'faq-1', question: 'When?', answer: 'Today.' }] } },
          { id: 'contact', type: 'contact', content: { title: 'Contact', buttonLabel: 'Contact', action: { type: 'leadForm' } } }
        ]
      }]
    }
    render(<SectionCompositionEditor onCancel={() => undefined} onSaved={() => undefined} site={site} tenantId="bakery-1" />)

    expect(screen.getByText('About')).toBeInTheDocument()
    expect(screen.getByText('FAQ')).toBeInTheDocument()
    const moveUp = screen.getAllByRole('button', { name: 'Move homepage section up' })[0]
    expect(moveUp).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Move homepage section down' })[0]).not.toBeDisabled()
    const remove = screen.getAllByRole('button', { name: 'Remove homepage section' })[0]
    expect(remove).toHaveClass('min-h-11', 'min-w-11', 'bg-danger')
    expect(remove.querySelector('svg')).toHaveClass('size-5')
    expect(remove.querySelector('svg')).not.toHaveClass('sm:size-4')
    expect(screen.getByText('Fixed')).toBeInTheDocument()
  })

  it('standardizes list-editor controls without adding Services reordering', () => {
    const site: SiteDefinition = {
      status: 'DRAFT',
      branding: { siteName: 'Bakery', primaryColor: '#112233', accentColor: '#445566' },
      theme: {
        colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' },
        headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable'
      },
      pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
        { id: 'hero', type: 'hero', content: { title: 'Welcome' } },
        { id: 'services', type: 'services', content: { title: 'Services', items: [{ id: 'service-1', name: 'Cakes' }] } },
        { id: 'testimonials', type: 'testimonials', content: { title: 'Testimonials', items: [{ id: 'quote-1', customerName: 'A', quote: 'Great' }, { id: 'quote-2', customerName: 'B', quote: 'Lovely' }] } },
        { id: 'gallery', type: 'gallery', content: { title: 'Gallery', items: [{ id: 'image-1', mediaId: 'media-1', altText: 'Cake' }, { id: 'image-2', mediaId: 'media-2', altText: 'Bread' }] } }
      ] }]
    }
    const common = { onCancel: () => undefined, onSaved: () => undefined, site, tenantId: 'bakery-1' }

    const services = render(<ServicesEditor {...common} />)
    expect(screen.getByRole('button', { name: 'Remove service' })).toHaveClass('min-h-11', 'min-w-11')
    expect(screen.queryByRole('button', { name: /Move service/ })).not.toBeInTheDocument()
    services.unmount()

    const testimonials = render(<TestimonialsEditor {...common} />)
    expect(screen.getAllByRole('button', { name: 'Move testimonial up' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Move testimonial down' })[1]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Remove testimonial' })[0].querySelector('svg')).toHaveClass('size-5')
    testimonials.unmount()

    render(<GalleryEditor {...common} />)
    expect(screen.getAllByRole('button', { name: 'Move gallery image up' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Move gallery image down' })[1]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Remove gallery image' })[0]).toHaveClass('min-h-11', 'min-w-11')
  })
})
