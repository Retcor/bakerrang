import { apiClient } from '../providers.jsx'

export class BudgetApiError extends Error {
  constructor (status, body = {}) {
    super(body.error || `Budget request failed with status ${status}`)
    this.name = 'BudgetApiError'
    this.status = status
    this.code = body.code
    this.field = body.field
    this.current = body.current
    this.limit = body.limit
  }
}

const json = async (path, options = {}) => {
  const response = await apiClient.request(path, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new BudgetApiError(response.status, body)
  return body
}

export const loadPlan = ({ signal } = {}) => json('/budget/plan', { signal })
export const createPayday = (body, { signal } = {}) => json('/budget/paydays', { method: 'POST', body, signal })
export const updatePayday = (id, body, { signal } = {}) => json(`/budget/paydays/${encodeURIComponent(id)}`, { method: 'PUT', body, signal })
export const deletePayday = (id, { signal } = {}) => json(`/budget/paydays/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
export const createBill = (body, { signal } = {}) => json('/budget/bills', { method: 'POST', body, signal })
export const updateBill = (id, body, { signal } = {}) => json(`/budget/bills/${encodeURIComponent(id)}`, { method: 'PUT', body, signal })
export const deleteBill = (id, { signal } = {}) => json(`/budget/bills/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
