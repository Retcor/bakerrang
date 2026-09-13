'use client'

import { useEffect, useState } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { Button, Card, ConfirmDialog, StatusMessage } from '@bakerrang/ui'
import { applySiteTemplate, getSiteTemplates, type SiteTemplateSummary } from '../../lib/site'

const applyDescription = "This replaces the current working site's design, header and navigation, footer and navigation, pages, page content and sections, and page-specific SEO. It preserves your business name, logo, favicon, Business Profile contact details, hours and social links, site-wide SEO settings, Media Library, leads, and existing Custom CSS. Existing Custom CSS is preserved and may affect the appearance of the new template. Apply changes the working site only; your published live site remains unchanged until you choose Publish Site. This cannot be undone from the Templates screen."

export function TemplatesEditor ({ onSaved, tenantId }: {
  onSaved: (site: SiteDefinition, successMessage?: string, offerHomePreview?: boolean) => void
  tenantId: string
}) {
  const [templates, setTemplates] = useState<SiteTemplateSummary[] | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [pendingTemplate, setPendingTemplate] = useState<SiteTemplateSummary | null>(null)
  const [applying, setApplying] = useState(false)

  const retry = async () => {
    setCatalogError(null)
    setTemplates(null)
    try {
      setTemplates(await getSiteTemplates(tenantId))
    } catch {
      setCatalogError('Unable to load templates. Please try again.')
    }
  }

  useEffect(() => {
    let cancelled = false
    void getSiteTemplates(tenantId).then((nextTemplates) => {
      if (!cancelled) setTemplates(nextTemplates)
    }).catch(() => {
      if (!cancelled) setCatalogError('Unable to load templates. Please try again.')
    })
    return () => { cancelled = true }
  }, [tenantId])

  const apply = async () => {
    if (!pendingTemplate || applying) return
    const template = pendingTemplate
    setApplying(true)
    setApplyError(null)
    try {
      const definition = await applySiteTemplate(tenantId, template.id)
      setPendingTemplate(null)
      onSaved(definition, `${template.name} applied to the working site. Preview your changes, then Publish Site when ready.`, true)
    } catch {
      setPendingTemplate(null)
      setApplyError('Unable to apply this template. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fg">Templates</h2>
        <p className="mt-1 text-sm leading-6 text-fg-muted">Choose a curated starting point for the working website. Applying a template does not publish it.</p>
      </div>
      {catalogError && <StatusMessage tone="error">{catalogError} <Button className="ml-1 align-middle" onClick={() => void retry()} size="sm" variant="secondary">Retry</Button></StatusMessage>}
      {applyError && <StatusMessage tone="error">{applyError}</StatusMessage>}
      {!templates && !catalogError && <StatusMessage>Loading templates…</StatusMessage>}
      {templates && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <Card className="flex min-w-0 flex-col p-5" key={template.id}>
              <h3 className="text-lg font-semibold text-fg">{template.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-fg-muted">{template.description}</p>
              {template.tags.length > 0 && <ul aria-label={`${template.name} tags`} className="mt-4 flex flex-wrap gap-2">{template.tags.map((tag) => <li className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-fg-muted" key={tag}>{tag}</li>)}</ul>}
              <Button className="mt-5 self-start" disabled={applying} onClick={() => { setApplyError(null); setPendingTemplate(template) }} variant="danger">Apply</Button>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog busy={applying} cancelLabel="Cancel" confirmLabel="Apply Template" description={applyDescription} onCancel={() => { if (!applying) setPendingTemplate(null) }} onConfirm={() => void apply()} open={pendingTemplate !== null} title={`Apply “${pendingTemplate?.name ?? ''}”?`} />
    </div>
  )
}
