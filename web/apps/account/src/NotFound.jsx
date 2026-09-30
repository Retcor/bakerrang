import React from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icons.jsx'

export const NotFound = () => (
  <main className='ac-main' id='main'>
    <div className='ac-nf'>
      <h1>That page isn't in Account.</h1>
      <p>Your profile, theme, voices and session are all on one page.</p>
      <Link className='ac-btn ac-btn--ghost' to='/'><Icon name='back' />Back to Account</Link>
    </div>
  </main>
)
