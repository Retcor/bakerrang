'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { Badge, Card, ConfirmDialog, StatusMessage } from '@bakerrang/ui'
import { listBusinesses, type Business } from '../../lib/businesses'
import { AppShell, type ContextNav } from '../_shell/AppShell'
import { PageHeader } from '../_shell/PageHeader'
import { BusinessNavigationGuardContext } from './BusinessNavigationGuard'

export function BusinessWorkspace ({ children, description, tenantId, title }: { children: ReactNode, description: string, tenantId: string, title: string }) {
  const router = useRouter()
  const [business, setBusiness] = useState<Business | null>(null)
  const [failed, setFailed] = useState(false)
  const [websiteDirty, setWebsiteDirty] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const reportDirty = useCallback((dirty: boolean) => setWebsiteDirty(dirty), [])
  const requestNavigation = useCallback((href: string) => {
    if (!websiteDirty) return true
    setPendingHref(href)
    return false
  }, [websiteDirty])
  const followLink = (event: MouseEvent<HTMLAnchorElement>, href: string) => { if (!requestNavigation(href)) event.preventDefault() }
  useEffect(() => {
    let cancelled = false
    void listBusinesses().then((items) => { if (!cancelled) setBusiness(items.find((item) => item.id === tenantId) ?? null) }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [tenantId])
  const base = `/businesses/${encodeURIComponent(tenantId)}`
  const nav: ContextNav[] = [
    { href: base, label: 'Overview' },
    { href: `${base}/website`, label: 'Website' },
    { href: `${base}/leads`, label: 'Leads' },
    { href: `${base}/domain`, label: 'Domain' }
  ]
  return (
    <BusinessNavigationGuardContext.Provider value={reportDirty}>
      <AppShell contextNav={nav} onNavigateRequest={requestNavigation}>
        <Link className="mb-5 inline-flex min-h-10 items-center text-sm font-semibold text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" href="/" onClick={(event) => followLink(event, '/')}>← All businesses</Link>
        <PageHeader description={description} eyebrow={business?.name ?? 'Business workspace'} title={title} actions={business && <Badge tone={business.status === 'ACTIVE' ? 'success' : 'neutral'}>{business.status}</Badge>} />
        {failed && <StatusMessage tone="error">Business context could not be loaded. Workspace tools are still available.</StatusMessage>}
        {children}
        <ConfirmDialog cancelLabel="Keep editing" confirmLabel="Discard changes" description="Your current website editor changes haven't been saved." onCancel={() => setPendingHref(null)} onConfirm={() => { const href = pendingHref; setPendingHref(null); setWebsiteDirty(false); if (href) router.push(href) }} open={pendingHref !== null} title="Discard unsaved changes?" />
      </AppShell>
    </BusinessNavigationGuardContext.Provider>
  )
}

export function BusinessOverview ({ tenantId }: { tenantId: string }) {
  const base = `/businesses/${encodeURIComponent(tenantId)}`
  const areas = [
    { href: `${base}/website`, title: 'Website', description: 'Edit site content and control publishing.', action: 'Manage website →' },
    { href: `${base}/leads`, title: 'Leads', description: 'Review enquiries, update status, and add notes.', action: 'Review leads →' },
    { href: `${base}/domain`, title: 'Custom domain', description: 'Configure ownership, HTTPS, and routing.', action: 'Manage domain →' }
  ]
  return <div className="grid gap-4 md:grid-cols-3">{areas.map((area) => <Link className="group rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={area.href} key={area.href}><Card className="h-full p-5 transition-colors group-hover:border-border-strong"><h2 className="font-semibold text-fg">{area.title}</h2><p className="mt-2 text-sm leading-6 text-fg-muted">{area.description}</p><span className="mt-5 inline-block text-sm font-semibold text-info-fg">{area.action}</span></Card></Link>)}</div>
}
