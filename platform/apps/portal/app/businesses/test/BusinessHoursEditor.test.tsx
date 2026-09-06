import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ updateBusinessHours: vi.fn(), composeHomeSections: vi.fn() }))
vi.mock('../../../lib/site', () => ({
  updateBusinessHours: mocks.updateBusinessHours,
  composeHomeSections: mocks.composeHomeSections
}))

import { BusinessHoursEditor } from '../BusinessHoursEditor'

const theme = {
  colors: { primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033' },
  headingFont: 'inter' as const, bodyFont: 'inter' as const, cornerStyle: 'soft' as const,
  contentWidth: 'standard' as const, sectionSpacing: 'comfortable' as const
}
const configuredHours = {
  monday: { open: '08:00', close: '16:00' }, tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' }, thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' }, saturday: { closed: true as const }, sunday: { closed: true as const }
}
const site = (configured = false, section = false): SiteDefinition => ({
  status: 'DRAFT',
  branding: { siteName: 'Bakery' },
  theme,
  ...(configured ? { businessProfile: { businessHours: configuredHours } } : {}),
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
    { id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Welcome' } },
    ...(section ? [{ id: 'hours-id', type: 'businessHours' as const, hidden: false, content: { heading: 'Visit', intro: 'Come by.' } }] : [])
  ] }]
})

describe('Business Hours editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateBusinessHours.mockResolvedValue(site(true, true))
  })

  it('shows editable weekday defaults without persisting and stacks rows until the small breakpoint', () => {
    render(<BusinessHoursEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" />)
    expect(screen.getByText(/won't be saved until/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Monday opening time')).toHaveValue('09:00')
    expect(screen.getByLabelText('Friday closing time')).toHaveValue('17:00')
    expect(screen.getByLabelText('Saturday opening time')).toBeDisabled()
    expect(screen.getByLabelText('Sunday closing time')).toBeDisabled()
    expect(screen.getByLabelText('Monday opening time').closest('fieldset')).toHaveClass('grid', 'sm:grid-cols-[8rem_7rem_minmax(0,1fr)]')
    expect(mocks.updateBusinessHours).not.toHaveBeenCalled()
  })

  it('loads existing hours without homepage presence controls', () => {
    render(<BusinessHoursEditor onCancel={() => undefined} onSaved={() => undefined} site={site(true, true)} tenantId="tenant-1" />)
    expect(screen.getByLabelText('Monday opening time')).toHaveValue('08:00')
    expect(screen.queryByText('Show business hours on homepage')).not.toBeInTheDocument()
  })

  it('toggles closed days and copies Monday only through Friday in local state', () => {
    render(<BusinessHoursEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" />)
    fireEvent.change(screen.getByLabelText('Monday opening time'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Monday closing time'), { target: { value: '18:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Copy Monday to weekdays' }))
    expect(screen.getByLabelText('Tuesday opening time')).toHaveValue('10:00')
    expect(screen.getByLabelText('Friday closing time')).toHaveValue('18:00')
    expect(screen.getByLabelText('Saturday opening time')).toHaveValue('09:00')
    const saturday = screen.getByLabelText('Saturday opening time').closest('fieldset')
    fireEvent.click(saturday!.querySelector('input[type="checkbox"]')!)
    expect(screen.getByLabelText('Saturday opening time')).not.toBeDisabled()
    expect(mocks.updateBusinessHours).not.toHaveBeenCalled()
  })

  it('validates ordering then saves only through the focused mutation and returns SiteDefinition', async () => {
    const onSaved = vi.fn()
    render(<BusinessHoursEditor onCancel={() => undefined} onSaved={onSaved} site={site()} tenantId="tenant-1" />)
    fireEvent.change(screen.getByLabelText('Monday closing time'), { target: { value: '08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Monday closing time must be later')
    expect(mocks.updateBusinessHours).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Monday closing time'), { target: { value: '17:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateBusinessHours).toHaveBeenCalledWith('tenant-1', {
      businessHours: {
        monday: { open: '09:00', close: '17:00' }, tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' }, thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' }, saturday: { closed: true }, sunday: { closed: true }
      },
      homepage: { enabled: false }
    }, undefined))
    expect(onSaved).toHaveBeenCalledWith(site(true, true))
  })

  it('confirms canonical removal through the focused null mutation', async () => {
    render(<BusinessHoursEditor onCancel={() => undefined} onSaved={() => undefined} site={site(true, true)} tenantId="tenant-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove business hours' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove hours' }))
    await waitFor(() => expect(mocks.updateBusinessHours).toHaveBeenCalledWith('tenant-1', {
      businessHours: null, homepage: { enabled: false }
    }, 'hours-id'))
  })

})
