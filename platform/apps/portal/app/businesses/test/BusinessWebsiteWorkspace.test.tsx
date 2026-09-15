import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const baseSite: SiteDefinition = {
  status: 'DRAFT',
  hasUnpublishedChanges: false,
  branding: { siteName: 'Bakery' },
  theme: { colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
  pages: [
    { id: 'home', slug: '/', title: 'Home', sections: [
      { id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Welcome', subtitle: 'Fresh every morning', ctaLabel: 'Get in touch' } },
      { id: 'about-id', type: 'about', hidden: false, content: { heading: 'About', body: 'Our story' } }
    ] },
    { id: 'about', slug: 'about', title: 'Our bakery', sections: [
      { id: 'about-hero', type: 'hero', hidden: false, content: { title: 'About us', subtitle: 'Our craft', ctaLabel: 'Contact us' } }
    ] }
  ]
}

const mocks = vi.hoisted(() => ({
  getSite: vi.fn(), getSiteDomain: vi.fn(), createSitePreviewToken: vi.fn(), initializeSite: vi.fn(), publishSite: vi.fn(), unpublishSite: vi.fn(), updateSectionContent: vi.fn(),
  updateBusinessProfile: vi.fn(), updateHomeHero: vi.fn(), upsertHomeAbout: vi.fn(), upsertHomeFaq: vi.fn(), updateHomeServices: vi.fn(), updateHomeContact: vi.fn(), updateHomeGallery: vi.fn(), updateHomeTestimonials: vi.fn(), updateHomeComposition: vi.fn(), updateSiteBranding: vi.fn(), updateSiteTheme: vi.fn(), updateBusinessHours: vi.fn(), updateSocialLinks: vi.fn(), updateCustomCss: vi.fn(), updatePage: vi.fn(), updateSiteHeader: vi.fn(), updateSiteFooter: vi.fn(), updateSiteSeo: vi.fn(), updatePageSeo: vi.fn(), getSiteTemplates: vi.fn(), applySiteTemplate: vi.fn(), getSiteRevisions: vi.fn(), restoreSiteRevision: vi.fn()
}))

const navigation = vi.hoisted(() => ({ pathname: '/businesses/tenant-1/website', search: '', replace: vi.fn() }))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ replace: navigation.replace }), useSearchParams: () => new URLSearchParams(navigation.search) }))
vi.mock('../../../lib/site', () => mocks)
vi.mock('../SitePreviewFrame', () => ({
  SitePreviewFrame: ({ onPageSelected, onSectionSelected, pageId, site, viewport }: { onPageSelected: (id: string) => void, onSectionSelected: (id: string) => void, pageId: string, site: SiteDefinition, viewport: string }) => {
    const page = site.pages.find((candidate) => candidate.id === pageId) ?? site.pages[0]
    const hero = page.sections.find((section) => section.type === 'hero')
    return <div data-testid="shared-site-preview" data-viewport={viewport}><p>{hero?.type === 'hero' ? hero.content.title : ''}</p><button onClick={() => onPageSelected('about')} type="button">Runtime page selection</button><button onClick={() => onSectionSelected('hero-id')} type="button">Runtime Hero selection</button><button onClick={() => onSectionSelected('about-id')} type="button">Runtime section selection</button></div>
  }
}))

import { BusinessWebsite } from '../BusinessWebsite'

