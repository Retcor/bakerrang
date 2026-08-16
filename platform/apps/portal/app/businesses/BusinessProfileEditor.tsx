'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { Button, Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { getMedia, uploadMedia, type MediaItem } from '../../lib/media'
import { updateBusinessProfile } from '../../lib/site'

const blankAddress = { line1: '', line2: '', city: '', region: '', postalCode: '', country: '' }

export function BusinessProfileEditor ({ onCancel, onSaved, site, tenantId }: {
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const profile = site.businessProfile
  const [description, setDescription] = useState(profile?.description ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [address, setAddress] = useState({ ...blankAddress, ...profile?.address })
  const [serviceAreas, setServiceAreas] = useState(profile?.serviceAreas?.length ? profile.serviceAreas : [''])
  const [socialImageMediaId, setSocialImageMediaId] = useState(profile?.socialImageMediaId)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void getMedia(tenantId).then((response) => {
      if (!cancelled) setMedia(response.media)
    }).catch(() => {
      if (!cancelled) setError('Unable to load recent images. The current social image can still be kept or removed.')
    }).finally(() => {
      if (!cancelled) setLoadingMedia(false)
    })
    return () => { cancelled = true }
  }, [tenantId])

  const currentImage = socialImageMediaId === profile?.socialImageMediaId && profile?.socialImageSrc
    ? { id: socialImageMediaId, src: profile.socialImageSrc, width: profile.socialImageWidth, height: profile.socialImageHeight }
    : media.find((item) => item.id === socialImageMediaId)

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
      setSocialImageMediaId(uploaded.id)
      if (fileInput.current) fileInput.current.value = ''
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to upload the social image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const areas = serviceAreas.map((area) => area.trim()).filter(Boolean)
    if (description.trim().length > 300) return setError('Description must be 300 characters or fewer.')
    if (areas.length > 20 || areas.some((area) => area.length > 120)) return setError('Use up to 20 service areas of 120 characters or fewer.')
    const hasAddress = Object.values(address).some((value) => value.trim())
    if (hasAddress && !address.city.trim()) return setError('City is required when an address is provided.')
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateBusinessProfile(tenantId, {
        description,
        phone,
        email,
        address,
        serviceAreas: areas,
        ...(socialImageMediaId ? { socialImageMediaId } : {})
      }))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save the Business Profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addressFields = [
    ['line1', 'Address Line 1', 160],
    ['line2', 'Address Line 2', 160],
    ['city', 'City', 120],
    ['region', 'Region / State', 120],
    ['postalCode', 'Postal Code', 32],
    ['country', 'Country', 120]
  ] as const

  return (
    <form className="w-full max-w-3xl rounded-md border border-border bg-surface p-4 text-left" onSubmit={(event) => void submit(event)}>
      <h3 className="text-lg font-semibold text-fg">Business Profile</h3>
      <p className="mt-2 text-sm leading-6 text-fg-muted">These details may appear on your public website and in search-engine listings. Only enter information you want to be public.</p>

      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor={`profile-description-${tenantId}`}>Description</label>
      <textarea className="mt-2 min-h-28 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg" disabled={saving} id={`profile-description-${tenantId}`} maxLength={300} onChange={(event) => setDescription(event.target.value)} value={description} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label className="text-sm font-semibold text-fg" htmlFor={`profile-phone-${tenantId}`}>Phone</label><Input className="mt-2" disabled={saving} id={`profile-phone-${tenantId}`} maxLength={50} onChange={(event) => setPhone(event.target.value)} value={phone} /></div>
        <div><label className="text-sm font-semibold text-fg" htmlFor={`profile-email-${tenantId}`}>Email</label><Input className="mt-2" disabled={saving} id={`profile-email-${tenantId}`} maxLength={254} onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></div>
      </div>

      <fieldset className="mt-6 rounded-md border border-border p-4" disabled={saving}>
        <legend className="px-1 text-sm font-semibold text-fg">Public Address</legend>
        <div className="grid gap-4 sm:grid-cols-2">{addressFields.map(([key, label, max]) => <div key={key}><label className="text-sm font-semibold text-fg" htmlFor={`profile-${key}-${tenantId}`}>{label}</label><Input className="mt-2" id={`profile-${key}-${tenantId}`} maxLength={max} onChange={(event) => setAddress((current) => ({ ...current, [key]: event.target.value }))} value={address[key]} /></div>)}</div>
      </fieldset>

      <fieldset className="mt-6 rounded-md border border-border p-4" disabled={saving}>
        <legend className="px-1 text-sm font-semibold text-fg">Service Areas</legend>
        <div className="space-y-3">{serviceAreas.map((area, index) => <div className="flex gap-2" key={index}><Input aria-label={`Service area ${index + 1}`} maxLength={120} onChange={(event) => setServiceAreas((values) => values.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} value={area} /><Button className="min-h-10 border border-border bg-surface px-3 text-xs text-fg" onClick={() => setServiceAreas((values) => values.length === 1 ? [''] : values.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</Button></div>)}</div>
        <Button className="mt-3 min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={serviceAreas.length >= 20} onClick={() => setServiceAreas((values) => [...values, ''])} type="button">Add Service Area</Button>
      </fieldset>

      <section className="mt-6" aria-labelledby={`social-image-${tenantId}`}>
        <h4 className="text-sm font-semibold text-fg" id={`social-image-${tenantId}`}>Social Image (optional)</h4>
        {currentImage?.src && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Current social preview" className="mt-3 aspect-[1200/630] max-w-sm rounded border border-border object-cover" height={currentImage.height} src={currentImage.src} width={currentImage.width} />
          </>
        )}
        {socialImageMediaId && <Button className="mt-3 min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving} onClick={() => setSocialImageMediaId(undefined)} type="button">Remove Social Image</Button>}
        <input accept="image/jpeg,image/png,image/webp" className="mt-4 block w-full text-sm text-fg" disabled={saving || uploading} onChange={(event) => void upload(event.target.files?.[0])} ref={fileInput} type="file" />
        {uploading && <p className="mt-2 text-sm text-fg-muted" role="status">Uploading…</p>}
        {loadingMedia && <p className="mt-2 text-sm text-fg-muted" role="status">Loading recent images…</p>}
        {!loadingMedia && media.length > 0 && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {media.map((item) => (
              <li className="rounded border border-border p-2" key={item.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="aspect-[1200/630] w-full rounded object-cover" height={item.height} src={item.src} width={item.width} />
                <Button className="mt-2 min-h-9 w-full px-2 py-1 text-xs" disabled={saving || socialImageMediaId === item.id} onClick={() => setSocialImageMediaId(item.id)} type="button">{socialImageMediaId === item.id ? 'Selected' : 'Use Image'}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="mt-4 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving || uploading} onClick={onCancel} type="button">Cancel</Button><Button className="min-h-9 px-3 py-1.5 text-xs" disabled={saving || uploading} type="submit">{saving ? 'Saving…' : 'Save Business Profile'}</Button></div>
    </form>
  )
}
