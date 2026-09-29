import React, { useEffect, useRef, useState } from 'react'
import { Icon, IconButton } from './Icons.jsx'
import { generatePassword } from '../vault/generator.js'
import { VaultApiError } from '../api/vault.js'
import { Listbox } from './Listbox.jsx'

const safeUrl = (value) => {
  try {
    const trimmed = value?.trim()
    if (!trimmed) return null
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

export const CopyButton = ({ value, label, copiedMessage, announce }) => {
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 2000); return () => window.clearTimeout(timer) }, [copied])
  const copy = () => {
    const failed = () => announce("Couldn't copy. Your browser blocked the clipboard.")
    if (!navigator.clipboard?.writeText) { failed(); return }
    navigator.clipboard.writeText(value || '').then(() => { setCopied(true); announce(copiedMessage) }, failed)
  }
  return <IconButton icon={copied ? 'check' : 'copy'} label={label} onClick={copy} />
}

export const MaskedSecret = ({ value, announce, name = 'password' }) => {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!shown) return
    const timer = window.setTimeout(() => { setShown(false); announce('Password hidden') }, 30000)
    const hide = () => { if (document.visibilityState === 'hidden') setShown(false) }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', hide)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', hide) }
  }, [shown, announce])
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 2000); return () => window.clearTimeout(timer) }, [copied])
  const copy = () => {
    if (!navigator.clipboard?.writeText) { announce("Couldn't copy. Your browser blocked the clipboard. Show password to select it manually."); return }
    navigator.clipboard.writeText(value || '').then(() => { setCopied(true); announce(`${name === 'password' ? 'Password' : 'Username'} copied`) }, () => announce("Couldn't copy. Your browser blocked the clipboard. Show password to select it manually."))
  }
  return <div className='pw-secret-row'><span className='pw-secret-value' aria-label={shown ? undefined : 'Password, hidden'}>{shown ? <span className='pw-secret'><span>{value}</span><i className='pw-drain' /><small className='pw-hide-hint'>Hides after 30 seconds</small></span> : <span aria-hidden='true' className='pw-mask'>••••••••••••</span>}</span><IconButton icon={shown ? 'eyeOff' : 'eye'} label={`${shown ? 'Hide' : 'Show'} password`} aria-pressed={shown} onClick={() => { setShown(!shown); announce(shown ? 'Password hidden' : 'Password shown') }} /><IconButton icon={copied ? 'check' : 'copy'} label='Copy password' onClick={copy} /></div>
}

const SecretInput = ({ inputRef, label, onDirty, generatedNonce }) => {
  const [shown, setShown] = useState(!globalThis.CSS?.supports?.('-webkit-text-security', 'disc'))
  useEffect(() => { if (generatedNonce) setShown(true) }, [generatedNonce])
  return <div className='pw-secret-input'><input ref={inputRef} id='entry-password' type='text' className={`pw-field ${shown ? '' : 'pw-mask-text'}`} autoComplete='off' autoCapitalize='off' autoCorrect='off' spellCheck='false' data-1p-ignore data-lpignore='true' aria-label={label} aria-describedby='pw-mask-description' onInput={onDirty} /><IconButton icon={shown ? 'eyeOff' : 'eye'} label={`${shown ? 'Hide' : 'Show'} new password`} onClick={() => setShown(!shown)} /><span id='pw-mask-description' className='pw-sr'>Masking is visual only. People near your screen may still be able to read the password.</span></div>
}

