import { apiGet } from './api'

export interface LeadSummary {
  id: string
  name: string
  email?: string
  phone?: string
  status: string
  source: string
  createdAt: number
  updatedAt: number
}

export interface LeadDetail extends LeadSummary {
  message: string
}

export interface LeadListResponse {
  leads: LeadSummary[]
  hasMore: boolean
}

export const getLeads = (tenantId: string) =>
  apiGet<LeadListResponse>(`/tenants/${encodeURIComponent(tenantId)}/leads`)

export const getLead = (tenantId: string, leadId: string) =>
  apiGet<LeadDetail>(
    `/tenants/${encodeURIComponent(tenantId)}/leads/${encodeURIComponent(leadId)}`
  )
