import type { SiteDefinition } from '@bakerrang/site-schema'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMedia: vi.fn(), uploadMedia: vi.fn(), upsertHomeProcess: vi.fn(), upsertHomeStats: vi.fn(), upsertHomeCta: vi.fn(), upsertHomeLogos: vi.fn(), upsertHomeAbout: vi.fn()
}))
vi.mock('../../../lib/media', () => ({ getMedia: mocks.getMedia, uploadMedia: mocks.uploadMedia }))
vi.mock('../../../lib/site', () => ({
  upsertHomeProcess: mocks.upsertHomeProcess, upsertHomeStats: mocks.upsertHomeStats, upsertHomeCta: mocks.upsertHomeCta, upsertHomeLogos: mocks.upsertHomeLogos, upsertHomeAbout: mocks.upsertHomeAbout
}))

import { AboutEditor } from '../AboutEditor'
import { CtaEditor } from '../CtaEditor'
import { LogosEditor } from '../LogosEditor'
import { ProcessEditor } from '../ProcessEditor'
import { StatsEditor } from '../StatsEditor'

const theme = { colors: { primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033' }, headingFont: 'inter' as const, bodyFont: 'inter' as const, cornerStyle: 'soft' as const, contentWidth: 'standard' as const, sectionSpacing: 'comfortable' as const }
const media = [
  { id: 'media-a', originalFilename: 'a.png', contentType: 'image/png' as const, sizeBytes: 1, width: 100, height: 50, createdAt: 1, src: 'https://media.test/a.png' },
  { id: 'media-b', originalFilename: 'b.png', contentType: 'image/png' as const, sizeBytes: 1, width: 100, height: 50, createdAt: 2, src: 'https://media.test/b.png' }
]
const definition = (): SiteDefinition => ({ status: 'DRAFT', branding: { siteName: 'Bakery' }, theme, pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
  { id: 'hero', type: 'hero', hidden: false, content: { title: 'Welcome' } },
  { id: 'process-a', type: 'process', hidden: false, content: { heading: 'First steps', intro: 'A intro', items: [{ id: 'process-a-1', title: 'A one', description: 'A description' }] } },
  { id: 'process-b', type: 'process', hidden: false, content: { heading: 'Second steps', intro: 'B intro', items: [{ id: 'process-b-1', title: 'B one', description: 'B description' }, { id: 'process-b-2', title: 'B two' }] } },
  { id: 'stats-a', type: 'stats', hidden: false, content: { heading: 'First highlights', items: [{ id: 'stats-a-1', value: '25+', label: 'Years' }] } },
  { id: 'stats-b', type: 'stats', hidden: false, content: { heading: 'Second highlights', intro: 'Always ready', items: [{ id: 'stats-b-1', value: '24/7', label: 'Support' }, { id: 'stats-b-2', value: '1,200+', label: 'Orders' }, { id: 'stats-b-3', value: 'Same Day', label: 'Service' }] } },
  { id: 'cta-a', type: 'cta', hidden: false, content: { heading: 'First CTA' } },
  { id: 'cta-b', type: 'cta', hidden: false, content: { heading: 'Second CTA', body: 'Call us', buttonLabel: 'Visit', action: { type: 'url', value: 'https://example.com' } } },
  { id: 'logos-a', type: 'logos', hidden: false, content: { heading: 'First logos', items: [{ id: 'logos-a-1', mediaId: 'media-a', altText: 'First logo' }] } },
  { id: 'logos-b', type: 'logos', hidden: false, content: { heading: 'Second logos', items: [{ id: 'logos-b-1', mediaId: 'media-b', altText: 'Second logo' }] } },
  { id: 'about-legacy', type: 'about', hidden: false, content: { heading: 'Our legacy story', body: 'Still here.', imageMediaId: 'media-a', imageAlt: 'Legacy image' } },
  { id: 'about-rich', type: 'about', hidden: false, content: { heading: 'Our new story', body: 'New here.', imageMediaId: 'media-b', imageAlt: 'New image', imagePosition: 'right', buttonLabel: 'Email us', action: { type: 'email', value: 'hello@example.com' } } }
] }] })

const renderEditor = <T extends object>(Editor: React.ComponentType<T>, props: Omit<T, 'site' | 'tenantId' | 'onCancel' | 'onSaved'> & { sectionId: string }, dirty = vi.fn()) => {
  render(<Editor {...props as T} onCancel={() => undefined} onDirtyChange={dirty} onSaved={() => undefined} site={definition()} tenantId="tenant-1" />)
  return dirty
}

