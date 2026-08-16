'use client'

import { useState } from 'react'
import { Button } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { LeadNotes } from './LeadNotes'
import {
  getLead,
  getLeads,
  LEAD_STATUSES,
  updateLeadStatus,
  type LeadDetail,
  type LeadStatus,
  type LeadSummary
} from '../../lib/leads'

type ListState = 'initial' | 'loading' | 'ready' | 'forbidden' | 'error'
type DetailState = 'idle' | 'loading' | 'ready' | 'forbidden' | 'error'
type SaveState = 'idle' | 'saving' | 'conflict' | 'forbidden' | 'not-found' | 'error'

export interface BusinessLeadsProps {
  tenantId: string
}

const displayDate = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))
  } catch {
    return 'Unavailable'
  }
}

const contactMethod = (lead: LeadSummary) => [lead.email, lead.phone].filter(Boolean).join(' · ') || 'Not provided'

const summaryFromDetail = (lead: LeadDetail): LeadSummary => ({
  id: lead.id,
  name: lead.name,
  ...(lead.email ? { email: lead.email } : {}),
  ...(lead.phone ? { phone: lead.phone } : {}),
  status: lead.status,
  source: lead.source,
  createdAt: lead.createdAt,
  updatedAt: lead.updatedAt
})

export function BusinessLeads ({ tenantId }: BusinessLeadsProps) {
  const [listState, setListState] = useState<ListState>('initial')
  const [leads, setLeads] = useState<LeadSummary[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailState, setDetailState] = useState<DetailState>('idle')
  const [detail, setDetail] = useState<LeadDetail | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>('NEW')
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const loadList = async () => {
    setListState('loading')
    try {
      const response = await getLeads(tenantId)
      setLeads(response.leads)
      setHasMore(response.hasMore)
      setListState('ready')
    } catch (error) {
      setListState(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'error')
    }
  }

  const loadDetail = async (leadId: string) => {
    setSelectedId(leadId)
    setDetail(null)
    setDetailState('loading')
    try {
      const nextDetail = await getLead(tenantId, leadId)
      setDetail(nextDetail)
      setSelectedStatus(nextDetail.status)
      setSaveState('idle')
      setDetailState('ready')
    } catch (error) {
      setDetailState(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'error')
    }
  }

  const saveStatus = async () => {
    if (!detail || selectedStatus === detail.status || saveState === 'saving') return
    setSaveState('saving')
    try {
      const updated = await updateLeadStatus(tenantId, detail.id, {
        status: selectedStatus,
        expectedUpdatedAt: detail.updatedAt
      })
      setDetail(updated)
      setSelectedStatus(updated.status)
      setLeads((current) => current.map((lead) => lead.id === updated.id
        ? summaryFromDetail(updated)
        : lead))
      setSaveState('idle')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setSaveState('conflict')
      else if (error instanceof ApiError && error.status === 403) setSaveState('forbidden')
      else if (error instanceof ApiError && error.status === 404) setSaveState('not-found')
      else setSaveState('error')
    }
  }

  const refreshLead = async () => {
    if (!detail) return
    setSaveState('saving')
    try {
      const refreshed = await getLead(tenantId, detail.id)
      setDetail(refreshed)
      setSelectedStatus(refreshed.status)
      setLeads((current) => current.map((lead) => lead.id === refreshed.id
        ? summaryFromDetail(refreshed)
        : lead))
      setSaveState('idle')
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setSaveState('forbidden')
      else if (error instanceof ApiError && error.status === 404) setSaveState('not-found')
      else setSaveState('error')
    }
  }

  const backToInbox = () => {
    setSelectedId(null)
    setDetail(null)
    setDetailState('idle')
  }

  if (listState === 'initial') {
    return (
      <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" onClick={() => void loadList()}>
        Leads
      </Button>
    )
  }

  if (listState === 'loading') return <p className="text-xs text-fg-muted" role="status">Loading leads…</p>

  if (listState === 'forbidden') {
    return <p className="max-w-sm text-sm text-fg" role="alert">You do not have access to leads for this business.</p>
  }

  if (listState === 'error') {
    return (
      <div className="max-w-sm text-left">
        <p className="text-sm text-fg" role="alert">Leads could not be loaded. Please try again.</p>
        <Button className="mt-2 min-h-9 px-3 py-1.5 text-xs" onClick={() => void loadList()}>Retry</Button>
      </div>
    )
  }

  if (selectedId) {
    return (
      <div className="w-full max-w-xl text-left">
        <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" onClick={backToInbox}>Back to inbox</Button>
        {detailState === 'loading' && <p className="mt-3 text-sm text-fg-muted" role="status">Loading lead…</p>}
        {detailState === 'forbidden' && <p className="mt-3 text-sm text-fg" role="alert">You do not have access to this lead.</p>}
        {detailState === 'error' && (
          <div className="mt-3">
            <p className="text-sm text-fg" role="alert">Lead details could not be loaded. Please try again.</p>
            <Button className="mt-2 min-h-9 px-3 py-1.5 text-xs" onClick={() => void loadDetail(selectedId)}>Retry</Button>
          </div>
        )}
        {detailState === 'ready' && detail && (
          <>
            <section className="mt-3 rounded-md border border-border bg-bg p-4" aria-label={`Lead details for ${detail.name}`}>
              <h4 className="text-lg font-semibold text-fg">{detail.name}</h4>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {detail.email && <div><dt className="font-semibold text-fg-muted">Email</dt><dd className="mt-1 break-all text-fg">{detail.email}</dd></div>}
                {detail.phone && <div><dt className="font-semibold text-fg-muted">Phone</dt><dd className="mt-1 text-fg">{detail.phone}</dd></div>}
                <div>
                  <dt className="font-semibold text-fg-muted"><label htmlFor={`lead-status-${detail.id}`}>Status</label></dt>
                  <dd className="mt-1">
                    <select className="min-h-9 rounded-md border border-border bg-surface px-2 text-fg" disabled={saveState === 'saving'} id={`lead-status-${detail.id}`} onChange={(event) => { setSelectedStatus(event.target.value as LeadStatus); setSaveState('idle') }} value={selectedStatus}>
                      {LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <Button className="ml-2 min-h-9 px-3 py-1.5 text-xs" disabled={selectedStatus === detail.status || saveState === 'saving'} onClick={() => void saveStatus()}>
                      {saveState === 'saving' ? 'Saving…' : 'Save Status'}
                    </Button>
                  </dd>
                </div>
                <div><dt className="font-semibold text-fg-muted">Source</dt><dd className="mt-1 text-fg">{detail.source}</dd></div>
                <div><dt className="font-semibold text-fg-muted">Received</dt><dd className="mt-1 text-fg">{displayDate(detail.createdAt)}</dd></div>
                <div><dt className="font-semibold text-fg-muted">Updated</dt><dd className="mt-1 text-fg">{displayDate(detail.updatedAt)}</dd></div>
                <div className="sm:col-span-2"><dt className="font-semibold text-fg-muted">Message</dt><dd className="mt-1 whitespace-pre-wrap text-fg">{detail.message}</dd></div>
              </dl>
              {saveState === 'conflict' && (
                <div className="mt-4" role="alert">
                  <p className="text-sm text-fg">This lead changed since you opened it.</p>
                  <Button className="mt-2 min-h-9 px-3 py-1.5 text-xs" onClick={() => void refreshLead()}>Refresh Lead</Button>
                </div>
              )}
              {saveState === 'forbidden' && <p className="mt-4 text-sm text-fg" role="alert">You do not have access to update this lead.</p>}
              {saveState === 'not-found' && <p className="mt-4 text-sm text-fg" role="alert">Lead not found.</p>}
              {saveState === 'error' && <p className="mt-4 text-sm text-fg" role="alert">Lead status could not be saved. Please try again.</p>}
            </section>
            <LeadNotes key={detail.id} leadId={detail.id} tenantId={tenantId} />
          </>
        )}
      </div>
    )
  }

  if (leads.length === 0) return <p className="text-sm text-fg-muted">No leads yet.</p>

  return (
    <div className="w-full max-w-xl text-left">
      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-bg">
        {leads.map((lead) => (
          <li key={lead.id}>
            <button className="w-full p-4 text-left transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent" onClick={() => void loadDetail(lead.id)} type="button">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-fg">{lead.name}</span>
                <span className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold text-fg-muted">{lead.status}</span>
              </span>
              <span className="mt-1 block text-sm text-fg-muted">{contactMethod(lead)}</span>
              <span className="mt-1 block text-xs text-fg-muted">Received {displayDate(lead.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>
      {hasMore && <p className="mt-2 text-xs text-fg-muted">Showing the 50 most recent leads.</p>}
    </div>
  )
}
