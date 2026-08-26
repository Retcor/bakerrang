'use client'

import { useRef, useState, type FormEvent } from 'react'
import { findHomePage, isFaqSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, Field, Input, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { upsertHomeFaq } from '../../lib/site'
import { RowActions } from './RowActions'
import { WebsiteEditorShell } from './WebsiteEditorShell'

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
  onDirtyChange?: (dirty: boolean) => void
}

export function FaqEditor ({ tenantId, site, onCancel, onDirtyChange = () => {}, onSaved }: FaqEditorProps) {
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
    <WebsiteEditorShell dirtyValue={{ heading: heading.trim(), intro: intro.trim(), items: rows.map(({ id, question, answer }) => ({ id, question: question.trim(), answer: answer.trim() })) }} editor="faq" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void handleSubmit(event)} saving={saving} width="wide">
      <Field id={`faq-heading-${tenantId}`} label="Heading"><Input className="mt-2" disabled={saving} maxLength={120} onChange={(event) => setHeading(event.target.value)} value={heading} /></Field>
      <Field className="mt-5" id={`faq-intro-${tenantId}`} label="Intro" optional><Textarea className="mt-2" disabled={saving} maxLength={300} onChange={(event) => setIntro(event.target.value)} rows={3} value={intro} /></Field>

      <div className="mt-6 space-y-4">
        {rows.map((row, index) => (
          <fieldset className="rounded-md border border-border p-4" disabled={saving} key={row.key}>
            <legend className="px-1 text-sm font-semibold text-fg">Question {index + 1}</legend>
            <label className="text-sm text-fg" htmlFor={`faq-question-${tenantId}-${row.key}`}>Question</label>
            <Input className="mt-2" id={`faq-question-${tenantId}-${row.key}`} maxLength={200} onChange={(event) => updateRow(row.key, { question: event.target.value })} value={row.question} />
            <label className="mt-4 block text-sm text-fg" htmlFor={`faq-answer-${tenantId}-${row.key}`}>Answer</label>
            <Textarea className="mt-2" id={`faq-answer-${tenantId}-${row.key}`} maxLength={1000} onChange={(event) => updateRow(row.key, { answer: event.target.value })} rows={5} value={row.answer} />
            <RowActions className="mt-3 justify-end" moveUp={{ label: 'Move FAQ item up', onClick: () => moveRow(index, -1), disabled: index === 0 }} moveDown={{ label: 'Move FAQ item down', onClick: () => moveRow(index, 1), disabled: index === rows.length - 1 }} remove={{ label: 'Remove FAQ item', onClick: () => setRows((current) => current.filter((item) => item.key !== row.key)), disabled: rows.length === 1 }} />
          </fieldset>
        ))}
      </div>

      <Button className="mt-4" disabled={saving || rows.length >= 20} onClick={() => setRows((current) => [...current, { key: `new-${nextKey.current++}`, question: '', answer: '' }])} type="button" variant="secondary">Add Question</Button>
    </WebsiteEditorShell>
  )
}
