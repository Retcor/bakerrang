'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { Badge, Button, ConfirmDialog, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getSiteRevision, getSiteRevisions, restoreSiteRevision, type SiteRevision } from '../../lib/site'
import { SitePreviewFrame } from './SitePreviewFrame'
import { ChevronRightIcon } from './SiteToolMenu'

const restoreDescription = 'This replaces the working site with this published snapshot. It does not change the live site, the publication record, or revision history. Your site keeps its current publication status, and you must choose Publish before the restored version goes live.'
function publishedDateTime (value: number) { return Number.isSafeInteger(value) && value >= 0 ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value) : 'Unknown publication date' }
function pageCountLabel (count: number) { return `${count} ${count === 1 ? 'page' : 'pages'}` }

export function RevisionHistoryEditor ({ onBack, onSaved, tenantId }: {
  onBack: () => void
  onSaved: (site: SiteDefinition) => void
  tenantId: string
}) {
  const [revisions, setRevisions] = useState<SiteRevision[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SiteRevision | null>(null)
  const [snapshot, setSnapshot] = useState<SiteDefinition | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const load = useCallback(async (selectLatest = true) => {
    try {
      const response = await getSiteRevisions(tenantId)
      const sorted = [...response.revisions].sort((a, b) => b.publishedAt - a.publishedAt)
      const next = selectLatest ? sorted.find((item) => item.revisionId) ?? null : null
      setRevisions(sorted)
      setSelected(next)
      setSnapshotLoading(Boolean(next))
    } catch { setLoadError('Unable to load revision history. Please try again.') }
  }, [tenantId])

  useEffect(() => {
    let cancelled = false
    void getSiteRevisions(tenantId).then((response) => {
      if (cancelled) return
      const sorted = [...response.revisions].sort((a, b) => b.publishedAt - a.publishedAt)
      const next = sorted.find((item) => item.revisionId) ?? null
      setRevisions(sorted); setSelected(next); setSnapshotLoading(Boolean(next))
    }).catch(() => { if (!cancelled) setLoadError('Unable to load revision history. Please try again.') })
    return () => { cancelled = true }
  }, [tenantId])
  useEffect(() => {
    if (!selected?.revisionId) return
    let cancelled = false
    void getSiteRevision(tenantId, selected.revisionId).then((definition) => { if (!cancelled) setSnapshot(definition) }).catch((caught: unknown) => {
      if (cancelled) return
      if (caught instanceof ApiError && caught.status === 404) { setSelected(null); setRestoreError('That revision is no longer available. The history list has been refreshed.'); void load(false) } else setRestoreError('Unable to load this revision. Please try again.')
    }).finally(() => { if (!cancelled) setSnapshotLoading(false) })
    return () => { cancelled = true }
  }, [load, selected?.revisionId, tenantId])

  const chooseRevision = (revision: SiteRevision) => {
    setSelected(revision); setSnapshot(null); setSnapshotLoading(Boolean(revision.revisionId)); setRestoreError(null); setRestoreDialogOpen(false)
  }

  const retry = () => {
    setLoadError(null); setRevisions(null); setSelected(null); setSnapshot(null); setSnapshotLoading(false); void load(true)
  }

  const restore = async () => {
    if (!selected?.revisionId || selected.isCurrent || restoring) return
    setRestoring(true); setRestoreError(null)
    try { onSaved(await restoreSiteRevision(tenantId, selected.revisionId)) } catch (caught) {
      setRestoreDialogOpen(false); setRestoreError(caught instanceof ApiError ? caught.message : 'Unable to restore this revision. Please try again.')
      if (caught instanceof ApiError && caught.status === 404) { setSelected(null); setSnapshot(null); void load(false) }
    } finally { setRestoring(false) }
  }

  const previewPageId = snapshot?.pages.find((page) => page.id === 'home')?.id ?? snapshot?.pages[0]?.id
  return (
    <div className="grid min-h-0 min-w-0 w-full max-w-full flex-1 grid-cols-[minmax(0,1fr)] overflow-x-hidden lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]" data-testid="revision-history-workspace">
      <aside aria-label="Revision history" className="flex min-h-0 min-w-0 w-full max-w-full flex-col border-b border-border bg-surface lg:border-r lg:border-b-0">
        <div className="min-w-0 px-5 pt-5"><Button onClick={onBack} size="sm" variant="ghost"><ChevronRightIcon className="size-4 rotate-180" />Back to Site Tools</Button><h2 className="mt-6 text-xl font-semibold tracking-tight text-fg">Revision history</h2><p className="mt-2 text-sm leading-6 text-fg-muted">View a published snapshot or restore it to the working site.</p></div>
        {loadError && <div className="m-5"><StatusMessage tone="error">{loadError} <Button className="ml-1" onClick={retry} size="sm" variant="secondary">Retry</Button></StatusMessage></div>}
        {!revisions && !loadError && <div className="m-5"><StatusMessage>Loading revision history…</StatusMessage></div>}
        {revisions && revisions.length === 0 && <div className="m-5"><StatusMessage>No published revisions are available yet.</StatusMessage></div>}
        {revisions && revisions.length > 0 && <div className="mt-5 min-h-0 flex-1 overflow-y-auto border-t border-border p-3" role="list">{revisions.map((revision) => {
          const active = selected?.revisionId === revision.revisionId
          return <button aria-current={active ? 'true' : undefined} className={`mb-2 w-full rounded-lg border p-3 text-left transition-colors ${active ? 'border-brand bg-brand-subtle' : 'border-border bg-surface hover:border-border-strong hover:bg-surface-muted'}`} disabled={!revision.revisionId} key={revision.revisionId ?? `legacy-${revision.publishedAt}`} onClick={() => chooseRevision(revision)} type="button"><span className="block text-sm font-semibold text-fg">{publishedDateTime(revision.publishedAt)}</span><span className="mt-2 flex flex-wrap items-center gap-2">{revision.isCurrent ? <Badge tone="success">Current</Badge> : <Badge>Published</Badge>}<span className="text-xs font-medium text-fg-muted">{pageCountLabel(revision.pageCount)}</span></span></button>
        })}</div>}
      </aside>
      <main className="min-h-0 min-w-0 w-full max-w-full overflow-y-auto bg-bg p-5 sm:p-7" aria-label="Revision snapshot">
        <div className="mx-auto min-w-0 max-w-6xl">
          {restoreError && <div className="mb-5"><StatusMessage tone="error">{restoreError}</StatusMessage></div>}
          {!selected && revisions && revisions.length > 0 && <StatusMessage>Choose a revision to view its snapshot.</StatusMessage>}
          {snapshotLoading && <StatusMessage>Loading snapshot…</StatusMessage>}
          {selected && snapshot && previewPageId && <><div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-info-border bg-info-subtle px-4 py-3"><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><Badge>Snapshot</Badge><span className="text-sm font-semibold text-fg">Published {publishedDateTime(selected.publishedAt)}</span></div><p className="mt-1 text-sm text-fg-muted">Read-only. You are viewing a published revision, not the working site.</p></div>{!selected.isCurrent && <Button disabled={restoring} onClick={() => setRestoreDialogOpen(true)} variant="secondary">Restore this version</Button>}</div><div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-md"><div className="flex min-h-10 items-center border-b border-border bg-surface-muted px-4 text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle"><span className="mx-auto">Snapshot preview</span></div><SitePreviewFrame mode="WORKING_PREVIEW" pageId={previewPageId} site={snapshot} title="Revision snapshot preview" /></div></>}
        </div>
      </main>
      <ConfirmDialog busy={restoring} cancelLabel="Cancel" confirmLabel="Restore to Working" description={restoreDescription} onCancel={() => { if (!restoring) setRestoreDialogOpen(false) }} onConfirm={() => void restore()} open={restoreDialogOpen} title="Restore this published revision?" />
    </div>
  )
}
