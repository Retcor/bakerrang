'use client'

import { useRef, useState, type FormEvent } from 'react'
import { isTestimonialsSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, Input, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSectionContent } from '../../lib/site'
import { RowActions } from './RowActions'
import { WebsiteEditorShell } from './WebsiteEditorShell'

interface EditorRow {
  key: string
  id?: string
  customerName: string
  quote: string
}

export interface TestimonialsEditorProps {
  pageId: string
  sectionId: string
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
  onDirtyChange?: (dirty: boolean) => void
}

export function TestimonialsEditor ({ pageId, sectionId, tenantId, site, onCancel, onDirtyChange = () => {}, onSaved }: TestimonialsEditorProps) {
  const page = site.pages.find((candidate) => candidate.id === pageId)
  const selectedTestimonials = page?.sections.find((section) => section.id === sectionId)
  const testimonials = selectedTestimonials && isTestimonialsSection(selectedTestimonials) ? selectedTestimonials : undefined
  const nextKey = useRef(1)
  const [title, setTitle] = useState(testimonials?.content.title ?? 'Testimonials')
  const [rows, setRows] = useState<EditorRow[]>(() => testimonials
    ? testimonials.content.items.map((item) => ({
      key: `existing-${item.id}`,
      id: item.id,
      customerName: item.customerName,
      quote: item.quote
    }))
    : [{ key: 'new-0', customerName: '', quote: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSave = Boolean(
    title.trim() &&
    rows.length > 0 &&
    rows.length <= 10 &&
    rows.every((row) => row.customerName.trim() && row.quote.trim())
  )

  const updateRow = (key: string, values: Partial<Pick<EditorRow, 'customerName' | 'quote'>>) => {
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
    if (saving || !canSave) return

    setSaving(true)
    setError(null)
    try {
      if (!testimonials) throw new Error('Testimonials section is unavailable')
      onSaved(await updateSectionContent(tenantId, pageId, testimonials.id, {
        title: title.trim(),
        items: rows.map(({ id, customerName, quote }) => ({
          ...(id ? { id } : {}),
          customerName: customerName.trim(),
          quote: quote.trim()
        }))
      }))
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save Testimonials. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WebsiteEditorShell dirtyValue={{ title: title.trim(), items: rows.map(({ id, customerName, quote }) => ({ id, customerName: customerName.trim(), quote: quote.trim() })) }} editor="testimonials" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void handleSubmit(event)} saveDisabled={!canSave} saving={saving} width="wide">
      <label className="text-sm font-semibold text-fg" htmlFor={`testimonials-title-${tenantId}`}>Section Title</label>
      <Input className="mt-2" disabled={saving} id={`testimonials-title-${tenantId}`} maxLength={100} onChange={(event) => setTitle(event.target.value)} value={title} />

      <div className="mt-5 space-y-4">
        {rows.map((row, index) => (
          <fieldset className="rounded-md border border-border p-4" disabled={saving} key={row.key}>
            <legend className="px-1 text-sm font-semibold text-fg">Testimonial {index + 1}</legend>
            <label className="text-sm text-fg" htmlFor={`testimonial-name-${tenantId}-${row.key}`}>Customer Name</label>
            <Input className="mt-2" id={`testimonial-name-${tenantId}-${row.key}`} maxLength={120} onChange={(event) => updateRow(row.key, { customerName: event.target.value })} value={row.customerName} />
            <label className="mt-4 block text-sm text-fg" htmlFor={`testimonial-quote-${tenantId}-${row.key}`}>Quote</label>
            <Textarea className="mt-2" id={`testimonial-quote-${tenantId}-${row.key}`} maxLength={1000} onChange={(event) => updateRow(row.key, { quote: event.target.value })} value={row.quote} />
            <RowActions className="mt-3" moveUp={{ label: 'Move testimonial up', onClick: () => moveRow(index, -1), disabled: index === 0 }} moveDown={{ label: 'Move testimonial down', onClick: () => moveRow(index, 1), disabled: index === rows.length - 1 }} remove={{ label: 'Remove testimonial', onClick: () => setRows((current) => current.filter((item) => item.key !== row.key)) }} />
          </fieldset>
        ))}
      </div>

      <Button className="mt-4" disabled={saving || rows.length >= 10} onClick={() => setRows((current) => [...current, { key: `new-${nextKey.current++}`, customerName: '', quote: '' }])} size="sm" type="button" variant="secondary">Add Testimonial</Button>
    </WebsiteEditorShell>
  )
}
