'use client'

import { useState, type FormEvent } from 'react'
import type { NavigationItem, SiteDefinition, SiteFooter } from '@bakerrang/site-schema'
import { Button, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSiteFooter } from '../../lib/site'
import { NavigationItemsEditor, normalizeNavigationItems } from './NavigationItemsEditor'
import { WebsiteEditorShell } from './WebsiteEditorShell'

const fallback: SiteFooter = { showBranding: true, navigationMode: 'header', showBusinessContact: false, showSocialLinks: true, showCopyright: true }

export function FooterEditor ({ onCancel, onDirtyChange = () => {}, onPreview, onSaved, site, tenantId }: {
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onPreview: () => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const initial = site.footer ?? fallback
  const [showBranding, setShowBranding] = useState(initial.showBranding)
  const [navigationMode, setNavigationMode] = useState<SiteFooter['navigationMode']>(initial.navigationMode)
  const [items, setItems] = useState<NavigationItem[]>(initial.navigationItems ?? [])
  const [showBusinessContact, setShowBusinessContact] = useState(initial.showBusinessContact)
  const [showSocialLinks, setShowSocialLinks] = useState(initial.showSocialLinks)
  const [showCopyright, setShowCopyright] = useState(initial.showCopyright)
  const [text, setText] = useState(initial.text ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const footer: SiteFooter = { showBranding, navigationMode, showBusinessContact, showSocialLinks, showCopyright, ...(text.trim() ? { text: text.trim() } : {}), ...(navigationMode === 'custom' ? { navigationItems: normalizeNavigationItems(items) } : {}) }
  const textTooLong = text.length > 200
  const dirty = JSON.stringify(footer) !== JSON.stringify(initial)
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (saving || !dirty || textTooLong) return; setSaving(true); setError(null); try { onSaved(await updateSiteFooter(tenantId, footer)) } catch (caught) { setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save Footer. Please try again.') } finally { setSaving(false) } }
  return <WebsiteEditorShell dirtyValue={footer} editor="footer" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saveDisabled={!dirty || textTooLong} saving={saving} secondaryActions={<Button disabled={saving || dirty} onClick={onPreview} type="button" variant="secondary">Preview Home</Button>}>
    <fieldset><legend className="text-sm font-semibold text-fg">Footer content</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{([[showBranding, setShowBranding, 'Show branding'], [showBusinessContact, setShowBusinessContact, 'Show business contact'], [showSocialLinks, setShowSocialLinks, 'Show social links'], [showCopyright, setShowCopyright, 'Show copyright']] as const).map(([checked, setChecked, label]) => <label className="flex min-h-11 items-center gap-3 rounded-md border border-border-strong px-3 text-sm font-semibold text-fg" key={label}><input checked={checked} disabled={saving} onChange={(event) => setChecked(event.target.checked)} type="checkbox" />{label}</label>)}</div></fieldset>
    <fieldset className="mt-6"><legend className="text-sm font-semibold text-fg">Navigation</legend><div className="mt-3 grid gap-2 sm:grid-cols-3">{(['header', 'custom', 'none'] as const).map((value) => <label className="flex min-h-11 items-center gap-2 rounded-md border border-border-strong px-3 text-sm text-fg" key={value}><input checked={navigationMode === value} disabled={saving} name="footer-navigation" onChange={() => setNavigationMode(value)} type="radio" value={value} />{value === 'header' ? 'Use header navigation' : value === 'custom' ? 'Custom navigation' : 'No navigation'}</label>)}</div></fieldset>
    {navigationMode === 'header' && <p className="mt-3 text-sm text-fg-muted">The footer will always reuse the current Header navigation. Edit it in Header &amp; Navigation.</p>}
    {navigationMode === 'custom' && <NavigationItemsEditor items={items} label="Footer navigation" onChange={(next) => { setItems(next); setError(null) }} pages={site.pages} saving={saving} />}
    <section className="mt-6"><label className="block text-sm font-semibold text-fg">Footer text <span className="font-normal text-fg-subtle">(optional)</span><Textarea aria-label="Footer text" className="mt-2" disabled={saving} maxLength={201} onChange={(event) => setText(event.target.value)} value={text} /></label><p className={textTooLong ? 'mt-2 text-sm text-danger-fg' : 'mt-2 text-sm text-fg-subtle'}>{text.length}/200 characters{textTooLong ? ' — limit exceeded' : ''}</p></section>
  </WebsiteEditorShell>
}
