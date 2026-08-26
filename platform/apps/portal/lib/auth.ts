import { apiBaseUrl, apiSend } from './api'

export interface AuthUser {
  id: string
  displayName: string
  email: string
  photo: string | null
}

export type AuthResult =
  | { authenticated: false; user: null }
  | { authenticated: true; user: AuthUser }

export const loginUrl = () =>
  `${apiBaseUrl()}/auth/google?target=portal`

export const fetchAuth = async (): Promise<AuthResult> => {
  const response = await fetch(`${apiBaseUrl()}/auth/check`, {
    credentials: 'include'
  })

  if (response.status === 401) {
    return { authenticated: false, user: null }
  }
  if (!response.ok) {
    throw new Error(`Authentication check failed with status ${response.status}`)
  }

  const body = await response.json() as {
    isAuthenticated?: boolean
    user?: AuthUser
  }
  if (!body.isAuthenticated || !body.user) {
    throw new Error('Authentication response was invalid')
  }
  return { authenticated: true, user: body.user }
}

export const logout = async (): Promise<void> => {
  await apiSend<unknown>('POST', '/auth/logout')
}
