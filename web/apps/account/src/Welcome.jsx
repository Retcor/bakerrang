/* eslint-disable react/jsx-handler-names */
import React, { useEffect, useRef } from 'react'
import { useAuth } from '@bakerrang/web-auth'
import { AppearanceSection } from './appearance/AppearanceSection.jsx'
import { GoogleIcon } from './Icons.jsx'

// Signed out: a masthead, the only gold action, three ruled facts, and a working Appearance
// section (the anonymous theme is saved in this browser).
export const Welcome = ({ focusHeading = false }) => {
  const auth = useAuth()
  const heading = useRef(null)
  useEffect(() => { if (focusHeading) heading.current?.focus() }, [focusHeading])
  return (
    <main className='ac-main' id='main'>
      <div className='ac-welcome'>
        <div className='ac-pagehead'>
          <h1 tabIndex={-1} ref={heading}>Your BakerRang account.</h1>
          <p>Sign in to see which Google account you're using, manage the voices Story Book and Polyglot speak in, and keep your theme on every device.</p>
          <div><button type='button' className='ac-btn ac-btn--gold ac-cta' onClick={auth.login}><GoogleIcon />Sign in with Google</button></div>
          <ul className='ac-facts'>
            <li><b>Profile</b><span>Your name and email, straight from Google.</span></li>
            <li><b>Voices</b><span>Clone your voice once, then Story Book and Polyglot can use it.</span></li>
            <li><b>Theme</b><span>Light, dark or system, for every BakerRang app.</span></li>
          </ul>
        </div>
        <AppearanceSection />
      </div>
    </main>
  )
}
