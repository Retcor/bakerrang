import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const baseSite: SiteDefinition = {
  status: 'DRAFT',
  hasUnpublishedChanges: false,
  branding: { siteName: 'Bakery' },
  theme: { colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
  pages: [
    { id: 'home', slug: '/', title: 'Home', sections: [
      { id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Welcome', subtitle: 'Fresh every morning', ctaLabel: 'Get in touch' } },
      { id: 'about-id', type: 'about', hidden: false, content: { heading: 'About', body: 'Our story' } },
      { id: 'services-id', type: 'services', hidden: false, content: { title: 'Our services', items: [
        { id: 'service-cakes', name: 'Cakes', description: 'Made to celebrate' },
        { id: 'service-catering', name: 'Catering', description: 'For every gathering' }
      ] } },
      { id: 'testimonials-id', type: 'testimonials', hidden: false, content: { title: 'Kind words', items: [
        { id: 'testimonial-ada', customerName: 'Ada', quote: 'The cake made our day.' },
        { id: 'testimonial-grace', customerName: 'Grace', quote: 'Everything was wonderful.' }
      ] } },
      { id: 'faq-id', type: 'faq', hidden: false, content: { heading: 'Questions', intro: 'Start here.', items: [
        { id: 'faq-hours', question: 'When are you open?', answer: 'Every weekday.' },
        { id: 'faq-delivery', question: 'Do you deliver?', answer: 'Yes, within the city.' }
      ] } }
    ] },
    { id: 'about', slug: 'about', title: 'Our bakery', sections: [
      { id: 'about-hero', type: 'hero', hidden: false, content: { title: 'About us', subtitle: 'Our craft', ctaLabel: 'Contact us' } }
    ] }
  ]
}

const mocks = vi.hoisted(() => ({
  addSection: vi.fn(), getSite: vi.fn(), getSiteDomain: vi.fn(), createSitePreviewToken: vi.fn(), initializeSite: vi.fn(), publishSite: vi.fn(), setSectionVisibility: vi.fn(), unpublishSite: vi.fn(), updateSectionContent: vi.fn(),
  updateBusinessProfile: vi.fn(), updateHomeHero: vi.fn(), upsertHomeAbout: vi.fn(), upsertHomeFaq: vi.fn(), updateHomeServices: vi.fn(), updateHomeContact: vi.fn(), updateHomeGallery: vi.fn(), updateHomeTestimonials: vi.fn(), updateHomeComposition: vi.fn(), updateSiteBranding: vi.fn(), updateSiteTheme: vi.fn(), updateBusinessHours: vi.fn(), updateSocialLinks: vi.fn(), updateCustomCss: vi.fn(), updatePage: vi.fn(), updateSiteHeader: vi.fn(), updateSiteFooter: vi.fn(), updateSiteSeo: vi.fn(), updatePageSeo: vi.fn(), getSiteTemplates: vi.fn(), applySiteTemplate: vi.fn(), getSiteRevisions: vi.fn(), getSiteRevision: vi.fn(), restoreSiteRevision: vi.fn()
}))

const navigation = vi.hoisted(() => ({ pathname: '/businesses/tenant-1/website', search: '', replace: vi.fn() }))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ replace: navigation.replace }), useSearchParams: () => new URLSearchParams(navigation.search) }))
vi.mock('../../../lib/site', () => mocks)
vi.mock('../SitePreviewFrame', () => ({
  SitePreviewFrame: ({ mode = 'EDITOR', onPageSelected, onSectionSelected, pageId, site, viewport }: { mode?: string, onPageSelected?: (id: string) => void, onSectionSelected?: (id: string) => void, pageId: string, site: SiteDefinition, viewport?: string }) => {
    const page = site.pages.find((candidate) => candidate.id === pageId) ?? site.pages[0]
    const hero = page.sections.find((section) => section.type === 'hero')
    const services = page.sections.find((section) => section.type === 'services')
    const testimonials = page.sections.find((section) => section.type === 'testimonials')
    const faq = page.sections.find((section) => section.type === 'faq')
    return <div data-footer-branding={String(site.footer?.showBranding ?? '')} data-header-brand={site.header?.brandDisplay ?? ''} data-preview-mode={mode} data-testid="shared-site-preview" data-theme-primary={site.theme.colors.primary} data-viewport={viewport}><p>{hero?.type === 'hero' ? hero.content.title : ''}</p>{services?.type === 'services' && <div data-testid="services-preview"><h2>{services.content.title}</h2><ol>{services.content.items.map((item) => <li key={item.id}>{item.name}: {item.description}</li>)}</ol></div>}{testimonials?.type === 'testimonials' && <div data-testid="testimonials-preview"><h2>{testimonials.content.title}</h2><ol>{testimonials.content.items.map((item) => <li key={item.id}>{item.customerName}: {item.quote}</li>)}</ol></div>}{faq?.type === 'faq' && <div data-testid="faq-preview"><h2>{faq.content.heading}</h2>{faq.content.intro && <p>{faq.content.intro}</p>}<ol>{faq.content.items.map((item) => <li key={item.id}>{item.question}: {item.answer}</li>)}</ol></div>}{onPageSelected && <button onClick={() => onPageSelected('about')} type="button">Runtime page selection</button>}{onSectionSelected && <><button onClick={() => onSectionSelected('hero-id')} type="button">Runtime Hero selection</button><button onClick={() => onSectionSelected('about-id')} type="button">Runtime section selection</button><button onClick={() => onSectionSelected('services-id')} type="button">Runtime Services selection</button><button onClick={() => onSectionSelected('testimonials-id')} type="button">Runtime Testimonials selection</button><button onClick={() => onSectionSelected('faq-id')} type="button">Runtime FAQ selection</button></>}</div>
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
    mocks.addSection.mockResolvedValue({ site: structuredClone(baseSite), sectionId: 'new-gallery' })
    mocks.setSectionVisibility.mockResolvedValue(structuredClone(baseSite))
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
    expect(screen.queryByText('Hero changes saved to the working site.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Headline')).toHaveValue('A saved welcome')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByTestId('site-tools-launcher')).toBeInTheDocument()
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

  it('keeps Services edits, additions, removals, and reordering in the draft until one toolbar save', async () => {
    const canonical = structuredClone(baseSite)
    const services = canonical.pages[0]?.sections.find((section) => section.type === 'services')
    if (!services || services.type !== 'services') throw new Error('Services fixture missing')
    services.content = { title: 'Saved services', items: [
      { id: 'server-catering', name: 'Catering plus', description: 'Large events' },
      { id: 'server-bread', name: 'Bread', description: '' }
    ] }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Services' }))

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: '  Better services  ' } })
    fireEvent.change(screen.getAllByLabelText('Name')[1]!, { target: { value: '  Catering plus  ' } })
    fireEvent.change(screen.getAllByLabelText(/Description/)[1]!, { target: { value: 'Large events' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move Catering plus up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Cakes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add service' }))
    fireEvent.change(screen.getAllByLabelText('Name')[1]!, { target: { value: '  Bread  ' } })

    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(screen.getByTestId('services-preview')).toHaveTextContent('Better services')
    expect(screen.getByTestId('services-preview')).toHaveTextContent(/Catering plus\s*: Large events/)
    expect(within(screen.getByTestId('services-preview')).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['  Catering plus  : Large events', '  Bread  : '])
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'services-id', {
      title: 'Better services',
      items: [
        { id: 'service-catering', name: 'Catering plus', description: 'Large events' },
        { name: 'Bread', description: '' }
      ]
    })
    expect(screen.getByLabelText('Section heading')).toHaveValue('Saved services')
    expect(screen.getAllByLabelText('Name').map((input) => (input as HTMLInputElement).value)).toEqual(['Catering plus', 'Bread'])
    expect(screen.getAllByLabelText('Name')[0]).toHaveAttribute('id', 'service-name-services-id-server-catering')
    expect(screen.getAllByLabelText('Name')[1]).toHaveAttribute('id', 'service-name-services-id-server-bread')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/Services saved/i)).not.toBeInTheDocument()
  })

  it.each([
    ['a server validation failure', async () => { const { ApiError } = await import('../../../lib/api'); throw new ApiError(400, { error: 'Review the Services fields.' }) }, 'Review the Services fields.'],
    ['a network failure', async () => { throw new Error('offline') }, 'Unable to save Services. Please try again.']
  ])('retains the Services draft after %s and permits retry', async (_label, reject, message) => {
    mocks.updateSectionContent.mockImplementationOnce(reject).mockResolvedValueOnce(structuredClone(baseSite))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Services' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Keep this draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Keep this draft')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
  })

  it('blocks invalid Services drafts locally and keeps the empty-state Add action available', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Services' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Services' } })
    fireEvent.change(screen.getAllByLabelText('Name')[0]!, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Service 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Catering' }))
    expect(screen.getByText('No services yet')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one service.')
    expect(screen.getByRole('button', { name: 'Add service' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
  })

  it('guards Services transitions, preserves same-section reselection, and keeps visibility disabled while dirty', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Services' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Local Services draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Runtime Services selection' }))
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Local Services draft')
    expect(screen.getByRole('button', { name: 'Services' }).parentElement).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Hide About' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByLabelText('Section heading')).toHaveValue('Local Services draft')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
  })

  it.each(['Templates', 'Revision History'])('guards a dirty Services draft before opening %s', async (destination) => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Services' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Guard this Services draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: destination }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sections' }))
    expect(screen.getByLabelText('Section heading')).toHaveValue('Guard this Services draft')
  })

  it('preserves a dirty Services draft while opening Add Section and guards the chosen type', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Services' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Keep during Add Section' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    expect(screen.getByTestId('services-preview')).toHaveTextContent('Keep during Add Section')
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    expect(mocks.addSection).not.toHaveBeenCalled()
  })

  it('registers and removes the browser unload warning for a Services draft', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Services' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Warn before unload' } })
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    unmount()
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('keeps Testimonials edits, additions, removals, and reordering in the draft until one toolbar save', async () => {
    const canonical = structuredClone(baseSite)
    const testimonials = canonical.pages[0]?.sections.find((section) => section.type === 'testimonials')
    if (!testimonials || testimonials.type !== 'testimonials') throw new Error('Testimonials fixture missing')
    testimonials.content = { title: 'Saved praise', items: [
      { id: 'server-grace', customerName: 'Grace Hopper', quote: 'A wonderful celebration.' },
      { id: 'server-linus', customerName: 'Linus', quote: 'Fresh and thoughtful.' }
    ] }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Testimonials' }))

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: '  Saved praise  ' } })
    fireEvent.change(screen.getAllByLabelText('Customer name')[1]!, { target: { value: '  Grace Hopper  ' } })
    fireEvent.change(screen.getAllByLabelText('Quote')[1]!, { target: { value: '  A wonderful celebration.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move Grace Hopper up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add testimonial' }))
    fireEvent.change(screen.getAllByLabelText('Customer name')[1]!, { target: { value: '  Linus  ' } })
    fireEvent.change(screen.getAllByLabelText('Quote')[1]!, { target: { value: '  Fresh and thoughtful.  ' } })

    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByTestId('testimonials-preview')).toHaveTextContent('Saved praise')
    expect(within(screen.getByTestId('testimonials-preview')).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['  Grace Hopper  :   A wonderful celebration.  ', '  Linus  :   Fresh and thoughtful.  '])
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'testimonials-id', {
      title: 'Saved praise',
      items: [
        { id: 'testimonial-grace', customerName: 'Grace Hopper', quote: 'A wonderful celebration.' },
        { customerName: 'Linus', quote: 'Fresh and thoughtful.' }
      ]
    })
    expect(screen.getByLabelText('Section heading')).toHaveValue('Saved praise')
    expect(screen.getAllByLabelText('Customer name').map((input) => (input as HTMLInputElement).value)).toEqual(['Grace Hopper', 'Linus'])
    expect(screen.getAllByLabelText('Customer name')[0]).toHaveAttribute('id', 'testimonial-name-testimonials-id-server-grace')
    expect(screen.getAllByLabelText('Customer name')[1]).toHaveAttribute('id', 'testimonial-name-testimonials-id-server-linus')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/Testimonials saved/i)).not.toBeInTheDocument()
  })

  it.each([
    ['a server validation failure', async () => { const { ApiError } = await import('../../../lib/api'); throw new ApiError(400, { error: 'Review the Testimonials fields.' }) }, 'Review the Testimonials fields.'],
    ['a network failure', async () => { throw new Error('offline') }, 'Unable to save Testimonials. Please try again.']
  ])('retains the Testimonials draft after %s and permits retry', async (_label, reject, message) => {
    mocks.updateSectionContent.mockImplementationOnce(reject).mockResolvedValueOnce(structuredClone(baseSite))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Testimonials' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Keep this praise' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Keep this praise')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
  })

  it('blocks invalid Testimonials drafts locally and keeps the zero-item Add action available', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Testimonials' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Testimonials' } })
    fireEvent.change(screen.getAllByLabelText('Customer name')[0]!, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(screen.getAllByLabelText('Customer name')[0]!, { target: { value: 'Ada' } })
    fireEvent.change(screen.getAllByLabelText('Quote')[0]!, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Grace' }))
    expect(screen.getByText('No testimonials yet')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one testimonial.')
    expect(screen.getByRole('button', { name: 'Add testimonial' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(within(screen.getByTestId('testimonials-preview')).queryAllByRole('listitem')).toHaveLength(0)
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
  })

  it.each(['Templates', 'Revision History'])('guards dirty Testimonials transitions to %s and preserves same-section selection', async (destination) => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Testimonials' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Local Testimonials draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Runtime Testimonials selection' }))
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Local Testimonials draft')
    expect(screen.getByRole('button', { name: 'Testimonials' }).parentElement).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Hide About' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByLabelText('Section heading')).toHaveValue('Local Testimonials draft')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: destination }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
  })

  it('preserves a dirty Testimonials draft through Add Section and registers the unload guard', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Testimonials' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Keep during Add Section' } })
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    expect(screen.getByTestId('testimonials-preview')).toHaveTextContent('Keep during Add Section')
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    expect(mocks.addSection).not.toHaveBeenCalled()
    unmount()
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('opens a deep-linked Testimonials section in the draft-native inspector', async () => {
    navigation.search = 'editor=page&pageId=home&sectionId=testimonials-id'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { name: 'Testimonials' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Kind words')
    expect(screen.queryByRole('button', { name: 'Save Testimonials' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Testimonials' }).parentElement).toHaveAttribute('aria-current', 'true')
  })

  it('keeps FAQ edits, additions, removals, and reordering in the draft until one toolbar save', async () => {
    const canonical = structuredClone(baseSite)
    const faq = canonical.pages[0]?.sections.find((section) => section.type === 'faq')
    if (!faq || faq.type !== 'faq') throw new Error('FAQ fixture missing')
    faq.content = { heading: 'Saved answers', intro: 'Saved intro.', items: [
      { id: 'server-catering', question: 'Do you cater?', answer: 'Yes, for events.' },
      { id: 'server-custom', question: 'Custom orders?', answer: 'With notice.' }
    ] }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'FAQ' }))

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: '  Saved answers  ' } })
    fireEvent.change(screen.getByLabelText('Intro'), { target: { value: '  Saved intro.  ' } })
    fireEvent.change(screen.getAllByLabelText('Question')[1]!, { target: { value: '  Do you cater?  ' } })
    fireEvent.change(screen.getAllByLabelText('Answer')[1]!, { target: { value: '  Yes, for events.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move Do you cater? up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove When are you open?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    fireEvent.change(screen.getAllByLabelText('Question')[1]!, { target: { value: '  Custom orders?  ' } })
    fireEvent.change(screen.getAllByLabelText('Answer')[1]!, { target: { value: '  With notice.  ' } })

    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByTestId('faq-preview')).toHaveTextContent('Saved answers')
    expect(screen.getByTestId('faq-preview')).toHaveTextContent('Saved intro.')
    expect(within(screen.getByTestId('faq-preview')).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['  Do you cater?  :   Yes, for events.  ', '  Custom orders?  :   With notice.  '])
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'faq-id', {
      heading: 'Saved answers',
      intro: 'Saved intro.',
      items: [
        { id: 'faq-delivery', question: 'Do you cater?', answer: 'Yes, for events.' },
        { question: 'Custom orders?', answer: 'With notice.' }
      ]
    })
    expect(screen.getByLabelText('Section heading')).toHaveValue('Saved answers')
    expect(screen.getAllByLabelText('Question').map((input) => (input as HTMLInputElement).value)).toEqual(['Do you cater?', 'Custom orders?'])
    expect(screen.getAllByLabelText('Question')[0]).toHaveAttribute('id', 'faq-question-faq-id-server-catering')
    expect(screen.getAllByLabelText('Question')[1]).toHaveAttribute('id', 'faq-question-faq-id-server-custom')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/FAQ saved/i)).not.toBeInTheDocument()
  })

  it('omits a blank optional FAQ intro from the persistence payload', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'FAQ' }))
    fireEvent.change(screen.getByLabelText('Intro'), { target: { value: '   ' } })
    expect(screen.getByTestId('faq-preview')).not.toHaveTextContent('Start here.')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    const payload = mocks.updateSectionContent.mock.calls[0]?.[3]
    expect(payload).toEqual({
      heading: 'Questions',
      items: [
        { id: 'faq-hours', question: 'When are you open?', answer: 'Every weekday.' },
        { id: 'faq-delivery', question: 'Do you deliver?', answer: 'Yes, within the city.' }
      ]
    })
    expect(payload).not.toHaveProperty('intro')
  })

  it.each([
    ['a server validation failure', async () => { const { ApiError } = await import('../../../lib/api'); throw new ApiError(400, { error: 'Review the FAQ fields.' }) }, 'Review the FAQ fields.'],
    ['a network failure', async () => { throw new Error('offline') }, 'Unable to save FAQ. Please try again.']
  ])('retains the FAQ draft after %s and permits retry', async (_label, reject, message) => {
    mocks.updateSectionContent.mockImplementationOnce(reject).mockResolvedValueOnce(structuredClone(baseSite))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'FAQ' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Keep these answers' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Keep these answers')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
  })

  it('blocks invalid FAQ drafts locally and keeps the zero-item Add action available', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'FAQ' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Questions' } })
    fireEvent.change(screen.getAllByLabelText('Question')[0]!, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(screen.getAllByLabelText('Question')[0]!, { target: { value: 'When are you open?' } })
    fireEvent.change(screen.getAllByLabelText('Answer')[0]!, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove When are you open?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Do you deliver?' }))
    expect(screen.getByText('No questions yet')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one question.')
    expect(screen.getByRole('button', { name: 'Add question' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(within(screen.getByTestId('faq-preview')).queryAllByRole('listitem')).toHaveLength(0)
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
  })

  it.each(['Templates', 'Revision History'])('guards dirty FAQ transitions to %s and preserves same-section selection', async (destination) => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'FAQ' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Local FAQ draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Runtime FAQ selection' }))
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Local FAQ draft')
    expect(screen.getByRole('button', { name: 'FAQ' }).parentElement).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Hide About' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByLabelText('Section heading')).toHaveValue('Local FAQ draft')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: destination }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
  })

  it('preserves a dirty FAQ draft through Add Section and registers the unload guard', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'FAQ' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Keep during Add Section' } })
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    expect(screen.getByTestId('faq-preview')).toHaveTextContent('Keep during Add Section')
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    expect(mocks.addSection).not.toHaveBeenCalled()
    unmount()
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('opens a deep-linked FAQ section in the draft-native inspector', async () => {
    navigation.search = 'editor=page&pageId=home&sectionId=faq-id'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { name: 'FAQ' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Questions')
    expect(screen.getByLabelText('Intro')).toHaveValue('Start here.')
    expect(screen.queryByRole('button', { name: 'Save FAQ' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'FAQ' }).parentElement).toHaveAttribute('aria-current', 'true')
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
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(mocks.publishSite).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
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

  it('opens the Add Section rail replacement without changing the canvas', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add section' }))
    expect(await screen.findByRole('heading', { name: 'Add a section' })).toBeInTheDocument()
    expect(screen.queryByText('More site settings')).not.toBeInTheDocument()
    expect(screen.getByTestId('shared-site-preview')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hero.*Shape the first message/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('list', { name: 'Sections on Home' })).toBeInTheDocument()
  })

  it('hides and shows a non-Hero rail section through the working-site mutation', async () => {
    const hidden = structuredClone(baseSite)
    hidden.pages[0]?.sections.forEach((section) => { if (section.id === 'about-id') section.hidden = true })
    mocks.setSectionVisibility.mockResolvedValueOnce(hidden).mockResolvedValueOnce(baseSite)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Hide About' }))
    await waitFor(() => expect(mocks.setSectionVisibility).toHaveBeenCalledWith('tenant-1', 'home', 'about-id', true))
    expect(screen.queryByText('Section hidden')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Show About' })).toBeInTheDocument()
    expect(screen.getByText('Hidden')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show About' }))
    await waitFor(() => expect(mocks.setSectionVisibility).toHaveBeenLastCalledWith('tenant-1', 'home', 'about-id', false))
    expect(screen.queryByText('Section shown')).not.toBeInTheDocument()
  })

  it('keeps the selected section stable and reports a failed visibility mutation', async () => {
    mocks.setSectionVisibility.mockRejectedValueOnce(new Error('offline'))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'About' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide About' }))
    expect(await screen.findByText('Unable to update section visibility. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'About' }).parentElement).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Hide About' })).toBeEnabled()
  })

  it('scopes visibility mutations to the active page', async () => {
    const current = structuredClone(baseSite)
    current.pages[1]?.sections.push({ id: 'about-gallery', type: 'gallery', hidden: false, content: { title: 'Our work', items: [] } })
    mocks.getSite.mockResolvedValue(current)
    mocks.setSectionVisibility.mockResolvedValue(current)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Our bakery/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Hide Gallery' }))
    await waitFor(() => expect(mocks.setSectionVisibility).toHaveBeenCalledWith('tenant-1', 'about', 'about-gallery', true))
  })

  it('keeps Hero visibly locked and does not offer it a visibility mutation', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    expect(screen.getByLabelText('Hero is always visible')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hide Hero' })).not.toBeInTheDocument()
  })

  it('blocks rail visibility while a Hero draft is dirty without calling the API', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Headline'), { target: { value: 'Local only' } })
    const hide = screen.getByRole('button', { name: 'Hide About' })
    expect(hide).toBeDisabled()
    expect(screen.getByText('Save or discard your changes first.')).toBeInTheDocument()
    fireEvent.click(hide)
    expect(mocks.setSectionVisibility).not.toHaveBeenCalled()
  })

  it('adds after the selected section and selects the server-returned section id', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add section' }))
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    await waitFor(() => expect(mocks.addSection).toHaveBeenCalledWith('tenant-1', 'home', 'gallery', 'hero-id'))
    expect(navigation.replace).toHaveBeenLastCalledWith('/businesses/tenant-1/website?editor=page&pageId=home&sectionId=new-gallery', { scroll: false })
    expect(screen.queryByText('Gallery section added.')).not.toBeInTheDocument()
    expect(screen.getByTestId('site-tools-launcher')).toBeInTheDocument()
  })

  it('keeps the Add Section panel and draft on cancel, then discards only on confirmed add', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Headline'), { target: { value: 'Keep this until confirmed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('heading', { name: 'Add a section' })).toBeInTheDocument()
    expect(screen.getByTestId('shared-site-preview')).toHaveTextContent('Keep this until confirmed')
    expect(mocks.addSection).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    await waitFor(() => expect(mocks.addSection).toHaveBeenCalledWith('tenant-1', 'home', 'gallery', 'hero-id'))
  })

  it('keeps the Add Section panel open after an add failure', async () => {
    mocks.addSection.mockRejectedValueOnce(new Error('offline'))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add section' }))
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    expect(await screen.findByText('Unable to add this section. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add a section' })).toBeInTheDocument()
  })

  it('opens More settings as a thin panel and returns legacy editors to their card presentation', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: 'More settings' }))
    expect(screen.getByRole('heading', { name: 'More settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Business Profile' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Business Profile' }))
    expect(await screen.findByRole('heading', { name: 'Business Profile' })).toBeInTheDocument()
    expect(screen.getByTestId('website-editor-actions')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled()
  })

  it('saves Theme through the single toolbar action and patches the preview only locally before save', async () => {
    const saved = structuredClone(baseSite)
    saved.theme.colors.primary = '#223344'
    mocks.updateSiteTheme.mockResolvedValue(saved)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Theme/ }))
    expect(await screen.findByRole('heading', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.queryByTestId('website-editor-actions')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Primary color hex'), { target: { value: '#223344' } })
    await waitFor(() => expect(screen.getByTestId('shared-site-preview')).toHaveAttribute('data-theme-primary', '#223344'))
    expect(mocks.updateSiteTheme).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSiteTheme).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ colors: expect.objectContaining({ primary: '#223344' }) })))
    expect(screen.getByTestId('shared-site-preview')).toHaveAttribute('data-theme-primary', '#223344')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
  })

  it('uses the rail controller to disable Save and Publish for an invalid Header CTA', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Header & navigation/ }))
    fireEvent.click(await screen.findByLabelText('Show a header call-to-action'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('CTA button label'), { target: { value: 'Email us' } })
    fireEvent.change(screen.getByLabelText('CTA destination'), { target: { value: 'hello@example.com' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
  })

  it('patches Header and Footer in the preview without calling their endpoints', async () => {
    const preview = () => screen.getByTestId('shared-site-preview')
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Header & navigation/ }))
    fireEvent.click(await screen.findByLabelText('Logo + name'))
    await waitFor(() => expect(preview()).toHaveAttribute('data-header-brand', 'logoAndName'))
    expect(mocks.updateSiteHeader).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Footer/ }))
    fireEvent.click(await screen.findByLabelText('Show branding'))
    await waitFor(() => expect(preview()).toHaveAttribute('data-footer-branding', 'false'))
    expect(mocks.updateSiteFooter).not.toHaveBeenCalled()
  })

  it('guards dirty tool Back navigation and restores the canonical preview on discard', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Theme/ }))
    fireEvent.change(await screen.findByLabelText('Primary color hex'), { target: { value: '#223344' } })
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    await waitFor(() => expect(screen.getByTestId('shared-site-preview')).toHaveAttribute('data-theme-primary', '#112233'))
  })

  it('clears Branding selection and its URL so the same tool can be reopened', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Branding/ }))
    expect(await screen.findByRole('heading', { name: 'Branding' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    expect(await screen.findByText('DESIGN & CONTENT')).toBeInTheDocument()
    expect(navigation.replace).toHaveBeenLastCalledWith('/businesses/tenant-1/website', { scroll: false })
    expect(String(navigation.replace.mock.calls.at(-1)?.[0])).not.toContain('editor=branding')
    fireEvent.click(screen.getByRole('button', { name: /^Branding/ }))
    expect(await screen.findByRole('heading', { name: 'Branding' })).toBeInTheDocument()
  })

  it('re-enters Branding after switching through Theme', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Branding/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Theme/ }))
    expect(await screen.findByRole('heading', { name: 'Theme' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Branding/ }))
    expect(await screen.findByRole('heading', { name: 'Branding' })).toBeInTheDocument()
  })

  it('uses the same cleanup path after discarding dirty Branding and allows reopening it', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Branding/ }))
    fireEvent.change(await screen.findByLabelText('Site Name'), { target: { value: 'Unsaved bakery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(await screen.findByText('DESIGN & CONTENT')).toBeInTheDocument()
    expect(String(navigation.replace.mock.calls.at(-1)?.[0])).not.toContain('editor=branding')
    fireEvent.click(screen.getByRole('button', { name: /^Branding/ }))
    expect(await screen.findByLabelText('Site Name')).toHaveValue('Bakery')
  })

  it('renders the approved launcher and grouped SVG tool rows', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    const launcher = screen.getByTestId('site-tools-launcher')
    expect(launcher).toHaveTextContent('Theme, branding, header, footer, SEO & more')
    expect(launcher.querySelector('svg[data-site-tool-icon="siteTools"]')).toBeInTheDocument()
    expect(launcher.querySelector('[data-testid="site-tool-chevron"]')).toBeInTheDocument()
    fireEvent.click(launcher)
    expect(await screen.findByText('DESIGN & CONTENT')).toBeInTheDocument()
    expect(screen.getByText('FULL-SCREEN TOOLS')).toBeInTheDocument()
    for (const id of ['branding', 'theme', 'header', 'footer', 'seo', 'templates', 'revisions', 'moreSettings']) {
      expect(document.querySelector(`svg[data-site-tool-icon="${id}"]`)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: /Branding.*Logo, site name, favicon/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Theme.*Colours, fonts, shape/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /More settings/i })).toBeInTheDocument()
  })

  it('opens Templates and Revision History from the canvas site tools', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }))
    expect(await screen.findByRole('heading', { name: 'Templates' })).toBeInTheDocument()
    expect(screen.getByText('Viewing templates')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Preview viewport' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Site Tools' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Revision History' }))
    expect(await screen.findByRole('heading', { name: 'Revision history' })).toBeInTheDocument()
    expect(screen.getByText('Viewing history')).toBeInTheDocument()
  })

  it('applies a template once, installs the canonical site, exits the tool, and leaves Publish explicit', async () => {
    const template = { id: 'bold', version: 1, name: 'Bold', description: 'Bold styling.', tags: [], preview: { theme: { ...baseSite.theme, colors: { ...baseSite.theme.colors, primary: '#aa0000' } }, header: { brandDisplay: 'logo' }, footer: { showBranding: false, showBusinessContact: false, showSocialLinks: false, showCopyright: false } } }
    const applied = structuredClone(baseSite)
    applied.status = 'PUBLISHED'; applied.hasUnpublishedChanges = true; applied.theme = template.preview.theme
    mocks.getSiteTemplates.mockResolvedValue([template])
    mocks.applySiteTemplate.mockResolvedValue(applied)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apply template' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Apply “Bold”?' })).getByRole('button', { name: 'Apply Template' }))
    await waitFor(() => expect(mocks.applySiteTemplate).toHaveBeenCalledOnce())
    expect(await screen.findByLabelText('Headline')).toHaveValue('Welcome')
    expect(screen.queryByText('Viewing templates')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Preview viewport' })).toBeInTheDocument()
    expect(screen.getByTestId('shared-site-preview')).toHaveAttribute('data-theme-primary', '#aa0000')
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
    expect(mocks.publishSite).not.toHaveBeenCalled()
    expect(screen.queryByText(/applied to the working site/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('site-tools-launcher')).toBeInTheDocument()
  })

  it('keeps the Apply confirmation and shows actionable feedback when template Apply fails', async () => {
    const template = { id: 'bold', version: 1, name: 'Bold', description: 'Bold styling.', tags: [], preview: { theme: { ...baseSite.theme, colors: { ...baseSite.theme.colors, primary: '#aa0000' } }, header: { brandDisplay: 'logo' }, footer: { showBranding: false, showBusinessContact: false, showSocialLinks: false, showCopyright: false } } }
    mocks.getSiteTemplates.mockResolvedValue([template])
    mocks.applySiteTemplate.mockRejectedValueOnce(new Error('offline'))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apply template' }))
    const confirmation = screen.getByRole('dialog', { name: 'Apply “Bold”?' })
    expect(confirmation).toBeInTheDocument()
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Apply Template' }))
    expect(await screen.findByText('Unable to apply this template. Please try again.')).toBeInTheDocument()
  })

  it('restores one inspected snapshot, installs canonical Working, and exits on Home Hero', async () => {
    const revisions = [{ revisionId: 'current', publishedAt: 200, publishedByUserId: 'hidden', pageCount: 2, isCurrent: true }, { revisionId: 'older', publishedAt: 100, publishedByUserId: 'also-hidden', pageCount: 1, isCurrent: false }]
    const snapshot = structuredClone(baseSite)
    const snapshotHero = snapshot.pages[0]?.sections[0]
    if (!snapshotHero || snapshotHero.type !== 'hero') throw new Error('Hero fixture missing')
    snapshotHero.content.title = 'Historical view'
    const restored = structuredClone(snapshot)
    restored.status = 'PUBLISHED'; restored.hasUnpublishedChanges = true
    mocks.getSiteRevisions.mockResolvedValue({ revisions })
    mocks.getSiteRevision.mockResolvedValue(snapshot)
    mocks.restoreSiteRevision.mockResolvedValue(restored)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Revision History' }))
    await waitFor(() => expect(mocks.getSiteRevision).toHaveBeenCalledWith('tenant-1', 'current'))
    fireEvent.click(screen.getByText('1 page').closest('button') as HTMLButtonElement)
    await waitFor(() => expect(mocks.getSiteRevision).toHaveBeenCalledWith('tenant-1', 'older'))
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Restore this published revision?' })).getByRole('button', { name: 'Restore to Working' }))
    await waitFor(() => expect(mocks.restoreSiteRevision).toHaveBeenCalledOnce())
    expect(await screen.findByLabelText('Headline')).toHaveValue('Historical view')
    expect(screen.queryByText('Viewing history')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Preview viewport' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
    expect(mocks.publishSite).not.toHaveBeenCalled()
    expect(screen.queryByText(/Revision restored/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('site-tools-launcher')).toBeInTheDocument()
  })

  it('keeps the Restore confirmation and shows actionable feedback when revision Restore fails', async () => {
    const revisions = [{ revisionId: 'current', publishedAt: 200, publishedByUserId: 'hidden', pageCount: 2, isCurrent: true }, { revisionId: 'older', publishedAt: 100, publishedByUserId: 'also-hidden', pageCount: 1, isCurrent: false }]
    mocks.getSiteRevisions.mockResolvedValue({ revisions })
    mocks.getSiteRevision.mockResolvedValue(structuredClone(baseSite))
    mocks.restoreSiteRevision.mockRejectedValueOnce(new Error('offline'))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Revision History' }))
    await waitFor(() => expect(mocks.getSiteRevision).toHaveBeenCalledWith('tenant-1', 'current'))
    fireEvent.click(screen.getByText('1 page').closest('button') as HTMLButtonElement)
    await waitFor(() => expect(mocks.getSiteRevision).toHaveBeenCalledWith('tenant-1', 'older'))
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))
    const confirmation = screen.getByRole('dialog', { name: 'Restore this published revision?' })
    expect(confirmation).toBeInTheDocument()
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Restore to Working' }))
    expect(await screen.findByText('Unable to restore this revision. Please try again.')).toBeInTheDocument()
  })

  it.each(['Templates', 'Revision History'])('guards a dirty Hero before opening %s', async (destination) => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Headline'), { target: { value: 'Unsaved hero' } })
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: destination }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sections' }))
    expect(screen.getByLabelText('Headline')).toHaveValue('Unsaved hero')
  })

  it.each(['Templates', 'Revision History'])('guards a dirty rail tool before opening %s', async (destination) => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Theme/ }))
    fireEvent.change(await screen.findByLabelText('Primary color hex'), { target: { value: '#223344' } })
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    fireEvent.click(await screen.findByRole('button', { name: destination }))
    expect(screen.getByText(destination === 'Templates' ? 'Viewing templates' : 'Viewing history')).toBeInTheDocument()
  })
})
