'use client'

import { useState, type FormEvent } from 'react'
import { findHomePage, type SiteDefinition, type SiteSection } from '@bakerrang/site-schema'
import { Button } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { composeHomeSections } from '../../lib/site'

interface CompositionRow {
  id: string
  label: string
}

const sectionLabels: Record<SiteSection['type'], string> = {
  hero: 'Hero',
  services: 'Services',
  gallery: 'Gallery',
  testimonials: 'Testimonials',
  contact: 'Contact'
}

function UpIcon () {
  return <svg aria-hidden className="size-4" fill="none" viewBox="0 0 20 20"><path d="m5 12.5 5-5 5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
}

function DownIcon () {
  return <svg aria-hidden className="size-4" fill="none" viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
}

function TrashIcon () {
  return <svg aria-hidden className="size-4" fill="none" viewBox="0 0 20 20"><path d="M4.5 6h11m-7-2h3m-5.5 2 .6 10h6.8L14 6M8.5 9v4m3-4v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" /></svg>
}

export interface SectionCompositionEditorProps {
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
}

export function SectionCompositionEditor ({ tenantId, site, onCancel, onSaved }: SectionCompositionEditorProps) {
  const [rows, setRows] = useState<CompositionRow[]>(() =>
    (findHomePage(site)?.sections ?? []).map((section) => ({
      id: section.id,
      label: sectionLabels[section.type]
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const target = index + direction
      if (index <= 0 || target <= 0 || target >= current.length) return current
      const next = [...current]
      const moving = next[index]
      next[index] = next[target]
      next[target] = moving
      return next
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      onSaved(await composeHomeSections(tenantId, { sectionIds: rows.map((row) => row.id) }))
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save the section layout. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="w-full rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6" onSubmit={(event) => void handleSubmit(event)}>
      <h2 className="text-lg font-semibold text-fg">Manage Sections</h2>
      <p className="mt-2 text-sm text-fg-muted">
        Removing a section deletes its saved content from the working site. Your published site won&apos;t change until you republish.
      </p>

      <ol className="mt-5 space-y-3">
        {rows.map((row, index) => {
          const fixed = row.id === 'hero'
          return (
            <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-3" key={row.id}>
              <span className="min-w-0 flex-1 font-semibold text-fg">{row.label}</span>
              {fixed ? (
                <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-fg-muted">Fixed</span>
              ) : (
                <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5 sm:gap-2">
                  <Button aria-label={`Move ${row.label} up`} className="w-11 px-0 sm:w-auto sm:px-3" disabled={saving || index === 1} onClick={() => moveRow(index, -1)} type="button" variant="secondary"><UpIcon /><span className="hidden sm:inline">Move Up</span></Button>
                  <Button aria-label={`Move ${row.label} down`} className="w-11 px-0 sm:w-auto sm:px-3" disabled={saving || index === rows.length - 1} onClick={() => moveRow(index, 1)} type="button" variant="secondary"><DownIcon /><span className="hidden sm:inline">Move Down</span></Button>
                  <Button aria-label={`Remove ${row.label}`} className="w-11 px-0 sm:w-auto sm:px-3" disabled={saving} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} type="button" variant="secondary"><TrashIcon /><span className="hidden sm:inline">Remove</span></Button>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {error && <p className="mt-3 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button disabled={saving} onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={saving} type="submit">{saving ? 'Saving…' : 'Save Layout'}</Button>
      </div>
    </form>
  )
}
