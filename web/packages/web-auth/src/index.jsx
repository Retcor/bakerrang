import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { joinApiUrl } from '@bakerrang/web-api-client'

export const AUTH_STATUS = Object.freeze({
  LOADING: 'loading',
  ANONYMOUS: 'anonymous',
  AUTHENTICATED: 'authenticated'
})

const AuthContext = createContext(null)

export const oauthLoginUrl = (apiBaseUrl, target) => {
  if (!/^[a-z][a-z0-9-]*$/.test(target || '')) throw new TypeError('OAuth target must be symbolic')
  return `${joinApiUrl(apiBaseUrl, '/auth/google')}?target=${encodeURIComponent(target)}`
}

export const AuthProvider = ({
  children,
  apiClient,
  apiBaseUrl,
  oauthTarget,
  pollIntervalMs = 60000,
  windowObject = window,
  documentObject = document
}) => {
  const [status, setStatus] = useState(AUTH_STATUS.LOADING)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  const checkAuth = useCallback(async () => {
    try {
      const response = await apiClient.request('/auth/check')
      if (response.status === 401) {
        setUser(null)
        setStatus(AUTH_STATUS.ANONYMOUS)
        setError(null)
        return
      }
      if (!response.ok) throw new Error(`Authentication check failed with status ${response.status}`)
      const payload = await response.json()
      if (payload.isAuthenticated) {
        setUser(payload.user || null)
        setStatus(AUTH_STATUS.AUTHENTICATED)
      } else {
        setUser(null)
        setStatus(AUTH_STATUS.ANONYMOUS)
      }
      setError(null)
    } catch (nextError) {
      setUser(null)
      setStatus(AUTH_STATUS.ANONYMOUS)
      setError(nextError)
    }
  }, [apiClient])

  useEffect(() => {
    checkAuth()
    const interval = windowObject.setInterval(() => {
      if (documentObject.visibilityState !== 'hidden') checkAuth()
    }, pollIntervalMs)
    const onVisibility = () => {
      if (documentObject.visibilityState === 'visible') checkAuth()
    }
    documentObject.addEventListener('visibilitychange', onVisibility)
    return () => {
      windowObject.clearInterval(interval)
      documentObject.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkAuth, documentObject, pollIntervalMs, windowObject])

  const login = useCallback(() => {
    windowObject.location.assign(oauthLoginUrl(apiBaseUrl, oauthTarget))
  }, [apiBaseUrl, oauthTarget, windowObject])

  const logout = useCallback(async () => {
    await apiClient.request('/auth/logout', { method: 'POST' })
    setUser(null)
    setStatus(AUTH_STATUS.ANONYMOUS)
  }, [apiClient])

  const value = useMemo(() => ({ status, user, error, login, logout, refresh: checkAuth }), [checkAuth, error, login, logout, status, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within an AuthProvider')
  return value
}
