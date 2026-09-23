// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Launcher } from './Launcher.jsx'

let authState

vi.mock('@bakerrang/web-auth', () => ({
  AUTH_STATUS: { LOADING: 'loading', ANONYMOUS: 'anonymous', AUTHENTICATED: 'authenticated' },
  useAuth: () => authState
}))

vi.mock('@bakerrang/web-theme', () => ({
  useTheme: () => ({ preference: 'dark', resolvedTheme: 'dark', setPreference: vi.fn() })
}))

beforeEach(() => {
  authState = {
    status: 'anonymous',
    user: null,
    login: vi.fn(),
    logout: vi.fn()
  }
})

afterEach(cleanup)

describe('Launcher', () => {
  it('renders the approved signed-out masthead and exact six-tool inventory', () => {
    render(<Launcher />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Variety of Tools.One Workshop.')
    expect(screen.getAllByText('Story Book').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Polyglot').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sign Language').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Budget').length).toBeGreaterThan(0)
    expect(screen.getAllByText('WoW Advisor').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Passwords').length).toBeGreaterThan(0)
    expect(screen.getByText('6 tools')).not.toBeNull()
    expect(screen.queryByText('Supermarket')).toBeNull()
  })

  it('keeps Instant within Polyglot and Account outside the tool count', () => {
    render(<Launcher />)
    const instant = screen.getByRole('link', { name: /Instant mode/i })
    expect(instant.getAttribute('href')).toContain('/polyglot/instant')
    expect(screen.getByRole('heading', { name: 'Your account' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Account' })).not.toBeNull()
  })

  it('renders the signed-in state and six-tool app switcher with Account separated', async () => {
    authState = {
      status: 'authenticated',
      user: { displayName: 'Alex Rang', email: 'alex@example.com' },
      login: vi.fn(),
      logout: vi.fn()
    }
    render(<Launcher />)
    expect(screen.getByText(/Welcome back, Alex/)).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Switch app' }))
    const menu = screen.getByRole('menu', { name: 'Your tools' })
    expect(menu.querySelectorAll('.br-switcher__cell')).toHaveLength(6)
    expect(menu.querySelector('.br-popover__item').textContent).toContain('Account')
  })
})
