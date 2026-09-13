import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createPage: vi.fn(), deletePage: vi.fn(), movePage: vi.fn(), updatePage: vi.fn() }))
vi.mock('../../../lib/site', () => mocks)

import { PagesManager, pageSlugError, suggestPageSlug } from '../PagesManager'

const site: SiteDefinition = {
  status: 'DRAFT',
  branding: { siteName: 'Bakery' },
  theme: { colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
  pages: [
    { id: 'home', slug: '/', title: 'Home', sections: [] },
    { id: 'contact', slug: 'contact', title: 'Contact', sections: [] },
    { id: 'about', slug: 'about', title: 'About', sections: [] }
  ]
}

function renderManager () {
  const props = { onDirtyChange: vi.fn(), onEditPage: vi.fn(), onPreviewPage: vi.fn(), onSaved: vi.fn(), site, tenantId: 'tenant-1' }
  return { props, ...render(<PagesManager {...props} />) }
}

describe('Pages manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createPage.mockResolvedValue({ site, pageId: 'new-page' })
    mocks.updatePage.mockResolvedValue(site)
    mocks.movePage.mockResolvedValue(site)
    mocks.deletePage.mockResolvedValue(site)
  })

  it('suggests valid slugs and blocks reserved or malformed page URLs', () => {
    expect(suggestPageSlug(' Our  Cakes & Pastries! ')).toBe('our-cakes-pastries')
    expect(pageSlugError('contact')).toBeNull()
    expect(pageSlugError('preview')).toMatch(/reserved/i)
    expect(pageSlugError('not valid')).toMatch(/lowercase/i)
  })

  it('creates a page with the suggested slug, preserves a manual override, and opens the returned exact page id', async () => {
    const { props } = renderManager()
    expect(screen.getByText('/contact · 0 sections')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add page' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'About Us' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('about-us')
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'company' } })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Company bakery' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('company')
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }))
    await waitFor(() => expect(mocks.createPage).toHaveBeenCalledWith('tenant-1', { title: 'Company bakery', slug: 'company' }))
    expect(props.onSaved).toHaveBeenCalledWith(site, 'Page created.')
    expect(props.onEditPage).toHaveBeenCalledWith('new-page')
  })

  it('uses the shared dirty state for Page settings and sends exact page commands', async () => {
    const { props } = renderManager()
    fireEvent.click(screen.getAllByRole('button', { name: 'Page settings' })[0])
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Contact us' } })
    await waitFor(() => expect(props.onDirtyChange).toHaveBeenCalledWith(true))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.updatePage).toHaveBeenCalledWith('tenant-1', 'contact', { title: 'Contact us', slug: 'contact' }))
    expect(props.onSaved).toHaveBeenCalledWith(site, 'Page settings saved.')

    fireEvent.click(screen.getByRole('button', { name: 'Move Contact down' }))
    await waitFor(() => expect(mocks.movePage).toHaveBeenCalledWith('tenant-1', 'contact', 'down'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }))
    await waitFor(() => expect(mocks.deletePage).toHaveBeenCalledWith('tenant-1', 'contact'))
  })
})
