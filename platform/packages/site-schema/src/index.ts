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

export interface GalleryItem {
  id: string
  mediaId: string
  altText: string
  /** Read-time hydration only. Never persisted in working or published site documents. */
  src?: string
  width?: number
  height?: number
}

export interface GalleryContent {
  title: string
  items: GalleryItem[]
}

export interface GallerySection {
  id: string
  type: 'gallery'
  content: GalleryContent
}

export interface TestimonialItem {
  id: string
  customerName: string
  quote: string
}

export interface TestimonialsContent {
  title: string
  items: TestimonialItem[]
}

export interface TestimonialsSection {
  id: string
  type: 'testimonials'
  content: TestimonialsContent
}

export type SiteSection = HeroSection | ServicesSection | GallerySection | TestimonialsSection | ContactSection

export interface SitePage {
  id: string
  slug: string
  title: string
  sections: SiteSection[]
}

export type SiteStatus = 'DRAFT' | 'PUBLISHED'

export interface SiteBranding {
  siteName: string
  primaryColor: string
  accentColor: string
  logoMediaId?: string
  /** Read-time hydration only. Never persisted in working or published site documents. */
  logoSrc?: string
  logoWidth?: number
  logoHeight?: number
}

export interface PostalAddress {
  line1?: string
  line2?: string
  city: string
  region?: string
  postalCode?: string
  country?: string
}

export interface BusinessProfile {
  description?: string
  phone?: string
  email?: string
  address?: PostalAddress
  serviceAreas?: string[]
  socialImageMediaId?: string
  /** Read-time hydration only. Never persisted in working or published site documents. */
  socialImageSrc?: string
  socialImageWidth?: number
  socialImageHeight?: number
}

export interface SiteDefinition {
  status: SiteStatus
  branding: SiteBranding
  businessProfile?: BusinessProfile
  pages: SitePage[]
}

export const isHeroSection = (section: SiteSection): section is HeroSection =>
  section.id === 'hero' && section.type === 'hero'

export const isServicesSection = (section: SiteSection): section is ServicesSection =>
  section.id === 'services' && section.type === 'services'

export const isContactSection = (section: SiteSection): section is ContactSection =>
  section.id === 'contact' && section.type === 'contact'

export const isGallerySection = (section: SiteSection): section is GallerySection =>
  section.id === 'gallery' && section.type === 'gallery'

export const isTestimonialsSection = (section: SiteSection): section is TestimonialsSection =>
  section.id === 'testimonials' && section.type === 'testimonials'

export const findHomePage = (site: SiteDefinition): SitePage | undefined =>
  site.pages.find((page) => page.slug === '/')
