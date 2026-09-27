// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntryEditor } from './EntryEditor.jsx'
import { createBill, deleteBill, updateBill } from '../api/budget.js'

vi.mock('../api/budget.js', () => ({
  createBill: vi.fn(), createPayday: vi.fn(), deleteBill: vi.fn(), deletePayday: vi.fn(), updateBill: vi.fn(), updatePayday: vi.fn()
}))

const bill = { id: 'b', category: 'utility', name: 'Rent', amountCents: 50000, due: { rule: 'day', day: 2 }, paydayId: null, autoPay: false, active: true, notes: '', url: '', lastPaymentMonth: null, balanceCents: null, rev: 1 }
const props = (overrides = {}) => ({ kind: 'bill', entry: bill, paydays: [], online: true, onSaved: vi.fn(), onDeleted: vi.fn(), onClose: vi.fn(), onDirtyChange: vi.fn(), discardPrompt: false, onDiscard: vi.fn(), onKeepEditing: vi.fn(), ...overrides })

beforeEach(() => { createBill.mockReset(); updateBill.mockReset(); deleteBill.mockReset() })
afterEach(cleanup)

describe('Budget entry editor', () => {
  it('validates in place and focuses the first invalid field', async () => {
    render(<EntryEditor {...props({ entry: null })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add bill' }))
    expect(screen.getByText('Check the 2 fields marked above.')).not.toBeNull()
    expect(document.activeElement).toBe(document.getElementById('bd-name'))
    expect(createBill).not.toHaveBeenCalled()
  })

  it('keeps the draft on conflict and replaces it only when Use latest is chosen', async () => {
    const current = { ...bill, name: 'Rent from server', rev: 2 }
    updateBill.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409, code: 'conflict', current }))
    render(<EntryEditor {...props()} />)
    const name = screen.getByLabelText('Name'); await userEvent.clear(name); await userEvent.type(name, 'My revised rent')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/changed somewhere else/)).not.toBeNull()
    expect(name.value).toBe('My revised rent')
    await userEvent.click(screen.getByRole('button', { name: 'Use latest' }))
    expect(screen.getByLabelText('Name').value).toBe('Rent from server')
  })

  it('treats a conflict with canonical state equal to the draft as a successful save', async () => {
    const onSaved = vi.fn()
    updateBill.mockImplementation(async (id, request) => {
      const { expectedRev, ...current } = request
      throw Object.assign(new Error('conflict'), { status: 409, code: 'conflict', current: { ...bill, ...current, rev: expectedRev + 1 } })
    })
    render(<EntryEditor {...props({ onSaved })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'b', rev: 2 }), 'Saved'))
  })

  it('requires inline confirmation before deleting', async () => {
    deleteBill.mockResolvedValue({ deleted: true })
    const onDeleted = vi.fn(); render(<EntryEditor {...props({ onDeleted })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Rent?')).not.toBeNull()
    expect(screen.getByText("It leaves every month. This can't be undone.")).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByText('Delete Rent?')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Confirm delete' })).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith({ deleted: true }))
  })

  it('renders only safe saved payment links and accepts http links', async () => {
    const { unmount } = render(<EntryEditor {...props({ entry: { ...bill, url: 'http://example.com/pay' } })} />)
    const link = screen.getByRole('link', { name: 'Open payment site' })
    expect(link.getAttribute('href')).toBe('http://example.com/pay')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    unmount(); render(<EntryEditor {...props({ entry: { ...bill, url: 'javascript:alert(1)' } })} />)
    expect(screen.queryByRole('link', { name: 'Open payment site' })).toBeNull()
  })

  it('describes Paid from options and marks the selected one', async () => {
    render(<EntryEditor {...props({ paydays: [{ id: 'p', name: 'Acme', amountCents: 100000, schedule: { frequency: 'monthly', rule: 'day', day: 1 }, rev: 1 }] })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Paid from' }))
    expect(screen.getByText('The most recent payday on or before the due date')).not.toBeNull()
    expect(screen.getByRole('option', { name: /Automatic/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('supports arrow-key selection in the payday recurrence radiogroup', async () => {
    render(<EntryEditor {...props({ kind: 'payday', entry: null })} />)
    const monthly = screen.getByRole('radio', { name: 'Monthly' }); monthly.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Every 2 weeks' }).getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Every 2 weeks' }))
  })
})
