import React from 'react'
import { AuthProvider, AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { ThemeProvider } from '@bakerrang/web-theme'
import { createApiClient } from '@bakerrang/web-api-client'

export const apiClient = createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080' })
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const ThemeBridge = ({ children }) => { const auth = useAuth(); return <ThemeProvider apiClient={apiClient} isAuthenticated={auth.status === AUTH_STATUS.AUTHENTICATED}>{children}</ThemeProvider> }
export const AppProviders = ({ children }) => <AuthProvider apiClient={apiClient} apiBaseUrl={apiBaseUrl} oauthTarget={import.meta.env.VITE_OAUTH_TARGET || 'passwords'}><ThemeBridge>{children}</ThemeBridge></AuthProvider>
