'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Textarea } from '@bakerrang/ui'
import { useAuth } from '../providers/AuthProvider'
import { addLeadNote, getLeadNotes, type LeadNote } from '../../lib/leads'

type LoadState = 'loading' | 'ready' | 'error'
type AddState = 'idle' | 'saving' | 'error'

export interface LeadNotesProps {
  tenantId: string
  leadId: string
}

const displayDate = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0) return 'Unavailable'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))
  } catch {
    return 'Unavailable'
  }
}

export function LeadNotes ({ tenantId, leadId }: LeadNotesProps) {
  const { user } = useAuth()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [addState, setAddState] = useState<AddState>('idle')
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [text, setText] = useState('')

  const loadNotes = async () => {
    setLoadState('loading')
    try {
      const response = await getLeadNotes(tenantId, leadId)
      setNotes([...response.notes].reverse())
      setHasMore(response.hasMore)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }

  useEffect(() => {
    let cancelled = false
    void getLeadNotes(tenantId, leadId)
      .then((response) => {
        if (cancelled) return
        setNotes([...response.notes].reverse())
        setHasMore(response.hasMore)
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => { cancelled = true }
  }, [tenantId, leadId])

  const submit = async () => {
    if (!text.trim() || addState === 'saving') return
    setAddState('saving')
    try {
      const note = await addLeadNote(tenantId, leadId, text)
      setNotes((current) => [...current, note])
      setText('')
      setAddState('idle')
    } catch {
      setAddState('error')
    }
  }

  return (
    <Card className="mt-4 p-5 sm:p-6" aria-labelledby={`lead-notes-title-${leadId}`}>
      <h4 className="text-base font-semibold text-fg" id={`lead-notes-title-${leadId}`}>Internal Notes</h4>
      {loadState === 'loading' && <p className="mt-3 text-sm text-fg-muted" role="status">Loading notes…</p>}
      {loadState === 'error' && (
        <div className="mt-3">
          <p className="text-sm text-fg" role="alert">Unable to load notes.</p>
          <Button className="mt-2" onClick={() => void loadNotes()} size="sm">Retry</Button>
        </div>
      )}
      {loadState === 'ready' && (
        <>
          {notes.length === 0
            ? <p className="mt-3 text-sm text-fg-muted">No notes yet.</p>
            : (
              <ol className="mt-3 space-y-3">
                {notes.map((note) => (
                  <li className="rounded-md border border-border bg-surface p-3" key={note.id}>
                    <p className="whitespace-pre-wrap text-sm text-fg">{note.text}</p>
                    <p className="mt-2 text-xs text-fg-muted">
                      {note.createdByUserId === user?.id ? 'You' : 'Team member'} · {displayDate(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
              )}
          {hasMore && <p className="mt-2 text-xs text-fg-muted">Showing the most recent 50 notes.</p>}
        </>
      )}
      <div className="mt-4">
        <label className="text-sm font-semibold text-fg" htmlFor={`lead-note-text-${leadId}`}>Add an internal note</label>
        <Textarea className="mt-2 min-h-24" disabled={addState === 'saving'} id={`lead-note-text-${leadId}`} maxLength={2000} onChange={(event) => { setText(event.target.value); setAddState('idle') }} value={text} />
        <Button className="mt-2" disabled={!text.trim() || addState === 'saving'} onClick={() => void submit()} size="sm">
          {addState === 'saving' ? 'Adding…' : 'Add Note'}
        </Button>
        {addState === 'error' && <p className="mt-2 text-sm text-fg" role="alert">Unable to add note.</p>}
      </div>
    </Card>
  )
}
