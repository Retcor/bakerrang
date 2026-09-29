import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '@bakerrang/web-auth'
import { vaultRequest } from '../api/vault.js'
import { MaskedSecret } from '../entry/EntrySheet.jsx'
import { Listbox } from '../entry/Listbox.jsx'
import { decryptFolder, rewrapItemKeyForFolder } from '../vault/crypto.js'

const fileField = (value) => value == null ? '' : typeof value === 'string' ? value : typeof value.getText === 'function' ? value.getText() : String(value)
const actionName = { 'item.create': 'Created', 'item.update': 'Edited', 'item.move': 'Moved', 'item.delete': 'Deleted', 'folder.create': 'Folder created', 'folder.update': 'Folder renamed', 'folder.move': 'Folder moved', 'folder.delete': 'Folder deleted', 'vault.key-change': 'Vault key changed' }
const fieldsToCompare = [['title', 'Title'], ['username', 'Username'], ['url', 'Website'], ['notes', 'Notes'], ['password', 'Password']]
const eventTime = (value) => {
  const date = new Date(value)
  const today = new Date()
  const days = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000)
  const relative = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : ''
  const absolute = date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return relative ? `${relative} · ${absolute}` : absolute
}

const TimelineEvent = ({ row, previous, vault, announce, viewer }) => {
  const { record, fields } = row
  const actor = record.actorId === viewer?.id ? 'You' : record.actorEmail || 'Another collaborator'
  const changes = fields && previous && record.action === 'item.update'
    ? fieldsToCompare.filter(([key]) => (fields[key] || '') !== (previous[key] || ''))
    : []
  const unchanged = previous && record.action === 'item.update'
    ? fieldsToCompare.filter(([key]) => (fields[key] || '') === (previous[key] || '')).map(([, label]) => label.toLowerCase())
    : []
  const title = fields?.title || fields?.name || (record.targetType === 'vault' ? 'Vault' : vault.index.find((item) => item.id === record.targetId)?.title || 'An entry')
  return <li className={`pw-history-event pw-history-${record.action.split('.')[1]}`}><div><b>{actionName[record.action] || record.action}</b><time dateTime={new Date(record.createdAt).toISOString()}>{eventTime(record.createdAt)}</time></div><p>{title}</p><small>by {actor}</small>{record.meta && <p>From {vault.folders.find((folder) => folder.id === record.meta.fromFolderId)?.name || 'Unfiled'} to {vault.folders.find((folder) => folder.id === record.meta.toFolderId)?.name || 'Unfiled'}</p>}{changes.length > 0 && <div className='pw-history-diff'><b>Changed</b>{changes.map(([key, label]) => <div key={key}><span>{label}</span>{key === 'password' ? <MaskedSecret value={fields.password} announce={announce} /> : <span><del>{previous[key] || '—'}</del> → <ins>{fields[key] || '—'}</ins></span>}</div>)}</div>}{unchanged.length > 0 && <small>{unchanged.join(', ')} did not change.</small>}{fields && record.targetType === 'item' && <details open={record.action === 'item.create'}><summary>{record.action === 'item.create' ? 'Fields when created' : record.action === 'item.delete' ? 'Show what it held' : 'Show this version'}</summary><dl><dt>Username</dt><dd>{fields.username || '—'}</dd><dt>Website</dt><dd>{fields.url || '—'}</dd><dt>Notes</dt><dd className='pw-note-value'>{fields.notes || '—'}</dd><dt>Password</dt><dd><MaskedSecret value={fields.password} announce={announce} /></dd></dl></details>}</li>
}

