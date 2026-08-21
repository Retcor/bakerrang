'use client'

import { useRef, useState, type FormEvent } from 'react'
import { findHomePage, isTestimonialsSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, Input, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { upsertHomeTestimonials } from '../../lib/site'

interface EditorRow {
  key: string
  id?: string
  customerName: string
  quote: string
}

export interface TestimonialsEditorProps {
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
}

export function TestimonialsEditor ({ tenantId, site, onCancel, onSaved }: TestimonialsEditorProps) {
  const testimonials = findHomePage(site)?.sections.find(isTestimonialsSection)
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
      onSaved(await upsertHomeTestimonials(tenantId, {
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
    <form className="w-full rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6" onSubmit={(event) => void handleSubmit(event)}>
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
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={index === 0} onClick={() => moveRow(index, -1)} size="sm" type="button" variant="secondary">Move Up</Button>
              <Button disabled={index === rows.length - 1} onClick={() => moveRow(index, 1)} size="sm" type="button" variant="secondary">Move Down</Button>
              <Button onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} size="sm" type="button" variant="secondary">Remove</Button>
            </div>
          </fieldset>
        ))}
      </div>

      <Button className="mt-4" disabled={saving || rows.length >= 10} onClick={() => setRows((current) => [...current, { key: `new-${nextKey.current++}`, customerName: '', quote: '' }])} size="sm" type="button" variant="secondary">Add Testimonial</Button>
      {error && <p className="mt-3 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button disabled={saving} onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={saving || !canSave} type="submit">{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </form>
  )
}
