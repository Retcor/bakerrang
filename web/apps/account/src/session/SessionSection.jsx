import React from 'react'
import { Icon } from '../Icons.jsx'
import { passwordsUrl } from '../destinations.js'

// Session: where app-owned settings live, what is not available yet, and Sign out last
// (docs/apps/PhaseH-Account.md §8, §12). Account owns no app settings; Passwords owns its own.
// `signOut` is 'idle' | 'working' | 'failed' and belongs to the sheet, so the avatar menu shares it.
export const SessionSection = ({ user, signOut, onSignOut }) => {
  const signingOut = signOut === 'working'
  const failed = signOut === 'failed'
  return (
    <section className='ac-sec' id='session' aria-labelledby='ac-h-session'>
      <div className='ac-sec__head'><h2 id='ac-h-session'>Session</h2></div>
      <div className='ac-row'>
        <div className='ac-row__label'>App settings</div>
        <div className='ac-row__value'>
          <p>Vault lock timing and browser-extension autofill are in Passwords.</p>
          <a className='ac-link' href={passwordsUrl}>Open Vault settings in Passwords<Icon name='arrow' /></a>
        </div>
      </div>
      <div className='ac-row'>
        <div className='ac-row__label'>Your data</div>
        <div className='ac-row__value'>
          <p style={{ color: 'var(--ink-2)' }}>Deleting your BakerRang account or downloading a copy of your data isn't available yet.</p>
        </div>
      </div>
      <div className='ac-row ac-row--last'>
        <div className='ac-row__label'>Signed in</div>
        <div className='ac-row__value'>
          <div className='ac-row__line'>
            <span style={{ overflowWrap: 'anywhere' }}>{user?.email ? `${user.email} on this browser` : 'On this browser'}</span>
            <button type='button' className='ac-btn ac-btn--danger ac-btn--sm' style={{ marginLeft: 'auto' }} aria-disabled={signingOut || undefined} onClick={() => { if (!signingOut) onSignOut() }}>
              {signingOut ? <span className='ac-spin' aria-hidden='true' /> : <Icon name='signout' />}Sign out
            </button>
          </div>
          <p className='ac-hint'>Signing out here signs you out of every BakerRang app in this browser. Other devices stay signed in.</p>
          {failed && <p className='ac-err' role='alert' style={{ marginTop: 8 }}><Icon name='alert' />Couldn't sign you out. Check your connection, then try again.</p>}
        </div>
      </div>
    </section>
  )
}
