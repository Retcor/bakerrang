// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STATUS, SAM, authStore } from './test-support/mockAuth.js'
import { serverRef } from './test-support/mockApi.js'
import { createFakeServer, twoVoices } from './test-support/fakeServer.js'
import { installBrowserStubs, renderApp, resetBrowserState } from './test-support/harness.jsx'

vi.mock('@bakerrang/web-auth', async () => (await import('./test-support/mockAuth.js')).mockAuthModule)
vi.mock('@bakerrang/web-api-client', async (importOriginal) => (await import('./test-support/mockApi.js')).apiClientModule(await importOriginal()))

let server
beforeEach(() => {
  resetBrowserState()
  installBrowserStubs()
  authStore.reset()
  server = createFakeServer({ voices: twoVoices() })
  serverRef.current = server
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const ready = async () => { await screen.findByRole('list', { name: 'Your voices' }) }

describe('signed in: Profile', () => {
  it('shows the Google-backed identity read-only, with no photo, no user id and a fixed Google link', async () => {
    renderApp()
    await ready()
    const profile = screen.getByRole('region', { name: 'Profile' })
    expect(within(profile).getByText('Sam Example')).not.toBeNull()
    expect(within(profile).getByText('sam.example@example.test')).not.toBeNull()
    expect(within(profile).getByText('From Google')).not.toBeNull()
    expect(within(profile).getByText(/You sign in with Google. Change your name and email there/)).not.toBeNull()
    expect(profile.querySelector('img')).toBeNull()
    expect(document.body.innerHTML).not.toContain(SAM.id)
    expect(document.body.innerHTML).not.toContain('googleusercontent')
    expect(within(profile).queryByRole('textbox')).toBeNull()
    const link = within(profile).getByRole('link', { name: /Manage your Google account/ })
    expect(link.getAttribute('href')).toBe('https://myaccount.google.com/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.textContent).toContain('(opens in a new tab)')
  })

  it('renders initials, never the photo, in the monogram', async () => {
    renderApp()
    await ready()
    expect(document.querySelector('.ac-mono').textContent).toBe('SE')
  })
})

describe('page structure and states', () => {
  it('has one h1, four labelled sections, a rail with the current section marked, and named landmarks', async () => {
    renderApp()
    await ready()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Account')
    for (const name of ['Profile', 'Appearance', 'Voices', 'Session']) {
      expect(screen.getByRole('region', { name })).not.toBeNull()
      expect(screen.getByRole('heading', { level: 2, name: new RegExp(`^${name}`) })).not.toBeNull()
    }
    const rail = screen.getByRole('navigation', { name: 'Account sections' })
    expect(within(rail).getAllByRole('link').map((link) => link.textContent)).toEqual(['Profile', 'Appearance', 'Voices', 'Session'])
    // Exactly one section is current (jsdom has no layout, so which one is decided in the scroll test).
    expect(within(rail).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'location')).toHaveLength(1)
    expect(within(rail).getByText('Settings that belong to one app live in that app.')).not.toBeNull()
    expect(screen.getByRole('main')).not.toBeNull()
  })

  it('shows the checking state after 300ms while auth loads, with no controls', async () => {
    vi.useFakeTimers()
    authStore.reset(AUTH_STATUS.LOADING)
    renderApp()
    expect(screen.queryByText('Opening Account…')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(310) })
    expect(screen.getByText('Opening Account…')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Account menu' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
  })

  it('shows Not found on an unknown route, for signed-in users too, with a way back', async () => {
    renderApp('/nope')
    expect(screen.getByRole('heading', { level: 1, name: "That page isn't in Account." })).not.toBeNull()
    expect(screen.getByRole('link', { name: /Back to Account/ }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('button', { name: 'Account menu' })).not.toBeNull()
  })

  it('announces being offline and disables Add voice, without hiding the sheet', async () => {
    const { setOnline } = await import('./test-support/harness.jsx')
    renderApp()
    await ready()
    setOnline(false)
    expect(screen.getByText("You're offline.")).not.toBeNull()
    expect(screen.getByText("You can look around, but changes can't be saved until you're back.")).not.toBeNull()
    const add = screen.getByRole('button', { name: 'Add voice' })
    expect(add.getAttribute('aria-disabled')).toBe('true')
    await userEvent.click(add)
    expect(screen.queryByRole('heading', { name: 'Add a voice' })).toBeNull()
    setOnline(true)
    expect(screen.queryByText("You're offline.")).toBeNull()
  })

  it('has no Supermarket, licence, vault or password-manager setting anywhere on the sheet', async () => {
    renderApp()
    await ready()
    const text = document.body.textContent
    expect(text).not.toMatch(/supermarket|licen[cs]e|auto-?lock|inline autofill|master password/i)
    expect(server.calls.filter((call) => /supermarket|licenses|vault/.test(call.path))).toEqual([])
    // The one pointer to Passwords-owned settings is a link, not a control.
    const pointer = screen.getByRole('link', { name: /Open Vault settings in Passwords/ })
    expect(pointer.getAttribute('href')).toBe('https://passwords.bakerrang.com')
  })

  it('renders fully with no vault request and no browser storage use', async () => {
    const spies = ['getItem', 'setItem', 'removeItem', 'clear'].map((method) => vi.spyOn(Storage.prototype, method))
    const indexedDB = vi.fn()
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open: indexedDB } })
    renderApp()
    await ready()
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }))
    await waitFor(() => expect(screen.getByText(/Saved to your account/)).not.toBeNull())
    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled())
    expect(indexedDB).not.toHaveBeenCalled()
    expect(server.calls.some((call) => call.path.includes('/vault'))).toBe(false)
  })
})

