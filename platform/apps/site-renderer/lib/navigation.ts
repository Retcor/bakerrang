import type { NavigationItem, SiteDefinition, SitePage } from '@bakerrang/site-schema'

export type SiteNavigationContext =
  | { kind: 'customDomain' }
  | { kind: 'sharedHost', tenantId: string }
  | { kind: 'preview', tenantId: string, token?: string }

export interface ResolvedNavigationItem {
  pageId: string
  label: string
  href: string
  current: boolean
}

const pageHref = (page: SitePage, context: SiteNavigationContext) => {
  if (context.kind === 'customDomain') return page.id === 'home' ? '/' : `/${page.slug}`
  if (context.kind === 'sharedHost') {
    const root = `/site/${encodeURIComponent(context.tenantId)}`
    return page.id === 'home' ? root : `${root}/${page.slug}`
  }
  const root = `/preview/${encodeURIComponent(context.tenantId)}`
  const path = page.id === 'home' ? root : `${root}/page/${encodeURIComponent(page.id)}`
  return context.token ? `${path}?token=${encodeURIComponent(context.token)}` : path
}

export const resolveNavigationItems = (site: SiteDefinition, items: NavigationItem[], activePage: SitePage, context: SiteNavigationContext): ResolvedNavigationItem[] => {
  const pagesById = new Map(site.pages.map((page) => [page.id, page]))
  return items.flatMap((item) => {
    const page = pagesById.get(item.pageId)
    if (!page) return []
    const label = item.label?.trim() || page.title
    return [{ pageId: page.id, label, href: pageHref(page, context), current: page.id === activePage.id }]
  })
}

export const resolveSiteNavigation = (site: SiteDefinition, activePage: SitePage, context: SiteNavigationContext) => {
  const headerItems = resolveNavigationItems(site, site.header?.navigation?.items ?? [], activePage, context)
  const footerItems = site.footer?.navigationMode === 'custom'
    ? resolveNavigationItems(site, site.footer.navigationItems ?? [], activePage, context)
    : site.footer?.navigationMode === 'none' ? [] : headerItems
  return { homeHref: pageHref(site.pages.find((page) => page.id === 'home') ?? activePage, context), headerItems, footerItems }
}
