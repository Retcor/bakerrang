import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSiteTemplates: vi.fn(), applySiteTemplate: vi.fn() }))

vi.mock('../../../lib/site', () => ({
  getSiteTemplates: mocks.getSiteTemplates,
  applySiteTemplate: mocks.applySiteTemplate
}))

import { TemplatesEditor } from '../TemplatesEditor'

const templates = [
  { id: 'modern-local-service', version: 1, name: 'Modern Local Service', description: 'A practical local-service website.', tags: ['Local', 'Service'] },
  { id: 'classic-professional', version: 1, name: 'Classic Professional', description: 'A trustworthy professional website.', tags: ['Professional'] },
  { id: 'bold-contractor', version: 1, name: 'Bold Contractor', description: 'A strong contractor website.', tags: ['Contractor'] }
]

function renderEditor () {
  const onSaved = vi.fn()
  render(<TemplatesEditor onSaved={onSaved} tenantId="tenant/one" />)
  return { onSaved }
}

describe('TemplatesEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSiteTemplates.mockResolvedValue(templates)
  })

  it('loads and renders only server metadata as generic cards', async () => {
    renderEditor()
    expect(screen.getByText('Loading templates…')).toBeInTheDocument()
    for (const template of templates) {
      expect(await screen.findByText(template.name)).toBeInTheDocument()
      expect(screen.getByText(template.description)).toBeInTheDocument()
      for (const tag of template.tags) expect(screen.getByText(tag)).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: 'Apply' })).toHaveLength(3)
    expect(screen.queryByText(/Current Template/i)).not.toBeInTheDocument()
    for (const name of ['Create Template', 'Edit Template', 'Delete Template', 'Duplicate Template', 'Save Site as Template']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('retries a failed catalog request', async () => {
    mocks.getSiteTemplates.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(templates)
    renderEditor()
    expect(await screen.findByText('Unable to load templates. Please try again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Modern Local Service')).toBeInTheDocument()
    expect(mocks.getSiteTemplates).toHaveBeenCalledTimes(2)
  })

  it('requires confirmation and cancellation makes no apply request', async () => {
    renderEditor()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Apply' }))[0] as HTMLButtonElement)
    const dialog = screen.getByRole('dialog', { name: 'Apply “Modern Local Service”?' })
    expect(dialog).toHaveTextContent("replaces the current working site's design, header and navigation, footer and navigation, pages, page content and sections, and page-specific SEO")
    expect(dialog).toHaveTextContent('business name, logo, favicon, Business Profile contact details, hours and social links, site-wide SEO settings, Media Library, leads')
    expect(dialog).toHaveTextContent('Existing Custom CSS is preserved and may affect the appearance of the new template.')
    expect(dialog).toHaveTextContent('published live site remains unchanged until you choose Publish Site')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mocks.applySiteTemplate).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Apply “Modern Local Service”?' })).not.toBeInTheDocument()
  })

  it('prevents duplicate confirms and reports apply failures without saving', async () => {
    let rejectRequest: ((error: Error) => void) | undefined
    mocks.applySiteTemplate.mockImplementation(() => new Promise<SiteDefinition>((_resolve, reject) => { rejectRequest = reject }))
    const { onSaved } = renderEditor()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Apply' }))[0] as HTMLButtonElement)
    const confirm = screen.getByRole('button', { name: 'Apply Template' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(mocks.applySiteTemplate).toHaveBeenCalledOnce()
    expect(mocks.applySiteTemplate).toHaveBeenCalledWith('tenant/one', 'modern-local-service')
    rejectRequest?.(new Error('failed'))
    expect(await screen.findByText('Unable to apply this template. Please try again.')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'Apply' })[0]).toBeEnabled()
    expect(screen.queryByText(/applied to the working site/i)).not.toBeInTheDocument()
  })
})
