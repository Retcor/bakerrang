/* eslint-disable react/jsx-handler-names */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AccountMenu, AppSwitcher, BrandLink, resolveDestinations } from '@bakerrang/web-app-shell'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { useVault } from './state/useVault.js'
import { searchEntries } from './vault/search.js'
import { EntrySheet } from './entry/EntrySheet.jsx'
import { Icon, IconButton } from './entry/Icons.jsx'
import { Listbox } from './entry/Listbox.jsx'
import { VaultDialog } from './dialogs/VaultDialog.jsx'
import logoUrl from './assets-bakerrang-logo.png'

const destinations = resolveDestinations(import.meta.env)

const MasterField = ({ inputRef, id, label }) => {
  const [shown, setShown] = useState(false)
  return <div className='pw-master-field'><label htmlFor={id}>{label}</label><div><input id={id} ref={inputRef} type={shown ? 'text' : 'password'} className='pw-field' autoComplete='current-password' required /><IconButton className='pw-master-eye' icon={shown ? 'eyeOff' : 'eye'} label={`${shown ? 'Hide' : 'Show'} master password`} onClick={() => setShown(!shown)} /></div></div>
}

const Gate = ({ status, vault, auth }) => {
  const master = useRef(null)
  const confirm = useRef(null)
  const [understood, setUnderstood] = useState(false)
  const [problem, setProblem] = useState('')
  useEffect(() => { if (status === 'LOCKED' || status === 'NO_VAULT') master.current?.focus() }, [status])
  const submit = (event) => {
    event.preventDefault()
    const password = master.current.value
    if (status === 'NO_VAULT') {
      if (password.length < 12) { setProblem('Use 12 or more characters.'); return }
      if (password !== confirm.current.value) { setProblem('The passwords do not match.'); return }
      if (!understood) { setProblem('Confirm that you understand there is no recovery.'); return }
      vault.create(password)
    } else vault.unlock(password)
    master.current.value = ''
    if (confirm.current) confirm.current.value = ''
    setProblem('')
  }
  if (auth.status !== AUTH_STATUS.AUTHENTICATED) return <main className='pw-gate'><section><p className='pw-kicker'>PASSWORDS · BAKERRANG</p><h1>Your passwords, locked before they leave this device.</h1><p>Passwords keeps your logins in folders, encrypted in your browser with a master password only you know. BakerRang stores the encrypted copy and can't read it.</p><button className='pw-button pw-button--gold' onClick={auth.login}>Sign in with Google</button></section><aside><div><b>Encrypted on your device</b><span>Passwords are locked before saving.</span></div><div><b>Separate master password</b><span>Your Google sign-in alone can't open the vault.</span></div><div><b>No recovery</b><span>If you forget it, it's gone.</span></div></aside></main>
  if (status === 'META_LOADING' || status === 'UNLOCKING') return <main className='pw-gate pw-gate--quiet'><h1>{status === 'UNLOCKING' ? 'Unlocking…' : 'Opening Passwords…'}</h1><span className='pw-spinner' /></main>
  if (status === 'META_FAILED') return <main className='pw-gate pw-gate--quiet'><h1>Passwords couldn't reach your vault.</h1><p>Nothing was changed. Check your connection, then try again.</p><button className='pw-button pw-button--ghost' onClick={vault.loadMeta}>Try again</button></main>
  const creating = status === 'NO_VAULT'
  return <main className='pw-gate pw-gate--form'><section><p className='pw-kicker'>PASSWORDS · BAKERRANG</p><h1>{creating ? 'Create your vault' : 'Unlock Passwords'}</h1><p>{creating ? 'Choose a master password. It encrypts everything here and never leaves this device.' : 'Enter your master password to open your vault.'}</p><form onSubmit={submit}><MasterField inputRef={master} id='master-password' label='Master password' />{creating && <><p className='pw-hint'>Use 12 or more characters. A few unrelated words works well.</p><MasterField inputRef={confirm} id='confirm-password' label='Confirm master password' /><label className='pw-checkbox-line'><input type='checkbox' checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /> I understand BakerRang can't recover this password.</label></>}{(problem || vault.error) && <p role='alert' className='pw-inline-alert'>{problem || vault.error}</p>}<button className='pw-button pw-button--gold' type='submit'>{creating ? 'Create vault' : 'Unlock'}</button></form>{!creating && <small>Forgot it? BakerRang can't recover it.</small>}</section></main>
}