const History = ({ dialog, vault, announce }) => {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [problem, setProblem] = useState('')
  const [before, setBefore] = useState(null)
  const [more, setMore] = useState(false)
  const [search, setSearch] = useState('')
  const entry = dialog.entry
  const shared = entry?.source.startsWith('shared:')
  const base = shared ? `/shared/${entry.source.split(':')[1]}/audit/item/${entry.id}` : entry ? `/audit/item/${entry.id}` : dialog.folder ? `/audit/folder/${dialog.folder.id}` : '/audit'
  const fetchMore = async (cursor = null) => {
    try {
      const records = await vaultRequest(`${base}?limit=50${cursor ? `&before=${cursor}` : ''}`)
      const decrypted = await Promise.all(records.map(async (record) => {
        if (!record.snapshot) return { record, fields: null }
        try { return { record, fields: record.targetType === 'item' ? await vault.decryptRecord(record.snapshot, entry?.source || 'owned') : record.targetType === 'folder' ? await decryptFolder(vault.vaultKey(), record.snapshot) : null } } catch { return { record, fields: null } }
      }))
      setRows((prior) => cursor ? [...prior, ...decrypted] : decrypted)
      setBefore(records.at(-1)?.createdAt || null)
      setMore(records.length === 50)
    } catch { setProblem('Could not load version history. Check your connection, then try again.') }
  }
  useEffect(() => { fetchMore() }, [base])
  const filtered = rows.filter(({ record, fields }) => `${actionName[record.action] || record.action} ${fields?.title || ''} ${fields?.username || ''} ${fields?.url || ''} ${record.actorEmail || ''}`.toLowerCase().includes(search.toLowerCase()))
  return <><p className='pw-dialog-lead'>Deleted entries remain in Activity history. BakerRang cannot read them, and they cannot be removed yet.</p>{!entry && <label className='pw-dialog-field'>Search entries, folders, people<input className='pw-field' value={search} onChange={(event) => setSearch(event.target.value)} /></label>}{problem && <p role='alert' className='pw-inline-alert'>{problem}</p>}<div className='pw-history-legend'><span>Created</span><span>Edited</span><span>Moved</span><span>Deleted</span></div><ol className='pw-timeline'>{filtered.map((row) => { const at = rows.indexOf(row); const previous = rows.slice(at + 1).find((candidate) => candidate.record.targetId === row.record.targetId && candidate.fields)?.fields; return <TimelineEvent key={row.record.id} row={row} previous={previous} vault={vault} announce={announce} viewer={user} /> })}</ol>{more && <button className='pw-button pw-button--ghost' onClick={() => fetchMore(before)}>Load earlier changes</button>}</>
}

