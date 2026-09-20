import type { SiteDefinition } from '@bakerrang/site-schema'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateSectionContent: vi.fn()
}))
vi.mock('../../../lib/site', () => ({
  updateSectionContent: mocks.updateSectionContent
}))

import { ProcessEditor } from '../ProcessEditor'
import { StatsEditor } from '../StatsEditor'

const theme = { colors: { primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033' }, headingFont: 'inter' as const, bodyFont: 'inter' as const, cornerStyle: 'soft' as const, contentWidth: 'standard' as const, sectionSpacing: 'comfortable' as const }
const definition = (): SiteDefinition => ({ status: 'DRAFT', branding: { siteName: 'Bakery' }, theme, pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
  { id: 'hero', type: 'hero', hidden: false, content: { title: 'Welcome' } },
  { id: 'process-a', type: 'process', hidden: false, content: { heading: 'First steps', intro: 'A intro', items: [{ id: 'process-a-1', title: 'A one', description: 'A description' }] } },
  { id: 'process-b', type: 'process', hidden: false, content: { heading: 'Second steps', intro: 'B intro', items: [{ id: 'process-b-1', title: 'B one', description: 'B description' }, { id: 'process-b-2', title: 'B two' }] } },
  { id: 'stats-a', type: 'stats', hidden: false, content: { heading: 'First highlights', items: [{ id: 'stats-a-1', value: '25+', label: 'Years' }] } },
  { id: 'stats-b', type: 'stats', hidden: false, content: { heading: 'Second highlights', intro: 'Always ready', items: [{ id: 'stats-b-1', value: '24/7', label: 'Support' }, { id: 'stats-b-2', value: '1,200+', label: 'Orders' }, { id: 'stats-b-3', value: 'Same Day', label: 'Service' }] } }
] }] })

const renderEditor = <T extends object>(Editor: React.ComponentType<T>, props: Omit<T, 'pageId' | 'site' | 'tenantId' | 'onCancel' | 'onSaved'> & { sectionId: string }, dirty = vi.fn()) => {
  render(<Editor {...({ pageId: 'home', ...props } as T)} onCancel={() => undefined} onDirtyChange={dirty} onSaved={() => undefined} site={definition()} tenantId="tenant-1" />)
  return dirty
}

describe('expanded section editors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateSectionContent.mockResolvedValue(definition())
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
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'process-b', expect.objectContaining({ heading: 'Second steps', intro: 'B intro' })))
    expect(mocks.updateSectionContent.mock.calls[0][3].items[0]).not.toHaveProperty('number')
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
    await waitFor(() => expect(mocks.updateSectionContent).toHaveBeenCalledWith('tenant-1', 'home', 'stats-b', expect.any(Object)))
    cleanup()
    renderEditor(StatsEditor, { sectionId: 'stats-a' })
    fireEvent.change(screen.getByLabelText('Highlight 1 label'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Every highlight needs a value and label')
  })

})
