'use client'

import { useState } from 'react'
import type { NavigationItem, SitePage } from '@bakerrang/site-schema'
import { Button, Dialog, Input } from '@bakerrang/ui'

const normalize = (items: NavigationItem[]) => items.map((item) => ({
  pageId: item.pageId,
  ...(item.label?.trim() ? { label: item.label.trim() } : {})
}))

export { normalize as normalizeNavigationItems }

export function NavigationItemsEditor ({ items, label, onChange, pages, saving }: {
  items: NavigationItem[]
  label: string
  onChange: (items: NavigationItem[]) => void
  pages: SitePage[]
  saving: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const inMenu = new Set(items.map((item) => item.pageId))
  const available = pages.filter((page) => !inMenu.has(page.id))
  const pageById = new Map(pages.map((page) => [page.id, page]))
  const update = (index: number, next: NavigationItem) => onChange(items.map((item, current) => current === index ? next : item))
  const move = (index: number, offset: number) => {
    const next = [...items]
    ;[next[index], next[index + offset]] = [next[index + offset]!, next[index]!]
    onChange(next)
  }
  const appendAll = () => onChange([...items, ...available.map((page) => ({ pageId: page.id }))])
  return (
    <section aria-labelledby={`${label}-navigation-heading`} className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-sm font-semibold text-fg" id={`${label}-navigation-heading`}>{label}</h3><p className="mt-1 text-sm text-fg-muted">Choose pages and arrange the order visitors see. A blank label uses the current page title.</p></div>
        <div className="flex gap-2"><Button disabled={saving || available.length === 0} onClick={appendAll} size="sm" type="button" variant="secondary">Add all</Button><Button disabled={saving || available.length === 0} onClick={() => setPickerOpen(true)} size="sm" type="button">Add Page</Button></div>
      </div>
      <ol className="mt-4 space-y-3" aria-label={`${label} items`}>
        {items.map((item, index) => {
          const page = pageById.get(item.pageId)
          return <li className="rounded-md border border-border bg-surface-muted p-3" key={item.pageId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold text-fg">{page?.title ?? 'Unavailable page'}</p><p className="mt-1 text-xs text-fg-subtle">{page ? (page.slug === '/' ? '/' : `/${page.slug}`) : 'This page was deleted or is no longer available. Remove it or refresh before saving.'}</p></div>
              <div className="flex gap-2"><Button aria-label={`Move ${page?.title ?? 'unavailable page'} up`} disabled={saving || index === 0} onClick={() => move(index, -1)} size="sm" type="button" variant="secondary">Up</Button><Button aria-label={`Move ${page?.title ?? 'unavailable page'} down`} disabled={saving || index === items.length - 1} onClick={() => move(index, 1)} size="sm" type="button" variant="secondary">Down</Button><Button aria-label={`Remove ${page?.title ?? 'unavailable page'}`} disabled={saving} onClick={() => onChange(items.filter((_, current) => current !== index))} size="sm" type="button" variant="danger">Remove</Button></div>
            </div>
            <label className="mt-3 block text-sm font-semibold text-fg">Display label <span className="font-normal text-fg-subtle">(optional)</span><Input aria-label={`Display label for ${page?.title ?? 'unavailable page'}`} className="mt-2" disabled={saving} maxLength={60} onChange={(event) => update(index, { ...item, label: event.target.value })} value={item.label ?? ''} /></label>
          </li>
        })}
      </ol>
      {items.length === 0 && <p className="mt-4 rounded-md border border-dashed border-border p-4 text-sm text-fg-muted">No pages are in this navigation yet.</p>}
      <Dialog description="Select a page to add. Pages already in this navigation are not repeated." onClose={() => setPickerOpen(false)} open={pickerOpen} title={`Add page to ${label}`}>
        <div className="space-y-2">{available.map((page) => <Button className="w-full justify-start" key={page.id} onClick={() => { onChange([...items, { pageId: page.id }]); setPickerOpen(false) }} type="button" variant="secondary">{page.title} <span className="ml-2 text-fg-subtle">{page.slug === '/' ? '/' : `/${page.slug}`}</span></Button>)}{available.length === 0 && <p className="text-sm text-fg-muted">Every current page is already included.</p>}</div>
      </Dialog>
    </section>
  )
}
