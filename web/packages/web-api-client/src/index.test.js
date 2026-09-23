import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './index.js'

const response = (status, body = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body
})

describe('createApiClient', () => {
  it('uses credentialed requests without a CSRF handshake for reads', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, { ok: true }))
    const client = createApiClient({ baseUrl: 'https://api.example', fetchImpl })

    await client.request('/auth/check')

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example/auth/check', expect.objectContaining({
      credentials: 'include',
      method: 'GET'
    }))
  })

  it('performs the CSRF handshake and attaches the mutation header', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(200, { csrfToken: 'token-1' }))
      .mockResolvedValueOnce(response(200, { theme: 'dark' }))
    const client = createApiClient({ baseUrl: 'https://api.example', fetchImpl })

    await client.request('/account/preferences', { method: 'PUT', body: { theme: 'dark' } })

    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.example/auth/csrf')
    expect(fetchImpl.mock.calls[1][1]).toEqual(expect.objectContaining({
      credentials: 'include',
      method: 'PUT',
      body: JSON.stringify({ theme: 'dark' }),
      headers: expect.objectContaining({
        'content-type': 'application/json',
        'x-csrf-token': 'token-1'
      })
    }))
  })

  it('refreshes a rejected CSRF token once and retries the mutation', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(200, { csrfToken: 'stale' }))
      .mockResolvedValueOnce(response(403))
      .mockResolvedValueOnce(response(200, { csrfToken: 'fresh' }))
      .mockResolvedValueOnce(response(200, { saved: true }))
    const client = createApiClient({ fetchImpl })

    const result = await client.request('/save', { method: 'POST', body: { value: 1 } })

    expect(result.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(fetchImpl.mock.calls[3][1].headers['x-csrf-token']).toBe('fresh')
  })

  it('returns the original 403 when token refresh fails', async () => {
    const forbidden = response(403)
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(200, { csrfToken: 'stale' }))
      .mockResolvedValueOnce(forbidden)
      .mockRejectedValueOnce(new Error('offline'))
    const client = createApiClient({ fetchImpl })

    expect(await client.request('/save', { method: 'DELETE' })).toBe(forbidden)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})
