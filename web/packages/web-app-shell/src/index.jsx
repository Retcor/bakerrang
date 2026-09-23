import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { useTheme } from '@bakerrang/web-theme'
import { Button, IconButton } from '@bakerrang/web-ui'

export const TOOL_DEFINITIONS = Object.freeze([
  { id: 'storybook', name: 'Story Book', shortName: 'Story Book', accent: 'var(--accent-story)', path: '/storybook', envKey: 'VITE_STORYBOOK_URL' },
  { id: 'polyglot', name: 'Polyglot', shortName: 'Polyglot', accent: 'var(--accent-polyglot)', path: '/polyglot', envKey: 'VITE_POLYGLOT_URL' },
  { id: 'sign', name: 'Sign Language', shortName: 'Sign', accent: 'var(--accent-sign)', path: '/sign-language', envKey: 'VITE_SIGN_URL' },
  { id: 'budget', name: 'Budget', shortName: 'Budget', accent: 'var(--accent-budget)', path: '/budget', envKey: 'VITE_BUDGET_URL' },
  { id: 'wow', name: 'WoW Advisor', shortName: 'WoW', accent: 'var(--accent-wow)', path: '/wow', envKey: 'VITE_WOW_URL' },
  { id: 'passwords', name: 'Passwords', shortName: 'Passwords', accent: 'var(--accent-passwords)', path: '/passwords', envKey: 'VITE_PASSWORDS_URL' }
])

export const ACCOUNT_DEFINITION = Object.freeze({
  id: 'account',
  name: 'Account',
  accent: 'var(--accent-account)',
  path: '/account',
  envKey: 'VITE_ACCOUNT_URL'
})

export const resolveDestinations = (env = {}, legacyBase = 'https://bakerrang.com') => {
  const base = String(env.VITE_LEGACY_CLIENT_BASE_URL || legacyBase).replace(/\/$/, '')
  const withUrl = (definition) => ({
    ...definition,
    url: env[definition.envKey] || `${base}${definition.path}`
  })
  return {
    tools: TOOL_DEFINITIONS.map(withUrl),
    account: withUrl(ACCOUNT_DEFINITION)
  }
}

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
}

export const ProductEmblem = ({ id, className = '' }) => {
  const content = {
    storybook: <><path d='M16 8c-2-1.6-4.4-2.4-7-2.4-1.2 0-2.4.2-3 .4v16c.6-.2 1.8-.4 3-.4 2.6 0 5 .8 7 2.4M16 8c2-1.6 4.4-2.4 7-2.4 1.2 0 2.4.2 3 .4v16c-.6-.2-1.8-.4-3-.4-2.6 0-5 .8-7 2.4M16 8v16' /></>,
    polyglot: <><path d='M4 8h10M9 6v2M11.5 8c0 4-3 7-7.5 8.5M7 12c.8 2.2 3 3.8 5.5 4.5' /><path d='M17 26l4.5-10L26 26M18.7 22h5.6' /></>,
    sign: <path vectorEffect='non-scaling-stroke' transform='translate(3.1 2.1) scale(1.05)' d='M10.05 4.575a1.575 1.575 0 1 0-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 0 1 3.15 0v1.5m-3.15 0 .075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 0 1 3.15 0V15M6.9 7.575a1.575 1.575 0 1 0-3.15 0v8.175a6.75 6.75 0 0 0 6.75 6.75h2.018a5.25 5.25 0 0 0 3.712-1.538l1.732-1.732a5.25 5.25 0 0 0 1.538-3.712l.003-2.024a.668.668 0 0 1 .198-.471 1.575 1.575 0 1 0-2.228-2.228 3.818 3.818 0 0 0-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0 1 16.35 15m0 0a4.49 4.49 0 0 1 .186-1.317' />,
    budget: <><circle cx='16' cy='16' r='11' /><path d='M16 9.4v13.2' /><path d='M19.3 12.2c-.9-1-2.1-1.5-3.4-1.5-2 0-3.5 1-3.5 2.7 0 1.6 1.3 2.3 3.7 2.8 2.4.5 3.7 1.3 3.7 2.9 0 1.8-1.6 2.8-3.7 2.8-1.5 0-2.9-.6-3.8-1.7' /></>,
    // TODO(asset): replace this neutral crest only after an appropriate WoW asset is supplied and approved.
    wow: <><path d='M16 4l9 3v7c0 6-4 9.6-9 11.6C11 22.6 7 19 7 13V7z' /><path d='M16 10v9M12.5 13.5L16 11l3.5 2.5' /></>,
    passwords: <><rect x='7' y='14' width='18' height='12' rx='2.5' /><path d='M11 14v-3a5 5 0 0 1 10 0v3' /><circle cx='16' cy='20' r='1.6' /></>,
    account: <><circle cx='16' cy='12' r='5' /><path d='M6 26c1.8-4.4 5.6-6.5 10-6.5S24.2 21.6 26 26' /></>
  }[id]
  return <svg className={className} viewBox='0 0 32 32' aria-hidden='true' {...strokeProps}>{content}</svg>
}

const ThemeIcon = ({ value }) => {
  if (value === 'light') return <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><circle cx='12' cy='12' r='4' /><path d='M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19' /></svg>
  if (value === 'dark') return <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'><path d='M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z' /></svg>
  return <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinejoin='round'><rect x='3' y='4' width='18' height='12' rx='1.5' /><path d='M8 20h8M12 16v4' strokeLinecap='round' /></svg>
}

