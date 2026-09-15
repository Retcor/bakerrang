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

function ExternalPreviewIcon () {
  return <svg aria-hidden className="size-3.5" fill="none" viewBox="0 0 24 24"><path d="M14 4h6v6m0-6-9 9m7 0v6H5V6h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
}

function PublishIcon () {
  return <svg aria-hidden className="size-3.5" fill="none" viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
}

function SiteToolIcon ({ type }: { type: 'templates' | 'revisions' }) {
  return type === 'templates'
    ? <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.7" width="7" x="3" y="3" /><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.7" width="7" x="14" y="3" /><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.7" width="7" x="3" y="14" /><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.7" width="7" x="14" y="14" /></svg>
    : <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" /><path d="M12 7v5l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
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
    <section className="flex min-h-[calc(100svh-4rem)] min-w-0 flex-col overflow-hidden bg-surface lg:h-full lg:min-h-0" data-testid="website-editor-canvas">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border bg-surface px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image alt="BakerRang" className="size-7 shrink-0 object-contain" height={40} src="/bakerrang-logo.png" width={40} />
          <span className="hidden whitespace-nowrap text-sm font-bold tracking-tight text-fg sm:inline">Baker<span className="text-brand">Rang</span></span>
          <span aria-hidden className="hidden text-border-strong sm:inline">/</span>
          <span className="hidden whitespace-nowrap text-sm font-semibold text-fg md:inline">Website</span>
          <span className="hidden text-border-strong md:inline" aria-hidden>/</span>
          <span className="truncate text-sm font-semibold text-fg">{site.branding.siteName}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          <div aria-label="Preview viewport" className="hidden items-center gap-1 rounded-md border border-border bg-surface-muted p-1 shadow-xs sm:flex" role="group">
            {(Object.keys(viewportWidth) as Viewport[]).map((candidate) => <button aria-label={viewportLabel[candidate]} aria-pressed={viewport === candidate} className={`grid size-8 place-items-center rounded ${viewport === candidate ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'}`} key={candidate} onClick={() => setViewport(candidate)} title={viewportLabel[candidate]} type="button"><DeviceIcon viewport={candidate} /></button>)}
          </div>
          <span className="hidden min-w-12 text-right text-xs font-medium tabular-nums text-fg-subtle xl:inline">{viewport === 'desktop' ? 'Full width' : viewportWidth[viewport]}</span>
          {dirty && <span className="hidden items-center gap-2 whitespace-nowrap text-xs font-semibold text-warning sm:inline-flex"><span aria-hidden className="size-1.5 rounded-full bg-warning ring-2 ring-warning-subtle" />Unsaved</span>}
          <Button className="hidden sm:inline-flex" disabled={saving || dirty} onClick={onOpenPreview} size="sm" variant="ghost"><ExternalPreviewIcon />Preview</Button>
          <Button disabled={!dirty || saving || !canSave} onClick={onSave} size="sm">{saving ? 'Saving…' : 'Save'}</Button>
          <Button className="!border-brand-ink !bg-brand-ink !text-white hover:!bg-sidebar disabled:!border-sidebar disabled:!bg-sidebar disabled:!text-sidebar-muted disabled:!shadow-none" disabled={saving || dirty} onClick={onPublish} size="sm" variant="secondary"><PublishIcon />Publish</Button>
        </div>
      </header>
      <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 min-w-0 flex-col border-b border-border bg-surface lg:border-r lg:border-b-0" aria-label="Website builder controls">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Page</p>
            <div className="mt-2 space-y-1" role="list" aria-label="Website pages">
              {site.pages.map((candidate) => <button aria-current={candidate.id === page.id ? 'page' : undefined} className={`flex min-h-10 w-full items-center justify-between rounded-md border px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${candidate.id === page.id ? 'border-border-strong bg-surface text-fg shadow-xs' : 'border-transparent text-fg-muted hover:bg-surface-muted hover:text-fg'}`} key={candidate.id} onClick={() => onPageSelected(candidate.id)} type="button"><span className="truncate">{candidate.id === 'home' ? 'Home' : candidate.title}</span><span className="text-xs font-medium text-fg-subtle">{candidate.sections.length} {candidate.sections.length === 1 ? 'section' : 'sections'}</span></button>)}
            </div>
            <div className="mt-6 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Sections</p><button aria-label="Manage sections" className="grid size-7 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={onManageSections} type="button">+</button></div>
            <div className="mt-2 space-y-1" role="list" aria-label={`Sections on ${page.title}`}>
              {page.sections.map((section) => {
                const selected = section.id === selectedSectionId
                return <button aria-current={selected ? 'true' : undefined} className={`flex min-h-10 w-full items-center gap-2 rounded-md border px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected ? 'border-brand/70 bg-brand-subtle text-brand-ink shadow-[inset_0_0_0_1px_rgb(254_197_28_/_0.24)]' : 'border-transparent text-fg-muted hover:border-border hover:bg-surface-muted hover:text-fg'}`} key={section.id} onClick={() => onSectionSelected(section.id)} type="button"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{sectionLabel(section)}</span>{section.hidden && <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-fg-subtle">Hidden</span>}</button>
              })}
            </div>
            <div className="mt-6">{inspector}</div>
          </div>
          <div className="border-t border-border bg-surface-muted px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Site tools</p>
            <div className="mt-2 grid gap-1"><button className="flex min-h-10 items-center gap-2 rounded-md px-2.5 text-left text-sm font-semibold text-fg-muted transition-colors hover:bg-surface hover:text-fg hover:shadow-xs focus-visible:outline-2 focus-visible:outline-focus" onClick={() => onSiteTool('templates')} type="button"><SiteToolIcon type="templates" />Templates <span aria-hidden className="ml-auto text-fg-subtle">›</span></button><button className="flex min-h-10 items-center gap-2 rounded-md px-2.5 text-left text-sm font-semibold text-fg-muted transition-colors hover:bg-surface hover:text-fg hover:shadow-xs focus-visible:outline-2 focus-visible:outline-focus" onClick={() => onSiteTool('revisions')} type="button"><SiteToolIcon type="revisions" />Revision History <span aria-hidden className="ml-auto text-fg-subtle">›</span></button></div>
          </div>
        </aside>
        <div className="order-first min-h-0 min-w-0 overflow-auto bg-bg p-4 sm:p-6 lg:order-none" data-testid="website-preview-canvas">
          <div className="mx-auto min-h-0 overflow-hidden rounded-lg border border-border bg-surface shadow-md" style={{ maxWidth: viewportWidth[viewport] }}>
            <div className="flex min-h-9 items-center gap-3 border-b border-border bg-surface-muted px-3 text-xs font-semibold text-fg-subtle"><span aria-hidden className="flex gap-1"><i className="size-2 rounded-full bg-border-strong" /><i className="size-2 rounded-full bg-border-strong" /><i className="size-2 rounded-full bg-border-strong" /></span><span className="mx-auto inline-flex items-center gap-1.5 uppercase tracking-[0.08em]"><i aria-hidden className="size-1.5 rounded-full bg-success" />Live preview</span><span data-testid="preview-viewport-width" className="min-w-14 text-right tabular-nums">{viewport === 'desktop' ? 'Desktop' : `${viewportWidth[viewport]}`}</span></div>
            <SitePreviewFrame onPageSelected={onPageSelected} onSectionSelected={onSectionSelected} pageId={page.id} selectedSectionId={selectedSectionId} site={site} viewport={viewport} />
          </div>
        </div>
      </div>
    </section>
  )
}
