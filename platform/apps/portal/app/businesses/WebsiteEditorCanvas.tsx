'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import type { SiteDefinition, SitePage, SiteSection } from '@bakerrang/site-schema'
import { Badge, Button } from '@bakerrang/ui'
import { sectionLabel } from './sectionDefinitions'
import { SitePreviewFrame } from './SitePreviewFrame'
import { ChevronRightIcon, SiteToolIcon } from './SiteToolMenu'

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

function VisibilityIcon ({ hidden }: { hidden: boolean }) {
  return hidden
    ? <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="M3 3 21 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.7 10.7 0 0 1 12 5c5.1 0 8.6 5.1 8.6 7s-1.2 3.3-3 4.7M6.2 6.2C4.3 7.7 3.4 10.2 3.4 12c0 1.9 3.5 7 8.6 7 1 0 1.9-.2 2.8-.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
    : <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="M3.5 12S7 5 12 5s8.5 7 8.5 7-3.5 7-8.5 7-8.5-7-8.5-7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" /></svg>
}

function LockIcon () {
  return <svg aria-hidden className="size-3.5" fill="none" viewBox="0 0 24 24"><rect height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8" width="12" x="6" y="11" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>
}

export function WebsiteEditorCanvas ({ canSave, canonical, dirty, fullScreenContext, fullScreenTool, inspector, onAddSection, onOpenPreview, onOpenSiteTools, onPageSelected, onPublish, onSave, onSectionSelected, onToggleVisibility, page, railOverride, saving, selectedSectionId, site, visibilityDisabled, visibilityDisabledReason }: {
  canSave: boolean
  canonical: SiteDefinition
  dirty: boolean
  fullScreenContext?: string
  fullScreenTool?: ReactNode
  inspector: ReactNode
  onAddSection: () => void
  onOpenPreview: () => void
  onOpenSiteTools: () => void
  onPageSelected: (pageId: string) => void
  onPublish: () => void
  onSave: () => void
  onSectionSelected: (sectionId: string) => void
  onToggleVisibility: (section: SiteSection) => void
  page: SitePage
  railOverride?: ReactNode
  saving: boolean
  selectedSectionId?: string
  site: SiteDefinition
  visibilityDisabled: boolean
  visibilityDisabledReason?: string
}) {
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const status = dirty ? { label: 'Unsaved changes', tone: 'warning' as const } : canonical.status === 'DRAFT' ? { label: 'Draft', tone: 'warning' as const } : canonical.hasUnpublishedChanges ? { label: 'Changes not published', tone: 'warning' as const } : { label: 'Published', tone: 'success' as const }
  return (
    <section className="flex min-h-[calc(100svh-4rem)] min-w-0 w-full max-w-full flex-col overflow-hidden bg-surface lg:h-full lg:min-h-0" data-testid="website-editor-canvas">
      <header className="flex min-h-14 min-w-0 w-full max-w-full flex-wrap items-center gap-3 overflow-hidden border-b border-border bg-surface px-3 py-2 sm:px-4">
        <div className="flex w-full min-w-0 items-center gap-2.5 sm:w-auto">
          <Image alt="BakerRang" className="size-7 shrink-0 object-contain" height={40} src="/bakerrang-logo.png" width={40} />
          <span className="hidden whitespace-nowrap text-sm font-bold tracking-tight text-fg sm:inline">Baker<span className="text-brand">Rang</span></span>
          <span aria-hidden className="hidden text-border-strong sm:inline">/</span>
          <span className="hidden whitespace-nowrap text-sm font-semibold text-fg md:inline">Website</span>
          <span className="hidden text-border-strong md:inline" aria-hidden>/</span>
          <span className="min-w-0 truncate text-sm font-semibold text-fg">{site.branding.siteName}</span>
          {fullScreenTool ? <span className="shrink-0"><Badge>{fullScreenContext}</Badge></span> : <span className="shrink-0"><Badge tone={status.tone}>{status.label}</Badge></span>}
        </div>
        <div className="ml-auto flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-2.5">
          {!fullScreenTool && <div aria-label="Preview viewport" className="hidden items-center gap-1 rounded-md border border-border bg-surface-muted p-1 shadow-xs sm:flex" role="group">
            {(Object.keys(viewportWidth) as Viewport[]).map((candidate) => <button aria-label={viewportLabel[candidate]} aria-pressed={viewport === candidate} className={`grid size-8 place-items-center rounded ${viewport === candidate ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'}`} key={candidate} onClick={() => setViewport(candidate)} title={viewportLabel[candidate]} type="button"><DeviceIcon viewport={candidate} /></button>)}
          </div>}
          {!fullScreenTool && <span className="hidden min-w-12 text-right text-xs font-medium tabular-nums text-fg-subtle xl:inline">{viewport === 'desktop' ? 'Full width' : viewportWidth[viewport]}</span>}
          {!fullScreenTool && dirty && <span className="hidden items-center gap-2 whitespace-nowrap text-xs font-semibold text-warning sm:inline-flex"><span aria-hidden className="size-1.5 rounded-full bg-warning ring-2 ring-warning-subtle" />Unsaved</span>}
          <Button className={fullScreenTool ? undefined : 'hidden sm:inline-flex'} disabled={Boolean(fullScreenTool) || saving || dirty} onClick={onOpenPreview} size="sm" variant="ghost"><ExternalPreviewIcon />Preview</Button>
          <Button disabled={Boolean(fullScreenTool) || !dirty || saving || !canSave} onClick={onSave} size="sm">{saving ? 'Saving…' : 'Save'}</Button>
          <Button className="!border-brand-ink !bg-brand-ink !text-white hover:!bg-sidebar disabled:!border-sidebar disabled:!bg-sidebar disabled:!text-sidebar-muted disabled:!shadow-none" disabled={Boolean(fullScreenTool) || saving || dirty} onClick={onPublish} size="sm" variant="secondary"><PublishIcon />Publish</Button>
        </div>
      </header>
      {fullScreenTool ? <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">{fullScreenTool}</div> : <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 min-w-0 flex-col border-b border-border bg-surface lg:border-r lg:border-b-0" aria-label="Website builder controls">
          {railOverride ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{railOverride}</div> : <><div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Page</p>
            <div className="mt-2 space-y-1" role="list" aria-label="Website pages">
              {site.pages.map((candidate) => <button aria-current={candidate.id === page.id ? 'page' : undefined} className={`flex min-h-10 w-full items-center justify-between rounded-md border px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${candidate.id === page.id ? 'border-border-strong bg-surface text-fg shadow-xs' : 'border-transparent text-fg-muted hover:bg-surface-muted hover:text-fg'}`} key={candidate.id} onClick={() => onPageSelected(candidate.id)} type="button"><span className="truncate">{candidate.id === 'home' ? 'Home' : candidate.title}</span><span className="text-xs font-medium text-fg-subtle">{candidate.sections.length} {candidate.sections.length === 1 ? 'section' : 'sections'}</span></button>)}
            </div>
            <div className="mt-6 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Sections</p><button aria-label="Add section" className="grid size-7 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={onAddSection} type="button">+</button></div>
            <div className="mt-2 space-y-1" role="list" aria-label={`Sections on ${page.title}`}>
              {page.sections.map((section) => {
                const selected = section.id === selectedSectionId
                const isHero = section.type === 'hero'
                const visibilityLabel = section.hidden ? `Show ${sectionLabel(section)}` : `Hide ${sectionLabel(section)}`
                return <div aria-current={selected ? 'true' : undefined} className={`flex min-h-10 w-full items-center gap-1 rounded-md border pl-3 pr-1 text-left transition-colors ${selected ? 'border-brand/70 bg-brand-subtle text-brand-ink shadow-[inset_0_0_0_1px_rgb(254_197_28_/_0.24)]' : `border-transparent text-fg-muted hover:border-border hover:bg-surface-muted hover:text-fg ${section.hidden ? 'opacity-60' : ''}`}`} key={section.id}>
                  <button className="min-w-0 flex-1 self-stretch truncate text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => onSectionSelected(section.id)} type="button">{sectionLabel(section)}</button>
                  {section.hidden && <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-fg-subtle">Hidden</span>}
                  {isHero
                    ? <span aria-label="Hero is always visible" className="grid size-8 place-items-center text-fg-subtle" title="Hero is always visible"><LockIcon /></span>
                    : <button aria-describedby={visibilityDisabledReason ? 'section-visibility-disabled-reason' : undefined} aria-label={visibilityLabel} className="grid size-8 place-items-center rounded text-fg-muted transition-colors hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-50" disabled={visibilityDisabled} onClick={() => onToggleVisibility(section)} title={visibilityDisabledReason ?? visibilityLabel} type="button"><VisibilityIcon hidden={Boolean(section.hidden)} /></button>}
                </div>
              })}
            </div>
            {visibilityDisabledReason && <p className="mt-2 text-xs leading-5 text-fg-subtle" id="section-visibility-disabled-reason">{visibilityDisabledReason}</p>}
            <div className="mt-6">{inspector}</div>
          </div>
          <div className="border-t border-border bg-surface-muted px-4 py-3">
            <button aria-label="Site tools" className="flex min-h-[3.25rem] w-full items-center gap-3 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left shadow-xs transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus" data-testid="site-tools-launcher" onClick={onOpenSiteTools} type="button"><span className="grid size-[2.125rem] shrink-0 place-items-center rounded-[0.5625rem] bg-brand-subtle text-brand-ink"><SiteToolIcon type="siteTools" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-fg">Site tools</span><span className="mt-0.5 block text-xs leading-4 text-fg-subtle">Theme, branding, header, footer, SEO &amp; more</span></span><ChevronRightIcon className="size-4 shrink-0 text-fg-subtle" /></button>
          </div></>}
        </aside>
        <div className="order-first min-h-0 min-w-0 overflow-auto bg-bg p-4 sm:p-6 lg:order-none" data-testid="website-preview-canvas">
          <div className="mx-auto min-h-0 overflow-hidden rounded-lg border border-border bg-surface shadow-md" style={{ maxWidth: viewportWidth[viewport] }}>
            <div className="flex min-h-9 items-center gap-3 border-b border-border bg-surface-muted px-3 text-xs font-semibold text-fg-subtle"><span aria-hidden className="flex gap-1"><i className="size-2 rounded-full bg-border-strong" /><i className="size-2 rounded-full bg-border-strong" /><i className="size-2 rounded-full bg-border-strong" /></span><span className="mx-auto inline-flex items-center gap-1.5 uppercase tracking-[0.08em]"><i aria-hidden className="size-1.5 rounded-full bg-success" />Live preview</span><span data-testid="preview-viewport-width" className="min-w-14 text-right tabular-nums">{viewport === 'desktop' ? 'Desktop' : `${viewportWidth[viewport]}`}</span></div>
            <SitePreviewFrame onPageSelected={onPageSelected} onSectionSelected={onSectionSelected} pageId={page.id} selectedSectionId={selectedSectionId} site={site} viewport={viewport} />
          </div>
        </div>
      </div>}
    </section>
  )
}
