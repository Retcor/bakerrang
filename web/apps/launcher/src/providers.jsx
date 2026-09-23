import React from 'react'
import { createApiClient } from '@bakerrang/web-api-client'
import { AUTH_STATUS, AuthProvider, useAuth } from '@bakerrang/web-auth'
import { ThemeProvider } from '@bakerrang/web-theme'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const oauthTarget = import.meta.env.VITE_OAUTH_TARGET || 'launcher'
export const apiClient = createApiClient({ baseUrl: apiBaseUrl })

const ThemeBridge = ({ children }) => {
  const auth = useAuth()
  return (
    <ThemeProvider apiClient={apiClient} isAuthenticated={auth.status === AUTH_STATUS.AUTHENTICATED}>
      {children}
    </ThemeProvider>
  )
}

export const AppProviders = ({ children }) => (
  <AuthProvider
    apiClient={apiClient}
    apiBaseUrl={apiBaseUrl}
    oauthTarget={oauthTarget}
  >
    <ThemeBridge>{children}</ThemeBridge>
  </AuthProvider>
)
