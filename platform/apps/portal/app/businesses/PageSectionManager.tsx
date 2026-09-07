'use client'

import { useState } from 'react'
import { Button, ConfirmDialog, StatusMessage } from '@bakerrang/ui'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { ApiError } from '../../lib/api'
import { duplicateSection, moveSection, removeSection, setSectionVisibility } from '../../lib/site'
import { AddSectionDialog } from './AddSectionDialog'
import { SectionCard } from './SectionCard'

export function PageSectionManager ({ onBack, onEditSection, onPreview, onRefresh, onSaved, pageId, site, tenantId }: {
  onBack: () => void
  onEditSection: (sectionId: string) => void
  onPreview: () => void
  onRefresh: () => Promise<SiteDefinition>
  onSaved: (site: SiteDefinition, feedback?: string) => void
  pageId: string
  site: SiteDefinition
  tenantId: string
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const page = site.pages.find((candidate) => candidate.id === pageId)
  if (!page) return <StatusMessage tone="error">This page is no longer available. Return to Pages and choose another page.</StatusMessage>
  const sections = page.sections
  const pageName = page.id === 'home' ? 'Home' : page.title
  const command = async (key: string, action: () => Promise<SiteDefinition>, success: string) => {
    if (pending) return
    setPending(key); setError(null)
    try { onSaved(await action(), success) } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409 || caught.status === 404)) {
        try { onSaved(await onRefresh(), 'The page changed elsewhere. Current sections were reloaded.') } catch { setError('The page changed. Refresh and try again.') }
      } else setError('Unable to update this page’s sections. Please try again.')
    } finally { setPending(null) }
  }
  const deleteSection = async () => {
    const section = sections.find((candidate) => candidate.id === deleteId)
    setDeleteId(null)
    if (!section) return
    await command(`delete:${section.id}`, () => removeSection(tenantId, pageId, section.id), `${section.type === 'businessHours' ? 'Business Hours' : 'Section'} removed.`)
  }
  const duplicate = async (sectionId: string) => {
    if (pending) return
    setPending(`duplicate:${sectionId}`); setError(null)
    try { const result = await duplicateSection(tenantId, pageId, sectionId); onSaved(result.site, 'Section duplicated.'); onEditSection(result.sectionId) } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409 || caught.status === 404)) {
        try { onSaved(await onRefresh(), 'The page changed elsewhere. Current sections were reloaded.') } catch { setError('The page changed. Refresh and try again.') }
      } else setError('Unable to duplicate this section. Please try again.')
    } finally { setPending(null) }
  }
  return <div className="min-w-0 w-full max-w-5xl rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6">
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle">Pages · {pageName}</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-fg">{pageName} sections</h2><p className="mt-1 text-sm font-medium text-fg-muted">{page.slug === '/' ? '/' : `/${page.slug}`}</p><p className="mt-1 text-sm leading-6 text-fg-muted">Arrange this page’s sections, edit an exact instance, and control visibility.</p><p className="mt-2 text-xs text-fg-subtle">Changes are saved to Working. Publish Site makes them live.</p></div>
      <div className="flex flex-wrap gap-2"><Button disabled={Boolean(pending)} onClick={() => setAddOpen(true)} type="button">Add section</Button><Button disabled={Boolean(pending)} onClick={onPreview} type="button" variant="secondary">Preview</Button><Button disabled={Boolean(pending)} onClick={onBack} type="button" variant="secondary">Back to Pages</Button></div>
    </header>
    {error && <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div>}
    {sections.length === 0 ? <div className="mt-5 rounded-md border border-dashed border-border p-6 text-center"><h3 className="font-semibold text-fg">No sections yet</h3><p className="mt-1 text-sm text-fg-muted">Add a section to start building this page.</p></div> : <ol aria-label={`${pageName} sections`} className="mt-5 space-y-3">{sections.map((section, index) => <SectionCard disabled={Boolean(pending)} index={index} key={section.id} onDelete={() => setDeleteId(section.id)} onDuplicate={() => void duplicate(section.id)} onEdit={() => onEditSection(section.id)} onMove={(direction) => void command(`move:${section.id}`, () => moveSection(tenantId, pageId, section.id, direction), 'Section order updated.')} onToggleVisibility={() => void command(`visibility:${section.id}`, () => setSectionVisibility(tenantId, pageId, section.id, !section.hidden), section.hidden ? 'Section shown.' : 'Section hidden.')} pageSections={sections} section={section} site={site} />)}</ol>}
    <AddSectionDialog onAdded={(next, sectionId) => { onSaved(next, 'Section added.'); onEditSection(sectionId) }} onClose={() => setAddOpen(false)} onRefresh={onRefresh} open={addOpen} pageId={pageId} site={site} tenantId={tenantId} />
    <ConfirmDialog busy={Boolean(pending)} cancelLabel="Keep section" confirmLabel="Delete section" description={sections.find((section) => section.id === deleteId)?.type === 'businessHours' ? 'This removes this page’s Business Hours section but keeps the global weekly schedule in Site setup.' : 'This removes the section from this page. Any uploaded media and business information remain available elsewhere.'} onCancel={() => setDeleteId(null)} onConfirm={() => void deleteSection()} open={deleteId !== null} title="Delete section?" />
  </div>
}
