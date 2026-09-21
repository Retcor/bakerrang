import { useState } from 'react'
import type { ContactAction, LinkAction } from '@bakerrang/site-schema'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SectionActionFieldsDraft } from '../SectionActionFieldsDraft'

function LinkHarness ({ disabled = false, onChange = () => {} }: { disabled?: boolean, onChange?: (next: { buttonLabel: string, action: LinkAction }) => void }) {
  const [buttonLabel, setButtonLabel] = useState('Visit us')
  const [action, setAction] = useState<LinkAction>({ type: 'url', value: 'https://example.com' })
  return <SectionActionFieldsDraft action={action} buttonLabel={buttonLabel} buttonLabelMax={60} disabled={disabled} idBase="link" onChange={(next) => { onChange(next); setButtonLabel(next.buttonLabel); setAction(next.action) }} />
}

function ContactHarness ({ disabled = false, initialAction = { type: 'leadForm' }, onChange = () => {} }: { disabled?: boolean, initialAction?: ContactAction, onChange?: (next: { buttonLabel: string, action: ContactAction }) => void }) {
  const [buttonLabel, setButtonLabel] = useState('Get in touch')
  const [action, setAction] = useState<ContactAction>(initialAction)
  return <SectionActionFieldsDraft action={action} allowLeadForm buttonLabel={buttonLabel} buttonLabelMax={80} disabled={disabled} idBase="contact" onChange={(next) => { onChange(next); setButtonLabel(next.buttonLabel); setAction(next.action) }} />
}

describe('SectionActionFieldsDraft', () => {
  it('keeps link-only mode limited to URL, email, and phone while resetting each destination value', () => {
    const changed = vi.fn()
    render(<LinkHarness onChange={changed} />)
    expect(screen.queryByRole('option', { name: 'Lead form' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Button label')).toHaveAttribute('maxlength', '60')
    expect(screen.getByText('8 / 60')).toBeInTheDocument()
    expect(screen.getByLabelText('Website URL')).toHaveAttribute('maxlength', '2048')
    expect(screen.getByLabelText('Website URL')).toHaveAttribute('inputmode', 'url')

    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    expect(changed).toHaveBeenLastCalledWith({ buttonLabel: 'Visit us', action: { type: 'email', value: '' } })
    expect(screen.getByLabelText('Email address')).toHaveValue('')
    expect(screen.getByLabelText('Email address')).toHaveAttribute('maxlength', '254')
    expect(screen.getByLabelText('Email address')).toHaveAttribute('inputmode', 'email')
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'hello@example.com' } })
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'phone' } })
    expect(screen.getByLabelText('Phone number')).toHaveValue('')
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('maxlength', '50')
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('inputmode', 'tel')
  })

  it('supports Lead form only in contact mode and drops stale variant data in both directions', () => {
    const changed = vi.fn()
    render(<ContactHarness initialAction={{ type: 'email', value: 'hello@example.com' }} onChange={changed} />)
    expect(screen.getByRole('option', { name: 'Lead form' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'leadForm' } })
    expect(changed).toHaveBeenLastCalledWith({ buttonLabel: 'Get in touch', action: { type: 'leadForm' } })
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument()
    expect(screen.getByText('Visitors fill in an on-page form. Replies land in your Leads inbox — no destination needed.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'url' } })
    expect(changed).toHaveBeenLastCalledWith({ buttonLabel: 'Get in touch', action: { type: 'url', value: '' } })
    expect(screen.getByLabelText('Website URL')).toHaveValue('')
    expect(screen.queryByText(/Replies land in your Leads inbox/)).not.toBeInTheDocument()
  })

  it('controls the button label counter and disables every control', () => {
    const { rerender } = render(<LinkHarness />)
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: 'Start today' } })
    expect(screen.getByText('11 / 60')).toBeInTheDocument()
    rerender(<LinkHarness disabled />)
    expect(screen.getByLabelText('Button label')).toBeDisabled()
    expect(screen.getByLabelText('Where it goes')).toBeDisabled()
    expect(screen.getByLabelText('Website URL')).toBeDisabled()
  })
})
