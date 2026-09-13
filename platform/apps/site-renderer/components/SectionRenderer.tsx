import type { BusinessHours as BusinessHoursValue, SiteSection } from '@bakerrang/site-schema'
import type { ReactNode } from 'react'
import { About, BusinessHours, Contact, Cta, Faq, Gallery, Hero, Logos, Process, Services, Stats, Testimonials } from '@bakerrang/site-components'

export interface SectionRendererProps {
  section: SiteSection
  heroContactHref?: string
  leadForm?: ReactNode
  businessHours?: BusinessHoursValue
}

export function SectionRenderer ({ businessHours, heroContactHref, leadForm, section }: SectionRendererProps) {
  switch (section.type) {
    case 'hero':
      return <Hero anchorId={section.id} contactHref={heroContactHref} content={section.content} />
    case 'about':
      return <About anchorId={section.id} content={section.content} />
    case 'process': return <Process anchorId={section.id} content={section.content} />
    case 'stats': return <Stats anchorId={section.id} content={section.content} />
    case 'cta': return <Cta anchorId={section.id} content={section.content} />
    case 'logos': return <Logos anchorId={section.id} content={section.content} />
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
          leadForm={leadForm}
        />
      )
    default:
      return null
  }
}
