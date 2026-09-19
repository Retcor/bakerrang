'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { SITE_PREVIEW_FRAME_ROUTE, isSitePreviewChildMessage, type SitePreviewMode, type SitePreviewParentMessage } from '../../lib/sitePreviewFrameProtocol'

/** Selection callbacks are deliberately reserved for the Phase 4.0b editor wiring. */
export function SitePreviewFrame ({ mode = 'EDITOR', onPageSelected, onSectionSelected, pageId, selectedSectionId, site, thumbnail = false, title = 'Website preview', viewport = 'desktop' }: {
  mode?: SitePreviewMode
  onPageSelected?: (pageId: string) => void
  onSectionSelected?: (sectionId: string) => void
  pageId: string
  selectedSectionId?: string
  site: SiteDefinition
  thumbnail?: boolean
  title?: string
  viewport?: 'desktop' | 'tablet' | 'mobile'
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const readySourceRef = useRef<Window | null>(null)
  const sentRef = useRef<{ site: SiteDefinition, pageId: string, selectedSectionId?: string, mode: SitePreviewMode } | null>(null)
  const currentRef = useRef({ site, pageId, selectedSectionId, mode })
  const send = useCallback((frame: Window, type: SitePreviewParentMessage['type']) => {
    const current = currentRef.current
    frame.postMessage({ type, siteDefinition: current.site, pageId: current.pageId, mode: current.mode, ...(current.mode === 'EDITOR' && current.selectedSectionId ? { selectedSectionId: current.selectedSectionId } : {}) } satisfies SitePreviewParentMessage, window.location.origin)
    sentRef.current = current
  }, [])

  useEffect(() => {
    currentRef.current = { site, pageId, selectedSectionId, mode }
  }, [mode, pageId, selectedSectionId, site])
  useEffect(() => {
    const frame = readySourceRef.current
    if (!frame || (sentRef.current?.site === site && sentRef.current.pageId === pageId && sentRef.current.selectedSectionId === selectedSectionId && sentRef.current.mode === mode)) return
    send(frame, 'UPDATE_SITE')
  }, [mode, pageId, selectedSectionId, send, site])
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || !isSitePreviewChildMessage(event.data)) return
      const frame = frameRef.current?.contentWindow
      if (!frame || event.source !== frame) return
      if (event.data.type === 'READY') {
        if (readySourceRef.current === frame) return
        readySourceRef.current = frame
        send(frame, 'INIT')
        return
      }
      if (mode === 'EDITOR' && event.data.type === 'PAGE_SELECTED') onPageSelected?.(event.data.pageId)
      if (mode === 'EDITOR' && event.data.type === 'SECTION_SELECTED') onSectionSelected?.(event.data.sectionId)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [mode, onPageSelected, onSectionSelected, send])

  return (
    <section aria-label={title} className={`min-w-0 overflow-hidden bg-bg ${thumbnail ? 'h-[750px] w-[1200px]' : ''}`} data-preview-mode={mode} data-preview-viewport={viewport}>
      <div className="min-w-0 overflow-auto" data-site-preview-viewport="">
        <iframe aria-hidden={thumbnail || undefined} className={`mx-auto block border-0 bg-white ${thumbnail ? 'h-[750px] w-[1200px]' : `h-[38rem] lg:h-[calc(100svh-9rem)] ${viewport === 'desktop' ? 'w-full' : viewport === 'tablet' ? 'w-[834px] max-w-full' : 'w-[390px] max-w-full'}`}`} onLoad={() => { sentRef.current = null }} ref={frameRef} src={SITE_PREVIEW_FRAME_ROUTE} tabIndex={thumbnail ? -1 : undefined} title={title} />
      </div>
    </section>
  )
}
