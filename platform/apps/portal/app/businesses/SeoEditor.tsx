'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { Button, Input, Select, StatusMessage, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getMedia, type MediaItem } from '../../lib/media'
import { updatePageSeo, updateSiteSeo, type PageSeoUpdateInput, type SiteSeoUpdateInput } from '../../lib/site'
import { type ActiveEditorController, WebsiteEditorShell } from './WebsiteEditorShell'
import { ToggleRow } from './WebsiteToolPrimitives'

const routeFor = (page: SitePage) => page.id === 'home' ? '/' : `/${page.slug}`
const pageTitleFallback = (site: SiteDefinition, page: SitePage) => page.id === 'home'
  ? site.branding.siteName
  : `${page.title} | ${site.branding.siteName}`
const descriptionFallback = (site: SiteDefinition) => site.seo?.defaultDescription || site.businessProfile?.description

function SeoImagePicker ({ currentId, currentImage, disabled, fallbackImage, label, media, onClear, onSelect }: {
  currentId?: string
  currentImage?: { src?: string, width?: number, height?: number }
  disabled: boolean
  fallbackImage?: { src?: string, width?: number, height?: number }
  label: string
  media: MediaItem[]
  onClear: () => void
  onSelect: (id: string) => void
}) {
  const selected = currentId && currentImage?.src ? { id: currentId, ...currentImage } : media.find((item) => item.id === currentId)
  return (
    <section className="mt-6" aria-labelledby={`${label}-heading`}>
      <h3 className="text-sm font-semibold text-fg" id={`${label}-heading`}>{label}</h3>
      {selected?.src ? <img alt="Selected social sharing preview" className="mt-3 aspect-[1200/630] max-w-sm rounded border border-border object-cover" height={selected.height} src={selected.src} width={selected.width} /> : fallbackImage?.src ? <><img alt="Default social sharing preview" className="mt-3 aspect-[1200/630] max-w-sm rounded border border-border object-cover" height={fallbackImage.height} src={fallbackImage.src} width={fallbackImage.width} /><p className="mt-2 text-sm text-fg-muted">Using site default.</p></> : <p className="mt-2 text-sm text-fg-muted">No image selected.</p>}
      {currentId && <Button className="mt-3" disabled={disabled} onClick={onClear} size="sm" type="button" variant="secondary">Clear image</Button>}
      {media.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-fg-muted hover:text-fg">Choose from Media Library ({media.length})</summary><ul className="mt-3 grid grid-cols-2 gap-2">
        {media.map((item) => <li className="rounded border border-border p-2" key={item.id}>
          <img alt="" className="aspect-[1200/630] w-full rounded object-cover" height={item.height} src={item.src} width={item.width} />
          <Button className="mt-2 w-full" disabled={disabled || currentId === item.id} onClick={() => onSelect(item.id)} size="sm" type="button">{currentId === item.id ? 'Selected' : 'Use image'}</Button>
        </li>)}
      </ul></details>}
    </section>
  )
}

