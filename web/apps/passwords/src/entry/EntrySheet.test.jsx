// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MaskedSecret } from './EntrySheet.jsx'

describe('password display', () => {
  it('keeps a hidden value out of the DOM and accessibility tree until Show', () => {
    const announce = vi.fn()
    const { container } = render(<MaskedSecret value='synthetic-secret-sentinel' announce={announce} />)
    expect(container.outerHTML).not.toContain('synthetic-secret-sentinel')
    expect(screen.getByLabelText('Password, hidden')).toBeTruthy()
    expect(screen.getByText('••••••••••••')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(container.textContent).toContain('synthetic-secret-sentinel')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(container.outerHTML).not.toContain('synthetic-secret-sentinel')
  })
})
