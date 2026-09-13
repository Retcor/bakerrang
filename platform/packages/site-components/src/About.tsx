import type { AboutContent } from '@bakerrang/site-schema'
import { aboutParagraphs } from './aboutText'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'
import { contactHref } from './contactHref'

export interface AboutProps {
  anchorId: string
  content: AboutContent
}

const hasResolvedImage = (content: AboutContent): content is AboutContent & {
  imageSrc: string
  imageAlt: string
  imageWidth: number
  imageHeight: number
} => typeof content.imageSrc === 'string' && content.imageSrc.length > 0 &&
  typeof content.imageAlt === 'string' && content.imageAlt.length > 0 &&
  Number.isSafeInteger(content.imageWidth) && Number(content.imageWidth) > 0 &&
  Number.isSafeInteger(content.imageHeight) && Number(content.imageHeight) > 0

export function About ({ anchorId, content }: AboutProps) {
  const paragraphs = aboutParagraphs(content.body)
  const withImage = hasResolvedImage(content)
  const imageRight = content.imagePosition === 'right'
  const href = contactHref(content.action)
  const external = content.action?.type === 'url'
  return (
    <SiteSection anchorId={anchorId} className="bg-site-bg" sectionType="about">
      <SiteContainer>
        <div className={withImage ? `grid items-center gap-10 lg:grid-cols-2 lg:gap-14${imageRight ? ' lg:[&>figure]:order-2' : ''}` : 'max-w-3xl'}>
          {withImage && (
            <figure className="site-radius-panel aspect-[4/3] overflow-hidden bg-site-surface">
              {/* Managed media is resolved server-side, matching Gallery's provider-neutral rendering. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={content.imageAlt} className="h-full w-full object-cover" height={content.imageHeight} loading="lazy" src={content.imageSrc} width={content.imageWidth} />
            </figure>
          )}
          <div>
            <SectionHeading eyebrow={content.eyebrow}>{content.heading}</SectionHeading>
            <div className="mt-6 space-y-4 text-base leading-7 text-site-muted sm:text-lg sm:leading-8">
              {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
            {href && content.buttonLabel && <a className="site-radius-control mt-7 inline-flex min-h-12 items-center bg-site-primary px-6 py-3 font-semibold text-site-primary-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-primary" data-br-role="button" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{content.buttonLabel}</a>}
          </div>
        </div>
      </SiteContainer>
    </SiteSection>
  )
}
