/* eslint-disable react/jsx-handler-names */
import React from 'react'
import { AccountMenu, AppSwitcher, BrandLink } from '@bakerrang/web-app-shell'
import { useAuth } from '@bakerrang/web-auth'
import { Button } from '@bakerrang/web-ui'
import logoUrl from './assets-bakerrang-logo.png'
import { destinations } from './destinations.js'

// In Account the avatar menu omits its theme control: the sheet has the one full-size choice.
export const Bar = ({ signedIn, loading = false, onLogout }) => {
  const auth = useAuth()
  return (
    <header className='ac-bar'>
      <div className='ac-bar__in'>
        <BrandLink logoSrc={logoUrl} launcherUrl={destinations.launcher.url} appName='Account' appUrl='/' />
        <span className='ac-bar__sp' />
        {signedIn && (
          <div className='ac-bar__right'>
            <AppSwitcher destinations={destinations} current='account' />
            <AccountMenu destinations={destinations} onLogout={onLogout} />
          </div>
        )}
        {!signedIn && !loading && <Button variant='ghost' size='small' onClick={auth.login}>Sign in</Button>}
      </div>
    </header>
  )
}
