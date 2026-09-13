import { apiGet, apiSend } from './api'

export interface LeadNotificationSettings {
  enabled: boolean
  recipients: string[]
}

const endpoint = (tenantId: string) => `/tenants/${encodeURIComponent(tenantId)}/lead-notifications`

export const getLeadNotificationSettings = (tenantId: string) =>
  apiGet<LeadNotificationSettings>(endpoint(tenantId))

export const updateLeadNotificationSettings = (tenantId: string, settings: LeadNotificationSettings) =>
  apiSend<LeadNotificationSettings>('PUT', endpoint(tenantId), settings)
