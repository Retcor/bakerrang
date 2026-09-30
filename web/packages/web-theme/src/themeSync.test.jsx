// @vitest-environment jsdom
// Phase H shared-package fixes: WT-1 stale reconcile, WT-2 ordered saves,
// WT-3 cross-tab/app adoption, WT-4 persistence status.
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { THEME_PERSISTENCE, ThemeProvider, readThemeCookie, useTheme } from './index.jsx'

afterEach(() => {
  cleanup()
  document.cookie = 'br_theme=; Path=/; Max-Age=0'
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.remove('dark')
})

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject })
  return { promise, resolve, reject }
}

// A window whose focus events are real, so WT-3 is exercised end to end.
const eventedWindow = (dark = false) => ({
  location: { hostname: 'localhost', protocol: 'http:' },
  matchMedia: vi.fn(() => ({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  addEventListener: (...args) => window.addEventListener(...args),
  removeEventListener: (...args) => window.removeEventListener(...args)
})

const StatusHarness = () => {
  const theme = useTheme()
  const choose = (event) => theme.setPreference(event.currentTarget.dataset.value)
  return (
    <div>
      <output data-testid='preference'>{theme.preference}</output>
      <output data-testid='persistence'>{theme.persistence}</output>
      <output data-testid='error'>{theme.persistenceError ? theme.persistenceError.message : ''}</output>
      {['light', 'dark', 'system'].map((value) => <button key={value} data-value={value} onClick={choose}>{value}</button>)}
    </div>
  )
}

const renderTheme = (apiClient, { isAuthenticated = true, windowObject = eventedWindow(false) } = {}) =>
  render(
    <ThemeProvider apiClient={apiClient} isAuthenticated={isAuthenticated} windowObject={windowObject}>
      <StatusHarness />
    </ThemeProvider>
  )

const click = (name) => userEvent.click(screen.getByRole('button', { name }))
const pref = () => screen.getByTestId('preference').textContent
const status = () => screen.getByTestId('persistence').textContent
const putCalls = (apiClient) => apiClient.getJson.mock.calls.filter(([, options]) => options?.method === 'PUT')

describe('WT-1: a stale server read never rolls back a fresh local choice', () => {
  it('drops a read that resolves after the user chose a theme, and keeps the cookie', async () => {
    document.cookie = 'br_theme=light; Path=/'
    const read = deferred()
    const apiClient = {
      getJson: vi.fn((path, options) => options?.method === 'PUT' ? Promise.resolve({}) : read.promise)
    }
    renderTheme(apiClient)
    await click('dark')
    expect(pref()).toBe('dark')

    await act(async () => read.resolve({ theme: 'light' }))

    expect(pref()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(readThemeCookie(document.cookie)).toBe('dark')
  })

  it('still lets an explicit stored value win when the user has not chosen anything', async () => {
    document.cookie = 'br_theme=light; Path=/'
    const apiClient = { getJson: vi.fn().mockResolvedValue({ theme: 'dark' }) }
    renderTheme(apiClient)
    await waitFor(() => expect(pref()).toBe('dark'))
    expect(readThemeCookie(document.cookie)).toBe('dark')
    expect(status()).toBe('saved')
  })

  it('leaves the persistence status idle when the server has nothing stored', async () => {
    document.cookie = 'br_theme=dark; Path=/'
    const apiClient = { getJson: vi.fn().mockResolvedValue({}) }
    renderTheme(apiClient)
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))
    expect(pref()).toBe('dark')
    expect(status()).toBe('idle')
  })
})

describe('WT-2: saves are serialized and the newest choice wins', () => {
  it('keeps one PUT in flight, skips intermediate values, and ends on the last choice', async () => {
    const puts = []
    let inFlight = 0
    let maxInFlight = 0
    const apiClient = {
      getJson: vi.fn((path, options) => {
        if (options?.method !== 'PUT') return Promise.resolve({})
        const gate = deferred()
        puts.push({ theme: options.body.theme, gate })
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        return gate.promise.finally(() => { inFlight -= 1 })
      })
    }
    renderTheme(apiClient)
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))

    await click('dark')
    await click('light')
    await click('system')
    expect(pref()).toBe('system')
    expect(status()).toBe('saving')
    expect(puts.map((put) => put.theme)).toEqual(['dark'])

    await act(async () => puts[0].gate.resolve({ theme: 'dark' }))
    await waitFor(() => expect(puts.map((put) => put.theme)).toEqual(['dark', 'system']))
    expect(status()).toBe('saving')

    await act(async () => puts[1].gate.resolve({ theme: 'system' }))
    await waitFor(() => expect(status()).toBe('saved'))
    expect(maxInFlight).toBe(1)
    expect(pref()).toBe('system')
    expect(readThemeCookie(document.cookie)).toBe('system')
  })

  it('does not show an older failure once a newer save succeeds', async () => {
    const puts = []
    const apiClient = {
      getJson: vi.fn((path, options) => {
        if (options?.method !== 'PUT') return Promise.resolve({})
        const gate = deferred()
        puts.push({ theme: options.body.theme, gate })
        return gate.promise
      })
    }
    renderTheme(apiClient)
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))
    await click('dark')
    await click('light')
    await act(async () => puts[0].gate.reject(new Error('stale failure')))
    await waitFor(() => expect(puts).toHaveLength(2))
    await act(async () => puts[1].gate.resolve({ theme: 'light' }))
    await waitFor(() => expect(status()).toBe('saved'))
    expect(screen.getByTestId('error').textContent).toBe('')
  })

  it('reports the error of the newest save and can retry the same choice', async () => {
    let fail = true
    const apiClient = {
      getJson: vi.fn((path, options) => {
        if (options?.method !== 'PUT') return Promise.resolve({})
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve({ theme: options.body.theme })
      })
    }
    renderTheme(apiClient)
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))
    await click('dark')
    await waitFor(() => expect(status()).toBe('error'))
    expect(screen.getByTestId('error').textContent).toBe('offline')
    expect(pref()).toBe('dark')
    expect(readThemeCookie(document.cookie)).toBe('dark')

    fail = false
    await click('dark')
    await waitFor(() => expect(status()).toBe('saved'))
    expect(screen.getByTestId('error').textContent).toBe('')
    expect(putCalls(apiClient)).toHaveLength(2)
  })

  it('abandons queued saves when the user signs out', async () => {
    const gate = deferred()
    const apiClient = { getJson: vi.fn((path, options) => options?.method === 'PUT' ? gate.promise : Promise.resolve({})) }
    const view = renderTheme(apiClient)
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))
    await click('dark')
    await click('light')
    view.rerender(
      <ThemeProvider apiClient={apiClient} isAuthenticated={false} windowObject={eventedWindow(false)}>
        <StatusHarness />
      </ThemeProvider>
    )
    await act(async () => gate.resolve({ theme: 'dark' }))
    await waitFor(() => expect(status()).toBe('idle'))
    expect(putCalls(apiClient)).toHaveLength(1)
    expect(pref()).toBe('light')
  })
})

