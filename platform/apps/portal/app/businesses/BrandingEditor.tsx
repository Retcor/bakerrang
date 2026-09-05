'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { Button, FileInput, Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getMedia, uploadMedia, type MediaItem } from '../../lib/media'
import { updateSiteBranding } from '../../lib/site'
import { WebsiteEditorShell } from './WebsiteEditorShell'

export function BrandingEditor ({ onCancel, onDirtyChange = () => {}, onSaved, site, tenantId }: {
  onCancel: () => void
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
  const [saving, setSaving] = useState(false)
  const [selectedLogoFileName, setSelectedLogoFileName] = useState<string | null>(null)
  const [selectedFaviconFileName, setSelectedFaviconFileName] = useState<string | null>(null)
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
    setError(null)
    try {
      const uploaded = await uploadMedia(tenantId, file)
      setMedia((items) => [uploaded, ...items.filter((item) => item.id !== uploaded.id)])
      if (target === 'logo') setLogoMediaId(uploaded.id)
      else setFaviconMediaId(uploaded.id)
      if (target === 'logo') {
        if (logoFileInput.current) logoFileInput.current.value = ''
        setSelectedLogoFileName(null)
      } else {
        if (faviconFileInput.current) faviconFileInput.current.value = ''
        setSelectedFaviconFileName(null)
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : `Unable to upload the ${target}. Please try again.`)
    } finally {
      setUploading(false)
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
    <WebsiteEditorShell dirtyValue={{ siteName: siteName.trim(), logoMediaId, faviconMediaId }} editor="branding" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saveDisabled={uploading} saving={saving}>
      <label className="block text-sm font-semibold text-fg" htmlFor={`site-name-${tenantId}`}>Site Name</label>
      <Input className="mt-2" disabled={saving} id={`site-name-${tenantId}`} maxLength={80} onChange={(event) => setSiteName(event.target.value)} value={siteName} />
      {loadingMedia && <p className="mt-3 text-sm text-fg-muted" role="status">Loading recent images…</p>}
      <section className="mt-6" aria-labelledby={`logo-heading-${tenantId}`}>
        <h4 className="text-sm font-semibold text-fg" id={`logo-heading-${tenantId}`}>Logo (optional)</h4>
        {currentLogo?.src && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${siteName || 'Site'} logo preview`} className="mt-3 max-h-24 max-w-60 rounded border border-border bg-bg object-contain p-2" height={currentLogo.height} src={currentLogo.src} width={currentLogo.width} />
          </>
        )}
        {logoMediaId && <Button className="mt-3" disabled={saving} onClick={() => setLogoMediaId(undefined)} size="sm" type="button" variant="secondary">Remove Logo</Button>}
        <div className="mt-4">
          <FileInput accept="image/jpeg,image/png,image/webp" disabled={saving || uploading} fileName={selectedLogoFileName} id={`branding-logo-file-${tenantId}`} onChange={(event) => { const file = event.target.files?.[0]; setSelectedLogoFileName(file?.name ?? null); void upload(file, 'logo') }} ref={logoFileInput} />
          {uploading && <span className="mt-2 block text-sm text-fg-muted" role="status">Uploading…</span>}
        </div>
        {!loadingMedia && media.length > 0 && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {media.map((item) => (
              <li className="rounded border border-border p-2" key={`logo-${item.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="aspect-video w-full rounded object-contain" height={item.height} src={item.src} width={item.width} />
                <Button className="mt-2 w-full" disabled={saving || logoMediaId === item.id} onClick={() => setLogoMediaId(item.id)} size="sm" type="button">{logoMediaId === item.id ? 'Selected' : 'Use as Logo'}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-6" aria-labelledby={`favicon-heading-${tenantId}`}>
        <h4 className="text-sm font-semibold text-fg" id={`favicon-heading-${tenantId}`}>Favicon (optional)</h4>
        {currentFavicon?.src && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${siteName || 'Site'} favicon preview`} className="mt-3 max-h-24 max-w-60 rounded border border-border bg-bg object-contain p-2" height={'height' in currentFavicon ? currentFavicon.height : undefined} src={currentFavicon.src} width={'width' in currentFavicon ? currentFavicon.width : undefined} />
          </>
        )}
        {faviconMediaId && <Button className="mt-3" disabled={saving} onClick={() => setFaviconMediaId(undefined)} size="sm" type="button" variant="secondary">Remove Favicon</Button>}
        <div className="mt-4">
          <FileInput accept="image/jpeg,image/png,image/webp" disabled={saving || uploading} fileName={selectedFaviconFileName} id={`branding-favicon-file-${tenantId}`} onChange={(event) => { const file = event.target.files?.[0]; setSelectedFaviconFileName(file?.name ?? null); void upload(file, 'favicon') }} ref={faviconFileInput} />
        </div>
        {!loadingMedia && media.length > 0 && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {media.map((item) => (
              <li className="rounded border border-border p-2" key={`favicon-${item.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="aspect-video w-full rounded object-contain" height={item.height} src={item.src} width={item.width} />
                <Button className="mt-2 w-full" disabled={saving || faviconMediaId === item.id} onClick={() => setFaviconMediaId(item.id)} size="sm" type="button">{faviconMediaId === item.id ? 'Selected' : 'Use as Favicon'}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WebsiteEditorShell>
  )
}