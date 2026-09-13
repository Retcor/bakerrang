import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addSection: vi.fn(),
  duplicateSection: vi.fn(),
  moveSection: vi.fn(),
  removeSection: vi.fn(),
  setSectionVisibility: vi.fn(),
  updateSectionContent: vi.fn(),
  upsertHomeGallery: vi.fn(),
  updateBusinessHours: vi.fn()
}))

vi.mock('../../../lib/site', () => mocks)

import { BusinessHoursSectionEditor } from '../BusinessHoursSectionEditor'
import { GalleryEditor } from '../GalleryEditor'
import { PageSectionManager } from '../PageSectionManager'
import { AddSectionDialog } from '../AddSectionDialog'

const theme = {
  colors: { primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033' },
  headingFont: 'inter' as const, bodyFont: 'inter' as const, cornerStyle: 'soft' as const,
  contentWidth: 'standard' as const, sectionSpacing: 'comfortable' as const
}
const hours = {
  monday: { open: '09:00', close: '17:00' }, tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' }, thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' }, saturday: { closed: true as const }, sunday: { closed: true as const }
}

const site = (options: { hours?: boolean, contact?: boolean, businessHoursSection?: boolean, oneAbout?: boolean } = {}): SiteDefinition => ({
  status: 'DRAFT',
  branding: { siteName: 'Bakery' },
  theme,
  ...(options.hours ? { businessProfile: { businessHours: hours } } : {}),
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
    { id: 'hero-id', type: 'hero', hidden: false, content: { title: 'Welcome' } },
    { id: 'gallery-a', type: 'gallery', hidden: false, content: { title: 'First gallery', items: [{ id: 'image-a', mediaId: 'media-a', altText: 'Cake' }] } },
    { id: 'gallery-b', type: 'gallery', hidden: true, content: { title: 'Second gallery', items: [{ id: 'image-b', mediaId: 'media-b', altText: 'Bread' }] } },
    { id: 'about-a', type: 'about', hidden: false, content: { heading: 'Our story', body: 'A story.' } },
    ...(options.oneAbout ? [] : [{ id: 'about-b', type: 'about' as const, hidden: false, content: { heading: 'Our team', body: 'A team.' } }]),
    { id: 'services-id', type: 'services', hidden: false, content: { title: 'Services', items: [{ id: 'service-a', name: 'Cakes' }] } },
    { id: 'testimonials-id', type: 'testimonials', hidden: false, content: { title: 'Kind words', items: [{ id: 'quote-a', customerName: 'A', quote: 'Great.' }] } },
    { id: 'faq-id', type: 'faq', hidden: false, content: { heading: 'Questions', items: [{ id: 'question-a', question: 'When?', answer: 'Today.' }] } },
    ...(options.businessHoursSection ? [{ id: 'hours-id', type: 'businessHours' as const, hidden: false, content: { heading: 'Visit', intro: 'Come by.' } }] : []),
    ...(options.contact ? [{ id: 'contact-id', type: 'contact' as const, hidden: false, content: { title: 'Contact us', buttonLabel: 'Email us', action: { type: 'email' as const, value: 'hello@example.com' } } }] : [])
  ] }]
})

const updated = site({ hours: true, contact: true, businessHoursSection: true })
const renderManager = (current = site(), extra: Partial<React.ComponentProps<typeof PageSectionManager>> = {}) => {
  const props = {
    onBack: vi.fn(), onEditSection: vi.fn(), onPreview: vi.fn(), onRefresh: vi.fn().mockResolvedValue(current), onSaved: vi.fn(),
    pageId: 'home', site: current, tenantId: 'tenant-1', ...extra
  }
  return { ...render(<PageSectionManager {...props} />), props }
}

