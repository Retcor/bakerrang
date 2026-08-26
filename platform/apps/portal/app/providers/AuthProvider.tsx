'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { fetchAuth, logout, type AuthUser } from '../../lib/auth'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider ({ children }: Readonly<{ children: ReactNode }>) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await fetchAuth()
      setUser(result.user)
      setStatus(result.authenticated ? 'authenticated' : 'anonymous')
    } catch (error) {
      console.error('Unable to check authentication status:', error)
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchAuth()
      .then((result) => {
        if (cancelled) return
        setUser(result.user)
        setStatus(result.authenticated ? 'authenticated' : 'anonymous')
      })
      .catch((error: unknown) => {
        console.error('Unable to check authentication status:', error)
        if (cancelled) return
        setUser(null)
        setStatus('anonymous')
      })
    return () => { cancelled = true }
  }, [])

  const signOut = useCallback(async () => {
    await logout()
    await refresh()
  }, [refresh])

  const value = useMemo(() => ({ status, user, refresh, signOut }), [
    status,
    user,
    refresh,
    signOut
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth () {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
