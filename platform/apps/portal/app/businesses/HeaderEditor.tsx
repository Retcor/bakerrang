'use client'

import { useState, type FormEvent } from 'react'
import type { LinkAction, NavigationItem, SiteDefinition, SiteHeader } from '@bakerrang/site-schema'
import { Button, Input, Select, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSiteHeader } from '../../lib/site'
import { NavigationItemsEditor, normalizeNavigationItems } from './NavigationItemsEditor'
import { WebsiteEditorShell } from './WebsiteEditorShell'

const fallback: SiteHeader = { brandDisplay: 'logo', navigation: { items: [] } }
const actionIsValid = (action: LinkAction) => {
  if (action.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(action.value.trim())
  if (action.type === 'phone') return action.value.replace(/[^0-9]/g, '').length >= 7
  try { const url = new URL(action.value); return url.protocol === 'http:' || url.protocol === 'https:' } catch { return false }
}

export function HeaderEditor ({ onCancel, onDirtyChange = () => {}, onPreview, onSaved, site, tenantId }: {
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onPreview: () => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const initial = site.header ?? fallback
  const [brandDisplay, setBrandDisplay] = useState(initial.brandDisplay)
  const [items, setItems] = useState<NavigationItem[]>(initial.navigation.items)
  const [ctaEnabled, setCtaEnabled] = useState(Boolean(initial.cta))
  const [buttonLabel, setButtonLabel] = useState(initial.cta?.buttonLabel ?? '')
  const [actionType, setActionType] = useState<LinkAction['type']>(initial.cta?.action.type ?? 'email')
  const [actionValue, setActionValue] = useState(initial.cta?.action.value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const header: SiteHeader = { brandDisplay, navigation: { items: normalizeNavigationItems(items) }, ...(ctaEnabled ? { cta: { buttonLabel: buttonLabel.trim(), action: { type: actionType, value: actionValue.trim() } } } : {}) }
  const ctaInvalid = ctaEnabled && (!header.cta?.buttonLabel || header.cta.buttonLabel.length > 60 || !actionIsValid(header.cta.action))
  const dirty = JSON.stringify(header) !== JSON.stringify(initial)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || !dirty) return
    if (ctaInvalid) { setError('Enter a CTA label and a valid email address, phone number, or http(s) URL.'); return }
    setSaving(true); setError(null)
    try { onSaved(await updateSiteHeader(tenantId, header)) } catch (caught) { setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save Header & Navigation. Please try again.') } finally { setSaving(false) }
  }
  return <WebsiteEditorShell dirtyValue={header} editor="header" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saveDisabled={!dirty || ctaInvalid} saving={saving} secondaryActions={<Button disabled={saving || dirty} onClick={onPreview} type="button" variant="secondary">Preview Home</Button>}>
    <fieldset><legend className="text-sm font-semibold text-fg">Brand display</legend><div className="mt-3 grid gap-2 sm:grid-cols-3">{(['logo', 'logoAndName', 'name'] as const).map((value) => <label className="flex min-h-11 items-center gap-2 rounded-md border border-border-strong px-3 text-sm text-fg" key={value}><input checked={brandDisplay === value} disabled={saving} name="brand-display" onChange={() => setBrandDisplay(value)} type="radio" value={value} />{value === 'logoAndName' ? 'Logo and name' : value === 'logo' ? 'Logo' : 'Name'}</label>)}</div></fieldset>
    <NavigationItemsEditor items={items} label="Header navigation" onChange={(next) => { setItems(next); setError(null) }} pages={site.pages} saving={saving} />
    <section className="mt-6 border-t border-border pt-6"><label className="flex items-center gap-3 text-sm font-semibold text-fg"><input checked={ctaEnabled} disabled={saving} onChange={(event) => setCtaEnabled(event.target.checked)} type="checkbox" />Show a header CTA</label>{ctaEnabled && <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-fg">Button label<Input aria-label="CTA button label" className="mt-2" disabled={saving} maxLength={60} onChange={(event) => setButtonLabel(event.target.value)} value={buttonLabel} /></label><label className="text-sm font-semibold text-fg">Destination type<Select aria-label="CTA destination type" className="mt-2" disabled={saving} onChange={(event) => setActionType(event.target.value as LinkAction['type'])} value={actionType}><option value="email">Email</option><option value="phone">Phone</option><option value="url">URL</option></Select></label><label className="text-sm font-semibold text-fg sm:col-span-2">{actionType === 'url' ? 'URL' : actionType === 'email' ? 'Email address' : 'Phone number'}<Input aria-label="CTA destination" className="mt-2" disabled={saving} onChange={(event) => setActionValue(event.target.value)} value={actionValue} /></label></div>}</section>
    {ctaInvalid && <div className="mt-4"><StatusMessage tone="error">The CTA needs a label and a valid destination before it can be saved.</StatusMessage></div>}
  </WebsiteEditorShell>
}
