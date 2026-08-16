import type { TestimonialsContent } from '@bakerrang/site-schema'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'

export interface TestimonialsProps {
  content: TestimonialsContent
}

export function Testimonials ({ content }: TestimonialsProps) {
  const title = typeof content?.title === 'string' ? content.title.trim() : ''
  const items = (Array.isArray(content?.items) ? content.items : []).filter((item) =>
    item &&
    typeof item.customerName === 'string' &&
    item.customerName.trim() &&
    typeof item.quote === 'string' &&
    item.quote.trim()
  )
  if (!title || items.length === 0) return null

  return (
    <SiteSection className="bg-site-bg" id="testimonials">
      <SiteContainer>
        <SectionHeading>{title}</SectionHeading>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <figure className="flex h-full flex-col rounded-xl border border-site-border bg-site-surface p-7 shadow-sm" key={`${item.id}-${index}`}>
              <span aria-hidden="true" className="text-4xl leading-none text-site-accent">“</span>
              <blockquote className="mt-3 flex-1 text-lg leading-8 text-site-fg">{item.quote.trim()}</blockquote>
              <figcaption className="mt-6 border-t border-site-border pt-4 text-sm font-semibold text-site-muted">{item.customerName.trim()}</figcaption>
            </figure>
          ))}
        </div>
      </SiteContainer>
    </SiteSection>
  )
}