describe('expanded section editors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMedia.mockResolvedValue({ media, hasMore: false })
    mocks.uploadMedia.mockResolvedValue({ ...media[1], id: 'media-uploaded' })
    for (const save of [mocks.upsertHomeProcess, mocks.upsertHomeStats, mocks.upsertHomeCta, mocks.upsertHomeLogos, mocks.upsertHomeAbout]) save.mockResolvedValue(definition())
  })

  it('edits the exact repeated Process instance, validates titles, and manages rows without a stored step number', async () => {
    const dirty = renderEditor(ProcessEditor, { sectionId: 'process-b' })
    expect(screen.getByLabelText(/Heading/)).toHaveValue('Second steps')
    expect(screen.getByLabelText(/Intro/)).toHaveValue('B intro')
    expect(screen.getByLabelText('Step 1 title')).toHaveValue('B one')
    expect(screen.queryByLabelText(/step number/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }))
    fireEvent.change(screen.getByLabelText('Step 3 title'), { target: { value: 'B three' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Move step up' })[2])
    fireEvent.click(screen.getAllByRole('button', { name: 'Move step down' })[1])
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete step' })[1])
    await waitFor(() => expect(dirty).toHaveBeenCalledWith(true))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeProcess).toHaveBeenCalledWith('tenant-1', 'process-b', expect.objectContaining({ heading: 'Second steps', intro: 'B intro', items: expect.arrayContaining([expect.objectContaining({ id: 'process-b-1', title: 'B one' }), expect.objectContaining({ title: 'B three' })]) })))
    expect(mocks.upsertHomeProcess.mock.calls[0][2].items[0]).not.toHaveProperty('number')
    cleanup()
    renderEditor(ProcessEditor, { sectionId: 'process-a' })
    fireEvent.change(screen.getByLabelText('Step 1 title'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Every step needs a title')
  })

  it('edits exact Stats values as display strings, validates rows, and supports add/remove/reorder', async () => {
    const dirty = renderEditor(StatsEditor, { sectionId: 'stats-b' })
    expect(screen.getByLabelText('Highlight 1 value')).toHaveValue('24/7')
    expect(screen.getByLabelText('Highlight 2 value')).toHaveValue('1,200+')
    expect(screen.getByLabelText('Highlight 3 value')).toHaveValue('Same Day')
    fireEvent.click(screen.getByRole('button', { name: 'Add highlight' }))
    fireEvent.change(screen.getByLabelText('Highlight 4 value'), { target: { value: '25+' } })
    fireEvent.change(screen.getByLabelText('Highlight 4 label'), { target: { value: 'Years' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Move highlight up' })[3])
    fireEvent.click(screen.getAllByRole('button', { name: 'Move highlight down' })[2])
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete highlight' })[1])
    await waitFor(() => expect(dirty).toHaveBeenCalledWith(true))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeStats).toHaveBeenCalledWith('tenant-1', 'stats-b', expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ value: '24/7' }), expect.objectContaining({ value: 'Same Day' }), expect.objectContaining({ value: '25+' })]) })))
    cleanup()
    renderEditor(StatsEditor, { sectionId: 'stats-a' })
    fireEvent.change(screen.getByLabelText('Highlight 1 label'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Every highlight needs a value and label')
  })

  it('seeds and saves CTA actions by exact id, allows no button, and keeps Lead Form unavailable', async () => {
    renderEditor(CtaEditor, { sectionId: 'cta-b' })
    expect(screen.getByLabelText('Heading')).toHaveValue('Second CTA')
    expect(screen.getByLabelText('Body Optional')).toHaveValue('Call us')
    expect(screen.getByLabelText('Button Label Optional — add both fields to show a button')).toHaveValue('Visit')
    expect(screen.getByLabelText('Action Value')).toHaveValue('https://example.com')
    expect(screen.queryByRole('option', { name: 'Lead Form' })).not.toBeInTheDocument()
    for (const option of ['Email', 'Phone', 'Website URL']) expect(screen.getByRole('option', { name: option })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Action Type'), { target: { value: 'email' } })
    fireEvent.change(screen.getByLabelText('Action Value'), { target: { value: 'hello@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeCta).toHaveBeenCalledWith('tenant-1', 'cta-b', { heading: 'Second CTA', body: 'Call us', buttonLabel: 'Visit', action: { type: 'email', value: 'hello@example.com' } }))
    cleanup()
    renderEditor(CtaEditor, { sectionId: 'cta-a' })
    expect(screen.getByLabelText('Action Value')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeCta).toHaveBeenCalledWith('tenant-1', 'cta-a', { heading: 'First CTA' }))
  })

  it('blocks unpaired CTA buttons and supports phone and URL action selections without inventing a value', () => {
    renderEditor(CtaEditor, { sectionId: 'cta-a' })
    fireEvent.change(screen.getByLabelText('Button Label Optional — add both fields to show a button'), { target: { value: 'Call us' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Button label and action must be provided together')
    fireEvent.change(screen.getByLabelText('Button Label Optional — add both fields to show a button'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Action Type'), { target: { value: 'phone' } })
    fireEvent.change(screen.getByLabelText('Action Value'), { target: { value: '(801) 555-1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Button label and action must be provided together')
    fireEvent.change(screen.getByLabelText('Action Type'), { target: { value: 'url' } })
    expect(screen.getByLabelText('Action Value')).toHaveValue('')
  })

  it('uses the existing Media Library and uploader for the exact Logos instance, validates alt text, and manages rows', async () => {
    const dirty = renderEditor(LogosEditor, { sectionId: 'logos-b' })
    await waitFor(() => expect(mocks.getMedia).toHaveBeenCalledWith('tenant-1'))
    expect(screen.getByLabelText('Heading Optional')).toHaveValue('Second logos')
    fireEvent.click(screen.getAllByRole('button', { name: 'Add logo' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Every logo needs alt text')
    fireEvent.change(screen.getByLabelText('Logo 2 alt text'), { target: { value: 'Added logo' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Move logo up' })[1])
    fireEvent.click(screen.getAllByRole('button', { name: 'Move logo down' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove logo' })[0])
    const file = new File(['image'], 'uploaded.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Choose image'), { target: { files: [file] } })
    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledWith('tenant-1', file))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Add logo' })).toHaveLength(3))
    fireEvent.click(screen.getAllByRole('button', { name: 'Add logo' })[0])
    fireEvent.change(screen.getByLabelText('Logo 2 alt text'), { target: { value: 'Uploaded logo' } })
    await waitFor(() => expect(dirty).toHaveBeenCalledWith(true))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeLogos).toHaveBeenCalledWith('tenant-1', 'logos-b', expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ mediaId: 'media-a', altText: 'Added logo' }), expect.objectContaining({ mediaId: 'media-uploaded', altText: 'Uploaded logo' })]) })))
  })

  it('preserves a legacy About round trip and saves enhanced About actions only to the selected id', async () => {
    const dirty = renderEditor(AboutEditor, { sectionId: 'about-legacy' })
    await waitFor(() => expect(dirty).toHaveBeenCalledWith(false))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeAbout).toHaveBeenCalledWith('tenant-1', 'about-legacy', { heading: 'Our legacy story', body: 'Still here.', imageMediaId: 'media-a', imageAlt: 'Legacy image' }))
    cleanup()
    renderEditor(AboutEditor, { sectionId: 'about-rich' })
    expect(screen.getByLabelText('Image position')).toHaveValue('right')
    expect(screen.getByLabelText('Action Value')).toHaveValue('hello@example.com')
    expect(screen.queryByRole('option', { name: 'Lead Form' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Button Label'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Button label and action must be provided together')
    fireEvent.change(screen.getByLabelText('Button Label'), { target: { value: 'Email us' } })
    fireEvent.change(screen.getByLabelText('Action Type'), { target: { value: 'phone' } })
    fireEvent.change(screen.getByLabelText('Action Value'), { target: { value: '(801) 555-1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeAbout).toHaveBeenCalledWith('tenant-1', 'about-rich', expect.objectContaining({ imagePosition: 'right', buttonLabel: 'Email us', action: { type: 'phone', value: '(801) 555-1234' } })))
    fireEvent.change(screen.getByLabelText('Action Type'), { target: { value: 'url' } })
    fireEvent.change(screen.getByLabelText('Action Value'), { target: { value: 'https://example.com/contact' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsertHomeAbout).toHaveBeenLastCalledWith('tenant-1', 'about-rich', expect.objectContaining({ action: { type: 'url', value: 'https://example.com/contact' } })))
  })
})
