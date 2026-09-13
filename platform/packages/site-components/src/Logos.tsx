import type { LogosContent } from '@bakerrang/site-schema'
import { SectionHeading, SiteContainer, SiteSection } from './SitePrimitives'

export function Logos ({ anchorId, content }: { anchorId: string, content: LogosContent }) {
  if (content.items.length === 0) return null
  return <SiteSection anchorId={anchorId} className="bg-site-bg" sectionType="logos"><SiteContainer>
    {content.heading && <SectionHeading>{content.heading}</SectionHeading>}
    <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{content.items.map((item) => item.src && item.width && item.height && <li className="site-radius-panel flex items-center justify-center border border-site-border bg-site-surface p-5" key={item.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={item.altText} className="max-h-16 w-auto max-w-full object-contain" data-br-role="logo" height={item.height} loading="lazy" src={item.src} width={item.width} />
    </li>)}</ul>
  </SiteContainer></SiteSection>
}
