import type { ReactNode } from 'react'

export function SiteContainer ({ children, className = '' }: { children: ReactNode, className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</div>
}

export function SiteSection ({ children, id, className = '' }: { children: ReactNode, id: string, className?: string }) {
  return <section className={`scroll-mt-24 border-b border-site-border py-16 sm:py-24 ${className}`} id={id}>{children}</section>
}

export function SectionHeading ({ children, eyebrow }: { children: ReactNode, eyebrow?: string }) {
  return (
    <div className="max-w-3xl">
      {eyebrow && <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-site-accent">{eyebrow}</p>}
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-site-fg sm:text-4xl">{children}</h2>
    </div>
  )
}
