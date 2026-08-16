import type { SiteSection } from '@bakerrang/site-schema'
import { Contact, Gallery, Hero, Services, Testimonials } from '@bakerrang/site-components'

export interface SectionRendererProps {
  section: SiteSection
  tenantId: string
  heroContactHref?: string
}

export function SectionRenderer ({ heroContactHref, section, tenantId }: SectionRendererProps) {
  switch (section.type) {
    case 'hero':
      return <Hero contactHref={heroContactHref} content={section.content} />
    case 'services':
      return <Services content={section.content} />
    case 'gallery':
      return <Gallery content={section.content} />
    case 'testimonials':
      return <Testimonials content={section.content} />
    case 'contact':
      return (
        <Contact
          content={section.content}
          leadFormHref={`/site/${encodeURIComponent(tenantId)}/contact`}
        />
      )
    default:
      return null
  }
}
