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
    <form className="w-full max-w-xl rounded-md border border-border bg-surface p-4 text-left" onSubmit={(event) => void handleSubmit(event)}>
      <h2 className="text-lg font-semibold text-fg">Manage Sections</h2>
      <p className="mt-2 text-sm text-fg-muted">
        Removing a section deletes its saved content from the working site. Your published site won&apos;t change until you republish.
      </p>

      <ol className="mt-5 space-y-3">
        {rows.map((row, index) => {
          const fixed = row.id === 'hero'
          return (
            <li className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-bg p-3" key={row.id}>
              <span className="min-w-0 flex-1 font-semibold text-fg">{row.label}</span>
              {fixed ? (
                <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-fg-muted">Fixed</span>
              ) : (
                <>
                  <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving || index === 1} onClick={() => moveRow(index, -1)} type="button">Move Up</Button>
                  <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving || index === rows.length - 1} onClick={() => moveRow(index, 1)} type="button">Move Down</Button>
                  <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} type="button">Remove</Button>
                </>
              )}
            </li>
          )
        })}
      </ol>

      {error && <p className="mt-3 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving} onClick={onCancel} type="button">Cancel</Button>
        <Button className="min-h-9 px-3 py-1.5 text-xs" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save Layout'}</Button>
      </div>
    </form>
  )
}
