import type { GalleryContent, GalleryItem } from '@bakerrang/site-schema'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'

export interface GalleryProps {
  content: GalleryContent
}

const isResolved = (item: GalleryItem): item is GalleryItem & {
  src: string
  width: number
  height: number
} => typeof item.src === 'string' && item.src.length > 0 &&
  Number.isSafeInteger(item.width) && Number(item.width) > 0 &&
  Number.isSafeInteger(item.height) && Number(item.height) > 0

export function Gallery ({ content }: GalleryProps) {
  const items = Array.isArray(content?.items) ? content.items.filter(isResolved) : []
  if (items.length === 0) return null

  return (
    <SiteSection className="bg-site-bg" id="gallery">
      <SiteContainer>
        <SectionHeading>{content.title}</SectionHeading>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <figure className="aspect-[4/3] overflow-hidden rounded-xl bg-site-bg" key={item.id}>
              {/* The managed source is resolved server-side and intentionally rendered without Next image optimization. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={item.altText}
                className="h-full w-full object-cover"
                height={item.height}
                loading="lazy"
                src={item.src}
                width={item.width}
              />
            </figure>
          ))}
        </div>
      </SiteContainer>
    </SiteSection>
  )
}
