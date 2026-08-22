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

import { BusinessOverview } from '../BusinessWorkspace'
import { SectionCompositionEditor } from '../SectionCompositionEditor'

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
    const moveUp = screen.getByRole('button', { name: 'Move About up' })
    expect(moveUp).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move About down' })).not.toBeDisabled()
    const remove = screen.getByRole('button', { name: 'Remove About' })
    expect(remove).toHaveClass('w-11', 'bg-danger')
    expect(remove.querySelector('svg')).toHaveClass('size-5', 'sm:size-4')
    expect(moveUp.querySelector('span')).toHaveClass('hidden', 'sm:inline')
  })
})