describe('WT-3: another tab or app changing br_theme is adopted without a PUT', () => {
  it('adopts a changed cookie when the tab becomes visible', async () => {
    document.cookie = 'br_theme=light; Path=/'
    const apiClient = { getJson: vi.fn().mockResolvedValue({}) }
    renderTheme(apiClient)
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))

    document.cookie = 'br_theme=dark; Path=/'
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

    expect(pref()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(apiClient.getJson).toHaveBeenCalledTimes(1)
  })

  it('adopts on window focus, ignores an invalid or missing cookie, and never writes', async () => {
    document.cookie = 'br_theme=light; Path=/'
    const apiClient = { getJson: vi.fn().mockResolvedValue({}) }
    renderTheme(apiClient)
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))

    document.cookie = 'br_theme=midnight; Path=/'
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(pref()).toBe('light')

    document.cookie = 'br_theme=; Path=/; Max-Age=0'
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(pref()).toBe('light')

    document.cookie = 'br_theme=system; Path=/'
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(pref()).toBe('system')
    expect(apiClient.getJson).toHaveBeenCalledTimes(1)
  })

  it('does not treat its own cookie write as a foreign change', async () => {
    const apiClient = { getJson: vi.fn().mockResolvedValue({}) }
    renderTheme(apiClient)
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))
    await click('dark')
    await waitFor(() => expect(status()).toBe('saved'))
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(pref()).toBe('dark')
    expect(status()).toBe('saved')
  })

  it('a stale server read cannot roll back a value adopted from another app', async () => {
    document.cookie = 'br_theme=light; Path=/'
    const read = deferred()
    const apiClient = { getJson: vi.fn(() => read.promise) }
    renderTheme(apiClient)
    document.cookie = 'br_theme=dark; Path=/'
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await act(async () => read.resolve({ theme: 'light' }))
    expect(pref()).toBe('dark')
    expect(readThemeCookie(document.cookie)).toBe('dark')
  })

  it('cross-app: a choice in one provider is adopted by a second app in the same browser with no extra PUT', async () => {
    const budgetApi = { getJson: vi.fn().mockResolvedValue({}) }
    const accountApi = { getJson: vi.fn().mockResolvedValue({}) }
    const first = render(
      <ThemeProvider apiClient={budgetApi} isAuthenticated windowObject={eventedWindow(false)}><StatusHarness /></ThemeProvider>
    )
    const second = render(
      <ThemeProvider apiClient={accountApi} isAuthenticated windowObject={eventedWindow(false)}><StatusHarness /></ThemeProvider>
    )
    await waitFor(() => expect(accountApi.getJson).toHaveBeenCalledTimes(1))

    await userEvent.click(within(first.container).getByRole('button', { name: 'dark' }))
    await waitFor(() => expect(within(first.container).getByTestId('persistence').textContent).toBe('saved'))
    await act(async () => { window.dispatchEvent(new Event('focus')) })

    expect(within(second.container).getByTestId('preference').textContent).toBe('dark')
    expect(accountApi.getJson).toHaveBeenCalledTimes(1)
    expect(putCalls(budgetApi)).toHaveLength(1)
  })
})

