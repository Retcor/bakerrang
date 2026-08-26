import type { FaqContent } from '@bakerrang/site-schema'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'

export interface FaqProps {
  content: FaqContent
}

export function Faq ({ content }: FaqProps) {
  const heading = typeof content?.heading === 'string' ? content.heading.trim() : ''
  const intro = typeof content?.intro === 'string' ? content.intro.trim() : ''
  const items = (Array.isArray(content?.items) ? content.items : []).filter((item) =>
    item && typeof item.question === 'string' && item.question.trim() &&
    typeof item.answer === 'string' && item.answer.trim()
  )
  if (!heading || items.length === 0) return null

  return (
    <SiteSection className="bg-site-bg" id="faq">
      <SiteContainer>
        <div className="max-w-4xl">
          <SectionHeading>{heading}</SectionHeading>
          {intro && <p className="mt-5 max-w-3xl text-base leading-7 text-site-muted sm:text-lg sm:leading-8">{intro}</p>}
          <div className="mt-9 space-y-3">
            {items.map((item, index) => (
              <details className="group site-radius-panel border border-site-border bg-site-surface" data-br-role="card" key={`${item.id}-${index}`}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-site-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-accent [&::-webkit-details-marker]:hidden">
                  <span>{item.question.trim()}</span>
                  <svg aria-hidden className="size-5 shrink-0 text-site-accent transition-transform group-open:rotate-180" fill="none" viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
                </summary>
                <p className="whitespace-pre-line border-t border-site-border px-5 py-4 leading-7 text-site-muted">{item.answer.trim()}</p>
              </details>
            ))}
          </div>
        </div>
      </SiteContainer>
    </SiteSection>
  )
}
