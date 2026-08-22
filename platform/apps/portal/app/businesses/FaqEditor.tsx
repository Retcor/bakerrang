'use client'

import { useRef, useState, type FormEvent } from 'react'
import { findHomePage, isFaqSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, Input, StatusMessage, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { upsertHomeFaq } from '../../lib/site'

interface EditorRow {
  key: string
  id?: string
  question: string
  answer: string
}

export interface FaqEditorProps {
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
}

function ArrowIcon ({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg aria-hidden className="size-5" fill="none" viewBox="0 0 20 20">
      <path d={direction === 'up' ? 'm5 12.5 5-5 5 5' : 'm5 7.5 5 5 5-5'} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function TrashIcon () {
  return (
    <svg aria-hidden className="size-5" fill="none" viewBox="0 0 20 20">
      <path d="M4.5 6h11M8 3.75h4M6 6l.6 10.25h6.8L14 6M8.25 8.5v5M11.75 8.5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

export function FaqEditor ({ tenantId, site, onCancel, onSaved }: FaqEditorProps) {
  const faq = findHomePage(site)?.sections.find(isFaqSection)
  const nextKey = useRef(1)
  const [heading, setHeading] = useState(faq?.content.heading ?? 'Frequently Asked Questions')
  const [intro, setIntro] = useState(faq?.content.intro ?? '')
  const [rows, setRows] = useState<EditorRow[]>(() => faq
    ? faq.content.items.map((item) => ({ key: `existing-${item.id}`, ...item }))
    : [{ key: 'new-0', question: '', answer: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = Boolean(
    heading.trim() && heading.trim().length <= 120 && intro.trim().length <= 300 &&
    rows.length >= 1 && rows.length <= 20 && rows.every((row) =>
      row.question.trim() && row.question.trim().length <= 200 &&
      row.answer.trim() && row.answer.trim().length <= 1000
    )
  )

  const updateRow = (key: string, values: Partial<Pick<EditorRow, 'question' | 'answer'>>) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...values } : row))
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    if (!valid) {
      setError('Add a heading and at least one complete question and answer within the displayed limits.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await upsertHomeFaq(tenantId, {
        heading: heading.trim(),
        ...(intro.trim() ? { intro: intro.trim() } : {}),
        items: rows.map(({ id, question, answer }) => ({
          ...(id ? { id } : {}),
          question: question.trim(),
          answer: answer.trim()
        }))
      }))
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save FAQ. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="w-full rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <label className="text-sm font-semibold text-fg" htmlFor={`faq-heading-${tenantId}`}>Heading</label>
      <Input className="mt-2" disabled={saving} id={`faq-heading-${tenantId}`} maxLength={120} onChange={(event) => setHeading(event.target.value)} value={heading} />
      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor={`faq-intro-${tenantId}`}>Intro <span className="font-normal text-fg-subtle">Optional</span></label>
      <Textarea className="mt-2" disabled={saving} id={`faq-intro-${tenantId}`} maxLength={300} onChange={(event) => setIntro(event.target.value)} rows={3} value={intro} />

      <div className="mt-6 space-y-4">
        {rows.map((row, index) => (
          <fieldset className="rounded-md border border-border p-4" disabled={saving} key={row.key}>
            <legend className="px-1 text-sm font-semibold text-fg">Question {index + 1}</legend>
            <label className="text-sm text-fg" htmlFor={`faq-question-${tenantId}-${row.key}`}>Question</label>
            <Input className="mt-2" id={`faq-question-${tenantId}-${row.key}`} maxLength={200} onChange={(event) => updateRow(row.key, { question: event.target.value })} value={row.question} />
            <label className="mt-4 block text-sm text-fg" htmlFor={`faq-answer-${tenantId}-${row.key}`}>Answer</label>
            <Textarea className="mt-2" id={`faq-answer-${tenantId}-${row.key}`} maxLength={1000} onChange={(event) => updateRow(row.key, { answer: event.target.value })} rows={5} value={row.answer} />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button aria-label="Move question up" className="min-h-11 min-w-11 px-3" disabled={index === 0} onClick={() => moveRow(index, -1)} type="button" variant="secondary"><ArrowIcon direction="up" /></Button>
              <Button aria-label="Move question down" className="min-h-11 min-w-11 px-3" disabled={index === rows.length - 1} onClick={() => moveRow(index, 1)} type="button" variant="secondary"><ArrowIcon direction="down" /></Button>
              <Button aria-label="Remove question" className="min-h-11 min-w-11 px-3" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} type="button" variant="danger"><TrashIcon /></Button>
            </div>
          </fieldset>
        ))}
      </div>

      <Button className="mt-4" disabled={saving || rows.length >= 20} onClick={() => setRows((current) => [...current, { key: `new-${nextKey.current++}`, question: '', answer: '' }])} type="button" variant="secondary">Add Question</Button>
      {error && <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button disabled={saving} onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={saving} type="submit">{saving ? 'Saving…' : 'Save FAQ'}</Button>
      </div>
    </form>
  )
}
