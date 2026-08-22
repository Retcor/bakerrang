import type { BusinessHours, SiteDefinition, SiteTheme } from '@bakerrang/site-schema'
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
}

export type ContactActionInput =
  | { type: 'email', value: string }
  | { type: 'phone', value: string }
  | { type: 'url', value: string }
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

export interface CompositionInput {
  sectionIds: string[]
}

export interface BrandingInput {
  siteName: string
  logoMediaId?: string
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

export const updateBusinessHours = (tenantId: string, input: BusinessHoursUpdateInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/business-hours`, input)

export const publishSite = (tenantId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/publish`)

export const unpublishSite = (tenantId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/unpublish`)

export const updateHomeHero = (tenantId: string, input: HeroInput) =>
  apiSend<SiteDefinition>(
    'PATCH',
    `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/hero`,
    input
  )

export const upsertHomeServices = (tenantId: string, input: ServicesInput) =>
  apiSend<SiteDefinition>(
    'PUT',
    `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/services`,
    input
  )

export const upsertHomeAbout = (tenantId: string, input: AboutInput) =>
  apiSend<SiteDefinition>(
    'PUT',
    `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/about`,
    input
  )

export const upsertHomeContact = (tenantId: string, input: ContactInput) =>
  apiSend<SiteDefinition>(
    'PUT',
    `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/contact`,
    input
  )

export const upsertHomeGallery = (tenantId: string, input: GalleryInput) =>
  apiSend<SiteDefinition>(
    'PUT',
    `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/gallery`,
    input
  )

export const upsertHomeTestimonials = (tenantId: string, input: TestimonialsInput) =>
  apiSend<SiteDefinition>(
    'PUT',
    `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/testimonials`,
    input
  )

export const upsertHomeFaq = (tenantId: string, input: FaqInput) =>
  apiSend<SiteDefinition>(
    'PUT',
    `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/faq`,
    input
  )

export const composeHomeSections = (tenantId: string, input: CompositionInput) =>
  apiSend<SiteDefinition>(
    'PUT',
    `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/composition`,
    input
  )
