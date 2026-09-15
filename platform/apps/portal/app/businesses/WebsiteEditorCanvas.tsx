'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import type { SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { Badge, Button } from '@bakerrang/ui'
import { sectionLabel } from './sectionDefinitions'
import { SitePreviewFrame } from './SitePreviewFrame'

type Viewport = 'desktop' | 'tablet' | 'mobile'
const viewportWidth: Record<Viewport, string> = { desktop: '100%', tablet: '834px', mobile: '390px' }
const viewportLabel: Record<Viewport, string> = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' }

function DeviceIcon ({ viewport }: { viewport: Viewport }) {
  return viewport === 'desktop'
    ? <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><rect height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="4" /><path d="M8 20h8m-4-4v4" stroke="currentColor" strokeWidth="1.8" /></svg>
    : <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><rect height={viewport === 'tablet' ? '18' : '17'} rx="2" stroke="currentColor" strokeWidth="1.8" width={viewport === 'tablet' ? '12' : '8'} x={viewport === 'tablet' ? '6' : '8'} y="3" /><path d="M11 18h2" stroke="currentColor" strokeWidth="1.8" /></svg>
}

export function WebsiteEditorCanvas ({ canSave, canonical, dirty, inspector, onManageSections, onOpenPreview, onPageSelected, onPublish, onSave, onSectionSelected, onSiteTool, page, saving, selectedSectionId, site }: {
  canSave: boolean
  canonical: SiteDefinition
  dirty: boolean
  inspector: ReactNode
  onManageSections: () => void
  onOpenPreview: () => void
  onPageSelected: (pageId: string) => void
  onPublish: () => void
  onSave: () => void
  onSectionSelected: (sectionId: string) => void
  onSiteTool: (tool: 'templates' | 'revisions') => void
  page: SitePage
  saving: boolean
  selectedSectionId?: string
  site: SiteDefinition
}) {
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const status = dirty ? { label: 'Unsaved changes', tone: 'warning' as const } : canonical.status === 'DRAFT' ? { label: 'Draft', tone: 'warning' as const } : canonical.hasUnpublishedChanges ? { label: 'Changes not published', tone: 'warning' as const } : { label: 'Published', tone: 'success' as const }
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs" data-testid="website-editor-canvas">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border bg-surface px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image alt="BakerRang" className="size-7 object-contain" height={40} src="/bakerrang-logo.png" width={40} />
          <span className="font-bold tracking-tight text-fg">Baker<span className="text-brand">Rang</span></span>
          <span aria-hidden className="text-border-strong">/</span>
          <span className="truncate text-sm font-semibold text-fg">{site.branding.siteName}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div aria-label="Preview viewport" className="hidden items-center gap-1 rounded-md border border-border bg-surface-muted p-1 sm:flex" role="group">
            {(Object.keys(viewportWidth) as Viewport[]).map((candidate) => <button aria-label={viewportLabel[candidate]} aria-pressed={viewport === candidate} className={`grid size-8 place-items-center rounded ${viewport === candidate ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'}`} key={candidate} onClick={() => setViewport(candidate)} title={viewportLabel[candidate]} type="button"><DeviceIcon viewport={candidate} /></button>)}
          </div>
          {dirty && <span className="hidden text-xs font-semibold text-warning sm:inline">Unsaved</span>}
          <Button disabled={!dirty || saving || !canSave} onClick={onSave} size="sm">{saving ? 'Saving…' : 'Save'}</Button>
          <Button disabled={saving} onClick={onPublish} size="sm" variant="secondary" className="!border-brand-ink !bg-brand-ink !text-white hover:!bg-sidebar">Publish</Button>
          <Button className="hidden sm:inline-flex" disabled={saving || dirty} onClick={onOpenPreview} size="sm" variant="ghost">Open preview</Button>
        </div>
      </header>
      <div className="grid min-w-0 lg:grid-cols-[23rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-border bg-surface-muted/55 lg:border-r lg:border-b-0" aria-label="Website builder controls">
          <div className="max-h-[46rem] overflow-y-auto p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Page</p>
            <div className="mt-2 space-y-1" role="list" aria-label="Website pages">
              {site.pages.map((candidate) => <button aria-current={candidate.id === page.id ? 'page' : undefined} className={`flex min-h-11 w-full items-center justify-between rounded-md px-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${candidate.id === page.id ? 'bg-surface text-fg shadow-xs ring-1 ring-border' : 'text-fg-muted hover:bg-surface hover:text-fg'}`} key={candidate.id} onClick={() => onPageSelected(candidate.id)} type="button"><span className="truncate">{candidate.id === 'home' ? 'Home' : candidate.title}</span><span className="text-xs font-medium text-fg-subtle">{candidate.sections.length}</span></button>)}
            </div>
            <div className="mt-6 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Sections</p><button aria-label="Manage sections" className="grid size-8 place-items-center rounded text-fg-muted hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={onManageSections} type="button">+</button></div>
            <div className="mt-2 space-y-1" role="list" aria-label={`Sections on ${page.title}`}>
              {page.sections.map((section) => {
                const selected = section.id === selectedSectionId
                return <button aria-current={selected ? 'true' : undefined} className={`flex min-h-11 w-full items-center gap-2 rounded-md border px-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected ? 'border-brand bg-brand-subtle text-fg ring-1 ring-brand/35' : 'border-transparent text-fg-muted hover:border-border hover:bg-surface hover:text-fg'}`} key={section.id} onClick={() => onSectionSelected(section.id)} type="button"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{sectionLabel(section)}</span>{section.hidden && <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-fg-subtle">Hidden</span>}</button>
              })}
            </div>
            <div className="mt-6">{inspector}</div>
          </div>
          <div className="border-t border-border p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Site tools</p>
            <div className="mt-2 grid gap-1"><button className="min-h-11 rounded-md px-3 text-left text-sm font-semibold text-fg-muted hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={() => onSiteTool('templates')} type="button">Templates</button><button className="min-h-11 rounded-md px-3 text-left text-sm font-semibold text-fg-muted hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={() => onSiteTool('revisions')} type="button">Revision History</button></div>
          </div>
        </aside>
        <div className="order-first min-w-0 bg-bg p-3 sm:p-5 lg:order-none" data-testid="website-preview-canvas">
          <div className="mx-auto overflow-hidden rounded-lg border border-border bg-surface shadow-sm" style={{ maxWidth: viewportWidth[viewport] }}>
            <div className="flex h-8 items-center justify-between border-b border-border bg-surface-muted px-3 text-[0.6875rem] font-semibold text-fg-subtle"><span>Live preview</span><span data-testid="preview-viewport-width">{viewport === 'desktop' ? 'Desktop' : `${viewportWidth[viewport]}`}</span></div>
            <SitePreviewFrame onPageSelected={onPageSelected} onSectionSelected={onSectionSelected} pageId={page.id} site={site} viewport={viewport} />
          </div>
        </div>
      </div>
    </section>
  )
}
