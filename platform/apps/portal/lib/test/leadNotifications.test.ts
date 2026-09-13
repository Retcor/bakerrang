import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), apiSend: vi.fn() }))

vi.mock('../api', () => mocks)

import { getLeadNotificationSettings, updateLeadNotificationSettings } from '../leadNotifications'

describe('lead notification settings API helpers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads settings and uses the CSRF-protected mutation helper for the exact settings payload', async () => {
    const settings = { enabled: false, recipients: ['ops@example.com'] }
    mocks.apiGet.mockResolvedValue(settings)
    mocks.apiSend.mockResolvedValue(settings)
    await getLeadNotificationSettings('tenant/one')
    await updateLeadNotificationSettings('tenant/one', settings)
    expect(mocks.apiGet).toHaveBeenCalledWith('/tenants/tenant%2Fone/lead-notifications')
    expect(mocks.apiSend).toHaveBeenCalledWith('PUT', '/tenants/tenant%2Fone/lead-notifications', settings)
  })
})
