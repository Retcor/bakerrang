import { useState } from 'react'
import type { BusinessHours, BusinessHoursContent, BusinessHoursSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BusinessHoursDraftInspector, businessHoursContentError } from '../BusinessHoursDraftInspector'

const hours: BusinessHours = {
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '08:30', close: '16:15' },
  wednesday: { closed: true },
  thursday: { open: '12:00', close: '23:45' },
  friday: { open: '00:00', close: '13:30' },
  saturday: { closed: true },
  sunday: { open: '10:00', close: '14:00' }
}

const section = (content: BusinessHoursContent = { heading: 'Visit the bakery', intro: 'Drop in for something fresh.' }): BusinessHoursSection => ({
  id: 'hours-id',
  type: 'businessHours',
  hidden: false,
  content
})

function Harness ({ initial = section(), schedule = hours, noSchedule = false, saving = false, onChange = () => {}, onEditSchedule = () => {} }: {
  initial?: BusinessHoursSection
  schedule?: BusinessHours
  noSchedule?: boolean
  saving?: boolean
  onChange?: (content: BusinessHoursContent) => void
  onEditSchedule?: () => void
}) {
  const [current, setCurrent] = useState(initial)
  return <BusinessHoursDraftInspector hours={noSchedule ? undefined : schedule} onChange={(content) => { onChange(content); setCurrent({ ...current, content }) }} onEditSchedule={onEditSchedule} saving={saving} section={current} />
}

describe('BusinessHoursDraftInspector', () => {
  it('renders seeded presentation fields, counters, and controlled edits', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Business Hours' })).toBeInTheDocument()
    expect(screen.getByText('Show your weekly schedule on this page.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Section heading/)).toHaveValue('Visit the bakery')
    expect(screen.getByLabelText(/Section heading/)).toHaveAttribute('maxlength', '120')
    expect(screen.getByText('16 / 120')).toBeInTheDocument()
    expect(screen.getByLabelText(/Intro/)).toHaveValue('Drop in for something fresh.')
    expect(screen.getByLabelText(/Intro/)).toHaveAttribute('maxlength', '300')
    expect(screen.getByText('28 / 300')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Section heading/), { target: { value: 'Opening times' } })
    expect(changed).toHaveBeenLastCalledWith({ heading: 'Opening times', intro: 'Drop in for something fresh.' })
    fireEvent.change(screen.getByLabelText(/Intro/), { target: { value: 'Come by.' } })
    expect(changed).toHaveBeenLastCalledWith({ heading: 'Opening times', intro: 'Come by.' })
    expect(screen.getByText('13 / 120')).toBeInTheDocument()
    expect(screen.getByText('8 / 300')).toBeInTheDocument()
  })

  it('accepts empty content and returns the exact validation messages', () => {
    expect(businessHoursContentError({})).toBeNull()
    expect(businessHoursContentError({ heading: ' ', intro: ' ' })).toBeNull()
    expect(businessHoursContentError({ heading: ` ${'x'.repeat(121)} ` })).toBe('Section heading must be 120 characters or fewer.')
    expect(businessHoursContentError({ intro: ` ${'x'.repeat(301)} ` })).toBe('Intro must be 300 characters or fewer.')

    render(<Harness initial={section({})} />)
    expect(screen.getByLabelText(/Section heading/)).toHaveValue('')
    expect(screen.getByLabelText(/Intro/)).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the read-only Monday-to-Sunday schedule with public-site time formatting', () => {
    const onEditSchedule = vi.fn()
    const { container } = render(<Harness onEditSchedule={onEditSchedule} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Weekly schedule' })).toBeInTheDocument()
    expect(screen.getByText('Shared')).toBeInTheDocument()
    expect(screen.getByText('Used across your whole site. Edited in More Settings, not here.')).toBeInTheDocument()
    expect(screen.getAllByText(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/).map((node) => node.textContent)).toEqual([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ])
    for (const value of ['9:00 AM – 5:00 PM', '8:30 AM – 4:15 PM', '12:00 PM – 11:45 PM', '12:00 AM – 1:30 PM', '10:00 AM – 2:00 PM']) expect(screen.getByText(value)).toBeInTheDocument()
    expect(screen.getAllByText('Closed')).toHaveLength(2)
    expect(container.querySelector('input[type="time"]')).not.toBeInTheDocument()
    expect(container.querySelector('input[type="checkbox"]')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit business hours' }))
    expect(onEditSchedule).toHaveBeenCalledOnce()
  })

  it('shows the informational dependency state without blocking presentation edits', () => {
    const changed = vi.fn()
    const onEditSchedule = vi.fn()
    render(<Harness noSchedule onChange={changed} onEditSchedule={onEditSchedule} />)

    expect(screen.getByRole('note')).toHaveTextContent('No weekly schedule is set yet, so this section stays hidden on the public site. Set the hours in More Settings to make it appear.')
    expect(screen.queryByText('Monday')).not.toBeInTheDocument()
    expect(screen.queryByText('Used across your whole site. Edited in More Settings, not here.')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Section heading/)).toBeEnabled()
    expect(screen.getByLabelText(/Intro/)).toBeEnabled()
    fireEvent.change(screen.getByLabelText(/Section heading/), { target: { value: 'When to visit' } })
    expect(changed).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Edit business hours' }))
    expect(onEditSchedule).toHaveBeenCalledOnce()
  })

  it('disables the presentation controls and schedule action while saving', () => {
    render(<Harness saving />)
    expect(screen.getByLabelText(/Section heading/)).toBeDisabled()
    expect(screen.getByLabelText(/Intro/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit business hours' })).toBeDisabled()
  })
})
