import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AddSectionPanel } from '../AddSectionPanel'

const site: SiteDefinition = {
  status: 'DRAFT',
  branding: { siteName: 'Bakery' },
  theme: { colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
    { id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Welcome' } },
    { id: 'contact-id', type: 'contact', hidden: false, content: { title: 'Talk to us', buttonLabel: 'Email', action: { type: 'email', value: 'hello@example.com' } } }
  ] }]
}

describe('AddSectionPanel', () => {
  it('uses the shared addability policy and exposes truthful disabled reasons', () => {
    render(<AddSectionPanel onBack={() => undefined} onChoose={() => undefined} pageId="home" site={site} />)
    expect(screen.getByRole('heading', { name: 'Add a section' })).toBeInTheDocument()
    expect(screen.queryByText('Hero')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Contact.*Configure this page/i })).toBeDisabled()
    expect(screen.getByText('Already added')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Business Hours.*Present the global/i })).toBeDisabled()
    expect(screen.getByText('Set a weekly schedule in Site setup first')).toBeInTheDocument()
  })

  it('only delegates a choice or Back to its owner', () => {
    const onBack = vi.fn()
    const onChoose = vi.fn()
    render(<AddSectionPanel onBack={onBack} onChoose={onChoose} pageId="home" site={site} />)
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    expect(onChoose).toHaveBeenCalledWith('gallery')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
