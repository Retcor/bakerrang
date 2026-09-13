import type { ReactNode } from 'react'
import type { SiteDefinition, SitePage } from '@bakerrang/site-schema'
import { resolveSiteTheme } from './theme'
import { SiteHeader, type SiteNavItem } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

export function SiteShell ({ activePage, children, footerNav, homeHref, primaryNav, site }: {
  activePage: SitePage
  children: ReactNode
  site: SiteDefinition
  homeHref: string
  primaryNav: SiteNavItem[]
  footerNav: SiteNavItem[]
}) {
  const style = resolveSiteTheme(site.theme)
  const header = site.header ?? { brandDisplay: 'logo' as const, navigation: { items: [] } }
  const footer = site.footer ?? { showBranding: true, navigationMode: 'header' as const, showBusinessContact: false, showSocialLinks: true, showCopyright: true }
  return (
    // data-br-* attributes are stable public Custom CSS hooks. Do not rename/remove casually.
    <div className="site-shell min-h-screen" data-br-page={activePage.id} data-br-site="" style={style}>
      {site.scopedCustomCss ? <style id="br-custom-css">{site.scopedCustomCss}</style> : null}
      <SiteHeader brandDisplay={header.brandDisplay} branding={site.branding} cta={header.cta} homeHref={homeHref} navItems={primaryNav} />
      {children}
      <SiteFooter branding={site.branding} config={footer} navItems={footerNav} profile={site.businessProfile} />
    </div>
  )
}
