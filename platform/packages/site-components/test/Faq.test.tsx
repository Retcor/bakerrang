import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Faq } from '../src/Faq'

describe('Faq', () => {
  it('renders answers as primary body text', () => {
    render(<Faq anchorId="faq" content={{
      heading: 'Frequently asked questions',
      items: [{ id: 'delivery', question: 'Do you deliver?', answer: 'Yes, within the local area.' }]
    }} />)

    const answer = screen.getByText('Yes, within the local area.')
    expect(answer.className.split(/\s+/)).toContain('text-site-fg')
    expect(answer.className.split(/\s+/)).not.toContain('text-site-muted')
  })
})
