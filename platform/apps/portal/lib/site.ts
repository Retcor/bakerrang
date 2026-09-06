import type { BusinessHours, SectionType, SiteDefinition, SiteTheme, SocialLink } from '@bakerrang/site-schema'
import type { PostalAddress } from '@bakerrang/site-schema'
import { apiGet, apiSend } from './api'

export interface HeroInput {
  title: string
  subtitle?: string
}

export interface ServiceItemInput {
  id?: string
  name: string
  description?: string
}

export interface ServicesInput {
  title: string
  items: ServiceItemInput[]
}

export interface AboutInput {
  eyebrow?: string
  heading: string
  body: string
  imageMediaId?: string
  imageAlt?: string
  imagePosition?: 'left' | 'right'
  buttonLabel?: string
  action?: LinkActionInput
}

export type LinkActionInput =
  | { type: 'email', value: string }
  | { type: 'phone', value: string }
  | { type: 'url', value: string }

export type ContactActionInput =
  | LinkActionInput
  | { type: 'leadForm' }

export interface ContactInput {
  title: string
  text?: string
  buttonLabel: string
  action: ContactActionInput
}

export interface GalleryItemInput {
  id?: string
  mediaId: string
  altText: string
}

export interface GalleryInput {
  title: string
  items: GalleryItemInput[]
}

export interface TestimonialItemInput {
  id?: string
  customerName: string
  quote: string
}

export interface TestimonialsInput {
  title: string
  items: TestimonialItemInput[]
}

export interface FaqItemInput {
  id?: string
  question: string
  answer: string
}

export interface FaqInput {
  heading: string
  intro?: string
  items: FaqItemInput[]
}

export interface ProcessInput { heading?: string, intro?: string, items: Array<{ id?: string, title: string, description?: string }> }
export interface StatsInput { heading?: string, intro?: string, items: Array<{ id?: string, value: string, label: string }> }
export interface CtaInput { heading: string, body?: string, buttonLabel?: string, action?: LinkActionInput }
export interface LogosInput { heading?: string, items: Array<{ id?: string, mediaId: string, altText: string }> }

export interface BrandingInput {
  siteName: string
  logoMediaId?: string
  faviconMediaId?: string
}

export interface BusinessProfileInput {
  description?: string
  phone?: string
  email?: string
  address?: Partial<PostalAddress>
  serviceAreas?: string[]
  socialImageMediaId?: string
}

export interface BusinessHoursUpdateInput {
  businessHours: BusinessHours | null
  homepage: {
    enabled: boolean
    heading?: string
    intro?: string
  }
}

export interface SocialLinksUpdateInput {
  socialLinks: SocialLink[] | null
}

export interface CustomCssUpdateInput {
  customCss: string | null
}

export interface SitePreviewToken {
  token: string
  expiresAt: number
}

export type SiteDomainStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'ACTIVE' | 'DISABLED'

export interface SiteDomain {
  hostname: string
  tenantId: string
  status: SiteDomainStatus
  verificationToken: string
  createdAt: number
  createdByUserId: string
  updatedAt: number
  verifiedAt?: number
  verifiedByUserId?: string
  activatedAt?: number
  activatedByUserId?: string
  disabledAt?: number
  disabledByUserId?: string
}

export const initializeSite = (tenantId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site`)

export const getSite = (tenantId: string) =>
  apiGet<SiteDefinition>(`/tenants/${encodeURIComponent(tenantId)}/site`)

export const createSitePreviewToken = (tenantId: string) =>
  apiSend<SitePreviewToken>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/preview-token`)

export const getSiteDomain = (tenantId: string) =>
  apiGet<SiteDomain | null>(`/tenants/${encodeURIComponent(tenantId)}/site/domain`)

export const registerSiteDomain = (tenantId: string, hostname: string) =>
  apiSend<SiteDomain>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/domain`, { hostname })

export const verifySiteDomain = (tenantId: string) =>
  apiSend<SiteDomain>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/domain/verify`)

export const activateSiteDomain = (tenantId: string) =>
  apiSend<SiteDomain>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/domain/activate`)

export const disableSiteDomain = (tenantId: string) =>
  apiSend<SiteDomain>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/domain/disable`)

export const removeSiteDomain = (tenantId: string) =>
  apiSend<{ removed: true }>('DELETE', `/tenants/${encodeURIComponent(tenantId)}/site/domain`)

