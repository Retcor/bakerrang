import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMedia: vi.fn(),
  uploadMedia: vi.fn(),
  updateSectionContent: vi.fn()
}))

vi.mock('../../../lib/media', () => ({ getMedia: mocks.getMedia, uploadMedia: mocks.uploadMedia }))
vi.mock('../../../lib/site', () => ({ updateSectionContent: mocks.updateSectionContent }))

import { AboutEditor } from '../AboutEditor'

const theme = {
  colors: { primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033' },
  headingFont: 'inter' as const,
  bodyFont: 'inter' as const,
  cornerStyle: 'soft' as const,
  contentWidth: 'standard' as const,
  sectionSpacing: 'comfortable' as const
}
const site = (withAbout = false): SiteDefinition => ({
  status: 'PUBLISHED',
  branding: { siteName: 'Bakery' },
  theme,
  pages: [{
    id: 'home', slug: '/', title: 'Home', sections: [
      { id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Welcome' } },
      ...(withAbout
        ? [{
            id: 'about-id',
            type: 'about' as const,
            hidden: false,
            content: { eyebrow: 'Who we are', heading: 'Our story', body: 'First.\n\nSecond.' }
          }]
        : [])
    ]
  }]
})

const media = {
  id: 'media-1', originalFilename: 'team.jpg', contentType: 'image/jpeg' as const,
  sizeBytes: 100, width: 800, height: 600, createdAt: 1, src: 'https://media.test/team.jpg'
}

describe('About editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMedia.mockResolvedValue({ media: [], hasMore: false })
    mocks.uploadMedia.mockResolvedValue(media)
    mocks.updateSectionContent.mockResolvedValue(site(true))
  })

  it('supports the empty create state and validates required text', async () => {
    render(<AboutEditor onCancel={() => undefined} onSaved={() => undefined} pageId="home" site={site()} tenantId="tenant-1" sectionId="about-id" />)
    expect(screen.getByLabelText('Heading')).toHaveValue('')
    expect(screen.getByLabelText('Body')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Heading must be between 1 and 120 characters.')
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.getMedia).toHaveBeenCalledWith('tenant-1'))
  })

  it('loads existing values, edits multiline body, saves canonical input, and propagates the result', async () => {
    const onSaved = vi.fn()
    render(<AboutEditor onCancel={() => undefined} onSaved={onSaved} pageId="home" site={site(true)} tenantId="tenant-1" sectionId="about-id" />)
    expect(screen.getByLabelText('Eyebrow / label Optional')).toHaveValue('Who we are')
    expect(screen.getByLabelText('Heading')).toHaveValue('Our story')
    expect(screen.getByLabelText('Body')).toHaveValue('First.\n\nSecond.')
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Updated one.\n\nUpdated two.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'about-id', {
      eyebrow: 'Who we are', heading: 'Our story', body: 'Updated one.\n\nUpdated two.'
    }))
    expect(onSaved).toHaveBeenCalledWith(site(true))
  })

  it('resolves the exact repeated About instance inside the selected page without a type fallback', async () => {
    const multiPage = site(true)
    multiPage.pages.push(
      { id: 'page-a', slug: 'services', title: 'Services', sections: [
        { id: 'about-a', type: 'about', hidden: false, content: { heading: 'About A', body: 'A' } },
        { id: 'about-b', type: 'about', hidden: false, content: { heading: 'About B', body: 'B' } }
      ] },
      { id: 'page-b', slug: 'contact', title: 'Contact', sections: [
        { id: 'about-c', type: 'about', hidden: false, content: { heading: 'About C', body: 'C' } },
        { id: 'about-d', type: 'about', hidden: false, content: { heading: 'About D', body: 'D' } }
      ] }
    )
    render(<AboutEditor onCancel={() => undefined} onSaved={() => undefined} pageId="page-b" site={multiPage} tenantId="tenant-1" sectionId="about-d" />)
    expect(screen.getByLabelText('Heading')).toHaveValue('About D')
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'About D saved' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'page-b', 'about-d', expect.objectContaining({ heading: 'About D saved' })))
  })

  it('reuses polished media upload, requires alt text, and saves the selected Media id', async () => {
    const onSaved = vi.fn()
    render(<AboutEditor onCancel={() => undefined} onSaved={onSaved} pageId="home" site={site(true)} tenantId="tenant-1" sectionId="about-id" />)
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'Our team' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Meet the people behind the work.' } })
    const file = new File(['image'], 'team.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Choose image'), { target: { files: [file] } })
    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledWith('tenant-1', file))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Image alt text is required')
    fireEvent.change(screen.getByLabelText('Image alt text'), { target: { value: 'The bakery team' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'about-id', {
      eyebrow: 'Who we are', heading: 'Our team',
      body: 'Meet the people behind the work.',
      imageMediaId: 'media-1',
      imageAlt: 'The bakery team'
    }))
    expect(onSaved).toHaveBeenCalledWith(site(true))
  })
})
