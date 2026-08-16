import { SiteContainer } from './SitePrimitives'
import type { SiteNavItem } from './SiteHeader'

export function SiteFooter ({ siteName, navItems }: { siteName: string, navItems: SiteNavItem[] }) {
  return (
    <footer className="border-t-4 border-site-accent bg-site-footer py-12 text-site-footer-fg">
      <SiteContainer className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{siteName}</p>
          <p className="mt-1 text-sm opacity-75">© {new Date().getFullYear()} {siteName}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3">
          {navItems.map((item) => <a className="text-sm opacity-85 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-site-accent" href={item.href} key={item.href}>{item.label}</a>)}
        </nav>
      </SiteContainer>
    </footer>
  )
}
