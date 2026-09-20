import { useState } from 'react'
import type { AboutContent, AboutSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AboutDraftInspector, aboutContentError } from '../AboutDraftInspector'

const section = (content: AboutContent = { heading: 'Our story', body: 'We bake every morning.' }): AboutSection => ({
  id: 'about-id',
  type: 'about',
  hidden: false,
  content
})

function Harness ({ initial = section(), onChange = () => {}, onOpenMediaPicker = () => {}, saving = false }: {
  initial?: AboutSection
  onChange?: (content: AboutContent) => void
  onOpenMediaPicker?: () => void
  saving?: boolean
}) {
  const [current, setCurrent] = useState(initial)
  return <AboutDraftInspector onChange={(content) => { onChange(content); setCurrent({ ...current, content }) }} onOpenMediaPicker={onOpenMediaPicker} saving={saving} section={current} />
}

describe('AboutDraftInspector', () => {
  it('renders controlled text fields, counters, limits, and a valid text-only state', () => {
    const changed = vi.fn()
    render(<Harness initial={section({ eyebrow: 'Who we are', heading: 'Our story', body: 'First.\n\nSecond.' })} onChange={changed} />)

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
    expect(screen.getByLabelText('Eyebrow Optional')).toHaveValue('Who we are')
    expect(screen.getByLabelText('Eyebrow Optional')).toHaveAttribute('maxlength', '60')
    expect(screen.getByText('10 / 60')).toBeInTheDocument()
    expect(screen.getByLabelText('Heading')).toHaveValue('Our story')
    expect(screen.getByLabelText('Heading')).toHaveAttribute('maxlength', '120')
    expect(screen.getByLabelText('Heading')).toBeRequired()
    expect(screen.getByText('9 / 120')).toBeInTheDocument()
    expect(screen.getByLabelText('Body')).toHaveValue('First.\n\nSecond.')
    expect(screen.getByLabelText('Body')).toHaveAttribute('maxlength', '2000')
    expect(screen.getByLabelText('Body')).toBeRequired()
    expect(screen.getByText('15 / 2000')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add image' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Add a button' })).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'A local story' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'A local body.' } })
    expect(changed).toHaveBeenCalled()
    expect(screen.getByText('13 / 120')).toBeInTheDocument()
    expect(screen.getByText('13 / 2000')).toBeInTheDocument()
  })

  it('shows the photographic image editor, blank-alt guidance, and clears every image field on removal', () => {
    const changed = vi.fn()
    const open = vi.fn()
    render(<Harness initial={section({
      heading: 'Our story',
      body: 'Meet the team.',
      imageMediaId: 'media-a',
      imageAlt: '',
      imageSrc: 'https://media.test/a.jpg',
      imageWidth: 1200,
      imageHeight: 900,
      imagePosition: 'right'
    })} onChange={changed} onOpenMediaPicker={open} />)

    expect(screen.getByRole('region', { name: 'About properties' }).querySelector('img')).toHaveClass('aspect-[4/3]', 'object-cover')
    expect(screen.getByLabelText('Image alt text')).toHaveAttribute('maxlength', '250')
    expect(screen.getByLabelText('Image alt text')).toBeRequired()
    expect(screen.getByText('0 / 250')).toBeInTheDocument()
    expect(screen.getByText('Add alt text to show this image in the site preview.')).toBeInTheDocument()
    expect(screen.getByLabelText('Image position')).toHaveValue('right')

    fireEvent.change(screen.getByLabelText('Image alt text'), { target: { value: 'Bakers shaping bread' } })
    fireEvent.change(screen.getByLabelText('Image position'), { target: { value: 'left' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change image' }))
    expect(open).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    const removed = changed.mock.calls.at(-1)?.[0] as AboutContent
    expect(removed).not.toHaveProperty('imageMediaId')
    expect(removed).not.toHaveProperty('imageAlt')
    expect(removed).not.toHaveProperty('imageSrc')
    expect(removed).not.toHaveProperty('imageWidth')
    expect(removed).not.toHaveProperty('imageHeight')
    expect(removed).not.toHaveProperty('imagePosition')
    expect(screen.getByRole('button', { name: 'Add image' })).toBeInTheDocument()
  })

  it('reuses the optional link-action fields, omits Lead form, resets destination values, and removes the pair', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add a button' }))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ buttonLabel: '', action: { type: 'url', value: '' } }))
    expect(screen.getByLabelText('Button label')).toHaveAttribute('maxlength', '60')
    expect(screen.getByLabelText('Where it goes')).toHaveValue('url')
    expect(screen.queryByRole('option', { name: 'Lead form' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: 'Visit us' } })
    fireEvent.change(screen.getByLabelText('Website URL'), { target: { value: 'https://example.com' } })
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ buttonLabel: 'Visit us', action: { type: 'email', value: '' } }))
    expect(screen.getByLabelText('Email address')).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    const removed = changed.mock.calls.at(-1)?.[0] as AboutContent
    expect(removed).not.toHaveProperty('buttonLabel')
    expect(removed).not.toHaveProperty('action')
    expect(screen.getByRole('button', { name: 'Add a button' })).toBeInTheDocument()
  })

  it('mirrors the locked About validation and type-specific incomplete-action guidance', () => {
    expect(aboutContentError({ heading: ' ', body: 'Body' })).toBe('Heading is required.')
    expect(aboutContentError({ heading: 'x'.repeat(121), body: 'Body' })).toBe('Heading must be 120 characters or fewer.')
    expect(aboutContentError({ heading: 'Heading', body: ' ' })).toBe('Body is required.')
    expect(aboutContentError({ heading: 'Heading', body: 'x'.repeat(2001) })).toBe('Body must be 2000 characters or fewer.')
    expect(aboutContentError({ eyebrow: 'x'.repeat(61), heading: 'Heading', body: 'Body' })).toBe('Eyebrow must be 60 characters or fewer.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', imageMediaId: 'media-a', imageAlt: ' ' })).toBe('Add alt text for the About image, or remove it.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', imageMediaId: 'media-a', imageAlt: 'x'.repeat(251) })).toBe('Image alt text must be 250 characters or fewer.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', buttonLabel: '', action: { type: 'url', value: '' } })).toBe('Add a button label, or remove the button.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', buttonLabel: 'Email', action: { type: 'email', value: ' ' } })).toBe('Add an email address, or remove the button.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', buttonLabel: 'Call', action: { type: 'phone', value: ' ' } })).toBe('Add a phone number, or remove the button.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', buttonLabel: 'Visit', action: { type: 'url', value: ' ' } })).toBe('Add a website URL, or remove the button.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', buttonLabel: 'Email', action: { type: 'email', value: 'not-an-email' } })).toBe('Enter a valid email address, or remove the button.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', buttonLabel: 'Call', action: { type: 'phone', value: '123' } })).toBe('Enter a valid phone number, or remove the button.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', buttonLabel: 'Visit', action: { type: 'url', value: 'javascript:alert(1)' } })).toBe('Enter a valid website URL using http or https, or remove the button.')
    expect(aboutContentError({ heading: 'Heading', body: 'Body', buttonLabel: 'Email', action: { type: 'email', value: 'hello@example.com' } })).toBeNull()
    expect(aboutContentError({ heading: 'Heading', body: 'Body' })).toBeNull()
  })

  it('disables every editable control and action while saving', () => {
    render(<Harness initial={section({
      eyebrow: 'Story',
      heading: 'Our story',
      body: 'Body',
      imageMediaId: 'media-a',
      imageAlt: 'Our team',
      imageSrc: 'https://media.test/a.jpg',
      imageWidth: 1200,
      imageHeight: 900,
      imagePosition: 'right',
      buttonLabel: 'Visit',
      action: { type: 'url', value: 'https://example.com' }
    })} saving />)

    expect(screen.getByLabelText('Eyebrow Optional')).toBeDisabled()
    expect(screen.getByLabelText('Heading')).toBeDisabled()
    expect(screen.getByLabelText('Body')).toBeDisabled()
    expect(screen.getByLabelText('Image alt text')).toBeDisabled()
    expect(screen.getByLabelText('Image position')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Change image' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove image' })).toBeDisabled()
    expect(screen.getByLabelText('Button label')).toBeDisabled()
    expect(screen.getByLabelText('Where it goes')).toBeDisabled()
    expect(screen.getByLabelText('Website URL')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
  })
})
