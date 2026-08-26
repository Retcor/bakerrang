import { apiGet, apiSend } from './api'

export interface Business {
  id: string
  name: string
  status: string
  createdAt: number
  updatedAt: number
  createdByUserId: string
}

export const listBusinesses = () => apiGet<Business[]>('/tenants')

export const createBusiness = (name: string) =>
  apiSend<Business>('POST', '/tenants', { name })
