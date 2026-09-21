'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { Badge, Button, ConfirmDialog, StatusMessage } from '@bakerrang/ui'
import { applySiteTemplate, getSiteTemplates, type SiteTemplateSummary } from '../../lib/site'
import { SitePreviewFrame } from './SitePreviewFrame'
import { ChevronRightIcon } from './SiteToolMenu'

const applyDescription = "This changes your site's design and styling — colours, fonts, corner style, spacing, and header/footer presentation. It keeps every page, section, word, photo, page SEO setting, branding detail, Business Profile value, Custom CSS rule, navigation item, lead, and Media Library asset. It affects the working site only; your published site stays unchanged until you choose Publish."
const same = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => same(value, right[index]))
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const keys = Object.keys(leftRecord)
  return keys.length === Object.keys(rightRecord).length && keys.every((key) => Object.hasOwn(rightRecord, key) && same(leftRecord[key], rightRecord[key]))
}
const fallbackHeader = { brandDisplay: 'logo' as const, navigation: { items: [] } }
const fallbackFooter = { showBranding: true, navigationMode: 'header' as const, showBusinessContact: false, showSocialLinks: true, showCopyright: true }

export function templateMatchesSite (site: SiteDefinition, template: SiteTemplateSummary) {
  const flags = template.preview.footer
  const header = site.header ?? fallbackHeader
  const footer = site.footer ?? fallbackFooter
  return same(site.theme, template.preview.theme) && header.brandDisplay === template.preview.header.brandDisplay && footer.showBranding === flags.showBranding && footer.showBusinessContact === flags.showBusinessContact && footer.showSocialLinks === flags.showSocialLinks && footer.showCopyright === flags.showCopyright
}

export function siteWithTemplatePreview (site: SiteDefinition, template: SiteTemplateSummary): SiteDefinition {
  return { ...site, theme: structuredClone(template.preview.theme), header: { ...(site.header ?? fallbackHeader), brandDisplay: template.preview.header.brandDisplay }, footer: { ...(site.footer ?? fallbackFooter), ...template.preview.footer } }
}

function TemplateThumbnail ({ pageId, site, title }: { pageId: string, site: SiteDefinition, title: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const updateScale = () => setScale(container.clientWidth / 1200)
    updateScale()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale)
      return () => window.removeEventListener('resize', updateScale)
    }
    const observer = new ResizeObserver(updateScale)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return <div aria-hidden="true" className="relative aspect-[8/5] min-w-0 overflow-hidden border-b border-border bg-bg" ref={containerRef}><div className="pointer-events-none absolute left-0 top-0 w-[1200px] origin-top-left" style={{ transform: `scale(${scale})` }}><SitePreviewFrame mode="TEMPLATE_PREVIEW" pageId={pageId} site={site} thumbnail title={title} /></div></div>
}

export function TemplatesEditor ({ onBack, onSaved, site, tenantId }: {
  onBack: () => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const [templates, setTemplates] = useState<SiteTemplateSummary[] | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [pendingTemplate, setPendingTemplate] = useState<SiteTemplateSummary | null>(null)
  const [applying, setApplying] = useState(false)
  const previewPageId = site.pages.find((page) => page.id === 'home')?.id ?? site.pages[0]?.id
  const load = async () => { setCatalogError(null); setTemplates(null); try { setTemplates(await getSiteTemplates(tenantId)) } catch { setCatalogError('Unable to load templates. Please try again.') } }

  useEffect(() => {
    let cancelled = false
    void getSiteTemplates(tenantId).then((value) => { if (!cancelled) setTemplates(value) }).catch(() => { if (!cancelled) setCatalogError('Unable to load templates. Please try again.') })
    return () => { cancelled = true }
  }, [tenantId])

  const previewSites = useMemo(() => new Map((templates ?? []).map((template) => [template.id, siteWithTemplatePreview(site, template)])), [site, templates])
  const apply = async () => {
    if (!pendingTemplate || applying) return
    const template = pendingTemplate
    setApplying(true); setApplyError(null)
    try {
      const definition = await applySiteTemplate(tenantId, template.id)
      setPendingTemplate(null)
      onSaved(definition)
    } catch { setPendingTemplate(null); setApplyError('Unable to apply this template. Please try again.') } finally { setApplying(false) }
  }

  return (
    <div className="grid min-h-0 min-w-0 w-full max-w-full flex-1 grid-cols-[minmax(0,1fr)] overflow-x-hidden lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]" data-testid="templates-workspace">
      <aside aria-label="Templates guidance" className="min-w-0 w-full max-w-full border-b border-border bg-surface px-5 py-5 lg:border-r lg:border-b-0">
        <Button onClick={onBack} size="sm" variant="ghost"><ChevronRightIcon className="size-4 rotate-180" />Back to Site Tools</Button>
        <h2 className="mt-6 text-xl font-semibold tracking-tight text-fg">Templates</h2>
        <p className="mt-3 text-sm leading-6 text-fg-muted">A template restyles your whole site — colours, fonts, corner style, spacing, and header/footer presentation. Your pages, words and photos stay exactly as they are.</p>
        <div className="mt-5 rounded-lg border border-border bg-surface-muted p-4 text-sm leading-6 text-fg-muted">Templates change the working site only. Your live site stays as it is until you choose Publish.</div>
      </aside>
      <main className="min-h-0 min-w-0 w-full max-w-full overflow-y-auto bg-bg p-5 sm:p-7" aria-label="Template gallery">
        <div className="mx-auto min-w-0 max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Choose a style</h1>
          <p className="mt-2 text-sm leading-6 text-fg-muted">Each preview is your real site restyled with that template.</p>
          {catalogError && <div className="mt-5"><StatusMessage tone="error">{catalogError} <Button className="ml-1 align-middle" onClick={() => void load()} size="sm" variant="secondary">Retry</Button></StatusMessage></div>}
          {applyError && <div className="mt-5"><StatusMessage tone="error">{applyError}</StatusMessage></div>}
          {!templates && !catalogError && <div className="mt-5"><StatusMessage>Loading templates…</StatusMessage></div>}
          {templates && <div className="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">{templates.map((template) => {
            const current = templateMatchesSite(site, template)
            const previewSite = previewSites.get(template.id)
            return <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm" key={template.id}>
              {previewSite && previewPageId ? <TemplateThumbnail pageId={previewPageId} site={previewSite} title={`${template.name} template preview`} /> : <div aria-hidden="true" className="aspect-[8/5] border-b border-border bg-bg" />}
              <div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-fg">{template.name}</h3><p className="mt-1 text-sm leading-6 text-fg-muted">{template.description}</p></div>{current && <Badge tone="success">Current</Badge>}</div>
                {template.tags.length > 0 && <ul aria-label={`${template.name} tags`} className="mt-4 flex flex-wrap gap-2">{template.tags.map((tag) => <li className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-fg-muted" key={tag}>{tag}</li>)}</ul>}
                <Button className="mt-5" disabled={applying || current} onClick={() => { setApplyError(null); setPendingTemplate(template) }}>{current ? 'Current style' : 'Apply template'}</Button>
              </div>
            </article>
          })}</div>}
        </div>
      </main>
      <ConfirmDialog busy={applying} cancelLabel="Cancel" confirmLabel="Apply Template" description={applyDescription} onCancel={() => { if (!applying) setPendingTemplate(null) }} onConfirm={() => void apply()} open={pendingTemplate !== null} title={`Apply “${pendingTemplate?.name ?? ''}”?`} />
    </div>
  )
}
