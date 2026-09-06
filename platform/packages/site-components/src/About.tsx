import type { AboutContent } from '@bakerrang/site-schema'
import { aboutParagraphs } from './aboutText'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'

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
  return (
    <SiteSection anchorId={anchorId} className="bg-site-bg" sectionType="about">
      <SiteContainer>
        <div className={withImage ? 'grid items-center gap-10 lg:grid-cols-2 lg:gap-14' : 'max-w-3xl'}>
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
          </div>
        </div>
      </SiteContainer>
    </SiteSection>
  )
}
