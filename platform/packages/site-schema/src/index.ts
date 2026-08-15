export interface HeroContent {
  title: string
  subtitle?: string
  ctaLabel?: string
}

export interface HeroSection {
  id: string
  type: 'hero'
  content: HeroContent
}

export interface ServiceItem {
  id: string
  name: string
  description?: string
}

export interface ServicesContent {
  title: string
  items: ServiceItem[]
}

export interface ServicesSection {
  id: string
  type: 'services'
  content: ServicesContent
}

export type ContactAction =
  | { type: 'email', value: string }
  | { type: 'phone', value: string }
  | { type: 'url', value: string }
  | { type: 'leadForm' }

export interface ContactContent {
  title: string
  text?: string
  buttonLabel: string
  action: ContactAction
}

export interface ContactSection {
  id: string
  type: 'contact'
  content: ContactContent
}

export type SiteSection = HeroSection | ServicesSection | ContactSection

export interface SitePage {
  id: string
  slug: string
  title: string
  sections: SiteSection[]
}

export type SiteStatus = 'DRAFT' | 'PUBLISHED'

export interface SiteDefinition {
  status: SiteStatus
  pages: SitePage[]
}

export const isHeroSection = (section: SiteSection): section is HeroSection =>
  section.id === 'hero' && section.type === 'hero'

export const isServicesSection = (section: SiteSection): section is ServicesSection =>
  section.id === 'services' && section.type === 'services'

export const isContactSection = (section: SiteSection): section is ContactSection =>
  section.id === 'contact' && section.type === 'contact'

export const findHomePage = (site: SiteDefinition): SitePage | undefined =>
  site.pages.find((page) => page.slug === '/')
