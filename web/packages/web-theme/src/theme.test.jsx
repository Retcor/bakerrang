// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, readThemeCookie, resolveTheme, themeCookieValue, useTheme } from './index.jsx'

const ThemeHarness = () => {
  const theme = useTheme()
  const handleDark = () => theme.setPreference('dark')
  const handleSystem = () => theme.setPreference('system')
  return (
    <div>
      <output data-testid='preference'>{theme.preference}</output>
      <output data-testid='resolved'>{theme.resolvedTheme}</output>
      <button onClick={handleDark}>Dark</button>
      <button onClick={handleSystem}>System</button>
    </div>
  )
}

const windowLike = (dark = false, location = { hostname: 'localhost', protocol: 'http:' }) => ({
  location,
  matchMedia: vi.fn(() => ({
    matches: dark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
})

afterEach(() => {
  cleanup()
  document.cookie = 'br_theme=; Path=/; Max-Age=0'
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.remove('dark')
})

describe('theme resolution and cookies', () => {
  it('accepts only the three locked cookie values', () => {
    expect(readThemeCookie('br_theme=light')).toBe('light')
    expect(readThemeCookie('x=1; br_theme=dark')).toBe('dark')
    expect(readThemeCookie('br_theme=system')).toBe('system')
    expect(readThemeCookie('br_theme=midnight')).toBeNull()
    expect(readThemeCookie('other=dark')).toBeNull()
  })

  it('uses system when there is no valid explicit preference', () => {
    expect(resolveTheme(null, false)).toBe('light')
    expect(resolveTheme(undefined, true)).toBe('dark')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('omits Domain and Secure on HTTP localhost and sets both in production', () => {
    expect(themeCookieValue('dark', { hostname: 'localhost', protocol: 'http:' })).toBe(
      'br_theme=dark; Path=/; SameSite=Lax; Max-Age=31536000'
    )
    expect(themeCookieValue('system', { hostname: 'launch.bakerrang.com', protocol: 'https:' })).toBe(
      'br_theme=system; Path=/; SameSite=Lax; Max-Age=31536000; Domain=.bakerrang.com; Secure'
    )
  })
})

describe('ThemeProvider', () => {
  it('reconciles an explicit authenticated server preference and updates the document', async () => {
    document.cookie = 'br_theme=light; Path=/'
    const apiClient = { getJson: vi.fn().mockResolvedValue({ theme: 'dark' }) }
    render(
      <ThemeProvider apiClient={apiClient} isAuthenticated windowObject={windowLike(false)}>
        <ThemeHarness />
      </ThemeProvider>
    )

    await waitFor(() => expect(screen.getByTestId('preference').textContent).toBe('dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(readThemeCookie(document.cookie)).toBe('dark')
  })

  it('preserves an explicit cookie when the authenticated server has no preference', async () => {
    document.cookie = 'br_theme=light; Path=/'
    const apiClient = { getJson: vi.fn().mockResolvedValue({}) }
    render(
      <ThemeProvider apiClient={apiClient} isAuthenticated windowObject={windowLike(true)}>
        <ThemeHarness />
      </ThemeProvider>
    )

    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledWith('/account/preferences'))
    expect(screen.getByTestId('preference').textContent).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('persists a user-initiated authenticated change after applying it immediately', async () => {
    const apiClient = { getJson: vi.fn().mockResolvedValue({}) }
    render(
      <ThemeProvider apiClient={apiClient} isAuthenticated windowObject={windowLike(false)}>
        <ThemeHarness />
      </ThemeProvider>
    )
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledWith('/account/preferences', {
      method: 'PUT', body: { theme: 'dark' }
    }))
  })

  it('changes anonymous theme without a backend write and follows system preference', async () => {
    const apiClient = { getJson: vi.fn() }
    render(
      <ThemeProvider apiClient={apiClient} isAuthenticated={false} windowObject={windowLike(true)}>
        <ThemeHarness />
      </ThemeProvider>
    )

    expect(screen.getByTestId('resolved').textContent).toBe('dark')
    await act(async () => userEvent.click(screen.getByRole('button', { name: 'Dark' })))
    expect(apiClient.getJson).not.toHaveBeenCalled()
  })
})
