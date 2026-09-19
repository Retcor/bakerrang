'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { NavigationItem, SiteDefinition, SiteFooter } from '@bakerrang/site-schema'
import { Button, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSiteFooter } from '../../lib/site'
import { NavigationItemsEditor, normalizeNavigationItems } from './NavigationItemsEditor'
import { type ActiveEditorController, WebsiteEditorShell } from './WebsiteEditorShell'
import { OptionRow, ToggleRow } from './WebsiteToolPrimitives'

const fallback: SiteFooter = { showBranding: true, navigationMode: 'header', showBusinessContact: false, showSocialLinks: true, showCopyright: true }

export function FooterEditor ({ chrome, onBack, onCancel, onControllerChange, onDirtyChange = () => {}, onLivePreview, onPreview, onSaved, site, tenantId }: {
  chrome?: 'card' | 'rail'
  onBack?: () => void
  onCancel: () => void
  onControllerChange?: (controller: ActiveEditorController | null) => void
  onDirtyChange?: (dirty: boolean) => void
  onLivePreview?: (patch: Pick<SiteDefinition, 'footer'>) => void
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
  const footer = useMemo<SiteFooter>(() => ({ showBranding, navigationMode, showBusinessContact, showSocialLinks, showCopyright, ...(text.trim() ? { text: text.trim() } : {}), ...(navigationMode === 'custom' ? { navigationItems: normalizeNavigationItems(items) } : {}) }), [items, navigationMode, showBranding, showBusinessContact, showCopyright, showSocialLinks, text])
  const textTooLong = text.length > 200
  const dirty = JSON.stringify(footer) !== JSON.stringify(initial)
  useEffect(() => {
    onLivePreview?.({ footer })
  }, [footer, onLivePreview])
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (saving || !dirty || textTooLong) return; setSaving(true); setError(null); try { onSaved(await updateSiteFooter(tenantId, footer)) } catch (caught) { setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save Footer. Please try again.') } finally { setSaving(false) } }
  return <WebsiteEditorShell chrome={chrome} dirtyValue={footer} editor="footer" error={error} onBack={onBack} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saveDisabled={!dirty || textTooLong} saving={saving} secondaryActions={<Button disabled={saving || dirty} onClick={onPreview} type="button" variant="secondary">Preview Home</Button>}>
    <fieldset><legend className="text-sm font-semibold text-fg">Footer content</legend><div className="mt-2 divide-y divide-border border-y border-border">{([[showBranding, setShowBranding, 'Show branding'], [showBusinessContact, setShowBusinessContact, 'Show business contact'], [showSocialLinks, setShowSocialLinks, 'Show social links'], [showCopyright, setShowCopyright, 'Show copyright']] as const).map(([checked, setChecked, label]) => <ToggleRow checked={checked} disabled={saving} key={label} onChange={setChecked}>{label}</ToggleRow>)}</div></fieldset>
    <fieldset className="mt-6"><legend className="text-sm font-semibold text-fg">Navigation</legend><div className="mt-3 grid gap-2">{(['header', 'custom', 'none'] as const).map((value) => <OptionRow checked={navigationMode === value} disabled={saving} key={value} name="footer-navigation" onChange={() => setNavigationMode(value)} value={value}>{value === 'header' ? <>Use header navigation<span className="mt-0.5 block text-xs text-fg-subtle">Mirrors the current header menu</span></> : value === 'custom' ? <>Custom navigation<span className="mt-0.5 block text-xs text-fg-subtle">Choose a separate set of links</span></> : <>No navigation<span className="mt-0.5 block text-xs text-fg-subtle">Hide footer links entirely</span></>}</OptionRow>)}</div></fieldset>
    {navigationMode === 'header' && <p className="mt-3 text-sm text-fg-muted">The footer will always reuse the current Header navigation. Edit it in Header &amp; Navigation.</p>}
    {navigationMode === 'custom' && <NavigationItemsEditor items={items} label="Footer navigation" onChange={(next) => { setItems(next); setError(null) }} pages={site.pages} saving={saving} />}
    <section className="mt-6"><label className="block text-sm font-semibold text-fg">Footer text <span className="font-normal text-fg-subtle">(optional)</span><Textarea aria-label="Footer text" className="mt-2" disabled={saving} maxLength={201} onChange={(event) => setText(event.target.value)} value={text} /></label><p className={textTooLong ? 'mt-2 text-sm text-danger-fg' : 'mt-2 text-sm text-fg-subtle'}>{text.length}/200 characters{textTooLong ? ' — limit exceeded' : ''}</p></section>
  </WebsiteEditorShell>
}
