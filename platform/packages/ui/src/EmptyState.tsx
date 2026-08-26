import type { ReactNode } from 'react'

export function EmptyState ({ action, description, title }: { action?: ReactNode, description: ReactNode, title: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-fg-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
