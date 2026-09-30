import React from 'react'
import { Icon } from '../Icons.jsx'

export const initialsOf = (user) => String(user?.displayName || user?.email || 'BR').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

// Read-only, Google-backed identity: name, email, provenance and a fixed link out. Never a photo,
// never the internal user id, never an edit control (docs/apps/PhaseH-Account.md §6).
export const ProfileSection = ({ user }) => (
  <section className='ac-sec' id='profile' aria-labelledby='ac-h-profile'>
    <div className='ac-sec__head'><h2 id='ac-h-profile'>Profile</h2></div>
    <div className='ac-plate'>
      <div className='ac-mono' aria-hidden='true'>{initialsOf(user)}</div>
      <div>
        <p className='ac-plate__name'>{user?.displayName || 'BakerRang user'}</p>
        <div className='ac-plate__mail'>
          {user?.email && <span>{user.email}</span>}
          <span className='ac-tag'>From Google</span>
        </div>
        <a className='ac-link' href='https://myaccount.google.com/' target='_blank' rel='noopener noreferrer'>
          Manage your Google account<Icon name='ext' /><span className='ac-sr'> (opens in a new tab)</span>
        </a>
      </div>
    </div>
    <p className='ac-hint ac-plate__hint'>You sign in with Google. Change your name and email there; BakerRang picks them up the next time you sign in.</p>
  </section>
)
