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

export interface AboutContent {
  eyebrow?: string
  heading: string
  body: string
  imageMediaId?: string
  imageAlt?: string
  /** Read-time hydration only. Never persisted in working or published site documents. */
  imageSrc?: string
  imageWidth?: number
  imageHeight?: number
}

export interface AboutSection {
  id: 'about'
  type: 'about'
  content: AboutContent
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

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export interface FaqContent {
  heading: string
  intro?: string
  items: FaqItem[]
}

export interface FaqSection {
  id: 'faq'
  type: 'faq'
  content: FaqContent
}

export type WeekdayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type DayHours =
  | { closed: true }
  | { open: string, close: string }

export interface BusinessHours {
  monday: DayHours
  tuesday: DayHours
  wednesday: DayHours
  thursday: DayHours
  friday: DayHours
  saturday: DayHours
  sunday: DayHours
}

export interface BusinessHoursContent {
  heading?: string
  intro?: string
}

export interface BusinessHoursSection {
  id: 'businessHours'
  type: 'businessHours'
  content: BusinessHoursContent
}

export type SiteSection = HeroSection | AboutSection | ServicesSection | GallerySection | TestimonialsSection | FaqSection | BusinessHoursSection | ContactSection

export interface SitePage {
  id: string
  slug: string
  title: string
  sections: SiteSection[]
}

export type SiteStatus = 'DRAFT' | 'PUBLISHED'

export type SiteFont =
  | 'inter'
  | 'poppins'
  | 'montserrat'
  | 'workSans'
  | 'lora'
  | 'merriweather'
  | 'playfair'
  | 'sourceSerif'

export type CornerStyle = 'rounded' | 'soft' | 'square'
export type ContentWidth = 'narrow' | 'standard' | 'wide'
export type SectionSpacing = 'compact' | 'comfortable' | 'spacious'

export interface SiteThemeColors {
  primary: string
  accent: string
  background: string
  text: string
}

export interface SiteTheme {
  colors: SiteThemeColors
  headingFont: SiteFont
  bodyFont: SiteFont
  cornerStyle: CornerStyle
  contentWidth: ContentWidth
  sectionSpacing: SectionSpacing
}

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

export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'x'

export interface SocialLink {
  platform: SocialPlatform
  url: string
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
  businessHours?: BusinessHours
  socialLinks?: SocialLink[]
}

export interface SiteDefinition {
  status: SiteStatus
  /** Read-time publication signal derived from authoritative working timestamps. */
  hasUnpublishedChanges?: boolean
  /** Authoritative publication timestamp, represented as epoch milliseconds. */
  lastPublishedAt?: number
  branding: SiteBranding
  theme: SiteTheme
  /** Canonical operator-authored CSS. Stored and published without selector rewriting. */
  customCss?: string
  /** Read-time only. Server-validated and scoped for renderer injection; never persisted. */
  scopedCustomCss?: string
  businessProfile?: BusinessProfile
  pages: SitePage[]
}

export const isHeroSection = (section: SiteSection): section is HeroSection =>
  section.id === 'hero' && section.type === 'hero'

export const isAboutSection = (section: SiteSection): section is AboutSection =>
  section.id === 'about' && section.type === 'about'

export const isServicesSection = (section: SiteSection): section is ServicesSection =>
  section.id === 'services' && section.type === 'services'

export const isContactSection = (section: SiteSection): section is ContactSection =>
  section.id === 'contact' && section.type === 'contact'

export const isGallerySection = (section: SiteSection): section is GallerySection =>
  section.id === 'gallery' && section.type === 'gallery'

export const isTestimonialsSection = (section: SiteSection): section is TestimonialsSection =>
  section.id === 'testimonials' && section.type === 'testimonials'

export const isFaqSection = (section: SiteSection): section is FaqSection =>
  section.id === 'faq' && section.type === 'faq'

export const isBusinessHoursSection = (section: SiteSection): section is BusinessHoursSection =>
  section.id === 'businessHours' && section.type === 'businessHours'

export const findHomePage = (site: SiteDefinition): SitePage | undefined =>
  site.pages.find((page) => page.slug === '/')
