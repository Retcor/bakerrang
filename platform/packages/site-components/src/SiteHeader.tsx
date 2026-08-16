'use client'

import { useState } from 'react'
import type { SiteBranding } from '@bakerrang/site-schema'
import { SiteContainer } from './SitePrimitives'

export interface SiteNavItem { label: string, href: string }

export function SiteHeader ({ branding, contactHref, homeHref, navItems }: {
  branding: Pick<SiteBranding, 'siteName' | 'logoSrc' | 'logoWidth' | 'logoHeight'>
  navItems: SiteNavItem[]
  contactHref?: string
  homeHref: string
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <header className="sticky top-0 z-40 border-b border-site-border bg-site-surface/95 backdrop-blur">
      <SiteContainer className="flex min-h-20 items-center justify-between gap-6">
        <a aria-label={`${branding.siteName} home`} className="flex min-w-0 items-center gap-3 font-semibold text-site-fg" href={homeHref} onClick={close}>
          {branding.logoSrc && branding.logoWidth && branding.logoHeight && (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={branding.siteName} className="max-h-12 max-w-44 object-contain" height={branding.logoHeight} src={branding.logoSrc} width={branding.logoWidth} />
          )}
          {!branding.logoSrc && <span className="truncate text-lg">{branding.siteName}</span>}
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => <a className="text-sm font-medium text-site-muted hover:text-site-fg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-site-accent" href={item.href} key={item.href}>{item.label}</a>)}
          {contactHref && <a className="rounded-md bg-site-primary px-4 py-2.5 text-sm font-semibold text-site-primary-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-primary" href={contactHref}>Contact</a>}
        </nav>
        <button aria-controls="tenant-mobile-navigation" aria-expanded={open} aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} className="min-h-11 rounded-md border border-site-border px-4 text-sm font-semibold text-site-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-accent md:hidden" onClick={() => setOpen((value) => !value)} type="button">{open ? 'Close' : 'Menu'}</button>
      </SiteContainer>
      {open && (
        <nav aria-label="Mobile primary" className="border-t border-site-border bg-site-surface md:hidden" id="tenant-mobile-navigation">
          <SiteContainer className="flex flex-col py-4">
            {navItems.map((item) => <a className="rounded px-2 py-3 font-medium text-site-fg focus-visible:outline-2 focus-visible:outline-site-accent" href={item.href} key={item.href} onClick={close}>{item.label}</a>)}
            {contactHref && <a className="mt-2 rounded-md bg-site-primary px-4 py-3 text-center font-semibold text-site-primary-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-primary" href={contactHref} onClick={close}>Contact</a>}
          </SiteContainer>
        </nav>
      )}
    </header>
  )
}