function SiteDefaultsForm ({ chrome, contextControls, media, onBack, onCancel, onControllerChange, onDirtyChange, onSaved, site, tenantId }: EditorProps) {
  const baselineImage = site.businessProfile?.socialImageMediaId
  const [description, setDescription] = useState(site.seo?.defaultDescription ?? '')
  const [indexable, setIndexable] = useState(site.seo?.indexable !== false)
  const [imageId, setImageId] = useState<string | undefined>(baselineImage)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imageChanged = imageId !== baselineImage
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    if (description.trim().length > 500) return setError('Default search description must be 500 characters or fewer.')
    const input: SiteSeoUpdateInput = { defaultDescription: description, indexable }
    if (imageChanged) input.socialImageMediaId = imageId ?? null
    setSaving(true); setError(null)
    try { onSaved(await updateSiteSeo(tenantId, input)) } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save SEO & Social settings. Please try again.')
    } finally { setSaving(false) }
  }
  const currentImage = imageId === baselineImage ? {
    src: site.businessProfile?.socialImageSrc,
    width: site.businessProfile?.socialImageWidth,
    height: site.businessProfile?.socialImageHeight
  } : undefined
  return <WebsiteEditorShell chrome={chrome} dirtyValue={{ description: description.trim(), indexable, imageId }} editor="seo" error={error} onBack={onBack} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saving={saving}>
    {contextControls}
    <label className="block text-sm font-semibold text-fg" htmlFor={`seo-description-${tenantId}`}>Default search description</label>
    <p className="mt-1 text-sm text-fg-muted">Leave blank to use the Business Profile description. Around 150–160 characters is often useful for search snippets.</p>
    <Textarea className="mt-2" disabled={saving} id={`seo-description-${tenantId}`} maxLength={500} onChange={(event) => setDescription(event.target.value)} value={description} />
    <p className="mt-1 text-right text-xs text-fg-subtle">{description.length}/500</p>
    {site.businessProfile?.description && !description.trim() && <p className="mt-2 text-sm text-fg-muted">Current fallback: {site.businessProfile.description}</p>}
    <SeoImagePicker currentId={imageId} currentImage={currentImage} disabled={saving} label="Default social sharing image" media={media} onClear={() => setImageId(undefined)} onSelect={setImageId} />
    <p className="mt-2 text-sm text-fg-muted">Used when a page does not have its own social sharing image.</p>
    <div className="mt-6 border-y border-border"><ToggleRow checked={indexable} disabled={saving} onChange={setIndexable}>Allow search engines to index this site</ToggleRow></div>
    <p className="mt-2 text-sm text-fg-muted">Allows indexing when the live environment permits it.</p>
    {!indexable && <StatusMessage>After Publish, pages remain publicly accessible but tell search engines not to index them and the custom-domain sitemap has no page URLs.</StatusMessage>}
  </WebsiteEditorShell>
}

function PageSeoForm ({ chrome, contextControls, media, onBack, onCancel, onControllerChange, onDirtyChange, onSaved, onPreview, page, site, tenantId }: EditorProps & { onPreview: () => void, page: SitePage }) {
  const seo = page.seo
  const [title, setTitle] = useState(seo?.title ?? '')
  const [description, setDescription] = useState(seo?.description ?? '')
  const [imageId, setImageId] = useState<string | undefined>(seo?.socialImageMediaId)
  const [noIndex, setNoIndex] = useState(seo?.noIndex === true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallbackDescription = descriptionFallback(site)
  const dirty = title.trim() !== (seo?.title ?? '') || description.trim() !== (seo?.description ?? '') || imageId !== seo?.socialImageMediaId || noIndex !== (seo?.noIndex === true)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    if (title.trim().length > 120) return setError('SEO title must be 120 characters or fewer.')
    if (description.trim().length > 500) return setError('SEO description must be 500 characters or fewer.')
    const input: PageSeoUpdateInput = { title, description, socialImageMediaId: imageId ?? null, noIndex }
    setSaving(true); setError(null)
    try { onSaved(await updatePageSeo(tenantId, page.id, input)) } catch (caught) {
      setError(caught instanceof ApiError && [400, 404].includes(caught.status) ? caught.message : 'Unable to save this page SEO. Please try again.')
    } finally { setSaving(false) }
  }
  const currentImage = imageId === seo?.socialImageMediaId ? { src: seo?.socialImageSrc, width: seo?.socialImageWidth, height: seo?.socialImageHeight } : undefined
  const fallbackImage = !imageId ? { src: site.businessProfile?.socialImageSrc, width: site.businessProfile?.socialImageWidth, height: site.businessProfile?.socialImageHeight } : undefined
  return <WebsiteEditorShell chrome={chrome} dirtyValue={{ title: title.trim(), description: description.trim(), imageId, noIndex }} editor="seo" error={error} onBack={onBack} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saving={saving} secondaryActions={<Button disabled={saving || dirty} onClick={onPreview} type="button" title={dirty ? 'Save or discard your changes before previewing.' : undefined} variant="secondary">Preview {page.title}</Button>}>
    {contextControls}
    <p className="text-sm text-fg-muted"><span className="font-semibold text-fg">{page.title}</span> · {routeFor(page)}</p>
    <label className="mt-5 block text-sm font-semibold text-fg" htmlFor={`page-seo-title-${page.id}`}>SEO title</label>
    <p className="mt-1 text-sm text-fg-muted">Leave blank to use: {pageTitleFallback(site, page)}. Around 50–60 characters often works well.</p>
    <Input className="mt-2" disabled={saving} id={`page-seo-title-${page.id}`} maxLength={120} onChange={(event) => setTitle(event.target.value)} value={title} />
    <p className="mt-1 text-right text-xs text-fg-subtle">{title.length}/120</p>
    <label className="mt-5 block text-sm font-semibold text-fg" htmlFor={`page-seo-description-${page.id}`}>SEO description</label>
    <p className="mt-1 text-sm text-fg-muted">Leave blank to inherit the site default, then the Business Profile description. Around 150–160 characters is often useful.</p>
    <Textarea className="mt-2" disabled={saving} id={`page-seo-description-${page.id}`} maxLength={500} onChange={(event) => setDescription(event.target.value)} value={description} />
    <p className="mt-1 text-right text-xs text-fg-subtle">{description.length}/500</p>
    {!description.trim() && fallbackDescription && <p className="mt-2 text-sm text-fg-muted">Current fallback: {fallbackDescription}</p>}
    <SeoImagePicker currentId={imageId} currentImage={currentImage} disabled={saving} fallbackImage={fallbackImage} label="Social sharing image" media={media} onClear={() => setImageId(undefined)} onSelect={setImageId} />
    {!imageId && <p className="mt-2 text-sm text-fg-muted">A page image override is optional; this page inherits the site default when available.</p>}
    <div className="mt-6 border-y border-border"><ToggleRow checked={noIndex} disabled={saving} onChange={setNoIndex}>Prevent search engines from indexing this page</ToggleRow></div>
    <p className="mt-2 text-sm text-fg-muted">After Publish, the page remains public but is excluded from the sitemap and tells search engines not to index it.</p>
    {site.seo?.indexable === false && <StatusMessage>Site-wide indexing is currently disabled, so this page remains noindex regardless of this setting.</StatusMessage>}
  </WebsiteEditorShell>
}

