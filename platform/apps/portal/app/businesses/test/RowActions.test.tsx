import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RowActions } from '../RowActions'

describe('RowActions', () => {
  it('renders contextual, touch-sized canonical icon actions and respects disabled state', () => {
    const moveUp = vi.fn()
    render(<RowActions moveUp={{ label: 'Move testimonial up', onClick: moveUp, disabled: true }} moveDown={{ label: 'Move testimonial down', onClick: () => undefined }} remove={{ label: 'Remove testimonial', onClick: () => undefined }} />)

    const up = screen.getByRole('button', { name: 'Move testimonial up' })
    const down = screen.getByRole('button', { name: 'Move testimonial down' })
    const remove = screen.getByRole('button', { name: 'Remove testimonial' })
    expect(up).toBeDisabled()
    fireEvent.click(up)
    expect(moveUp).not.toHaveBeenCalled()
    for (const button of [up, down, remove]) {
      expect(button).toHaveClass('min-h-11', 'min-w-11', 'px-3')
      expect(button.querySelector('svg')).toHaveClass('size-5')
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('omits actions that were not supplied', () => {
    render(<RowActions remove={{ label: 'Remove service', onClick: () => undefined }} />)
    expect(screen.getByRole('button', { name: 'Remove service' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Move/ })).not.toBeInTheDocument()
  })
})
