import type { SiteDefinition } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api'

const mocks = vi.hoisted(() => ({ getSiteRevision: vi.fn(), getSiteRevisions: vi.fn(), restoreSiteRevision: vi.fn() }))
vi.mock('../../../lib/site', () => ({ getSiteRevision: mocks.getSiteRevision, getSiteRevisions: mocks.getSiteRevisions, restoreSiteRevision: mocks.restoreSiteRevision }))
import { RevisionHistoryEditor } from '../RevisionHistoryEditor'

const revisions = [
  { revisionId: 'current', publishedAt: 1735732800000, publishedByUserId: 'opaque-current-user', pageCount: 3, isCurrent: true },
  { revisionId: 'older', publishedAt: 1735646400000, publishedByUserId: 'opaque-older-user', pageCount: 2, isCurrent: false }
]
const snapshot: SiteDefinition = { status: 'PUBLISHED', branding: { siteName: 'Snapshot Bakery' }, theme: { colors: { primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033' }, headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable' }, scopedCustomCss: '[data-br-site]{color:red}', pages: [{ id: 'home', slug: '/', title: 'Home', sections: [{ id: 'hero', type: 'hero', hidden: false, content: { title: 'Snapshot hero' } }] }] }
const restored: SiteDefinition = { ...snapshot, hasUnpublishedChanges: true }

function renderEditor () { const onSaved = vi.fn(); render(<RevisionHistoryEditor onBack={vi.fn()} onSaved={onSaved} tenantId="tenant/one" />); return { onSaved } }
const olderButton = () => screen.getByText('2 pages').closest('button') as HTMLButtonElement

describe('RevisionHistoryEditor', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getSiteRevisions.mockResolvedValue({ revisions }); mocks.getSiteRevision.mockResolvedValue(snapshot) })

  it('lists newest-first safe metadata and loads the selected read-only snapshot', async () => {
    renderEditor()
    expect(await screen.findByTitle('Revision snapshot preview')).toBeInTheDocument()
    expect(screen.getByText('Snapshot')).toBeInTheDocument()
    expect(screen.getByText(/Read-only/)).toBeInTheDocument()
    expect(screen.getByTitle('Revision snapshot preview')).toBeInTheDocument()
    expect(mocks.getSiteRevision).toHaveBeenCalledWith('tenant/one', 'current')
    expect(screen.queryByText('opaque-current-user')).not.toBeInTheDocument()
    expect(screen.queryByText('opaque-older-user')).not.toBeInTheDocument()
    expect(screen.queryByText(/sections/)).not.toBeInTheDocument()
  })

  it('selects a snapshot without mutation, then restores only after confirmation', async () => {
    mocks.restoreSiteRevision.mockResolvedValue(restored)
    const { onSaved } = renderEditor()
    await screen.findByTitle('Revision snapshot preview')
    fireEvent.click(olderButton())
    await waitFor(() => expect(mocks.getSiteRevision).toHaveBeenCalledWith('tenant/one', 'older'))
    expect(mocks.restoreSiteRevision).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))
    const dialog = screen.getByRole('dialog', { name: 'Restore this published revision?' })
    expect(dialog).toHaveTextContent('does not change the live site, the publication record, or revision history')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore to Working' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(restored))
    expect(mocks.restoreSiteRevision).toHaveBeenCalledWith('tenant/one', 'older')
  })

  it('refreshes history and clears the snapshot when a selected revision was pruned', async () => {
    mocks.getSiteRevisions.mockResolvedValueOnce({ revisions }).mockResolvedValueOnce({ revisions: [revisions[0]] })
    mocks.getSiteRevision.mockResolvedValueOnce(snapshot).mockRejectedValueOnce(new ApiError(404, { error: 'not found' }))
    renderEditor()
    await screen.findByTitle('Revision snapshot preview')
    fireEvent.click(olderButton())
    expect(await screen.findByText('That revision is no longer available. The history list has been refreshed.')).toBeInTheDocument()
    await waitFor(() => expect(mocks.getSiteRevisions).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('2 pages')).not.toBeInTheDocument()
  })

  it('retries a failed list request', async () => {
    mocks.getSiteRevisions.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ revisions })
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('3 pages')).toBeInTheDocument()
  })
})