describe('Website editor canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigation.search = ''
    mocks.getSite.mockResolvedValue(structuredClone(baseSite))
    mocks.getSiteDomain.mockResolvedValue(null)
    mocks.updateSectionContent.mockResolvedValue(structuredClone(baseSite))
    mocks.publishSite.mockResolvedValue({ ...structuredClone(baseSite), status: 'PUBLISHED', hasUnpublishedChanges: false })
    mocks.getSiteTemplates.mockResolvedValue([])
    mocks.getSiteRevisions.mockResolvedValue({ revisions: [] })
  })

  it('renders the product canvas with a clean, hydrated Hero draft and no CTA destination control', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByTestId('website-editor-canvas')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'BakerRang' })).toHaveAttribute('src', expect.stringContaining('bakerrang-logo.png'))
    expect(screen.getByRole('list', { name: 'Website pages' })).toHaveTextContent('Home')
    expect(screen.getByRole('list', { name: 'Sections on Home' })).toHaveTextContent('Hero')
    expect(screen.getByLabelText('Headline')).toHaveValue('Welcome')
    expect(screen.getByLabelText('Subheading')).toHaveValue('Fresh every morning')
    expect(screen.getByLabelText('CTA label')).toHaveValue('Get in touch')
    expect(screen.getByText('The CTA continues to take visitors to this page’s Contact section.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Button links to/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('shared-site-preview')).toHaveTextContent('Welcome')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('keeps Hero edits local, immediately supplies the draft to the shared preview, and saves only supported fields', async () => {
    const canonical = structuredClone(baseSite)
    const hero = canonical.pages[0]?.sections[0]
    if (!hero || hero.type !== 'hero') throw new Error('Hero fixture missing')
    hero.content = { title: 'A saved welcome', subtitle: 'Fresh every day', ctaLabel: 'Talk to us' }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    const headline = await screen.findByLabelText('Headline')
    fireEvent.change(headline, { target: { value: 'A local welcome' } })
    fireEvent.change(screen.getByLabelText('Subheading'), { target: { value: 'Fresh every day' } })
    fireEvent.change(screen.getByLabelText('CTA label'), { target: { value: 'Talk to us' } })
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByTestId('shared-site-preview')).toHaveTextContent('A local welcome')
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'hero-id', { title: 'A local welcome', subtitle: 'Fresh every day', ctaLabel: 'Talk to us' }))
    expect(await screen.findByText('Hero changes saved to the working site.')).toBeInTheDocument()
    expect(screen.getByLabelText('Headline')).toHaveValue('A saved welcome')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('preserves the local Hero draft after a save failure', async () => {
    mocks.updateSectionContent.mockRejectedValueOnce(new Error('offline'))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Headline'), { target: { value: 'Do not lose this' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Unable to save the Hero. Please try again.')).toBeInTheDocument()
    expect(screen.getByLabelText('Headline')).toHaveValue('Do not lose this')
    expect(screen.getByTestId('shared-site-preview')).toHaveTextContent('Do not lose this')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('keeps a dirty Hero draft when the preview selects that same Hero', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Headline'), { target: { value: 'Keep this Hero draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Runtime Hero selection' }))
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Headline')).toHaveValue('Keep this Hero draft')
    expect(screen.getByTestId('shared-site-preview')).toHaveTextContent('Keep this Hero draft')
  })

  it('blocks publish while the local draft is dirty, then publishes after saving', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Headline'), { target: { value: 'Unsaved' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Save changes before publishing.')).toBeInTheDocument()
    expect(mocks.publishSite).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(mocks.publishSite).toHaveBeenCalledWith('tenant-1'))
  })

  it('consumes runtime page and section selections, then keeps non-Hero editing secondary', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Runtime page selection' }))
    expect(await screen.findByLabelText('Headline')).toHaveValue('About us')
    expect(navigation.replace).toHaveBeenLastCalledWith('/businesses/tenant-1/website?editor=page&pageId=about&sectionId=about-hero', { scroll: false })
    fireEvent.click(screen.getByRole('button', { name: 'Runtime section selection' }))
    await waitFor(() => expect(navigation.replace).toHaveBeenLastCalledWith('/businesses/tenant-1/website?editor=page&pageId=home&sectionId=about-id', { scroll: false }))
    expect(screen.getByRole('heading', { name: 'Editing coming soon' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open existing controls' }))
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
  })

  it('uses real iframe viewport dimensions instead of transform scaling', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Tablet' }))
    expect(screen.getByTestId('preview-viewport-width')).toHaveTextContent('834px')
    expect(screen.getByTestId('shared-site-preview')).toHaveAttribute('data-viewport', 'tablet')
    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }))
    expect(screen.getByTestId('preview-viewport-width')).toHaveTextContent('390px')
    expect(screen.getByTestId('shared-site-preview')).toHaveAttribute('data-viewport', 'mobile')
  })

  it('takes the section rail control to the existing section manager', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Manage sections' }))
    expect(await screen.findByRole('heading', { name: 'Home sections' })).toBeInTheDocument()
  })

  it('keeps the legacy controls available under More site settings and applies the shared dirty guard', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Headline'), { target: { value: 'Draft' } })
    fireEvent.click(screen.getByText('More site settings'))
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(await screen.findByRole('heading', { name: 'Theme' })).toBeInTheDocument()
  })

  it('opens Templates and Revision History from the canvas site tools', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }))
    expect(await screen.findByRole('heading', { name: 'Templates' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revision History' }))
    expect(await screen.findByRole('heading', { name: 'Revision History' })).toBeInTheDocument()
  })
})
