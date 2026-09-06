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
import { HomepageSectionManager } from '../HomepageSectionManager'
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
const renderManager = (current = site(), extra: Partial<React.ComponentProps<typeof HomepageSectionManager>> = {}) => {
  const props = {
    onBack: vi.fn(), onEditSection: vi.fn(), onRefresh: vi.fn().mockResolvedValue(current), onSaved: vi.fn(),
    site: current, tenantId: 'tenant-1', ...extra
  }
  return { ...render(<HomepageSectionManager {...props} />), props }
}

describe('Homepage section manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.addSection.mockResolvedValue({ site: updated, sectionId: 'new-gallery' })
    mocks.duplicateSection.mockResolvedValue({ site: updated, sectionId: 'gallery-copy' })
    mocks.moveSection.mockResolvedValue(updated)
    mocks.removeSection.mockResolvedValue(updated)
    mocks.setSectionVisibility.mockResolvedValue(updated)
    mocks.updateSectionContent.mockResolvedValue(updated)
    mocks.upsertHomeGallery.mockResolvedValue(updated)
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
    await waitFor(() => expect(mocks.moveSection).toHaveBeenCalledWith('tenant-1', 'gallery-b', 'up'))
    await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(updated, 'Section order updated.'))
    fireEvent.click(screen.getByRole('button', { name: 'Move Gallery 1 down' }))
    await waitFor(() => expect(mocks.moveSection).toHaveBeenCalledWith('tenant-1', 'gallery-a', 'down'))
  })

  it('hides and shows an exact section while retaining the card', async () => {
    const { props } = renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    const dialog = screen.getByRole('dialog', { name: 'Gallery 1 actions' })
    expect(dialog).not.toHaveAttribute('role', 'menu')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hide' }))
    await waitFor(() => expect(mocks.setSectionVisibility).toHaveBeenCalledWith('tenant-1', 'gallery-a', true))
    expect(props.onSaved).toHaveBeenCalledWith(updated, 'Section hidden.')
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 2' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 2 actions' })).getByRole('button', { name: 'Show' }))
    await waitFor(() => expect(mocks.setSectionVisibility).toHaveBeenCalledWith('tenant-1', 'gallery-b', false))
  })

  it('duplicates through the server-returned id and opens that exact editor', async () => {
    const { props } = renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 1 actions' })).getByRole('button', { name: 'Duplicate' }))
    await waitFor(() => expect(mocks.duplicateSection).toHaveBeenCalledWith('tenant-1', 'gallery-a'))
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
    expect(screen.getByRole('dialog', { name: 'Delete homepage section?' })).toHaveTextContent('uploaded media')
    fireEvent.click(screen.getByRole('button', { name: 'Delete section' }))
    await waitFor(() => expect(mocks.removeSection).toHaveBeenCalledWith('tenant-1', 'gallery-a'))
    expect(props.onSaved).toHaveBeenCalledWith(updated, 'Homepage section removed.')
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Contact' }))
    expect(within(screen.getByRole('dialog', { name: 'Contact actions' })).queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Contact actions' }), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Business Hours' }))
    const hoursActions = screen.getByRole('dialog', { name: 'Business Hours actions' })
    expect(within(hoursActions).queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument()
    fireEvent.click(within(hoursActions).getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete homepage section?' })).toHaveTextContent('keeps the weekly schedule')
  })

  it('prevents a second delete submit while the first deletion is pending', async () => {
    let resolve: (value: SiteDefinition) => void = () => undefined
    mocks.removeSection.mockReturnValue(new Promise((done) => { resolve = done }))
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Gallery 1' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gallery 1 actions' })).getByRole('button', { name: 'Delete' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete homepage section?' })
    const deleteButton = within(confirm).getByRole('button', { name: 'Delete section' })
    fireEvent.click(deleteButton)
    fireEvent.click(deleteButton)
    expect(mocks.removeSection).toHaveBeenCalledTimes(1)
    resolve(updated)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete homepage section?' })).not.toBeInTheDocument())
  })

  it('opens and constrains the Add dialog based on section policy and schedule setup', () => {
    renderManager(site({ hours: true, contact: true, businessHoursSection: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    const dialog = screen.getByRole('dialog', { name: 'Add homepage section' })
    expect(within(dialog).getAllByRole('button', { name: 'Add' })).toHaveLength(12)
    for (const group of ['Core', 'Content', 'Media', 'Trust', 'Conversion', 'Business']) expect(within(dialog).getByText(group)).toBeInTheDocument()
    expect(within(dialog).getAllByText('Already added').length).toBeGreaterThan(1)
    expect(within(dialog).getAllByRole('button', { name: 'Add' })[0]).toBeDisabled()
    expect(within(dialog).getAllByRole('button', { name: 'Add' })[1]).toBeEnabled()
    expect(within(dialog).getByText(/Business Hours/).closest('div')!).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Add homepage section' })).not.toBeInTheDocument()
  })

  it('keeps singleton and schedule rules correct while allowing every repeatable type', () => {
    const onAdded = vi.fn(); const onClose = vi.fn(); const onRefresh = vi.fn().mockResolvedValue(site())
    const { rerender } = render(<AddSectionDialog onAdded={onAdded} onClose={onClose} onRefresh={onRefresh} open site={site({ oneAbout: true })} tenantId="tenant-1" />)
    const dialog = screen.getByRole('dialog', { name: 'Add homepage section' })
    let buttons = within(dialog).getAllByRole('button', { name: 'Add' })
    expect(buttons[0]).toBeDisabled()
    expect(buttons.slice(1, 11).every((button) => !button.hasAttribute('disabled'))).toBe(true)
    expect(buttons[11]).toBeDisabled()
    rerender(<AddSectionDialog onAdded={onAdded} onClose={onClose} onRefresh={onRefresh} open site={site({ hours: true })} tenantId="tenant-1" />)
    buttons = within(screen.getByRole('dialog', { name: 'Add homepage section' })).getAllByRole('button', { name: 'Add' })
    expect(buttons[11]).toBeEnabled()
    rerender(<AddSectionDialog onAdded={onAdded} onClose={onClose} onRefresh={onRefresh} open site={site({ hours: true, contact: true, businessHoursSection: true })} tenantId="tenant-1" />)
    buttons = within(screen.getByRole('dialog', { name: 'Add homepage section' })).getAllByRole('button', { name: 'Add' })
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
    render(<AddSectionDialog onAdded={() => undefined} onClose={() => undefined} onRefresh={vi.fn()} open site={current} tenantId="tenant-1" />)
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
    const dialog = screen.getByRole('dialog', { name: 'Add homepage section' })
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Add' })[3])
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to add this section'))
    expect(within(dialog).getAllByRole('button', { name: 'Add' })[3]).toBeEnabled()
  })

  it('adds a section and uses the server-returned id, without allowing duplicate submits', async () => {
    let resolve: (value: { site: SiteDefinition, sectionId: string }) => void = () => undefined
    mocks.addSection.mockReturnValue(new Promise((done) => { resolve = done }))
    const { props } = renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    const dialog = screen.getByRole('dialog', { name: 'Add homepage section' })
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
    render(<GalleryEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" sectionId="gallery-b" />)
    fireEvent.change(screen.getByLabelText('Section Heading'), { target: { value: 'Second gallery updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeGallery).toHaveBeenCalledWith('tenant-1', 'gallery-b', expect.objectContaining({ title: 'Second gallery updated' })))
  })

  it('updates only Business Hours presentation content and leaves Site setup ownership intact', async () => {
    const onSaved = vi.fn()
    render(<BusinessHoursSectionEditor onCancel={() => undefined} onSaved={onSaved} site={site({ hours: true, businessHoursSection: true })} tenantId="tenant-1" sectionId="hours-id" />)
    fireEvent.change(screen.getByLabelText('Section heading Optional'), { target: { value: 'Opening times' } })
    fireEvent.change(screen.getByLabelText('Intro Optional'), { target: { value: 'Drop in.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'hours-id', { heading: 'Opening times', intro: 'Drop in.' }))
    expect(mocks.updateBusinessHours).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith(updated)
    expect(screen.getByText(/Weekly hours are managed in Site setup/i)).toBeInTheDocument()
  })

  it('fails closed for a stale or wrong-type section id', () => {
    render(<BusinessHoursSectionEditor onCancel={() => undefined} onSaved={() => undefined} site={site({ hours: true })} tenantId="tenant-1" sectionId="gallery-a" />)
    expect(screen.getByRole('alert')).toHaveTextContent('selected Business Hours section is unavailable')
  })
})
