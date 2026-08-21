'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { Button, FileInput, Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getMedia, uploadMedia, type MediaItem } from '../../lib/media'
import { updateSiteBranding } from '../../lib/site'

export function BrandingEditor ({ onCancel, onSaved, site, tenantId }: {
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const [siteName, setSiteName] = useState(site.branding.siteName)
  const [primaryColor, setPrimaryColor] = useState(site.branding.primaryColor)
  const [accentColor, setAccentColor] = useState(site.branding.accentColor)
  const [logoMediaId, setLogoMediaId] = useState(site.branding.logoMediaId)
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
      if (!cancelled) setError('Unable to load recent images. The current logo can still be kept or removed.')
    }).finally(() => {
      if (!cancelled) setLoadingMedia(false)
    })
    return () => { cancelled = true }
  }, [tenantId])

  const currentLogo = logoMediaId === site.branding.logoMediaId && site.branding.logoSrc
    ? { id: logoMediaId, src: site.branding.logoSrc, width: site.branding.logoWidth, height: site.branding.logoHeight, originalFilename: 'Current logo' }
    : media.find((item) => item.id === logoMediaId)

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
      setLogoMediaId(uploaded.id)
      if (fileInput.current) fileInput.current.value = ''
      setSelectedFileName(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to upload the logo. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const name = siteName.trim()
    if (!name || name.length > 80) return setError('Site name must be between 1 and 80 characters.')
    if (!/^#[0-9a-f]{6}$/i.test(primaryColor) || !/^#[0-9a-f]{6}$/i.test(accentColor)) {
      return setError('Colors must use the #RRGGBB format.')
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateSiteBranding(tenantId, { siteName: name, primaryColor, accentColor, ...(logoMediaId ? { logoMediaId } : {}) }))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save branding. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const validPrimary = /^#[0-9a-f]{6}$/i.test(primaryColor) ? primaryColor : '#334155'
  const validAccent = /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : '#0f766e'
  return (
    <form className="w-full rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6" onSubmit={(event) => void submit(event)}>
      <h3 className="text-lg font-semibold text-fg">Website Branding</h3>
      <label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`site-name-${tenantId}`}>Site Name</label>
      <Input className="mt-2" disabled={saving} id={`site-name-${tenantId}`} maxLength={80} onChange={(event) => setSiteName(event.target.value)} value={siteName} />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {([['Primary Color', primaryColor, setPrimaryColor, validPrimary], ['Accent Color', accentColor, setAccentColor, validAccent]] as const).map(([label, value, setter, valid]) => (
          <div key={label}>
            <label className="text-sm font-semibold text-fg" htmlFor={`${label}-${tenantId}`}>{label}</label>
            <div className="mt-2 flex gap-2">
              <input aria-label={`${label} picker`} className="h-10 w-12 rounded border border-border bg-surface p-1" disabled={saving} onChange={(event) => setter(event.target.value)} type="color" value={valid} />
              <Input disabled={saving} id={`${label}-${tenantId}`} maxLength={7} onChange={(event) => setter(event.target.value)} value={value} />
            </div>
          </div>
        ))}
      </div>
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
          <FileInput accept="image/jpeg,image/png,image/webp" disabled={saving || uploading} fileName={selectedFileName} id={`branding-logo-file-${tenantId}`} onChange={(event) => { const file = event.target.files?.[0]; setSelectedFileName(file?.name ?? null); void upload(file) }} ref={fileInput} />
          {uploading && <span className="mt-2 block text-sm text-fg-muted" role="status">Uploading…</span>}
        </div>
        {loadingMedia && <p className="mt-3 text-sm text-fg-muted" role="status">Loading recent images…</p>}
        {!loadingMedia && media.length > 0 && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {media.map((item) => (
              <li className="rounded border border-border p-2" key={item.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="aspect-video w-full rounded object-contain" height={item.height} src={item.src} width={item.width} />
                <Button className="mt-2 w-full" disabled={saving || logoMediaId === item.id} onClick={() => setLogoMediaId(item.id)} size="sm" type="button">{logoMediaId === item.id ? 'Selected' : 'Use as Logo'}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-6 rounded-md border border-border p-4" style={{ borderTopColor: validAccent, borderTopWidth: 5 }}>
        <p className="font-semibold text-fg">Theme preview</p>
        <span className="mt-3 inline-flex rounded px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: validPrimary }}>Primary action</span>
      </div>
      {error && <p className="mt-3 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><Button disabled={saving || uploading} onClick={onCancel} type="button" variant="secondary">Cancel</Button><Button disabled={saving || uploading} type="submit">{saving ? 'Saving…' : 'Save Branding'}</Button></div>
    </form>
  )
}
