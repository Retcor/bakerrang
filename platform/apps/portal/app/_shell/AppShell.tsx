'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Card, StatusMessage } from '@bakerrang/ui'
import { loginUrl } from '../../lib/auth'
import { useAuth } from '../providers/AuthProvider'
import { Brand } from './Brand'

export interface ContextNav {
  href: string
  label: string
}

function MenuIcon () {
  return <svg aria-hidden className="size-5" fill="none" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
}

function BuildingIcon () {
  return <svg aria-hidden className="size-5" fill="none" viewBox="0 0 24 24"><path d="M5 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 21h18M9 7h4M9 11h4M9 15h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
}

function NavContent ({ contextNav, onNavigate, pathname }: { contextNav?: ContextNav[], onNavigate?: () => void, pathname: string }) {
  const topActive = pathname === '/'
  return (
    <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-1">
        <Link aria-current={topActive ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${topActive ? 'bg-brand text-brand-ink' : 'text-sidebar-muted hover:bg-sidebar-deep hover:text-sidebar-fg'}`} href="/" onClick={onNavigate}>
          <BuildingIcon /> Businesses
        </Link>
      </div>
      {contextNav && contextNav.length > 0 && (
        <div className="mt-7 border-t border-sidebar-border pt-6">
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.14em] text-sidebar-muted">Business workspace</p>
          <div className="space-y-1">
            {contextNav.map((item) => {
              const active = pathname === item.href
              return <Link aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active ? 'bg-brand text-brand-ink' : 'text-sidebar-muted hover:bg-sidebar-deep hover:text-sidebar-fg'}`} href={item.href} key={item.href} onClick={onNavigate}>{item.label}</Link>
            })}
          </div>
        </div>
      )}
    </nav>
  )
}

export function AppShell ({ children, contextNav }: { children: ReactNode, contextNav?: ContextNav[] }) {
  const { signOut, status, user } = useAuth()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const previousPathnameRef = useRef(pathname)

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return
    previousPathnameRef.current = pathname
    // The pathname is external router state; closing the drawer is intentional synchronization.
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const menuButton = menuButtonRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
      if (event.key !== 'Tab' || !drawerRef.current) return
      const items = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('a, button:not([disabled])'))
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      document.body.style.overflow = previousOverflow
      menuButton?.focus()
    }
  }, [drawerOpen])

  const handleSignOut = async () => {
    setSigningOut(true); setSignOutError(null)
    try { await signOut() } catch { setSignOutError('Unable to sign out. Please try again.') } finally { setSigningOut(false) }
  }

  if (status === 'loading') {
    return <main className="grid min-h-screen place-items-center bg-bg p-5"><StatusMessage>Checking your sign-in status…</StatusMessage></main>
  }
  if (status === 'anonymous' || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg p-5">
        <Card className="w-full max-w-md p-7 text-center sm:p-9">
          <div className="flex justify-center"><Brand surface="light" /></div>
          <p className="mt-6 text-base font-medium tracking-tight text-fg-muted sm:text-lg">Always Visible, Always Relevant</p>
          <Button className="mt-8 w-full" onClick={() => window.location.assign(loginUrl())} size="lg" variant="secondary">
            <Image alt="" aria-hidden height={20} src="/google-g.svg" width={20} />
            Sign in with Google
          </Button>
        </Card>
      </main>
    )
  }

  const account = (
    <div className="border-t border-sidebar-border pt-4">
      <p className="truncate text-sm font-semibold text-sidebar-fg">{user.displayName}</p>
      <p className="mt-1 truncate text-xs text-sidebar-muted">{user.email}</p>
      <Button className="mt-3 w-full !border-sidebar-border !bg-transparent !text-sidebar-fg hover:!bg-sidebar-deep hover:!text-sidebar-fg focus-visible:!outline-brand" disabled={signingOut} onClick={() => void handleSignOut()} size="sm" variant="ghost">{signingOut ? 'Signing out…' : 'Sign out'}</Button>
      {signOutError && <p className="mt-2 text-xs text-sidebar-fg" role="alert">{signOutError}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 flex-col bg-sidebar p-5 lg:flex">
        <Link className="mb-8 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus" href="/"><Brand /></Link>
        <NavContent contextNav={contextNav} pathname={pathname} />
        {account}
      </aside>
      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur lg:hidden">
          <button aria-controls="mobile-navigation" aria-expanded={drawerOpen} aria-label="Open navigation" className="grid size-11 place-items-center rounded-md text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => setDrawerOpen(true)} ref={menuButtonRef} type="button"><MenuIcon /></button>
          <Link aria-label="BakerRang businesses" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/"><Brand compact /></Link>
          <span aria-hidden className="size-11" />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-7 sm:py-9 lg:px-10">{children}</main>
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-sidebar-deep/65" onClick={() => setDrawerOpen(false)} type="button" />
          <div aria-label="Navigation menu" aria-modal="true" className="relative flex h-full w-[min(20rem,88vw)] flex-col bg-sidebar p-5 shadow-md" id="mobile-navigation" ref={drawerRef} role="dialog">
            <div className="mb-8 flex items-center justify-between gap-4">
              <Brand />
              <button aria-label="Close navigation" className="grid size-11 place-items-center rounded-md text-sidebar-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={() => setDrawerOpen(false)} type="button">×</button>
            </div>
            <NavContent contextNav={contextNav} onNavigate={() => setDrawerOpen(false)} pathname={pathname} />
            {account}
          </div>
        </div>
      )}
    </div>
  )
}
