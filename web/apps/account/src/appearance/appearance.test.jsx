// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STATUS, authStore } from '../test-support/mockAuth.js'
import { AnnounceProvider } from '../announce.jsx'
import { AppearanceSection } from './AppearanceSection.jsx'
import { RELAY_APPS, Relay } from './Relay.jsx'

vi.mock('@bakerrang/web-auth', async () => (await import('../test-support/mockAuth.js')).mockAuthModule)

const theme = vi.hoisted(() => ({ current: null, setPreference: null }))
vi.mock('@bakerrang/web-theme', () => ({ useTheme: () => theme.current }))

const themeValue = (patch = {}) => ({ preference: 'light', resolvedTheme: 'light', persistence: 'idle', persistenceError: null, setPreference: theme.setPreference, ...patch })

const reducedMotion = (reduced) => {
  window.matchMedia = vi.fn((query) => ({ matches: query.includes('reduced-motion') ? reduced : false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

const renderSection = () => render(<AnnounceProvider><AppearanceSection /></AnnounceProvider>)
const rerenderWith = (view, patch) => {
  theme.current = themeValue(patch)
  view.rerender(<AnnounceProvider><AppearanceSection /></AnnounceProvider>)
}

beforeEach(() => {
  theme.setPreference = vi.fn()
  theme.current = themeValue()
  authStore.reset()
  reducedMotion(false)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('theme choice', () => {
  it('is a labelled radio group whose selected option matches the shared preference', () => {
    theme.current = themeValue({ preference: 'dark', resolvedTheme: 'dark' })
    renderSection()
    const group = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(group).getAllByRole('radio').map((radio) => [radio.value, radio.checked])).toEqual([['light', false], ['dark', true], ['system', false]])
    expect(within(group).getAllByRole('radio').map((radio) => radio.labels[0].textContent)).toEqual(['Light', 'Dark', 'System'])
  })

  it('calls only the shared setPreference, once per change, and never reads or writes anything itself', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(theme.setPreference).toHaveBeenCalledTimes(1)
    expect(theme.setPreference).toHaveBeenCalledWith('dark')
    await userEvent.click(screen.getByRole('radio', { name: 'System' }))
    expect(theme.setPreference).toHaveBeenLastCalledWith('system')
  })

  it('describes System with the device theme, and the others as browser-wide', () => {
    theme.current = themeValue({ preference: 'system', resolvedTheme: 'dark' })
    const view = renderSection()
    expect(screen.getByText("Follows this device. It's dark right now.")).not.toBeNull()
    rerenderWith(view, { preference: 'system', resolvedTheme: 'light' })
    expect(screen.getByText("Follows this device. It's light right now.")).not.toBeNull()
    rerenderWith(view, { preference: 'dark', resolvedTheme: 'dark' })
    expect(screen.getByText('Every BakerRang app on this browser uses it.')).not.toBeNull()
  })
})

describe('persistence status', () => {
  it('signed out: says the choice is saved in this browser and announces it once', async () => {
    authStore.reset(AUTH_STATUS.ANONYMOUS)
    renderSection()
    expect(screen.getByText('Saved in this browser. Sign in to keep it on every device.')).not.toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    await screen.findByText('Theme set to Dark. Saved in this browser.', { selector: '[role="status"]' })
  })

  it('renders idle as a quiet reserved line, then saving, saved and error', () => {
    const view = renderSection()
    expect(document.querySelector('.ac-status').textContent).toBe('')
    rerenderWith(view, { persistence: 'saving' })
    expect(screen.getByText('Saving to your account…')).not.toBeNull()
    rerenderWith(view, { persistence: 'saved' })
    expect(screen.getByText('Saved to your account. Your other devices pick it up the next time they open BakerRang.')).not.toBeNull()
    rerenderWith(view, { persistence: 'error', persistenceError: new Error('offline') })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Changed on this browser, but not saved to your account.')
    expect(alert.textContent).toContain("Your other devices won't pick it up yet.")
  })

  it('Try again re-sends the current choice through the same shared call', async () => {
    theme.current = themeValue({ preference: 'dark', resolvedTheme: 'dark', persistence: 'error', persistenceError: new Error('x') })
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(theme.setPreference).toHaveBeenCalledTimes(1)
    expect(theme.setPreference).toHaveBeenCalledWith('dark')
  })

  it('announces the outcome of a choice exactly once: saved, or saved-on-this-browser-only', async () => {
    const view = renderSection()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    rerenderWith(view, { preference: 'dark', resolvedTheme: 'dark', persistence: 'saving' })
    rerenderWith(view, { preference: 'dark', resolvedTheme: 'dark', persistence: 'saved' })
    await screen.findByText('Theme set to Dark. Saved to your account.', { selector: '[role="status"]' })

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }))
    rerenderWith(view, { preference: 'light', resolvedTheme: 'light', persistence: 'error', persistenceError: new Error('x') })
    await screen.findByText("Theme set to Light on this browser. It couldn't be saved to your account.", { selector: '[role="status"]' })
  })

  it('does not announce a save it did not start (for example a value adopted from another app)', async () => {
    const view = renderSection()
    rerenderWith(view, { preference: 'dark', resolvedTheme: 'dark', persistence: 'saved' })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)) })
    expect(document.querySelector('[role="status"][aria-live="polite"]').textContent).toBe('')
  })
})

