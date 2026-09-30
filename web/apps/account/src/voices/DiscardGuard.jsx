import React, { useEffect, useRef } from 'react'

// Inline "Discard …?" guard shown inside a dirty editor before it is replaced or the user signs out.
// Focus moves to it so the choice is announced and scrolled into view.
export const DiscardGuard = ({ signOut = false, onKeep, onDiscard }) => {
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus() }, [])
  return (
    <div className='ac-guard' role='group' aria-labelledby='ac-guard-q'>
      <strong id='ac-guard-q' tabIndex={-1} ref={heading}>{signOut ? 'Discard your changes and sign out?' : 'Discard your changes?'}</strong>
      <div className='ac-confirm__acts'>
        <button type='button' className='ac-btn ac-btn--ghost' onClick={onKeep}>Keep editing</button>
        <button type='button' className='ac-btn ac-btn--danger' onClick={onDiscard}>{signOut ? 'Discard and sign out' : 'Discard'}</button>
      </div>
    </div>
  )
}
