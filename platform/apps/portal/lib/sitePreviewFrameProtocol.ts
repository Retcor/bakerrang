import type { SiteDefinition } from '@bakerrang/site-schema'

export const SITE_PREVIEW_FRAME_ROUTE = '/site-preview-frame'

export type SitePreviewParentMessage = {
  type: 'INIT' | 'UPDATE_SITE'
  siteDefinition: SiteDefinition
  pageId: string
}

export type SitePreviewChildMessage =
  | { type: 'READY' }
  | { type: 'SECTION_SELECTED', sectionId: string }
  | { type: 'PAGE_SELECTED', pageId: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** Message validation deliberately accepts only render-ready site data. */
export const isSitePreviewParentMessage = (value: unknown): value is SitePreviewParentMessage => {
  if (!isRecord(value) || (value.type !== 'INIT' && value.type !== 'UPDATE_SITE') || typeof value.pageId !== 'string' || !isRecord(value.siteDefinition)) return false
  const pages = value.siteDefinition.pages
  return Array.isArray(pages) && pages.some((page) => isRecord(page) && page.id === value.pageId)
}

export const isSitePreviewChildMessage = (value: unknown): value is SitePreviewChildMessage =>
  isRecord(value) && (value.type === 'READY' || (value.type === 'SECTION_SELECTED' && typeof value.sectionId === 'string') || (value.type === 'PAGE_SELECTED' && typeof value.pageId === 'string'))