describe('WT-4 and the shared contract: persistence status, anonymous mode, no local storage', () => {
  it('walks idle -> saving -> saved for an authenticated change', async () => {
    const gate = deferred()
    const apiClient = { getJson: vi.fn((path, options) => options?.method === 'PUT' ? gate.promise : Promise.resolve({})) }
    renderTheme(apiClient)
    await waitFor(() => expect(apiClient.getJson).toHaveBeenCalledTimes(1))
    expect(status()).toBe('idle')
    await click('dark')
    expect(status()).toBe('saving')
    await act(async () => gate.resolve({ theme: 'dark' }))
    await waitFor(() => expect(status()).toBe('saved'))
  })

  it('anonymous changes write only the cookie and keep the status idle', async () => {
    const apiClient = { getJson: vi.fn() }
    renderTheme(apiClient, { isAuthenticated: false })
    await click('dark')
    expect(readThemeCookie(document.cookie)).toBe('dark')
    expect(apiClient.getJson).not.toHaveBeenCalled()
    expect(status()).toBe('idle')
  })

  it('supports light, dark and system, and resolves system per device', async () => {
    const apiClient = { getJson: vi.fn() }
    renderTheme(apiClient, { isAuthenticated: false, windowObject: eventedWindow(true) })
    await click('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    await click('system')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(readThemeCookie(document.cookie)).toBe('system')
    await click('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('never touches localStorage or sessionStorage', async () => {
    const spies = ['getItem', 'setItem', 'removeItem'].map((method) => vi.spyOn(Storage.prototype, method))
    const apiClient = { getJson: vi.fn().mockResolvedValue({}) }
    renderTheme(apiClient)
    await click('dark')
    await waitFor(() => expect(status()).toBe('saved'))
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled())
  })

  it('exposes the four documented persistence values', () => {
    expect([...THEME_PERSISTENCE]).toEqual(['idle', 'saving', 'saved', 'error'])
  })
})
