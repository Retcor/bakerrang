import { apiGet, apiUpload } from './api'

export interface MediaItem {
  id: string
  originalFilename: string
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  sizeBytes: number
  width: number
  height: number
  createdAt: number
  src: string
}

export interface MediaListResponse {
  media: MediaItem[]
  hasMore: boolean
}

export const getMedia = (tenantId: string) =>
  apiGet<MediaListResponse>(`/tenants/${encodeURIComponent(tenantId)}/media`)

export const uploadMedia = (tenantId: string, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return apiUpload<MediaItem>(`/tenants/${encodeURIComponent(tenantId)}/media`, formData)
}
