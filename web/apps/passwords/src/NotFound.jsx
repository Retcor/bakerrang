import React from 'react'
import { Link } from 'react-router-dom'

export const NotFound = () => <main className='pw-gate'><section className='pw-gate-card'><p className='pw-kicker'>PAGE NOT FOUND</p><h1>That page isn't here.</h1><p>Your vault has not changed.</p><Link className='pw-button pw-button--gold' to='/'>Return to Passwords</Link></section></main>
