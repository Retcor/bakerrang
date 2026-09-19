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
  const [editing, setEditing] = useState<string | null>(null)
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
      <ol className="mt-3 divide-y divide-border rounded-md border border-border" aria-label={`${label} items`}>
        {items.map((item, index) => {
          const page = pageById.get(item.pageId)
          const title = page?.title ?? 'Unavailable page'
          const slug = page ? (page.slug === '/' ? '/' : `/${page.slug}`) : 'This page was deleted or is no longer available. Remove it or refresh before saving.'
          const display = item.label?.trim() ? `“${item.label.trim()}” · ${slug}` : slug
          const isEditing = editing === item.pageId
          return <li className="bg-surface" key={item.pageId}>
            <div className="flex min-h-[46px] items-center gap-2 px-2 py-1">
              <span className="flex w-5 shrink-0 flex-col"><button aria-label={`Move ${title} up`} className="grid size-5 place-items-center rounded text-fg-muted hover:bg-surface-muted hover:text-fg disabled:opacity-40" disabled={saving || index === 0} onClick={() => move(index, -1)} type="button"><svg aria-hidden className="size-3" fill="none" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg></button><button aria-label={`Move ${title} down`} className="grid size-5 place-items-center rounded text-fg-muted hover:bg-surface-muted hover:text-fg disabled:opacity-40" disabled={saving || index === items.length - 1} onClick={() => move(index, 1)} type="button"><svg aria-hidden className="size-3" fill="none" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg></button></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-fg">{title}</span><span className={`block truncate text-xs ${item.label?.trim() ? 'text-fg-muted' : 'text-fg-subtle'}`}>{display}</span></span>
              <button aria-label={`Edit label for ${title}`} aria-pressed={isEditing} className="grid size-8 place-items-center rounded text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" disabled={saving} onClick={() => setEditing(isEditing ? null : item.pageId)} type="button"><svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg></button>
              <button aria-label={`Remove ${title}`} className="grid size-8 place-items-center rounded text-danger-fg hover:bg-danger-subtle focus-visible:outline-2 focus-visible:outline-focus" disabled={saving} onClick={() => onChange(items.filter((_, current) => current !== index))} type="button"><svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg></button>
            </div>
            {isEditing && <div className="border-t border-border bg-surface-muted px-3 py-3"><label className="block text-sm font-semibold text-fg">Display label <span className="font-normal text-fg-subtle">(optional)</span><Input aria-label={`Display label for ${title}`} className="mt-2" disabled={saving} maxLength={60} onChange={(event) => update(index, { ...item, label: event.target.value })} value={item.label ?? ''} /></label>{!page && <p className="mt-2 text-xs leading-5 text-warning-fg">{slug}</p>}</div>}
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