const FolderTree = ({ vault, scope, choose, menu, announce }) => {
  const [expanded, setExpanded] = useState({})
  const [panelOpen, setPanelOpen] = useState(false)
  const railRef = useRef(null)
  const barRef = useRef(null)
  const dragging = useRef(null)
  const folders = vault.folders
  const pick = (next) => { choose(next); setPanelOpen(false) }
  useEffect(() => {
    if (!panelOpen) return
    const outside = (event) => { if (!railRef.current?.contains(event.target)) setPanelOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') { setPanelOpen(false); barRef.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [panelOpen])
  const startDrag = (event, folder) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = { folder, x: event.clientX, y: event.clientY }
  }
  const endDrag = (event) => {
    const from = dragging.current
    dragging.current = null
    if (!from || Math.hypot(event.clientX - from.x, event.clientY - from.y) < 6) return
    const targetNode = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-folder-id]')
    const target = targetNode?.dataset.folderSource === 'owned' ? folders.find((item) => item.source === 'owned' && item.id === targetNode.dataset.folderId) : null
    if (!target || target.id === from.folder.id) return
    const rect = targetNode.getBoundingClientRect()
    const asChild = event.clientX > rect.left + 64
    const parentId = asChild ? target.id : target.parentId
    const siblings = folders.filter((item) => item.source === 'owned' && item.parentId === parentId && item.id !== from.folder.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const targetIndex = asChild ? siblings.length : Math.max(0, siblings.findIndex((item) => item.id === target.id)) + (event.clientY > rect.top + rect.height / 2 ? 1 : 0)
    vault.moveFolder(from.folder, parentId, targetIndex).then(() => announce(`Moved ${from.folder.name}.`), () => announce('Could not move this folder. Try Move folder from its menu.'))
  }
  const rows = (parentId, source, depth = 0, seen = new Set()) => folders.filter((folder) => folder.source === source && folder.parentId === parentId && !seen.has(folder.id)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name)).map((folder) => {
    const children = folders.some((child) => child.source === source && child.parentId === folder.id)
    const open = expanded[`${source}:${folder.id}`] ?? depth === 0
    const count = vault.index.filter((entry) => entry.source === source && entry.folderId === folder.id).length
    return <React.Fragment key={`${source}:${folder.id}`}><div data-folder-id={folder.id} data-folder-source={source} className={`pw-folder-row ${scope.source === source && scope.id === folder.id ? 'is-selected' : ''}`} style={{ paddingLeft: `${8 + depth * 16}px` }}>{source === 'owned' && <button className='pw-folder-grip' type='button' aria-label={`Drag ${folder.name} to move or reorder`} onPointerDown={(event) => startDrag(event, folder)} onPointerUp={endDrag} onPointerCancel={() => { dragging.current = null }}><Icon name='grip' /></button>}<button className='pw-folder-chevron' type='button' aria-label={`${open ? 'Collapse' : 'Expand'} ${folder.name}`} aria-expanded={open} onClick={() => setExpanded({ ...expanded, [`${source}:${folder.id}`]: !open })}>{children ? <Icon name='down' /> : null}</button><button className='pw-folder-name' type='button' onClick={() => pick({ source, id: folder.id, name: folder.name })}>{folder.name}</button>{folder.shared && <span className='pw-folder-shared' title='Shared'><Icon name='people' /></span>}<span className='pw-folder-count'>{count}</span>{source === 'owned' && <IconButton icon='menu' label={`Folder actions for ${folder.name}`} onClick={() => menu(folder)} />}</div>{children && open && rows(folder.id, source, depth + 1, new Set([...seen, folder.id]))}</React.Fragment>
  })
  return <aside ref={railRef} className='pw-rail' aria-label='Folders'><button ref={barRef} className='pw-folder-bar' type='button' aria-expanded={panelOpen} aria-controls='pw-folder-panel' onClick={() => setPanelOpen(!panelOpen)}><span>{scope.name}</span><span>{vault.index.filter((entry) => entry.source === scope.source && (scope.name === 'All entries' || (scope.name === 'Unfiled' ? !entry.folderId : entry.folderId === scope.id))).length}</span><Icon name='down' /></button><div id='pw-folder-panel' className={`pw-folder-panel ${panelOpen ? 'is-open' : ''}`}><h2>Folders</h2><button className={`pw-folder-top ${scope.source === 'owned' && !scope.id && scope.name === 'All entries' ? 'is-selected' : ''}`} onClick={() => pick({ source: 'owned', id: null, name: 'All entries' })}>All entries <span>{vault.index.filter((entry) => entry.source === 'owned').length}</span></button><button className={`pw-folder-top ${scope.source === 'owned' && !scope.id && scope.name === 'Unfiled' ? 'is-selected' : ''}`} onClick={() => pick({ source: 'owned', id: null, name: 'Unfiled' })}>Unfiled <span>{vault.index.filter((entry) => entry.source === 'owned' && !entry.folderId).length}</span></button><div className='pw-rail-rule' />{rows(null, 'owned')}<button className='pw-button pw-button--quiet pw-rail-add' onClick={() => menu({ newFolder: true, parentId: null })}><Icon name='plus' /> New folder</button>{vault.shared.length > 0 && <><h2 className='pw-rail-shared'>Shared with me</h2>{vault.shared.map((share) => { const source = `shared:${share.ownerId}:${share.shareId}`; const root = folders.find((folder) => folder.source === source && folder.id === share.folderId); return <React.Fragment key={share.shareId}>{root && <><div className={`pw-folder-row ${scope.source === source && scope.id === root.id ? 'is-selected' : ''}`}><button className='pw-folder-name' onClick={() => pick({ source, id: root.id, name: root.name })}>{root.name}</button><small>{share.permission === 'edit' ? 'EDIT' : 'VIEW'}</small></div>{rows(root.id, source, 1)}</>}</React.Fragment> })}</>}{!vault.sharingReady && <div className='pw-rail-notice'>Sharing keys couldn't be set up. Folders shared with you can't be opened right now.<button className='pw-button pw-button--quiet' onClick={vault.retrySharing}>Try again</button></div>}</div></aside>
}

const SelectAll = ({ keys, selectedIds, setSelectedIds }) => {
  const ref = useRef(null)
  const count = keys.filter((key) => selectedIds.has(key)).length
  const all = count > 0 && count === keys.length
  useEffect(() => { if (ref.current) ref.current.indeterminate = count > 0 && !all }, [count, all])
  const toggle = () => {
    const next = new Set(selectedIds)
    for (const key of keys) all ? next.delete(key) : next.add(key)
    setSelectedIds(next)
  }
  return <label className='pw-select-all'><input ref={ref} type='checkbox' checked={all} onChange={toggle} /><span>Select all</span></label>
}

// Dragging a finger (or mouse) down the rail scrubs through letters, like the iOS
// contacts index. Pointer capture keeps the drag on the rail; touch-action: none
// stops the drag from scrolling the page instead.
const JumpRail = ({ letters, jump }) => {
  const [active, setActive] = useState(null)
  const dragging = useRef(false)
  const last = useRef(null)
  const fromPoint = (x, y) => {
    const letter = document.elementFromPoint(x, y)?.closest('[data-letter]')?.dataset.letter
    if (!letter || letter === last.current) return
    last.current = letter
    setActive(letter)
    jump(letter)
  }
  const end = () => { dragging.current = false; last.current = null; setActive(null) }
  return <nav className='pw-az' aria-label='Jump to letter' onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragging.current = true; last.current = null; fromPoint(event.clientX, event.clientY) }} onPointerMove={(event) => { if (dragging.current) fromPoint(event.clientX, event.clientY) }} onPointerUp={end} onPointerCancel={end}>{letters.map((letter) => <button key={letter} type='button' data-letter={letter} className={active === letter ? 'is-active' : ''} onClick={() => jump(letter)}>{letter}</button>)}</nav>
}

