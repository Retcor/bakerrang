import { apiDownload, apiGet, apiSend } from './api'

export type TenantDeletionStatus = 'PENDING_DELETE' | 'DELETING' | 'FAILED' | 'COMPLETE'

export interface TenantDeletion {
  tenantId: string
  status: TenantDeletionStatus
}

const tenantPath = (tenantId: string) => `/tenants/${encodeURIComponent(tenantId)}`

const safeFilename = (value: string | null, fallback: string) => {
  if (!value) return fallback
  const match = /(?:^|;)\s*filename\s*=\s*(?:"([^"\\\r\n]+)"|([^;\s\r\n]+))/i.exec(value)
  const candidate = match?.[1] || match?.[2]
  if (!candidate || /[\\/\u0000-\u001f\u007f]/.test(candidate)) return fallback
  return candidate
}

export async function downloadTenantExport (tenantId: string) {
  const result = await apiDownload(`${tenantPath(tenantId)}/export`)
  const fallback = `tenant-${tenantId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'export'}.zip`
  return { ...result, filename: safeFilename(result.contentDisposition, fallback) }
}

export const getTenantDeletionStatus = (tenantId: string) =>
  apiGet<TenantDeletion>(`${tenantPath(tenantId)}/deletion`)

export const deleteTenant = (tenantId: string, confirmation: string) =>
  apiSend<TenantDeletion>('POST', `${tenantPath(tenantId)}/delete`, { confirmation })

export const resumeTenantDeletion = (tenantId: string) =>
  apiSend<TenantDeletion>('POST', `${tenantPath(tenantId)}/delete/resume`)
