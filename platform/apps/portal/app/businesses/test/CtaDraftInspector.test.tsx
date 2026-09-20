import { useState } from 'react'
import type { CtaContent, CtaSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CtaDraftInspector, ctaContentError } from '../CtaDraftInspector'

const section = (content: CtaContent = { heading: 'Ready to begin?', body: 'We would love to help.' }): CtaSection => ({
  id: 'cta-id',
  type: 'cta',
  hidden: false,
  content
})

function Harness ({ initial = section(), saving = false, onChange = () => {} }: { initial?: CtaSection, saving?: boolean, onChange?: (content: CtaContent) => void }) {
  const [current, setCurrent] = useState(initial)
  return <CtaDraftInspector onChange={(content) => { onChange(content); setCurrent({ ...current, content }) }} saving={saving} section={current} />
}

describe('CtaDraftInspector', () => {
  it('renders controlled heading and body fields, counters, limits, and the no-button state', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)

    expect(screen.getByRole('heading', { name: 'Call to Action' })).toBeInTheDocument()
    expect(screen.getByText('Invite visitors to take the next step.')).toBeInTheDocument()
    expect(screen.getByLabelText('Heading')).toHaveValue('Ready to begin?')
    expect(screen.getByLabelText('Heading')).toHaveAttribute('maxlength', '120')
    expect(screen.getByText('15 / 120')).toBeInTheDocument()
    expect(screen.getByLabelText('Body')).toHaveValue('We would love to help.')
    expect(screen.getByLabelText('Body')).toHaveAttribute('maxlength', '300')
    expect(screen.getByText('22 / 300')).toBeInTheDocument()
    expect(screen.getByText('Optional — add a button to give visitors one clear action.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a button' })).toBeEnabled()
    expect(screen.queryByLabelText('Button label')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'Talk with our team' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Start today.' } })
    expect(screen.getByText('18 / 120')).toBeInTheDocument()
    expect(screen.getByText('12 / 300')).toBeInTheDocument()
    expect(changed).toHaveBeenCalled()
  })

  it('adds a configured button, renders exact destination states, resets values on type change, and removes it', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add a button' }))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ buttonLabel: '', action: { type: 'url', value: '' } }))
    expect(screen.getByLabelText('Button label')).toHaveAttribute('maxlength', '60')
    expect(screen.getByLabelText('Where it goes')).toHaveValue('url')
    expect(screen.getByRole('option', { name: 'Website URL' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Email address' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Phone number' })).toBeInTheDocument()
    expect(screen.getByLabelText('Website URL')).toHaveAttribute('maxlength', '2048')
    expect(screen.getByLabelText('Website URL')).toHaveAttribute('inputmode', 'url')

    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: 'Visit us' } })
    fireEvent.change(screen.getByLabelText('Website URL'), { target: { value: 'https://example.com' } })
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ buttonLabel: 'Visit us', action: { type: 'email', value: '' } }))
    expect(screen.queryByLabelText('Website URL')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveValue('')
    expect(screen.getByLabelText('Email address')).toHaveAttribute('maxlength', '254')
    expect(screen.getByLabelText('Email address')).toHaveAttribute('inputmode', 'email')

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'hello@example.com' } })
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'phone' } })
    expect(screen.getByLabelText('Phone number')).toHaveValue('')
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('maxlength', '50')
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('inputmode', 'tel')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    const removed = changed.mock.calls.at(-1)?.[0] as CtaContent
    expect(removed).not.toHaveProperty('buttonLabel')
    expect(removed).not.toHaveProperty('action')
    expect(screen.getByRole('button', { name: 'Add a button' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Where it goes')).not.toBeInTheDocument()
  })

  it('reports only local structural validation, with type-specific incomplete action messages', () => {
    expect(ctaContentError({ heading: '   ' })).toBe('Heading is required.')
    expect(ctaContentError({ heading: 'Valid', body: 'x'.repeat(301) })).toBe('Body must be 300 characters or fewer.')
    expect(ctaContentError({ heading: 'Valid', buttonLabel: '', action: { type: 'url', value: '' } })).toBe('Add a button label, or remove the button.')
    expect(ctaContentError({ heading: 'Valid', buttonLabel: 'Visit', action: { type: 'url', value: ' ' } })).toBe('Add a website URL, or remove the button.')
    expect(ctaContentError({ heading: 'Valid', buttonLabel: 'Email', action: { type: 'email', value: ' ' } })).toBe('Add an email address, or remove the button.')
    expect(ctaContentError({ heading: 'Valid', buttonLabel: 'Call', action: { type: 'phone', value: ' ' } })).toBe('Add a phone number, or remove the button.')
    expect(ctaContentError({ heading: 'Valid', buttonLabel: 'Email', action: { type: 'email', value: 'not-an-email' } })).toBeNull()

    render(<Harness initial={section({ heading: 'Valid', buttonLabel: 'Visit', action: { type: 'url', value: '' } })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Add a website URL, or remove the button.')
  })

  it('disables every editable control and action while saving', () => {
    render(<Harness initial={section({ heading: 'Ready', body: 'Now', buttonLabel: 'Visit', action: { type: 'url', value: 'https://example.com' } })} saving />)
    expect(screen.getByLabelText('Heading')).toBeDisabled()
    expect(screen.getByLabelText('Body')).toBeDisabled()
    expect(screen.getByLabelText('Button label')).toBeDisabled()
    expect(screen.getByLabelText('Where it goes')).toBeDisabled()
    expect(screen.getByLabelText('Website URL')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
  })
})
