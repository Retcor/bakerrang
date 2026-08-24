import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const baseSite: SiteDefinition = {
  status: 'DRAFT',
  hasUnpublishedChanges: false,
  branding: { siteName: 'Bakery', primaryColor: '#112233', accentColor: '#445566' },
  theme: {
    colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' },
    headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable'
  },
  pages: [{
    id: 'home', slug: '/', title: 'Home',
    sections: [
      { id: 'hero', type: 'hero', content: { title: 'Welcome' } },
      { id: 'about', type: 'about', content: { heading: 'About', body: 'Our story' } },
      { id: 'faq', type: 'faq', content: { heading: 'FAQ', items: [{ id: 'q1', question: 'When?', answer: 'Today' }] } }
    ]
  }]
}

const mocks = vi.hoisted(() => ({
  getSite: vi.fn(), getSiteDomain: vi.fn(), createSitePreviewToken: vi.fn(), initializeSite: vi.fn(),
  publishSite: vi.fn(), unpublishSite: vi.fn(), updateBusinessProfile: vi.fn(), updateHomeHero: vi.fn(),
  upsertHomeAbout: vi.fn(), upsertHomeFaq: vi.fn(), updateHomeServices: vi.fn(), updateHomeContact: vi.fn(),
  updateHomeGallery: vi.fn(), updateHomeTestimonials: vi.fn(), updateHomeComposition: vi.fn(),
  updateSiteBranding: vi.fn(), updateSiteTheme: vi.fn(), updateBusinessHours: vi.fn(), updateSocialLinks: vi.fn(),
  updateCustomCss: vi.fn()
}))

const navigation = vi.hoisted(() => ({
  pathname: '/businesses/tenant-1/website', search: '', replace: vi.fn()
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search)
}))

vi.mock('../../../lib/site', () => mocks)

import { BusinessWebsite } from '../BusinessWebsite'

