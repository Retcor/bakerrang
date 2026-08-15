'use client'

import { useState } from 'react'
import { Button, Container } from '@bakerrang/ui'
import { useAuth } from './providers/AuthProvider'
import { loginUrl } from '../lib/auth'
import { BusinessManager } from './businesses/BusinessManager'

export default function PortalPage () {
  const { status, user, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const startLogin = () => {
    window.location.assign(loginUrl())
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    setSignOutError(null)
    try {
      await signOut()
    } catch (error) {
      console.error('Unable to sign out:', error)
      setSignOutError('Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className="min-h-screen bg-bg py-12 sm:py-20">
      <Container>
        <div className="rounded-md border border-border bg-surface p-8 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
            Platform workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">
            BakerRang Business Platform
          </h1>
          {status === 'loading' && (
            <p className="mt-4 leading-7 text-fg-muted" role="status">
              Checking your sign-in status…
            </p>
          )}
          {status === 'anonymous' && (
            <>
              <p className="mt-4 leading-7 text-fg-muted">
                Manage your businesses, websites, and leads.
              </p>
              <div className="mt-7">
                <Button onClick={startLogin}>Sign in with Google</Button>
              </div>
            </>
          )}
          {status === 'authenticated' && user && (
            <>
              <div className="mt-6 border-t border-border pt-6">
                <p className="text-sm text-fg-muted">Signed in as:</p>
                <p className="mt-2 font-semibold text-fg">{user.displayName}</p>
                <p className="mt-1 text-fg-muted">{user.email}</p>
              </div>
              <div className="mt-7">
                <Button disabled={signingOut} onClick={() => void handleSignOut()}>
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </Button>
              </div>
              {signOutError && (
                <p className="mt-4 text-sm text-red-700" role="alert">{signOutError}</p>
              )}
              <BusinessManager />
            </>
          )}
        </div>
      </Container>
    </main>
  )
}
