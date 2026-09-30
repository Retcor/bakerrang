import React, { useCallback, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { AccountSheet } from './AccountSheet.jsx'
import { AnnounceProvider, useAnnounce } from './announce.jsx'
import { Bar } from './Bar.jsx'
import { NotFound } from './NotFound.jsx'
import { Welcome } from './Welcome.jsx'

const CHECKING_DELAY_MS = 300

const Checking = () => {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), CHECKING_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <main className='ac-quiet' id='main'>
      {visible && <span><span className='ac-spin' aria-hidden='true' />Opening Account…</span>}
    </main>
  )
}

const Home = () => {
  const auth = useAuth()
  const announce = useAnnounce()
  const [signedOutHere, setSignedOutHere] = useState(false)
  const onSignedOut = useCallback(() => {
    setSignedOutHere(true)
    announce('Signed out.')
  }, [announce])

  if (auth.status === AUTH_STATUS.LOADING) return <><Bar signedIn={false} loading /><Checking /></>
  if (auth.status !== AUTH_STATUS.AUTHENTICATED) return <><Bar signedIn={false} /><Welcome focusHeading={signedOutHere} /></>
  return <AccountSheet onSignedOut={onSignedOut} />
}

const NotFoundPage = () => {
  const auth = useAuth()
  return <><Bar signedIn={auth.status === AUTH_STATUS.AUTHENTICATED} loading={auth.status === AUTH_STATUS.LOADING} /><NotFound /></>
}

export const App = () => (
  <AnnounceProvider>
    <Routes>
      <Route path='/' element={<Home />} />
      <Route path='*' element={<NotFoundPage />} />
    </Routes>
  </AnnounceProvider>
)
