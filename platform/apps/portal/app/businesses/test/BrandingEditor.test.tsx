import type { SiteDefinition } from '@bakerrang/site-schema'
import type { MediaListResponse } from '../../../lib/media'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateSiteTheme: vi.fn(),
  updateSiteBranding: vi.fn(),
  getMedia: vi.fn(async (): Promise<MediaListResponse> => ({ media: [], hasMore: false })),
  uploadMedia: vi.fn()
}))

vi.mock('../../../lib/site', () => ({
  updateSiteTheme: mocks.updateSiteTheme,
  updateSiteBranding: mocks.updateSiteBranding
}))
vi.mock('../../../lib/media', () => ({
  getMedia: mocks.getMedia,
  uploadMedia: mocks.uploadMedia
}))

import { BrandingEditor } from '../BrandingEditor'

const mediaItem = (id: string, filename = `${id}.png`) => ({
  id,
  originalFilename: filename,
  contentType: 'image/png' as const,
  sizeBytes: 20,
  width: 32,
  height: 32,
  createdAt: 1,
  src: `https://media.test/${id}.png`
})

const site: SiteDefinition = {
  status: 'PUBLISHED',
  branding: { siteName: 'Bakery', primaryColor: '#112233', accentColor: '#445566', logoMediaId: 'logo', logoSrc: 'https://media.test/logo.png' },
  theme: {
    colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' },
    headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft',
    contentWidth: 'standard', sectionSpacing: 'comfortable'
  },
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [] }]
}

const imageFile = (name: string) => new File(['png-bytes'], name, { type: 'image/png' })

describe('Branding editor favicon picker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMedia.mockResolvedValue({ media: [mediaItem('logo'), mediaItem('icon')], hasMore: false })
    mocks.updateSiteBranding.mockImplementation(async (_tenant, input) => ({
      ...site,
      branding: { ...site.branding, ...input }
    }))
    mocks.uploadMedia.mockImplementation(async (_tenant, file: File) => mediaItem(`up-${file.name.replace(/\W+/g, '')}`, file.name))
  })

  it('selecting favicon from the grid does not change logoMediaId, and selecting logo does not change faviconMediaId', async () => {
    render(<BrandingEditor onCancel={() => undefined} onSaved={() => undefined} site={site} tenantId="tenant-1" />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Use as Favicon' }).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: 'Use as Favicon' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteBranding).toHaveBeenCalledWith('tenant-1', {
      siteName: 'Bakery', logoMediaId: 'logo', faviconMediaId: 'icon'
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Use as Logo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteBranding).toHaveBeenLastCalledWith('tenant-1', {
      siteName: 'Bakery', logoMediaId: 'icon', faviconMediaId: 'icon'
    }))
  })

  it('favicon upload sets only faviconMediaId and logo upload sets only logoMediaId, and both appear in the shared list', async () => {
    mocks.getMedia.mockResolvedValue({ media: [], hasMore: false })
    render(<BrandingEditor onCancel={() => undefined} onSaved={() => undefined} site={{
      ...site,
      branding: { siteName: 'Bakery', primaryColor: '#112233', accentColor: '#445566' }
    }} tenantId="tenant-1" />)
    await waitFor(() => expect(mocks.getMedia).toHaveBeenCalledWith('tenant-1'))

    fireEvent.change(document.getElementById('branding-favicon-file-tenant-1') as HTMLInputElement, {
      target: { files: [imageFile('fav.png')] }
    })
    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledOnce())
    fireEvent.change(document.getElementById('branding-logo-file-tenant-1') as HTMLInputElement, {
      target: { files: [imageFile('logo.png')] }
    })
    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('img', { name: /logo preview/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /favicon preview/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Use as Logo' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Use as Favicon' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Selected' })).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteBranding).toHaveBeenCalledWith('tenant-1', {
      siteName: 'Bakery', logoMediaId: 'up-logopng', faviconMediaId: 'up-favpng'
    }))
  })

  it('removing favicon then saving omits faviconMediaId while keeping logo, and removing logo omits only logoMediaId', async () => {
    const seeded: SiteDefinition = {
      ...site,
      branding: {
        ...site.branding,
        faviconMediaId: 'icon',
        faviconSrc: 'https://media.test/icon.png'
      }
    }
    render(<BrandingEditor onCancel={() => undefined} onSaved={() => undefined} site={seeded} tenantId="tenant-1" />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Favicon' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Remove Favicon' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteBranding).toHaveBeenCalledWith('tenant-1', {
      siteName: 'Bakery', logoMediaId: 'logo'
    }))
  })

  it('removing logo then saving omits only logoMediaId while keeping favicon', async () => {
    const seeded: SiteDefinition = {
      ...site,
      branding: {
        ...site.branding,
        faviconMediaId: 'icon',
        faviconSrc: 'https://media.test/icon.png'
      }
    }
    render(<BrandingEditor onCancel={() => undefined} onSaved={() => undefined} site={seeded} tenantId="tenant-1" />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Logo' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Remove Logo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteBranding).toHaveBeenCalledWith('tenant-1', {
      siteName: 'Bakery', faviconMediaId: 'icon'
    }))
  })

  it('allows the same media id for logo and favicon and saves both keys', async () => {
    render(<BrandingEditor onCancel={() => undefined} onSaved={() => undefined} site={{
      ...site,
      branding: { siteName: 'Bakery', primaryColor: '#112233', accentColor: '#445566' }
    }} tenantId="tenant-1" />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Use as Logo' }).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: 'Use as Logo' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Use as Favicon' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteBranding).toHaveBeenCalledWith('tenant-1', {
      siteName: 'Bakery', logoMediaId: 'logo', faviconMediaId: 'logo'
    }))
  })

  it('includes faviconMediaId in the dirty value', async () => {
    const onDirtyChange = vi.fn()
    render(<BrandingEditor onCancel={() => undefined} onDirtyChange={onDirtyChange} onSaved={() => undefined} site={site} tenantId="tenant-1" />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Use as Favicon' }).length).toBeGreaterThan(0))
    expect(onDirtyChange).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getAllByRole('button', { name: 'Use as Favicon' })[1])
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true))
  })
})
