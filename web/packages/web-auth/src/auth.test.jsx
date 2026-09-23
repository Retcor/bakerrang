// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STATUS, AuthProvider, oauthLoginUrl, useAuth } from './index.jsx'

const Harness = () => {
  const auth = useAuth()
  return <div><output>{auth.status}</output><span>{auth.user?.displayName}</span></div>
}

const browser = () => ({
  setInterval: vi.fn(() => 1),
  clearInterval: vi.fn(),
  location: { assign: vi.fn() }
})

afterEach(cleanup)

describe('AuthProvider', () => {
  it('moves from loading to anonymous on a 401', async () => {
    const apiClient = { request: vi.fn().mockResolvedValue({ status: 401, ok: false }) }
    render(
      <AuthProvider apiClient={apiClient} apiBaseUrl='https://api.example' oauthTarget='launcher' windowObject={browser()}>
        <Harness />
      </AuthProvider>
    )
    expect(screen.getByText(AUTH_STATUS.LOADING)).not.toBeNull()
    await waitFor(() => expect(screen.getByText(AUTH_STATUS.ANONYMOUS)).not.toBeNull())
  })

  it('moves from loading to authenticated with the API user', async () => {
    const apiClient = {
      request: vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ isAuthenticated: true, user: { displayName: 'Alex Rang' } })
      })
    }
    render(
      <AuthProvider apiClient={apiClient} apiBaseUrl='https://api.example' oauthTarget='launcher' windowObject={browser()}>
        <Harness />
      </AuthProvider>
    )
    await waitFor(() => expect(screen.getByText(AUTH_STATUS.AUTHENTICATED)).not.toBeNull())
    expect(screen.getByText('Alex Rang')).not.toBeNull()
  })
})

describe('Launcher OAuth target', () => {
  it('builds the closed symbolic Launcher login URL', () => {
    expect(oauthLoginUrl('https://api.bakerrang.com', 'launcher')).toBe(
      'https://api.bakerrang.com/auth/google?target=launcher'
    )
  })

  it('rejects redirect-like targets in the client helper', () => {
    expect(() => oauthLoginUrl('https://api.example', 'https://evil.example')).toThrow('symbolic')
  })
})
