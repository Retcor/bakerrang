'use client'

import { useState, type FormEvent } from 'react'
import { findHomePage, type SiteDefinition, type SiteSection } from '@bakerrang/site-schema'
import { ApiError } from '../../lib/api'
import { composeHomeSections } from '../../lib/site'
import { RowActions } from './RowActions'
import { WebsiteEditorShell } from './WebsiteEditorShell'

interface CompositionRow {
  id: string
  label: string
}

const sectionLabels: Record<SiteSection['type'], string> = {
  hero: 'Hero',
  about: 'About',
  services: 'Services',
  gallery: 'Gallery',
  testimonials: 'Testimonials',
  faq: 'FAQ',
  businessHours: 'Business Hours',
  contact: 'Contact'
}

export interface SectionCompositionEditorProps {
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
  onDirtyChange?: (dirty: boolean) => void
}

export function SectionCompositionEditor ({ tenantId, site, onCancel, onDirtyChange = () => {}, onSaved }: SectionCompositionEditorProps) {
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
    <WebsiteEditorShell dirtyValue={rows.map((row) => row.id)} editor="sections" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void handleSubmit(event)} saving={saving} width="wide">
      <p className="text-sm leading-6 text-fg-muted">
        These sections appear on your homepage. Their order also controls homepage navigation order. Removing a homepage section does not necessarily delete reusable business information; for example, removing Hours here keeps the weekly schedule.
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
                <RowActions className="ml-auto shrink-0 justify-end" moveUp={{ label: 'Move homepage section up', onClick: () => moveRow(index, -1), disabled: saving || index === 1 }} moveDown={{ label: 'Move homepage section down', onClick: () => moveRow(index, 1), disabled: saving || index === rows.length - 1 }} remove={{ label: 'Remove homepage section', onClick: () => setRows((current) => current.filter((item) => item.id !== row.id)), disabled: saving }} />
              )}
            </li>
          )
        })}
      </ol>

    </WebsiteEditorShell>
  )
}
