'use client'

import { useRef, useState, type FormEvent } from 'react'
import { findHomePage, isServicesSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { upsertHomeServices } from '../../lib/site'

interface EditorRow {
  key: string
  id?: string
  name: string
  description: string
}

export interface ServicesEditorProps {
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
}

export function ServicesEditor ({ tenantId, site, onCancel, onSaved }: ServicesEditorProps) {
  const home = findHomePage(site)
  const services = home?.sections.find(isServicesSection)
  const nextKey = useRef(1)
  const [title, setTitle] = useState(services?.content.title ?? 'Services')
  const [rows, setRows] = useState<EditorRow[]>(() => services
    ? services.content.items.map((item) => ({
      key: `existing-${item.id}`,
      id: item.id,
      name: item.name,
      description: item.description ?? ''
    }))
    : [{ key: 'new-0', name: '', description: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateRow = (key: string, values: Partial<Pick<EditorRow, 'name' | 'description'>>) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...values } : row))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const trimmedTitle = title.trim()
    if (!trimmedTitle) return setError('Section heading is required.')
    if (trimmedTitle.length > 100) return setError('Section heading must be 100 characters or fewer.')
    if (rows.length === 0) return setError('Add at least one service.')
    if (rows.length > 20) return setError('Services cannot exceed 20 items.')
    if (rows.some((row) => !row.name.trim())) return setError('Every service needs a name.')
    if (rows.some((row) => row.name.trim().length > 120)) return setError('Service names must be 120 characters or fewer.')
    if (rows.some((row) => row.description.length > 500)) return setError('Service descriptions must be 500 characters or fewer.')

    setSaving(true)
    setError(null)
    try {
      onSaved(await upsertHomeServices(tenantId, {
        title: trimmedTitle,
        items: rows.map(({ id, name, description }) => ({
          ...(id ? { id } : {}),
          name: name.trim(),
          description
        }))
      }))
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save Services. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="w-full max-w-xl rounded-md border border-border bg-surface p-4 text-left" onSubmit={(event) => void handleSubmit(event)}>
      <label className="text-sm font-semibold text-fg" htmlFor={`services-title-${tenantId}`}>
        Section Heading
      </label>
      <Input className="mt-2" disabled={saving} id={`services-title-${tenantId}`} maxLength={100} onChange={(event) => setTitle(event.target.value)} value={title} />

      <div className="mt-5 space-y-4">
        {rows.map((row, index) => (
          <fieldset className="rounded-md border border-border p-4" disabled={saving} key={row.key}>
            <legend className="px-1 text-sm font-semibold text-fg">Service {index + 1}</legend>
            <label className="text-sm text-fg" htmlFor={`service-name-${tenantId}-${row.key}`}>Service Name</label>
            <Input className="mt-2" id={`service-name-${tenantId}-${row.key}`} maxLength={120} onChange={(event) => updateRow(row.key, { name: event.target.value })} value={row.name} />
            <label className="mt-4 block text-sm text-fg" htmlFor={`service-description-${tenantId}-${row.key}`}>Description</label>
            <textarea className="mt-2 min-h-24 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-fg outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" id={`service-description-${tenantId}-${row.key}`} maxLength={500} onChange={(event) => updateRow(row.key, { description: event.target.value })} value={row.description} />
            <Button className="mt-3 min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} type="button">Remove</Button>
          </fieldset>
        ))}
      </div>

      <Button className="mt-4 min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving || rows.length >= 20} onClick={() => setRows((current) => [...current, { key: `new-${nextKey.current++}`, name: '', description: '' }])} type="button">Add Service</Button>
      {error && <p className="mt-3 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={saving} onClick={onCancel} type="button">Cancel</Button>
        <Button className="min-h-9 px-3 py-1.5 text-xs" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </form>
  )
}
