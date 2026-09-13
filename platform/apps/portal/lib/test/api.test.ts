import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiDownload } from '../api'

describe('binary portal API requests', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('downloads a blob through the authenticated session convention', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test/')
    const fetchMock = vi.fn().mockResolvedValue(new Response('zip-bytes', {
      status: 200,
      headers: { 'content-disposition': 'attachment; filename="export.zip"' }
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiDownload('/tenants/tenant-1/export')

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/tenants/tenant-1/export', { credentials: 'include' })
    expect(result.contentDisposition).toBe('attachment; filename="export.zip"')
    await expect(result.blob.text()).resolves.toBe('zip-bytes')
  })
})
