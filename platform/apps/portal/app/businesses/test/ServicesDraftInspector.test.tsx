import { useState } from 'react'
import type { ServicesContent, ServicesSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ServicesDraftInspector } from '../ServicesDraftInspector'

const section = (items: ServicesContent['items'] = [
  { id: 'service-1', name: 'Cakes', description: 'Celebration cakes' },
  { id: 'service-2', name: 'Catering', description: '' }
]): ServicesSection => ({ id: 'services-id', type: 'services', hidden: false, content: { title: 'Services', items } })

function Harness ({ initial = section(), saving = false, onChange = () => {} }: { initial?: ServicesSection, saving?: boolean, onChange?: (content: ServicesContent) => void }) {
  const [current, setCurrent] = useState(initial)
  return <ServicesDraftInspector onChange={(content) => { onChange(content); setCurrent({ ...current, content }) }} saving={saving} section={current} />
}

describe('ServicesDraftInspector', () => {
  it('renders the approved list anatomy, counters, and controlled edit actions', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)

    expect(screen.getByRole('heading', { name: 'Services' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Services')
    expect(screen.getByText('8 / 100')).toBeInTheDocument()
    expect(screen.getByText('2 of 20')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByRole('button', { name: 'Move Cakes up' })).toBeDisabled()
    expect(within(rows[1]!).getByRole('button', { name: 'Move Catering down' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'What we make' } })
    expect(screen.getByText('12 / 100')).toBeInTheDocument()
    fireEvent.change(screen.getAllByLabelText(/Description/)[0]!, { target: { value: 'Handmade every morning' } })
    expect(screen.getByText('22 / 500')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Move Catering up' }))
    expect(within(screen.getAllByRole('listitem')[0]!).getByLabelText('Name')).toHaveValue('Catering')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Catering' }))
    expect(screen.getByText('1 of 20')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add service' }))
    expect(screen.getByText('2 of 20')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Name')[1]).toHaveValue('')
    expect(changed).toHaveBeenCalled()
  })

  it('disables Add at 20 items', () => {
    const items = Array.from({ length: 20 }, (_, index) => ({ id: `service-${index}`, name: `Service ${index + 1}` }))
    render(<Harness initial={section(items)} />)
    expect(screen.getByText('20 of 20')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add service' })).toBeDisabled()
    expect(screen.getByText('Maximum of 20 services.')).toBeInTheDocument()
  })

  it('disables every control while saving', () => {
    render(<Harness saving />)
    expect(screen.getByLabelText('Section heading')).toBeDisabled()
    for (const input of screen.getAllByLabelText('Name')) expect(input).toBeDisabled()
    for (const input of screen.getAllByLabelText(/Description/)) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Catering up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Cakes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add service' })).toBeDisabled()
  })

  it('shows the empty draft state and inline validation while keeping Add available', () => {
    render(<Harness initial={section([])} />)
    expect(screen.getByText('No services yet')).toBeInTheDocument()
    expect(screen.getByText('Add a service to show this section on your site.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one service.')
    expect(screen.getByRole('button', { name: 'Add service' })).toBeEnabled()
    expect(screen.queryByRole('list', { name: 'Service items' })).not.toBeInTheDocument()
  })
})