type EditorProps = {
  chrome?: 'card' | 'rail'
  contextControls?: ReactNode
  media: MediaItem[]
  onBack?: () => void
  onCancel: () => void
  onControllerChange?: (controller: ActiveEditorController | null) => void
  onDirtyChange: (dirty: boolean) => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}

export function SeoEditor ({ chrome, onBack, onCancel, onControllerChange, onDirtyChange, onPreviewPage, onSaved, onSelectContext, pageId, site, tenantId }: {
  chrome?: 'card' | 'rail'
  onBack?: () => void
  onCancel: () => void
  onControllerChange?: (controller: ActiveEditorController | null) => void
  onDirtyChange: (dirty: boolean) => void
  onPreviewPage: (pageId: string) => void
  onSaved: (site: SiteDefinition) => void
  onSelectContext: (pageId?: string) => void
  pageId?: string
  site: SiteDefinition
  tenantId: string
}) {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [mediaError, setMediaError] = useState(false)
  useEffect(() => {
    let cancelled = false
    void getMedia(tenantId).then((response) => { if (!cancelled) setMedia(response.media) }).catch(() => { if (!cancelled) setMediaError(true) })
    return () => { cancelled = true }
  }, [tenantId])
  const page = pageId ? site.pages.find((candidate) => candidate.id === pageId) : undefined
  const props = { chrome, media, onBack, onCancel, onControllerChange, onDirtyChange, onSaved, site, tenantId }
  const contextButtons = useMemo(() => <div className="mb-5"><label className="text-sm font-semibold text-fg" htmlFor="seo-context">Editing</label><Select className="mt-2" id="seo-context" onChange={(event) => onSelectContext(event.target.value || undefined)} value={pageId ?? ''}><option value="">Site defaults</option>{site.pages.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title} · {routeFor(candidate)}</option>)}</Select></div>, [onSelectContext, pageId, site.pages])
  if (pageId && !page) return <div className="min-w-0">{contextButtons}{mediaError && <StatusMessage>Unable to load Media Library images. Existing images can still be kept or cleared.</StatusMessage>}<div className="rounded-lg border border-border bg-surface p-5"><StatusMessage tone="error">This page is no longer available.</StatusMessage><Button className="mt-4" onClick={() => onSelectContext()} type="button" variant="secondary">Return to SEO & Social</Button></div></div>
  const form = page ? <PageSeoForm {...props} contextControls={contextButtons} onPreview={() => onPreviewPage(page.id)} page={page} /> : <SiteDefaultsForm {...props} contextControls={contextButtons} />
  return <div className="min-w-0">{mediaError && <StatusMessage>Unable to load Media Library images. Existing images can still be kept or cleared.</StatusMessage>}{form}</div>
}
