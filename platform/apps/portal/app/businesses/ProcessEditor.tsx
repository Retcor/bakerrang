'use client'

import { useRef, useState, type FormEvent } from 'react'
import { isProcessSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, Input, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSectionContent } from '../../lib/site'
import { RowActions } from './RowActions'
import { WebsiteEditorShell } from './WebsiteEditorShell'

type Row = { key: string, id?: string, title: string, description: string }
export function ProcessEditor ({ pageId, sectionId, tenantId, site, onCancel, onDirtyChange = () => {}, onSaved }: { pageId: string, sectionId: string, tenantId: string, site: SiteDefinition, onCancel: () => void, onDirtyChange?: (dirty: boolean) => void, onSaved: (site: SiteDefinition) => void }) {
  const section = site.pages.find((page) => page.id === pageId)?.sections.find((item) => item.id === sectionId)
  const process = section && isProcessSection(section) ? section : undefined
  const next = useRef(1); const [heading, setHeading] = useState(process?.content.heading ?? '')
  const [intro, setIntro] = useState(process?.content.intro ?? '')
  const [rows, setRows] = useState<Row[]>(() => process?.content.items.map((item) => ({ key: item.id, id: item.id, title: item.title, description: item.description ?? '' })) ?? [{ key: 'new-0', title: '', description: '' }])
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const move = (index: number, delta: number) => setRows((items) => { const target = index + delta; if (target < 0 || target >= items.length) return items; const copy = [...items]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy })
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!rows.length || rows.some((row) => !row.title.trim())) return setError('Every step needs a title.'); setSaving(true); setError(null); try { onSaved(await updateSectionContent(tenantId, pageId, sectionId, { ...(heading.trim() ? { heading: heading.trim() } : {}), ...(intro.trim() ? { intro: intro.trim() } : {}), items: rows.map(({ id, title, description }) => ({ ...(id ? { id } : {}), title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) })) })) } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Unable to save Steps.') } finally { setSaving(false) } }
  return <WebsiteEditorShell dirtyValue={{ heading, intro, rows }} editor="process" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saving={saving} width="wide">
    <label className="text-sm font-semibold text-fg" htmlFor={`process-heading-${tenantId}`}>Heading <span className="font-normal text-fg-muted">Optional</span></label><Input className="mt-2" id={`process-heading-${tenantId}`} maxLength={120} onChange={(event) => setHeading(event.target.value)} value={heading} />
    <label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`process-intro-${tenantId}`}>Intro <span className="font-normal text-fg-muted">Optional</span></label><Textarea className="mt-2" id={`process-intro-${tenantId}`} maxLength={300} onChange={(event) => setIntro(event.target.value)} value={intro} />
    <div className="mt-5 space-y-3">{rows.map((row, index) => <fieldset className="rounded-md border border-border p-4" key={row.key}><legend className="px-1 text-sm font-semibold text-fg">Step {index + 1}</legend><Input aria-label={`Step ${index + 1} title`} maxLength={80} onChange={(event) => setRows((items) => items.map((item) => item.key === row.key ? { ...item, title: event.target.value } : item))} value={row.title} /><Textarea aria-label={`Step ${index + 1} description`} className="mt-3" maxLength={300} onChange={(event) => setRows((items) => items.map((item) => item.key === row.key ? { ...item, description: event.target.value } : item))} value={row.description} /><RowActions className="mt-2" moveDown={{ label: 'Move step down', disabled: index === rows.length - 1, onClick: () => move(index, 1) }} moveUp={{ label: 'Move step up', disabled: index === 0, onClick: () => move(index, -1) }} remove={{ label: 'Delete step', onClick: () => setRows((items) => items.filter((item) => item.key !== row.key)) }} /></fieldset>)}</div>
    <Button className="mt-4" disabled={rows.length >= 8} onClick={() => setRows((items) => [...items, { key: `new-${next.current++}`, title: '', description: '' }])} size="sm" type="button" variant="secondary">Add step</Button>
  </WebsiteEditorShell>
}
