import { apiGet, apiSend } from './api'

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST'] as const
export type LeadStatus = typeof LEAD_STATUSES[number]

export interface LeadSummary {
  id: string
  name: string
  email?: string
  phone?: string
  status: LeadStatus
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

export interface LeadNote {
  id: string
  text: string
  createdAt: number
  createdByUserId: string
}

export interface LeadNoteListResponse {
  notes: LeadNote[]
  hasMore: boolean
}

export const getLeads = (tenantId: string) =>
  apiGet<LeadListResponse>(`/tenants/${encodeURIComponent(tenantId)}/leads`)

export const getLead = (tenantId: string, leadId: string) =>
  apiGet<LeadDetail>(
    `/tenants/${encodeURIComponent(tenantId)}/leads/${encodeURIComponent(leadId)}`
  )

export const updateLeadStatus = (
  tenantId: string,
  leadId: string,
  update: { status: LeadStatus, expectedUpdatedAt: number }
) => apiSend<LeadDetail>(
  'PATCH',
  `/tenants/${encodeURIComponent(tenantId)}/leads/${encodeURIComponent(leadId)}`,
  update
)

export const getLeadNotes = (tenantId: string, leadId: string) =>
  apiGet<LeadNoteListResponse>(
    `/tenants/${encodeURIComponent(tenantId)}/leads/${encodeURIComponent(leadId)}/notes`
  )

export const addLeadNote = (tenantId: string, leadId: string, text: string) =>
  apiSend<LeadNote>(
    'POST',
    `/tenants/${encodeURIComponent(tenantId)}/leads/${encodeURIComponent(leadId)}/notes`,
    { text }
  )
