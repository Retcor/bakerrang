import type { SiteDefinition } from '@bakerrang/site-schema'
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

export const initializeSite = (tenantId: string) =>
  apiSend<SiteDefinition>('POST', `/tenants/${encodeURIComponent(tenantId)}/site`)

export const getSite = (tenantId: string) =>
  apiGet<SiteDefinition>(`/tenants/${encodeURIComponent(tenantId)}/site`)

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

export const upsertHomeContact = (tenantId: string, input: ContactInput) =>
  apiSend<SiteDefinition>(
    'PUT',
    `/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/contact`,
    input
  )
