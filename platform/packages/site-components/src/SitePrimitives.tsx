import type { ReactNode } from 'react'

export function SiteContainer ({ children, className = '' }: { children: ReactNode, className?: string }) {
  return <div className={`site-container mx-auto w-full px-5 sm:px-8 ${className}`}>{children}</div>
}

export function SiteSection ({ anchorId, children, className = '', sectionType }: { anchorId: string, children: ReactNode, sectionType: string, className?: string }) {
  return <section className={`site-section scroll-mt-24 border-b border-site-border ${className}`} data-br-section={sectionType} data-br-section-id={anchorId} id={`section-${anchorId}`}>{children}</section>
}

export function SectionHeading ({ children, eyebrow }: { children: ReactNode, eyebrow?: string }) {
  return (
    <div className="max-w-3xl">
      {eyebrow && <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-site-accent">{eyebrow}</p>}
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-site-fg sm:text-4xl" data-br-role="section-heading">{children}</h2>
    </div>
  )
}