describe('Website workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigation.pathname = '/businesses/tenant-1/website'
    navigation.search = ''
    mocks.getSite.mockResolvedValue(baseSite)
    mocks.getSiteDomain.mockResolvedValue(null)
    mocks.createSitePreviewToken.mockResolvedValue({ token: 'preview', expiresAt: 1 })
    mocks.publishSite.mockResolvedValue({ ...baseSite, status: 'PUBLISHED', hasUnpublishedChanges: false, lastPublishedAt: 100 })
    mocks.unpublishSite.mockResolvedValue(baseSite)
  })

  it('opens to Overview and exposes the authoritative grouped desktop hierarchy', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { name: 'Website Overview' })).toBeInTheDocument()
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0)
    expect(screen.getByText('3 homepage sections configured')).toBeInTheDocument()
    expect(screen.getByText('Hero · About · FAQ')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument()

    const nav = screen.getByRole('navigation', { name: 'Website editor navigation' })
    expect(within(nav).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    for (const label of ['Branding', 'Theme', 'Business Profile', 'Business Hours', 'Social Profiles', 'Hero', 'About', 'Services', 'Gallery', 'Testimonials', 'FAQ', 'Contact', 'Manage Sections', 'Custom CSS']) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument()
    }
    const setup = within(nav).getByRole('heading', { name: 'Site setup' }).closest('section') as HTMLElement
    const homepage = within(nav).getByRole('heading', { name: 'Homepage' }).closest('section') as HTMLElement
    const advanced = within(nav).getByRole('heading', { name: 'Advanced' }).closest('section') as HTMLElement
    expect(within(nav).getByRole('heading', { name: 'Site setup' })).toHaveClass('text-[0.6875rem]', 'font-semibold', 'tracking-[0.12em]')
    expect(homepage).toHaveClass('border-t', 'border-border', 'pt-5')
    expect(within(nav).queryByRole('button', { name: 'Site setup' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Site setup' })).not.toBeInTheDocument()
    expect(within(setup).getByRole('button', { name: 'Social Profiles' })).toBeInTheDocument()
    expect(within(setup).queryByRole('button', { name: 'Manage Sections' })).not.toBeInTheDocument()
    expect(within(homepage).getByRole('button', { name: 'Manage Sections' })).toBeInTheDocument()
    expect(within(advanced).getByRole('button', { name: 'Custom CSS' })).toBeInTheDocument()
  })

  it('selects valid deep links, fails invalid values to Overview, and keeps Preview persistent', async () => {
    navigation.search = 'editor=faq'
    const { unmount } = render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { name: 'FAQ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview changes' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Website editor navigation' })
    expect(within(nav).getByRole('button', { name: 'FAQ' })).toHaveAttribute('aria-current', 'page')
    unmount()

    navigation.search = 'editor=not-real'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { name: 'Website Overview' })).toBeInTheDocument()
  })

  it('uses replace, preserves unrelated query parameters, avoids refetches, and Cancel returns to Overview', async () => {
    navigation.search = 'campaign=spring'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    const nav = await screen.findByRole('navigation', { name: 'Website editor navigation' })
    fireEvent.click(within(nav).getByRole('button', { name: 'FAQ' }))
    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeInTheDocument()
    expect(navigation.replace).toHaveBeenLastCalledWith('/businesses/tenant-1/website?campaign=spring&editor=faq', { scroll: false })
    expect(mocks.getSite).toHaveBeenCalledTimes(1)
    expect(mocks.getSiteDomain).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Website Overview' })).toBeInTheDocument()
    expect(navigation.replace).toHaveBeenLastCalledWith('/businesses/tenant-1/website?campaign=spring', { scroll: false })
    expect(mocks.getSite).toHaveBeenCalledTimes(1)
  })

  it('offers grouped dialog navigation below lg, shows the active pane, and closes after selection', async () => {
    navigation.search = 'editor=faq'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    const change = await screen.findByRole('button', { name: /FAQ.*Change/ })
    fireEvent.click(change)
    const dialog = screen.getByRole('dialog', { name: 'Website navigation' })
    const selector = within(dialog).getByRole('navigation', { name: 'Website editor selector' })
    expect(within(selector).getByRole('button', { name: 'Overview' })).toBeInTheDocument()
    expect(within(selector).getByRole('heading', { name: 'Site setup' })).toBeInTheDocument()
    expect(within(selector).getByRole('heading', { name: 'Homepage' })).toBeInTheDocument()
    expect(within(selector).getByRole('heading', { name: 'Advanced' })).toBeInTheDocument()
    fireEvent.click(within(selector).getByRole('button', { name: 'Theme' }))
    expect(screen.queryByRole('dialog', { name: 'Website navigation' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument()
  })

  it('publishes while an editor is selected and keeps the active editor in place', async () => {
    navigation.search = 'editor=theme'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByRole('heading', { name: 'Theme' })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(mocks.publishSite).toHaveBeenCalledWith('tenant-1'))
    expect(await screen.findByRole('button', { name: 'Republish' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0)
  })

  it('shows unpublished-change status and keeps Unpublish secondary on Overview', async () => {
    mocks.getSite.mockResolvedValue({ ...baseSite, status: 'PUBLISHED', hasUnpublishedChanges: true, lastPublishedAt: 100 })
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect((await screen.findAllByText('Changes not published')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Republish' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Website editor navigation' })).getByRole('button', { name: 'FAQ' }))
    expect(screen.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument()
  })

  it('shows an active domain without allowing domain failures to break Website', async () => {
    mocks.getSiteDomain.mockResolvedValue({ status: 'ACTIVE', hostname: 'www.example.com' })
    const { unmount } = render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByText('www.example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage domain →' })).toHaveAttribute('href', '/businesses/tenant-1/domain')
    unmount()

    mocks.getSiteDomain.mockRejectedValue(new Error('domain unavailable'))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { name: 'Website Overview' })).toBeInTheDocument()
    expect(screen.queryByText('Unable to load the website. Please try again.')).not.toBeInTheDocument()
  })

  it('guards dirty editor navigation, blocks stale Preview and Publish, and protects beforeunload', async () => {
    navigation.search = 'editor=faq'
    const addListener = vi.spyOn(window, 'addEventListener')
    const removeListener = vi.spyOn(window, 'removeEventListener')
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Heading'), { target: { value: 'Unsaved FAQ' } })
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview changes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(mocks.createSitePreviewToken).not.toHaveBeenCalled()
    expect(mocks.publishSite).not.toHaveBeenCalled()
    expect(addListener).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    const nav = screen.getByRole('navigation', { name: 'Website editor navigation' })
    fireEvent.click(within(nav).getByRole('button', { name: 'Theme' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByLabelText('Heading')).toHaveValue('Unsaved FAQ')
    expect(navigation.replace).not.toHaveBeenCalled()

    fireEvent.click(within(nav).getByRole('button', { name: 'Theme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument()
    expect(navigation.replace).toHaveBeenLastCalledWith('/businesses/tenant-1/website?editor=theme', { scroll: false })
    expect(removeListener).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('re-seeds an active multi-item editor from the authoritative save response', async () => {
    navigation.search = 'editor=faq'
    const canonical = structuredClone(baseSite)
    const faq = canonical.pages[0]?.sections.find((section) => section.type === 'faq')
    if (!faq || faq.type !== 'faq') throw new Error('FAQ fixture missing')
    faq.content.items = [...faq.content.items, { id: 'server-generated', question: 'New?', answer: 'New answer' }]
    mocks.upsertHomeFaq.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add Question' }))
    const groups = screen.getAllByRole('group')
    fireEvent.change(within(groups[1]).getByLabelText('Question'), { target: { value: 'New?' } })
    fireEvent.change(within(groups[1]).getByLabelText('Answer'), { target: { value: 'New answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeFaq).toHaveBeenCalledTimes(1))

    const reseededGroups = await screen.findAllByRole('group')
    fireEvent.change(within(reseededGroups[1]).getByLabelText('Answer'), { target: { value: 'Updated answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeFaq).toHaveBeenCalledTimes(2))
    expect(mocks.upsertHomeFaq.mock.calls[1]?.[1].items[1]).toMatchObject({ id: 'server-generated', question: 'New?', answer: 'Updated answer' })
  })

  it('resets the Custom CSS dirty baseline after an authoritative save', async () => {
    navigation.search = 'editor=customCss'
    const saved = { ...baseSite, customCss: '[data-br-site] { color: red; }', hasUnpublishedChanges: true }
    mocks.updateCustomCss.mockResolvedValue(saved)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Custom CSS'), { target: { value: saved.customCss } })
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateCustomCss).toHaveBeenCalledOnce())
    expect(screen.getByLabelText('Custom CSS')).toHaveValue(saved.customCss)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview changes' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
  })
})