describe('signed out', () => {
  beforeEach(() => authStore.reset(AUTH_STATUS.ANONYMOUS))

  it('shows Welcome with the only gold action, a ghost Sign in in the bar, and a working Appearance section', async () => {
    renderApp()
    expect(screen.getByRole('heading', { level: 1, name: 'Your BakerRang account.' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Sign in with Google' }).className).toContain('ac-btn--gold')
    expect(screen.getByRole('button', { name: 'Sign in' }).className).toContain('br-button--ghost')
    expect(screen.getByRole('region', { name: 'Appearance' })).not.toBeNull()
    expect(screen.queryByRole('region', { name: 'Voices' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Account sections' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(authStore.get().login).toHaveBeenCalledTimes(1)
  })

  it('changes the theme with a cookie only: no account request at all', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(document.cookie).toContain('br_theme=dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByText('Saved in this browser. Sign in to keep it on every device.')).not.toBeNull()
    expect(server.calls.filter((call) => call.path.startsWith('/account'))).toEqual([])
    expect(server.calls).toEqual([])
  })

  it('makes no voice or account request while signed out', async () => {
    renderApp()
    await act(async () => {})
    expect(server.calls).toEqual([])
  })
})

describe('Appearance with the real shared theme provider', () => {
  it('saves a choice through /account/preferences and walks saving -> saved with one announcement', async () => {
    const release = server.holdNext('PUT /account/preferences')
    renderApp()
    await ready()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByText('Saving to your account…')).not.toBeNull()
    await act(async () => release())
    await screen.findByText('Saved to your account. Your other devices pick it up the next time they open BakerRang.')
    expect(server.theme).toBe('dark')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Theme set to Dark. Saved to your account.'))
  })

  it('shows a save failure as an alert, keeps the theme, and Try again re-saves it', async () => {
    server.failNext('PUT /account/preferences', { status: 500 })
    renderApp()
    await ready()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    const alert = await screen.findByRole('alert', { name: '' })
    expect(alert.textContent).toContain('Changed on this browser, but not saved to your account.')
    expect(alert.textContent).toContain("Your other devices won't pick it up yet.")
    expect(document.documentElement.dataset.theme).toBe('dark')
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    await screen.findByText(/Saved to your account\./)
    expect(server.theme).toBe('dark')
    expect(server.callsTo('PUT', '/account/preferences')).toHaveLength(2)
  })

  it('exposes the choice as a labelled radio group and follows the device for System', async () => {
    document.cookie = 'br_theme=light; Path=/'
    renderApp()
    await ready()
    const group = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(group).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['light', 'dark', 'system'])
    expect(screen.getByText('Every BakerRang app on this browser uses it.')).not.toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: 'System' }))
    expect(screen.getByText(/Follows this device\. It's (light|dark) right now\./)).not.toBeNull()
    expect(document.cookie).toContain('br_theme=system')
  })

  it('uses native radios in one named group so arrow-key movement is native', async () => {
    document.cookie = 'br_theme=light; Path=/'
    renderApp()
    await ready()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(new Set(radios.map((radio) => radio.getAttribute('name')))).toEqual(new Set(['theme']))
    expect(radios.every((radio) => radio.tagName === 'INPUT' && radio.getAttribute('type') === 'radio' && radio.closest('label'))).toBe(true)
    expect(radios.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(['light'])
    // Selecting with the keyboard (Space on the focused radio) changes the theme like a click.
    screen.getByRole('radio', { name: 'Dark' }).focus()
    await userEvent.keyboard(' ')
    expect(screen.getByRole('radio', { name: 'Dark' }).checked).toBe(true)
  })

  it('adopts a theme another app stored: the stored server value wins on load', async () => {
    server.theme = 'dark'
    document.cookie = 'br_theme=light; Path=/'
    renderApp()
    await ready()
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Dark' }).checked).toBe(true))
    expect(document.cookie).toContain('br_theme=dark')
  })

  it('adopts a theme changed in another app on focus, without writing', async () => {
    renderApp()
    await ready()
    document.cookie = 'br_theme=dark; Path=/'
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(screen.getByRole('radio', { name: 'Dark' }).checked).toBe(true)
    expect(server.callsTo('PUT', '/account/preferences')).toEqual([])
  })

  it('keeps the shared avatar menu free of a second theme control', async () => {
    renderApp()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    const menu = screen.getByRole('menu', { name: 'Account' })
    expect(within(menu).queryByRole('group', { name: 'Theme' })).toBeNull()
    expect(within(menu).getByRole('menuitem', { name: 'Account' })).not.toBeNull()
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).not.toBeNull()
  })

  it('marks Account current in the app switcher and adds no Account tile to the tool grid', async () => {
    renderApp()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Switch app' }))
    const menu = screen.getByRole('menu', { name: 'Your tools' })
    expect(within(menu).getByRole('menuitem', { name: 'Account' }).getAttribute('aria-current')).toBe('page')
    expect(within(menu).getAllByRole('menuitem').filter((item) => item.textContent === 'Account')).toHaveLength(1)
  })
})

describe('Session', () => {
  it('sets Sign out last, apart, with the lifecycle deferral and the Passwords pointer', async () => {
    renderApp()
    await ready()
    const session = screen.getByRole('region', { name: 'Session' })
    expect(within(session).getByText('Vault lock timing and browser-extension autofill are in Passwords.')).not.toBeNull()
    expect(within(session).getByText("Deleting your BakerRang account or downloading a copy of your data isn't available yet.")).not.toBeNull()
    expect(within(session).queryByRole('button', { name: /delete account|export/i })).toBeNull()
    expect(within(session).getByText('sam.example@example.test on this browser')).not.toBeNull()
    const rows = [...session.querySelectorAll('.ac-row')]
    expect(rows.at(-1).textContent).toContain('Sign out')
    expect(rows.at(-1).className).toContain('ac-row--last')
    expect(within(session).getByText('Signing out here signs you out of every BakerRang app in this browser. Other devices stay signed in.')).not.toBeNull()
  })

  it('signs out through the shared logout, announces it, and moves focus to the Welcome heading', async () => {
    renderApp()
    await ready()
    await userEvent.click(within(screen.getByRole('region', { name: 'Session' })).getByRole('button', { name: 'Sign out' }))
    expect(authStore.get().logout).toHaveBeenCalledTimes(1)
    const heading = await screen.findByRole('heading', { level: 1, name: 'Your BakerRang account.' })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Signed out.'))
    expect(screen.queryByRole('region', { name: 'Voices' })).toBeNull()
  })

  it('signs out from the avatar menu through the same mechanism', async () => {
    renderApp()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(authStore.get().logout).toHaveBeenCalledTimes(1)
  })

  it('reports a failed sign out and stays signed in', async () => {
    authStore.get().logout.mockRejectedValueOnce(new Error('offline'))
    renderApp()
    await ready()
    await userEvent.click(within(screen.getByRole('region', { name: 'Session' })).getByRole('button', { name: 'Sign out' }))
    expect((await screen.findByRole('alert', { name: '' })).textContent).toContain("Couldn't sign you out.")
    expect(screen.getByRole('region', { name: 'Voices' })).not.toBeNull()
  })
})

describe('rendering safety', () => {
  it('renders a hostile voice name and description as text, never as markup', async () => {
    server.voices = [{ id: 'x1', name: '<img src=x onerror=alert(1)>', description: '<script>alert(2)</script>', isPrimary: true }]
    renderApp()
    await ready()
    const voices = screen.getByRole('list', { name: 'Your voices' })
    expect(voices.querySelector('img')).toBeNull()
    expect(voices.querySelector('script')).toBeNull()
    expect(within(voices).getByText('<img src=x onerror=alert(1)>')).not.toBeNull()
    expect(within(voices).getByText('<script>alert(2)</script>')).not.toBeNull()
  })
})
