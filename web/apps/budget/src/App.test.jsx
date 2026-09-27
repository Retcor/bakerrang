// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.jsx'

let authState
let planState

vi.mock('@bakerrang/web-auth', () => ({
  AUTH_STATUS: { LOADING: 'loading', ANONYMOUS: 'anonymous', AUTHENTICATED: 'authenticated' },
  useAuth: () => authState
}))
vi.mock('@bakerrang/web-app-shell', () => ({
  resolveDestinations: () => ({ launcher: { url: 'https://launch.test' }, account: { url: 'https://account.test' }, tools: [] }),
  BrandLink: () => <a href='/'>Budget</a>,
  AppSwitcher: () => <button>Switch app</button>,
  AccountMenu: ({ onLogout }) => <button onClick={onLogout}>Sign out</button>
}))
vi.mock('@bakerrang/web-ui', () => ({ Button: ({ children, ...props }) => <button {...props}>{children}</button> }))
vi.mock('./state/usePlan.js', () => ({ usePlan: () => planState }))

const payday = { id: 'p', name: 'Pay', amountCents: 100000, schedule: { frequency: 'monthly', rule: 'day', day: 1 }, rev: 1 }
const bill = { id: 'b', category: 'utility', name: 'Rent', amountCents: 50000, due: { rule: 'day', day: 2 }, paydayId: null, autoPay: false, active: true, notes: '', url: '', rev: 1 }
const ready = (plan = { paydays: [payday], bills: [bill] }) => ({ plan, status: 'ready', error: null, online: true, load: vi.fn(), upsert: vi.fn(), remove: vi.fn() })

beforeEach(() => {
  authState = { status: 'authenticated', user: { displayName: 'Reader' }, login: vi.fn(), logout: vi.fn() }
  planState = ready()
  window.history.replaceState({}, '', '/month/2026-09')
})
afterEach(cleanup)

describe('Budget routes and editor guards', () => {
  it('opens the current month at the root path and 404s an invalid month', () => {
    window.history.replaceState({}, '', '/')
    const root = render(<App />)
    expect(screen.queryByText("That page isn't in Budget.")).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).not.toBeNull()
    root.unmount(); window.history.replaceState({}, '', '/month/2026-13')
    render(<App />)
    expect(screen.getByRole('heading', { name: "That page isn't in Budget." })).not.toBeNull()
  })

  it('routes between the Month and Plan sheets without loading a new plan', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'September 2026' })).not.toBeNull()
    await userEvent.click(screen.getByRole('link', { name: 'Plan' }))
    expect(await screen.findByRole('heading', { name: 'Plan' })).not.toBeNull()
  })

  it('switches to Plan and opens a new entry editor when Add is chosen on Month', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Bill' }))
    await waitFor(() => expect(window.location.pathname).toBe('/plan'))
    const form = await screen.findByRole('form', { name: 'Add bill' })
    expect(document.activeElement).toBe(within(form).getByLabelText('Name'))
    expect(form.closest('section').querySelector('h2').textContent).toBe('Bills')
    await userEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: 'Add bill' })).toBeNull()
  })

  it('opens the first-run payday editor on Plan', async () => {
    planState = ready({ paydays: [], bills: [] })
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /Add a payday/ }))
    await waitFor(() => expect(window.location.pathname).toBe('/plan'))
    expect(await screen.findByRole('form', { name: 'Add payday' })).not.toBeNull()
  })

  it('uses the inline discard prompt before a dirty navigation', async () => {
    render(<App />)
    const trigger = screen.getByRole('button', { name: 'Rent' })
    await userEvent.click(trigger)
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name); await userEvent.type(name, 'Rent revised')
    await userEvent.click(screen.getByRole('link', { name: 'Plan' }))
    expect(screen.getByText('Discard these changes?')).not.toBeNull()
    expect(window.location.pathname).toBe('/month/2026-09')
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByText('Discard these changes?')).toBeNull()
    await userEvent.click(screen.getByRole('link', { name: 'Plan' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(window.location.pathname).toBe('/plan'))
  })

  it('returns focus to the row after Escape closes a clean editor', async () => {
    render(<App />)
    const trigger = screen.getByRole('button', { name: 'Rent' })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('Budget page states', () => {
  it('distinguishes load failure from an empty first-run plan', () => {
    planState = { ...ready(), status: 'error', error: new Error('offline') }
    const failed = render(<App />)
    expect(screen.getByRole('heading', { name: /couldn't load/ })).not.toBeNull()
    failed.unmount(); planState = ready({ paydays: [], bills: [] })
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Start with a payday.' })).not.toBeNull()
  })

  it('surfaces malformed legacy entries as Needs Attention', () => {
    planState = ready({ paydays: [payday], bills: [{ ...bill, id: 'bad', due: null, issues: ['due'] }] })
    render(<App />)
    expect(screen.getByText(/has no due day/)).not.toBeNull()
  })
})
