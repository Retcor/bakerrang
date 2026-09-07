export interface HeroContent {
  title: string
  subtitle?: string
  ctaLabel?: string
}

export interface HeroSection {
  id: string
  type: 'hero'
  hidden: boolean
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
  imagePosition?: 'left' | 'right'
  buttonLabel?: string
  action?: LinkAction
}

export type LinkAction =
  | { type: 'email', value: string }
  | { type: 'phone', value: string }
  | { type: 'url', value: string }

export interface AboutSection {
  id: string
  type: 'about'
  hidden: boolean
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
  hidden: boolean
  content: ServicesContent
}

export type ContactAction =
  | LinkAction
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
  hidden: boolean
  content: ContactContent
}

export interface ProcessStep { id: string, title: string, description?: string }
export interface ProcessContent { heading?: string, intro?: string, items: ProcessStep[] }
export interface ProcessSection { id: string, type: 'process', hidden: boolean, content: ProcessContent }

export interface StatItem { id: string, value: string, label: string }
export interface StatsContent { heading?: string, intro?: string, items: StatItem[] }
export interface StatsSection { id: string, type: 'stats', hidden: boolean, content: StatsContent }

export interface CtaContent { heading: string, body?: string, buttonLabel?: string, action?: LinkAction }
export interface CtaSection { id: string, type: 'cta', hidden: boolean, content: CtaContent }

export interface LogoItem {
  id: string
  mediaId: string
  altText: string
  /** Read-time hydration only. Never persisted in working or published site documents. */
  src?: string
  width?: number
  height?: number
}
export interface LogosContent { heading?: string, items: LogoItem[] }
export interface LogosSection { id: string, type: 'logos', hidden: boolean, content: LogosContent }

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
  hidden: boolean
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
  hidden: boolean
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
  id: string
  type: 'faq'
  hidden: boolean
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
  id: string
  type: 'businessHours'
  hidden: boolean
  content: BusinessHoursContent
}

export type SiteSection = HeroSection | AboutSection | ServicesSection | GallerySection | TestimonialsSection | FaqSection | BusinessHoursSection | ContactSection | ProcessSection | StatsSection | CtaSection | LogosSection
export type SectionType = SiteSection['type']

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
  logoMediaId?: string
  /** Read-time hydration only. Never persisted in working or published site documents. */
  logoSrc?: string
  logoWidth?: number
  logoHeight?: number
  faviconMediaId?: string
  /** Read-time hydration only. Never persisted in working or published site documents. */
  faviconSrc?: string
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
  section.type === 'hero'

export const isAboutSection = (section: SiteSection): section is AboutSection =>
  section.type === 'about'

export const isServicesSection = (section: SiteSection): section is ServicesSection =>
  section.type === 'services'

export const isContactSection = (section: SiteSection): section is ContactSection =>
  section.type === 'contact'

export const isProcessSection = (section: SiteSection): section is ProcessSection => section.type === 'process'
export const isStatsSection = (section: SiteSection): section is StatsSection => section.type === 'stats'
export const isCtaSection = (section: SiteSection): section is CtaSection => section.type === 'cta'
export const isLogosSection = (section: SiteSection): section is LogosSection => section.type === 'logos'

export const isGallerySection = (section: SiteSection): section is GallerySection =>
  section.type === 'gallery'

export const isTestimonialsSection = (section: SiteSection): section is TestimonialsSection =>
  section.type === 'testimonials'

export const isFaqSection = (section: SiteSection): section is FaqSection =>
  section.type === 'faq'

export const isBusinessHoursSection = (section: SiteSection): section is BusinessHoursSection =>
  section.type === 'businessHours'

export const findHomePage = (site: SiteDefinition): SitePage | undefined =>
  site.pages.find((page) => page.id === 'home')

export const findPageById = (site: SiteDefinition, pageId: string): SitePage | undefined =>
  site.pages.find((page) => page.id === pageId)

export const findPageBySlug = (site: SiteDefinition, slug: string): SitePage | undefined =>
  site.pages.find((page) => page.id !== 'home' && page.slug === slug)
