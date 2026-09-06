import { findHomePage, type SectionType, type SiteDefinition, type SiteSection } from '@bakerrang/site-schema'

export type SectionEditorKey = Exclude<SectionType, 'businessHours'> | 'businessHoursSection'

export interface SectionDefinition {
  label: string
  description: string
  editor: SectionEditorKey
  singleton: boolean
  duplicable: boolean
  summary: (section: SiteSection, site: SiteDefinition) => string
}

const fallback = (value: string | undefined, text: string) => value?.trim() || text
const countText = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`

export const sectionDefinitions: Record<SectionType, SectionDefinition> = {
  hero: {
    label: 'Hero', description: 'Shape the first message visitors see on the homepage.', editor: 'hero', singleton: true, duplicable: false,
    summary: (section) => fallback(section.type === 'hero' ? section.content.title : undefined, 'Headline & call to action')
  },
  about: {
    label: 'About', description: 'Tell visitors about the business.', editor: 'about', singleton: false, duplicable: true,
    summary: (section) => fallback(section.type === 'about' ? section.content.heading : undefined, 'About section')
  },
  services: {
    label: 'Services', description: 'Present the services the business offers.', editor: 'services', singleton: false, duplicable: true,
    summary: (section) => section.type === 'services' ? (section.content.items.length ? countText(section.content.items.length, 'service') : 'No services yet') : 'No services yet'
  },
  gallery: {
    label: 'Gallery', description: 'Choose and arrange homepage gallery images.', editor: 'gallery', singleton: false, duplicable: true,
    summary: (section) => section.type === 'gallery' ? (section.content.items.length ? countText(section.content.items.length, 'image') : 'No images yet') : 'No images yet'
  },
  testimonials: {
    label: 'Testimonials', description: 'Show customer quotes on the homepage.', editor: 'testimonials', singleton: false, duplicable: true,
    summary: (section) => section.type === 'testimonials' ? (section.content.items.length ? countText(section.content.items.length, 'testimonial') : 'No testimonials yet') : 'No testimonials yet'
  },
  faq: {
    label: 'FAQ', description: 'Answer common questions on the homepage.', editor: 'faq', singleton: false, duplicable: true,
    summary: (section) => section.type === 'faq' ? (section.content.items.length ? countText(section.content.items.length, 'question') : 'No questions yet') : 'No questions yet'
  },
  businessHours: {
    label: 'Business Hours', description: 'Present the business schedule on the homepage.', editor: 'businessHoursSection', singleton: true, duplicable: false,
    summary: (_section, site) => {
      const hours = site.businessProfile?.businessHours
      if (!hours) return 'Weekly business hours'
      const openDays = Object.values(hours).filter((day) => !('closed' in day && day.closed)).length
      return openDays ? `${countText(openDays, 'open day')}` : 'No open days configured'
    }
  },
  contact: {
    label: 'Contact', description: 'Configure the homepage contact call to action.', editor: 'contact', singleton: true, duplicable: false,
    summary: (section) => {
      if (section.type !== 'contact') return 'Configure a contact action'
      const action = section.content.action
      return action.type === 'leadForm' ? 'Lead form' : action.type === 'email' ? 'Email contact' : action.type === 'phone' ? 'Phone contact' : 'Link button'
    }
  }
}

export const sectionTypes = Object.keys(sectionDefinitions) as SectionType[]

export function homeSections (site: SiteDefinition) {
  return findHomePage(site)?.sections ?? []
}

export function sectionLabel (section: SiteSection) {
  return sectionDefinitions[section.type].label
}

export function sectionSummary (section: SiteSection, site: SiteDefinition) {
  return sectionDefinitions[section.type].summary(section, site)
}