const Import = ({ vault, scope, onDone }) => {
  const [file, setFile] = useState(null)
  const [keyFile, setKeyFile] = useState(null)
  const passwordRef = useRef(null)
  const [entries, setEntries] = useState(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [progress, setProgress] = useState('')
  const parse = async () => {
    setBusy(true); setProblem('')
    try {
      const { getKdbxweb, ensureArgon2 } = await import('../vault/kdbx.js')
      ensureArgon2()
      const kdbx = getKdbxweb()
      const credentials = new kdbx.Credentials(passwordRef.current.value ? kdbx.ProtectedValue.fromString(passwordRef.current.value) : null, keyFile ? await keyFile.arrayBuffer() : null)
      const db = await kdbx.Kdbx.load(await file.arrayBuffer(), credentials)
      passwordRef.current.value = ''
      const recycleId = db.meta?.recycleBinUuid?.id
      const result = []
      const walk = (group, path = []) => {
        for (const entry of group.entries) result.push({ id: entry.uuid?.id || `${result.length}`, path, selected: true, title: fileField(entry.fields.get('Title')), username: fileField(entry.fields.get('UserName')), password: fileField(entry.fields.get('Password')), url: fileField(entry.fields.get('URL')), notes: fileField(entry.fields.get('Notes')) })
        for (const child of group.groups) if (child.uuid?.id !== recycleId) walk(child, [...path, fileField(child.name)])
      }
      walk(db.getDefaultGroup())
      setEntries(result)
    } catch { setProblem('Could not open this KeePass file. Check the password, key file and format.') } finally { setBusy(false) }
  }
  const save = async () => {
    setBusy(true); setProblem('')
    try {
      const chosen = entries.filter((item) => item.selected)
      const source = scope?.source || 'owned'
      await vault.importEntries(source === 'owned' ? chosen : chosen.map((entry) => ({ ...entry, path: [] })), { source, folderId: scope?.id || null }, setProgress)
      onDone()
    } catch { setProblem('Import could not finish. Some entries may already have been added; check the list before retrying.') } finally { setBusy(false); setProgress('') }
  }
  return <><p className='pw-dialog-lead'>Your file is opened here in your browser. The file and its password are never uploaded.</p>{!entries ? <><label className='pw-dialog-field'>KeePass file (.kdbx)<input type='file' accept='.kdbx' onChange={(event) => setFile(event.target.files[0] || null)} /></label><label className='pw-dialog-field'>File password<input ref={passwordRef} type='text' className='pw-field pw-mask-text' autoComplete='off' autoCapitalize='off' autoCorrect='off' spellCheck='false' data-1p-ignore data-lpignore='true' /></label><label className='pw-dialog-field'>Key file, if needed<input type='file' onChange={(event) => setKeyFile(event.target.files[0] || null)} /></label><button className='pw-button pw-button--gold' disabled={!file || busy} onClick={parse}>{busy ? 'Opening…' : 'Open file'}</button></> : <><p>{entries.filter((entry) => entry.selected).length} of {entries.length} selected</p><div className='pw-import-list'>{entries.map((entry) => <label key={entry.id}><input type='checkbox' checked={entry.selected} onChange={() => setEntries((prior) => prior.map((item) => item.id === entry.id ? { ...item, selected: !item.selected } : item))} /><span>{entry.path.join(' / ') || 'Unfiled'} · {entry.title || '(untitled)'}</span></label>)}</div><button className='pw-button pw-button--gold' disabled={busy || !entries.some((entry) => entry.selected)} onClick={save}>{busy ? (progress || 'Importing…') : `Import ${entries.filter((entry) => entry.selected).length}`}</button></>}{problem && <p role='alert' className='pw-inline-alert'>{problem}</p>}</>
}

const Export = ({ vault, onDone }) => {
  const passwordRef = useRef(null)
  const confirmRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const save = async () => {
    const password = passwordRef.current.value
    if (password.length < 12 || password !== confirmRef.current.value) { setProblem('Use at least 12 matching characters.'); return }
    setBusy(true); setProblem('')
    try {
      const { getKdbxweb, ensureArgon2 } = await import('../vault/kdbx.js')
      ensureArgon2()
      const kdbx = getKdbxweb()
      const db = kdbx.Kdbx.create(new kdbx.Credentials(kdbx.ProtectedValue.fromString(password)), 'BakerRang Vault')
      passwordRef.current.value = ''; confirmRef.current.value = ''
      const groupMap = new Map()
      const root = db.getDefaultGroup()
      const walk = (parentId, group) => {
        for (const folder of vault.folders.filter((item) => item.source === 'owned' && item.parentId === parentId)) {
          const child = db.createGroup(group, folder.name)
          groupMap.set(folder.id, child)
          walk(folder.id, child)
        }
      }
      walk(null, root)
      for (const item of vault.index.filter((entry) => entry.source === 'owned')) {
        const details = await vault.openEntry(item)
        const entry = db.createEntry(groupMap.get(item.folderId) || root)
        entry.fields.set('Title', details.title || '')
        entry.fields.set('UserName', details.username || '')
        entry.fields.set('URL', details.url || '')
        entry.fields.set('Notes', details.notes || '')
        entry.fields.set('Password', kdbx.ProtectedValue.fromString(details.password || ''))
      }
      const buffer = await db.save()
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }))
      const link = document.createElement('a')
      link.href = url; link.download = `bakerrang-vault-${new Date().toISOString().slice(0, 10)}.kdbx`
      link.click(); URL.revokeObjectURL(url)
      onDone()
    } catch { setProblem('Export failed. Your vault was not changed.') } finally { setBusy(false) }
  }
  return <><p className='pw-dialog-lead'>Anyone with this file and its password can read every entry. Store it like your master password. Only your own entries are exported.</p><label className='pw-dialog-field'>Export password<input ref={passwordRef} type='text' className='pw-field pw-mask-text' autoComplete='off' data-1p-ignore data-lpignore='true' /></label><label className='pw-dialog-field'>Confirm export password<input ref={confirmRef} type='text' className='pw-field pw-mask-text' autoComplete='off' data-1p-ignore data-lpignore='true' /></label><button className='pw-button pw-button--gold' disabled={busy} onClick={save}>{busy ? 'Exporting…' : `Export ${vault.index.filter((entry) => entry.source === 'owned').length}`}</button>{problem && <p role='alert' className='pw-inline-alert'>{problem}</p>}</>
}

