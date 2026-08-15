import type { ServicesContent } from '@bakerrang/site-schema'
import { Container } from '@bakerrang/ui'

export interface ServicesProps {
  content: ServicesContent
}

export function Services ({ content }: ServicesProps) {
  if (content.items.length === 0) return null

  return (
    <section className="border-b border-border bg-surface py-16 sm:py-24">
      <Container>
        <h2 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          {content.title}
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {content.items.map((item) => (
            <article className="rounded-md border border-border bg-bg p-6" key={item.id}>
              <h3 className="text-lg font-semibold text-fg">{item.name}</h3>
              {item.description && (
                <p className="mt-3 leading-7 text-fg-muted">{item.description}</p>
              )}
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}
