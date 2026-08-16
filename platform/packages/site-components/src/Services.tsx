import type { ServicesContent } from '@bakerrang/site-schema'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'

export interface ServicesProps {
  content: ServicesContent
}

export function Services ({ content }: ServicesProps) {
  if (content.items.length === 0) return null

  return (
    <SiteSection className="bg-site-bg" id="services">
      <SiteContainer>
        <SectionHeading>{content.title}</SectionHeading>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {content.items.map((item) => (
            <article className="rounded-xl border border-site-border bg-site-surface p-7 shadow-sm" key={item.id}>
              <h3 className="text-xl font-semibold text-site-fg">{item.name}</h3>
              {item.description && (
                <p className="mt-3 leading-7 text-site-muted">{item.description}</p>
              )}
            </article>
          ))}
        </div>
      </SiteContainer>
    </SiteSection>
  )
}