export const updateSiteBranding = (tenantId: string, input: BrandingInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/branding`, input)

export const updateSiteTheme = (tenantId: string, input: SiteTheme) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/theme`, input)

export const updateBusinessProfile = (tenantId: string, input: BusinessProfileInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/profile`, input)

export const updateBusinessHours = (tenantId: string, input: BusinessHoursUpdateInput, sectionId?: string) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/business-hours`, {
    ...input,
    ...(sectionId ? { sectionId } : {})
  })

export const updateSocialLinks = (tenantId: string, input: SocialLinksUpdateInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/social-links`, input)

export const updateCustomCss = (tenantId: string, input: CustomCssUpdateInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/custom-css`, input)

export const publishSite = (tenantId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/publish`)

export const unpublishSite = (tenantId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/unpublish`)

const sectionPath = (tenantId: string, sectionId: string) =>
  `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/${encodeURIComponent(sectionId)}`

const saveSectionContent = async <T>(tenantId: string, sectionId: string | undefined, type: SectionType, input: T) => {
  if (!sectionId) throw new Error(`Missing ${type} section id`)
  return apiSend<SiteDefinition>('PUT', sectionPath(tenantId, sectionId), input)
}

export const updateHomeHero = (tenantId: string, sectionId: string, input: HeroInput) =>
  saveSectionContent(tenantId, sectionId, 'hero', input)

export const upsertHomeServices = (tenantId: string, sectionId: string | undefined, input: ServicesInput) =>
  saveSectionContent(tenantId, sectionId, 'services', input)

export const upsertHomeAbout = (tenantId: string, sectionId: string | undefined, input: AboutInput) =>
  saveSectionContent(tenantId, sectionId, 'about', input)

export const upsertHomeContact = (tenantId: string, sectionId: string | undefined, input: ContactInput) =>
  saveSectionContent(tenantId, sectionId, 'contact', input)

export const upsertHomeGallery = (tenantId: string, sectionId: string | undefined, input: GalleryInput) =>
  saveSectionContent(tenantId, sectionId, 'gallery', input)

export const upsertHomeTestimonials = (tenantId: string, sectionId: string | undefined, input: TestimonialsInput) =>
  saveSectionContent(tenantId, sectionId, 'testimonials', input)

export const upsertHomeFaq = (tenantId: string, sectionId: string | undefined, input: FaqInput) =>
  saveSectionContent(tenantId, sectionId, 'faq', input)

export const upsertHomeProcess = (tenantId: string, sectionId: string, input: ProcessInput) => saveSectionContent(tenantId, sectionId, 'process', input)
export const upsertHomeStats = (tenantId: string, sectionId: string, input: StatsInput) => saveSectionContent(tenantId, sectionId, 'stats', input)
export const upsertHomeCta = (tenantId: string, sectionId: string, input: CtaInput) => saveSectionContent(tenantId, sectionId, 'cta', input)
export const upsertHomeLogos = (tenantId: string, sectionId: string, input: LogosInput) => saveSectionContent(tenantId, sectionId, 'logos', input)

export const removeSection = (tenantId: string, sectionId: string) =>
  apiSend<SiteDefinition>('DELETE', sectionPath(tenantId, sectionId))

export const moveSection = (tenantId: string, sectionId: string, direction: 'up' | 'down') =>
  apiSend<SiteDefinition>('POST', `${sectionPath(tenantId, sectionId)}/move`, { direction })

export const addSection = (tenantId: string, type: SectionType, afterSectionId?: string) =>
  apiSend<{ site: SiteDefinition, sectionId: string }>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections`, { type, ...(afterSectionId ? { afterSectionId } : {}) })

export const duplicateSection = (tenantId: string, sectionId: string) =>
  apiSend<{ site: SiteDefinition, sectionId: string }>('POST', `${sectionPath(tenantId, sectionId)}/duplicate`)

export const setSectionVisibility = (tenantId: string, sectionId: string, hidden: boolean) =>
  apiSend<SiteDefinition>('PATCH', `${sectionPath(tenantId, sectionId)}/visibility`, { hidden })

export const updateSectionContent = <T>(tenantId: string, sectionId: string, input: T) =>
  apiSend<SiteDefinition>('PUT', sectionPath(tenantId, sectionId), input)
