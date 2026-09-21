import { useState } from 'react'
import type { GalleryContent, GallerySection } from '@bakerrang/site-schema'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GalleryDraftInspector, galleryContentError } from '../GalleryDraftInspector'

const content = (): GalleryContent => ({ title: 'Our work', items: [
  { id: 'image-1', mediaId: 'media-1', altText: 'Finished kitchen', src: 'https://media.test/kitchen.jpg', width: 1200, height: 900 },
  { id: 'image-2', mediaId: 'media-2', altText: 'Custom deck', src: 'https://media.test/deck.jpg', width: 1200, height: 900 }
] })
const section = (value = content()): GallerySection => ({ id: 'gallery-id', type: 'gallery', hidden: false, content: value })

function Harness ({ initial = section(), onChange = () => {}, onOpenMediaPicker = () => {}, saving = false }: { initial?: GallerySection, onChange?: (content: GalleryContent) => void, onOpenMediaPicker?: () => void, saving?: boolean }) {
  const [current, setCurrent] = useState(initial)
  return <GalleryDraftInspector onChange={(next) => { onChange(next); setCurrent({ ...current, content: next }) }} onOpenMediaPicker={onOpenMediaPicker} saving={saving} section={current} />
}

describe('GalleryDraftInspector', () => {
  it('renders the approved list, thumbnails, counters, alt controls, reorder, remove, and Add action', () => {
    const changed = vi.fn()
    const open = vi.fn()
    const { container } = render(<Harness onChange={changed} onOpenMediaPicker={open} />)

    expect(screen.getByRole('heading', { name: 'Gallery' })).toBeInTheDocument()
    expect(screen.getByLabelText('Section heading')).toHaveValue('Our work')
    expect(screen.getByText('8 / 100')).toBeInTheDocument()
    expect(screen.getByText('2 of 20')).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(2)
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]!).getByLabelText(/Alt text/)).toHaveValue('Finished kitchen')
    expect(within(rows[0]!).getByRole('button', { name: 'Move image 1 up' })).toBeDisabled()
    expect(within(rows[1]!).getByRole('button', { name: 'Move image 2 down' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Section heading'), { target: { value: 'Recent projects' } })
    expect(screen.getByText('15 / 100')).toBeInTheDocument()
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[0]!, { target: { value: 'Updated kitchen' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move image 2 up' }))
    expect(screen.getAllByLabelText(/Alt text/)[0]).toHaveValue('Custom deck')
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1 from Gallery' }))
    expect(screen.getByText('1 of 20')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    expect(open).toHaveBeenCalledOnce()
    expect(changed).toHaveBeenCalled()
  })

  it('keeps the empty draft editable while showing validation', () => {
    const open = vi.fn()
    render(<Harness initial={section({ title: 'Gallery', items: [] })} onOpenMediaPicker={open} />)
    expect(screen.getByText('No images yet')).toBeInTheDocument()
    expect(screen.getByText('Add an image to show this section on your site.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one image.')
    expect(screen.getByRole('button', { name: 'Add image' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    expect(open).toHaveBeenCalledOnce()
  })

  it('shows missing alt guidance and disables every mutation while saving', () => {
    const draft = content()
    draft.items[0]!.altText = ''
    render(<Harness initial={section(draft)} saving />)
    expect(screen.getByText('Add alt text so this image can be saved.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Every Gallery image needs alt text.')
    expect(screen.getByLabelText('Section heading')).toBeDisabled()
    for (const input of screen.getAllByLabelText(/Alt text/)) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move image 2 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove image 1 from Gallery' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add image' })).toBeDisabled()
  })

  it('disables Add at 20 and mirrors Gallery server validation', () => {
    const items = Array.from({ length: 20 }, (_, index) => ({ id: `image-${index}`, mediaId: `media-${index}`, altText: `Image ${index + 1}` }))
    render(<Harness initial={section({ title: 'Gallery', items })} />)
    expect(screen.getByText('20 of 20')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add image' })).toBeDisabled()
    expect(screen.getByText('Maximum of 20 images.')).toBeInTheDocument()

    expect(galleryContentError({ title: ' ', items: [items[0]!] })).toBe('Section heading is required.')
    expect(galleryContentError({ title: 'Gallery', items: [] })).toBe('Add at least one image.')
    expect(galleryContentError({ title: 'Gallery', items: [{ id: 'one', mediaId: '', altText: 'Image' }] })).toBe('Every Gallery image needs a media reference.')
    expect(galleryContentError({ title: 'Gallery', items: [{ id: 'one', mediaId: 'same', altText: 'One' }, { id: 'two', mediaId: 'same', altText: 'Two' }] })).toBe('Gallery cannot contain the same image twice.')
    expect(galleryContentError({ title: 'Gallery', items: [{ id: 'one', mediaId: 'one', altText: ' ' }] })).toBe('Every Gallery image needs alt text.')
    expect(galleryContentError(content())).toBeNull()
  })
})
