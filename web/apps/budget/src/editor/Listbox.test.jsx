// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Listbox } from './Listbox.jsx'

afterEach(cleanup)

describe('Budget custom listbox', () => {
  it('supports arrow, Home, End, Enter, Escape, and Tab keyboard behavior', async () => {
    const onChange = vi.fn(); const options = [{ value: null, label: 'Automatic' }, { value: 'a', label: 'Acme' }, { value: 'b', label: 'Tutoring' }]
    render(<Listbox label='Paid from' value={null} options={options} onChange={onChange} />)
    const button = screen.getByRole('button', { name: 'Paid from' })
    await userEvent.click(button); await userEvent.keyboard('{End}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('b')
    await userEvent.click(button); await userEvent.keyboard('{Home}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(null)
    await userEvent.click(button); await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    await userEvent.click(button); await userEvent.keyboard('{Tab}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
