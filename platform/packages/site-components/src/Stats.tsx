import type { StatsContent } from '@bakerrang/site-schema'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'

export function Stats ({ anchorId, content }: { anchorId: string, content: StatsContent }) {
  return <SiteSection anchorId={anchorId} className="bg-site-bg" sectionType="stats"><SiteContainer>
    {(content.heading || content.intro) && <div className="max-w-3xl"><SectionHeading>{content.heading}</SectionHeading>{content.intro && <p className="mt-4 text-lg leading-8 text-site-muted">{content.intro}</p>}</div>}
    <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {content.items.map((item) => <div className="site-radius-panel border border-site-border bg-site-surface p-6" key={item.id}><dt className="text-sm font-medium text-site-muted">{item.label}</dt><dd className="mt-2 text-3xl font-semibold tracking-tight text-site-fg">{item.value}</dd></div>)}
    </dl>
  </SiteContainer></SiteSection>
}
