/* eslint-disable react/jsx-handler-names */
import React, { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { DiscardGuard } from './DiscardGuard.jsx'

const FAILURES = {
  provider: "Couldn't rename the voice. Nothing was changed.",
  server: "Couldn't rename the voice. Nothing was changed.",
  network: "Couldn't rename the voice. Nothing was changed.",
  busy: 'Too many requests. Please wait a moment, then try again.',
  invalid: 'Check the name and description, then try again.',
  auth: 'Your session ended. Sign in again to rename the voice.',
  not_found: 'This voice was deleted somewhere else.'
}

// Rename in place. Save is explicit; nothing is written until then.
export const RenameEditor = ({ voice, saving, online, onSave, onCancel, onDirtyChange, guard }) => {
  const [name, setName] = useState(voice.name)
  const [description, setDescription] = useState(voice.description)
  const [problem, setProblem] = useState('')
  const [invalid, setInvalid] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])
  const dirty = name !== voice.name || description !== voice.description
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const submit = async (event) => {
    event.preventDefault()
    if (saving || !online) return
    if (!name.trim()) {
      setInvalid(true)
      setProblem('Give the voice a name.')
      nameRef.current?.focus()
      return
    }
    setInvalid(false)
    setProblem('')
    const result = await onSave({ name: name.trim(), description: description.trim() })
    if (!result.ok && result.kind !== 'stale') setProblem(FAILURES[result.kind] || FAILURES.provider)
  }

  return (
    <li className='ac-editor' id={`ac-rename-${voice.id}`}>
      <form onSubmit={submit} aria-labelledby={`ac-rename-h-${voice.id}`} aria-busy={saving || undefined} noValidate>
        {guard && <DiscardGuard signOut={guard.signOut} onKeep={guard.onKeep} onDiscard={guard.onDiscard} />}
        <h3 id={`ac-rename-h-${voice.id}`}>Rename {voice.name}</h3>
        <p className='ac-editor__intro'>The new name shows in Story Book and Polyglot.</p>
        <div className='ac-fields'>
          <div className='ac-f ac-f--3'>
            <label htmlFor={`ac-rename-name-${voice.id}`}>Name</label>
            <input className='ac-in' id={`ac-rename-name-${voice.id}`} ref={nameRef} maxLength={60} autoComplete='off' value={name} disabled={saving} aria-invalid={invalid || undefined} aria-describedby={problem ? `ac-rename-status-${voice.id}` : undefined} onChange={(event) => { setName(event.target.value); setInvalid(false); setProblem('') }} />
          </div>
          <div className='ac-f ac-f--3'>
            <label htmlFor={`ac-rename-desc-${voice.id}`}>Description <small>(optional)</small></label>
            <input className='ac-in' id={`ac-rename-desc-${voice.id}`} maxLength={200} autoComplete='off' value={description} disabled={saving} onChange={(event) => { setDescription(event.target.value); setProblem('') }} />
          </div>
        </div>
        <div className='ac-foot'>
          <span className={`ac-foot__status ${problem ? 'is-problem' : ''}`} id={`ac-rename-status-${voice.id}`} role={problem ? 'alert' : undefined}>{problem && <><Icon name='alert' />{problem}</>}</span>
          <button type='button' className='ac-btn ac-btn--quiet' onClick={onCancel}>Cancel</button>
          <button type='submit' className='ac-btn ac-btn--ink' aria-disabled={saving || !online || undefined}>{saving ? <><span className='ac-spin' aria-hidden='true' />Saving…</> : 'Save'}</button>
        </div>
      </form>
    </li>
  )
}
