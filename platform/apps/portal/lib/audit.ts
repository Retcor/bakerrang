import { apiGet } from './api'

export interface AuditEvent {
  eventId: string
  occurredAt: number
  actorUserId: string
  actorEmail: string | null
  actorName: string | null
  actorType: 'USER'
  action: string
  entityType: string
  entityId?: string
  summary: string
  metadata?: Record<string, unknown>
}

export interface AuditEventPage {
  events: AuditEvent[]
  nextCursor?: string
}

export const getAuditEvents = (tenantId: string, cursor?: string) => {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return apiGet<AuditEventPage>(`/tenants/${encodeURIComponent(tenantId)}/audit-events${query}`)
}
