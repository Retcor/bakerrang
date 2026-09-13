import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiSend: vi.fn()
}))

vi.mock('../api', () => ({
  apiGet: mocks.apiGet,
  apiSend: mocks.apiSend
}))

import { applySiteTemplate, getSiteTemplates, updateCustomCss, updatePageSeo, updateSiteSeo } from '../site'

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

  it('sends SEO mutations to their single atomic site or page endpoint with canonical payloads', async () => {
    mocks.apiSend.mockResolvedValue({ status: 'DRAFT' })
    await updateSiteSeo('tenant/one', { defaultDescription: 'Site copy', indexable: false, socialImageMediaId: null })
    await updatePageSeo('tenant/one', 'page/id', { title: 'Page copy', description: '', socialImageMediaId: 'media-1', noIndex: true })

    expect(mocks.apiSend).toHaveBeenNthCalledWith(1, 'PUT', '/tenants/tenant%2Fone/site/seo', {
      defaultDescription: 'Site copy', indexable: false, socialImageMediaId: null
    })
    expect(mocks.apiSend).toHaveBeenNthCalledWith(2, 'PUT', '/tenants/tenant%2Fone/site/pages/page%2Fid/seo', {
      title: 'Page copy', description: '', socialImageMediaId: 'media-1', noIndex: true
    })
  })

  it('loads metadata and applies a server-owned template without a request body', async () => {
    mocks.apiGet.mockResolvedValue([])
    mocks.apiSend.mockResolvedValue({ status: 'DRAFT' })

    await getSiteTemplates('tenant/one')
    await applySiteTemplate('tenant/one', 'modern/local')

    expect(mocks.apiGet).toHaveBeenCalledWith('/tenants/tenant%2Fone/site/templates')
    expect(mocks.apiSend).toHaveBeenCalledWith('POST', '/tenants/tenant%2Fone/site/templates/modern%2Flocal/apply')
  })
})
