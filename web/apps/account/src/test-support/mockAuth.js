import { useSyncExternalStore } from 'react'
import { vi } from 'vitest'

// A tiny observable stand-in for @bakerrang/web-auth so a test can sign in and out mid-render.
export const AUTH_STATUS = Object.freeze({ LOADING: 'loading', ANONYMOUS: 'anonymous', AUTHENTICATED: 'authenticated' })

export const SAM = Object.freeze({ id: 'google-id-9931', displayName: 'Sam Example', email: 'sam.example@example.test', photo: 'https://lh3.googleusercontent.com/a/sam-photo' })

const listeners = new Set()
let state
const emit = () => { listeners.forEach((listener) => listener()) }

export const authStore = {
  set (patch) {
    state = { ...state, ...patch }
    emit()
  },
  reset (status = AUTH_STATUS.AUTHENTICATED, user = SAM) {
    state = {
      status,
      user: status === AUTH_STATUS.AUTHENTICATED ? { ...user } : null,
      error: null,
      login: vi.fn(),
      refresh: vi.fn(async () => {}),
      logout: vi.fn(async () => { authStore.set({ status: AUTH_STATUS.ANONYMOUS, user: null }) })
    }
    emit()
  },
  get: () => state
}
authStore.reset()

const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }

export const mockAuthModule = {
  AUTH_STATUS,
  AuthProvider: ({ children }) => children,
  useAuth: () => useSyncExternalStore(subscribe, authStore.get),
  oauthLoginUrl: (base, target) => `${base}/auth/google?target=${target}`
}
