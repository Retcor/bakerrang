'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, StatusMessage } from '@bakerrang/ui'
import { getAuditEvents, type AuditEvent } from '../../lib/audit'
import { useAuth } from '../providers/AuthProvider'

const actorLabel = (event: AuditEvent, currentUserId?: string) => {
  if (currentUserId && event.actorUserId === currentUserId) return 'You'
  return event.actorName || event.actorEmail || 'Unknown user'
}

const contextLabel = (event: AuditEvent) => {
  const metadata = event.metadata || {}
  if (typeof metadata.pageTitle === 'string') return `Page: ${metadata.pageTitle}`
  if (typeof metadata.templateName === 'string') return `Template: ${metadata.templateName}`
  if (typeof metadata.originalFilename === 'string') return `Media: ${metadata.originalFilename}`
  if (typeof metadata.newStatus === 'string') return `Status: ${metadata.newStatus}`
  if (typeof metadata.sectionType === 'string') return `Section: ${metadata.sectionType}`
  if (typeof metadata.memberRole === 'string') return `Role: ${metadata.memberRole}`
  if (typeof metadata.recipientCount === 'number') return `${metadata.recipientCount} notification recipient${metadata.recipientCount === 1 ? '' : 's'}`
  return null
}

const appendUnique = (current: AuditEvent[], received: AuditEvent[]) => {
  const seen = new Set(current.map((event) => event.eventId))
  return [...current, ...received.filter((event) => !seen.has(event.eventId))]
}

export function BusinessActivity ({ tenantId }: { tenantId: string }) {
  const { user } = useAuth()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  const loadInitial = useCallback(async () => {
    setLoading(true); setError(null); setMoreError(null)
    try {
      const page = await getAuditEvents(tenantId)
      setEvents(page.events)
      setNextCursor(page.nextCursor)
    } catch {
      setError('Activity could not be loaded. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    let cancelled = false
    void getAuditEvents(tenantId).then((page) => {
      if (cancelled) return
      setEvents(page.events)
      setNextCursor(page.nextCursor)
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setError('Activity could not be loaded. Please try again.')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [tenantId])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true); setMoreError(null)
    try {
      const page = await getAuditEvents(tenantId, nextCursor)
      setEvents((current) => appendUnique(current, page.events))
      setNextCursor(page.nextCursor)
    } catch {
      setMoreError('More activity could not be loaded. Please try again.')
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) return <Card className="p-5" role="status">Loading activity…</Card>
  if (error) return <StatusMessage tone="error"><p>{error}</p><Button className="mt-3" onClick={() => void loadInitial()} type="button">Retry</Button></StatusMessage>
  if (!events.length) return <Card className="p-5"><h2 className="text-lg font-semibold text-fg">No activity yet</h2><p className="mt-2 text-sm leading-6 text-fg-muted">Activity records meaningful operator changes to this business.</p></Card>

  return <section aria-labelledby="activity-heading">
    <h2 className="sr-only" id="activity-heading">Activity history</h2>
    <ol className="space-y-3" aria-label="Activity history">
      {events.map((event) => {
        const context = contextLabel(event)
        return <li key={event.eventId}><Card className="p-4 sm:p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-semibold text-fg">{event.summary}</p><p className="mt-1 text-sm text-fg-muted">{actorLabel(event, user?.id)}{context ? ` · ${context}` : ''}</p></div><time className="shrink-0 text-sm text-fg-muted" dateTime={new Date(event.occurredAt).toISOString()}>{new Date(event.occurredAt).toLocaleString()}</time></div></Card></li>
      })}
    </ol>
    {moreError && <div className="mt-4"><StatusMessage tone="error">{moreError}</StatusMessage></div>}
    {nextCursor && <Button className="mt-4" disabled={loadingMore} onClick={() => void loadMore()} type="button">{loadingMore ? 'Loading more…' : 'Load more'}</Button>}
  </section>
}
