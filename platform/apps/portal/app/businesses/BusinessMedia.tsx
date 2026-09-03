'use client'

import { useEffect, useState } from 'react'
import { Button, Card, ConfirmDialog, EmptyState, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { deleteMedia, getMedia, type MediaItem } from '../../lib/media'

type ListState = 'loading' | 'ready' | 'forbidden' | 'error'

export interface BusinessMediaProps {
  tenantId: string
}

export function BusinessMedia ({ tenantId }: BusinessMediaProps) {
  const [listState, setListState] = useState<ListState>('loading')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [rowError, setRowError] = useState<{ id: string, message: string } | null>(null)

  const loadList = async () => {
    setListState('loading')
    try {
      const response = await getMedia(tenantId)
      setMedia(response.media)
      setHasMore(response.hasMore)
      setListState('ready')
    } catch (error) {
      setListState(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'error')
    }
  }

  useEffect(() => {
    let cancelled = false
    void getMedia(tenantId).then((response) => {
      if (cancelled) return
      setMedia(response.media)
      setHasMore(response.hasMore)
      setListState('ready')
    }).catch((error: unknown) => {
      if (!cancelled) setListState(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'error')
    })
    return () => { cancelled = true }
  }, [tenantId])

  const confirming = media.find((item) => item.id === confirmingId) ?? null

  const removeMedia = async () => {
    if (!confirming || deleting) return
    setDeleting(true)
    setRowError(null)
    try {
      await deleteMedia(tenantId, confirming.id)
      setMedia((current) => current.filter((item) => item.id !== confirming.id))
      setConfirmingId(null)
    } catch (error) {
      const message = error instanceof ApiError && error.message
        ? error.message
        : 'Image could not be deleted. Please try again.'
      setRowError({ id: confirming.id, message })
      setConfirmingId(null)
    } finally {
      setDeleting(false)
    }
  }

  if (listState === 'loading') return <StatusMessage>Loading media…</StatusMessage>

  if (listState === 'forbidden') {
    return <StatusMessage tone="error">You do not have access to media for this business.</StatusMessage>
  }

  if (listState === 'error') {
    return (
      <div className="text-left">
        <StatusMessage tone="error">Media could not be loaded. Please try again.</StatusMessage>
        <Button className="mt-3" onClick={() => void loadList()} size="sm">Retry</Button>
      </div>
    )
  }

  if (media.length === 0) {
    return <EmptyState description="Images uploaded from Website editors appear here." title="No images yet" />
  }

  return (
    <div className="w-full text-left">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {media.map((item) => (
          <li key={item.id}>
            <Card className="p-3" aria-label={item.originalFilename}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="aspect-video w-full rounded object-cover" height={item.height} loading="lazy" src={item.src} width={item.width} />
              <p className="mt-2 truncate text-sm text-fg" title={item.originalFilename}>{item.originalFilename}</p>
              <Button className="mt-2" disabled={deleting} onClick={() => { setConfirmingId(item.id); setRowError(null) }} size="sm" type="button" variant="danger">
                Delete
              </Button>
              {rowError?.id === item.id && (
                <p className="mt-2 text-sm text-fg" role="alert">{rowError.message}</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {hasMore && <p className="mt-2 text-xs text-fg-muted">Showing the 50 most recent images.</p>}
      <ConfirmDialog
        busy={deleting}
        confirmLabel="Delete image"
        description="This cannot be undone. Images still used on the working or published site cannot be deleted."
        onCancel={() => setConfirmingId(null)}
        onConfirm={() => void removeMedia()}
        open={confirmingId !== null}
        title="Delete this image?"
      />
    </div>
  )
}