const EntryIndex = ({ entries, selected, choose, scope, query, setQuery, searchRef, selectedIds, setSelectedIds, canEdit }) => {
  const sorted = useMemo(() => [...entries].sort((a, b) => a.title.localeCompare(b.title)), [entries])
  const letters = [...new Set(sorted.map((entry) => entry.title[0]?.toUpperCase() || '#'))]
  const rowRefs = useRef(new Map())
  const listRef = useRef(null)
  // Scroll only the entry list (not the page) so the rail stays put while scrubbing.
  const jumpTo = (letter) => {
    const entry = sorted.find((item) => (item.title[0]?.toUpperCase() || '#') === letter)
    const row = entry && rowRefs.current.get(`${entry.source}:${entry.id}`)
    const list = listRef.current
    if (row && list) list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top
  }
  return <section className='pw-index' aria-label='Entries'><div className='pw-index-head'><h2>{scope.name}</h2><span>{sorted.length}</span></div><div className='pw-search'><Icon name='search' /><input ref={searchRef} id='vault-search' className='pw-field' value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search title, username, website' aria-label='Search title, username, website' />{query && <button aria-label='Clear search' onClick={() => setQuery('')}>×</button>}</div>{canEdit && sorted.length > 0 && <SelectAll keys={sorted.map((entry) => `${entry.source}:${entry.id}`)} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />}<div className='pw-list-wrap'>{sorted.length ? <ul ref={listRef} className='pw-entry-list'>{sorted.map((entry) => <li key={`${entry.source}:${entry.id}`} className={`pw-entry-row ${canEdit ? '' : 'pw-entry-row--read-only'} ${selected?.id === entry.id && selected?.source === entry.source ? 'is-open' : ''}`} ref={(node) => { if (node) rowRefs.current.set(`${entry.source}:${entry.id}`, node) }}>{canEdit && <input type='checkbox' aria-label={`Select ${entry.title}`} checked={selectedIds.has(`${entry.source}:${entry.id}`)} onChange={(event) => { const next = new Set(selectedIds); const key = `${entry.source}:${entry.id}`; event.target.checked ? next.add(key) : next.delete(key); setSelectedIds(next) }} />}<button onClick={() => choose(entry)} aria-describedby={`subtitle-${entry.source}-${entry.id}`}>{entry.title}</button><span id={`subtitle-${entry.source}-${entry.id}`}>{entry.username || entry.url}</span>{entry.title === "Can't open this entry" && <small>CAN'T OPEN</small>}</li>)}</ul> : <div className='pw-empty'><h3>{query ? `No entries match “${query}”.` : vaultEmptyTitle(scope)}</h3><p>{query ? 'Try a different title, username or website.' : 'Add a login with New entry, or bring passwords over from KeePass with Import.'}</p>{query && <div className='pw-actions'><button className='pw-button pw-button--ghost' onClick={() => setQuery('')}>Clear search</button></div>}</div>} {sorted.length >= 20 && <JumpRail letters={letters} jump={jumpTo} />}</div></section>
}

