import { useState } from 'react'
import type { MediaItem } from '../../../lib/media'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMedia: vi.fn(),
  uploadMedia: vi.fn()
}))

vi.mock('../../../lib/media', () => ({
  getMedia: mocks.getMedia,
  uploadMedia: mocks.uploadMedia
}))

import { MediaPicker } from '../MediaPicker'

const mediaItem = (id: string, originalFilename = `${id}.jpg`): MediaItem => ({
  id,
  originalFilename,
  contentType: 'image/jpeg',
  sizeBytes: 100,
  width: 1200,
  height: 900,
  createdAt: 1,
  src: `https://media.test/${id}.jpg`
})

describe('MediaPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMedia.mockResolvedValue({ media: [mediaItem('media-1', 'kitchen.jpg'), mediaItem('media-2', 'deck.jpg')], hasMore: false })
    mocks.uploadMedia.mockResolvedValue(mediaItem('uploaded', 'new-work.jpg'))
  })

  it('loads the library, marks selected assets, adds without closing, and closes only on Done', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<MediaPicker onClose={onClose} onSelect={onSelect} selectedMediaIds={['media-1']} tenantId="tenant-1" />)

    expect(await screen.findByText('kitchen.jpg')).toBeInTheDocument()
    expect(mocks.getMedia).toHaveBeenCalledWith('tenant-1')
    expect(screen.getByRole('button', { name: 'kitchen.jpg added' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back to Gallery' })).toBeEnabled()
    expect(screen.getByText('1 of 20 in Gallery')).toBeInTheDocument()
    expect(screen.getByText(/only takes it out of this Gallery/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add deck.jpg' }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'media-2' }))
    expect(screen.getByRole('heading', { name: 'Add images' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('uploads into the library without selecting the asset automatically', async () => {
    const onSelect = vi.fn()
    render(<MediaPicker onClose={() => {}} onSelect={onSelect} selectedMediaIds={[]} tenantId="tenant-1" />)
    await screen.findByText('kitchen.jpg')

    const file = new File(['image'], 'new-work.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledWith('tenant-1', file))
    expect(await screen.findByText('Uploaded. Choose it below to add it to the Gallery.')).toBeInTheDocument()
    expect(screen.getByText('new-work.jpg')).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('surfaces upload failure without changing selection', async () => {
    mocks.uploadMedia.mockRejectedValueOnce(new Error('offline'))
    const onSelect = vi.fn()
    render(<MediaPicker onClose={() => {}} onSelect={onSelect} selectedMediaIds={[]} tenantId="tenant-1" />)
    await screen.findByText('kitchen.jpg')

    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [new File(['image'], 'bad.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to upload the image. Please try again.')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('disables every remaining Add at capacity while keeping selected state and Done available', async () => {
    const available = [mediaItem('media-20'), mediaItem('media-21')]
    mocks.getMedia.mockResolvedValue({ media: available, hasMore: false })

    function Harness () {
      const [selected, setSelected] = useState(Array.from({ length: 19 }, (_, index) => `selected-${index}`))
      const select = (item: MediaItem) => setSelected((current) => current.length >= 20 || current.includes(item.id) ? current : [...current, item.id])
      return <><MediaPicker onClose={() => {}} onSelect={select} selectedMediaIds={selected} selectionDisabled={selected.length >= 20} tenantId="tenant-1" /><output data-testid="selected-count">{selected.length}</output><button onClick={() => select(available[1]!)} type="button">Force parent selection</button></>
    }

    render(<Harness />)
    const library = await screen.findByRole('list', { name: 'Media library' })
    fireEvent.click(within(library).getByRole('button', { name: 'Add media-20.jpg' }))
    expect(screen.getByTestId('selected-count')).toHaveTextContent('20')
    expect(screen.getByRole('button', { name: 'media-20.jpg added' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add media-21.jpg' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
    expect(screen.getByText('Maximum reached')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Force parent selection' }))
    expect(screen.getByTestId('selected-count')).toHaveTextContent('20')
  })

  it('uses a custom Logos label and capacity without changing selection behavior', async () => {
    const selected = ['media-1', ...Array.from({ length: 23 }, (_, index) => `selected-${index}`)]
    const onSelect = vi.fn()
    render(<MediaPicker capacity={24} onClose={() => {}} onSelect={onSelect} sectionLabel="Logos section" selectedMediaIds={selected} selectionDisabled tenantId="tenant-1" />)

    expect(await screen.findByRole('button', { name: 'Back to Logos section' })).toBeEnabled()
    expect(screen.getByText('24 of 24 in Logos section')).toBeInTheDocument()
    expect(screen.getByText(/only takes it out of this Logos section/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'kitchen.jpg added' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add deck.jpg' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
    expect(screen.getByText('Maximum reached')).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('hides only capacity copy for About while keeping the current image Added and replacements selectable', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<MediaPicker capacity={1} onClose={onClose} onSelect={onSelect} sectionLabel="About image" selectedMediaIds={['media-1']} selectionDisabled={false} showCapacity={false} tenantId="tenant-1" />)

    expect(await screen.findByRole('button', { name: 'Back to About image' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'kitchen.jpg added' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add deck.jpg' })).toBeEnabled()
    expect(screen.queryByText('1 of 1 in About image')).not.toBeInTheDocument()
    expect(screen.queryByText('Maximum reached')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add deck.jpg' }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'media-2' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
