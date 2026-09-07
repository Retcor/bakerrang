import type { ReactNode } from 'react'
import type { SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { resolveSiteTheme } from './theme'
import { SiteHeader, type SiteNavItem } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { siteNavigationPaths } from './sitePath'

const labels: Record<string, string> = { about: 'About', services: 'Services', gallery: 'Gallery', process: 'Steps', stats: 'Highlights', testimonials: 'Testimonials', faq: 'FAQ', cta: 'Call to Action', logos: 'Logos', businessHours: 'Hours', contact: 'Contact' }

export function SiteShell ({ activePage, children, site, sitePath }: {
  activePage: SitePage
  children: ReactNode
  site: SiteDefinition
  sitePath: string
}) {
  const sections = activePage.sections
  const { homeHref, sectionPrefix: prefix } = siteNavigationPaths(sitePath)
  const sectionItems = sections.filter((section) => !section.hidden && section.type !== 'hero').map((section) => ({
    label: labels[section.type],
    href: `${prefix}#section-${section.id}`
  })).filter((item): item is SiteNavItem => Boolean(item.label))
  const contact = sectionItems.find((item) => item.label === 'Contact')
  const primaryNav: SiteNavItem[] = sectionItems.filter((item) => item.label !== 'Contact')
  const footerNav = [...primaryNav, ...(contact ? [contact] : [])]
  const style = resolveSiteTheme(site.theme)
  return (
    // data-br-* attributes are stable public Custom CSS hooks. Do not rename/remove casually.
    <div className="site-shell min-h-screen" data-br-page={activePage.id} data-br-site="" style={style}>
      {site.scopedCustomCss ? <style id="br-custom-css">{site.scopedCustomCss}</style> : null}
      <SiteHeader branding={site.branding} contactHref={contact?.href} homeHref={homeHref} navItems={primaryNav} />
      {children}
      <SiteFooter navItems={footerNav} siteName={site.branding.siteName} socialLinks={site.businessProfile?.socialLinks} />
    </div>
  )
}
