'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, FileInput, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getMedia, uploadMedia, type MediaItem } from '../../lib/media'

type LibraryState = 'loading' | 'ready' | 'error'
type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export interface MediaPickerProps {
  tenantId: string
  selectedMediaIds: readonly string[]
  disabled?: boolean
  selectionDisabled?: boolean
  sectionLabel?: string
  capacity?: number
  onSelect: (media: MediaItem) => void
  onClose: () => void
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function BackIcon () {
  return <svg aria-hidden className="size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" /></svg>
}

function AddIcon () {
  return <svg aria-hidden className="size-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
}

function CheckIcon () {
  return <svg aria-hidden className="size-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><path d="m5 12 5 5 9-11" /></svg>
}

export function MediaPicker ({ capacity = 20, disabled = false, onClose, onSelect, sectionLabel = 'Gallery', selectedMediaIds, selectionDisabled = false, tenantId }: MediaPickerProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [libraryState, setLibraryState] = useState<LibraryState>('loading')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const selectedIds = useMemo(() => new Set(selectedMediaIds), [selectedMediaIds])

  const loadMedia = async () => {
    setLibraryState('loading')
    try {
      const response = await getMedia(tenantId)
      setMedia(response.media)
      setHasMore(response.hasMore)
      setLibraryState('ready')
    } catch {
      setLibraryState('error')
    }
  }

  useEffect(() => {
    let cancelled = false
    void getMedia(tenantId).then((response) => {
      if (cancelled) return
      setMedia(response.media)
      setHasMore(response.hasMore)
      setLibraryState('ready')
    }).catch(() => {
      if (!cancelled) setLibraryState('error')
    })
    return () => { cancelled = true }
  }, [tenantId])

  const upload = async () => {
    if (!selectedFile || uploadState === 'uploading' || disabled) return
    if (!allowedTypes.has(selectedFile.type) || selectedFile.size === 0 || selectedFile.size > 10 * 1024 * 1024) {
      setUploadState('error')
      setUploadMessage('Choose one JPEG, PNG, or WebP image up to 10 MB.')
      return
    }
    setUploadState('uploading')
    setUploadMessage(null)
    try {
      const uploaded = await uploadMedia(tenantId, selectedFile)
      setMedia((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)])
      setSelectedFile(null)
      if (fileInput.current) fileInput.current.value = ''
      setUploadState('success')
      setUploadMessage(`Uploaded. Choose it below to add it to the ${sectionLabel}.`)
    } catch (caught) {
      setUploadState('error')
      setUploadMessage(caught instanceof ApiError && (caught.status === 400 || caught.status === 413) && caught.message
        ? caught.message
        : 'Unable to upload the image. Please try again.')
    }
  }

  return (
    <section aria-label="Add images" className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-4 py-4">
        <button className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" disabled={disabled} onClick={onClose} type="button"><BackIcon />Back to {sectionLabel}</button>
        <h2 className="mt-3 text-base font-semibold tracking-tight text-fg">Add images</h2>
        <p className="mt-1 text-xs leading-5 text-fg-subtle">Upload a new image or choose from your library.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <section aria-label="Upload image" className="rounded-md border border-dashed border-border-strong bg-surface-muted p-3">
          <FileInput accept="image/jpeg,image/png,image/webp" buttonLabel="Choose file" disabled={disabled || uploadState === 'uploading'} fileName={selectedFile?.name} id={`gallery-picker-upload-${tenantId}`} onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setUploadState('idle'); setUploadMessage(null) }} ref={fileInput} />
          <Button className="mt-2" disabled={disabled || !selectedFile || uploadState === 'uploading'} onClick={() => void upload()} size="sm" type="button">{uploadState === 'uploading' ? 'Uploading…' : 'Upload'}</Button>
          {uploadMessage && <div className="mt-2"><StatusMessage tone={uploadState === 'success' ? 'success' : 'error'}>{uploadMessage}</StatusMessage></div>}
          <p className="mt-2 text-xs leading-5 text-fg-subtle">JPEG, PNG, or WebP · up to 10 MB.</p>
        </section>

        <div className="mt-5 flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Your library</h3>
          {libraryState === 'ready' && <span className="text-xs tabular-nums text-fg-subtle">{media.length} {media.length === 1 ? 'image' : 'images'}</span>}
        </div>

        {libraryState === 'loading' && <div className="mt-2"><StatusMessage>Loading images…</StatusMessage></div>}
        {libraryState === 'error' && <div className="mt-2"><StatusMessage tone="error">Unable to load images.</StatusMessage><Button className="mt-2" disabled={disabled} onClick={() => void loadMedia()} size="sm" type="button">Retry</Button></div>}
        {libraryState === 'ready' && media.length === 0 && <p className="mt-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 py-5 text-center text-xs text-fg-subtle">No uploaded images yet.</p>}
        {libraryState === 'ready' && media.length > 0 && (
          <ul aria-label="Media library" className="mt-2 grid grid-cols-2 gap-3">
            {media.map((item) => {
              const selected = selectedIds.has(item.id)
              return (
                <li className="flex min-w-0 flex-col rounded-md border border-border bg-surface p-2" key={item.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="aspect-[4/3] w-full rounded-md bg-surface-muted object-cover" height={item.height} loading="lazy" src={item.src} width={item.width} />
                  <p className="mt-2 truncate text-xs text-fg-muted" title={item.originalFilename}>{item.originalFilename}</p>
                  <Button aria-label={selected ? `${item.originalFilename} added` : `Add ${item.originalFilename}`} className={selected ? 'mt-2 !border-success !bg-success-subtle !text-success-fg' : 'mt-2'} disabled={disabled || selected || (!selected && selectionDisabled)} onClick={() => onSelect(item)} size="sm" type="button" variant={selected ? 'secondary' : 'primary'}>{selected ? <><CheckIcon />Added</> : <><AddIcon />Add</>}</Button>
                </li>
              )
            })}
          </ul>
        )}
        {hasMore && <p className="mt-2 text-xs text-fg-subtle">Showing the 50 most recent images.</p>}
        <p className="mt-4 text-xs leading-5 text-fg-subtle">To permanently delete an image from storage, use <span className="font-semibold text-fg-muted">Website → Media</span>. Removing an image here only takes it out of this {sectionLabel}.</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3">
        <div><p className="text-xs tabular-nums text-fg-subtle">{selectedMediaIds.length} of {capacity} in {sectionLabel}</p>{selectionDisabled && <p className="mt-0.5 text-xs font-semibold text-warning-fg">Maximum reached</p>}</div>
        <Button disabled={disabled} onClick={onClose} size="sm" type="button">Done</Button>
      </div>
    </section>
  )
}