const EditEntry = ({ details, selected, folders, onSave, onCancel, onDelete, announce, onDirtyChange }) => {
  const isNew = !details?.record
  const [title, setTitle] = useState(details?.title || '')
  const [username, setUsername] = useState(details?.username || '')
  const [url, setUrl] = useState(details?.url || '')
  const [folderId, setFolderId] = useState(selected?.folderId || null)
  const [replacing, setReplacing] = useState(isNew)
  const [length, setLength] = useState(20)
  const [symbols, setSymbols] = useState(true)
  const [generatedNonce, setGeneratedNonce] = useState(0)
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState('')
  const [conflict, setConflict] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const notesRef = useRef(null)
  const passwordRef = useRef(null)
  useEffect(() => { if (notesRef.current) notesRef.current.value = details?.notes || '' }, [])
  const dirty = () => onDirtyChange(true)
  const save = async (event) => {
    event.preventDefault()
    if (!title.trim()) { setProblem('Add a title.'); return }
    setPending(true); setProblem('')
    try {
      const fields = { title: title.trim(), username, url, notes: notesRef.current?.value || '', password: replacing && passwordRef.current?.value ? passwordRef.current.value : (details?.password || '') }
      await onSave({ fields, record: details?.record || null, source: selected?.source || 'owned', folderId })
    } catch (error) {
      if (error instanceof VaultApiError && error.status === 409 && error.current) setConflict(error.current)
      else if (error instanceof VaultApiError && error.status === 404) setProblem('This entry was deleted somewhere else.')
      else setProblem('Could not save this entry. Check your connection, then try again.')
    } finally { setPending(false) }
  }
  const ownedFolders = folders.filter((folder) => folder.source === 'owned')
  return (
    <form className='pw-edit' onSubmit={save} aria-busy={pending}>
      {conflict && <div className='pw-inline-alert' role='alert'>This entry was changed somewhere else.<div className='pw-actions'><button type='button' className='pw-button pw-button--gold' onClick={() => onCancel(conflict)}>Use latest</button><button type='button' className='pw-button pw-button--quiet' onClick={() => setConflict(null)}>Cancel</button></div></div>}
      <label htmlFor='entry-title'>Title</label><input id='entry-title' className='pw-field' value={title} placeholder='e.g. Example Bank' onChange={(event) => { setTitle(event.target.value); dirty() }} />
      <label htmlFor='entry-username'>Username</label><input id='entry-username' className='pw-field' value={username} onChange={(event) => { setUsername(event.target.value); dirty() }} />
      <label htmlFor='entry-password'>Password</label>
      {replacing ? <><SecretInput inputRef={passwordRef} label='New password' onDirty={dirty} generatedNonce={generatedNonce} /><div className='pw-generator'><button type='button' className='pw-button pw-button--quiet' onClick={() => { passwordRef.current.value = generatePassword({ length, symbols }); setGeneratedNonce((n) => n + 1); dirty() }}>Generate</button><span>Length</span><button type='button' aria-label='Decrease length' onClick={() => setLength(Math.max(12, length - 1))}><Icon name='minus' /></button><output>{length}</output><button type='button' aria-label='Increase length' onClick={() => setLength(Math.min(64, length + 1))}><Icon name='plus' /></button><label><input type='checkbox' checked={symbols} onChange={(event) => setSymbols(event.target.checked)} /> Symbols</label></div></> : <div className='pw-unchanged'>Unchanged <button type='button' className='pw-button pw-button--quiet' onClick={() => { setReplacing(true); dirty() }}>Replace password</button></div>}
      <label htmlFor='entry-url'>Website</label><input id='entry-url' className='pw-field' value={url} placeholder='https://' onChange={(event) => { setUrl(event.target.value); dirty() }} />
      {selected?.source === 'owned' && <><label htmlFor='entry-folder'>Folder</label><Listbox id='entry-folder' label='Folder' value={folderId} onChange={(next) => { setFolderId(next); dirty() }} options={[{ value: null, label: 'Unfiled' }, ...ownedFolders.map((folder) => ({ value: folder.id, label: folder.name }))]} /></>}
      <label htmlFor='entry-notes'>Notes</label><textarea ref={notesRef} id='entry-notes' className='pw-field pw-notes' onInput={dirty} />
      {problem && <p role='alert' className='pw-inline-alert'>{problem}</p>}
      {confirmDelete && <div className='pw-inline-alert'>Delete {title}? It moves to Activity history and leaves your vault. This can't be undone.<div className='pw-actions'><button type='button' className='pw-button pw-button--danger' onClick={onDelete}>Delete</button><button type='button' className='pw-button pw-button--quiet' onClick={() => setConfirmDelete(false)}>Keep it</button></div></div>}
      <div className='pw-edit-footer'>{!isNew && selected?.source === 'owned' && <IconButton icon='trash' label={`Delete ${title}`} onClick={() => setConfirmDelete(true)} />}<span /><button type='button' className='pw-button pw-button--ghost' onClick={() => onCancel(null)}>Cancel</button><button type='submit' className='pw-button pw-button--gold' aria-disabled={pending}>{pending ? 'Saving…' : isNew ? 'Add entry' : 'Save'}</button></div>
    </form>
  )
}

export const EntrySheet = ({ entry, vault, folders, onClose, onRequestDiscard, onDiscardNew, onSaved, onDeleted, onHistory, onDirtyChange, announce }) => {
  const [details, setDetails] = useState(null)
  const [mode, setMode] = useState(entry.id ? 'view' : 'edit')
  const [problem, setProblem] = useState('')
  const titleRef = useRef(null)
  useEffect(() => {
    let live = true
    if (entry.id) vault.openEntry(entry).then((result) => { if (live) { setDetails(result); setProblem(result ? '' : 'This entry is no longer available.') } }, () => { if (live) setProblem("This entry can't be decrypted with your keys.") })
    return () => { live = false; setDetails(null) }
  }, [entry.id, entry.source])
  useEffect(() => { if (mode === 'edit') document.getElementById('entry-title')?.focus(); else titleRef.current?.focus() }, [details, mode])
  const selected = details ? { ...entry, ...details } : entry
  const permission = entry.source.startsWith('shared:') ? vault.shared.find((share) => `shared:${share.ownerId}:${share.shareId}` === entry.source)?.permission : 'edit'
  const save = async (payload) => { const result = await vault.saveEntry(payload); if (result) { announce(`Saved ${payload.fields.title}.`); setDetails({ ...payload.fields, record: result, source: entry.source }); setMode('view'); onSaved(result, entry.source, payload.fields.title) } }
  const deleted = async () => { await vault.deleteEntry(entry); announce(`Deleted ${entry.title}.`); onDeleted() }
  const latest = async (record) => { if (record) { try { const fields = await vault.decryptRecord(record, entry.source); setDetails({ ...fields, record, source: entry.source }); setMode('view'); onSaved(record, entry.source, fields.title); return } catch { setProblem("This version can't be decrypted with your keys."); return } }; onRequestDiscard(() => { onDirtyChange(false); if (entry.id) setMode('view'); else onDiscardNew() }) }
  return (
    <section className='pw-sheet' aria-label={entry.title || 'New entry'}><header className='pw-sheet-head'><IconButton icon='back' label='Close entry' onClick={onClose} /><h2 ref={titleRef} tabIndex='-1'>{entry.title || 'New entry'}</h2>{entry.id && mode === 'view' && <><IconButton icon='clock' label='Version history' onClick={() => onHistory(entry)} />{permission === 'edit' && <IconButton icon='edit' label={`Edit ${entry.title}`} onClick={() => setMode('edit')} />}</>}</header>
      {problem && <div className='pw-inline-alert' role='alert'>{problem}</div>}
      {mode === 'edit' && (!entry.id || details) && <EditEntry details={details} selected={selected} folders={folders} onSave={save} onCancel={latest} onDelete={deleted} announce={announce} onDirtyChange={onDirtyChange} />}
      {mode === 'view' && details && <div className='pw-sheet-body'><div className='pw-value-row'><span className='pw-label'>Username</span><div>{details.username || '—'}<CopyButton value={details.username} label='Copy username' copiedMessage='Username copied' announce={announce} /></div></div><div className='pw-value-row'><span className='pw-label'>Password</span><MaskedSecret value={details.password} announce={announce} /></div><div className='pw-value-row'><span className='pw-label'>Website</span><div>{safeUrl(details.url) ? <a href={safeUrl(details.url)} target='_blank' rel='noopener noreferrer'>{details.url}<Icon name='open' /></a> : (details.url || '—')}</div></div><div className='pw-value-row'><span className='pw-label'>Folder</span><div>{folders.find((folder) => folder.source === entry.source && folder.id === entry.folderId)?.name || 'Unfiled'}</div></div><div className='pw-value-row'><span className='pw-label'>Notes</span><p className='pw-note-value'>{details.notes || '—'}</p></div><small className='pw-meta'>Changed {new Date(details.record.updatedAt).toLocaleDateString()}</small></div>}
    </section>
  )
}
