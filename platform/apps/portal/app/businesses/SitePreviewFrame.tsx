'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { SITE_PREVIEW_FRAME_ROUTE, isSitePreviewChildMessage, type SitePreviewParentMessage } from '../../lib/sitePreviewFrameProtocol'

/** Selection callbacks are deliberately reserved for the Phase 4.0b editor wiring. */
export function SitePreviewFrame ({ onPageSelected, onSectionSelected, pageId, site, viewport = 'desktop' }: {
  onPageSelected?: (pageId: string) => void
  onSectionSelected?: (sectionId: string) => void
  pageId: string
  site: SiteDefinition
  viewport?: 'desktop' | 'tablet' | 'mobile'
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const readySourceRef = useRef<Window | null>(null)
  const sentRef = useRef<{ site: SiteDefinition, pageId: string } | null>(null)
  const currentRef = useRef({ site, pageId })
  const send = useCallback((frame: Window, type: SitePreviewParentMessage['type']) => {
    const current = currentRef.current
    frame.postMessage({ type, siteDefinition: current.site, pageId: current.pageId } satisfies SitePreviewParentMessage, window.location.origin)
    sentRef.current = current
  }, [])

  useEffect(() => {
    currentRef.current = { site, pageId }
  }, [pageId, site])
  useEffect(() => {
    const frame = readySourceRef.current
    if (!frame || (sentRef.current?.site === site && sentRef.current.pageId === pageId)) return
    send(frame, 'UPDATE_SITE')
  }, [pageId, send, site])
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
      if (event.data.type === 'PAGE_SELECTED') onPageSelected?.(event.data.pageId)
      if (event.data.type === 'SECTION_SELECTED') onSectionSelected?.(event.data.sectionId)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [onPageSelected, onSectionSelected, send])

  return (
    <section aria-label="Website preview" className="min-w-0 overflow-hidden bg-bg" data-preview-viewport={viewport}>
      <div className="min-w-0 overflow-auto" data-site-preview-viewport="">
        <iframe className={`mx-auto block h-[38rem] border-0 bg-white ${viewport === 'desktop' ? 'w-full' : viewport === 'tablet' ? 'w-[834px] max-w-full' : 'w-[390px] max-w-full'}`} onLoad={() => { readySourceRef.current = null; sentRef.current = null }} ref={frameRef} src={SITE_PREVIEW_FRAME_ROUTE} title="Website preview" />
      </div>
    </section>
  )
}
