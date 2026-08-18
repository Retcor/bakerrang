import type { CSSProperties, ReactNode } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { contrastColor } from './branding'
import { SiteHeader, type SiteNavItem } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { siteNavigationPaths } from './sitePath'

const labels: Record<string, string> = { services: 'Services', gallery: 'Gallery', testimonials: 'Testimonials', contact: 'Contact' }

export function SiteShell ({ children, currentPage, site, sitePath }: {
  children: ReactNode
  currentPage: 'home' | 'contact'
  site: SiteDefinition
  sitePath: string
}) {
  const sections = site.pages.find((page) => page.slug === '/')?.sections ?? []
  const { contactPageHref, homeHref, sectionPrefix: prefix } = siteNavigationPaths(sitePath, currentPage)
  const sectionItems = sections.filter((section) => section.type !== 'hero').map((section) => ({
    label: labels[section.type],
    href: section.type === 'contact' && section.content.action.type === 'leadForm'
      ? contactPageHref
      : `${prefix}#${section.id}`
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
