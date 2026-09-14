export type RenderMode = 'PUBLIC' | 'WORKING_PREVIEW' | 'EDITOR' | 'TEMPLATE_PREVIEW'

/**
 * The route shape belongs to the consuming app; the rendering runtime only
 * resolves it into page links.
 */
export type SiteNavigationContext =
  | { kind: 'customDomain' }
  | { kind: 'sharedHost', tenantId: string }
  | { kind: 'preview', tenantId: string, token?: string }

export interface NavigationTarget {
  href: string
  pageId?: string
}

/**
 * The single interaction contract for public rendering and future editor
 * surfaces. PUBLIC callers omit callbacks and retain ordinary browser links.
 */
export interface RenderContext {
  mode: RenderMode
  navigation: SiteNavigationContext
  onSelectSection?: (sectionId: string) => void
  onSelectPage?: (pageId: string) => void
  onNavigate?: (target: NavigationTarget) => void
}