export const ThemeControl = () => {
  const { preference, setPreference } = useTheme()
  const handleThemeClick = (event) => setPreference(event.currentTarget.dataset.theme)
  return (
    <div className='br-theme-control' role='group' aria-label='Theme'>
      {['light', 'dark', 'system'].map((value) => (
        <button
          key={value}
          type='button'
          data-theme={value}
          title={`${value[0].toUpperCase()}${value.slice(1)} theme`}
          aria-label={`${value[0].toUpperCase()}${value.slice(1)} theme`}
          aria-pressed={preference === value}
          onClick={handleThemeClick}
        >
          <ThemeIcon value={value} />
          <span>{value[0].toUpperCase()}{value.slice(1)}</span>
        </button>
      ))}
    </div>
  )
}

const usePopover = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && ref.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  return { open, setOpen, ref }
}

const GridIcon = () => (
  <svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
    {[5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r='2' />))}
  </svg>
)

const GoogleIcon = () => <svg className='br-google-icon' viewBox='0 0 24 24' aria-hidden='true'><path fill='currentColor' d='M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1-.8 2.6-2.3 3.6l3.6 2.8c2.1-2 3.7-4.9 3.7-8.3zM12 24c3.2 0 5.9-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.3 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2l-3.7 2.9C3.2 21.3 7.3 24 12 24zM4.9 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.8C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.2l3.7-2.9zM12 4.8c1.8 0 3 .8 3.7 1.4l2.7-2.7C16.9 1.9 14.4.9 12 .9 7.3.9 3.2 3.6 1.2 6.8l3.7 2.9C5.9 6.7 8.7 4.8 12 4.8z' /></svg>

const initials = (user) => String(user?.displayName || user?.email || 'BR').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

export const AppHeader = ({ logoSrc, destinations, homeUrl = '/' }) => {
  const auth = useAuth()
  const switcher = usePopover()
  const profile = usePopover()
  const authenticated = auth.status === AUTH_STATUS.AUTHENTICATED
  const loading = auth.status === AUTH_STATUS.LOADING
  const tools = destinations.tools
  const account = destinations.account
  const handleLogin = auth.login
  const handleLogout = auth.logout
  const handleSwitcherClick = () => switcher.setOpen(!switcher.open)
  const handleProfileClick = () => profile.setOpen(!profile.open)

  return (
    <header className='br-topbar'>
      <div className='br-wrap br-topbar__inner'>
        <a className='br-brand' href={homeUrl} aria-label='BakerRang home'>
          <img className='br-brand__mark' src={logoSrc} alt='' />
          <span className='br-brand__word'>BakerRang</span>
        </a>
        <div className='br-topbar__spacer' />
        <div className='br-topbar__right'>
          <ThemeControl />
          {loading && <span className='br-auth-loading' aria-label='Checking sign-in status' />}
          {!loading && !authenticated && (
            <Button variant='gold' onClick={handleLogin}>
              <GoogleIcon />
              <span className='br-signin-full'>Sign in with Google</span>
              <span className='br-signin-short'>Sign in</span>
            </Button>
          )}
          {authenticated && (
            <>
              <div className={`br-menu ${switcher.open ? 'is-open' : ''}`} ref={switcher.ref}>
                <IconButton aria-label='Switch app' aria-haspopup='true' aria-expanded={switcher.open} onClick={handleSwitcherClick}><GridIcon /></IconButton>
                <div className='br-popover br-switcher' role='menu' aria-label='Your tools'>
                  <div className='br-popover__head'>Jump to a tool</div>
                  <div className='br-switcher__grid'>
                    {tools.map((tool) => (
                      <a key={tool.id} className='br-switcher__cell' role='menuitem' href={tool.url} style={{ '--accent': tool.accent }}>
                        <ProductEmblem id={tool.id} />
                        <span>{tool.shortName}</span>
                      </a>
                    ))}
                  </div>
                  <div className='br-popover__separator' />
                  <a className='br-popover__item' role='menuitem' href={account.url}>
                    <ProductEmblem id='account' />Account
                  </a>
                </div>
              </div>
              <div className={`br-menu ${profile.open ? 'is-open' : ''}`} ref={profile.ref}>
                <button className='br-avatar' aria-label='Account menu' aria-haspopup='true' aria-expanded={profile.open} onClick={handleProfileClick}>{initials(auth.user)}</button>
                <div className='br-popover' role='menu' aria-label='Account'>
                  <div className='br-profile-summary'>
                    <strong>{auth.user?.displayName || 'BakerRang user'}</strong>
                    <span>{auth.user?.email}</span>
                  </div>
                  <a className='br-popover__item' role='menuitem' href={account.url}><ProductEmblem id='account' />Account</a>
                  <div className='br-popover__separator' />
                  <button className='br-popover__item br-popover__danger' role='menuitem' onClick={handleLogout}>
                    <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'><path d='M15 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9' /><path d='M18 15l3-3-3-3M10 12h11' /></svg>
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export const AppFooter = ({ logoSrc, year = new Date().getFullYear() }) => (
  <footer className='br-footer'>
    <div className='br-wrap br-footer__inner'>
      <a className='br-brand' href='/' aria-label='BakerRang home'>
        <img className='br-brand__mark' src={logoSrc} alt='' />
        <span className='br-brand__word'>BakerRang</span>
      </a>
      <div className='br-footer__copy'>© {year} BakerRang · one maker, many tools</div>
    </div>
  </footer>
)

export const useDestinations = (env) => useMemo(() => resolveDestinations(env), [env])
