import { jsonOrThrow } from '@bakerrang/web-api-client'
import { apiClient } from '../providers.jsx'

export class VaultApiError extends Error {
  constructor (status, code, current) {
    super('Vault request failed')
    this.status = status
    this.code = code
    this.current = current
  }
}

export const vaultRequest = async (path, { method = 'GET', body, signal } = {}) => {
  const response = await apiClient.request(`/vault${path}`, { method, body, signal })
  if (response.ok) return jsonOrThrow(response)
  const error = await response.json().catch(() => ({}))
  throw new VaultApiError(response.status, error.code, error.current)
}

export const vaultApi = {
  meta: (signal) => vaultRequest('', { signal }),
  create: (body, signal) => vaultRequest('', { method: 'POST', body, signal }),
  keys: (body, signal) => vaultRequest('/keys', { method: 'POST', body, signal }),
  items: (signal) => vaultRequest('/items', { signal }),
  folders: (signal) => vaultRequest('/folders', { signal }),
  shared: (signal) => vaultRequest('/shared', { signal }),
  shares: (signal) => vaultRequest('/shares', { signal }),
  revisions: (signal) => vaultRequest('/revisions', { signal }),
  sharedTree: (ownerId, rootId, signal) => vaultRequest(`/shared/${ownerId}/tree/${rootId}`, { signal }),
  itemHistory: (id, ownerId, signal) => vaultRequest(ownerId ? `/shared/${ownerId}/audit/item/${id}` : `/audit/item/${id}`, { signal }),
  history: (signal) => vaultRequest('/audit', { signal }),
  folderHistory: (id, signal) => vaultRequest(`/audit/folder/${id}`, { signal })
}
