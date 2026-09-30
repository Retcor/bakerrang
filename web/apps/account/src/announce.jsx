import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const AnnounceContext = createContext(() => {})

// One polite status region for the whole page. Clearing first lets the same message
// be announced twice in a row (for example two "Saved" results).
export const AnnounceProvider = ({ children }) => {
  const [message, setMessage] = useState('')
  const timer = useRef(null)
  const announce = useCallback((next) => {
    window.clearTimeout(timer.current)
    setMessage('')
    timer.current = window.setTimeout(() => setMessage(next), 30)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div className='ac-sr' role='status' aria-live='polite'>{message}</div>
    </AnnounceContext.Provider>
  )
}

export const useAnnounce = () => useContext(AnnounceContext)
