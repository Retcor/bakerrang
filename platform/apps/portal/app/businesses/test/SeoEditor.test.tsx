import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api'

const mocks = vi.hoisted(() => ({ getMedia: vi.fn(), updateSiteSeo: vi.fn(), updatePageSeo: vi.fn() }))
vi.mock('../../../lib/media', () => ({ getMedia: mocks.getMedia }))
vi.mock('../../../lib/site', () => ({ updateSiteSeo: mocks.updateSiteSeo, updatePageSeo: mocks.updatePageSeo }))

import { SeoEditor } from '../SeoEditor'

const site: SiteDefinition = {
  status: 'DRAFT', hasUnpublishedChanges: false,
  branding: { siteName: 'Baker Glass' },
  theme: { colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
  seo: { defaultDescription: 'Site fallback description' },
  businessProfile: { description: 'Profile fallback description', socialImageMediaId: 'site-image', socialImageSrc: 'https://media.test/site.png', socialImageWidth: 1200, socialImageHeight: 630 },
  pages: [
    { id: 'home', slug: '/', title: 'Home', sections: [] },
    { id: 'services-id', slug: 'services', title: 'Services', sections: [] }
  ]
}

const renderEditor = (pageId?: string, definition = site) => {
  mocks.getMedia.mockResolvedValue({ media: [{ id: 'replacement-image', src: 'https://media.test/replacement.png', width: 1200, height: 630, originalFilename: 'replacement.png' }] })
  const props = { onCancel: vi.fn(), onDirtyChange: vi.fn(), onPreviewPage: vi.fn(), onSaved: vi.fn(), onSelectContext: vi.fn(), pageId, site: definition, tenantId: 'tenant-1' }
  return { props, ...render(<SeoEditor {...props} />) }
}

describe('SEO & Social editor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows legacy Site Defaults as clean, blank description, and indexable', async () => {
    const legacy = structuredClone(site)
    legacy.seo = undefined
    const { props } = renderEditor(undefined, legacy)
    expect(await screen.findByLabelText('Default search description')).toHaveValue('')
    expect(screen.getByLabelText('Allow search engines to index this site')).toBeChecked()
    expect(screen.getByText('Current fallback: Profile fallback description')).toBeInTheDocument()
    expect(props.onDirtyChange).toHaveBeenCalledWith(false)
  })

  it('normalizes legacy Site Defaults, omits an untouched image, and sends the atomically-owned image only when changed', async () => {
    mocks.updateSiteSeo.mockResolvedValue(site)
    const first = renderEditor()
    const { props } = first
    expect(await screen.findByLabelText('Default search description')).toHaveValue('Site fallback description')
    expect(screen.getByLabelText('Allow search engines to index this site')).toBeChecked()
    expect(props.onDirtyChange).toHaveBeenCalledWith(false)
    fireEvent.change(screen.getByLabelText('Default search description'), { target: { value: 'Updated default' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Use image' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteSeo).toHaveBeenCalledWith('tenant-1', {
      defaultDescription: 'Updated default', indexable: true, socialImageMediaId: 'replacement-image'
    }))
    expect(props.onSaved).toHaveBeenCalledWith(site)
    first.unmount()
    const untouched = renderEditor()
    await screen.findByLabelText('Default search description')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteSeo).toHaveBeenCalledWith('tenant-1', {
      defaultDescription: 'Site fallback description', indexable: true
    }))
    untouched.unmount()
  })

  it('preserves Site Defaults draft and dirty state after a validation error', async () => {
    mocks.updateSiteSeo.mockRejectedValueOnce(new ApiError(400, { error: 'SEO default description must be 500 characters or fewer' }))
    const { props } = renderEditor()
    fireEvent.change(await screen.findByLabelText('Default search description'), { target: { value: 'Draft kept' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('SEO default description must be 500 characters or fewer')).toBeInTheDocument()
    expect(screen.getByLabelText('Default search description')).toHaveValue('Draft kept')
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('clears the BusinessProfile-owned site image intentionally with null', async () => {
    mocks.updateSiteSeo.mockResolvedValue(site)
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Clear image' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteSeo).toHaveBeenCalledWith('tenant-1', {
      defaultDescription: 'Site fallback description', indexable: true, socialImageMediaId: null
    }))
  })

  it('edits Page SEO by exact pageId with inherited fallback copy and canonical-only payload', async () => {
    mocks.updatePageSeo.mockResolvedValue(site)
    const { props } = renderEditor('services-id')
    expect(await screen.findByText('Services · /services')).toBeInTheDocument()
    expect(screen.getByText('Leave blank to use: Services | Baker Glass. Around 50–60 characters often works well.')).toBeInTheDocument()
    expect(screen.getByText('Current fallback: Site fallback description')).toBeInTheDocument()
    expect(screen.getByText('Using site default.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('SEO title'), { target: { value: 'Search services' } })
    expect(screen.getByRole('button', { name: 'Preview Services' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('SEO description'), { target: { value: 'Page description' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Use image' }))
    fireEvent.click(screen.getByLabelText('Prevent search engines from indexing this page'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updatePageSeo).toHaveBeenCalledWith('tenant-1', 'services-id', {
      title: 'Search services', description: 'Page description', socialImageMediaId: 'replacement-image', noIndex: true
    }))
    expect(JSON.stringify(mocks.updatePageSeo.mock.calls[0]?.[2])).not.toMatch(/socialImage(Src|Width|Height)/)
    expect(props.onPreviewPage).not.toHaveBeenCalled()
  })

  it('keeps Home page identity and renders a graceful stale Page context', async () => {
    const home = renderEditor('home')
    expect(await screen.findByText('Leave blank to use: Baker Glass. Around 50–60 characters often works well.')).toBeInTheDocument()
    home.unmount()
    const stale = renderEditor('deleted-id')
    expect(await screen.findByText('This page is no longer available.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Return to SEO & Social' }))
    expect(stale.props.onSelectContext).toHaveBeenCalledWith()
  })

  it('keeps page noIndex editable while the site-wide setting is disabled', async () => {
    const blocked = structuredClone(site)
    blocked.seo = { ...blocked.seo, indexable: false }
    renderEditor('services-id', blocked)
    expect(await screen.findByText('Site-wide indexing is currently disabled, so this page remains noindex regardless of this setting.')).toBeInTheDocument()
    expect(screen.getByLabelText('Prevent search engines from indexing this page')).toBeEnabled()
  })

  it('clears a Page image override with null so the page returns to site-image inheritance', async () => {
    const overridden = structuredClone(site)
    const page = overridden.pages.find((candidate) => candidate.id === 'services-id')
    if (!page) throw new Error('Page fixture missing')
    page.seo = { socialImageMediaId: 'page-image', socialImageSrc: 'https://media.test/page.png' }
    mocks.updatePageSeo.mockResolvedValue(overridden)
    renderEditor('services-id', overridden)
    fireEvent.click(await screen.findByRole('button', { name: 'Clear image' }))
    expect(screen.getByText('Using site default.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updatePageSeo).toHaveBeenCalledWith('tenant-1', 'services-id', {
      title: '', description: '', socialImageMediaId: null, noIndex: false
    }))
  })

  it('preserves an exact Page SEO draft after a stale-page save returns 404', async () => {
    mocks.updatePageSeo.mockRejectedValueOnce(new ApiError(404, { error: 'Page not found' }))
    const { props } = renderEditor('services-id')
    fireEvent.change(await screen.findByLabelText('SEO title'), { target: { value: 'Keep this draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
    expect(screen.getByLabelText('SEO title')).toHaveValue('Keep this draft')
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(props.onSaved).not.toHaveBeenCalled()
  })
})
