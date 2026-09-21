'use client'

import type { ReactNode } from 'react'
import type { WebsiteLauncherId } from './websiteEditors'

export type SiteToolIconId = WebsiteLauncherId | 'siteTools'

export function ChevronRightIcon ({ className = 'size-4' }: { className?: string }) {
  return <svg aria-hidden className={className} data-testid="site-tool-chevron" fill="none" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
}

export function SiteToolIcon ({ className = 'size-4', type }: { className?: string, type: SiteToolIconId }) {
  const common = { className, 'data-site-tool-icon': type, fill: 'none', viewBox: '0 0 24 24' } as const
  if (type === 'siteTools' || type === 'templates') return <svg aria-hidden {...common}><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.7" width="7" x="3" y="3" /><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.7" width="7" x="14" y="3" /><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.7" width="7" x="3" y="14" /><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.7" width="7" x="14" y="14" /></svg>
  if (type === 'branding') return <svg aria-hidden {...common}><path d="M5 7h8M5 12h5M5 17h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /><circle cx="17" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.7" /></svg>
  if (type === 'theme') return <svg aria-hidden {...common}><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" /><path d="M12 3.5v17M3.5 12h17" stroke="currentColor" strokeWidth="1.7" /></svg>
  if (type === 'header') return <svg aria-hidden {...common}><rect height="16" rx="2" stroke="currentColor" strokeWidth="1.7" width="18" x="3" y="4" /><path d="M3 9h18" stroke="currentColor" strokeWidth="1.7" /></svg>
  if (type === 'footer') return <svg aria-hidden {...common}><rect height="16" rx="2" stroke="currentColor" strokeWidth="1.7" width="18" x="3" y="4" /><path d="M3 15h18" stroke="currentColor" strokeWidth="1.7" /></svg>
  if (type === 'seo') return <svg aria-hidden {...common}><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" /><path d="m20 20-4.9-4.9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>
  if (type === 'revisions') return <svg aria-hidden {...common}><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" /><path d="M12 7v5l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
  if (type === 'moreSettings') return <svg aria-hidden {...common}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
  return <svg aria-hidden {...common}><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>
}

export function SiteToolMenuRow ({ icon, label, onClick, subtitle, tileClassName = 'bg-surface-muted text-fg-muted' }: {
  icon: SiteToolIconId
  label: string
  onClick: () => void
  subtitle?: ReactNode
  tileClassName?: string
}) {
  return <button className="flex min-h-[3.125rem] w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus" onClick={onClick} type="button">
    <span className={`grid size-[2.125rem] shrink-0 place-items-center rounded-[0.5625rem] ${tileClassName}`}><SiteToolIcon type={icon} /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-fg">{label}</span>{subtitle && <span className="mt-0.5 block text-xs leading-4 text-fg-subtle">{subtitle}</span>}</span>
    <ChevronRightIcon className="size-4 shrink-0 text-fg-subtle" />
  </button>
}
