import { useState } from 'react'
import type { FaqContent, FaqSection } from '@bakerrang/site-schema'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FaqDraftInspector, faqContentError } from '../FaqDraftInspector'

const section = (items: FaqContent['items'] = [
  { id: 'faq-1', question: 'When are you open?', answer: 'Every weekday.' },
  { id: 'faq-2', question: 'Do you deliver?', answer: 'Yes, within the city.' }
], intro: string | undefined = 'Start here.'): FaqSection => ({
  id: 'faq-id',
  type: 'faq',
  hidden: false,
  content: { heading: 'Questions', ...(intro === undefined ? {} : { intro }), items }
})

function Harness ({ initial = section(), saving = false, onChange = () => {} }: { initial?: FaqSection, saving?: boolean, onChange?: (content: FaqContent) => void }) {
  const [current, setCurrent] = useState(initial)
  return <FaqDraftInspector onChange={(content) => { onChange(content); setCurrent({ ...current, content }) }} saving={saving} section={current} />
}

describe('FaqDraftInspector', () => {
  it('renders heading, optional intro, item fields, counters, and controlled actions', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)

    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Questions')
    expect(screen.getByText('9 / 120')).toBeInTheDocument()
    expect(screen.getByLabelText('Intro')).toHaveValue('Start here.')
    expect(screen.getByText('11 / 300')).toBeInTheDocument()
    expect(screen.getByText('2 of 20')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByLabelText('Question')).toHaveValue('When are you open?')
    expect(within(rows[0]!).getByLabelText('Answer')).toHaveValue('Every weekday.')
    expect(screen.getByText('14 / 1000')).toBeInTheDocument()
    expect(within(rows[0]!).getByRole('button', { name: 'Move When are you open? up' })).toBeDisabled()
    expect(within(rows[1]!).getByRole('button', { name: 'Move Do you deliver? down' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Help' } })
    fireEvent.change(screen.getByLabelText('Intro'), { target: { value: 'Useful answers' } })
    fireEvent.change(screen.getAllByLabelText('Answer')[0]!, { target: { value: 'Monday to Friday.' } })
    expect(screen.getByText('4 / 120')).toBeInTheDocument()
    expect(screen.getByText('14 / 300')).toBeInTheDocument()
    expect(screen.getByText('17 / 1000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Move Do you deliver? up' }))
    expect(screen.getAllByLabelText('Question')[0]).toHaveValue('Do you deliver?')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Do you deliver?' }))
    expect(screen.getByText('1 of 20')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    expect(screen.getByText('2 of 20')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Question')[1]).toHaveValue('')
    expect(changed).toHaveBeenCalled()
  })

  it('disables Add at 20 questions', () => {
    const items = Array.from({ length: 20 }, (_, index) => ({ id: `faq-${index}`, question: `Question ${index + 1}?`, answer: `Answer ${index + 1}.` }))
    render(<Harness initial={section(items)} />)
    expect(screen.getByText('20 of 20')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add question' })).toBeDisabled()
    expect(screen.getByText('Maximum of 20 questions.')).toBeInTheDocument()
  })

  it('disables every mutation control while saving', () => {
    render(<Harness saving />)
    expect(screen.getByLabelText('Section heading')).toBeDisabled()
    expect(screen.getByLabelText('Intro')).toBeDisabled()
    for (const input of screen.getAllByLabelText('Question')) expect(input).toBeDisabled()
    for (const input of screen.getAllByLabelText('Answer')) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Do you deliver? up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove When are you open?' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add question' })).toBeDisabled()
  })

  it('shows the empty draft state and validation while keeping Add available', () => {
    render(<Harness initial={section([])} />)
    expect(screen.getByText('No questions yet')).toBeInTheDocument()
    expect(screen.getByText('Add a question to show this section on your site.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one question.')
    expect(screen.getByRole('button', { name: 'Add question' })).toBeEnabled()
    expect(screen.queryByRole('list', { name: 'Questions' })).not.toBeInTheDocument()
  })

  it('allows an omitted or blank intro while enforcing required FAQ fields and limits', () => {
    expect(faqContentError(section(undefined, undefined).content)).toBeNull()
    expect(faqContentError({ ...section().content, intro: '   ' })).toBeNull()
    expect(faqContentError({ ...section().content, heading: ' ' })).toBe('Section heading is required.')
    expect(faqContentError({ ...section().content, items: [] })).toBe('Add at least one question.')
    expect(faqContentError({ ...section().content, items: [{ id: 'one', question: ' ', answer: 'Answer' }] })).toBe('Every FAQ item needs a question.')
    expect(faqContentError({ ...section().content, items: [{ id: 'one', question: 'Question?', answer: ' ' }] })).toBe('Every question needs an answer.')
  })
})
