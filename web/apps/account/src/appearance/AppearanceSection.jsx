import React, { useEffect, useRef } from 'react'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { useTheme } from '@bakerrang/web-theme'
import { useAnnounce } from '../announce.jsx'
import { Icon } from '../Icons.jsx'
import { Relay } from './Relay.jsx'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'system' }
]

const labelOf = (value) => `${value[0].toUpperCase()}${value.slice(1)}`

// One status line under the Relay. Theme is the shared web-theme behavior; Account only renders
// its persistence state and offers a retry through the same setPreference call.
const ThemeStatus = ({ signedIn, persistence, onRetry }) => {
  if (!signedIn) return <p className='ac-status'><Icon name='info' />Saved in this browser. Sign in to keep it on every device.</p>
  if (persistence === 'saving') return <p className='ac-status'><span className='ac-spin' aria-hidden='true' />Saving to your account…</p>
  if (persistence === 'error') {
    return (
      <div className='ac-status ac-status--problem' role='alert'>
        <Icon name='alert' />
        <span>Changed on this browser, but not saved to your account. <span className='ac-sub'>Your other devices won't pick it up yet.</span></span>
        <button type='button' className='ac-btn ac-btn--quiet ac-btn--sm' onClick={onRetry}>Try again</button>
      </div>
    )
  }
  if (persistence === 'saved') return <p className='ac-status'><Icon name='check' />Saved to your account. Your other devices pick it up the next time they open BakerRang.</p>
  return <p className='ac-status' aria-hidden='true' />
}

export const AppearanceSection = () => {
  const auth = useAuth()
  const announce = useAnnounce()
  const { preference, resolvedTheme, persistence, setPreference } = useTheme()
  const signedIn = auth.status === AUTH_STATUS.AUTHENTICATED
  // The choice awaiting its persistence result, so the outcome is announced once.
  const awaiting = useRef(null)

  const choose = (event) => {
    const value = event.target.value
    if (value === preference) return
    awaiting.current = signedIn ? labelOf(value) : null
    setPreference(value)
    if (!signedIn) announce(`Theme set to ${labelOf(value)}. Saved in this browser.`)
  }

  const retry = () => {
    awaiting.current = labelOf(preference)
    setPreference(preference)
  }

  useEffect(() => {
    const name = awaiting.current
    if (!name) return
    if (persistence === 'saved') {
      awaiting.current = null
      announce(`Theme set to ${name}. Saved to your account.`)
    } else if (persistence === 'error') {
      awaiting.current = null
      announce(`Theme set to ${name} on this browser. It couldn't be saved to your account.`)
    }
  }, [announce, persistence])

  return (
    <section className='ac-sec' id='appearance' aria-labelledby='ac-h-appearance'>
      <div className='ac-sec__head'><h2 id='ac-h-appearance'>Appearance</h2></div>
      <div className='ac-row'>
        <div className='ac-row__label' id='ac-lbl-theme'>Theme</div>
        <div className='ac-row__value'>
          <div className='ac-choice' role='radiogroup' aria-labelledby='ac-lbl-theme'>
            {OPTIONS.map((option) => (
              <label key={option.value}>
                <input type='radio' name='theme' value={option.value} checked={preference === option.value} onChange={choose} />
                <Icon name={option.icon} />{option.label}
              </label>
            ))}
          </div>
          <p className='ac-hint' id='ac-theme-hint'>{preference === 'system' ? `Follows this device. It's ${resolvedTheme} right now.` : 'Every BakerRang app on this browser uses it.'}</p>
        </div>
      </div>
      <div className='ac-row'>
        <div className='ac-row__label' id='ac-lbl-relay'>Applies to</div>
        <div className='ac-row__value'>
          <Relay resolvedTheme={resolvedTheme} labelledBy='ac-lbl-relay' />
          <ThemeStatus signedIn={signedIn} persistence={persistence} onRetry={retry} />
        </div>
      </div>
    </section>
  )
}
