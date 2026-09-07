'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Button, ConfirmDialog, Dialog, Input, StatusMessage } from '@bakerrang/ui'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { ApiError } from '../../lib/api'
import { createPage, deletePage, movePage, updatePage } from '../../lib/site'

const reserved = new Set(['preview', 'site'])
export function suggestPageSlug (title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 60)
}
export function pageSlugError (slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return 'Use 1–60 lowercase letters, numbers, and single hyphens.'
  if (reserved.has(slug)) return 'This URL is reserved.'
  return null
}

type PageFormProps = { initial?: { title: string, slug: string }, onClose: () => void, onDirtyChange?: (dirty: boolean) => void, onSaved: (site: SiteDefinition, pageId?: string) => void, open: boolean, site: SiteDefinition, tenantId: string, pageId?: string }
function PageForm ({ initial, onClose, onDirtyChange, onSaved, open, pageId, tenantId }: PageFormProps) {
  const creating = !pageId
  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [manualSlug, setManualSlug] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const slugError = pageSlugError(slug)
  const dirty = !creating && (title !== (initial?.title ?? '') || slug !== (initial?.slug ?? ''))
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (!title.trim()) return setError('Title is required.')
    if (slugError) return setError(slugError)
    setSaving(true); setError(null)
    try {
      if (creating) {
        const result = await createPage(tenantId, { title: title.trim(), slug })
        onSaved(result.site, result.pageId)
      } else onSaved(await updatePage(tenantId, pageId, { title: title.trim(), slug }))
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Unable to save this page. Please try again.') } finally { setSaving(false) }
  }
  const setPageTitle = (value: string) => { setTitle(value); if (creating && !manualSlug) setSlug(suggestPageSlug(value)) }
  return <Dialog description={creating ? 'Create an empty working page. Publish Site makes it live.' : 'Update this page’s title or public URL.'} onClose={onClose} open={open} title={creating ? 'Add page' : 'Page settings'}>
    <form className="space-y-4" noValidate onSubmit={(event) => void submit(event)}>
      <label className="block text-sm font-semibold text-fg" htmlFor="page-title">Title<Input className="mt-2" disabled={saving} id="page-title" maxLength={120} onChange={(event) => setPageTitle(event.target.value)} required value={title} /></label>
      <label className="block text-sm font-semibold text-fg" htmlFor="page-slug">Slug<Input aria-describedby="page-slug-help" className="mt-2" disabled={saving} id="page-slug" maxLength={60} onChange={(event) => { setManualSlug(true); setSlug(event.target.value) }} required value={slug} /></label>
      <p className="text-sm text-fg-muted" id="page-slug-help">Public URL: /{slug || 'your-page'}</p>
      {!creating && <p className="text-sm text-warning-fg">Changing the URL will cause the previous URL to stop working after you publish.</p>}
      {(error || slugError) && <StatusMessage tone="error">{error ?? slugError}</StatusMessage>}
      <div className="flex justify-end gap-2"><Button disabled={saving} onClick={onClose} type="button" variant="secondary">Cancel</Button><Button disabled={saving || Boolean(slugError)} type="submit">{saving ? 'Saving…' : creating ? 'Create page' : 'Save changes'}</Button></div>
    </form>
  </Dialog>
}

export function PagesManager ({ onDirtyChange, onEditPage, onPreviewPage, onSaved, site, tenantId }: { onDirtyChange?: (dirty: boolean) => void, onEditPage: (pageId: string) => void, onPreviewPage: (pageId: string) => void, onSaved: (site: SiteDefinition, message?: string) => void, site: SiteDefinition, tenantId: string }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selected = site.pages.find((page) => page.id === settingsId)
  const deleting = site.pages.find((page) => page.id === deleteId)
  const command = async (key: string, work: () => Promise<SiteDefinition>, message: string) => {
    if (pending) return
    setPending(key); setError(null)
    try { onSaved(await work(), message) } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Unable to update pages. Please try again.') } finally { setPending(null) }
  }
  return <div className="min-w-0 w-full max-w-5xl rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6">
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle">Pages</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-fg">Pages</h2><p className="mt-1 text-sm leading-6 text-fg-muted">Changes are saved to Working. Publish Site makes them live.</p></div><Button disabled={Boolean(pending)} onClick={() => setCreateOpen(true)}>Add page</Button></header>
    {error && <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div>}
    <ul className="mt-5 space-y-3">{site.pages.map((page, index) => { const home = page.id === 'home'; return <li className="rounded-md border border-border p-4" key={page.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-fg">{home ? 'Home' : page.title}</h3><p className="mt-1 text-sm text-fg-muted">{page.slug === '/' ? '/' : `/${page.slug}`} · {page.sections.length} {page.sections.length === 1 ? 'section' : 'sections'}</p></div><div className="flex flex-wrap gap-2"><Button disabled={Boolean(pending)} onClick={() => onEditPage(page.id)} size="sm">Edit sections</Button><Button disabled={Boolean(pending)} onClick={() => onPreviewPage(page.id)} size="sm" variant="secondary">Preview</Button>{!home && <><Button disabled={Boolean(pending)} onClick={() => setSettingsId(page.id)} size="sm" variant="secondary">Page settings</Button><Button aria-label={`Move ${page.title} up`} disabled={Boolean(pending) || index <= 1} onClick={() => void command(`move:${page.id}`, () => movePage(tenantId, page.id, 'up'), 'Page order updated.')} size="sm" variant="secondary">Move Up</Button><Button aria-label={`Move ${page.title} down`} disabled={Boolean(pending) || index === site.pages.length - 1} onClick={() => void command(`move:${page.id}`, () => movePage(tenantId, page.id, 'down'), 'Page order updated.')} size="sm" variant="secondary">Move Down</Button><Button disabled={Boolean(pending)} onClick={() => setDeleteId(page.id)} size="sm" variant="danger">Delete</Button></>}</div></div></li> })}</ul>
    <PageForm key={createOpen ? 'create-open' : 'create-closed'} onClose={() => setCreateOpen(false)} onSaved={(next, pageId) => { setCreateOpen(false); onSaved(next, 'Page created.'); if (pageId) onEditPage(pageId) }} open={createOpen} site={site} tenantId={tenantId} />
    {selected && <PageForm initial={{ title: selected.title, slug: selected.slug }} onClose={() => setSettingsId(null)} onDirtyChange={onDirtyChange} onSaved={(next) => { setSettingsId(null); onSaved(next, 'Page settings saved.') }} open pageId={selected.id} site={site} tenantId={tenantId} />}
    <ConfirmDialog busy={Boolean(pending)} cancelLabel="Keep page" confirmLabel="Delete page" description={`This removes ${deleting?.title ?? 'this page'} from Working. The currently published version remains live until you Publish Site. Media Library items are not deleted.`} onCancel={() => setDeleteId(null)} onConfirm={() => { if (deleting) void command(`delete:${deleting.id}`, () => deletePage(tenantId, deleting.id), 'Page deleted.'); setDeleteId(null) }} open={Boolean(deleting)} title="Delete page?" />
  </div>
}
