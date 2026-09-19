'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getMedia, uploadMedia, type MediaItem } from '../../lib/media'
import { updateSiteBranding } from '../../lib/site'
import { type ActiveEditorController, WebsiteEditorShell } from './WebsiteEditorShell'

export function BrandingEditor ({ chrome, onBack, onCancel, onControllerChange, onDirtyChange = () => {}, onSaved, site, tenantId }: {
  chrome?: 'card' | 'rail'
  onBack?: () => void
  onCancel: () => void
  onControllerChange?: (controller: ActiveEditorController | null) => void
  onDirtyChange?: (dirty: boolean) => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const [siteName, setSiteName] = useState(site.branding.siteName)
  const [logoMediaId, setLogoMediaId] = useState(site.branding.logoMediaId)
  const [faviconMediaId, setFaviconMediaId] = useState(site.branding.faviconMediaId)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<'logo' | 'favicon' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logoFileInput = useRef<HTMLInputElement>(null)
  const faviconFileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void getMedia(tenantId).then((response) => {
      if (!cancelled) setMedia(response.media)
    }).catch(() => {
      if (!cancelled) setError('Unable to load recent images. The current logo and favicon can still be kept or removed.')
    }).finally(() => {
      if (!cancelled) setLoadingMedia(false)
    })
    return () => { cancelled = true }
  }, [tenantId])

  const currentLogo = logoMediaId === site.branding.logoMediaId && site.branding.logoSrc
    ? { id: logoMediaId, src: site.branding.logoSrc, width: site.branding.logoWidth, height: site.branding.logoHeight, originalFilename: 'Current logo' }
    : media.find((item) => item.id === logoMediaId)

  const currentFavicon = faviconMediaId === site.branding.faviconMediaId && site.branding.faviconSrc
    ? { id: faviconMediaId, src: site.branding.faviconSrc, originalFilename: 'Current favicon' }
    : media.find((item) => item.id === faviconMediaId)

  const upload = async (file: File | undefined, target: 'logo' | 'favicon') => {
    if (!file || uploading) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError('Choose one JPEG, PNG, or WebP image up to 10 MB.')
      return
    }
    setUploading(true)
    setUploadTarget(target)
    setError(null)
    try {
      const uploaded = await uploadMedia(tenantId, file)
      setMedia((items) => [uploaded, ...items.filter((item) => item.id !== uploaded.id)])
      if (target === 'logo') setLogoMediaId(uploaded.id)
      else setFaviconMediaId(uploaded.id)
      if (target === 'logo') {
        if (logoFileInput.current) logoFileInput.current.value = ''
      } else {
        if (faviconFileInput.current) faviconFileInput.current.value = ''
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : `Unable to upload the ${target}. Please try again.`)
    } finally {
      setUploading(false)
      setUploadTarget(null)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const name = siteName.trim()
    if (!name || name.length > 80) return setError('Site name must be between 1 and 80 characters.')
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateSiteBranding(tenantId, {
        siteName: name,
        ...(logoMediaId ? { logoMediaId } : {}),
        ...(faviconMediaId ? { faviconMediaId } : {})
      }))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save branding. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WebsiteEditorShell chrome={chrome} dirtyValue={{ siteName: siteName.trim(), logoMediaId, faviconMediaId }} editor="branding" error={error} onBack={onBack} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saveDisabled={uploading} saving={saving}>
      <label className="block text-sm font-semibold text-fg" htmlFor={`site-name-${tenantId}`}>Site Name</label>
      <Input className="mt-2" disabled={saving} id={`site-name-${tenantId}`} maxLength={80} onChange={(event) => setSiteName(event.target.value)} value={siteName} />
      <p className="mt-1 text-right text-xs tabular-nums text-fg-subtle">{siteName.length}/80</p>
      {loadingMedia && <p className="mt-3 text-sm text-fg-muted" role="status">Loading recent images…</p>}
      <section className="mt-6" aria-labelledby={`logo-heading-${tenantId}`}>
        <h4 className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-fg-subtle" id={`logo-heading-${tenantId}`}>Logo · optional</h4>
        <div className="mt-3 flex min-h-[3.75rem] items-center gap-3 rounded-md border border-border bg-surface px-3 py-2" data-testid="current-logo-row">
          {currentLogo?.src ? <><img alt={`${siteName || 'Site'} logo preview`} className="size-10 shrink-0 rounded border border-border bg-bg object-contain p-1" height={currentLogo.height} src={currentLogo.src} width={currentLogo.width} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-fg">{currentLogo.originalFilename}</span><span className="mt-0.5 block text-xs tabular-nums text-fg-subtle">{currentLogo.width && currentLogo.height ? `${currentLogo.width} × ${currentLogo.height}` : 'Image dimensions unavailable'}</span></span><button aria-label="Remove logo" className="grid size-8 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-focus" disabled={saving} onClick={() => setLogoMediaId(undefined)} type="button"><RemoveIcon /></button></> : <span className="text-sm text-fg-muted">No logo selected</span>}
        </div>
        <label className={`mt-3 flex min-h-[3.5rem] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 text-sm font-semibold text-fg-muted transition-colors hover:border-focus hover:text-fg focus-within:outline-2 focus-within:outline-focus ${saving || uploading ? 'cursor-not-allowed opacity-60' : ''}`} htmlFor={`branding-logo-file-${tenantId}`}><UploadIcon />{uploadTarget === 'logo' ? 'Uploading…' : 'Upload a new logo'}<input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={saving || uploading} id={`branding-logo-file-${tenantId}`} onChange={(event) => { void upload(event.target.files?.[0], 'logo') }} ref={logoFileInput} type="file" /></label>
        <p className="mt-2 text-xs leading-5 text-fg-subtle">JPEG, PNG, or WebP · up to 10 MB. Uploads save to the Media Library immediately.</p>
        {!loadingMedia && media.length > 0 && (
          <details className="mt-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden"><ChevronIcon />Recent uploads ({media.length})</summary><ul className="mt-3 grid grid-cols-3 gap-2">
            {media.map((item) => (
              <li key={`logo-${item.id}`}><button aria-label={`Use ${item.originalFilename} as logo`} aria-pressed={logoMediaId === item.id} className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-bg p-1 transition hover:border-border-strong focus-visible:outline-2 focus-visible:outline-focus aria-pressed:border-focus aria-pressed:ring-2 aria-pressed:ring-focus/20" disabled={saving} onClick={() => setLogoMediaId(item.id)} type="button"><img alt="" className="size-full object-contain" height={item.height} src={item.src} width={item.width} />{logoMediaId === item.id && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-brand text-brand-ink"><CheckIcon /></span>}</button></li>
            ))}
          </ul></details>
        )}
      </section>
      <section className="mt-6" aria-labelledby={`favicon-heading-${tenantId}`}>
        <h4 className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-fg-subtle" id={`favicon-heading-${tenantId}`}>Favicon · optional</h4>
        <div className="mt-3 flex min-h-[3.75rem] items-center gap-3 rounded-md border border-border bg-surface px-3 py-2" data-testid="current-favicon-row">
          {currentFavicon?.src ? <><img alt={`${siteName || 'Site'} favicon preview`} className="size-10 shrink-0 rounded border border-border bg-bg object-contain p-1" height={'height' in currentFavicon ? currentFavicon.height : undefined} src={currentFavicon.src} width={'width' in currentFavicon ? currentFavicon.width : undefined} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-fg">{currentFavicon.originalFilename}</span><span className="mt-0.5 block text-xs tabular-nums text-fg-subtle">{'width' in currentFavicon && currentFavicon.width && currentFavicon.height ? `${currentFavicon.width} × ${currentFavicon.height}` : 'Image dimensions unavailable'}</span></span><button aria-label="Remove favicon" className="grid size-8 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-focus" disabled={saving} onClick={() => setFaviconMediaId(undefined)} type="button"><RemoveIcon /></button></> : <span className="min-w-0"><span className="block text-sm font-semibold text-fg">No favicon selected</span><span className="mt-0.5 block text-xs text-fg-subtle">The site name initial is used</span></span>}
        </div>
        <label className={`mt-3 flex min-h-[3.5rem] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 text-sm font-semibold text-fg-muted transition-colors hover:border-focus hover:text-fg focus-within:outline-2 focus-within:outline-focus ${saving || uploading ? 'cursor-not-allowed opacity-60' : ''}`} htmlFor={`branding-favicon-file-${tenantId}`}><UploadIcon />{uploadTarget === 'favicon' ? 'Uploading…' : 'Upload a new favicon'}<input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={saving || uploading} id={`branding-favicon-file-${tenantId}`} onChange={(event) => { void upload(event.target.files?.[0], 'favicon') }} ref={faviconFileInput} type="file" /></label>
        <p className="mt-2 text-xs leading-5 text-fg-subtle">JPEG, PNG, or WebP · up to 10 MB. Square images work best.</p>
        {!loadingMedia && media.length > 0 && (
          <details className="mt-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden"><ChevronIcon />Recent uploads ({media.length})</summary><ul className="mt-3 grid grid-cols-3 gap-2">
            {media.map((item) => (
              <li key={`favicon-${item.id}`}><button aria-label={`Use ${item.originalFilename} as favicon`} aria-pressed={faviconMediaId === item.id} className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-bg p-1 transition hover:border-border-strong focus-visible:outline-2 focus-visible:outline-focus aria-pressed:border-focus aria-pressed:ring-2 aria-pressed:ring-focus/20" disabled={saving} onClick={() => setFaviconMediaId(item.id)} type="button"><img alt="" className="size-full object-contain" height={item.height} src={item.src} width={item.width} />{faviconMediaId === item.id && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-brand text-brand-ink"><CheckIcon /></span>}</button></li>
            ))}
          </ul></details>
        )}
      </section>
    </WebsiteEditorShell>
  )
}

function UploadIcon () { return <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="M12 16V5m-4 4 4-4 4 4M5 15v4h14v-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg> }
function RemoveIcon () { return <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg> }
function ChevronIcon () { return <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg> }
function CheckIcon () { return <svg aria-hidden className="size-3" fill="none" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg> }
