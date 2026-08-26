import Link from 'next/link'
import { Badge, EmptyState } from '@bakerrang/ui'
import type { Business } from '../../lib/businesses'

export interface BusinessListProps {
  businesses: Business[]
}

const createdDate = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium'
}).format(new Date(timestamp))

export function BusinessList ({ businesses }: BusinessListProps) {
  if (businesses.length === 0) {
    return (
      <EmptyState description="Use the create form to add your first business and start building its website." title="No businesses yet" />
    )
  }

  return (
    <ul className="grid gap-3">
      {businesses.map((business) => (
        <li key={business.id}>
          <Link className="group flex min-h-24 flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:flex-row sm:items-center sm:justify-between" href={`/businesses/${encodeURIComponent(business.id)}`}>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-fg group-hover:text-info-fg">{business.name}</h2>
              <p className="mt-1 text-sm text-fg-muted">Created {createdDate(business.createdAt)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={business.status === 'ACTIVE' ? 'success' : 'neutral'}>{business.status}</Badge>
              <span aria-hidden className="text-fg-subtle">→</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
