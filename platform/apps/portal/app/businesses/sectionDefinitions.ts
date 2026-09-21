import { type SectionType, type SiteDefinition, type SiteSection } from '@bakerrang/site-schema'

export interface SectionDefinition {
  label: string
  description: string
  group: 'Core' | 'Content' | 'Media' | 'Trust' | 'Conversion' | 'Business'
  homeOnly?: boolean
  singleton: boolean
  duplicable: boolean
  summary: (section: SiteSection, site: SiteDefinition) => string
}

const fallback = (value: string | undefined, text: string) => value?.trim() || text
const countText = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`

export const sectionDefinitions: Record<SectionType, SectionDefinition> = {
  hero: {
    label: 'Hero', description: 'Shape the first message visitors see on the homepage.', group: 'Core', homeOnly: true, singleton: true, duplicable: false,
    summary: (section) => fallback(section.type === 'hero' ? section.content.title : undefined, 'Headline & call to action')
  },
  about: {
    label: 'About', description: 'Tell visitors about the business.', group: 'Content', singleton: false, duplicable: true,
    summary: (section) => fallback(section.type === 'about' ? section.content.heading : undefined, 'About section')
  },
  services: {
    label: 'Services', description: 'Present the services the business offers.', group: 'Content', singleton: false, duplicable: true,
    summary: (section) => section.type === 'services' ? (section.content.items.length ? countText(section.content.items.length, 'service') : 'No services yet') : 'No services yet'
  },
  gallery: {
    label: 'Gallery', description: 'Choose and arrange gallery images for this page.', group: 'Media', singleton: false, duplicable: true,
    summary: (section) => section.type === 'gallery' ? (section.content.items.length ? countText(section.content.items.length, 'image') : 'No images yet') : 'No images yet'
  },
  testimonials: {
    label: 'Testimonials', description: 'Show customer quotes on this page.', group: 'Trust', singleton: false, duplicable: true,
    summary: (section) => section.type === 'testimonials' ? (section.content.items.length ? countText(section.content.items.length, 'testimonial') : 'No testimonials yet') : 'No testimonials yet'
  },
  faq: {
    label: 'FAQ', description: 'Answer common questions on this page.', group: 'Trust', singleton: false, duplicable: true,
    summary: (section) => section.type === 'faq' ? (section.content.items.length ? countText(section.content.items.length, 'question') : 'No questions yet') : 'No questions yet'
  },
  businessHours: {
    label: 'Business Hours', description: 'Present the global business schedule on this page.', group: 'Business', singleton: true, duplicable: false,
    summary: (_section, site) => {
      const hours = site.businessProfile?.businessHours
      if (!hours) return 'Weekly business hours'
      const openDays = Object.values(hours).filter((day) => !('closed' in day && day.closed)).length
      return openDays ? `${countText(openDays, 'open day')}` : 'No open days configured'
    }
  },
  contact: {
    label: 'Contact', description: 'Configure this page’s contact call to action.', group: 'Conversion', singleton: true, duplicable: false,
    summary: (section) => {
      if (section.type !== 'contact') return 'Configure a contact action'
      const action = section.content.action
      return action.type === 'leadForm' ? 'Lead form' : action.type === 'email' ? 'Email contact' : action.type === 'phone' ? 'Phone contact' : 'Link button'
    }
  },
  process: { label: 'Steps', description: 'Show a simple process visitors can follow.', group: 'Content', singleton: false, duplicable: true, summary: (section) => section.type === 'process' && section.content.items.length ? countText(section.content.items.length, 'step') : 'Steps' },
  stats: { label: 'Highlights', description: 'Present concise business highlights.', group: 'Trust', singleton: false, duplicable: true, summary: (section) => section.type === 'stats' && section.content.items.length ? countText(section.content.items.length, 'highlight') : 'Highlights' },
  cta: { label: 'Call to Action', description: 'Invite visitors to take the next step.', group: 'Conversion', singleton: false, duplicable: true, summary: (section) => section.type === 'cta' ? fallback(section.content.heading, 'Call to action') : 'Call to action' },
  logos: { label: 'Logos', description: 'Display trusted organizations or partners.', group: 'Media', singleton: false, duplicable: true, summary: (section) => section.type === 'logos' && section.content.items.length ? countText(section.content.items.length, 'logo') : 'No logos yet' }
}

export const sectionTypes = Object.keys(sectionDefinitions) as SectionType[]

export interface AddableSectionType {
  definition: SectionDefinition
  disabled: boolean
  reason?: 'Already added' | 'Set a weekly schedule in Site setup first'
  type: SectionType
}

/**
 * Returns the section choices that the current page can truthfully add. This is
 * shared by the existing dialog and the builder rail so their eligibility rules
 * cannot drift apart.
 */
export function addableSectionTypes (site: SiteDefinition, pageId: string): AddableSectionType[] {
  const sections = site.pages.find((page) => page.id === pageId)?.sections ?? []
  return sectionTypes
    .filter((type) => type !== 'hero')
    .filter((type) => !(sectionDefinitions[type].homeOnly && pageId !== 'home'))
    .map((type) => {
      const definition = sectionDefinitions[type]
      const alreadyAdded = definition.singleton && sections.some((section) => section.type === type)
      const missingSchedule = type === 'businessHours' && !site.businessProfile?.businessHours
      const reason = alreadyAdded
        ? 'Already added'
        : missingSchedule
          ? 'Set a weekly schedule in Site setup first'
          : undefined
      return { definition, disabled: Boolean(reason), reason, type }
    })
}

export function sectionLabel (section: SiteSection) {
  return sectionDefinitions[section.type].label
}

export function sectionSummary (section: SiteSection, site: SiteDefinition) {
  return sectionDefinitions[section.type].summary(section, site)
}
