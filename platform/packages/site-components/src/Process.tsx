import type { ProcessContent } from '@bakerrang/site-schema'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'

export function Process ({ anchorId, content }: { anchorId: string, content: ProcessContent }) {
  return <SiteSection anchorId={anchorId} className="bg-site-bg" sectionType="process"><SiteContainer>
    {(content.heading || content.intro) && <div className="max-w-3xl"><SectionHeading>{content.heading}</SectionHeading>{content.intro && <p className="mt-4 text-lg leading-8 text-site-muted">{content.intro}</p>}</div>}
    <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {content.items.map((item, index) => <li className="site-radius-panel border border-site-border bg-site-surface p-6" data-br-role="step" key={item.id}>
        <p className="text-sm font-semibold text-site-accent">Step {index + 1}</p><h3 className="mt-2 text-xl font-semibold text-site-fg">{item.title}</h3>{item.description && <p className="mt-3 leading-7 text-site-muted">{item.description}</p>}
      </li>)}
    </ol>
  </SiteContainer></SiteSection>
}
