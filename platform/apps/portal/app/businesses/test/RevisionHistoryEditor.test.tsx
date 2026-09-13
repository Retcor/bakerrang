import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api'

const mocks = vi.hoisted(() => ({ getSiteRevisions: vi.fn(), restoreSiteRevision: vi.fn() }))

vi.mock('../../../lib/site', () => ({
  getSiteRevisions: mocks.getSiteRevisions,
  restoreSiteRevision: mocks.restoreSiteRevision
}))

import { RevisionHistoryEditor } from '../RevisionHistoryEditor'

const revisions = [
  { revisionId: 'current', publishedAt: 1735732800000, publishedByUserId: 'opaque-current-user', pageCount: 3, isCurrent: true },
  { revisionId: 'older', publishedAt: 1735646400000, publishedByUserId: 'opaque-older-user', pageCount: 2, isCurrent: false }
]

const canonical: SiteDefinition = {
  status: 'PUBLISHED',
  hasUnpublishedChanges: true,
  branding: { siteName: 'Restored Bakery' },
  theme: { colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' },
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [] }]
}

function renderEditor () {
  const onSaved = vi.fn()
  render(<RevisionHistoryEditor onSaved={onSaved} tenantId="tenant/one" />)
  return { onSaved }
}

describe('RevisionHistoryEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSiteRevisions.mockResolvedValue({ revisions })
  })

  it('loads newest-first server metadata without exposing actor identifiers or unsupported history controls', async () => {
    renderEditor()
    expect(screen.getByText('Loading revision history…')).toBeInTheDocument()
    expect(await screen.findByText('Showing the most recent 10 published revisions.')).toBeInTheDocument()
    const rows = screen.getAllByRole('heading', { level: 3 })
    expect(rows[0]).toHaveTextContent('Jan 1, 2025')
    expect(rows[1]).toHaveTextContent('Dec 31, 2024')
    expect(screen.getByText('3 pages')).toBeInTheDocument()
    expect(screen.getByText('2 pages')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Restore to Working' })).toHaveLength(1)
    expect(screen.queryByText('opaque-current-user')).not.toBeInTheDocument()
    expect(screen.queryByText('opaque-older-user')).not.toBeInTheDocument()
    for (const name of ['Diff', 'Notes', 'Delete', 'Restore & Publish', 'Preview revision', 'Undo']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('retries a failed history load', async () => {
    mocks.getSiteRevisions.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ revisions })
    renderEditor()
    expect(await screen.findByText('Unable to load revision history. Please try again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('2 pages')).toBeInTheDocument()
    expect(mocks.getSiteRevisions).toHaveBeenCalledTimes(2)
  })

  it('requires confirmation and Cancel makes no restore request', async () => {
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Restore to Working' }))
    const dialog = screen.getByRole('dialog', { name: 'Restore this published revision?' })
    expect(dialog).toHaveTextContent('This replaces the current working site with the selected published revision.')
    expect(dialog).toHaveTextContent('Your live site will not change until you Publish Site.')
    expect(dialog).toHaveTextContent('not an undo of every edit')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mocks.restoreSiteRevision).not.toHaveBeenCalled()
  })

  it('sends only tenant and revision identity once and installs the canonical server response', async () => {
    let resolveRestore: ((site: SiteDefinition) => void) | undefined
    mocks.restoreSiteRevision.mockImplementation(() => new Promise<SiteDefinition>((resolve) => { resolveRestore = resolve }))
    const { onSaved } = renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Restore to Working' }))
    const confirm = within(screen.getByRole('dialog', { name: 'Restore this published revision?' })).getByRole('button', { name: 'Restore to Working' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(mocks.restoreSiteRevision).toHaveBeenCalledOnce()
    expect(mocks.restoreSiteRevision).toHaveBeenCalledWith('tenant/one', 'older')
    resolveRestore?.(canonical)
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(canonical, 'Revision restored to the working site. Preview your changes, then Publish Site when ready.', true))
  })

  it('keeps history open on restore failure and refreshes stale history after a pruned 404', async () => {
    mocks.getSiteRevisions.mockResolvedValueOnce({ revisions }).mockResolvedValueOnce({ revisions: [revisions[0]] })
    mocks.restoreSiteRevision.mockRejectedValue(new ApiError(404, { error: 'Published revision not found' }))
    const { onSaved } = renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Restore to Working' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Restore this published revision?' })).getByRole('button', { name: 'Restore to Working' }))
    expect(await screen.findByText('Published revision not found')).toBeInTheDocument()
    await waitFor(() => expect(mocks.getSiteRevisions).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('heading', { name: 'Revision History' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Restore to Working' })).not.toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
