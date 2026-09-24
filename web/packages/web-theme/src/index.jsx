import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
  applyResolvedTheme,
  isThemePreference,
  readThemeCookie,
  resolveTheme,
  themeCookieValue
} from './boot.js'

const ThemeContext = createContext(null)

const currentSystemIsDark = (windowObject) => windowObject.matchMedia('(prefers-color-scheme: dark)').matches

export const ThemeProvider = ({ children, apiClient, isAuthenticated = false, windowObject = window, documentObject = document }) => {
  const initialPreference = readThemeCookie(documentObject.cookie) || 'system'
  const [preference, setPreferenceState] = useState(initialPreference)
  const [systemIsDark, setSystemIsDark] = useState(() => currentSystemIsDark(windowObject))
  const [persistenceError, setPersistenceError] = useState(null)
  const resolvedTheme = resolveTheme(preference, systemIsDark)

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

  useEffect(() => {
    if (!isAuthenticated || !apiClient) return undefined
    let active = true
    apiClient.getJson('/account/preferences')
      .then((stored) => {
        if (!active || !isThemePreference(stored.theme)) return
        if (stored.theme !== preference) {
          documentObject.cookie = themeCookieValue(stored.theme, windowObject.location)
          setPreferenceState(stored.theme)
        }
      })
      .catch((error) => {
        if (active) setPersistenceError(error)
      })
    return () => { active = false }
  }, [apiClient, documentObject, isAuthenticated, windowObject])

  const setPreference = useCallback((nextPreference) => {
    if (!isThemePreference(nextPreference)) throw new TypeError('Invalid theme preference')
    documentObject.cookie = themeCookieValue(nextPreference, windowObject.location)
    setPreferenceState(nextPreference)
    setPersistenceError(null)
    if (isAuthenticated && apiClient) {
      apiClient.getJson('/account/preferences', {
        method: 'PUT',
        body: { theme: nextPreference }
      }).catch(setPersistenceError)
    }
  }, [apiClient, documentObject, isAuthenticated, windowObject])

  const value = useMemo(() => ({
    preference,
    resolvedTheme,
    setPreference,
    persistenceError
  }), [persistenceError, preference, resolvedTheme, setPreference])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within a ThemeProvider')
  return value
}

export * from './boot.js'
