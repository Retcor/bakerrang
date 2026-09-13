import type { CtaContent } from '@bakerrang/site-schema'
import { contactHref } from './contactHref'
import { SiteContainer, SiteSection } from './SitePrimitives'

export function Cta ({ anchorId, content }: { anchorId: string, content: CtaContent }) {
  const href = contactHref(content.action)
  const external = content.action?.type === 'url'
  return <SiteSection anchorId={anchorId} className="bg-site-bg" sectionType="cta"><SiteContainer>
    <div className="site-radius-panel border border-site-border bg-site-surface p-8 shadow-sm sm:p-12"><h2 className="text-balance text-3xl font-semibold tracking-tight text-site-fg sm:text-5xl" data-br-role="section-heading">{content.heading}</h2>
      {content.body && <p className="mt-5 max-w-2xl text-lg leading-8 text-site-muted">{content.body}</p>}
      {href && content.buttonLabel && <a className="site-radius-control mt-8 inline-flex min-h-12 items-center bg-site-primary px-6 py-3 font-semibold text-site-primary-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-primary" data-br-role="cta-button" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{content.buttonLabel}</a>}
    </div>
  </SiteContainer></SiteSection>
}
