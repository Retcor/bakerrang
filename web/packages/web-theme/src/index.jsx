import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  applyResolvedTheme,
  isThemePreference,
  readThemeCookie,
  resolveTheme,
  themeCookieValue
} from './boot.js'

const ThemeContext = createContext(null)

const currentSystemIsDark = (windowObject) => windowObject.matchMedia('(prefers-color-scheme: dark)').matches

// Persistence status exposed to consumers (Account renders it; other apps ignore it):
//   idle    nothing to report (anonymous, or nothing saved yet)
//   saving  a save is in flight or queued
//   saved   the latest choice is stored on the account
//   error   the latest save failed (`persistenceError` carries the reason)
export const THEME_PERSISTENCE = Object.freeze(['idle', 'saving', 'saved', 'error'])

export const ThemeProvider = ({ children, apiClient, isAuthenticated = false, windowObject = window, documentObject = document }) => {
  const [preference, setPreferenceState] = useState(() => readThemeCookie(documentObject.cookie) || 'system')
  const [systemIsDark, setSystemIsDark] = useState(() => currentSystemIsDark(windowObject))
  const [persistenceError, setPersistenceError] = useState(null)
  const [persistence, setPersistence] = useState('idle')
  const resolvedTheme = resolveTheme(preference, systemIsDark)

  // The newest known choice, readable from async callbacks without a stale closure.
  const preferenceRef = useRef(preference)
  // Bumped whenever a newer choice than any in-flight server read exists: a user
  // pick here, or a value adopted from another tab/app. A read that started before
  // the bump is stale and is dropped (WT-1).
  const choiceRef = useRef(0)
  // At most one PUT in flight; only the latest queued value is ever sent (WT-2).
  const saveRef = useRef({ inFlight: false, pending: null })
  const latestRef = useRef({ apiClient, isAuthenticated })
  const mountedRef = useRef(true)
  latestRef.current = { apiClient, isAuthenticated }

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Layout effect: apply the theme in the same commit as the state change, so the
  // document never lags a render (a passive effect can flush after the commit).
  useLayoutEffect(() => {
    applyResolvedTheme(documentObject.documentElement, resolvedTheme)
  }, [documentObject, resolvedTheme])

  useEffect(() => {
    const media = windowObject.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event) => setSystemIsDark(event.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [windowObject])

  // Authenticated load: an explicitly stored server value that differs wins. It never
  // rolls back a choice made after the read began (WT-1); with no stored value the
  // local choice stays untouched.
  useEffect(() => {
    if (!isAuthenticated || !apiClient) return undefined
    let active = true
    const startedAt = choiceRef.current
    apiClient.getJson('/account/preferences')
      .then((stored) => {
        if (!active || choiceRef.current !== startedAt || !isThemePreference(stored.theme)) return
        if (stored.theme !== preferenceRef.current) {
          documentObject.cookie = themeCookieValue(stored.theme, windowObject.location)
          preferenceRef.current = stored.theme
          setPreferenceState(stored.theme)
        }
        setPersistence((current) => current === 'idle' ? 'saved' : current)
      })
      .catch((error) => {
        if (active) setPersistenceError(error)
      })
    return () => { active = false }
  }, [apiClient, documentObject, isAuthenticated, windowObject])

  // Signing out abandons anything queued: an anonymous choice lives only in the cookie.
  useEffect(() => {
    if (isAuthenticated) return
    saveRef.current.pending = null
    setPersistence('idle')
  }, [isAuthenticated])

  // Cross-tab/app: another BakerRang app may have changed `br_theme` (and already
  // persisted it). Adopt it on return, without a PUT of our own (WT-3).
  useEffect(() => {
    const adopt = () => {
      const stored = readThemeCookie(documentObject.cookie)
      if (!stored || stored === preferenceRef.current) return
      preferenceRef.current = stored
      choiceRef.current += 1
      saveRef.current.pending = null
      setPreferenceState(stored)
      setPersistenceError(null)
      setPersistence('idle')
    }
    const onVisibility = () => { if (documentObject.visibilityState === 'visible') adopt() }
    documentObject.addEventListener?.('visibilitychange', onVisibility)
    windowObject.addEventListener?.('focus', adopt)
    return () => {
      documentObject.removeEventListener?.('visibilitychange', onVisibility)
      windowObject.removeEventListener?.('focus', adopt)
    }
  }, [documentObject, windowObject])

  const flushSaves = useCallback(async () => {
    const save = saveRef.current
    if (save.inFlight) return
    save.inFlight = true
    let failure = null
    let abandoned = false
    try {
      while (save.pending !== null) {
        const theme = save.pending
        save.pending = null
        const { apiClient: client, isAuthenticated: signedIn } = latestRef.current
        if (!signedIn || !client) { abandoned = true; break }
        failure = null
        try {
          await client.getJson('/account/preferences', { method: 'PUT', body: { theme } })
        } catch (error) {
          failure = error
        }
      }
    } finally {
      save.inFlight = false
    }
    if (!mountedRef.current) return
    if (abandoned || !latestRef.current.isAuthenticated) { setPersistence('idle'); return }
    // Only the outcome of the newest save matters: a failure that a later save
    // superseded was reset above, so it is never shown.
    setPersistenceError(failure)
    setPersistence(failure ? 'error' : 'saved')
  }, [])

  const setPreference = useCallback((nextPreference) => {
    if (!isThemePreference(nextPreference)) throw new TypeError('Invalid theme preference')
    documentObject.cookie = themeCookieValue(nextPreference, windowObject.location)
    preferenceRef.current = nextPreference
    choiceRef.current += 1
    setPreferenceState(nextPreference)
    setPersistenceError(null)
    if (isAuthenticated && apiClient) {
      saveRef.current.pending = nextPreference
      setPersistence('saving')
      flushSaves()
    } else {
      setPersistence('idle')
    }
  }, [apiClient, documentObject, flushSaves, isAuthenticated, windowObject])

  const value = useMemo(() => ({
    preference,
    resolvedTheme,
    setPreference,
    persistenceError,
    persistence
  }), [persistence, persistenceError, preference, resolvedTheme, setPreference])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within a ThemeProvider')
  return value
}

export * from './boot.js'