const vaultEmptyTitle = (scope) => scope.name === 'All entries' ? 'Your vault is empty.' : `Nothing in ${scope.name} yet.`

const Toolbar = ({ scope, canEdit, onNew, onImport, onExport, onActivity, onSettings, onLock }) => {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)
  const moreButtonRef = useRef(null)
  const owned = scope.source === 'owned'
  const chooseMore = (action) => { setMoreOpen(false); action() }
  useEffect(() => {
    if (!moreOpen) return
    const outside = (event) => { if (!moreRef.current?.contains(event.target)) setMoreOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') { setMoreOpen(false); moreButtonRef.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [moreOpen])
  return (
    <div className='pw-toolbar'>
      <button className='pw-button pw-button--gold' disabled={!canEdit} onClick={onNew}><Icon name='plus' /> New entry</button>
      <IconButton className='pw-tool-icon pw-desktop-only' icon='upload' label='Import from KeePass' disabled={!canEdit} onClick={onImport} />
      {owned && <IconButton className='pw-tool-icon pw-desktop-only' icon='download' label='Export to KeePass' onClick={onExport} />}
      {owned && <IconButton className='pw-tool-icon' icon='clock' label='Activity' onClick={onActivity} />}
      <span />
      <button className='pw-button pw-button--quiet pw-desktop-only' onClick={onSettings}>Vault settings</button>
      <div ref={moreRef} className='pw-mobile-more'><button ref={moreButtonRef} className='pw-button pw-button--ghost' aria-label='More vault actions' aria-expanded={moreOpen} aria-controls='pw-more-menu' onClick={() => setMoreOpen(!moreOpen)}>⋯</button>{moreOpen && <div id='pw-more-menu' className='pw-more-menu' role='menu'><button role='menuitem' disabled={!canEdit} onClick={() => chooseMore(onImport)}>Import from KeePass</button>{owned && <button role='menuitem' onClick={() => chooseMore(onExport)}>Export to KeePass</button>}<button role='menuitem' onClick={() => chooseMore(onSettings)}>Vault settings</button></div>}</div>
      <button className='pw-button pw-button--ghost pw-lock' aria-label='Lock vault' onClick={onLock}><Icon name='lock' /> Lock</button>
    </div>
  )
}

export const App = () => {
  const auth = useAuth()
  const vault = useVault(auth.status === AUTH_STATUS.AUTHENTICATED)
  const [scope, setScope] = useState({ source: 'owned', id: null, name: 'All entries' })
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dialog, setDialog] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const searchRef = useRef(null)
  useEffect(() => { if (vault.status !== 'UNLOCKED') { setSelected(null); setDialog(null); setQuery(''); setSelectedIds(new Set()); setDirty(false) } }, [vault.status])
  useEffect(() => { const yes = () => setOnline(true); const no = () => setOnline(false); window.addEventListener('online', yes); window.addEventListener('offline', no); return () => { window.removeEventListener('online', yes); window.removeEventListener('offline', no) } }, [])
  useEffect(() => { const handler = (event) => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); searchRef.current?.focus() } if (event.key === 'Escape' && selected) requestAction(() => setSelected(null)) }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler) }, [selected, dirty])
  useEffect(() => { if (!dirty) return; const handler = (event) => { event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler) }, [dirty])
  useEffect(() => { if (vault.updatesAvailable && !dirty) vault.refresh() }, [vault.updatesAvailable, dirty])
  useEffect(() => {
    if (vault.status !== 'UNLOCKED') return
    const refreshIfStale = () => {
      if (document.visibilityState === 'visible' && !dirty && Date.now() - vault.lastLoadedAt() >= 60000) vault.refresh()
    }
    document.addEventListener('visibilitychange', refreshIfStale)
    return () => document.removeEventListener('visibilitychange', refreshIfStale)
  }, [vault.status, dirty])
  const requestAction = (action) => { if (dirty) setPendingAction(() => action); else action() }
  const chooseScope = (next) => requestAction(() => { setScope(next); setSelected(null); setSelectedIds(new Set()) })
  const chooseEntry = (entry) => requestAction(() => { setSelected(entry); setDirty(false) })
  const canEditScope = scope.source === 'owned' || vault.shared.some((share) => `shared:${share.ownerId}:${share.shareId}` === scope.source && share.permission === 'edit')
  const newEntry = () => { if (canEditScope) requestAction(() => setSelected({ id: null, title: '', source: scope.source, folderId: scope.id })) }
  const lock = () => requestAction(() => { vault.lock(); setAnnouncement('Vault locked.') })
  const logout = () => requestAction(() => { vault.lock(); auth.logout() })
  const scoped = vault.index.filter((entry) => scope.source === entry.source && (query || scope.name === 'All entries' || (scope.name === 'Unfiled' ? !entry.folderId : entry.folderId === scope.id)))
  const entries = searchEntries(scoped, query)
  const selectedInScope = [...selectedIds].filter((key) => key.startsWith(`${scope.source}:`)).map((key) => key.slice(scope.source.length + 1))
  const onSaved = (record, source, title) => { setDirty(false); setSelected({ id: record.id, title: title || selected?.title || 'Entry', folderId: record.folderId, source }) }
  const unlocked = vault.status === 'UNLOCKED' && auth.status === AUTH_STATUS.AUTHENTICATED
  return <div className={`pw-app ${unlocked ? 'pw-app--vault' : ''}`}><header className='pw-app-bar'><BrandLink logoSrc={logoUrl} launcherUrl={destinations.launcher.url} appName='Passwords' appUrl='/' /><span className='pw-bar-spacer' />{auth.status === AUTH_STATUS.AUTHENTICATED ? <><AppSwitcher destinations={destinations} current='passwords' /><AccountMenu destinations={destinations} themeControl onLogout={logout} /></> : <button className='pw-button pw-button--ghost' onClick={auth.login}>Sign in</button>}</header>{unlocked ? <><h1 className='pw-sr'>Passwords</h1><Toolbar scope={scope} canEdit={canEditScope} onNew={newEntry} onImport={() => setDialog({ type: 'import' })} onExport={() => setDialog({ type: 'export' })} onActivity={() => setDialog({ type: 'activity' })} onSettings={() => setDialog({ type: 'settings' })} onLock={lock} />{!online && <div className='pw-notice'>You're offline. You can read entries already loaded, but changes can't be saved until you're back.</div>}{vault.updatesAvailable && dirty && <div className='pw-notice'>Changes from another person are ready. <button onClick={vault.refresh}>Refresh</button></div>}{pendingAction && <div className='pw-notice' role='alert'>Discard changes to {selected?.title || 'this entry'}? <button onClick={() => setPendingAction(null)}>Keep editing</button><button onClick={() => { setDirty(false); pendingAction(); setPendingAction(null) }}>Discard</button></div>}<main className={`pw-workspace ${selected ? 'has-sheet' : ''}`}><FolderTree vault={vault} scope={scope} choose={chooseScope} menu={(folder) => setDialog({ type: 'folder', folder })} announce={setAnnouncement} /><EntryIndex entries={entries} selected={selected} choose={chooseEntry} scope={scope} query={query} setQuery={setQuery} searchRef={searchRef} selectedIds={selectedIds} setSelectedIds={setSelectedIds} canEdit={canEditScope} />{selected && <EntrySheet key={`${selected.source}:${selected.id || 'new'}`} entry={selected} vault={vault} folders={vault.folders} onClose={() => requestAction(() => setSelected(null))} onRequestDiscard={requestAction} onDiscardNew={() => setSelected(null)} onSaved={onSaved} onDeleted={() => { setSelected(null); setDirty(false) }} onHistory={(entry) => setDialog({ type: 'history', entry })} onDirtyChange={setDirty} announce={setAnnouncement} />}</main>{selectedInScope.length > 0 && canEditScope && <div className='pw-bulk'><b>{selectedInScope.length} selected</b><Listbox id='bulk-folder' label='Move selected entries to folder' value={null} options={[{ value: null, label: 'Move to…' }, ...(scope.source === 'owned' ? [{ value: 'unfiled', label: 'Unfiled' }] : []), ...vault.folders.filter((folder) => folder.source === scope.source).map((folder) => ({ value: folder.id, label: folder.name }))]} onChange={(value) => { if (value !== null && selectedInScope.length) setDialog({ type: 'bulkMove', ids: selectedInScope, folderId: value === 'unfiled' ? null : value }) }} />{scope.source === 'owned' && <IconButton icon='trash' label={`Delete ${selectedInScope.length} selected entries`} onClick={() => setDialog({ type: 'bulkDelete', ids: selectedInScope })} />}<button className='pw-button pw-button--quiet' onClick={() => setSelectedIds(new Set())}>Clear</button></div>}{dialog && <VaultDialog dialog={dialog} close={() => setDialog(null)} vault={vault} scope={scope} announce={setAnnouncement} onDone={() => { setDialog(null); setSelectedIds(new Set()) }} />}</> : <Gate status={vault.status} vault={vault} auth={auth} />}<div className='pw-sr' role='status' aria-live='polite'>{announcement}</div></div>
}
