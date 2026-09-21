import { useState } from 'react'
import type { TestimonialsContent, TestimonialsSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TestimonialsDraftInspector, testimonialsContentError } from '../TestimonialsDraftInspector'

const section = (items: TestimonialsContent['items'] = [
  { id: 'testimonial-1', customerName: 'Ada', quote: 'The celebration cake was perfect.' },
  { id: 'testimonial-2', customerName: 'Grace', quote: 'Warm service and wonderful bread.' }
]): TestimonialsSection => ({ id: 'testimonials-id', type: 'testimonials', hidden: false, content: { title: 'Testimonials', items } })

function Harness ({ initial = section(), saving = false, onChange = () => {} }: { initial?: TestimonialsSection, saving?: boolean, onChange?: (content: TestimonialsContent) => void }) {
  const [current, setCurrent] = useState(initial)
  return <TestimonialsDraftInspector onChange={(content) => { onChange(content); setCurrent({ ...current, content }) }} saving={saving} section={current} />
}

describe('TestimonialsDraftInspector', () => {
  it('renders the repeated list anatomy, counters, and controlled edit actions', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)

    expect(screen.getByRole('heading', { name: 'Testimonials' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Testimonials')
    expect(screen.getByText('12 / 100')).toBeInTheDocument()
    expect(screen.getByText('2 of 10')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByLabelText('Customer name')).toHaveValue('Ada')
    expect(within(rows[0]!).getByLabelText('Quote')).toHaveValue('The celebration cake was perfect.')
    expect(screen.getAllByText('33 / 1000')).toHaveLength(2)
    expect(within(rows[0]!).getByRole('button', { name: 'Move Ada up' })).toBeDisabled()
    expect(within(rows[1]!).getByRole('button', { name: 'Move Grace down' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Kind words' } })
    expect(screen.getByText('10 / 100')).toBeInTheDocument()
    fireEvent.change(screen.getAllByLabelText('Quote')[0]!, { target: { value: 'Absolutely lovely' } })
    expect(screen.getByText('17 / 1000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Move Grace up' }))
    expect(screen.getAllByLabelText('Customer name')[0]).toHaveValue('Grace')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Grace' }))
    expect(screen.getByText('1 of 10')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add testimonial' }))
    expect(screen.getByText('2 of 10')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Customer name')[1]).toHaveValue('')
    expect(changed).toHaveBeenCalled()
  })

  it('disables Add at 10 items', () => {
    const items = Array.from({ length: 10 }, (_, index) => ({ id: `testimonial-${index}`, customerName: `Customer ${index + 1}`, quote: `Quote ${index + 1}` }))
    render(<Harness initial={section(items)} />)
    expect(screen.getByText('10 of 10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add testimonial' })).toBeDisabled()
    expect(screen.getByText('Maximum of 10 testimonials.')).toBeInTheDocument()
  })

  it('disables every mutation control while saving', () => {
    render(<Harness saving />)
    expect(screen.getByLabelText('Section heading')).toBeDisabled()
    for (const input of screen.getAllByLabelText('Customer name')) expect(input).toBeDisabled()
    for (const input of screen.getAllByLabelText('Quote')) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Grace up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Ada' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add testimonial' })).toBeDisabled()
  })

  it('shows the empty draft state and inline validation while keeping Add available', () => {
    render(<Harness initial={section([])} />)
    expect(screen.getByText('No testimonials yet')).toBeInTheDocument()
    expect(screen.getByText('Add a testimonial to show this section on your site.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one testimonial.')
    expect(screen.getByRole('button', { name: 'Add testimonial' })).toBeEnabled()
    expect(screen.queryByRole('list', { name: 'Testimonial items' })).not.toBeInTheDocument()
  })

  it('mirrors the server content limits for toolbar save gating', () => {
    expect(testimonialsContentError({ title: ' ', items: section().content.items })).toBe('Section heading is required.')
    expect(testimonialsContentError({ title: 'Testimonials', items: [] })).toBe('Add at least one testimonial.')
    expect(testimonialsContentError({ title: 'Testimonials', items: [{ id: 'one', customerName: ' ', quote: 'Good' }] })).toBe('Every testimonial needs a customer name.')
    expect(testimonialsContentError({ title: 'Testimonials', items: [{ id: 'one', customerName: 'Ada', quote: ' ' }] })).toBe('Every testimonial needs a quote.')
    expect(testimonialsContentError({ title: 'Testimonials', items: section().content.items })).toBeNull()
  })
})