describe('the Relay', () => {
  const tiles = () => [...document.querySelectorAll('.ac-relay li')]
  const grounds = () => tiles().map((tile) => tile.dataset.ground)

  it('is a list labelled Applies to with six named tiles, and no controls', () => {
    render(<div><span id='lbl'>Applies to</span><Relay resolvedTheme='dark' labelledBy='lbl' /></div>)
    const list = screen.getByRole('list', { name: 'Applies to' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Launcher', 'Story Book', 'Polyglot', 'Sign', 'Budget', 'Passwords'])
    expect(RELAY_APPS).toHaveLength(6)
    expect(list.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0)
    expect(list.querySelector('img').getAttribute('alt')).toBe('')
  })

  it('holds the previous ground and hands the new one to the tiles left to right, 40ms apart', () => {
    vi.useFakeTimers()
    const view = render(<Relay resolvedTheme='dark' />)
    expect(grounds()).toEqual(Array(6).fill('dark'))
    view.rerender(<Relay resolvedTheme='light' />)
    expect(grounds()).toEqual(Array(6).fill('dark'))
    act(() => { vi.advanceTimersByTime(1) })
    expect(grounds()).toEqual(['light', 'dark', 'dark', 'dark', 'dark', 'dark'])
    act(() => { vi.advanceTimersByTime(40) })
    expect(grounds()).toEqual(['light', 'light', 'dark', 'dark', 'dark', 'dark'])
    act(() => { vi.advanceTimersByTime(40 * 4) })
    expect(grounds()).toEqual(Array(6).fill('light'))
  })

  it('restarts cleanly when the theme changes again mid-flight', () => {
    vi.useFakeTimers()
    const view = render(<Relay resolvedTheme='dark' />)
    view.rerender(<Relay resolvedTheme='light' />)
    act(() => { vi.advanceTimersByTime(85) })
    expect(grounds()).toEqual(['light', 'light', 'light', 'dark', 'dark', 'dark'])
    view.rerender(<Relay resolvedTheme='dark' />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(grounds()).toEqual(Array(6).fill('dark'))
  })

  it('under reduced motion changes every tile together, immediately, with no stagger timers', () => {
    reducedMotion(true)
    vi.useFakeTimers()
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    const view = render(<Relay resolvedTheme='dark' />)
    setTimeoutSpy.mockClear()
    view.rerender(<Relay resolvedTheme='light' />)
    expect(grounds()).toEqual(Array(6).fill('light'))
    expect(setTimeoutSpy).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears its timers on unmount', () => {
    vi.useFakeTimers()
    const view = render(<Relay resolvedTheme='dark' />)
    view.rerender(<Relay resolvedTheme='light' />)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
