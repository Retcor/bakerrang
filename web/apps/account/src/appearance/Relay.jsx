import React, { useEffect, useState } from 'react'
import { ProductEmblem } from '@bakerrang/web-app-shell'
import logoUrl from '../assets-bakerrang-logo.png'

export const RELAY_APPS = Object.freeze([
  { id: 'launcher', name: 'Launcher' },
  { id: 'storybook', name: 'Story Book' },
  { id: 'polyglot', name: 'Polyglot' },
  { id: 'sign', name: 'Sign' },
  { id: 'budget', name: 'Budget' },
  { id: 'passwords', name: 'Passwords' }
])

export const RELAY_STAGGER_MS = 40

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// The Relay: six ground samples. The sheet repaints at once; each tile keeps the previous ground,
// then takes the new one left to right, 40ms apart (the CSS gives each 160ms). It is presentation
// only: it shows what one switch reaches and carries no state of its own beyond the animation.
// Under reduced motion every tile changes together, immediately, with no timers.
export const Relay = ({ resolvedTheme, labelledBy }) => {
  const [grounds, setGrounds] = useState(() => RELAY_APPS.map(() => resolvedTheme))

  useEffect(() => {
    if (grounds.every((ground) => ground === resolvedTheme)) return undefined
    if (prefersReducedMotion()) {
      setGrounds(RELAY_APPS.map(() => resolvedTheme))
      return undefined
    }
    const timers = RELAY_APPS.map((app, index) => window.setTimeout(() => {
      setGrounds((current) => current.map((ground, position) => position === index ? resolvedTheme : ground))
    }, index * RELAY_STAGGER_MS))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
    // The animation restarts only when the resolved theme changes.
  }, [resolvedTheme])

  return (
    <ul className='ac-relay' aria-labelledby={labelledBy}>
      {RELAY_APPS.map((app, index) => (
        <li key={app.id} data-app={app.id} data-ground={grounds[index]}>
          {app.id === 'launcher' ? <img src={logoUrl} alt='' /> : <ProductEmblem id={app.id} />}
          <span className='ac-sr'>{app.name}</span>
        </li>
      ))}
    </ul>
  )
}
