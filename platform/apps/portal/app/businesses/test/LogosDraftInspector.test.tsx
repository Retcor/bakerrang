import { useState } from 'react'
import type { LogosContent, LogosSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LogosDraftInspector, logosContentError } from '../LogosDraftInspector'

const content = (): LogosContent => ({ heading: 'Trusted by', items: [
  { id: 'logo-1', mediaId: 'media-1', altText: 'Northwind', src: 'https://media.test/northwind.png', width: 800, height: 300 },
  { id: 'logo-2', mediaId: 'media-2', altText: 'Contoso', src: 'https://media.test/contoso.png', width: 600, height: 600 }
] })
const section = (value = content()): LogosSection => ({ id: 'logos-id', type: 'logos', hidden: false, content: value })

function Harness ({ initial = section(), onChange = () => {}, onOpenMediaPicker = () => {}, saving = false }: { initial?: LogosSection, onChange?: (content: LogosContent) => void, onOpenMediaPicker?: () => void, saving?: boolean }) {
  const [current, setCurrent] = useState(initial)
  return <LogosDraftInspector onChange={(next) => { onChange(next); setCurrent({ ...current, content: next }) }} onOpenMediaPicker={onOpenMediaPicker} saving={saving} section={current} />
}

describe('LogosDraftInspector', () => {
  it('renders optional heading, contained thumbnails, alt controls, reorder, remove, and Add', () => {
    const changed = vi.fn()
    const open = vi.fn()
    const { container } = render(<Harness onChange={changed} onOpenMediaPicker={open} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Logos' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading Optional')).toHaveValue('Trusted by')
    expect(screen.getByText('10 / 120')).toBeInTheDocument()
    expect(screen.getByText('2 of 24')).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(2)
    expect(container.querySelector('img')).toHaveClass('object-contain')
    expect(container.querySelector('img')).not.toHaveClass('object-cover')
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]!).getByLabelText(/Alt text/)).toHaveValue('Northwind')
    expect(within(rows[0]!).getByRole('button', { name: 'Move logo 1 up' })).toBeDisabled()
    expect(within(rows[1]!).getByRole('button', { name: 'Move logo 2 down' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Section heading Optional'), { target: { value: 'Our partners' } })
    expect(screen.getByText('12 / 120')).toBeInTheDocument()
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[0]!, { target: { value: 'Updated Northwind' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move logo 2 up' }))
    expect(screen.getAllByLabelText(/Alt text/)[0]).toHaveValue('Contoso')
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo 1 from Logos' }))
    expect(screen.getByText('1 of 24')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add logo' }))
    expect(open).toHaveBeenCalledOnce()
    expect(changed).toHaveBeenCalled()
  })

  it('treats an empty Logos section as valid and keeps Add available', () => {
    const open = vi.fn()
    render(<Harness initial={section({ heading: '', items: [] })} onOpenMediaPicker={open} />)
    expect(screen.getByText('No logos yet')).toBeInTheDocument()
    expect(screen.getByText('This section stays hidden on your site until you add a logo.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add logo' })).toBeEnabled()
    expect(logosContentError({ heading: '', items: [] })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add logo' }))
    expect(open).toHaveBeenCalledOnce()
  })

  it('shows missing-alt guidance and disables every mutation while saving', () => {
    const draft = content()
    draft.items[0]!.altText = ''
    render(<Harness initial={section(draft)} saving />)
    expect(screen.getByText('Add alt text so this logo can be saved.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Every logo needs alt text.')
    expect(screen.getByLabelText('Section heading Optional')).toBeDisabled()
    for (const input of screen.getAllByLabelText(/Alt text/)) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move logo 2 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove logo 1 from Logos' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add logo' })).toBeDisabled()
  })

  it('disables Add at 24 and mirrors Logos server validation', () => {
    const items = Array.from({ length: 24 }, (_, index) => ({ id: `logo-${index}`, mediaId: `media-${index}`, altText: `Logo ${index + 1}` }))
    render(<Harness initial={section({ items })} />)
    expect(screen.getByText('24 of 24')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add logo' })).toBeDisabled()
    expect(screen.getByText('Maximum of 24 logos.')).toBeInTheDocument()

    expect(logosContentError({ heading: 'x'.repeat(121), items: [] })).toBe('Section heading must be 120 characters or fewer.')
    expect(logosContentError({ items: [...items, { id: 'overflow', mediaId: 'overflow', altText: 'Overflow' }] })).toBe('Logos cannot exceed 24 items.')
    expect(logosContentError({ items: [{ id: 'one', mediaId: '', altText: 'Logo' }] })).toBe('Every logo needs a media reference.')
    expect(logosContentError({ items: [{ id: 'one', mediaId: 'same', altText: 'One' }, { id: 'two', mediaId: 'same', altText: 'Two' }] })).toBe('Logos cannot contain the same image twice.')
    expect(logosContentError({ items: [{ id: 'one', mediaId: 'one', altText: ' ' }] })).toBe('Every logo needs alt text.')
    expect(logosContentError({ items: [{ id: 'one', mediaId: 'one', altText: 'x'.repeat(251) }] })).toBe('Alt text must be 250 characters or fewer.')
    expect(logosContentError(content())).toBeNull()
  })
})
