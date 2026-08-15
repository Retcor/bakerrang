import type { HeroContent } from '@bakerrang/site-schema'
import { Button, Container } from '@bakerrang/ui'

export interface HeroProps {
  content: HeroContent
}

export function Hero ({ content }: HeroProps) {
  return (
    <section className="flex min-h-[70vh] items-center border-b border-border bg-bg py-20 sm:py-28">
      <Container>
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-fg-muted">
            A clear starting point
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-fg sm:text-6xl">
            {content.title}
          </h1>
          {content.subtitle && (
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-fg-muted sm:text-xl">
              {content.subtitle}
            </p>
          )}
          {content.ctaLabel && (
            <div className="mt-9">
              <Button>{content.ctaLabel}</Button>
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}
