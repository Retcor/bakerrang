'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { findHomePage, isGallerySection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getMedia, uploadMedia, type MediaItem } from '../../lib/media'
import { upsertHomeGallery } from '../../lib/site'

interface GalleryRow {
  key: string
  id?: string
  mediaId: string
  altText: string
  src?: string
  width?: number
  height?: number
}

type LibraryState = 'loading' | 'ready' | 'error'
type UploadState = 'idle' | 'uploading' | 'success' | 'validation-error' | 'server-error'

export interface GalleryEditorProps {
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function GalleryEditor ({ tenantId, site, onCancel, onSaved }: GalleryEditorProps) {
  const gallery = findHomePage(site)?.sections.find(isGallerySection)
  const fileInput = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(gallery?.content.title ?? 'Gallery')
  const [rows, setRows] = useState<GalleryRow[]>(() => gallery?.content.items.map((item) => ({
    key: `existing-${item.id}`,
    id: item.id,
    mediaId: item.mediaId,
    altText: item.altText,
    src: item.src,
    width: item.width,
    height: item.height
  })) ?? [])
  const [libraryState, setLibraryState] = useState<LibraryState>('loading')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    void getMedia(tenantId)
      .then((response) => {
        if (cancelled) return
        setMedia(response.media)
        setHasMore(response.hasMore)
        setLibraryState('ready')
      })
      .catch(() => {
        if (!cancelled) setLibraryState('error')
      })
    return () => { cancelled = true }
  }, [tenantId])

  const upload = async () => {
    if (!selectedFile || uploadState === 'uploading') return
    if (!allowedTypes.has(selectedFile.type) || selectedFile.size === 0 || selectedFile.size > 10 * 1024 * 1024) {
      setUploadState('validation-error')
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
      setUploadMessage('Image uploaded. Select it below to add it to the Gallery.')
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 413)) {
        setUploadState('validation-error')
        setUploadMessage(caught.message)
      } else {
        setUploadState('server-error')
        setUploadMessage('Unable to upload the image. Please try again.')
      }
    }
  }

  const addMedia = (item: MediaItem) => {
    if (rows.length >= 20 || rows.some((row) => row.mediaId === item.id)) return
    setRows((current) => [...current, {
      key: `new-${item.id}`,
      mediaId: item.id,
      altText: '',
      src: item.src,
      width: item.width,
      height: item.height
    }])
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    setRows((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const heading = title.trim()
    if (!heading) return setError('Section heading is required.')
    if (heading.length > 100) return setError('Section heading must be 100 characters or fewer.')
    if (rows.length === 0) return setError('Select at least one Gallery image.')
    if (rows.some((row) => !row.altText.trim())) return setError('Every Gallery image needs alt text.')
    if (rows.some((row) => row.altText.trim().length > 250)) return setError('Alt text must be 250 characters or fewer.')

    setSaving(true)
    setError(null)
    try {
      onSaved(await upsertHomeGallery(tenantId, {
        title: heading,
        items: rows.map((row) => ({
          ...(row.id ? { id: row.id } : {}),
          mediaId: row.mediaId,
          altText: row.altText.trim()
        }))
      }))
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save Gallery. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="w-full max-w-3xl rounded-md border border-border bg-surface p-4 text-left" onSubmit={(event) => void submit(event)}>
      <label className="text-sm font-semibold text-fg" htmlFor={`gallery-title-${tenantId}`}>Section Heading</label>
      <Input className="mt-2" disabled={saving} id={`gallery-title-${tenantId}`} maxLength={100} onChange={(event) => setTitle(event.target.value)} value={title} />

      <fieldset className="mt-5 rounded-md border border-border p-4" disabled={saving || uploadState === 'uploading'}>
        <legend className="px-1 text-sm font-semibold text-fg">Upload Image</legend>
        <input accept="image/jpeg,image/png,image/webp" className="block w-full text-sm text-fg" onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setUploadState('idle'); setUploadMessage(null) }} ref={fileInput} type="file" />
        <Button className="mt-3 min-h-9 px-3 py-1.5 text-xs" disabled={!selectedFile || uploadState === 'uploading'} onClick={() => void upload()} type="button">
          {uploadState === 'uploading' ? 'Uploading…' : 'Upload Image'}
        </Button>
        {uploadMessage && <p className="mt-2 text-sm text-fg" role={uploadState === 'success' ? 'status' : 'alert'}>{uploadMessage}</p>}
      </fieldset>

      <section className="mt-5" aria-labelledby={`gallery-library-${tenantId}`}>
        <h3 className="text-sm font-semibold text-fg" id={`gallery-library-${tenantId}`}>Recent Uploaded Images</h3>
        {libraryState === 'loading' && <p className="mt-2 text-sm text-fg-muted" role="status">Loading images…</p>}
        {libraryState === 'error' && <div className="mt-2"><p className="text-sm text-fg" role="alert">Unable to load images.</p><Button className="mt-2 min-h-9 px-3 py-1.5 text-xs" onClick={() => void loadMedia()} type="button">Retry</Button></div>}
        {libraryState === 'ready' && media.length === 0 && <p className="mt-2 text-sm text-fg-muted">No uploaded images yet.</p>}
        {libraryState === 'ready' && media.length > 0 && (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((item) => {
              const selected = rows.some((row) => row.mediaId === item.id)
              return (
                <li className="rounded-md border border-border bg-bg p-3" key={item.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="aspect-video w-full rounded object-cover" height={item.height} loading="lazy" src={item.src} width={item.width} />
                  <p className="mt-2 truncate text-xs text-fg" title={item.originalFilename}>{item.originalFilename}</p>
                  <Button className="mt-2 min-h-9 px-3 py-1.5 text-xs" disabled={selected || rows.length >= 20} onClick={() => addMedia(item)} type="button">{selected ? 'Selected' : 'Add to Gallery'}</Button>
                </li>
              )
            })}
          </ul>
        )}
        {hasMore && <p className="mt-2 text-xs text-fg-muted">Showing the 50 most recent images.</p>}
      </section>

      <section className="mt-5" aria-labelledby={`gallery-selected-${tenantId}`}>
        <h3 className="text-sm font-semibold text-fg" id={`gallery-selected-${tenantId}`}>Selected Gallery Images</h3>
        {rows.length === 0 && <p className="mt-2 text-sm text-fg-muted">Select at least one image.</p>}
        <ol className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <li className="grid gap-3 rounded-md border border-border bg-bg p-3 sm:grid-cols-[8rem_1fr]" key={row.key}>
              {row.src && row.width && row.height
                ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" className="aspect-video w-full rounded object-cover" height={row.height} loading="lazy" src={row.src} width={row.width} />
                  </>
                  )
                : <div className="aspect-video rounded bg-surface" />}
              <div>
                <label className="text-sm font-semibold text-fg" htmlFor={`gallery-alt-${tenantId}-${row.key}`}>Alt Text</label>
                <Input className="mt-2" disabled={saving} id={`gallery-alt-${tenantId}-${row.key}`} maxLength={250} onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, altText: event.target.value } : item))} value={row.altText} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving || index === 0} onClick={() => move(index, -1)} type="button">Move Up</Button>
                  <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving || index === rows.length - 1} onClick={() => move(index, 1)} type="button">Move Down</Button>
                  <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} type="button">Remove</Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {error && <p className="mt-3 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving || uploadState === 'uploading'} onClick={onCancel} type="button">Cancel</Button>
        <Button className="min-h-9 px-3 py-1.5 text-xs" disabled={saving || uploadState === 'uploading'} type="submit">{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </form>
  )
}
