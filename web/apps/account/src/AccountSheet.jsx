import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@bakerrang/web-auth'
import { AppearanceSection } from './appearance/AppearanceSection.jsx'
import { Bar } from './Bar.jsx'
import { Icon } from './Icons.jsx'
import { ProfileSection } from './profile/ProfileSection.jsx'
import { SectionRail } from './SectionRail.jsx'
import { SessionSection } from './session/SessionSection.jsx'
import { createVoicesApi } from './api/voices.js'
import { apiClient } from './providers.jsx'
import { useOnline } from './useOnline.js'
import { VoicesSection } from './voices/VoicesSection.jsx'
import { useVoices } from './voices/useVoices.js'

const voicesApi = createVoicesApi(apiClient)

const sameEditor = (a, b) => a && b && a.kind === b.kind && a.id === b.id

// The signed-in sheet: page head, section rail and the four sections. It owns the one open editor
// (Add voice, one Rename, or one delete confirm) so that opening another editor, and Sign out, can
// ask before discarding unsaved input.
export const AccountSheet = ({ onSignedOut }) => {
  const auth = useAuth()
  const online = useOnline()
  const [editor, setEditor] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(null)
  const [signOutState, setSignOutState] = useState('idle')
  const model = useVoices({ api: voicesApi, active: true, editorOpen: Boolean(editor), onUnauthorized: auth.refresh })

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) document.getElementById(hash)?.scrollIntoView()
  }, [])

  const close = useCallback(() => { setEditor(null); setDirty(false); setPending(null) }, [])
  const request = useCallback((next) => {
    if (sameEditor(editor, next)) return
    if (editor && dirty) { setPending({ type: 'editor', next }); return }
    setEditor(next)
    setDirty(false)
    setPending(null)
  }, [dirty, editor])

  const signOut = useCallback(async () => {
    setSignOutState('working')
    try {
      await auth.logout()
      onSignedOut?.()
    } catch {
      setSignOutState('failed')
    }
  }, [auth, onSignedOut])

  const requestSignOut = useCallback(() => {
    if (editor && dirty) { setPending({ type: 'signout' }); return }
    signOut()
  }, [dirty, editor, signOut])

  const guard = useMemo(() => {
    if (!pending || !editor || !dirty) return null
    return {
      signOut: pending.type === 'signout',
      onKeep: () => setPending(null),
      onDiscard: () => {
        const action = pending
        setPending(null)
        setDirty(false)
        if (action.type === 'editor') setEditor(action.next)
        else { setEditor(null); signOut() }
      }
    }
  }, [dirty, editor, pending, signOut])

  const editorApi = useMemo(() => ({ request, close, setDirty, guard }), [close, guard, request])

  return (
    <>
      <Bar signedIn onLogout={requestSignOut} />
      <main className='ac-main' id='main'>
        <div className='ac-col'>
          <div className='ac-pagehead'>
            <h1 id='top'>Account</h1>
            <p>Who you're signed in as, how every BakerRang app looks, and the voices Story Book and Polyglot speak in.</p>
          </div>
          {!online && (
            <div className='ac-notice' role='status'>
              <Icon name='offline' />
              <strong>You're offline.</strong>
              <span>You can look around, but changes can't be saved until you're back.</span>
            </div>
          )}
          <div className='ac-layout'>
            <SectionRail />
            <div className='ac-sheet'>
              <ProfileSection user={auth.user} />
              <AppearanceSection />
              <VoicesSection model={model} editor={editor} editorApi={editorApi} online={online} />
              <SessionSection user={auth.user} signOut={signOutState} onSignOut={requestSignOut} />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
