import { useState } from 'react'
import type { ContactContent, ContactSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContactDraftInspector, contactContentError } from '../ContactDraftInspector'

const section = (content: ContactContent = { title: 'Contact us', text: 'We reply quickly.', buttonLabel: 'Get in touch', action: { type: 'leadForm' } }): ContactSection => ({
  id: 'contact-id',
  type: 'contact',
  hidden: false,
  content
})

function Harness ({ initial = section(), saving = false, onChange = () => {} }: { initial?: ContactSection, saving?: boolean, onChange?: (content: ContactContent) => void }) {
  const [current, setCurrent] = useState(initial)
  return <ContactDraftInspector onChange={(content) => { onChange(content); setCurrent({ ...current, content }) }} saving={saving} section={current} />
}

describe('ContactDraftInspector', () => {
  it('renders controlled Contact fields, counters, limits, and all four destinations', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument()
    expect(screen.getByText('One clear way for visitors to get in touch.')).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Contact us')
    expect(screen.getByLabelText('Section heading')).toHaveAttribute('maxlength', '150')
    expect(screen.getByText('10 / 150')).toBeInTheDocument()
    expect(screen.getByLabelText('Supporting text')).toHaveValue('We reply quickly.')
    expect(screen.getByLabelText('Supporting text')).toHaveAttribute('maxlength', '500')
    expect(screen.getByText('17 / 500')).toBeInTheDocument()
    expect(screen.getByLabelText('Button label')).toHaveValue('Get in touch')
    expect(screen.getByLabelText('Button label')).toHaveAttribute('maxlength', '80')
    expect(screen.getByText('12 / 80')).toBeInTheDocument()
    for (const option of ['Website URL', 'Email address', 'Phone number', 'Lead form']) expect(screen.getByRole('option', { name: option })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Talk with us' } })
    fireEvent.change(screen.getByLabelText('Supporting text'), { target: { value: 'Start here.' } })
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: 'Send a note' } })
    expect(screen.getByText('12 / 150')).toBeInTheDocument()
    expect(screen.getByText('11 / 500')).toBeInTheDocument()
    expect(screen.getByText('11 / 80')).toBeInTheDocument()
    expect(changed).toHaveBeenCalled()
  })

  it('shows the Lead form explanation and correct conditional fields for every link type', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Where it goes')).toHaveValue('leadForm')
    expect(screen.getByText(/Replies land in your Leads inbox/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Website URL')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'url' } })
    expect(screen.getByLabelText('Website URL')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'phone' } })
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument()
  })

  it('enforces structural validation while leaving nonblank formats to the server', () => {
    expect(contactContentError({ title: ' ', buttonLabel: 'Send', action: { type: 'leadForm' } })).toBe('Section heading is required.')
    expect(contactContentError({ title: 'Contact', text: 'x'.repeat(501), buttonLabel: 'Send', action: { type: 'leadForm' } })).toBe('Supporting text must be 500 characters or fewer.')
    expect(contactContentError({ title: 'Contact', buttonLabel: ' ', action: { type: 'leadForm' } })).toBe('Button label is required.')
    expect(contactContentError({ title: 'Contact', buttonLabel: 'Email', action: { type: 'email', value: ' ' } })).toBe('Add an email address.')
    expect(contactContentError({ title: 'Contact', buttonLabel: 'Call', action: { type: 'phone', value: ' ' } })).toBe('Add a phone number.')
    expect(contactContentError({ title: 'Contact', buttonLabel: 'Visit', action: { type: 'url', value: ' ' } })).toBe('Add a website URL.')
    expect(contactContentError({ title: 'Contact', buttonLabel: 'Email', action: { type: 'email', value: 'not-an-email' } })).toBeNull()
    expect(contactContentError({ title: 'Contact', buttonLabel: 'Send', action: { type: 'leadForm' } })).toBeNull()

    render(<Harness initial={section({ title: 'Contact', buttonLabel: 'Email', action: { type: 'email', value: '' } })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Add an email address.')
  })

  it('disables every Contact control while saving', () => {
    render(<Harness saving />)
    expect(screen.getByLabelText('Section heading')).toBeDisabled()
    expect(screen.getByLabelText('Supporting text')).toBeDisabled()
    expect(screen.getByLabelText('Button label')).toBeDisabled()
    expect(screen.getByLabelText('Where it goes')).toBeDisabled()
  })
})
