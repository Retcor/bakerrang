'use client'

import { useEffect, useRef, useState } from 'react'
import type { LinkAction, SiteBranding } from '@bakerrang/site-schema'
import { contactHref } from './contactHref'
import { SiteContainer } from './SitePrimitives'

export interface SiteNavItem { pageId: string, label: string, href: string, current: boolean }

export function SiteHeader ({ branding, brandDisplay, cta, homeHref, navItems }: {
  branding: Pick<SiteBranding, 'siteName' | 'logoSrc' | 'logoWidth' | 'logoHeight'>
  brandDisplay: 'logo' | 'logoAndName' | 'name'
  cta?: { buttonLabel: string, action: LinkAction }
  homeHref: string
  navItems: SiteNavItem[]
}) {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const close = () => setOpen(false)
  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])
  const ctaHref = cta ? contactHref(cta.action) : null
  const isExternalCta = cta?.action.type === 'url'
  const hasLogo = Boolean(branding.logoSrc && branding.logoWidth && branding.logoHeight)
  const showLogo = brandDisplay !== 'name' && hasLogo
  const showName = brandDisplay !== 'logo' || !hasLogo
  return (
    <header className="sticky top-0 z-40 border-b border-site-border bg-site-surface/95 backdrop-blur" data-br-role="header">
      <SiteContainer className="flex min-h-20 items-center justify-between gap-6">
        <a aria-label={`${branding.siteName} home`} className="flex min-w-0 items-center gap-3 font-semibold text-site-fg" href={homeHref} onClick={close}>
          {showLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={branding.siteName} className="max-h-12 max-w-44 object-contain" height={branding.logoHeight} src={branding.logoSrc} width={branding.logoWidth} />
          )}
          {showName && <span className="truncate text-lg">{branding.siteName}</span>}
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex" data-br-navigation="" data-br-role="nav">
          {navItems.map((item) => <a aria-current={item.current ? 'page' : undefined} className="text-sm font-medium text-site-muted hover:text-site-fg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-site-accent" data-br-navigation-item={item.pageId} href={item.href} key={item.pageId}>{item.label}</a>)}
          {ctaHref && <a className="site-radius-control bg-site-primary px-4 py-2.5 text-sm font-semibold text-site-primary-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-primary" data-br-role="button" href={ctaHref} rel={isExternalCta ? 'noopener noreferrer' : undefined} target={isExternalCta ? '_blank' : undefined}>{cta?.buttonLabel}</a>}
        </nav>
        <button aria-controls="tenant-mobile-navigation" aria-expanded={open} aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} className="site-radius-control min-h-11 border border-site-border px-4 text-sm font-semibold text-site-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-accent md:hidden" data-br-role="button" onClick={() => setOpen((value) => !value)} ref={toggleRef} type="button">{open ? 'Close' : 'Menu'}</button>
      </SiteContainer>
      {open && (
        <nav aria-label="Mobile primary" className="border-t border-site-border bg-site-surface md:hidden" data-br-navigation="" data-br-role="nav" id="tenant-mobile-navigation">
          <SiteContainer className="flex flex-col py-4">
            {navItems.map((item) => <a aria-current={item.current ? 'page' : undefined} className="rounded px-2 py-3 font-medium text-site-fg focus-visible:outline-2 focus-visible:outline-site-accent" data-br-navigation-item={item.pageId} href={item.href} key={item.pageId} onClick={close}>{item.label}</a>)}
            {ctaHref && <a className="site-radius-control mt-2 bg-site-primary px-4 py-3 text-center font-semibold text-site-primary-fg focus-visible:outline-2 focus-visible:outline-site-primary" data-br-role="button" href={ctaHref} onClick={close} rel={isExternalCta ? 'noopener noreferrer' : undefined} target={isExternalCta ? '_blank' : undefined}>{cta?.buttonLabel}</a>}
          </SiteContainer>
        </nav>
      )}
    </header>
  )
}