describe('Page section manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.addSection.mockResolvedValue({ site: updated, sectionId: 'new-gallery' })
    mocks.duplicateSection.mockResolvedValue({ site: updated, sectionId: 'gallery-copy' })
    mocks.moveSection.mockResolvedValue(updated)
    mocks.removeSection.mockResolvedValue(updated)
    mocks.setSectionVisibility.mockResolvedValue(updated)
    mocks.updateSectionContent.mockResolvedValue(updated)
  })

  it('renders exact ordered instances, repeated ordinals, summaries, and visibility', () => {
    renderManager()
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(8)
    expect(cards.map((card) => within(card).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Hero', 'Gallery', 'Gallery', 'About', 'About', 'Services', 'Testimonials', 'FAQ'
    ])
    expect(screen.getByRole('button', { name: 'Edit Gallery 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Gallery 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit About 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit About 2' })).toBeInTheDocument()
    expect(within(cards[1]).getByText('Visible')).toBeInTheDocument()
    expect(within(cards[2]).getByText('Hidden')).toBeInTheDocument()
    expect(within(cards[1]).getByText('1 image')).toBeInTheDocument()
    expect(within(cards[0]).getByText('Pinned')).toBeInTheDocument()
  })

  it('routes editing by exact section id, including the second repeated gallery', () => {
    const { props } = renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Gallery 2' }))
    expect(props.onEditSection).toHaveBeenCalledWith('gallery-b')
    expect(screen.getByRole('button', { name: 'Edit Gallery 1' })).toBeInTheDocument()
  })

  it('uses the selected non-Home page and sends every section command to that page', async () => {
    const current = site()
    current.pages.push({ id: 'contact-page', slug: 'contact', title: 'Contact', sections: [
      { id: 'contact-gallery', type: 'gallery', hidden: false, content: { title: 'Visit us', items: [] } },
      { id: 'contact-gallery-two', type: 'gallery', hidden: false, content: { title: 'More visits', items: [] } }
    ] })
    const { props } = renderManager(current, { pageId: 'contact-page' })
    expect(screen.getByRole('heading', { name: 'Contact sections' })).toBeInTheDocument()
    expect(screen.getByText('/contact')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Gallery 2 up' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Move Gallery 2 up' }))
    await waitFor(() => expect(mocks.moveSection).toHaveBeenCalledWith('tenant-1', 'contact-page', 'contact-gallery-two', 'up'))
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 1 actions' })).getByRole('button', { name: 'Hide' }))
    await waitFor(() => expect(mocks.setSectionVisibility).toHaveBeenCalledWith('tenant-1', 'contact-page', 'contact-gallery', true))
    expect(props.onEditSection).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Gallery 1' }))
    expect(props.onEditSection).toHaveBeenCalledWith('contact-gallery')
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 1 actions' })).getByRole('button', { name: 'Duplicate' }))
    await waitFor(() => expect(mocks.duplicateSection).toHaveBeenCalledWith('tenant-1', 'contact-page', 'contact-gallery'))
    expect(props.onEditSection).toHaveBeenCalledWith('gallery-copy')
  })

  it('keeps empty non-Home pages isolated and applies singleton availability to that page only', async () => {
    const current = site({ hours: true, contact: true, businessHoursSection: true })
    current.pages.push(
      { id: 'page-a', slug: 'services', title: 'Services', sections: [{ id: 'page-a-contact', type: 'contact', hidden: false, content: { title: 'Talk', buttonLabel: 'Email', action: { type: 'email', value: 'a@example.com' } } }] },
      { id: 'page-b', slug: 'contact', title: 'Contact', sections: [] }
    )
    const { props } = renderManager(current, { pageId: 'page-b' })
    expect(screen.getByRole('heading', { name: 'Contact sections' })).toBeInTheDocument()
    expect(screen.getByText('No sections yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    const dialog = screen.getByRole('dialog', { name: 'Add section' })
    expect(within(dialog).queryByText('Hero')).not.toBeInTheDocument()
    const contactCard = within(dialog).getByText('Contact').closest('div.rounded-md') as HTMLElement
    const hoursCard = within(dialog).getByText('Business Hours').closest('div.rounded-md') as HTMLElement
    expect(within(contactCard).getByRole('button', { name: 'Add' })).toBeEnabled()
    expect(within(hoursCard).getByRole('button', { name: 'Add' })).toBeEnabled()
    fireEvent.click(within(contactCard).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(mocks.addSection).toHaveBeenCalledWith('tenant-1', 'page-b', 'contact'))
    expect(props.onEditSection).toHaveBeenCalledWith('new-gallery')

    current.pages.find((page) => page.id === 'page-b')?.sections.push(
      { id: 'page-b-contact', type: 'contact', hidden: false, content: { title: 'Talk', buttonLabel: 'Email', action: { type: 'email', value: 'b@example.com' } } },
      { id: 'page-b-hours', type: 'businessHours', hidden: false, content: { heading: 'Hours' } }
    )
    const { rerender } = render(<AddSectionDialog onAdded={() => undefined} onClose={() => undefined} onRefresh={vi.fn()} open pageId="page-b" site={current} tenantId="tenant-1" />)
    const pageBDialog = screen.getByRole('dialog', { name: 'Add section' })
    expect(within(within(pageBDialog).getByText('Contact').closest('div.rounded-md') as HTMLElement).getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(within(within(pageBDialog).getByText('Business Hours').closest('div.rounded-md') as HTMLElement).getByRole('button', { name: 'Add' })).toBeDisabled()
    const pageC = structuredClone(current)
    pageC.pages.push({ id: 'page-c', slug: 'faq', title: 'FAQ', sections: [] })
    rerender(<AddSectionDialog onAdded={() => undefined} onClose={() => undefined} onRefresh={vi.fn()} open pageId="page-c" site={pageC} tenantId="tenant-1" />)
    const pageCDialog = screen.getByRole('dialog', { name: 'Add section' })
    expect(within(within(pageCDialog).getByText('Contact').closest('div.rounded-md') as HTMLElement).getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('summarizes and independently addresses every new repeatable section type', () => {
    const current = site()
    const home = current.pages[0]
    home.sections.push(
      { id: 'process-a', type: 'process', hidden: false, content: { heading: 'Steps one', items: [{ id: 'step-a', title: 'Choose' }] } },
      { id: 'process-b', type: 'process', hidden: false, content: { heading: 'Steps two', items: [{ id: 'step-b', title: 'Choose' }, { id: 'step-c', title: 'Book' }] } },
      { id: 'stats-a', type: 'stats', hidden: false, content: { items: [{ id: 'stat-a', value: '25+', label: 'Years' }] } },
      { id: 'stats-b', type: 'stats', hidden: false, content: { items: [{ id: 'stat-b', value: '24/7', label: 'Support' }, { id: 'stat-c', value: '1,200+', label: 'Orders' }] } },
      { id: 'cta-a', type: 'cta', hidden: false, content: { heading: 'Talk to us' } },
      { id: 'cta-b', type: 'cta', hidden: false, content: { heading: '' } },
      { id: 'logos-a', type: 'logos', hidden: false, content: { items: [] } },
      { id: 'logos-b', type: 'logos', hidden: false, content: { items: [{ id: 'logo-a', mediaId: 'media-a', altText: 'Partner' }, { id: 'logo-b', mediaId: 'media-b', altText: 'Sponsor' }] } }
    )
    const { props } = renderManager(current)
    for (const summary of ['1 step', '2 steps', '1 highlight', '2 highlights', 'Talk to us', 'Call to action', 'No logos yet', '2 logos']) expect(screen.getByText(summary)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Steps 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Logos 2' }))
    expect(props.onEditSection).toHaveBeenNthCalledWith(1, 'process-b')
    expect(props.onEditSection).toHaveBeenNthCalledWith(2, 'logos-b')
  })

  it('keeps Hero pinned and removes its composition/destructive controls', () => {
    renderManager()
    const hero = screen.getAllByRole('listitem')[0]
    expect(within(hero).getByRole('button', { name: 'Edit Hero' })).toBeEnabled()
    expect(within(hero).queryByRole('button', { name: /Move Hero/ })).not.toBeInTheDocument()
    expect(within(hero).queryByRole('button', { name: /More actions/ })).not.toBeInTheDocument()
    expect(within(hero).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
  })

  it('moves exact instances and disables only the true list boundaries', async () => {
    const { props } = renderManager()
    expect(screen.getByRole('button', { name: 'Move Gallery 1 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move FAQ down' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Move Gallery 2 up' }))
    await waitFor(() => expect(mocks.moveSection).toHaveBeenCalledWith('tenant-1', 'home', 'gallery-b', 'up'))
    await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(updated, 'Section order updated.'))
    fireEvent.click(screen.getByRole('button', { name: 'Move Gallery 1 down' }))
    await waitFor(() => expect(mocks.moveSection).toHaveBeenCalledWith('tenant-1', 'home', 'gallery-a', 'down'))
  })

  it('hides and shows an exact section while retaining the card', async () => {
    const { props } = renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    const dialog = screen.getByRole('dialog', { name: 'Gallery 1 actions' })
    expect(dialog).not.toHaveAttribute('role', 'menu')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hide' }))
    await waitFor(() => expect(mocks.setSectionVisibility).toHaveBeenCalledWith('tenant-1', 'home', 'gallery-a', true))
    expect(props.onSaved).toHaveBeenCalledWith(updated, 'Section hidden.')
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 2' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 2 actions' })).getByRole('button', { name: 'Show' }))
    await waitFor(() => expect(mocks.setSectionVisibility).toHaveBeenCalledWith('tenant-1', 'home', 'gallery-b', false))
  })

  it('duplicates through the server-returned id and opens that exact editor', async () => {
    const { props } = renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 1 actions' })).getByRole('button', { name: 'Duplicate' }))
    await waitFor(() => expect(mocks.duplicateSection).toHaveBeenCalledWith('tenant-1', 'home', 'gallery-a'))
    expect(props.onSaved).toHaveBeenCalledWith(updated, 'Section duplicated.')
    expect(props.onEditSection).toHaveBeenCalledWith('gallery-copy')
  })

  it('prevents a second duplicate request while the first is pending', async () => {
    let resolve: (value: { site: SiteDefinition, sectionId: string }) => void = () => undefined
    mocks.duplicateSection.mockReturnValue(new Promise((done) => { resolve = done }))
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 1 actions' })).getByRole('button', { name: 'Duplicate' }))
    expect(mocks.duplicateSection).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'More actions for Gallery 2' })).toBeDisabled()
    resolve({ site: updated, sectionId: 'gallery-copy' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions for Gallery 2' })).toBeEnabled())
  })

  it('confirms deletion, preserves media wording, and preserves the weekly schedule for Business Hours', async () => {
    const { props } = renderManager(site({ hours: true, contact: true, businessHoursSection: true }))
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 1 actions' })).getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete section?' })).toHaveTextContent('uploaded media')
    fireEvent.click(screen.getByRole('button', { name: 'Delete section' }))
    await waitFor(() => expect(mocks.removeSection).toHaveBeenCalledWith('tenant-1', 'home', 'gallery-a'))
    expect(props.onSaved).toHaveBeenCalledWith(updated, 'Section removed.')
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Contact' }))
    expect(within(screen.getByRole('dialog', { name: 'Contact actions' })).queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Contact actions' }), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Business Hours' }))
    const hoursActions = screen.getByRole('dialog', { name: 'Business Hours actions' })
    expect(within(hoursActions).queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument()
    fireEvent.click(within(hoursActions).getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete section?' })).toHaveTextContent('keeps the global weekly schedule')
  })

  it('prevents a second delete submit while the first deletion is pending', async () => {
    let resolve: (value: SiteDefinition) => void = () => undefined
    mocks.removeSection.mockReturnValue(new Promise((done) => { resolve = done }))
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 1 actions' })).getByRole('button', { name: 'Delete' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete section?' })
    const deleteButton = within(confirm).getByRole('button', { name: 'Delete section' })
    fireEvent.click(deleteButton)
    fireEvent.click(deleteButton)
    expect(mocks.removeSection).toHaveBeenCalledTimes(1)
    resolve(updated)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete section?' })).not.toBeInTheDocument())
  })

  it('opens and constrains the Add dialog based on section policy and schedule setup', () => {
    renderManager(site({ hours: true, contact: true, businessHoursSection: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    const dialog = screen.getByRole('dialog', { name: 'Add section' })
    expect(within(dialog).getAllByRole('button', { name: 'Add' })).toHaveLength(12)
    for (const group of ['Core', 'Content', 'Media', 'Trust', 'Conversion', 'Business']) expect(within(dialog).getByText(group)).toBeInTheDocument()
    expect(within(dialog).getAllByText('Already added').length).toBeGreaterThan(1)
    expect(within(dialog).getAllByRole('button', { name: 'Add' })[0]).toBeDisabled()
    expect(within(dialog).getAllByRole('button', { name: 'Add' })[1]).toBeEnabled()
    expect(within(dialog).getByText(/Business Hours/).closest('div')!).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Add section' })).not.toBeInTheDocument()
  })

  it('keeps singleton and schedule rules correct while allowing every repeatable type', () => {
    const onAdded = vi.fn(); const onClose = vi.fn(); const onRefresh = vi.fn().mockResolvedValue(site())
    const { rerender } = render(<AddSectionDialog onAdded={onAdded} onClose={onClose} onRefresh={onRefresh} open pageId="home" site={site({ oneAbout: true })} tenantId="tenant-1" />)
    const dialog = screen.getByRole('dialog', { name: 'Add section' })
    let buttons = within(dialog).getAllByRole('button', { name: 'Add' })
    expect(buttons[0]).toBeDisabled()
    expect(buttons.slice(1, 11).every((button) => !button.hasAttribute('disabled'))).toBe(true)
    expect(buttons[11]).toBeDisabled()
    rerender(<AddSectionDialog onAdded={onAdded} onClose={onClose} onRefresh={onRefresh} open pageId="home" site={site({ hours: true })} tenantId="tenant-1" />)
    buttons = within(screen.getByRole('dialog', { name: 'Add section' })).getAllByRole('button', { name: 'Add' })
    expect(buttons[11]).toBeEnabled()
    rerender(<AddSectionDialog onAdded={onAdded} onClose={onClose} onRefresh={onRefresh} open pageId="home" site={site({ hours: true, contact: true, businessHoursSection: true })} tenantId="tenant-1" />)
    buttons = within(screen.getByRole('dialog', { name: 'Add section' })).getAllByRole('button', { name: 'Add' })
    expect(buttons[9]).toBeDisabled()
    expect(buttons[11]).toBeDisabled()
  })

  it('keeps every new type addable after an instance already exists', () => {
    const current = site()
    current.pages[0].sections.push(
      { id: 'process-id', type: 'process', hidden: false, content: { items: [] } },
      { id: 'stats-id', type: 'stats', hidden: false, content: { items: [] } },
      { id: 'cta-id', type: 'cta', hidden: false, content: { heading: 'Ready?' } },
      { id: 'logos-id', type: 'logos', hidden: false, content: { items: [] } }
    )
    render(<AddSectionDialog onAdded={() => undefined} onClose={() => undefined} onRefresh={vi.fn()} open pageId="home" site={current} tenantId="tenant-1" />)
    for (const label of ['Steps', 'Highlights', 'Call to Action', 'Logos']) {
      const card = screen.getByText(label).closest('div.rounded-md')
      expect(card).not.toBeNull()
      expect(within(card as HTMLElement).getByRole('button', { name: 'Add' })).toBeEnabled()
    }
  })

  it('leaves the Add chooser usable after a failed add', async () => {
    mocks.addSection.mockRejectedValueOnce(new Error('temporary failure'))
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    const dialog = screen.getByRole('dialog', { name: 'Add section' })
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Add' })[3])
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to add this section'))
    expect(within(dialog).getAllByRole('button', { name: 'Add' })[3]).toBeEnabled()
  })

  it('adds a section and uses the server-returned id, without allowing duplicate submits', async () => {
    let resolve: (value: { site: SiteDefinition, sectionId: string }) => void = () => undefined
    mocks.addSection.mockReturnValue(new Promise((done) => { resolve = done }))
    const { props } = renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    const dialog = screen.getByRole('dialog', { name: 'Add section' })
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Add' })[1])
    expect(within(dialog).getAllByRole('button', { name: 'Adding…' })).toHaveLength(1)
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Adding…' })[0])
    expect(mocks.addSection).toHaveBeenCalledTimes(1)
    resolve({ site: updated, sectionId: 'server-gallery-id' })
    await waitFor(() => expect(props.onEditSection).toHaveBeenCalledWith('server-gallery-id'))
    expect(props.onSaved).toHaveBeenCalledWith(updated, 'Section added.')
  })
})

describe('section editor identity and Business Hours presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateSectionContent.mockResolvedValue(updated)
  })

  it('edits the selected repeated gallery and writes its exact id', async () => {
    render(<GalleryEditor onCancel={() => undefined} onSaved={() => undefined} pageId="home" site={site()} tenantId="tenant-1" sectionId="gallery-b" />)
    fireEvent.change(screen.getByLabelText('Section Heading'), { target: { value: 'Second gallery updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'gallery-b', expect.objectContaining({ title: 'Second gallery updated' })))
  })

  it('updates only Business Hours presentation content and leaves Site setup ownership intact', async () => {
    const onSaved = vi.fn()
    render(<BusinessHoursSectionEditor onCancel={() => undefined} onSaved={onSaved} pageId="home" site={site({ hours: true, businessHoursSection: true })} tenantId="tenant-1" sectionId="hours-id" />)
    fireEvent.change(screen.getByLabelText('Section heading Optional'), { target: { value: 'Opening times' } })
    fireEvent.change(screen.getByLabelText('Intro Optional'), { target: { value: 'Drop in.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'hours-id', { heading: 'Opening times', intro: 'Drop in.' }))
    expect(mocks.updateBusinessHours).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith(updated)
    expect(screen.getByText(/Weekly hours are managed in Site setup/i)).toBeInTheDocument()
  })

  it('fails closed for a stale or wrong-type section id', () => {
    render(<BusinessHoursSectionEditor onCancel={() => undefined} onSaved={() => undefined} pageId="home" site={site({ hours: true })} tenantId="tenant-1" sectionId="gallery-a" />)
    expect(screen.getByRole('alert')).toHaveTextContent('selected Business Hours section is unavailable')
  })
})
