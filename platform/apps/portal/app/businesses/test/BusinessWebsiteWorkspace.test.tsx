import type { SiteDefinition } from '@bakerrang/site-schema'
/* eslint-disable @next/next/no-img-element */
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
      { id: 'process-id', type: 'process', hidden: false, content: { heading: 'How it works', intro: 'Three simple steps.', items: [
        { id: 'step-choose', title: 'Choose', description: 'Pick a favorite.' },
        { id: 'step-order', title: 'Order', description: 'Tell us what you need.' }
      ] } },
      { id: 'stats-id', type: 'stats', hidden: false, content: { heading: 'Highlights', intro: 'At a glance.', items: [
        { id: 'stat-support', value: '24/7', label: 'Support' },
        { id: 'stat-orders', value: '1,200+', label: 'Orders' }
      ] } },
      { id: 'services-id', type: 'services', hidden: false, content: { title: 'Our services', items: [
        { id: 'service-cakes', name: 'Cakes', description: 'Made to celebrate' },
        { id: 'service-catering', name: 'Catering', description: 'For every gathering' }
      ] } },
      { id: 'gallery-id', type: 'gallery', hidden: false, content: { title: 'Our work', items: [
        { id: 'gallery-kitchen', mediaId: 'media-1', altText: 'A bright bakery kitchen', src: 'https://media.test/kitchen.jpg', width: 1200, height: 900 },
        { id: 'gallery-deck', mediaId: 'media-2', altText: 'A celebration cake', src: 'https://media.test/cake.jpg', width: 1200, height: 900 }
      ] } },
      { id: 'logos-id', type: 'logos', hidden: false, content: { heading: 'Trusted by', items: [
        { id: 'logo-northwind', mediaId: 'media-4', altText: 'Northwind', src: 'https://media.test/northwind.png', width: 1200, height: 400 },
        { id: 'logo-contoso', mediaId: 'media-5', altText: 'Contoso', src: 'https://media.test/contoso.png', width: 900, height: 600 }
      ] } },
      { id: 'testimonials-id', type: 'testimonials', hidden: false, content: { title: 'Kind words', items: [
        { id: 'testimonial-ada', customerName: 'Ada', quote: 'The cake made our day.' },
        { id: 'testimonial-grace', customerName: 'Grace', quote: 'Everything was wonderful.' }
      ] } },
      { id: 'faq-id', type: 'faq', hidden: false, content: { heading: 'Questions', intro: 'Start here.', items: [
        { id: 'faq-hours', question: 'When are you open?', answer: 'Every weekday.' },
        { id: 'faq-delivery', question: 'Do you deliver?', answer: 'Yes, within the city.' }
      ] } },
      { id: 'cta-id', type: 'cta', hidden: false, content: { heading: 'Ready to order?', body: 'Let us make something special.', buttonLabel: 'Visit us', action: { type: 'url', value: 'https://example.com/order' } } },
      { id: 'contact-id', type: 'contact', hidden: false, content: { title: 'Contact us', text: 'We reply quickly.', buttonLabel: 'Get in touch', action: { type: 'leadForm' } } }
    ] },
    { id: 'about', slug: 'about', title: 'Our bakery', sections: [
      { id: 'about-hero', type: 'hero', hidden: false, content: { title: 'About us', subtitle: 'Our craft', ctaLabel: 'Contact us' } }
    ] }
  ]
}

const weeklyHours = {
  monday: { open: '09:00', close: '17:00' }, tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' }, thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' }, saturday: { closed: true as const }, sunday: { closed: true as const }
}

const siteWithBusinessHours = (withSchedule = true): SiteDefinition => {
  const definition = structuredClone(baseSite)
  if (withSchedule) definition.businessProfile = { businessHours: weeklyHours }
  definition.pages[0]!.sections.push({ id: 'business-hours-id', type: 'businessHours', hidden: false, content: { heading: 'Visit the bakery', intro: 'Drop in for something fresh.' } })
  return definition
}

const mocks = vi.hoisted(() => ({
  addSection: vi.fn(), getSite: vi.fn(), getSiteDomain: vi.fn(), createSitePreviewToken: vi.fn(), initializeSite: vi.fn(), publishSite: vi.fn(), setSectionVisibility: vi.fn(), unpublishSite: vi.fn(), updateSectionContent: vi.fn(),
  updateBusinessProfile: vi.fn(), updateHomeHero: vi.fn(), upsertHomeAbout: vi.fn(), upsertHomeFaq: vi.fn(), updateHomeServices: vi.fn(), updateHomeContact: vi.fn(), updateHomeGallery: vi.fn(), updateHomeTestimonials: vi.fn(), updateHomeComposition: vi.fn(), updateSiteBranding: vi.fn(), updateSiteTheme: vi.fn(), updateBusinessHours: vi.fn(), updateSocialLinks: vi.fn(), updateCustomCss: vi.fn(), updatePage: vi.fn(), updateSiteHeader: vi.fn(), updateSiteFooter: vi.fn(), updateSiteSeo: vi.fn(), updatePageSeo: vi.fn(), getSiteTemplates: vi.fn(), applySiteTemplate: vi.fn(), getSiteRevisions: vi.fn(), getSiteRevision: vi.fn(), restoreSiteRevision: vi.fn()
}))

const mediaMocks = vi.hoisted(() => ({ getMedia: vi.fn(), uploadMedia: vi.fn() }))

