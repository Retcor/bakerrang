'use client'

import { useEffect, useState } from 'react'
import { LeadForm, SitePageRenderer, type RenderContext } from '@bakerrang/site-runtime'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { isSitePreviewParentMessage, type SitePreviewChildMessage, type SitePreviewMode } from '../../lib/sitePreviewFrameProtocol'

const parentOrigin = () => window.location.origin

export function SitePreviewFrameHost () {
  const [preview, setPreview] = useState<{ site: SiteDefinition, pageId: string, selectedSectionId?: string, mode: SitePreviewMode } | null>(null)

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== parentOrigin() || !isSitePreviewParentMessage(event.data)) return
      const mode = event.data.mode ?? 'EDITOR'
      setPreview({ site: event.data.siteDefinition, pageId: event.data.pageId, mode, ...(mode === 'EDITOR' ? { selectedSectionId: event.data.selectedSectionId } : {}) })
    }
    window.addEventListener('message', receive)
    // The parent waits for this signal, so it cannot race this listener.
    window.parent.postMessage({ type: 'READY' }, parentOrigin())
    return () => window.removeEventListener('message', receive)
  }, [])

  useEffect(() => {
    const keepLinksInsideFrame = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a')) return
      event.preventDefault()
    }
    document.addEventListener('click', keepLinksInsideFrame, true)
    return () => document.removeEventListener('click', keepLinksInsideFrame, true)
  }, [])

  if (!preview) return <main aria-label="Website preview" data-site-preview-frame-host="" />
  const page = preview.site.pages.find((candidate) => candidate.id === preview.pageId)
  if (!page) return <main aria-label="Website preview" data-site-preview-frame-host="" />
  const notify = (message: SitePreviewChildMessage) => window.parent.postMessage(message, parentOrigin())
  const editor = preview.mode === 'EDITOR'
  const context: RenderContext = {
    mode: preview.mode,
    navigation: { kind: 'customDomain' },
    ...(editor ? { selectedSectionId: preview.selectedSectionId } : {}),
    ...(editor ? { onSelectPage: (pageId: string) => notify({ type: 'PAGE_SELECTED', pageId }) } : {}),
    onNavigate: () => undefined,
    ...(editor ? { onSelectSection: (sectionId: string) => notify({ type: 'SECTION_SELECTED', sectionId }) } : {})
  }
  return <main aria-label="Website preview" data-site-preview-frame-host=""><SitePageRenderer context={context} leadForm={<LeadForm context={context} onSubmit={async () => {}} />} page={page} site={preview.site} /></main>
}
