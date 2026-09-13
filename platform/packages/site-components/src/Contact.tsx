import type { ContactContent } from '@bakerrang/site-schema'
import type { ReactNode } from 'react'
import { SiteContainer, SiteSection } from './SitePrimitives'
import { contactHref } from './contactHref'

export { contactHref } from './contactHref'

export interface ContactProps {
  anchorId: string
  content: ContactContent
  leadForm?: ReactNode
}

export function Contact ({ anchorId, content, leadForm }: ContactProps) {
  const title = typeof content?.title === 'string' ? content.title : null
  const text = typeof content?.text === 'string' ? content.text : null
  const buttonLabel = typeof content?.buttonLabel === 'string' ? content.buttonLabel : null
  const href = content?.action?.type === 'leadForm' ? null : contactHref(content?.action)
  const external = href !== null && typeof content?.action === 'object' && content.action?.type === 'url'

  return (
    <SiteSection anchorId={anchorId} className="bg-site-bg" sectionType="contact">
      <SiteContainer>
        <div className="site-radius-panel max-w-4xl border border-site-border border-l-4 border-l-site-accent bg-site-surface p-8 shadow-sm sm:p-12">
          {title && <h2 className="text-balance text-3xl font-semibold tracking-tight text-site-fg sm:text-5xl" data-br-role="section-heading">{title}</h2>}
          {text && <p className="mt-5 max-w-2xl text-lg leading-8 text-site-muted">{text}</p>}
          {href && buttonLabel && (
            <div className="mt-8">
              <a
                className="site-radius-control inline-flex min-h-12 items-center justify-center bg-site-primary px-6 py-3 text-sm font-semibold text-site-primary-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-primary"
                data-br-role="button"
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {buttonLabel}
              </a>
            </div>
          )}
          {content?.action?.type === 'leadForm' && leadForm && <div className="mt-8">{leadForm}</div>}
        </div>
      </SiteContainer>
    </SiteSection>
  )
}
