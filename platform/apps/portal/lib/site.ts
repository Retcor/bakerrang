import type { BusinessHours, SectionType, SiteDefinition, SiteFooter, SiteHeader, SiteSeo, SiteTheme, SocialLink } from '@bakerrang/site-schema'
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
  preserveSections?: boolean
}

export interface SocialLinksUpdateInput {
  socialLinks: SocialLink[] | null
}

export interface CustomCssUpdateInput {
  customCss: string | null
}

export interface SiteSeoUpdateInput extends SiteSeo {
  /** Omit to retain the current BusinessProfile-owned social image; null clears it. */
  socialImageMediaId?: string | null
}

/** Persisted SEO fields only; hydrated image values are intentionally excluded. */
export interface PageSeoUpdateInput {
  title?: string
  description?: string
  socialImageMediaId?: string | null
  noIndex?: boolean
}

export interface SitePreviewToken {
  token: string
  expiresAt: number
}

export interface PageInput { title: string, slug: string }
export interface UpdatePageInput { title?: string, slug?: string }
export interface CreatePageResponse { site: SiteDefinition, pageId: string }

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

/** Curated server-owned template metadata. Template definitions remain private to the API. */
export interface SiteTemplateSummary {
  id: string
  version: number
  name: string
  description: string
  tags: string[]
}

export const initializeSite = (tenantId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site`)

export const getSite = (tenantId: string) =>
  apiGet<SiteDefinition>(`/tenants/${encodeURIComponent(tenantId)}/site`)

export const getSiteTemplates = (tenantId: string) =>
  apiGet<SiteTemplateSummary[]>(`/tenants/${encodeURIComponent(tenantId)}/site/templates`)

export const applySiteTemplate = (tenantId: string, templateId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/templates/${encodeURIComponent(templateId)}/apply`)

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

export const updateSiteHeader = (tenantId: string, input: SiteHeader) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/header`, input)

export const updateSiteFooter = (tenantId: string, input: SiteFooter) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/footer`, input)

export const updateBusinessProfile = (tenantId: string, input: BusinessProfileInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/profile`, input)

export const updateBusinessHours = (tenantId: string, input: BusinessHoursUpdateInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/business-hours`, input)

export const updateSocialLinks = (tenantId: string, input: SocialLinksUpdateInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/social-links`, input)

export const updateCustomCss = (tenantId: string, input: CustomCssUpdateInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/custom-css`, input)

export const updateSiteSeo = (tenantId: string, input: SiteSeoUpdateInput) =>
  apiSend<SiteDefinition>('PUT', `/tenants/${encodeURIComponent(tenantId)}/site/seo`, input)

export const publishSite = (tenantId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/publish`)

export const unpublishSite = (tenantId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/unpublish`)

const pagePath = (tenantId: string, pageId: string) =>
  `/tenants/${encodeURIComponent(tenantId)}/site/pages/${encodeURIComponent(pageId)}`
const sectionPath = (tenantId: string, pageId: string, sectionId: string) =>
  `${pagePath(tenantId, pageId)}/sections/${encodeURIComponent(sectionId)}`

export const createPage = (tenantId: string, input: PageInput) =>
  apiSend<CreatePageResponse>('POST', `/tenants/${encodeURIComponent(tenantId)}/site/pages`, input)
export const updatePage = (tenantId: string, pageId: string, input: UpdatePageInput) =>
  apiSend<SiteDefinition>('PATCH', pagePath(tenantId, pageId), input)
export const updatePageSeo = (tenantId: string, pageId: string, input: PageSeoUpdateInput) =>
  apiSend<SiteDefinition>('PUT', `${pagePath(tenantId, pageId)}/seo`, input)
export const movePage = (tenantId: string, pageId: string, direction: 'up' | 'down') =>
  apiSend<SiteDefinition>('POST', `${pagePath(tenantId, pageId)}/move`, { direction })
export const deletePage = (tenantId: string, pageId: string) =>
  apiSend<SiteDefinition>('DELETE', pagePath(tenantId, pageId))

export const removeSection = (tenantId: string, pageId: string, sectionId: string) =>
  apiSend<SiteDefinition>('DELETE', sectionPath(tenantId, pageId, sectionId))
export const moveSection = (tenantId: string, pageId: string, sectionId: string, direction: 'up' | 'down') =>
  apiSend<SiteDefinition>('POST', `${sectionPath(tenantId, pageId, sectionId)}/move`, { direction })
export const addSection = (tenantId: string, pageId: string, type: SectionType, afterSectionId?: string) =>
  apiSend<{ site: SiteDefinition, sectionId: string }>('POST', `${pagePath(tenantId, pageId)}/sections`, { type, ...(afterSectionId ? { afterSectionId } : {}) })
export const duplicateSection = (tenantId: string, pageId: string, sectionId: string) =>
  apiSend<{ site: SiteDefinition, sectionId: string }>('POST', `${sectionPath(tenantId, pageId, sectionId)}/duplicate`)
export const setSectionVisibility = (tenantId: string, pageId: string, sectionId: string, hidden: boolean) =>
  apiSend<SiteDefinition>('PATCH', `${sectionPath(tenantId, pageId, sectionId)}/visibility`, { hidden })
export const updateSectionContent = <T>(tenantId: string, pageId: string, sectionId: string, input: T) =>
  apiSend<SiteDefinition>('PUT', sectionPath(tenantId, pageId, sectionId), input)
