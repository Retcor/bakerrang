'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { findHomePage, isAboutSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, FileInput, Input, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getMedia, uploadMedia, type MediaItem } from '../../lib/media'
import { upsertHomeAbout } from '../../lib/site'

export function AboutEditor ({ onCancel, onSaved, site, tenantId }: {
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const about = findHomePage(site)?.sections.find(isAboutSection)
  const [eyebrow, setEyebrow] = useState(about?.content.eyebrow ?? '')
  const [heading, setHeading] = useState(about?.content.heading ?? '')
  const [body, setBody] = useState(about?.content.body ?? '')
  const [imageMediaId, setImageMediaId] = useState(about?.content.imageMediaId)
  const [imageAlt, setImageAlt] = useState(about?.content.imageAlt ?? '')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void getMedia(tenantId).then((response) => {
      if (!cancelled) setMedia(response.media)
    }).catch(() => {
      if (!cancelled) setError('Unable to load recent images. The current About image can still be kept or removed.')
    }).finally(() => {
      if (!cancelled) setLoadingMedia(false)
    })
    return () => { cancelled = true }
  }, [tenantId])

  const currentImage = imageMediaId === about?.content.imageMediaId && about?.content.imageSrc
    ? { id: imageMediaId, src: about.content.imageSrc, width: about.content.imageWidth, height: about.content.imageHeight }
    : media.find((item) => item.id === imageMediaId)

  const upload = async (file: File | undefined) => {
    if (!file || uploading) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError('Choose one JPEG, PNG, or WebP image up to 10 MB.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadMedia(tenantId, file)
      setMedia((items) => [uploaded, ...items.filter((item) => item.id !== uploaded.id)])
      setImageMediaId(uploaded.id)
      if (fileInput.current) fileInput.current.value = ''
      setSelectedFileName(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to upload the About image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    if (!heading.trim() || heading.trim().length > 120) return setError('Heading must be between 1 and 120 characters.')
    if (!body.trim() || body.trim().length > 2000) return setError('Body must be between 1 and 2000 characters.')
    if (eyebrow.trim().length > 60) return setError('Eyebrow must be 60 characters or fewer.')
    if (imageMediaId && !imageAlt.trim()) return setError('Image alt text is required when an About image is selected.')
    if (imageAlt.trim().length > 250) return setError('Image alt text must be 250 characters or fewer.')
    setSaving(true)
    setError(null)
    try {
      onSaved(await upsertHomeAbout(tenantId, {
        ...(eyebrow.trim() ? { eyebrow: eyebrow.trim() } : {}),
        heading: heading.trim(),
        body: body.trim(),
        ...(imageMediaId ? { imageMediaId, imageAlt: imageAlt.trim() } : {})
      }))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save About. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="w-full rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6" noValidate onSubmit={(event) => void submit(event)}>
      <h3 className="text-lg font-semibold text-fg">About</h3>
      <p className="mt-2 text-sm leading-6 text-fg-muted">Tell visitors what makes this business distinct. Save, then use Preview changes to review it on the website.</p>

      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor={`about-eyebrow-${tenantId}`}>Eyebrow / label <span className="font-normal text-fg-muted">Optional</span></label>
      <Input className="mt-2" disabled={saving} id={`about-eyebrow-${tenantId}`} maxLength={60} onChange={(event) => setEyebrow(event.target.value)} value={eyebrow} />
      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor={`about-heading-${tenantId}`}>Heading</label>
      <Input className="mt-2" disabled={saving} id={`about-heading-${tenantId}`} maxLength={120} onChange={(event) => setHeading(event.target.value)} required value={heading} />
      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor={`about-body-${tenantId}`}>Body</label>
      <Textarea className="mt-2 min-h-40" disabled={saving} id={`about-body-${tenantId}`} maxLength={2000} onChange={(event) => setBody(event.target.value)} required value={body} />
      <p className="mt-2 text-xs text-fg-muted">Use a blank line to start a new paragraph.</p>

      <section aria-labelledby={`about-image-${tenantId}`} className="mt-6">
        <h4 className="text-sm font-semibold text-fg" id={`about-image-${tenantId}`}>About image <span className="font-normal text-fg-muted">Optional</span></h4>
        {currentImage?.src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Current About selection" className="mt-3 aspect-[4/3] max-w-sm rounded border border-border object-cover" height={currentImage.height} src={currentImage.src} width={currentImage.width} />
        )}
        {imageMediaId && <Button className="mt-3" disabled={saving} onClick={() => { setImageMediaId(undefined); setImageAlt('') }} size="sm" type="button" variant="secondary">Remove Image</Button>}
        <FileInput accept="image/jpeg,image/png,image/webp" className="mt-4" disabled={saving || uploading} fileName={selectedFileName} id={`about-image-file-${tenantId}`} onChange={(event) => { const file = event.target.files?.[0]; setSelectedFileName(file?.name ?? null); void upload(file) }} ref={fileInput} />
        {uploading && <p className="mt-2 text-sm text-fg-muted" role="status">Uploading…</p>}
        {loadingMedia && <p className="mt-2 text-sm text-fg-muted" role="status">Loading recent images…</p>}
        {!loadingMedia && media.length > 0 && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {media.map((item) => (
              <li className="rounded border border-border p-2" key={item.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="aspect-[4/3] w-full rounded object-cover" height={item.height} src={item.src} width={item.width} />
                <Button className="mt-2 w-full" disabled={saving || imageMediaId === item.id} onClick={() => setImageMediaId(item.id)} size="sm" type="button">{imageMediaId === item.id ? 'Selected' : 'Use Image'}</Button>
              </li>
            ))}
          </ul>
        )}
        {imageMediaId && <><label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`about-image-alt-${tenantId}`}>Image alt text</label><Input className="mt-2" disabled={saving} id={`about-image-alt-${tenantId}`} maxLength={250} onChange={(event) => setImageAlt(event.target.value)} required value={imageAlt} /></>}
      </section>

      {error && <p className="mt-4 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><Button disabled={saving || uploading} onClick={onCancel} type="button" variant="secondary">Cancel</Button><Button disabled={saving || uploading} type="submit">{saving ? 'Saving…' : 'Save About'}</Button></div>
    </form>
  )
}
