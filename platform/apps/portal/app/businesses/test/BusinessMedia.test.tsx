import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api'

const mocks = vi.hoisted(() => ({
  getMedia: vi.fn(),
  deleteMedia: vi.fn()
}))

vi.mock('../../../lib/media', () => ({
  getMedia: mocks.getMedia,
  deleteMedia: mocks.deleteMedia
}))

import { BusinessMedia } from '../BusinessMedia'

const photo = {
  id: 'media-1',
  originalFilename: 'storefront.png',
  contentType: 'image/png' as const,
  sizeBytes: 20,
  width: 2,
  height: 3,
  createdAt: 1,
  src: 'https://media.test/storefront.png'
}
const extra = {
  ...photo,
  id: 'media-2',
  originalFilename: 'team.png',
  src: 'https://media.test/team.png'
}

describe('Business media library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMedia.mockResolvedValue({ media: [photo, extra], hasMore: true })
    mocks.deleteMedia.mockResolvedValue(undefined)
  })

  it('lists media, skips the API on cancel, deletes on confirm, and shows in-use copy', async () => {
    render(<BusinessMedia tenantId="tenant-1" />)
    expect(await screen.findByText('storefront.png')).toBeInTheDocument()
    expect(screen.getByText('Showing the 50 most recent images.')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete this image?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.deleteMedia).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))
    await waitFor(() => expect(mocks.deleteMedia).toHaveBeenCalledWith('tenant-1', 'media-1'))
    expect(screen.queryByText('storefront.png')).not.toBeInTheDocument()
    expect(screen.getByText('team.png')).toBeInTheDocument()
  })

  it('shows the locked in-use message on that row after a 400', async () => {
    mocks.deleteMedia.mockRejectedValueOnce(new ApiError(400, {
      error: 'Image is still used as the working logo'
    }))
    render(<BusinessMedia tenantId="tenant-1" />)
    expect(await screen.findByText('storefront.png')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Image is still used as the working logo')
    expect(screen.getByText('storefront.png')).toBeInTheDocument()
  })

  it('renders a pending-only library without image URLs and reveals more after retry', async () => {
    const pending = { id: photo.id, originalFilename: photo.originalFilename, createdAt: 1 }
    mocks.getMedia.mockResolvedValueOnce({ media: [], hasMore: false, pendingDeletions: [pending], pendingHasMore: true })
      .mockResolvedValue({ media: [], hasMore: false, pendingDeletions: [{ ...pending, id: extra.id, originalFilename: extra.originalFilename }] })
    render(<BusinessMedia tenantId="tenant-1" />)
    expect(await screen.findByText('storefront.png')).toBeInTheDocument()
    expect(screen.queryByText('No images yet')).not.toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText(/Showing the first 25 incomplete deletions/)).toHaveTextContent('more exist')
    fireEvent.click(screen.getByRole('button', { name: 'Retry deletion' }))
    expect(await screen.findByText('team.png')).toBeInTheDocument()
    expect(screen.queryByText('storefront.png')).not.toBeInTheDocument()
    expect(mocks.deleteMedia).toHaveBeenCalledWith('tenant-1', 'media-1')
  })

  it('refreshes a failed active deletion into a pending recovery row', async () => {
    mocks.deleteMedia.mockRejectedValueOnce(new ApiError(502, { error: 'Storage deletion failed. Retry deletion.' }))
    mocks.getMedia.mockResolvedValueOnce({ media: [photo], hasMore: false })
      .mockResolvedValue({ media: [], hasMore: false, pendingDeletions: [{ id: photo.id, originalFilename: photo.originalFilename, createdAt: 1 }] })
    render(<BusinessMedia tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))
    expect(await screen.findByRole('button', { name: 'Retry deletion' })).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Storage deletion failed')
    expect(document.querySelector('img')).toBeNull()
  })

  it('keeps an active deletion error and working action when the recovery refresh fails', async () => {
    mocks.deleteMedia.mockRejectedValueOnce(new ApiError(502, { error: 'Retry deletion.' }))
    mocks.getMedia.mockResolvedValueOnce({ media: [photo], hasMore: false }).mockRejectedValue(new Error('offline'))
    render(<BusinessMedia tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Retry deletion.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))
    expect(await screen.findByText('No images yet')).toBeInTheDocument()
    expect(mocks.deleteMedia).toHaveBeenCalledTimes(2)
  })

  it('clears a pending retry 404 even if refresh fails', async () => {
    mocks.getMedia.mockResolvedValueOnce({ media: [], hasMore: false, pendingDeletions: [{ id: photo.id, originalFilename: photo.originalFilename, createdAt: 1 }] })
      .mockRejectedValue(new Error('offline'))
    mocks.deleteMedia.mockRejectedValueOnce(new ApiError(404, { error: 'Media not found' }))
    render(<BusinessMedia tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry deletion' }))
    expect(await screen.findByText('No images yet')).toBeInTheDocument()
    expect(mocks.getMedia).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps first-time active 404 as an error', async () => {
    mocks.deleteMedia.mockRejectedValueOnce(new ApiError(404, { error: 'Media not found' }))
    render(<BusinessMedia tenantId="tenant-1" />)
    await screen.findByText('storefront.png')
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Media not found')
    expect(screen.getByText('storefront.png')).toBeInTheDocument()
    expect(mocks.getMedia).toHaveBeenCalledTimes(1)
  })

  it('retains a failed pending retry with its recoverable error', async () => {
    mocks.getMedia.mockResolvedValue({ media: [], hasMore: false, pendingDeletions: [{ id: photo.id, originalFilename: photo.originalFilename, createdAt: 1 }] })
    mocks.deleteMedia.mockRejectedValueOnce(new ApiError(502, { error: 'Deletion could not be finalized. Retry deletion.' }))
    render(<BusinessMedia tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry deletion' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be finalized')
    expect(screen.getByRole('button', { name: 'Retry deletion' })).toBeEnabled()
  })
})
