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
})