const navigation = vi.hoisted(() => ({ pathname: '/businesses/tenant-1/website', search: '', replace: vi.fn() }))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ replace: navigation.replace }), useSearchParams: () => new URLSearchParams(navigation.search) }))
vi.mock('../../../lib/site', () => mocks)
vi.mock('../../../lib/media', () => mediaMocks)
vi.mock('../SitePreviewFrame', () => ({
  SitePreviewFrame: ({ mode = 'EDITOR', onPageSelected, onSectionSelected, pageId, site, viewport }: { mode?: string, onPageSelected?: (id: string) => void, onSectionSelected?: (id: string) => void, pageId: string, site: SiteDefinition, viewport?: string }) => {
    const page = site.pages.find((candidate) => candidate.id === pageId) ?? site.pages[0]
    const hero = page.sections.find((section) => section.type === 'hero')
    const about = page.sections.find((section) => section.type === 'about')
    const process = page.sections.find((section) => section.type === 'process')
    const stats = page.sections.find((section) => section.type === 'stats')
    const services = page.sections.find((section) => section.type === 'services')
    const gallery = page.sections.find((section) => section.type === 'gallery')
    const logos = page.sections.find((section) => section.type === 'logos')
    const testimonials = page.sections.find((section) => section.type === 'testimonials')
    const faq = page.sections.find((section) => section.type === 'faq')
    const cta = page.sections.find((section) => section.type === 'cta')
    const contact = page.sections.find((section) => section.type === 'contact')
    const businessHours = page.sections.find((section) => section.type === 'businessHours')
    return <div data-footer-branding={String(site.footer?.showBranding ?? '')} data-header-brand={site.header?.brandDisplay ?? ''} data-preview-mode={mode} data-testid="shared-site-preview" data-theme-primary={site.theme.colors.primary} data-viewport={viewport}><p>{hero?.type === 'hero' ? hero.content.title : ''}</p>{about?.type === 'about' && <div data-action-type={about.content.action?.type ?? ''} data-action-value={about.content.action?.value ?? ''} data-position={about.content.imagePosition ?? 'left'} data-testid="about-preview"><h2>{about.content.heading}</h2><p>{about.content.body}</p>{about.content.imageSrc && about.content.imageAlt?.trim() && Number.isSafeInteger(about.content.imageWidth) && Number(about.content.imageWidth) > 0 && Number.isSafeInteger(about.content.imageHeight) && Number(about.content.imageHeight) > 0 && <img alt={about.content.imageAlt} data-testid="about-preview-image" src={about.content.imageSrc} />}{about.content.buttonLabel && about.content.action?.value && <span>{about.content.buttonLabel}</span>}</div>}{process?.type === 'process' && <div data-testid="process-preview">{process.content.heading && <h2>{process.content.heading}</h2>}{process.content.intro && <p>{process.content.intro}</p>}<ol>{process.content.items.map((item, index) => <li key={item.id}>Step {index + 1}: {item.title}: {item.description}</li>)}</ol></div>}{stats?.type === 'stats' && <div data-testid="stats-preview">{stats.content.heading && <h2>{stats.content.heading}</h2>}{stats.content.intro && <p>{stats.content.intro}</p>}<ol>{stats.content.items.map((item) => <li key={item.id}>{item.value}: {item.label}</li>)}</ol></div>}{services?.type === 'services' && <div data-testid="services-preview"><h2>{services.content.title}</h2><ol>{services.content.items.map((item) => <li key={item.id}>{item.name}: {item.description}</li>)}</ol></div>}{gallery?.type === 'gallery' && <div data-testid="gallery-preview"><h2>{gallery.content.title}</h2><ol>{gallery.content.items.map((item) => <li data-src={item.src ?? ''} key={item.id}>{item.mediaId}: {item.altText}</li>)}</ol></div>}{logos?.type === 'logos' && <div data-testid="logos-preview">{logos.content.heading && <h2>{logos.content.heading}</h2>}<ol>{logos.content.items.map((item) => <li data-src={item.src ?? ''} key={item.id}>{item.mediaId}: {item.altText}</li>)}</ol></div>}{testimonials?.type === 'testimonials' && <div data-testid="testimonials-preview"><h2>{testimonials.content.title}</h2><ol>{testimonials.content.items.map((item) => <li key={item.id}>{item.customerName}: {item.quote}</li>)}</ol></div>}{faq?.type === 'faq' && <div data-testid="faq-preview"><h2>{faq.content.heading}</h2>{faq.content.intro && <p>{faq.content.intro}</p>}<ol>{faq.content.items.map((item) => <li key={item.id}>{item.question}: {item.answer}</li>)}</ol></div>}{cta?.type === 'cta' && <div data-action-type={cta.content.action?.type ?? ''} data-action-value={cta.content.action?.value ?? ''} data-testid="cta-preview"><h2>{cta.content.heading}</h2>{cta.content.body && <p>{cta.content.body}</p>}{cta.content.buttonLabel && cta.content.action?.value && <span>{cta.content.buttonLabel}</span>}</div>}{businessHours?.type === 'businessHours' && <div data-testid="business-hours-preview">{businessHours.content.heading && <h2>{businessHours.content.heading}</h2>}{businessHours.content.intro && <p>{businessHours.content.intro}</p>}</div>}{contact?.type === 'contact' && <div data-action-type={contact.content.action.type} data-action-value={contact.content.action.type === 'leadForm' ? '' : contact.content.action.value} data-testid="contact-preview"><h2>{contact.content.title}</h2>{contact.content.text && <p>{contact.content.text}</p>}{contact.content.action.type === 'leadForm' ? <span>Lead form preview</span> : <span>{contact.content.buttonLabel}</span>}</div>}{onPageSelected && <button onClick={() => onPageSelected('about')} type="button">Runtime page selection</button>}{onSectionSelected && <><button onClick={() => onSectionSelected('hero-id')} type="button">Runtime Hero selection</button><button onClick={() => onSectionSelected('about-id')} type="button">Runtime section selection</button><button onClick={() => onSectionSelected('process-id')} type="button">Runtime Steps selection</button><button onClick={() => onSectionSelected('stats-id')} type="button">Runtime Highlights selection</button><button onClick={() => onSectionSelected('services-id')} type="button">Runtime Services selection</button><button onClick={() => onSectionSelected('gallery-id')} type="button">Runtime Gallery selection</button><button onClick={() => onSectionSelected('logos-id')} type="button">Runtime Logos selection</button><button onClick={() => onSectionSelected('testimonials-id')} type="button">Runtime Testimonials selection</button><button onClick={() => onSectionSelected('faq-id')} type="button">Runtime FAQ selection</button><button onClick={() => onSectionSelected('cta-id')} type="button">Runtime Call to Action selection</button><button onClick={() => onSectionSelected('contact-id')} type="button">Runtime Contact selection</button><button onClick={() => onSectionSelected('business-hours-id')} type="button">Runtime Business Hours selection</button></>}</div>
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
    mediaMocks.getMedia.mockResolvedValue({ media: [
      { id: 'media-1', originalFilename: 'kitchen.jpg', contentType: 'image/jpeg', sizeBytes: 1200, width: 1200, height: 900, createdAt: 3, src: 'https://media.test/kitchen.jpg' },
      { id: 'media-2', originalFilename: 'cake.jpg', contentType: 'image/jpeg', sizeBytes: 1200, width: 1200, height: 900, createdAt: 2, src: 'https://media.test/cake.jpg' },
      { id: 'media-3', originalFilename: 'bread.jpg', contentType: 'image/jpeg', sizeBytes: 1200, width: 1200, height: 900, createdAt: 1, src: 'https://media.test/bread.jpg' },
      { id: 'media-4', originalFilename: 'northwind.png', contentType: 'image/png', sizeBytes: 1200, width: 1200, height: 400, createdAt: 5, src: 'https://media.test/northwind.png' },
      { id: 'media-5', originalFilename: 'contoso.png', contentType: 'image/png', sizeBytes: 1200, width: 900, height: 600, createdAt: 6, src: 'https://media.test/contoso.png' }
    ], hasMore: false })
    mediaMocks.uploadMedia.mockResolvedValue({ id: 'media-uploaded', originalFilename: 'uploaded.jpg', contentType: 'image/jpeg', sizeBytes: 1200, width: 1200, height: 900, createdAt: 4, src: 'https://media.test/uploaded.jpg' })
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

  it('keeps Steps edits, additions, removals, and order local, then saves one exact normalized payload', async () => {
    const canonical = structuredClone(baseSite)
    const process = canonical.pages[0]?.sections.find((section) => section.type === 'process')
    if (!process || process.type !== 'process') throw new Error('Process fixture missing')
    process.content = { heading: 'Saved steps', items: [
      { id: 'server-confirm', title: 'Confirm' },
      { id: 'server-enjoy', title: 'Enjoy', description: 'Fresh' }
    ] }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Steps' }))

    fireEvent.change(screen.getByLabelText(/Heading/), { target: { value: '  Better steps  ' } })
    fireEvent.change(screen.getByLabelText(/Intro/), { target: { value: '   ' } })
    fireEvent.change(screen.getAllByLabelText('Title')[1]!, { target: { value: '  Confirm  ' } })
    fireEvent.change(screen.getAllByLabelText(/Description/)[1]!, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move Confirm up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Choose' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }))
    fireEvent.change(screen.getAllByLabelText('Title')[1]!, { target: { value: '  Enjoy  ' } })
    fireEvent.change(screen.getAllByLabelText(/Description/)[1]!, { target: { value: '  Fresh  ' } })

    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(within(screen.getByTestId('process-preview')).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['Step 1:   Confirm  :    ', 'Step 2:   Enjoy  :   Fresh  '])
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'process-id', {
      heading: 'Better steps',
      items: [
        { id: 'step-order', title: 'Confirm' },
        { title: 'Enjoy', description: 'Fresh' }
      ]
    })
    expect(screen.getByLabelText(/Heading/)).toHaveValue('Saved steps')
    expect(screen.getAllByLabelText('Title').map((input) => (input as HTMLInputElement).value)).toEqual(['Confirm', 'Enjoy'])
    expect(screen.getAllByLabelText('Title')[0]).toHaveAttribute('id', 'process-title-process-id-server-confirm')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/Steps saved/i)).not.toBeInTheDocument()
  })

  it('keeps free-form Highlights values local, then saves their exact normalized strings and order', async () => {
    const canonical = structuredClone(baseSite)
    const stats = canonical.pages[0]?.sections.find((section) => section.type === 'stats')
    if (!stats || stats.type !== 'stats') throw new Error('Stats fixture missing')
    stats.content = { intro: 'Trusted daily', items: [
      { id: 'server-delivery', value: 'Same Day', label: 'Delivery' },
      { id: 'server-support', value: '24/7', label: 'Support' },
      { id: 'server-orders', value: '1,200+', label: 'Orders' }
    ] }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Highlights' }))

    fireEvent.change(screen.getByLabelText(/Heading/), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText(/Intro/), { target: { value: '  Trusted daily  ' } })
    fireEvent.change(screen.getAllByLabelText('Value')[1]!, { target: { value: '  Same Day  ' } })
    fireEvent.change(screen.getAllByLabelText('Label')[1]!, { target: { value: '  Delivery  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move Delivery up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add highlight' }))
    fireEvent.change(screen.getAllByLabelText('Value')[2]!, { target: { value: '  1,200+  ' } })
    fireEvent.change(screen.getAllByLabelText('Label')[2]!, { target: { value: '  Orders  ' } })

    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(within(screen.getByTestId('stats-preview')).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['  Same Day  :   Delivery  ', '24/7: Support', '  1,200+  :   Orders  '])
    expect(screen.getAllByLabelText('Value')[0]).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'stats-id', {
      intro: 'Trusted daily',
      items: [
        { id: 'stat-orders', value: 'Same Day', label: 'Delivery' },
        { id: 'stat-support', value: '24/7', label: 'Support' },
        { value: '1,200+', label: 'Orders' }
      ]
    })
    expect(screen.getByLabelText(/Heading/)).toHaveValue('')
    expect(screen.getAllByLabelText('Value').map((input) => (input as HTMLInputElement).value)).toEqual(['Same Day', '24/7', '1,200+'])
    expect(screen.getAllByLabelText('Value')[0]).toHaveAttribute('id', 'stats-value-stats-id-server-delivery')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it.each([
    { sectionName: 'Steps', removeNames: ['Choose', 'Order'], empty: 'No steps yet', alert: 'Add at least one step.', add: 'Add step' },
    { sectionName: 'Highlights', removeNames: ['Support', 'Orders'], empty: 'No highlights yet', alert: 'Add at least one highlight.', add: 'Add highlight' }
  ])('blocks an empty $sectionName draft locally while leaving its Add action available', async ({ sectionName, removeNames, empty, alert, add }) => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: sectionName }))
    for (const name of removeNames) fireEvent.click(screen.getByRole('button', { name: `Remove ${name}` }))
    expect(screen.getByText(empty)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(alert)
    expect(screen.getByRole('button', { name: add })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
  })

  it.each([
    { sectionName: 'Steps', value: 'Keep this Steps draft', server: true, message: 'Review the Steps fields.' },
    { sectionName: 'Highlights', value: 'Keep this Highlights draft', server: false, message: 'Unable to save Highlights. Please try again.' }
  ])('retains a rejected $sectionName draft and permits retry', async ({ sectionName, value, server, message }) => {
    const { ApiError } = await import('../../../lib/api')
    mocks.updateSectionContent.mockRejectedValueOnce(server ? new ApiError(400, { error: message }) : new Error('offline')).mockResolvedValueOnce(structuredClone(baseSite))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: sectionName }))
    fireEvent.change(screen.getByLabelText(/Heading/), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText(/Heading/)).toHaveValue(value)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
  })

  it.each([
    { sectionName: 'Steps', previewId: 'process-preview' },
    { sectionName: 'Highlights', previewId: 'stats-preview' }
  ])('preserves ordinary dirty-state protections for $sectionName', async ({ sectionName, previewId }) => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: sectionName }))
    fireEvent.change(screen.getByLabelText(/Heading/), { target: { value: `Local ${sectionName} draft` } })
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    expect(screen.getByRole('button', { name: 'Hide About' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    expect(screen.getByTestId(previewId)).toHaveTextContent(`Local ${sectionName} draft`)
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    expect(mocks.addSection).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    unmount()
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    add.mockRestore(); remove.mockRestore()
  })

  it.each([
    { sectionId: 'process-id', heading: 'Steps' },
    { sectionId: 'stats-id', heading: 'Highlights' }
  ])('opens deep-linked $heading directly in its draft-native inspector', async ({ sectionId, heading }) => {
    navigation.search = `?editor=page&pageId=home&sectionId=${sectionId}`
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    const inspector = await screen.findByRole('region', { name: `${heading} properties` })
    expect(within(inspector).getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
    expect(screen.queryByTestId('website-editor-actions')).not.toBeInTheDocument()
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

  it('keeps About edits local, resets alt on replacement, and gates the preview image until new alt text is entered', async () => {
    const current = structuredClone(baseSite)
    const about = current.pages[0]?.sections.find((section) => section.type === 'about')
    if (!about || about.type !== 'about') throw new Error('About fixture missing')
    about.content = {
      eyebrow: 'Who we are',
      heading: 'About',
      body: 'Our story',
      imageMediaId: 'media-1',
      imageAlt: 'Front of our shop',
      imageSrc: 'https://media.test/kitchen.jpg',
      imageWidth: 1200,
      imageHeight: 900,
      imagePosition: 'right'
    }
    mocks.getSite.mockResolvedValue(current)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'About' }))

    fireEvent.change(screen.getByLabelText('Eyebrow Optional'), { target: { value: 'Our bakery' } })
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'A local story' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'A local body.' } })
    expect(screen.getByTestId('about-preview')).toHaveTextContent('A local story')
    expect(screen.getByTestId('about-preview')).toHaveTextContent('A local body.')
    expect(screen.getByTestId('about-preview-image')).toHaveAttribute('src', 'https://media.test/kitchen.jpg')
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Change image' }))
    expect(await screen.findByRole('button', { name: 'kitchen.jpg added' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add cake.jpg' })).toBeEnabled()
    expect(screen.queryByText('1 of 1 in About image')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add cake.jpg' }))
    expect(screen.getByRole('button', { name: 'cake.jpg added' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Add images' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.getByRole('region', { name: 'About properties' }).querySelector('img')).toHaveAttribute('src', 'https://media.test/cake.jpg')
    expect(screen.getByLabelText('Image alt text')).toHaveValue('')
    expect(screen.getByLabelText('Image position')).toHaveValue('right')
    expect(screen.getByText('Add alt text to show this image in the site preview.')).toBeInTheDocument()
    expect(screen.queryByTestId('about-preview-image')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Image alt text'), { target: { value: 'A celebration cake' } })
    expect(screen.getByTestId('about-preview-image')).toHaveAttribute('src', 'https://media.test/cake.jpg')
    expect(screen.getByTestId('about-preview-image')).toHaveAttribute('alt', 'A celebration cake')
    expect(screen.getByTestId('about-preview')).toHaveAttribute('data-position', 'right')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
  })

  it('saves one exact normalized About payload without hydration fields and installs canonical hydration', async () => {
    const current = structuredClone(baseSite)
    const initialAbout = current.pages[0]?.sections.find((section) => section.type === 'about')
    if (!initialAbout || initialAbout.type !== 'about') throw new Error('About fixture missing')
    initialAbout.content = {
      eyebrow: 'Who we are', heading: 'About', body: 'Our story',
      imageMediaId: 'media-1', imageAlt: 'Our kitchen', imageSrc: 'https://media.test/kitchen.jpg', imageWidth: 1200, imageHeight: 900,
      imagePosition: 'right', buttonLabel: 'Visit', action: { type: 'url', value: 'https://example.com' }
    }
    const canonical = structuredClone(current)
    const canonicalAbout = canonical.pages[0]?.sections.find((section) => section.type === 'about')
    if (!canonicalAbout || canonicalAbout.type !== 'about') throw new Error('About fixture missing')
    canonicalAbout.content = {
      heading: 'Our saved story', body: 'Fresh bread daily.',
      imageMediaId: 'media-1', imageAlt: 'Our working kitchen', imageSrc: 'https://cdn.test/kitchen.jpg', imageWidth: 1600, imageHeight: 1200,
      imagePosition: 'right', buttonLabel: 'Email us', action: { type: 'email', value: 'hello@example.com' }
    }
    mocks.getSite.mockResolvedValue(current)
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'About' }))

    fireEvent.change(screen.getByLabelText('Eyebrow Optional'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: '  Our saved story  ' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: '  Fresh bread daily.  ' } })
    fireEvent.change(screen.getByLabelText('Image alt text'), { target: { value: '  Our working kitchen  ' } })
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: '  Email us  ' } })
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: '  hello@example.com  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'about-id', {
      heading: 'Our saved story',
      body: 'Fresh bread daily.',
      imageMediaId: 'media-1',
      imageAlt: 'Our working kitchen',
      imagePosition: 'right',
      buttonLabel: 'Email us',
      action: { type: 'email', value: 'hello@example.com' }
    })
    const payload = mocks.updateSectionContent.mock.calls[0]?.[3]
    expect(payload).not.toHaveProperty('eyebrow')
    expect(payload).not.toHaveProperty('imageSrc')
    expect(payload).not.toHaveProperty('imageWidth')
    expect(payload).not.toHaveProperty('imageHeight')
    expect(screen.getByRole('region', { name: 'About properties' }).querySelector('img')).toHaveAttribute('src', 'https://cdn.test/kitchen.jpg')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/About changes saved/i)).not.toBeInTheDocument()
  })

  it('removes all optional About image and button state and omits the default left position on save', async () => {
    const current = structuredClone(baseSite)
    const about = current.pages[0]?.sections.find((section) => section.type === 'about')
    if (!about || about.type !== 'about') throw new Error('About fixture missing')
    about.content = {
      heading: 'About', body: 'Our story',
      imageMediaId: 'media-1', imageAlt: 'Our kitchen', imageSrc: 'https://media.test/kitchen.jpg', imageWidth: 1200, imageHeight: 900,
      imagePosition: 'left', buttonLabel: 'Visit', action: { type: 'url', value: 'https://example.com' }
    }
    const canonical = structuredClone(baseSite)
    mocks.getSite.mockResolvedValue(current)
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'About' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'about-id', { heading: 'About', body: 'Our story' })
    const payload = mocks.updateSectionContent.mock.calls[0]?.[3]
    expect(payload).not.toHaveProperty('imageMediaId')
    expect(payload).not.toHaveProperty('imageAlt')
    expect(payload).not.toHaveProperty('imagePosition')
    expect(payload).not.toHaveProperty('buttonLabel')
    expect(payload).not.toHaveProperty('action')
  })

  it('keeps About upload independent from dirty state and preserves the uploaded asset after discarding selection', async () => {
    const uploaded = { id: 'media-uploaded', originalFilename: 'uploaded.jpg', contentType: 'image/jpeg', sizeBytes: 1200, width: 1200, height: 900, createdAt: 4, src: 'https://media.test/uploaded.jpg' }
    mediaMocks.uploadMedia.mockImplementationOnce(async () => {
      mediaMocks.getMedia.mockResolvedValue({ media: [uploaded], hasMore: false })
      return uploaded
    })
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'About' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    const file = new File(['image'], 'uploaded.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(mediaMocks.uploadMedia).toHaveBeenCalledWith('tenant-1', file))
    expect(await screen.findByRole('button', { name: 'Add uploaded.jpg' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add uploaded.jpg' }))
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Runtime Services selection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'About' }))
    expect(screen.getByRole('button', { name: 'Add image' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    expect(await screen.findByRole('button', { name: 'Add uploaded.jpg' })).toBeEnabled()
    expect(mediaMocks.uploadMedia).toHaveBeenCalledOnce()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
  })

  it('retains a rejected About draft for retry and keeps its picker on cancelled dirty navigation', async () => {
    const { ApiError } = await import('../../../lib/api')
    mocks.updateSectionContent.mockRejectedValueOnce(new ApiError(400, { error: 'Enter a valid About email.' })).mockResolvedValueOnce(structuredClone(baseSite))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'About' }))
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'Keep this About draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Runtime section selection' }))
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Heading')).toHaveValue('Keep this About draft')
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    expect(await screen.findByRole('button', { name: 'Add kitchen.jpg' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Runtime Services selection' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('button', { name: 'Back to About image' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a button' }))
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: 'Email us' } })
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'hello@example.com' } })
    expect(screen.getByTestId('about-preview')).toHaveAttribute('data-action-type', 'email')
    expect(screen.getByTestId('about-preview')).toHaveAttribute('data-action-value', 'hello@example.com')
    expect(screen.getByTestId('about-preview')).toHaveTextContent('Email us')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a valid About email.')).toBeInTheDocument()
    expect(screen.getByLabelText('Heading')).toHaveValue('Keep this About draft')
    expect(screen.getByLabelText('Email address')).toHaveValue('hello@example.com')
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'sales@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
  })

  it('opens a deep-linked About section directly in the draft-native inspector', async () => {
    navigation.search = 'editor=page&pageId=home&sectionId=about-id'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    const inspector = await screen.findByRole('region', { name: 'About properties' })
    expect(within(inspector).getByRole('heading', { level: 2, name: 'About' })).toBeInTheDocument()
    expect(screen.getByLabelText('Heading')).toHaveValue('About')
    expect(screen.getByLabelText('Body')).toHaveValue('Our story')
    expect(screen.getByRole('button', { name: 'About' }).parentElement).toHaveAttribute('aria-current', 'true')
  })

  it('keeps Gallery edits, ordering, removal, and media selection local while updating the hydrated preview', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gallery' }))

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Recent work' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move image 2 up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 2 from Gallery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add bread.jpg' }))

    expect(screen.getByRole('button', { name: 'bread.jpg added' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[1]!, { target: { value: 'Fresh bread on a cooling rack' } })

    const preview = within(screen.getByTestId('gallery-preview'))
    expect(preview.getByRole('heading')).toHaveTextContent('Recent work')
    expect(preview.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'media-2: A celebration cake',
      'media-3: Fresh bread on a cooling rack'
    ])
    expect(preview.getAllByRole('listitem')[1]).toHaveAttribute('data-src', 'https://media.test/bread.jpg')
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('saves one exact Gallery payload without hydration fields or temporary ids, then installs canonical data', async () => {
    const canonical = structuredClone(baseSite)
    const gallery = canonical.pages[0]?.sections.find((section) => section.type === 'gallery')
    if (!gallery || gallery.type !== 'gallery') throw new Error('Gallery fixture missing')
    gallery.content = { title: 'Portfolio', items: [
      { id: 'server-kitchen', mediaId: 'media-1', altText: 'Working kitchen', src: 'https://cdn.test/kitchen-normalized.jpg', width: 1600, height: 1200 },
      { id: 'server-bread', mediaId: 'media-3', altText: 'Fresh bread', src: 'https://cdn.test/bread-normalized.jpg', width: 1600, height: 1200 }
    ] }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gallery' }))

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: '  Portfolio  ' } })
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[0]!, { target: { value: '  Working kitchen  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 2 from Gallery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add bread.jpg' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[1]!, { target: { value: '  Fresh bread  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'gallery-id', {
      title: 'Portfolio',
      items: [
        { id: 'gallery-kitchen', mediaId: 'media-1', altText: 'Working kitchen' },
        { mediaId: 'media-3', altText: 'Fresh bread' }
      ]
    })
    expect(screen.getAllByLabelText(/Alt text/)[0]).toHaveAttribute('id', 'gallery-alt-gallery-id-server-kitchen')
    expect(screen.getAllByLabelText(/Alt text/)[1]).toHaveAttribute('id', 'gallery-alt-gallery-id-server-bread')
    expect(within(screen.getByTestId('gallery-preview')).getAllByRole('listitem')[1]).toHaveAttribute('data-src', 'https://cdn.test/bread-normalized.jpg')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/Gallery changes saved/i)).not.toBeInTheDocument()
  })

  it('allows an empty local Gallery draft but blocks saving it', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gallery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1 from Gallery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1 from Gallery' }))

    expect(screen.getByText('No images yet')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one image.')
    expect(screen.getByRole('button', { name: 'Add image' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
  })

  it('keeps upload independent from Gallery dirty state and discards only the selected membership', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gallery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    const file = new File(['image'], 'uploaded.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(mediaMocks.uploadMedia).toHaveBeenCalledWith('tenant-1', file))
    expect(await screen.findByRole('button', { name: 'Add uploaded.jpg' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add uploaded.jpg' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[2]!, { target: { value: 'A newly uploaded project' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByTestId('gallery-preview')).toHaveTextContent('media-uploaded: A newly uploaded project')

    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Gallery' }))
    expect(screen.getByTestId('gallery-preview')).not.toHaveTextContent('media-uploaded')
    expect(mediaMocks.uploadMedia).toHaveBeenCalledOnce()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
  })

  it('retains a rejected Gallery draft and permits retry', async () => {
    mocks.updateSectionContent.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(structuredClone(baseSite))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gallery' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Keep this gallery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Unable to save Gallery. Please try again.')).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Keep this gallery')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
  })

  it('keeps the media picker open when a dirty Gallery transition is cancelled and closes it on discard', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gallery' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Unsaved Gallery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    expect(await screen.findByRole('heading', { name: 'Add images' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Runtime section selection' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('heading', { name: 'Add images' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Runtime section selection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.queryByRole('heading', { name: 'Add images' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'About' }).parentElement).toHaveAttribute('aria-current', 'true'))
  })

  it('opens a deep-linked Gallery section in the draft-native inspector', async () => {
    navigation.search = '?editor=page&pageId=home&sectionId=gallery-id'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { name: 'Gallery' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Our work')
    expect(screen.queryByText(/Save Gallery/i)).not.toBeInTheDocument()
  })

  it('keeps Logos edits, ordering, removal, and media selection local while updating the hydrated preview', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logos' }))

    fireEvent.change(screen.getByLabelText('Section heading Optional'), { target: { value: 'Featured partners' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move logo 2 up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo 2 from Logos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add logo' }))
    expect(await screen.findByRole('button', { name: 'Back to Logos section' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Add bread.jpg' }))
    expect(screen.getByRole('button', { name: 'bread.jpg added' })).toBeDisabled()
    expect(screen.getByText('2 of 24 in Logos section')).toBeInTheDocument()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[1]!, { target: { value: 'Daily Bread Collective' } })

    const preview = within(screen.getByTestId('logos-preview'))
    expect(preview.getByRole('heading')).toHaveTextContent('Featured partners')
    expect(preview.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'media-5: Contoso',
      'media-3: Daily Bread Collective'
    ])
    expect(preview.getAllByRole('listitem')[1]).toHaveAttribute('data-src', 'https://media.test/bread.jpg')
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('saves one exact Logos payload without blank heading, hydration fields, or temporary ids', async () => {
    const canonical = structuredClone(baseSite)
    const logos = canonical.pages[0]?.sections.find((section) => section.type === 'logos')
    if (!logos || logos.type !== 'logos') throw new Error('Logos fixture missing')
    logos.content = { items: [
      { id: 'server-northwind', mediaId: 'media-4', altText: 'Northwind updated', src: 'https://cdn.test/northwind-normalized.png', width: 1600, height: 500 },
      { id: 'server-bread-logo', mediaId: 'media-3', altText: 'Daily Bread', src: 'https://cdn.test/bread-logo.png', width: 1200, height: 500 }
    ] }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logos' }))

    fireEvent.change(screen.getByLabelText('Section heading Optional'), { target: { value: '   ' } })
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[0]!, { target: { value: '  Northwind updated  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo 2 from Logos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add logo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add bread.jpg' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[1]!, { target: { value: '  Daily Bread  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'logos-id', {
      items: [
        { id: 'logo-northwind', mediaId: 'media-4', altText: 'Northwind updated' },
        { mediaId: 'media-3', altText: 'Daily Bread' }
      ]
    })
    expect(screen.getAllByLabelText(/Alt text/)[0]).toHaveAttribute('id', 'logo-alt-logos-id-server-northwind')
    expect(screen.getAllByLabelText(/Alt text/)[1]).toHaveAttribute('id', 'logo-alt-logos-id-server-bread-logo')
    expect(within(screen.getByTestId('logos-preview')).getAllByRole('listitem')[1]).toHaveAttribute('data-src', 'https://cdn.test/bread-logo.png')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/Logos changes saved/i)).not.toBeInTheDocument()
  })

  it('saves an empty Logos section without a validation alert', async () => {
    const canonical = structuredClone(baseSite)
    const logos = canonical.pages[0]?.sections.find((section) => section.type === 'logos')
    if (!logos || logos.type !== 'logos') throw new Error('Logos fixture missing')
    logos.content = { items: [] }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo 1 from Logos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo 1 from Logos' }))

    expect(screen.getByText('No logos yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add logo' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'logos-id', { heading: 'Trusted by', items: [] }))
    expect(screen.getByText('No logos yet')).toBeInTheDocument()
  })

  it('keeps upload independent from Logos dirty state and discards only selected membership', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add logo' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    const file = new File(['image'], 'uploaded.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(mediaMocks.uploadMedia).toHaveBeenCalledWith('tenant-1', file))
    expect(await screen.findByText('Uploaded. Choose it below to add it to the Logos section.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add uploaded.jpg' }))
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[2]!, { target: { value: 'Uploaded partner' } })
    expect(screen.getByTestId('logos-preview')).toHaveTextContent('media-uploaded: Uploaded partner')
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Logos' }))
    expect(screen.getByTestId('logos-preview')).not.toHaveTextContent('media-uploaded')
    expect(mediaMocks.uploadMedia).toHaveBeenCalledOnce()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
  })

  it('enforces the 24-logo picker capacity while keeping Done available', async () => {
    const current = structuredClone(baseSite)
    const logos = current.pages[0]?.sections.find((section) => section.type === 'logos')
    if (!logos || logos.type !== 'logos') throw new Error('Logos fixture missing')
    logos.content = { items: Array.from({ length: 23 }, (_, index) => ({ id: `logo-${index}`, mediaId: `selected-${index}`, altText: `Logo ${index + 1}` })) }
    mocks.getSite.mockResolvedValue(current)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add logo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add bread.jpg' }))

    expect(screen.getByText('24 of 24 in Logos section')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add kitchen.jpg' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
    expect(screen.getByText('Maximum reached')).toBeInTheDocument()
  })

  it('retains a rejected Logos draft and permits retry', async () => {
    const { ApiError } = await import('../../../lib/api')
    mocks.updateSectionContent.mockRejectedValueOnce(new ApiError(400, { error: 'Review the Logos fields.' })).mockResolvedValueOnce(structuredClone(baseSite))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logos' }))
    fireEvent.change(screen.getByLabelText('Section heading Optional'), { target: { value: 'Keep these logos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Review the Logos fields.')).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading Optional')).toHaveValue('Keep these logos')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
  })

  it('preserves the Logos picker on cancelled dirty navigation and closes it on discard', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logos' }))
    fireEvent.change(screen.getByLabelText('Section heading Optional'), { target: { value: 'Unsaved Logos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add logo' }))
    expect(await screen.findByRole('button', { name: 'Back to Logos section' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Runtime section selection' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('button', { name: 'Back to Logos section' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Runtime section selection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.queryByRole('button', { name: 'Back to Logos section' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'About' }).parentElement).toHaveAttribute('aria-current', 'true'))
  })

  it('opens a deep-linked Logos section in the draft-native inspector', async () => {
    navigation.search = '?editor=page&pageId=home&sectionId=logos-id'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { level: 2, name: 'Logos' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading Optional')).toHaveValue('Trusted by')
    expect(screen.queryByText(/Save Logos/i)).not.toBeInTheDocument()
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

  it('keeps every Call to Action edit local while updating the shared preview immediately', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Call to Action' }))

    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'A local invitation' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'A local explanation.' } })
    expect(screen.getByTestId('cta-preview')).toHaveTextContent('A local invitation')
    expect(screen.getByTestId('cta-preview')).toHaveTextContent('A local explanation.')
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByTestId('cta-preview')).not.toHaveTextContent('Visit us')
    fireEvent.click(screen.getByRole('button', { name: 'Add a button' }))
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: 'Email us' } })
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    expect(screen.getByTestId('cta-preview')).toHaveAttribute('data-action-type', 'email')
    expect(screen.getByTestId('cta-preview')).toHaveAttribute('data-action-value', '')
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'hello@example.com' } })
    expect(screen.getByTestId('cta-preview')).toHaveTextContent('Email us')
    expect(screen.getByTestId('cta-preview')).toHaveAttribute('data-action-value', 'hello@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByTestId('cta-preview')).not.toHaveTextContent('Email us')
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('saves a complete Call to Action pair once, trims it, and installs the canonical normalized URL', async () => {
    const canonical = structuredClone(baseSite)
    const cta = canonical.pages[0]?.sections.find((section) => section.type === 'cta')
    if (!cta || cta.type !== 'cta') throw new Error('CTA fixture missing')
    cta.content = { heading: 'A saved invitation', body: 'A saved explanation.', buttonLabel: 'Start now', action: { type: 'url', value: 'https://example.com/' } }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Call to Action' }))

    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: '  A saved invitation  ' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: '  A saved explanation.  ' } })
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: '  Start now  ' } })
    fireEvent.change(screen.getByLabelText('Website URL'), { target: { value: '  https://EXAMPLE.com  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'cta-id', {
      heading: 'A saved invitation',
      body: 'A saved explanation.',
      buttonLabel: 'Start now',
      action: { type: 'url', value: 'https://EXAMPLE.com' }
    })
    expect(screen.getByLabelText('Website URL')).toHaveValue('https://example.com/')
    expect(screen.getByTestId('cta-preview')).toHaveAttribute('data-action-value', 'https://example.com/')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/Call to Action saved/i)).not.toBeInTheDocument()
  })

  it('omits the optional Call to Action button pair and blank body after removal', async () => {
    const canonical = structuredClone(baseSite)
    const cta = canonical.pages[0]?.sections.find((section) => section.type === 'cta')
    if (!cta || cta.type !== 'cta') throw new Error('CTA fixture missing')
    cta.content = { heading: 'Ready to order?' }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Call to Action' }))
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    const payload = mocks.updateSectionContent.mock.calls[0]?.[3]
    expect(payload).toEqual({ heading: 'Ready to order?' })
    expect(payload).not.toHaveProperty('body')
    expect(payload).not.toHaveProperty('buttonLabel')
    expect(payload).not.toHaveProperty('action')
  })

  it('blocks an incomplete Call to Action locally, then retains a malformed server-rejected draft for retry', async () => {
    const { ApiError } = await import('../../../lib/api')
    mocks.updateSectionContent.mockRejectedValueOnce(new ApiError(400, { error: 'Enter a valid email address.' })).mockResolvedValueOnce(structuredClone(baseSite))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Call to Action' }))
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Add an email address, or remove the button.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveValue('not-an-email')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'hello@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
  })

  it.each(['Templates', 'Revision History'])('guards dirty Call to Action transitions to %s and preserves same-section reselection', async (destination) => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Call to Action' }))
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'Keep this CTA draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Runtime Call to Action selection' }))
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Heading')).toHaveValue('Keep this CTA draft')
    expect(screen.getByRole('button', { name: 'Hide About' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: destination }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
  })

  it('preserves a dirty Call to Action through Add Section and registers the unload guard', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Call to Action' }))
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'Keep during Add Section' } })
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    expect(screen.getByTestId('cta-preview')).toHaveTextContent('Keep during Add Section')
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    expect(mocks.addSection).not.toHaveBeenCalled()
    unmount()
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('opens a deep-linked Call to Action section in the draft-native inspector', async () => {
    navigation.search = 'editor=page&pageId=home&sectionId=cta-id'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { name: 'Call to Action' })).toBeInTheDocument()
    expect(screen.getByLabelText('Heading')).toHaveValue('Ready to order?')
    expect(screen.getByLabelText('Website URL')).toHaveValue('https://example.com/order')
    expect(screen.queryByRole('button', { name: 'Save Call to Action' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Call to Action' }).parentElement).toHaveAttribute('aria-current', 'true')
  })

  it('keeps every Contact edit local while updating the shared preview immediately', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Contact' }))

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Talk with our team' } })
    fireEvent.change(screen.getByLabelText('Supporting text'), { target: { value: 'Tell us what you need.' } })
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: 'Email us' } })
    expect(screen.getByTestId('contact-preview')).toHaveTextContent('Talk with our team')
    expect(screen.getByTestId('contact-preview')).toHaveTextContent('Tell us what you need.')
    expect(screen.getByTestId('contact-preview')).toHaveTextContent('Lead form preview')

    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    expect(screen.getByTestId('contact-preview')).toHaveAttribute('data-action-type', 'email')
    expect(screen.getByTestId('contact-preview')).toHaveAttribute('data-action-value', '')
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'hello@example.com' } })
    expect(screen.getByTestId('contact-preview')).toHaveTextContent('Email us')
    expect(screen.getByTestId('contact-preview')).toHaveAttribute('data-action-value', 'hello@example.com')
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'leadForm' } })
    expect(screen.getByTestId('contact-preview')).toHaveAttribute('data-action-type', 'leadForm')
    expect(screen.getByTestId('contact-preview')).toHaveAttribute('data-action-value', '')
    expect(screen.getByTestId('contact-preview')).toHaveTextContent('Lead form preview')
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('saves a Contact link once, trims it, and installs the canonical normalized URL', async () => {
    const canonical = structuredClone(baseSite)
    const contact = canonical.pages[0]?.sections.find((section) => section.type === 'contact')
    if (!contact || contact.type !== 'contact') throw new Error('Contact fixture missing')
    contact.content = { title: 'Start a project', text: 'Tell us about it.', buttonLabel: 'Visit us', action: { type: 'url', value: 'https://example.com/contact' } }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Contact' }))

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: '  Start a project  ' } })
    fireEvent.change(screen.getByLabelText('Supporting text'), { target: { value: '  Tell us about it.  ' } })
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: '  Visit us  ' } })
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'url' } })
    fireEvent.change(screen.getByLabelText('Website URL'), { target: { value: '  https://EXAMPLE.com/contact  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'contact-id', {
      title: 'Start a project',
      text: 'Tell us about it.',
      buttonLabel: 'Visit us',
      action: { type: 'url', value: 'https://EXAMPLE.com/contact' }
    })
    expect(screen.getByLabelText('Website URL')).toHaveValue('https://example.com/contact')
    expect(screen.getByTestId('contact-preview')).toHaveAttribute('data-action-value', 'https://example.com/contact')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/Contact saved/i)).not.toBeInTheDocument()
  })

  it('saves Contact leadForm as an exact value-less action and omits blank supporting text', async () => {
    const canonical = structuredClone(baseSite)
    const contact = canonical.pages[0]?.sections.find((section) => section.type === 'contact')
    if (!contact || contact.type !== 'contact') throw new Error('Contact fixture missing')
    contact.content = { title: 'Contact us', buttonLabel: 'Get in touch', action: { type: 'leadForm' } }
    mocks.updateSectionContent.mockResolvedValue(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Contact' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: '  Contact us  ' } })
    fireEvent.change(screen.getByLabelText('Supporting text'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: '  Get in touch  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    const payload = mocks.updateSectionContent.mock.calls[0]?.[3]
    expect(payload).toEqual({ title: 'Contact us', buttonLabel: 'Get in touch', action: { type: 'leadForm' } })
    expect(payload).not.toHaveProperty('text')
    expect(payload.action).not.toHaveProperty('value')
  })

  it('blocks incomplete Contact links locally, then retains a malformed server-rejected draft for retry', async () => {
    const { ApiError } = await import('../../../lib/api')
    mocks.updateSectionContent.mockRejectedValueOnce(new ApiError(400, { error: 'Enter a valid email address.' })).mockResolvedValueOnce(structuredClone(baseSite))
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Contact' }))
    fireEvent.change(screen.getByLabelText('Where it goes'), { target: { value: 'email' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Add an email address.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveValue('not-an-email')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'hello@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
  })

  it.each(['Templates', 'Revision History'])('guards dirty Contact transitions to %s and preserves same-section reselection', async (destination) => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Contact' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Keep this Contact draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Runtime Contact selection' }))
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Keep this Contact draft')
    expect(screen.getByRole('button', { name: 'Hide About' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Site tools' }))
    fireEvent.click(await screen.findByRole('button', { name: destination }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
  })

  it('preserves a dirty Contact draft through Add Section and registers the unload guard', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Contact' }))
    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Keep during Add Section' } })
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    expect(screen.getByTestId('contact-preview')).toHaveTextContent('Keep during Add Section')
    fireEvent.click(screen.getByRole('button', { name: /Gallery.*Choose and arrange/i }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    expect(mocks.addSection).not.toHaveBeenCalled()
    unmount()
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('opens a deep-linked Contact section in the draft-native inspector', async () => {
    navigation.search = 'editor=page&pageId=home&sectionId=contact-id'
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    expect(await screen.findByRole('heading', { name: 'Contact' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Contact us')
    expect(screen.getByLabelText('Where it goes')).toHaveValue('leadForm')
    expect(screen.queryByRole('button', { name: 'Save Contact' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contact' }).parentElement).toHaveAttribute('aria-current', 'true')
  })

  it('opens Business Hours from the canvas, previews local presentation edits, and saves one exact section-only payload', async () => {
    const initial = siteWithBusinessHours()
    const canonical = siteWithBusinessHours()
    const savedSection = canonical.pages[0]!.sections.find((section) => section.type === 'businessHours')
    if (!savedSection || savedSection.type !== 'businessHours') throw new Error('Business Hours fixture missing')
    savedSection.content = { heading: 'Opening times', intro: 'Come by.' }
    mocks.getSite.mockResolvedValue(initial)
    mocks.updateSectionContent.mockResolvedValue(canonical)

    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Runtime Business Hours selection' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Business Hours' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Section heading/)).toHaveValue('Visit the bakery')
    expect(screen.getByText('Shared')).toBeInTheDocument()
    expect(screen.getByText('Monday')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Section heading/), { target: { value: '  Opening times  ' } })
    fireEvent.change(screen.getByLabelText(/Intro/), { target: { value: '  Come by.  ' } })
    expect(screen.getByTestId('business-hours-preview')).toHaveTextContent('Opening times')
    expect(screen.getByTestId('business-hours-preview')).toHaveTextContent('Come by.')
    expect(mocks.updateSectionContent).not.toHaveBeenCalled()
    expect(mocks.updateBusinessHours).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'business-hours-id', { heading: 'Opening times', intro: 'Come by.' })
    expect(mocks.updateBusinessHours).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Section heading/)).toHaveValue('Opening times')
    expect(screen.getByLabelText(/Intro/)).toHaveValue('Come by.')
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByText(/Business Hours saved/i)).not.toBeInTheDocument()
  })

  it('opens a deep-linked Business Hours section directly in the draft-native inspector', async () => {
    navigation.search = '?editor=page&pageId=home&sectionId=business-hours-id'
    mocks.getSite.mockResolvedValue(siteWithBusinessHours())
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)

    expect(await screen.findByRole('heading', { level: 2, name: 'Business Hours' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Section heading/)).toHaveValue('Visit the bakery')
    expect(screen.getByRole('button', { name: 'Business Hours' }).parentElement).toHaveAttribute('aria-current', 'true')
  })

  it('keeps presentation editable without a schedule and omits blank fields from Save', async () => {
    const initial = siteWithBusinessHours(false)
    const canonical = siteWithBusinessHours(false)
    const canonicalSection = canonical.pages[0]!.sections.find((section) => section.type === 'businessHours')
    if (!canonicalSection || canonicalSection.type !== 'businessHours') throw new Error('Business Hours fixture missing')
    canonicalSection.content = {}
    mocks.getSite.mockResolvedValue(initial)
    mocks.updateSectionContent.mockResolvedValue(canonical)

    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Runtime Business Hours selection' }))
    expect(screen.getByRole('note')).toHaveTextContent('No weekly schedule is set yet')
    expect(screen.getByRole('button', { name: 'Edit business hours' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Section heading/), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText(/Intro/), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledOnce())
    expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'business-hours-id', {})
    expect(mocks.updateBusinessHours).not.toHaveBeenCalled()
  })

  it('opens global Business Hours immediately from a clean section inspector', async () => {
    mocks.getSite.mockResolvedValue(siteWithBusinessHours())
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Runtime Business Hours selection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit business hours' }))

    expect(await screen.findByText('Set the weekly schedule used across your site and in search results. Page presentation is managed from each Business Hours section.')).toBeInTheDocument()
    expect(screen.getByLabelText('Monday opening time')).toHaveValue('09:00')
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
  })

  it('guards global Business Hours navigation, preserving on cancel and discarding on confirm', async () => {
    mocks.getSite.mockResolvedValue(siteWithBusinessHours())
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Runtime Business Hours selection' }))
    fireEvent.change(screen.getByLabelText(/Section heading/), { target: { value: 'Unsaved opening times' } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit business hours' }))

    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByLabelText(/Section heading/)).toHaveValue('Unsaved opening times')
    fireEvent.click(screen.getByRole('button', { name: 'Edit business hours' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

    expect(await screen.findByText('Set the weekly schedule used across your site and in search results. Page presentation is managed from each Business Hours section.')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Unsaved opening times')).not.toBeInTheDocument()
  })

  it('retains a rejected Business Hours draft and dirty state for retry', async () => {
    const { ApiError } = await import('../../../lib/api')
    const initial = siteWithBusinessHours()
    const canonical = siteWithBusinessHours()
    const canonicalSection = canonical.pages[0]!.sections.find((section) => section.type === 'businessHours')
    if (!canonicalSection || canonicalSection.type !== 'businessHours') throw new Error('Business Hours fixture missing')
    canonicalSection.content = { heading: 'Saved hours', intro: 'Drop in for something fresh.' }
    mocks.getSite.mockResolvedValue(initial)
    mocks.updateSectionContent.mockRejectedValueOnce(new ApiError(400, { error: 'Review the Business Hours copy.' })).mockResolvedValueOnce(canonical)
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Runtime Business Hours selection' }))
    fireEvent.change(screen.getByLabelText(/Section heading/), { target: { value: 'Saved hours' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Review the Business Hours copy.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Section heading/)).toHaveValue('Saved hours')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
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

  it('consumes runtime page and section selections and opens the About draft-native inspector', async () => {
    render(<BusinessWebsite autoLoad tenantId="tenant-1" />)
    await screen.findByLabelText('Headline')
    fireEvent.click(screen.getByRole('button', { name: 'Runtime page selection' }))
    expect(await screen.findByLabelText('Headline')).toHaveValue('About us')
    expect(navigation.replace).toHaveBeenLastCalledWith('/businesses/tenant-1/website?editor=page&pageId=about&sectionId=about-hero', { scroll: false })
    fireEvent.click(screen.getByRole('button', { name: 'Runtime section selection' }))
    await waitFor(() => expect(navigation.replace).toHaveBeenLastCalledWith('/businesses/tenant-1/website?editor=page&pageId=home&sectionId=about-id', { scroll: false }))
    const inspector = screen.getByRole('region', { name: 'About properties' })
    expect(within(inspector).getByRole('heading', { name: 'About' })).toBeInTheDocument()
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
