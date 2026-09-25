// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppSwitcher, resolveDestinations } from './index.jsx'

vi.mock('@bakerrang/web-auth', () => ({
  AUTH_STATUS: { AUTHENTICATED: 'authenticated', ANONYMOUS: 'anonymous', LOADING: 'loading' },
  useAuth: () => ({ status: 'authenticated', user: { displayName: 'Reader', email: 'reader@example.com' }, logout: vi.fn() })
}))

vi.mock('@bakerrang/web-theme', () => ({
  useTheme: () => ({ preference: 'dark', setPreference: vi.fn() })
}))

afterEach(cleanup)

describe('destination registry', () => {
  it('keeps unextracted product on its verified legacy route before cutover', () => {
    const destinations = resolveDestinations({})
    expect(Object.fromEntries(destinations.tools.map((tool) => [tool.id, tool.url]))).toEqual({
      storybook: 'https://storybook.bakerrang.com',
      polyglot: 'https://bakerrang.com/polyglot',
      sign: 'https://bakerrang.com/sign-language',
      budget: 'https://bakerrang.com/budget',
      wow: 'https://bakerrang.com/wow',
      passwords: 'https://bakerrang.com/passwords'
    })
    expect(destinations.account.url).toBe('https://bakerrang.com/account')
    expect(destinations.launcher.url).toBe('https://launch.bakerrang.com')
  })

  it('honors explicit local/test overrides and then the legacy-base override', () => {
    const destinations = resolveDestinations({
      VITE_LEGACY_CLIENT_BASE_URL: 'http://localhost:5173/',
      VITE_STORYBOOK_URL: 'http://localhost:3010',
      VITE_LAUNCHER_URL: 'http://localhost:3000'
    })
    expect(destinations.tools.find((tool) => tool.id === 'storybook').url).toBe('http://localhost:3010')
    expect(destinations.tools.find((tool) => tool.id === 'polyglot').url).toBe('http://localhost:5173/polyglot')
    expect(destinations.launcher.url).toBe('http://localhost:3000')
  })
})

it('marks the current app and keeps Account and Launcher separate from the tool grid', async () => {
  render(<AppSwitcher destinations={resolveDestinations({})} current='storybook' />)
  await userEvent.click(screen.getByRole('button', { name: 'Switch app' }))
  expect(screen.getByRole('menuitem', { name: 'Story Book' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('menuitem', { name: 'Account' })).not.toBeNull()
  expect(screen.getByRole('menuitem', { name: 'All tools — Launcher' })).not.toBeNull()
})