export const VaultDialog = ({ dialog, close, vault, announce, onDone, scope }) => {
  const ref = useRef(null)
  const [page, setPage] = useState(dialog.type)
  const [name, setName] = useState(dialog.folder?.name || '')
  const [moveParent, setMoveParent] = useState(dialog.folder?.parentId || null)
  const [movePosition, setMovePosition] = useState(null)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState('edit')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { const node = ref.current; node?.showModal(); return () => { node?.close() } }, [])
  const run = async (task) => { setBusy(true); setProblem(''); try { await task(); onDone() } catch { setProblem('That change could not be saved. Check your connection and try again.') } finally { setBusy(false) } }
  const bulkMove = async () => {
    if (scope.source !== 'owned') {
      const ownerId = scope.source.split(':')[1]
      await vaultRequest(`/shared/${ownerId}/items/move`, { method: 'PUT', body: { updates: dialog.ids.map((id) => ({ id, folderId: dialog.folderId })) } })
    } else {
      const folderKey = await vault.ownerFolderKey(dialog.folderId)
      const folderKeys = {}
      for (const id of dialog.ids) {
        const record = vault.rawRecord({ id, source: 'owned' })
        if (folderKey && record?.wrappedItemKey) folderKeys[id] = await rewrapItemKeyForFolder(vault.vaultKey(), folderKey, record)
      }
      await vaultRequest('/items/move', { method: 'PUT', body: { ids: dialog.ids, folderId: dialog.folderId, folderKeys } })
    }
    await vault.refresh()
  }
  const folder = dialog.folder
  const excludedParents = new Set(folder?.id ? [folder.id] : [])
  let expanded = true
  while (expanded) {
    expanded = false
    for (const item of vault.folders.filter((candidate) => candidate.source === 'owned')) {
      if (excludedParents.has(item.parentId) && !excludedParents.has(item.id)) { excludedParents.add(item.id); expanded = true }
    }
  }
  const moveOptions = [{ value: null, label: 'Top level' }, ...vault.folders.filter((item) => item.source === 'owned' && !excludedParents.has(item.id)).map((item) => ({ value: item.id, label: item.name }))]
  const sortedSiblings = vault.folders.filter((item) => item.source === 'owned' && item.parentId === moveParent).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const moveSiblings = sortedSiblings.filter((item) => item.id !== folder?.id)
  const initialPosition = moveParent === folder?.parentId ? sortedSiblings.findIndex((item) => item.id === folder.id) : moveSiblings.length
  const moveAt = movePosition == null ? Math.max(0, initialPosition) : Math.max(0, Math.min(movePosition, moveSiblings.length))
  const title = page === 'folder' ? (folder?.newFolder ? 'New folder' : folder?.name) : page === 'rename' ? 'Rename folder' : page === 'newSubfolder' ? 'New subfolder' : page === 'moveFolder' ? 'Move folder' : page === 'deleteFolder' ? 'Delete folder' : page === 'share' ? `Share ${folder?.name}` : page === 'history' ? `Version history · ${dialog.entry?.title}` : page === 'folderHistory' ? `Version history · ${folder?.name}` : page === 'activity' ? 'Activity' : page === 'settings' ? 'Vault settings' : page === 'import' ? 'Import from KeePass' : page === 'export' ? 'Export to KeePass' : page === 'bulkMove' ? 'Move entries' : 'Delete entries'
  return (
    <dialog ref={ref} className='pw-dialog' aria-label={title} onCancel={(event) => { event.preventDefault(); close() }}><header><h2>{title}</h2><button className='pw-button pw-button--quiet' onClick={close}>Close</button></header>
      {page === 'folder' && (folder.newFolder ? <><label className='pw-dialog-field'>Folder name<input className='pw-field' value={name} onChange={(event) => setName(event.target.value)} /></label><button className='pw-button pw-button--gold' disabled={busy || !name.trim()} onClick={() => run(() => vault.createFolder(name.trim(), folder.parentId))}>Create folder</button></> : <div className='pw-dialog-menu'><button onClick={() => setPage('rename')}>Rename</button><button onClick={() => { setName(''); setPage('newSubfolder') }}>New subfolder</button><button onClick={() => setPage('moveFolder')}>Move folder…</button><button onClick={() => setPage('share')}>Share…</button><button onClick={() => setPage('folderHistory')}>Version history…</button><button onClick={() => setPage('deleteFolder')}>Delete</button></div>)}
      {(page === 'rename' || page === 'newSubfolder') && <><label className='pw-dialog-field'>Folder name<input className='pw-field' value={name} onChange={(event) => setName(event.target.value)} /></label><button className='pw-button pw-button--gold' disabled={busy || !name.trim()} onClick={() => run(() => page === 'rename' ? vault.renameFolder(folder, name.trim()) : vault.createFolder(name.trim(), folder.id))}>{page === 'rename' ? 'Save' : 'Create folder'}</button></>}
      {page === 'moveFolder' && <><p className='pw-dialog-lead'>Move {folder.name} to a parent folder and choose its position. Shared folders stay within their sharing area.</p><Listbox id='move-parent' label='Parent folder' value={moveParent} options={moveOptions} onChange={(value) => { setMoveParent(value); setMovePosition(null) }} /><div className='pw-actions'><button className='pw-button pw-button--ghost' disabled={moveAt <= 0} onClick={() => setMovePosition(moveAt - 1)}>Move up</button><button className='pw-button pw-button--ghost' disabled={moveAt >= moveSiblings.length} onClick={() => setMovePosition(moveAt + 1)}>Move down</button><span>Position {moveAt + 1} of {moveSiblings.length + 1}</span></div><button className='pw-button pw-button--gold' disabled={busy} onClick={() => run(() => vault.moveFolder(folder, moveParent, moveAt))}>Save position</button></>}
      {page === 'deleteFolder' && <><p className='pw-dialog-lead'>This folder and its subfolders will be removed. Their entries move to Unfiled; no passwords are deleted.</p><button className='pw-button pw-button--danger' disabled={busy} onClick={() => run(() => vault.deleteFolder(folder))}>Delete folder</button></>}
      {page === 'share' && <><p className='pw-dialog-lead'>Share this folder and every folder within it. The recipient needs an existing Passwords vault.</p><label className='pw-dialog-field'>Recipient email<input type='email' className='pw-field' value={email} onChange={(event) => setEmail(event.target.value)} /></label><Listbox id='share-permission' label='Permission' value={permission} options={[{ value: 'edit', label: 'Can edit' }, { value: 'view', label: 'View only' }]} onChange={setPermission} /><button className='pw-button pw-button--gold' disabled={busy || !email.includes('@')} onClick={() => run(() => vault.shareFolder(folder, email, permission))}>Share</button><h3>People with access</h3>{vault.myShares.filter((share) => share.folderId === folder.id).map((share) => <div className='pw-share-row' key={share.id}>{share.recipientEmail} · {share.permission}<button className='pw-button pw-button--quiet' onClick={() => run(() => vault.revokeShare(share.id))}>Revoke</button></div>)}<small>Revoking stops future access. Someone may still have anything they already opened, so change those passwords if that matters.</small><button className='pw-button pw-button--quiet' disabled={busy} onClick={() => run(() => vault.repairFolderSharing(folder.id))}>Repair access</button><small>Re-encrypts this folder's entries for the people it's shared with. Use it if someone sees “Can't open this entry”.</small></>}
      {(page === 'history' || page === 'activity' || page === 'folderHistory') && <History dialog={dialog} vault={vault} announce={announce} />}
      {page === 'settings' && <><label className='pw-dialog-field' htmlFor='auto-lock'>Lock after</label><Listbox id='auto-lock' label='Lock after' value={vault.settings.autoLockMs} options={[{ value: 900000, label: '15 minutes' }, { value: 3600000, label: '1 hour' }, { value: 28800000, label: '8 hours' }, { value: null, label: 'Never' }]} onChange={async (value) => { try { await vault.updateSettings({ autoLockMs: value }) } catch { setProblem('Could not save vault settings.') } }} /><label className='pw-checkbox-line'><input type='checkbox' checked={vault.settings.inlineAutofill} onChange={async (event) => { try { await vault.updateSettings({ inlineAutofill: event.target.checked }) } catch { setProblem('Could not save vault settings.') } }} /> Browser extension fills logins on the page</label><p className='pw-dialog-lead'>Copied passwords stay on your clipboard until you copy something else, and your device may keep clipboard history.</p><button className='pw-button pw-button--gold' onClick={close}>Done</button></>}
      {page === 'import' && <Import vault={vault} scope={scope} onDone={onDone} />}
      {page === 'export' && <Export vault={vault} onDone={onDone} />}
      {page === 'bulkMove' && <><p className='pw-dialog-lead'>Move {dialog.ids.length} entries to {vault.folders.find((item) => item.id === dialog.folderId)?.name || 'Unfiled'}?</p><button className='pw-button pw-button--gold' disabled={busy} onClick={() => run(bulkMove)}>Move</button></>}
      {page === 'bulkDelete' && <><p className='pw-dialog-lead'>Delete {dialog.ids.length} selected entries? Their recent versions remain in Activity.</p><button className='pw-button pw-button--danger' disabled={busy} onClick={() => run(async () => { await vaultRequest('/items/bulk-delete', { method: 'POST', body: { ids: dialog.ids } }); await vault.refresh() })}>Delete</button></>}
      {problem && <p role='alert' className='pw-inline-alert'>{problem}</p>}
    </dialog>
  )
}
