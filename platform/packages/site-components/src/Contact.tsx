import type { ContactContent } from '@bakerrang/site-schema'
import { Container } from '@bakerrang/ui'
import { contactHref } from './contactHref'

export { contactHref } from './contactHref'

export interface ContactProps {
  content: ContactContent
  leadFormHref?: string
}

export function Contact ({ content, leadFormHref }: ContactProps) {
  const title = typeof content?.title === 'string' ? content.title : null
  const text = typeof content?.text === 'string' ? content.text : null
  const buttonLabel = typeof content?.buttonLabel === 'string' ? content.buttonLabel : null
  const href = content?.action?.type === 'leadForm' ? leadFormHref ?? null : contactHref(content?.action)
  const external = href !== null && typeof content?.action === 'object' && content.action?.type === 'url'

  return (
    <section className="border-b border-border bg-bg py-16 sm:py-24">
      <Container>
        <div className="max-w-3xl">
          {title && <h2 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h2>}
          {text && <p className="mt-5 max-w-2xl text-lg leading-8 text-fg-muted">{text}</p>}
          {href && buttonLabel && (
            <div className="mt-8">
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {buttonLabel}
              </a>
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}
