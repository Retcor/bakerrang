import type { Business } from '../../lib/businesses'
import { BusinessWebsite } from './BusinessWebsite'
import { BusinessLeads } from './BusinessLeads'

export interface BusinessListProps {
  businesses: Business[]
}

const createdDate = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium'
}).format(new Date(timestamp))

export function BusinessList ({ businesses }: BusinessListProps) {
  if (businesses.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-6">
        <h3 className="font-semibold text-fg">No businesses yet.</h3>
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          Create your first business to get started.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
      {businesses.map((business) => (
        <li className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" key={business.id}>
          <div>
            <h3 className="font-semibold text-fg">{business.name}</h3>
            <p className="mt-1 text-sm text-fg-muted">
              Created {createdDate(business.createdAt)}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="w-fit rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-fg-muted">
              {business.status}
            </span>
            <BusinessWebsite tenantId={business.id} />
            <BusinessLeads tenantId={business.id} />
          </div>
        </li>
      ))}
    </ul>
  )
}
