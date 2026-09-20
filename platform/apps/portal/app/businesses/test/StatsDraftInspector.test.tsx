import { useState } from 'react'
import type { StatsContent, StatsSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatsDraftInspector, statsContentError } from '../StatsDraftInspector'

const section = (items: StatsContent['items'] = [
  { id: 'stat-support', value: '24/7', label: 'Support' },
  { id: 'stat-orders', value: '1,200+', label: 'Orders' }
], heading = 'Highlights', intro = 'At a glance.'): StatsSection => ({ id: 'stats-id', type: 'stats', hidden: false, content: { heading, intro, items } })

function Harness ({ initial = section(), saving = false, onChange = () => {} }: { initial?: StatsSection, saving?: boolean, onChange?: (content: StatsContent) => void }) {
  const [current, setCurrent] = useState(initial)
  return <StatsDraftInspector onChange={(content) => { onChange(content); setCurrent({ ...current, content }) }} saving={saving} section={current} />
}

describe('StatsDraftInspector', () => {
  it('renders free-form text values and controlled reorder, removal, and addition actions', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Highlights' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Heading/)).toHaveValue('Highlights')
    expect(screen.getByLabelText(/Intro/)).toHaveValue('At a glance.')
    expect(screen.getByText('2 of 8 highlights')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]!).getByLabelText('Value')).toHaveValue('24/7')
    expect(within(rows[1]!).getByLabelText('Value')).toHaveValue('1,200+')
    expect(within(rows[0]!).getByLabelText('Value')).toHaveAttribute('type', 'text')
    expect(screen.getAllByText('Shown large, e.g. 24/7 or 1,200+')).toHaveLength(2)

    fireEvent.change(screen.getAllByLabelText('Value')[1]!, { target: { value: 'Same Day' } })
    fireEvent.change(screen.getAllByLabelText('Label')[1]!, { target: { value: 'Service' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move Service up' }))
    expect(screen.getAllByLabelText('Value').map((input) => (input as HTMLInputElement).value)).toEqual(['Same Day', '24/7'])
    fireEvent.click(screen.getByRole('button', { name: 'Remove Service' }))
    expect(screen.getByText('1 of 8 highlights')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add highlight' }))
    expect(screen.getByText('2 of 8 highlights')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Value')[1]).toHaveValue('')
    expect(changed).toHaveBeenCalled()
  })

  it('keeps a transient zero-item draft visible and invalid while Add remains available', () => {
    render(<Harness initial={section([])} />)
    expect(screen.getByText('No highlights yet')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one highlight.')
    expect(screen.getByRole('button', { name: 'Add highlight' })).toBeEnabled()
    expect(screen.queryByRole('list', { name: 'Highlights' })).not.toBeInTheDocument()
  })

  it('disables Add and explains the eight-highlight maximum', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ id: `stat-${index}`, value: `${index + 1}+`, label: `Metric ${index + 1}` }))
    render(<Harness initial={section(items)} />)
    expect(screen.getByText('8 of 8 highlights')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add highlight' })).toBeDisabled()
    expect(screen.getByText('Maximum of 8 highlights.')).toBeInTheDocument()
  })

  it('disables every editing control while saving', () => {
    render(<Harness saving />)
    expect(screen.getByLabelText(/Heading/)).toBeDisabled()
    expect(screen.getByLabelText(/Intro/)).toBeDisabled()
    for (const input of screen.getAllByLabelText('Value')) expect(input).toBeDisabled()
    for (const input of screen.getAllByLabelText('Label')) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Orders up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Support' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add highlight' })).toBeDisabled()
  })

  it('returns every locked validation message in priority order', () => {
    const valid = section().content
    expect(statsContentError({ ...valid, heading: 'x'.repeat(121) })).toBe('Heading must be 120 characters or fewer.')
    expect(statsContentError({ ...valid, intro: 'x'.repeat(301) })).toBe('Intro must be 300 characters or fewer.')
    expect(statsContentError({ ...valid, items: [] })).toBe('Add at least one highlight.')
    expect(statsContentError({ ...valid, items: Array.from({ length: 9 }, (_, index) => ({ id: `${index}`, value: '1', label: 'Metric' })) })).toBe('Highlights cannot exceed 8 items.')
    expect(statsContentError({ ...valid, items: [{ id: 'one', value: ' ', label: 'Metric' }] })).toBe('Every highlight needs a value.')
    expect(statsContentError({ ...valid, items: [{ id: 'one', value: 'x'.repeat(17), label: 'Metric' }] })).toBe('Highlight values must be 16 characters or fewer.')
    expect(statsContentError({ ...valid, items: [{ id: 'one', value: '24/7', label: ' ' }] })).toBe('Every highlight needs a label.')
    expect(statsContentError({ ...valid, items: [{ id: 'one', value: '24/7', label: 'x'.repeat(61) }] })).toBe('Highlight labels must be 60 characters or fewer.')
    expect(statsContentError({ heading: ' ', intro: ' ', items: [{ id: 'one', value: 'Same Day', label: 'Service' }] })).toBeNull()
  })
})
