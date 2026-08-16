import type { ContactContent } from '@bakerrang/site-schema'
import { SiteContainer, SiteSection } from './SitePrimitives'
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
    <SiteSection className="bg-site-bg" id="contact">
      <SiteContainer>
        <div className="max-w-4xl rounded-2xl border border-site-border border-l-4 border-l-site-accent bg-site-surface p-8 shadow-sm sm:p-12">
          {title && <h2 className="text-balance text-3xl font-semibold tracking-tight text-site-fg sm:text-5xl">{title}</h2>}
          {text && <p className="mt-5 max-w-2xl text-lg leading-8 text-site-muted">{text}</p>}
          {href && buttonLabel && (
            <div className="mt-8">
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-site-primary px-6 py-3 text-sm font-semibold text-site-primary-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-primary"
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {buttonLabel}
              </a>
            </div>
          )}
        </div>
      </SiteContainer>
    </SiteSection>
  )
}
