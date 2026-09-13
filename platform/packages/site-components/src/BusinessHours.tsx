import type { BusinessHours as BusinessHoursValue, BusinessHoursContent, DayHours } from '@bakerrang/site-schema'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'
import { formatBusinessTime, WEEKDAYS } from './businessHoursFormat'

const formatDay = (day: DayHours) => 'closed' in day
  ? 'Closed'
  : `${formatBusinessTime(day.open)} – ${formatBusinessTime(day.close)}`

export interface BusinessHoursProps {
  anchorId: string
  content: BusinessHoursContent
  hours?: BusinessHoursValue
}

export function BusinessHours ({ anchorId, content, hours }: BusinessHoursProps) {
  if (!hours) return null
  const heading = typeof content?.heading === 'string' && content.heading.trim()
    ? content.heading.trim()
    : 'Business Hours'
  const intro = typeof content?.intro === 'string' ? content.intro.trim() : ''
  return (
    <SiteSection anchorId={anchorId} className="bg-site-bg" sectionType="businessHours">
      <SiteContainer>
        <div className="max-w-3xl">
          <SectionHeading>{heading}</SectionHeading>
          {intro && <p className="mt-5 text-base leading-7 text-site-muted sm:text-lg sm:leading-8">{intro}</p>}
          <dl className="site-radius-panel mt-9 overflow-hidden border border-site-border bg-site-surface">
            {WEEKDAYS.map(({ key, label }) => (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-site-border px-4 py-3 last:border-b-0 sm:px-6" key={key}>
                <dt className="font-semibold text-site-fg">{label}</dt>
                <dd className="text-right text-site-muted">{formatDay(hours[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </SiteContainer>
    </SiteSection>
  )
}
