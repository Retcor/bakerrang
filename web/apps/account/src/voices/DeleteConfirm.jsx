import React, { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icons.jsx'

const FAILURES = {
  busy: 'Too many requests. Please wait a moment, then try again.',
  auth: 'Your session ended. Sign in again to delete the voice.'
}

// Inline delete confirm. Focus lands on the question so the consequence is read first.
export const DeleteConfirm = ({ voice, deleting, online, onKeep, onDelete }) => {
  const question = useRef(null)
  const [problem, setProblem] = useState('')
  useEffect(() => { question.current?.focus() }, [])

  const confirm = async () => {
    if (deleting || !online) return
    setProblem('')
    const result = await onDelete()
    if (!result.ok && result.kind !== 'stale' && result.kind !== 'not_found') setProblem(FAILURES[result.kind] || "Couldn't delete the voice. Nothing was changed.")
  }

  return (
    <li className='ac-confirm' role='group' aria-labelledby={`ac-delete-q-${voice.id}`}>
      <strong id={`ac-delete-q-${voice.id}`} tabIndex={-1} ref={question}>Delete {voice.name}?</strong>
      <p>It's removed from ElevenLabs too, so Story Book and Polyglot can't speak in it anymore. This can't be undone.</p>
      {problem && <p className='ac-err' role='alert' style={{ color: 'var(--ink)' }}><Icon name='alert' />{problem}</p>}
      <div className='ac-confirm__acts'>
        <button type='button' className='ac-btn ac-btn--ghost' onClick={onKeep}>Keep it</button>
        <button type='button' className='ac-btn ac-btn--danger' aria-disabled={deleting || !online || undefined} onClick={confirm}>{deleting ? <><span className='ac-spin' aria-hidden='true' />Deleting…</> : 'Delete'}</button>
      </div>
    </li>
  )
}
