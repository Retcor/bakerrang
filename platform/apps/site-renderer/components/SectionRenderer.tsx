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
      return <Hero contactHref={heroContactHref} content={section.content} />
    case 'about':
      return <About content={section.content} />
    case 'services':
      return <Services content={section.content} />
    case 'gallery':
      return <Gallery content={section.content} />
    case 'testimonials':
      return <Testimonials content={section.content} />
    case 'faq':
      return <Faq content={section.content} />
    case 'businessHours':
      return <BusinessHours content={section.content} hours={businessHours} />
    case 'contact':
      return (
        <Contact
          content={section.content}
          leadFormHref={`${sitePath}/contact${previewToken ? `?${new URLSearchParams({ token: previewToken }).toString()}` : ''}`}
        />
      )
    default:
      return null
  }
}
