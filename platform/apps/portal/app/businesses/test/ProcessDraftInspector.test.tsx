import { useState } from 'react'
import type { ProcessContent, ProcessSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProcessDraftInspector, processContentError } from '../ProcessDraftInspector'

const section = (items: ProcessContent['items'] = [
  { id: 'step-choose', title: 'Choose', description: 'Pick a favorite.' },
  { id: 'step-order', title: 'Order' }
], heading = 'How it works', intro = 'Three simple steps.'): ProcessSection => ({ id: 'process-id', type: 'process', hidden: false, content: { heading, intro, items } })

function Harness ({ initial = section(), saving = false, onChange = () => {} }: { initial?: ProcessSection, saving?: boolean, onChange?: (content: ProcessContent) => void }) {
  const [current, setCurrent] = useState(initial)
  return <ProcessDraftInspector onChange={(content) => { onChange(content); setCurrent({ ...current, content }) }} saving={saving} section={current} />
}

describe('ProcessDraftInspector', () => {
  it('renders controlled fields, counters, ordering, removal, and addition', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Steps' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Heading/)).toHaveValue('How it works')
    expect(screen.getByLabelText(/Intro/)).toHaveValue('Three simple steps.')
    expect(screen.getByText('2 of 8 steps')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]!).getByText('Step 1')).toBeInTheDocument()
    expect(within(rows[0]!).getByLabelText('Title')).toHaveValue('Choose')
    expect(within(rows[0]!).getByLabelText(/Description/)).toHaveValue('Pick a favorite.')
    expect(within(rows[0]!).getByRole('button', { name: 'Move Choose up' })).toBeDisabled()
    expect(within(rows[1]!).getByRole('button', { name: 'Move Order down' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Heading/), { target: { value: 'Start here' } })
    fireEvent.change(screen.getAllByLabelText('Title')[1]!, { target: { value: 'Place order' } })
    fireEvent.change(screen.getAllByLabelText(/Description/)[1]!, { target: { value: 'Tell us what you need.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move Place order up' }))
    expect(screen.getAllByLabelText('Title').map((input) => (input as HTMLInputElement).value)).toEqual(['Place order', 'Choose'])
    fireEvent.click(screen.getByRole('button', { name: 'Remove Place order' }))
    expect(screen.getByText('1 of 8 steps')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }))
    expect(screen.getByText('2 of 8 steps')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Title')[1]).toHaveValue('')
    expect(changed).toHaveBeenCalled()
  })

  it('keeps a transient zero-item draft visible and invalid while Add remains available', () => {
    render(<Harness initial={section([])} />)
    expect(screen.getByText('No steps yet')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one step.')
    expect(screen.getByRole('button', { name: 'Add step' })).toBeEnabled()
    expect(screen.queryByRole('list', { name: 'Steps' })).not.toBeInTheDocument()
  })

  it('disables Add and explains the eight-step maximum', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ id: `step-${index}`, title: `Step ${index + 1}` }))
    render(<Harness initial={section(items)} />)
    expect(screen.getByText('8 of 8 steps')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add step' })).toBeDisabled()
    expect(screen.getByText('Maximum of 8 steps.')).toBeInTheDocument()
  })

  it('disables every editing control while saving', () => {
    render(<Harness saving />)
    expect(screen.getByLabelText(/Heading/)).toBeDisabled()
    expect(screen.getByLabelText(/Intro/)).toBeDisabled()
    for (const input of screen.getAllByLabelText('Title')) expect(input).toBeDisabled()
    for (const input of screen.getAllByLabelText(/Description/)) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Order up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Choose' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add step' })).toBeDisabled()
  })

  it('returns every locked validation message in priority order', () => {
    const valid = section().content
    expect(processContentError({ ...valid, heading: 'x'.repeat(121) })).toBe('Heading must be 120 characters or fewer.')
    expect(processContentError({ ...valid, intro: 'x'.repeat(301) })).toBe('Intro must be 300 characters or fewer.')
    expect(processContentError({ ...valid, items: [] })).toBe('Add at least one step.')
    expect(processContentError({ ...valid, items: Array.from({ length: 9 }, (_, index) => ({ id: `${index}`, title: 'Step' })) })).toBe('Steps cannot exceed 8 items.')
    expect(processContentError({ ...valid, items: [{ id: 'one', title: ' ' }] })).toBe('Every step needs a title.')
    expect(processContentError({ ...valid, items: [{ id: 'one', title: 'x'.repeat(81) }] })).toBe('Step titles must be 80 characters or fewer.')
    expect(processContentError({ ...valid, items: [{ id: 'one', title: 'Step', description: 'x'.repeat(301) }] })).toBe('Step descriptions must be 300 characters or fewer.')
    expect(processContentError({ heading: ' ', intro: ' ', items: [{ id: 'one', title: 'Step', description: '' }] })).toBeNull()
  })
})
