import type { HeroContent } from '@bakerrang/site-schema'
import { SiteContainer } from './SitePrimitives'

export interface HeroProps {
  content: HeroContent
  contactHref?: string
}

export function Hero ({ content, contactHref }: HeroProps) {
  return (
    <section className="flex min-h-[68vh] items-center border-b border-site-border bg-site-surface py-20 sm:py-28" id="top">
      <SiteContainer>
        <div className="max-w-4xl">
          <div className="mb-7 h-1.5 w-20 rounded-full bg-site-accent" />
          <h1 className="text-balance text-5xl font-semibold tracking-[-0.035em] text-site-fg sm:text-7xl">
            {content.title}
          </h1>
          {content.subtitle && (
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-site-muted sm:text-xl">
              {content.subtitle}
            </p>
          )}
          {content.ctaLabel && contactHref && (
            <div className="mt-9">
              <a className="inline-flex min-h-12 items-center rounded-md bg-site-primary px-6 py-3 font-semibold text-site-primary-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-primary" href={contactHref}>{content.ctaLabel}</a>
            </div>
          )}
        </div>
      </SiteContainer>
    </section>
  )
}
