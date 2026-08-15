import type { SiteSection } from '@bakerrang/site-schema'
import { Contact, Hero, Services } from '@bakerrang/site-components'

export interface SectionRendererProps {
  section: SiteSection
  tenantId: string
}

export function SectionRenderer ({ section, tenantId }: SectionRendererProps) {
  switch (section.type) {
    case 'hero':
      return <Hero content={section.content} />
    case 'services':
      return <Services content={section.content} />
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
