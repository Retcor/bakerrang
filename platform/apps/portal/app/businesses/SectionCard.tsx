'use client'

import { useState } from 'react'
import { Badge, Button, Dialog } from '@bakerrang/ui'
import { sectionDefinitions, sectionLabel, sectionSummary } from './sectionDefinitions'
import type { SiteDefinition, SiteSection } from '@bakerrang/site-schema'

export function SectionCard ({ disabled, index, onDelete, onDuplicate, onEdit, onMove, onToggleVisibility, section, site }: {
  disabled?: boolean
  index: number
  onDelete: () => void
  onDuplicate: () => void
  onEdit: () => void
  onMove: (direction: 'up' | 'down') => void
  onToggleVisibility: () => void
  section: SiteSection
  site: SiteDefinition
}) {
  const definition = sectionDefinitions[section.type]
  const hero = section.type === 'hero'
  const ordinal = site.pages.find((page) => page.id === 'home')?.sections.filter((item) => item.type === section.type).findIndex((item) => item.id === section.id) ?? 0
  const repeated = site.pages.find((page) => page.id === 'home')?.sections.filter((item) => item.type === section.type).length ?? 0
  const instanceLabel = repeated > 1 ? `${sectionLabel(section)} ${ordinal + 1}` : sectionLabel(section)
  const editLabel = `Edit ${instanceLabel}`
  const moveUpLabel = `Move ${instanceLabel} up`
  const moveDownLabel = `Move ${instanceLabel} down`
  const [moreOpen, setMoreOpen] = useState(false)
  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-fg-subtle">Section {index + 1}</span>
            <h3 className="font-semibold text-fg">{sectionLabel(section)}</h3>
            <Badge tone={section.hidden ? 'neutral' : 'success'}>{section.hidden ? 'Hidden' : 'Visible'}</Badge>
          </div>
          <p className="mt-2 text-sm text-fg-muted">{sectionSummary(section, site)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button aria-label={editLabel} disabled={disabled} onClick={onEdit} size="sm" type="button">Edit</Button>
          {!hero && <>
            <Button aria-label={moveUpLabel} disabled={disabled || index <= 1} onClick={() => onMove('up')} size="sm" type="button" variant="secondary">↑</Button>
            <Button aria-label={moveDownLabel} disabled={disabled || index >= (site.pages.find((page) => page.id === 'home')?.sections.length ?? 1) - 1} onClick={() => onMove('down')} size="sm" type="button" variant="secondary">↓</Button>
            <div className="relative">
              <Button aria-expanded={moreOpen} aria-haspopup="dialog" aria-label={`More actions for ${instanceLabel}`} disabled={disabled} onClick={() => setMoreOpen(true)} size="sm" type="button" variant="secondary">⋯</Button>
              <Dialog description={`Choose an action for this ${sectionLabel(section)} section.`} onClose={() => setMoreOpen(false)} open={moreOpen} title={`${instanceLabel} actions`}>
                <div className="flex flex-col gap-3">
                  {definition.duplicable && <Button onClick={() => { setMoreOpen(false); onDuplicate() }} type="button">Duplicate</Button>}
                  <Button onClick={() => { setMoreOpen(false); onToggleVisibility() }} type="button" variant="secondary">{section.hidden ? 'Show' : 'Hide'}</Button>
                  <Button onClick={() => { setMoreOpen(false); onDelete() }} type="button" variant="danger">Delete</Button>
                </div>
              </Dialog>
            </div>
          </>}
          {hero && <span className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-fg-muted">Pinned</span>}
        </div>
      </div>
    </li>
  )
}
