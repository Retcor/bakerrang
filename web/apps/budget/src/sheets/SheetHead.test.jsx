// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SheetHead } from './SheetHead.jsx'

afterEach(cleanup)

describe('Budget Add menu', () => {
  it('supports arrow navigation and returns focus on Escape', async () => {
    render(<MemoryRouter initialEntries={['/month/2026-09']}><SheetHead month={{ year: 2026, month: 9 }} previous={{ year: 2026, month: 8 }} next={{ year: 2026, month: 10 }} thisMonth={{ year: 2026, month: 9 }} canAdd firstRun={false} editorOpen={false} onAdd={vi.fn()} /></MemoryRouter>)
    const trigger = screen.getByRole('button', { name: 'Add' }); trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Payday' }))
    for (const text of ['When you get paid, and how much', 'Due every month', 'A monthly payment with an end', 'Due once, on a date']) expect(screen.getByText(text)).not.toBeNull()
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'One-off' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull(); expect(document.activeElement).toBe(trigger)
  })
})
