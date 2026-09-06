'use client'

import { useState } from 'react'
import { Button, ConfirmDialog, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { duplicateSection, moveSection, removeSection, setSectionVisibility } from '../../lib/site'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { AddSectionDialog } from './AddSectionDialog'
import { SectionCard } from './SectionCard'
import { homeSections } from './sectionDefinitions'

export function HomepageSectionManager ({ onEditSection, onRefresh, onSaved, onBack, site, tenantId }: {
  onBack: () => void
  onEditSection: (sectionId: string) => void
  onRefresh: () => Promise<SiteDefinition>
  onSaved: (site: SiteDefinition, feedback?: string) => void
  site: SiteDefinition
  tenantId: string
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const sections = homeSections(site)

  const command = async (key: string, action: () => Promise<SiteDefinition>, success: string) => {
    if (pending) return
    setPending(key); setError(null)
    try { onSaved(await action(), success) } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
        try { onSaved(await onRefresh(), 'The homepage changed elsewhere. Current sections were reloaded.') } catch { setError('The homepage changed. Refresh and try again.') }
      } else setError('Unable to update the homepage sections. Please try again.')
    } finally { setPending(null) }
  }

  const deleteSection = async () => {
    if (!deleteId) return
    const section = sections.find((candidate) => candidate.id === deleteId)
    setDeleteId(null)
    if (!section) return
    await command(`delete:${section.id}`, () => removeSection(tenantId, section.id), `${section.type === 'businessHours' ? 'Business Hours' : 'Homepage section'} removed.`)
  }

  const duplicate = async (sectionId: string) => {
    if (pending) return
    setPending(`duplicate:${sectionId}`); setError(null)
    try {
      const result = await duplicateSection(tenantId, sectionId)
      onSaved(result.site, 'Section duplicated.')
      onEditSection(result.sectionId)
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
        try { onSaved(await onRefresh(), 'The homepage changed elsewhere. Current sections were reloaded.') } catch { setError('The homepage changed. Refresh and try again.') }
      } else setError('Unable to duplicate this section. Please try again.')
    } finally { setPending(null) }
  }

  return <div className="min-w-0 w-full max-w-5xl rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6">
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle">Homepage</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-fg">Homepage sections</h2><p className="mt-1 text-sm leading-6 text-fg-muted">Arrange the sections visitors see, edit an exact instance, and control visibility. Hero stays pinned at the top.</p><p className="mt-2 text-xs text-fg-subtle">Changes are saved to your working site. Publish to update the public site.</p></div>
      <div className="flex flex-wrap gap-2"><Button disabled={Boolean(pending)} onClick={() => setAddOpen(true)} type="button">Add section</Button><Button disabled={Boolean(pending)} onClick={onBack} type="button" variant="secondary">Back to overview</Button></div>
    </header>
    {error && <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div>}
    <ol aria-label="Homepage sections" className="mt-5 space-y-3">
      {sections.map((section, index) => <SectionCard disabled={Boolean(pending)} index={index} key={section.id} onDelete={() => setDeleteId(section.id)} onDuplicate={() => void duplicate(section.id)} onEdit={() => onEditSection(section.id)} onMove={(direction) => void command(`move:${section.id}`, () => moveSection(tenantId, section.id, direction), 'Section order updated.')} onToggleVisibility={() => void command(`visibility:${section.id}`, () => setSectionVisibility(tenantId, section.id, !section.hidden), section.hidden ? 'Section shown.' : 'Section hidden.')} section={section} site={site} />)}
    </ol>
    <AddSectionDialog onAdded={(next, sectionId) => { onSaved(next, 'Section added.'); onEditSection(sectionId) }} onClose={() => setAddOpen(false)} onRefresh={onRefresh} open={addOpen} site={site} tenantId={tenantId} />
    <ConfirmDialog busy={Boolean(pending)} cancelLabel="Keep section" confirmLabel="Delete section" description={sections.find((section) => section.id === deleteId)?.type === 'businessHours' ? 'This removes the homepage Business Hours section but keeps the weekly schedule in Site setup. Existing schedule data is not deleted.' : 'This removes the homepage section. Any uploaded media and business information remain available elsewhere unless separately removed.'} onCancel={() => setDeleteId(null)} onConfirm={() => void deleteSection()} open={deleteId !== null} title="Delete homepage section?" />
  </div>
}
