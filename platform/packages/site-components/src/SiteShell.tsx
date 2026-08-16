import type { CSSProperties, ReactNode } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { contrastColor } from './branding'
import { SiteHeader, type SiteNavItem } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

const labels: Record<string, string> = { services: 'Services', gallery: 'Gallery', testimonials: 'Testimonials', contact: 'Contact' }

export function SiteShell ({ children, currentPage, site, tenantId }: {
  children: ReactNode
  currentPage: 'home' | 'contact'
  site: SiteDefinition
  tenantId: string
}) {
  const sections = site.pages.find((page) => page.slug === '/')?.sections ?? []
  const prefix = currentPage === 'home' ? '' : `/site/${encodeURIComponent(tenantId)}`
  const homeHref = `/site/${encodeURIComponent(tenantId)}`
  const sectionItems = sections.filter((section) => section.type !== 'hero').map((section) => ({
    label: labels[section.type], href: `${prefix}#${section.id}`
  })).filter((item): item is SiteNavItem => Boolean(item.label))
  const contact = sectionItems.find((item) => item.label === 'Contact')
  const primaryNav: SiteNavItem[] = sectionItems.filter((item) => item.label !== 'Contact')
  const footerNav = [...primaryNav, ...(contact ? [contact] : [])]
  const style = {
    '--site-primary': site.branding.primaryColor,
    '--site-primary-fg': contrastColor(site.branding.primaryColor),
    '--site-accent': site.branding.accentColor,
    '--site-accent-fg': contrastColor(site.branding.accentColor)
  } as CSSProperties
  return (
    <div className="site-shell min-h-screen" style={style}>
      <SiteHeader branding={site.branding} contactHref={contact?.href} homeHref={homeHref} navItems={primaryNav} />
      {children}
      <SiteFooter navItems={footerNav} siteName={site.branding.siteName} />
    </div>
  )
}
