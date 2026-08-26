import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiSend: vi.fn()
}))

vi.mock('../api', () => ({
  apiGet: mocks.apiGet,
  apiSend: mocks.apiSend
}))

import { updateCustomCss } from '../site'

describe('site API helpers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends raw Custom CSS and null removal through the focused endpoint', async () => {
    mocks.apiSend.mockResolvedValue({ status: 'DRAFT' })
    const raw = '/* preserve */\n[data-br-site] { color: red; }  '

    await updateCustomCss('tenant/one', { customCss: raw })
    await updateCustomCss('tenant/one', { customCss: null })

    expect(mocks.apiSend).toHaveBeenNthCalledWith(1, 'PUT', '/tenants/tenant%2Fone/site/custom-css', { customCss: raw })
    expect(mocks.apiSend).toHaveBeenNthCalledWith(2, 'PUT', '/tenants/tenant%2Fone/site/custom-css', { customCss: null })
  })
})
