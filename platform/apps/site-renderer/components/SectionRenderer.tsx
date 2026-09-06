import type { BusinessHours as BusinessHoursValue, SiteSection } from '@bakerrang/site-schema'
import { About, BusinessHours, Contact, Faq, Gallery, Hero, Services, Testimonials } from '@bakerrang/site-components'

export interface SectionRendererProps {
  section: SiteSection
  sitePath: string
  heroContactHref?: string
  previewToken?: string
  businessHours?: BusinessHoursValue
}

export function SectionRenderer ({ businessHours, heroContactHref, previewToken, section, sitePath }: SectionRendererProps) {
  switch (section.type) {
    case 'hero':
      return <Hero anchorId={section.id} contactHref={heroContactHref} content={section.content} />
    case 'about':
      return <About anchorId={section.id} content={section.content} />
    case 'services':
      return <Services anchorId={section.id} content={section.content} />
    case 'gallery':
      return <Gallery anchorId={section.id} content={section.content} />
    case 'testimonials':
      return <Testimonials anchorId={section.id} content={section.content} />
    case 'faq':
      return <Faq anchorId={section.id} content={section.content} />
    case 'businessHours':
      return <BusinessHours anchorId={section.id} content={section.content} hours={businessHours} />
    case 'contact':
      return (
        <Contact
          anchorId={section.id}
          content={section.content}
          leadFormHref={`${sitePath}/contact${previewToken ? `?${new URLSearchParams({ token: previewToken }).toString()}` : ''}`}
        />
      )
    default:
      return null
  }
}
