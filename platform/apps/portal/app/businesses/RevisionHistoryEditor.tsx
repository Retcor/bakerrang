'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { Badge, Button, Card, ConfirmDialog, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getSiteRevisions, restoreSiteRevision, type SiteRevision } from '../../lib/site'

const restoreDescription = 'This replaces the current working site with the selected published revision. Your live site will not change until you Publish Site. This is published-history restoration, not an undo of every edit.'

function publishedDateTime (value: number) {
  if (!Number.isSafeInteger(value) || value < 0) return 'Unknown publication date'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value)
}

function pageCountLabel (count: number) {
  return `${count} ${count === 1 ? 'page' : 'pages'}`
}

export function RevisionHistoryEditor ({ onSaved, tenantId }: {
  onSaved: (site: SiteDefinition, successMessage?: string, offerHomePreview?: boolean) => void
  tenantId: string
}) {
  const [revisions, setRevisions] = useState<SiteRevision[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SiteRevision | null>(null)
  const [restoring, setRestoring] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await getSiteRevisions(tenantId)
      setRevisions(response.revisions)
    } catch {
      setLoadError('Unable to load revision history. Please try again.')
    }
  }, [tenantId])

  const retry = () => {
    setLoadError(null)
    void load()
  }

  useEffect(() => {
    let cancelled = false
    void getSiteRevisions(tenantId).then((response) => {
      if (!cancelled) setRevisions(response.revisions)
    }).catch(() => {
      if (!cancelled) setLoadError('Unable to load revision history. Please try again.')
    })
    return () => { cancelled = true }
  }, [tenantId])

  const restore = async () => {
    if (!selected?.revisionId || restoring) return
    const revisionId = selected.revisionId
    setRestoring(true)
    setRestoreError(null)
    try {
      const definition = await restoreSiteRevision(tenantId, revisionId)
      setSelected(null)
      onSaved(definition, 'Revision restored to the working site. Preview your changes, then Publish Site when ready.', true)
    } catch (caught) {
      setSelected(null)
      setRestoreError(caught instanceof ApiError ? caught.message : 'Unable to restore this revision. Please try again.')
      if (caught instanceof ApiError && caught.status === 404) void load()
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fg">Revision History</h2>
        <p className="mt-1 text-sm leading-6 text-fg-muted">Restore a published revision to the working site when you need to return to a recent published state.</p>
        <p className="mt-3 text-sm font-medium text-fg-muted">Showing the most recent 10 published revisions.</p>
      </div>
      {loadError && <StatusMessage tone="error">{loadError} <Button className="ml-1 align-middle" onClick={retry} size="sm" variant="secondary">Retry</Button></StatusMessage>}
      {restoreError && <StatusMessage tone="error">{restoreError}</StatusMessage>}
      {!revisions && !loadError && <StatusMessage>Loading revision history…</StatusMessage>}
      {revisions && revisions.length === 0 && <StatusMessage>No published revisions are available yet.</StatusMessage>}
      {revisions && revisions.length > 0 && (
        <div className="space-y-3">
          {revisions.map((revision) => (
            <Card className="flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" key={revision.revisionId ?? `legacy-${revision.publishedAt}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-fg">Published {publishedDateTime(revision.publishedAt)}</h3>{revision.isCurrent && <Badge tone="success">Current</Badge>}</div>
                <p className="mt-1 text-sm text-fg-muted">{pageCountLabel(revision.pageCount)}</p>
              </div>
              {!revision.isCurrent && revision.revisionId && <Button disabled={restoring} onClick={() => { setRestoreError(null); setSelected(revision) }} variant="secondary">Restore to Working</Button>}
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog busy={restoring} cancelLabel="Cancel" confirmLabel="Restore to Working" description={restoreDescription} onCancel={() => { if (!restoring) setSelected(null) }} onConfirm={() => void restore()} open={selected !== null} title="Restore this published revision?" />
    </div>
  )
}
