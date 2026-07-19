import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { useVault } from '../providers/VaultProvider.jsx'
import { LoadingSpinner, ConfirmModal } from './index.js'
import PasswordEntryPanel from './PasswordEntryPanel.jsx'
import KeePassImportModal from './KeePassImportModal.jsx'
import FolderSelect from './FolderSelect.jsx'
import ShareFolderModal from './ShareFolderModal.jsx'

const Passwords = () => {
  const { isDark } = useTheme()
  const vault = useVault()

  if (vault.status === 'loading') {
    return (
      <div className='flex justify-center items-center py-24'>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className='p-4 sm:p-8 max-w-6xl mx-auto'>
      {vault.status === 'uninitialized' && <CreateVaultView isDark={isDark} vault={vault} />}
      {vault.status === 'locked' && <UnlockView isDark={isDark} vault={vault} />}
      {vault.status === 'unlocked' && <VaultView isDark={isDark} vault={vault} />}
    </div>
  )
}

// Flattens the folder list into display order (depth-first, alphabetical per
// level) with a `depth` for indentation and `hasChildren` for the disclosure
// control. Children of a folder in `collapsed` are omitted. Pass an empty set
// to get every folder (e.g. for the assign-folder dropdown). Folders whose
// parent no longer exists are treated as top-level so nothing disappears.
const orderFolders = (folders, collapsed) => {
  const idSet = new Set(folders.map((f) => f.id))
  const childrenByParent = new Map()
  folders.forEach((f) => {
    const pid = f.parentId && idSet.has(f.parentId) ? f.parentId : null
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(f)
  })
  // Manual order first (by `position`), then alphabetical for anything without
  // a position yet (e.g. freshly imported folders).
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => {
      const pa = typeof a.position === 'number' ? a.position : Number.MAX_SAFE_INTEGER
      const pb = typeof b.position === 'number' ? b.position : Number.MAX_SAFE_INTEGER
      if (pa !== pb) return pa - pb
      return (a.name || '').localeCompare(b.name || '')
    })
  }
  const out = []
  const walk = (parentId, depth) => {
    for (const f of (childrenByParent.get(parentId) || [])) {
      const kids = childrenByParent.get(f.id) || []
      out.push({ ...f, depth, hasChildren: kids.length > 0 })
      if (kids.length > 0 && !collapsed.has(f.id)) walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

// Computes the folder position updates for a drag-and-drop move. `mode` is
// 'before' | 'after' (drop as a sibling of target) or 'inside' (drop as a child
// of target). Returns null for invalid moves (onto itself or a descendant).
const computeReorder = (folders, dragId, targetId, mode) => {
  if (!dragId || dragId === targetId) return null
  const byId = new Map(folders.map((f) => [f.id, f]))
  const target = byId.get(targetId)
  const dragged = byId.get(dragId)
  if (!target || !dragged) return null

  const childrenByParent = new Map()
  folders.forEach((f) => {
    const p = f.parentId || null
    if (!childrenByParent.has(p)) childrenByParent.set(p, [])
    childrenByParent.get(p).push(f)
  })
  const isDescendant = (ancestorId, nodeId) => {
    const stack = [...(childrenByParent.get(ancestorId) || [])]
    while (stack.length) {
      const n = stack.pop()
      if (n.id === nodeId) return true
      for (const c of (childrenByParent.get(n.id) || [])) stack.push(c)
    }
    return false
  }
  // Can't drop a folder into itself or any of its own descendants.
  if (mode === 'inside' && targetId === dragId) return null
  if (isDescendant(dragId, targetId)) return null

  const newParentId = mode === 'inside' ? targetId : (target.parentId || null)
  const ordered = orderFolders(folders, new Set())
  const siblings = ordered.filter((f) => (f.parentId || null) === newParentId && f.id !== dragId)

  let insertIdx
  if (mode === 'inside') {
    insertIdx = siblings.length
  } else {
    const ti = siblings.findIndex((f) => f.id === targetId)
    insertIdx = ti === -1 ? siblings.length : (mode === 'before' ? ti : ti + 1)
  }
  const newOrder = [...siblings.slice(0, insertIdx), dragged, ...siblings.slice(insertIdx)]
  return newOrder.map((f, i) => ({ id: f.id, parentId: newParentId, position: i }))
}

// Builds the full display path for a folder id, e.g. 'Internet / Banking'.
const folderPath = (folders, id) => {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const segs = []
  const guard = new Set()
  let cur = byId.get(id)
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    segs.unshift(cur.name)
    cur = cur.parentId ? byId.get(cur.parentId) : null
  }
  return segs.join(' / ')
}

const FolderMenuItem = ({ isDark, danger, onClick, children }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 ${danger ? 'text-red-400 hover:bg-red-500/10' : (isDark ? 'text-theme-dark hover:bg-white/10' : 'text-theme-light hover:bg-black/5')}`}
  >
    {children}
  </button>
)

const cardClass = (isDark) => `rounded-2xl p-6 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`
const inputClass = (isDark) => `w-full px-3 py-2 rounded-lg outline-none transition-all duration-200 ${isDark ? 'bg-white/5 text-theme-dark placeholder:text-theme-secondary-dark border border-white/10 focus:border-white/30' : 'bg-white text-theme-light placeholder:text-theme-secondary-light border border-black/15 focus:border-black/40'}`
const primaryBtn = (isDark) => `px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg disabled:opacity-50 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`

const CreateVaultView = ({ isDark, vault }) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const canCreate = password.length >= 8 && password === confirm

  const handleCreate = async () => {
    setBusy(true)
    setError(null)
    try {
      await vault.createVault(password)
    } catch (err) {
      setError(err.message || 'Failed to create vault')
      setBusy(false)
    }
  }

  return (
    <div className={`${cardClass(isDark)} max-w-md mx-auto`}>
      <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Create your vault</h3>
      <p className={`text-sm mb-4 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
        Choose a master password. It encrypts everything in your vault and is never sent to the server.
      </p>
      <div className={`flex items-start gap-2 p-3 mb-4 rounded-lg ${isDark ? 'bg-amber-400/10 border border-amber-400/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
        <span className='text-lg leading-none'>⚠️</span>
        <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
          There is <strong>no way to recover</strong> your vault if you forget this password. Store it somewhere safe.
        </span>
      </div>
      <div className='space-y-3'>
        <input className={inputClass(isDark)} type='password' placeholder='Master password (min 8 chars)' value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className={inputClass(isDark)} type='password' placeholder='Confirm master password' value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {confirm.length > 0 && password !== confirm && <p className='text-xs text-red-400'>Passwords do not match.</p>}
        {error && <p className='text-sm text-red-400'>{error}</p>}
        <button className={`${primaryBtn(isDark)} w-full`} onClick={handleCreate} disabled={!canCreate || busy}>
          {busy
            ? <LoadingSpinner className='flex justify-center' svgClassName={`!h-5 !w-5 ${isDark ? '!fill-gray-800 !text-gray-800/40' : '!fill-white !text-white/40'}`} />
            : 'Create Vault'}
        </button>
      </div>
    </div>
  )
}

const UnlockView = ({ isDark, vault }) => {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleUnlock = async () => {
    setBusy(true)
    setError(null)
    try {
      await vault.unlock(password)
    } catch (err) {
      setError('Incorrect master password.')
      setBusy(false)
      setPassword('')
    }
  }

  return (
    <div className={`${cardClass(isDark)} max-w-md mx-auto`}>
      <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Unlock your vault</h3>
      <p className={`text-sm mb-4 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Enter your master password to decrypt your vault.</p>
      <div className='space-y-3'>
        <input
          className={inputClass(isDark)}
          type='password'
          placeholder='Master password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && password) handleUnlock() }}
          autoFocus
        />
        {error && <p className='text-sm text-red-400'>{error}</p>}
        <button className={`${primaryBtn(isDark)} w-full`} onClick={handleUnlock} disabled={!password || busy}>
          {busy
            ? <LoadingSpinner className='flex justify-center' svgClassName={`!h-5 !w-5 ${isDark ? '!fill-gray-800 !text-gray-800/40' : '!fill-white !text-white/40'}`} />
            : 'Unlock'}
        </button>
      </div>
    </div>
  )
}

const VaultView = ({ isDark, vault }) => {
  const { items, folders, sharedFolders, sharedItems, myShares } = vault
  // 'all' | 'none' | folderId | `shared:<shareId>` (a folder shared WITH me)
  const [selectedFolder, setSelectedFolder] = useState('all')
  const [selected, setSelected] = useState(null) // entry object (edit), {} (new), or null (closed)
  const [importOpen, setImportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // { type, id, name }
  const [newFolderName, setNewFolderName] = useState('')
  const [addingUnder, setAddingUnder] = useState(null) // null | 'root' | parent folderId
  const [collapsed, setCollapsed] = useState(() => new Set()) // collapsed folder ids
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [menuOpenId, setMenuOpenId] = useState(null) // folder id whose action menu is open
  const [shareTarget, setShareTarget] = useState(null) // folder being shared
  const [sharedSubfolderId, setSharedSubfolderId] = useState(null) // subfolder within the open shared tree
  const [selectedIds, setSelectedIds] = useState(() => new Set()) // entries selected for bulk actions
  const [moveError, setMoveError] = useState(null)
  const [moving, setMoving] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // { id, mode: 'before'|'after'|'inside' }

  const NO_COLLAPSE = useMemo(() => new Set(), [])
  // Every folder (for the assign-folder dropdown) vs. only folders visible given
  // the current collapse state (for the sidebar tree).
  const allFolders = useMemo(() => orderFolders(folders, NO_COLLAPSE), [folders, NO_COLLAPSE])
  const visibleFolders = useMemo(() => orderFolders(folders, collapsed), [folders, collapsed])
  const moveOptions = useMemo(() => [
    { value: '__none__', label: 'Unfiled (no folder)', depth: 0 },
    ...allFolders.map((f) => ({ value: f.id, label: f.name, depth: f.depth || 0 }))
  ], [allFolders])

  const toggleCollapse = (id) => setCollapsed((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  // A folder shared WITH me is selected as `shared:<shareId>`.
  const activeShared = useMemo(() => (
    typeof selectedFolder === 'string' && selectedFolder.startsWith('shared:')
      ? (sharedFolders || []).find((s) => `shared:${s.shareId}` === selectedFolder) || null
      : null
  ), [selectedFolder, sharedFolders])
  const isSharedView = !!activeShared
  const canEditShared = !activeShared || activeShared.permission === 'edit'
  // Descendant folders of the open shared subtree, in display order (the root
  // itself is rendered separately in the sidebar).
  const sharedSubfolders = useMemo(() => {
    if (!activeShared) return []
    return orderFolders(vault.sharedTreeFolders || [], NO_COLLAPSE)
      .filter((f) => f.id !== activeShared.folderId)
  }, [activeShared, vault.sharedTreeFolders, NO_COLLAPSE])
  // Where new entries/folders land inside the shared tree.
  const sharedTarget = sharedSubfolderId || (activeShared ? activeShared.folderId : null)
  // Move-to options while a shared tree is open (only folders inside it).
  const sharedMoveOptions = useMemo(() => {
    if (!activeShared) return []
    return [
      { value: activeShared.folderId, label: activeShared.name, depth: 0 },
      ...sharedSubfolders.map((f) => ({ value: f.id, label: f.name, depth: f.depth || 0 }))
    ]
  }, [activeShared, sharedSubfolders])
  // Folders I have shared with someone (for the sidebar indicator).
  const sharedFolderIds = useMemo(
    () => new Set((myShares || []).map((s) => s.folderId)),
    [myShares]
  )

  const visibleItems = useMemo(() => {
    const source = activeShared ? (sharedItems || []) : items
    const sorted = [...source].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    // In a shared tree, show only the entries directly in the selected folder —
    // same as a normal folder, so a parent with no entries of its own is empty.
    if (activeShared) return sorted.filter((i) => i.folderId === (sharedSubfolderId || activeShared.folderId))
    if (selectedFolder === 'all') return sorted
    if (selectedFolder === 'none') return sorted.filter((i) => !i.folderId)
    return sorted.filter((i) => i.folderId === selectedFolder)
  }, [items, sharedItems, activeShared, sharedSubfolderId, selectedFolder])

  // Sharing
  const handleOpenShare = async (folder) => {
    setShareTarget(folder)
    await vault.loadMyShares().catch(() => {})
  }
  const handleShare = async (email, permission) => { await vault.shareFolder(shareTarget.id, email, permission) }
  const handleRevoke = async (shareId) => { await vault.revokeShare(shareId) }
  const handleSelectShared = async (s) => {
    setSelectedFolder(`shared:${s.shareId}`)
    setSharedSubfolderId(null)
    setSelected(null)
    await vault.openSharedFolder(s)
  }

  const handleSaveEntry = async (entry) => {
    const saved = activeShared
      ? await vault.saveSharedItem(activeShared, entry, sharedTarget)
      : await vault.saveItem(entry)
    // Keep the panel open showing the saved entry (also promotes a new entry
    // from the 'new' state to its saved identity).
    setSelected(saved)
  }

  // Rebuild the KeePass group hierarchy as a nested vault folder tree, reusing
  // folders that already exist at the same path, then bulk-import the selected
  // entries into the matching (leaf) folder.
  const handleImportKeepass = async (selected) => {
    // Importing while a shared folder is open: entries land in the selected
    // shared folder. Recipients can't create folders, so KeePass groups are
    // flattened rather than rebuilt as subfolders.
    if (activeShared) {
      await vault.importSharedItems(activeShared, selected.map((e) => ({
        title: e.title, username: e.username, password: e.password, url: e.url, notes: e.notes, folderId: sharedTarget
      })))
      return
    }

    const keyOf = (segments) => segments.join('\u001f')

    // Seed the path -> id map with folders that already exist.
    const folderById = new Map(folders.map((f) => [f.id, f]))
    const pathKeyForFolder = (f) => {
      const segs = []
      let cur = f
      const guard = new Set()
      while (cur && !guard.has(cur.id)) {
        guard.add(cur.id)
        segs.unshift(cur.name)
        cur = cur.parentId ? folderById.get(cur.parentId) : null
      }
      return keyOf(segs)
    }
    const idByPathKey = new Map()
    folders.forEach((f) => idByPathKey.set(pathKeyForFolder(f), f.id))

    // Ensure every folder along a path exists; return the leaf folder id.
    const ensureFolder = async (segments) => {
      let parentId = null
      const cum = []
      for (const name of segments) {
        cum.push(name)
        const k = keyOf(cum)
        if (!idByPathKey.has(k)) {
          const created = await vault.saveFolder({ name, parentId })
          idByPathKey.set(k, created.id)
        }
        parentId = idByPathKey.get(k)
      }
      return parentId
    }

    const withFolder = []
    for (const e of selected) {
      const segments = e.groupPath || []
      const folderId = segments.length ? await ensureFolder(segments) : null
      withFolder.push({
        title: e.title,
        username: e.username,
        password: e.password,
        url: e.url,
        notes: e.notes,
        folderId
      })
    }
    await vault.importItems(withFolder)
  }

  const handleAddFolder = async (parentId) => {
    if (!newFolderName.trim()) return
    await vault.saveFolder({ name: newFolderName.trim(), parentId: parentId || null })
    setNewFolderName('')
    setAddingUnder(null)
  }

  const cancelAddFolder = () => { setAddingUnder(null); setNewFolderName('') }

  // Inline "new folder" input, shown under a parent (or at root).
  const folderInput = (parentId, depth) => (
    <div className='flex gap-1 mt-1 items-center' style={{ paddingLeft: `${depth * 14}px` }}>
      <input
        className={`${inputClass(isDark)} min-w-0`}
        placeholder='Folder name'
        autoComplete='off'
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAddFolder(parentId)
          if (e.key === 'Escape') cancelAddFolder()
        }}
        autoFocus
      />
      <button
        title='Create folder'
        className={`${primaryBtn(isDark)} !px-2 flex-shrink-0`}
        onClick={() => handleAddFolder(parentId)}
      >
        ✓
      </button>
      <button
        title='Cancel (Esc)'
        onClick={cancelAddFolder}
        className={`px-2 py-2 rounded-lg flex-shrink-0 ${isDark ? 'text-theme-secondary-dark hover:bg-white/10' : 'text-theme-secondary-light hover:bg-black/5'}`}
      >
        ✕
      </button>
    </div>
  )

  const startAdding = (parentId) => { setNewFolderName(''); setAddingUnder(parentId) }

  const cancelRenameRef = useRef(false)
  const startRename = (f) => { cancelRenameRef.current = false; setRenamingId(f.id); setRenameValue(f.name) }

  // Called once on blur (Enter blurs the input; Escape blurs after flagging a
  // cancel), so a rename saves at most once.
  const handleRename = async (f) => {
    if (cancelRenameRef.current) { cancelRenameRef.current = false; setRenamingId(null); return }
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name || name === f.name) return
    await vault.saveFolder({ id: f.id, name, parentId: f.parentId })
  }

  // Drag-and-drop reorder / re-parent of folders, via Pointer Events so it works
  // with both mouse and touch. Dragging is initiated from a grip handle (so plain
  // touch still scrolls the list). Refs mirror the drag state for the pointer-up
  // handler, which would otherwise close over stale values.
  const dragIdRef = useRef(null)
  const dropTargetRef = useRef(null)
  const [dragPos, setDragPos] = useState(null) // {x,y} of the floating drag chip

  const onHandlePointerDown = (e, f) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragIdRef.current = f.id
    setDragId(f.id)
    setDragPos({ x: e.clientX, y: e.clientY })
  }

  const onHandlePointerMove = (e) => {
    if (!dragIdRef.current) return
    setDragPos({ x: e.clientX, y: e.clientY })
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const row = el && el.closest('[data-folder-id]')
    if (!row || row.getAttribute('data-folder-id') === dragIdRef.current) {
      dropTargetRef.current = null
      setDropTarget(null)
      return
    }
    const id = row.getAttribute('data-folder-id')
    const rect = row.getBoundingClientRect()
    const y = e.clientY - rect.top
    const mode = y < rect.height * 0.3 ? 'before' : y > rect.height * 0.7 ? 'after' : 'inside'
    const dt = { id, mode }
    dropTargetRef.current = dt
    setDropTarget(dt)
  }

  const onHandlePointerUp = async () => {
    const draggedId = dragIdRef.current
    const dt = dropTargetRef.current
    dragIdRef.current = null
    dropTargetRef.current = null
    setDragId(null)
    setDropTarget(null)
    setDragPos(null)
    if (!draggedId || !dt) return
    const updates = computeReorder(folders, draggedId, dt.id, dt.mode)
    if (!updates) return
    if (dt.mode === 'inside') setCollapsed((prev) => { const n = new Set(prev); n.delete(dt.id); return n })
    await vault.reorderFolders(updates)
  }

  const handleConfirmDelete = async () => {
    const target = confirmDelete
    setConfirmDelete(null)
    if (target.type === 'item') {
      if (selected && selected.id === target.id) setSelected(null)
      await vault.deleteItem(target.id)
    } else {
      await vault.deleteFolder(target.id)
    }
  }

  // ---- Multi-select of entries for bulk move ----
  const clearSelection = () => setSelectedIds(new Set())
  // Clear the selection when the folder view changes to avoid acting on items
  // that are no longer visible.
  useEffect(() => { setSelectedIds(new Set()) }, [selectedFolder])

  const toggleItemSelected = (id) => setSelectedIds((prev) => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((i) => selectedIds.has(i.id))
  const toggleSelectAllVisible = () => setSelectedIds((prev) => {
    const n = new Set(prev)
    if (visibleItems.every((i) => n.has(i.id))) visibleItems.forEach((i) => n.delete(i.id))
    else visibleItems.forEach((i) => n.add(i.id))
    return n
  })

  const handleBulkMove = async (folderId) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setMoving(true)
    setMoveError(null)
    try {
      if (activeShared) await vault.moveSharedItems(activeShared, ids, folderId)
      else await vault.moveItems(ids, folderId)
      clearSelection()
    } catch (err) {
      setMoveError(err.message || 'Failed to move entries')
    }
    setMoving(false)
  }

  const folderTab = (key, label, count) => (
    <button
      key={key}
      onClick={() => setSelectedFolder(key)}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-all duration-200 ${isDark ? 'text-theme-dark' : 'text-theme-light'} ${selectedFolder === key ? (isDark ? 'bg-white/10 font-medium' : 'bg-black/10 font-medium') : (isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}
    >
      <span className='truncate'>{label}</span>
      <span className='text-xs opacity-60'>{count}</span>
    </button>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className='flex flex-wrap gap-2 mb-6 justify-between items-center'>
        <div className='flex flex-wrap gap-2'>
          <button
            className={primaryBtn(isDark)}
            onClick={() => setSelected({})}
            disabled={isSharedView && !canEditShared}
            title={isSharedView && !canEditShared ? 'You have view-only access to this folder' : undefined}
          >
            + New Entry
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
            onClick={() => setImportOpen(true)}
          >
            Import KeePass
          </button>
        </div>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
          onClick={() => vault.lock()}
        >
          🔒 Lock
        </button>
      </div>

      <div className='flex flex-col lg:flex-row gap-6'>
        {/* Folder sidebar. `relative z-20` lifts it above the entry list: the
            glass classes use backdrop-filter, which creates a stacking context,
            so without this the folder ⋮ menu is trapped inside the sidebar and
            renders behind the entries when they stack below it on small screens. */}
        <div className={`${cardClass(isDark)} lg:w-60 lg:shrink-0 h-fit relative z-20`}>
          <div className='space-y-1'>
            {folderTab('all', 'All Items', items.length)}
            {folderTab('none', 'Unfiled', items.filter((i) => !i.folderId).length)}
            <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`} />
            {visibleFolders.map((f) => {
              const isCurrent = selectedFolder === f.id
              const drop = dropTarget && dropTarget.id === f.id ? dropTarget.mode : null
              const dropClass = drop === 'before'
                ? 'shadow-[inset_0_2px_0_0_#60a5fa]'
                : drop === 'after'
                  ? 'shadow-[inset_0_-2px_0_0_#60a5fa]'
                  : drop === 'inside'
                    ? 'ring-2 ring-inset ring-blue-400'
                    : ''
              return (
                <div key={f.id}>
                  <div
                    data-folder-id={f.id}
                    className={`group flex items-center rounded-lg transition-all duration-200 ${dragId === f.id ? 'opacity-40' : ''} ${isCurrent ? (isDark ? 'bg-white/10' : 'bg-black/10') : (isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')} ${dropClass}`}
                    style={{ paddingLeft: `${f.depth * 14}px` }}
                  >
                    {renamingId !== f.id && (
                      <button
                        title='Drag to reorder'
                        onPointerDown={(e) => onHandlePointerDown(e, f)}
                        onPointerMove={onHandlePointerMove}
                        onPointerUp={onHandlePointerUp}
                        onPointerCancel={onHandlePointerUp}
                        className={`flex-shrink-0 w-5 h-6 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}
                      >
                        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='w-3.5 h-3.5'>
                          <path d='M7 4a1 1 0 11-2 0 1 1 0 012 0zM7 10a1 1 0 11-2 0 1 1 0 012 0zM6 17a1 1 0 100-2 1 1 0 000 2zM15 4a1 1 0 11-2 0 1 1 0 012 0zM14 11a1 1 0 100-2 1 1 0 000 2zM15 16a1 1 0 11-2 0 1 1 0 012 0z' />
                        </svg>
                      </button>
                    )}
                    {f.hasChildren
                      ? (
                        <button
                          title={collapsed.has(f.id) ? 'Expand' : 'Collapse'}
                          onClick={() => toggleCollapse(f.id)}
                          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-transform duration-200 ${collapsed.has(f.id) ? '' : 'rotate-90'} ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
                        >
                          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='w-3.5 h-3.5'>
                            <path fillRule='evenodd' d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z' clipRule='evenodd' />
                          </svg>
                        </button>
                        )
                      : <span className='flex-shrink-0 w-5' />}
                    {renamingId === f.id
                      ? (
                        <input
                          className={`${inputClass(isDark)} my-1`}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                            if (e.key === 'Escape') { cancelRenameRef.current = true; e.currentTarget.blur() }
                          }}
                          onBlur={() => handleRename(f)}
                          autoFocus
                        />
                        )
                      : (
                        <>
                          <button
                            onClick={() => setSelectedFolder(f.id)}
                            onDoubleClick={() => startRename(f)}
                            title={f.name}
                            className={`flex-1 min-w-0 text-left px-2 py-2 text-sm flex justify-between items-center ${isDark ? 'text-theme-dark' : 'text-theme-light'} ${isCurrent ? 'font-medium' : ''}`}
                          >
                            <span className='truncate'>{f.name}</span>
                            <span className='flex items-center gap-1 flex-shrink-0 ml-2'>
                              {sharedFolderIds.has(f.id) && (
                                <svg
                                  xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'
                                  className={`w-3.5 h-3.5 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}
                                >
                                  <title>Shared with others</title>
                                  <path d='M7.5 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM3 19.5a8.25 8.25 0 0116.5 0 .75.75 0 01-.75.75H3.75A.75.75 0 013 19.5z' />
                                  <path d='M17.25 9.75a3 3 0 100-6 3 3 0 000 6zM21.75 20.25a.75.75 0 00.75-.75 6.75 6.75 0 00-4.5-6.364' />
                                </svg>
                              )}
                              <span className='text-xs opacity-60'>{items.filter((i) => i.folderId === f.id).length}</span>
                            </span>
                          </button>
                          <div className='relative flex-shrink-0'>
                            <button
                              title='Folder actions'
                              onClick={() => setMenuOpenId(menuOpenId === f.id ? null : f.id)}
                              className={`px-1.5 py-2 rounded transition-opacity duration-200 ${menuOpenId === f.id ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'} ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='w-4 h-4'>
                                <path d='M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 11.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 17a1.5 1.5 0 110-3 1.5 1.5 0 010 3z' />
                              </svg>
                            </button>
                            {menuOpenId === f.id && (
                              <>
                                <div className='fixed inset-0 z-40' onClick={() => setMenuOpenId(null)} />
                                <div className={`absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg shadow-xl border py-1 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                                  <FolderMenuItem isDark={isDark} onClick={() => { setMenuOpenId(null); handleOpenShare(f) }}>Share…</FolderMenuItem>
                                  <FolderMenuItem isDark={isDark} onClick={() => { setMenuOpenId(null); startRename(f) }}>Rename</FolderMenuItem>
                                  <FolderMenuItem isDark={isDark} onClick={() => { setMenuOpenId(null); startAdding(f.id) }}>New subfolder</FolderMenuItem>
                                  <FolderMenuItem isDark={isDark} danger onClick={() => { setMenuOpenId(null); setConfirmDelete({ type: 'folder', id: f.id, name: f.name }) }}>Delete</FolderMenuItem>
                                </div>
                              </>
                            )}
                          </div>
                        </>
                        )}
                  </div>
                  {addingUnder === f.id && folderInput(f.id, f.depth + 1)}
                </div>
              )
            })}
            {addingUnder === 'root'
              ? folderInput(null, 0)
              : (
                <button
                  onClick={() => startAdding('root')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm mt-2 transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:bg-white/5' : 'text-theme-secondary-light hover:bg-black/5'}`}
                >
                  + New Folder
                </button>
                )}

            {/* Folders other people have shared with me */}
            {(sharedFolders || []).length > 0 && (
              <>
                <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`} />
                <p className={`px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                  Shared with me
                </p>
                {sharedFolders.map((s) => {
                  const key = `shared:${s.shareId}`
                  const isCurrent = selectedFolder === key
                  return (
                    <div key={s.shareId}>
                      <button
                        onClick={() => handleSelectShared(s)}
                        title={`${s.name} — shared by ${s.ownerEmail || 'someone'} (${s.permission === 'edit' ? 'can edit' : 'view only'})`}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center gap-2 transition-all duration-200 ${isDark ? 'text-theme-dark' : 'text-theme-light'} ${isCurrent && !sharedSubfolderId ? (isDark ? 'bg-white/10 font-medium' : 'bg-black/10 font-medium') : (isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}
                      >
                        <span className='truncate'>{s.name}</span>
                        <span className='flex items-center gap-2 flex-shrink-0'>
                          {s.permission === 'view' && (
                            <span className='text-[10px] opacity-60'>view</span>
                          )}
                          {isCurrent && (
                            <span className='text-xs opacity-60'>
                              {(sharedItems || []).filter((i) => i.folderId === s.folderId).length}
                            </span>
                          )}
                        </span>
                      </button>

                      {/* Subfolders of the open shared tree */}
                      {isCurrent && sharedSubfolders.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setSharedSubfolderId(f.id)}
                          title={f.name}
                          style={{ paddingLeft: `${12 + f.depth * 14}px` }}
                          className={`w-full text-left pr-3 py-2 rounded-lg text-sm flex justify-between items-center gap-2 transition-all duration-200 ${isDark ? 'text-theme-dark' : 'text-theme-light'} ${sharedSubfolderId === f.id ? (isDark ? 'bg-white/10 font-medium' : 'bg-black/10 font-medium') : (isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}
                        >
                          <span className='truncate'>{f.name}</span>
                          <span className='text-xs opacity-60 flex-shrink-0'>
                            {(sharedItems || []).filter((i) => i.folderId === f.id).length}
                          </span>
                        </button>
                      ))}

                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Entries + detail panel */}
        <div className='flex-1 min-w-0'>
          <div className='flex gap-6'>
            {/* Entry list */}
            <div className='flex-1 min-w-0'>
              {/* Current selection header */}
              <div className='flex items-center gap-2 mb-4 px-1'>
                {visibleItems.length > 0 && (!isSharedView || canEditShared) && (
                  <input
                    type='checkbox'
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    title='Select all'
                    className='flex-shrink-0 w-4 h-4 cursor-pointer'
                  />
                )}
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                  {selectedFolder === 'all' || selectedFolder === 'none'
                    ? <path fillRule='evenodd' d='M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z' clipRule='evenodd' />
                    : <path d='M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z' />}
                </svg>
                <h3
                  title={activeShared ? activeShared.name : selectedFolder === 'all' ? 'All Items' : selectedFolder === 'none' ? 'Unfiled' : folderPath(folders, selectedFolder)}
                  className={`text-base font-semibold truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}
                >
                  {activeShared ? activeShared.name : selectedFolder === 'all' ? 'All Items' : selectedFolder === 'none' ? 'Unfiled' : folderPath(folders, selectedFolder)}
                </h3>
                <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>({visibleItems.length})</span>
                {activeShared && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${isDark ? 'bg-white/10 text-theme-secondary-dark' : 'bg-black/10 text-theme-secondary-light'}`}>
                    shared by {activeShared.ownerEmail || 'someone'} · {activeShared.permission === 'edit' ? 'can edit' : 'view only'}
                  </span>
                )}
              </div>
              {visibleItems.length === 0
                ? (
                  <div className={`${cardClass(isDark)} text-center py-16`}>
                    <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                      No entries here yet. Click <strong>+ New Entry</strong> or import a KeePass file.
                    </p>
                  </div>
                  )
                : (
                  <div className='space-y-2'>
                    {visibleItems.map((item) => {
                      const isActive = selected && selected.id === item.id
                      const isChecked = selectedIds.has(item.id)
                      return (
                        <div
                          key={item.id}
                          className={`group flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border ${isActive ? (isDark ? 'bg-white/10 border-white/30' : 'bg-black/5 border-black/30') : isChecked ? (isDark ? 'bg-white/5 border-white/20' : 'bg-black/5 border-black/20') : (isDark ? 'glass-dark hover:bg-white/10 border-white/10' : 'glass-light hover:bg-black/5 border-black/10')}`}
                          onClick={() => setSelected(item)}
                        >
                          {(!isSharedView || canEditShared) && (
                            <input
                              type='checkbox'
                              checked={isChecked}
                              onChange={() => toggleItemSelected(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className='flex-shrink-0 w-4 h-4 cursor-pointer'
                            />
                          )}
                          <div className='min-w-0 flex-1'>
                            <p className={`font-medium truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{item.title || '(untitled)'}</p>
                            <p className={`text-xs truncate ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>{item.username || item.url || ''}</p>
                          </div>
                          {!isSharedView && (
                            <button
                              title='Delete entry'
                              onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'item', id: item.id, name: item.title }) }}
                              className='opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 px-2 flex-shrink-0'
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  )}
            </div>

            {/* Detail panel: side column on large screens, overlay on small */}
            {selected !== null && (
              <PasswordEntryPanel
                key={selected.id || 'new'}
                isDark={isDark}
                entry={selected.id ? selected : null}
                folders={allFolders}
                readOnly={isSharedView && !canEditShared}
                hideDelete={isSharedView}
                hideFolder={isSharedView}
                defaultFolderId={!isSharedView && selectedFolder !== 'all' && selectedFolder !== 'none' ? selectedFolder : null}
                onSave={handleSaveEntry}
                onDelete={(entry) => setConfirmDelete({ type: 'item', id: entry.id, name: entry.title })}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        </div>
      </div>

      <KeePassImportModal
        open={importOpen}
        onImport={handleImportKeepass}
        onClose={() => setImportOpen(false)}
      />

      <ShareFolderModal
        open={shareTarget !== null}
        isDark={isDark}
        folder={shareTarget}
        shares={(myShares || []).filter((s) => shareTarget && s.folderId === shareTarget.id)}
        onShare={handleShare}
        onRevoke={handleRevoke}
        onClose={() => setShareTarget(null)}
      />

      <ConfirmModal
        open={confirmDelete !== null}
        title={confirmDelete?.type === 'folder' ? 'Delete folder?' : 'Delete entry?'}
        message={confirmDelete?.type === 'folder'
          ? `Delete folder "${confirmDelete?.name}" and any subfolders? Their entries will be moved to Unfiled (no passwords are deleted).`
          : `Delete "${confirmDelete?.name || 'this entry'}"? This cannot be undone.`}
        cancelFunc={() => setConfirmDelete(null)}
        confirmFunc={handleConfirmDelete}
      />

      {/* Floating bulk-action bar — fixed so it never reflows the entry list.
          Fixed width, single line; the select flexes to fill the remaining space. */}
      {selectedIds.size > 0 && (
        <div className='fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md'>
          {moveError && <div className='mb-2 text-center text-xs text-red-400'>{moveError}</div>}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl shadow-2xl border backdrop-blur ${isDark ? 'bg-gray-900/95 border-white/5' : 'bg-white/95 border-black/10'}`}>
            <span className={`text-sm font-medium whitespace-nowrap flex-shrink-0 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{selectedIds.size} selected</span>
            <FolderSelect
              isDark={isDark}
              value=''
              placeholder='Move to…'
              options={activeShared ? sharedMoveOptions : moveOptions}
              dropUp
              disabled={moving}
              className='flex-1 min-w-0'
              onChange={(v) => { if (v) handleBulkMove(v === '__none__' ? null : v) }}
            />
            <button
              onClick={clearSelection}
              className={`text-sm px-2 py-2 rounded-lg flex-shrink-0 ${isDark ? 'text-theme-secondary-dark hover:bg-white/10' : 'text-theme-secondary-light hover:bg-black/5'}`}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Floating chip following the pointer while dragging a folder */}
      {dragId && dragPos && (
        <div
          className={`fixed z-50 pointer-events-none px-3 py-1.5 rounded-lg text-sm shadow-xl border ${isDark ? 'bg-gray-800 text-theme-dark border-white/20' : 'bg-white text-theme-light border-black/20'}`}
          style={{ left: dragPos.x + 12, top: dragPos.y + 12 }}
        >
          {(folders.find((f) => f.id === dragId) || {}).name || 'Folder'}
        </div>
      )}
    </div>
  )
}

export default Passwords
