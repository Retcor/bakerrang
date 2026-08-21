import type { ReactNode } from 'react'

export function PageHeader ({ actions, description, eyebrow, title }: { actions?: ReactNode, description?: ReactNode, eyebrow?: ReactNode, title: ReactNode }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}
