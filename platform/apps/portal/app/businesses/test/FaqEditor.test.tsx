import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ upsertHomeFaq: vi.fn() }))
vi.mock('../../../lib/site', () => ({ upsertHomeFaq: mocks.upsertHomeFaq }))

import { FaqEditor } from '../FaqEditor'

const theme = {
  colors: { primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033' },
  headingFont: 'inter' as const, bodyFont: 'inter' as const, cornerStyle: 'soft' as const,
  contentWidth: 'standard' as const, sectionSpacing: 'comfortable' as const
}
const site = (withFaq = false): SiteDefinition => ({
  status: 'DRAFT',
  branding: { siteName: 'Bakery', primaryColor: '#334155', accentColor: '#0f766e' },
  theme,
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
    { id: 'hero', type: 'hero', content: { title: 'Welcome' } },
    ...(withFaq ? [{ id: 'faq' as const, type: 'faq' as const, content: {
      heading: 'Questions', intro: 'Start here.', items: [
        { id: 'first', question: 'First?', answer: 'First answer.' },
        { id: 'second', question: 'Second?', answer: 'Second answer.' }
      ]
    } }] : [])
  ] }]
})

describe('FAQ editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.upsertHomeFaq.mockResolvedValue(site(true))
  })

  it('starts a new FAQ with one required row and validates incomplete content', () => {
    render(<FaqEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" />)
    expect(screen.getByLabelText('Heading')).toHaveValue('Frequently Asked Questions')
    expect(screen.getAllByLabelText('Question')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Remove FAQ item' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('at least one complete question and answer')
    expect(mocks.upsertHomeFaq).not.toHaveBeenCalled()
  })

  it('loads existing content and exposes accessible disabled ordering controls', () => {
    render(<FaqEditor onCancel={() => undefined} onSaved={() => undefined} site={site(true)} tenantId="tenant-1" />)
    expect(screen.getByLabelText('Heading')).toHaveValue('Questions')
    expect(screen.getByLabelText(/Intro/)).toHaveValue('Start here.')
    expect(screen.getAllByLabelText('Question')[0]).toHaveValue('First?')
    expect(screen.getAllByRole('button', { name: 'Move FAQ item up' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Move FAQ item down' })[1]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Remove FAQ item' })[0]).toHaveClass('min-h-11')
  })

  it('adds, edits, removes, reorders, preserves persisted IDs, and saves canonical input', async () => {
    const onSaved = vi.fn()
    render(<FaqEditor onCancel={() => undefined} onSaved={onSaved} site={site(true)} tenantId="tenant-1" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Move FAQ item up' })[1])
    let groups = screen.getAllByRole('group')
    expect(within(groups[0]).getByLabelText('Question')).toHaveValue('Second?')

    fireEvent.click(screen.getByRole('button', { name: 'Add Question' }))
    groups = screen.getAllByRole('group')
    fireEvent.change(within(groups[2]).getByLabelText('Question'), { target: { value: 'Third?' } })
    fireEvent.change(within(groups[2]).getByLabelText('Answer'), { target: { value: 'Third answer.' } })
    fireEvent.click(within(groups[1]).getByRole('button', { name: 'Remove FAQ item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.upsertHomeFaq).toHaveBeenCalledWith('tenant-1', {
      heading: 'Questions', intro: 'Start here.', items: [
        { id: 'second', question: 'Second?', answer: 'Second answer.' },
        { question: 'Third?', answer: 'Third answer.' }
      ]
    }))
    expect(onSaved).toHaveBeenCalledWith(site(true))
  })
})
