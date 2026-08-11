import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { useVault } from '../providers/VaultProvider.jsx'
import { LoadingSpinner, ConfirmModal } from './index.js'
import PasswordEntryPanel from './PasswordEntryPanel.jsx'
import KeePassImportModal from './KeePassImportModal.jsx'
import ExportVaultModal from './ExportVaultModal.jsx'
import FolderSelect from './FolderSelect.jsx'
import ShareFolderModal from './ShareFolderModal.jsx'
import HistoryModal from './HistoryModal.jsx'

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

  // While unlocked the page is an app shell whose children scroll individually —
  // the nav, toolbar, folder tree, search bar, A-Z rail and detail panel stay put
  // and the entry list is the only part that moves.
  //
  // The height is `h` AND `min-h` together: `min-height` wins over `height` only
  // when it's the larger value, so
  //   - tall enough viewport → `h` = viewport − nav (a DEFINITE height, which is
  //     what lets every `flex-1` child get a bounded height and scroll internally
  //     instead of growing); the page itself doesn't scroll.
  //   - viewport shorter than the floor → `min-h` wins, the shell is a fixed floor
  //     taller than the viewport, so the PAGE scrolls to reveal the toolbar / folder
  //     list / entries instead of squeezing the entry list to nothing. The children
  //     still divide a definite height (the floor), so they keep scrolling
  //     internally. `overflow-hidden` stays: it clamps the shell's own box (inert,
  //     since the flex sums exactly) and never blocks the page from scrolling the
  //     shell into view.
  // The create/unlock cards are `max-w-md` and want normal flow, hence the condition.
  //
  // DO NOT add transform / translate / scale / filter / backdrop-blur /
  // will-change / contain / a z-index to this element or to any wrapper down to
  // the entry list — any one of those would trap the `fixed` folder menu / bulk
  // bar / drag chip / modals inside the shell and drop the modals behind the nav.
  const shell = vault.status === 'unlocked'
    ? 'h-[calc(100dvh-var(--nav-h))] min-h-[32rem] flex flex-col overflow-hidden'
    : ''

  return (
    <div className={`p-4 sm:p-8 max-w-7xl mx-auto ${shell}`}>
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

// How many entry rows to mount at once. The rest append as you scroll (or via
// the "Show more" button) — cheaper than a virtualiser and needs no new dep.
const PAGE_SIZE = 100

// The A-Z bucket for an entry title, for the jump rail. Falls back to the NFD base
// letter so 'Álvaro' lands under A rather than '#' — localeCompare sorts it inside
// the A run, so the rail label has to agree or the jump would overshoot.
const groupLetter = (title) => {
  const ch = (title || '').trim().charAt(0).toUpperCase()
  if (/[A-Z]/.test(ch)) return ch
  const base = ch.normalize('NFD').charAt(0)
  return /[A-Z]/.test(base) ? base : '#'
}

// Below this many entries the rail is more clutter than help.
const JUMP_RAIL_MIN = 20

// Per-level indent of the folder tree, in px. Shared by the folder rows, the
// inline "new folder" input under a row, and the shared-subtree rows so they all
// line up under their parents.
const INDENT_PX = 12

// The CSS px width of Tailwind's `lg:` in THIS app — 960, not the stock 1024.
// tailwind.config.cjs wraps the config in Material Tailwind's `withMT`, which
// replaces `theme.screens` (see
// node_modules/@material-tailwind/react/theme/base/breakpoints.js:
// sm 540 · md 720 · lg 960 · xl 1140 · 2xl 1320). Every `lg:` class in this file
// and PasswordEntryPanel.jsx flips at 960, so JS that mirrors the layout must use
// this query or the sidebar state describes a layout that isn't on screen.
const DESKTOP_MQ = '(min-width: 960px)'

const cardClass = (isDark) => `rounded-2xl p-6 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`
const inputClass = (isDark) => `w-full px-3 py-2 rounded-lg outline-none transition-all duration-200 ${isDark ? 'bg-white/5 text-theme-dark placeholder:text-theme-secondary-dark border border-white/10 focus:border-white/30' : 'bg-white text-theme-light placeholder:text-theme-secondary-light border border-black/15 focus:border-black/40'}`
const primaryBtn = (isDark) => `px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg disabled:opacity-50 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`

// Master-password input with a show/hide eye. Stays a real type='password'
// (toggled to text) so a password manager can still offer to fill it; the eye
// only flips input.type. Used on both the create and unlock cards.
const MasterPasswordInput = ({ isDark, value, onChange, onKeyDown, placeholder, autoFocus }) => {
  const [show, setShow] = useState(false)
  return (
    <div className='relative'>
      <input
        className={`${inputClass(isDark)} pr-10`}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
      />
      <button
        type='button'
        onClick={() => setShow((v) => !v)}
        title={show ? 'Hide password' : 'Show password'}
        className={`absolute inset-y-0 right-0 flex items-center px-3 ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
      >
        {show
          ? (
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' className='w-5 h-5'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88' />
            </svg>
            )
          : (
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' className='w-5 h-5'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z' />
              <path strokeLinecap='round' strokeLinejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
            </svg>
            )}
      </button>
    </div>
  )
}

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
        <MasterPasswordInput isDark={isDark} placeholder='Master password (min 8 chars)' value={password} onChange={(e) => setPassword(e.target.value)} />
        <MasterPasswordInput isDark={isDark} placeholder='Confirm master password' value={confirm} onChange={(e) => setConfirm(e.target.value)} />
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
        <MasterPasswordInput
          isDark={isDark}
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
  const { items, folders, sharedFolders, sharedItems, sharedTrees, myShares } = vault
  // 'all' | 'none' | folderId | `shared:<shareId>` (a folder shared WITH me)
  const [selectedFolder, setSelectedFolder] = useState('all')
  const [selected, setSelected] = useState(null) // entry object (edit), {} (new), or null (closed)
  const [panelNonce, setPanelNonce] = useState(0) // bumps to remount the panel when an open entry is refreshed
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // { type, id, name } | { type: 'bulk', ids, count }
  const [newFolderName, setNewFolderName] = useState('')
  const [addingUnder, setAddingUnder] = useState(null) // null | 'root' | parent folderId
  const [collapsed, setCollapsed] = useState(() => new Set()) // collapsed folder ids
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [folderMenu, setFolderMenu] = useState(null) // { folder, rect } of the open ⋮ menu
  const [shareHover, setShareHover] = useState(null) // { folderId, rect } for the shared-with hover card
  const [shareTarget, setShareTarget] = useState(null) // folder being shared
  const [historyTarget, setHistoryTarget] = useState(null) // { mode: 'item'|'folder'|'global', target } for version history
  const [repairStatus, setRepairStatus] = useState(null) // { state: 'running'|'done'|'error', message }
  const [sharedSubfolderId, setSharedSubfolderId] = useState(null) // subfolder within the open shared tree
  const [selectedIds, setSelectedIds] = useState(() => new Set()) // entries selected for bulk actions
  const [moveError, setMoveError] = useState(null)
  const [moving, setMoving] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // { id, mode: 'before'|'after'|'inside' }
  const [query, setQuery] = useState('')
  const [renderLimit, setRenderLimit] = useState(PAGE_SIZE) // entry rows currently mounted
  // The folder tree starts collapsed below `lg` (it renders above the entry list
  // there, so a long tree buries the entries) and expanded on desktop.
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia(DESKTOP_MQ).matches)

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

  // Folders used for the path labels on search results: my own tree, or the open
  // shared subtree (whose root only exists as the share record, so it's added here).
  const pathFolders = useMemo(() => (
    activeShared
      ? [
          { id: activeShared.folderId, parentId: null, name: activeShared.name },
          ...(vault.sharedTreeFolders || []).filter((f) => f.id !== activeShared.folderId)
        ]
      : folders
  ), [activeShared, vault.sharedTreeFolders, folders])

  // Precomputed 'Internet / Banking' per folder, so rendering 100 search results
  // doesn't rebuild folderPath's parent map 100 times over.
  const folderPathById = useMemo(() => {
    const m = new Map()
    pathFolders.forEach((f) => m.set(f.id, folderPath(pathFolders, f.id)))
    return m
  }, [pathFolders])

  // One lower-cased haystack per entry, rebuilt only when the entries change —
  // not on every keystroke. Notes can be long.
  const searchIndex = useMemo(() => {
    const source = activeShared ? (sharedItems || []) : items
    const m = new Map()
    source.forEach((i) => m.set(
      i.id,
      // Newline-separated so a token can't match across two fields.
      `${i.title || ''}\n${i.username || ''}\n${i.url || ''}\n${i.notes || ''}`.toLowerCase()
    ))
    return m
  }, [items, sharedItems, activeShared])

  const searchTokens = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query])
  const isSearching = searchTokens.length > 0

  // localeCompare over thousands of entries is the expensive part, so the sort is
  // memoised separately from the filter.
  const sortedSource = useMemo(() => {
    const source = activeShared ? (sharedItems || []) : items
    return [...source].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  }, [items, sharedItems, activeShared])

  // The FULL result set — drives the count, select-all and bulk move.
  //
  // A non-empty query ignores the selected folder and searches the whole vault.
  // In a shared view it searches the whole *open* shared subtree instead: only
  // that one tree is in memory (openSharedFolder fetches subtrees on demand), so
  // search never reaches the personal vault or another share, and vice versa.
  const filteredItems = useMemo(() => {
    if (isSearching) {
      return sortedSource.filter((i) => {
        const hay = searchIndex.get(i.id) || ''
        return searchTokens.every((t) => hay.includes(t))
      })
    }
    // In a shared tree, show only the entries directly in the selected folder —
    // same as a normal folder, so a parent with no entries of its own is empty.
    if (activeShared) return sortedSource.filter((i) => i.folderId === (sharedSubfolderId || activeShared.folderId))
    if (selectedFolder === 'all') return sortedSource
    if (selectedFolder === 'none') return sortedSource.filter((i) => !i.folderId)
    return sortedSource.filter((i) => i.folderId === selectedFolder)
  }, [sortedSource, isSearching, searchTokens, searchIndex, activeShared, sharedSubfolderId, selectedFolder])

  // Only this slice is mounted; the rest appends as you scroll.
  const renderedItems = useMemo(() => filteredItems.slice(0, renderLimit), [filteredItems, renderLimit])
  const hasMore = filteredItems.length > renderedItems.length

  // First occurrence of each initial letter across the FULL result set (not just the
  // mounted slice), so the rail lists every letter you could jump to. Only letters
  // that actually have entries appear, so a tap always lands on something.
  const letterIndex = useMemo(() => {
    const out = []
    filteredItems.forEach((item, index) => {
      const letter = groupLetter(item.title)
      if (!out.length || out[out.length - 1].letter !== letter) out.push({ letter, index, id: item.id })
    })
    return out
  }, [filteredItems])

  const showJumpRail = letterIndex.length > 1 && filteredItems.length >= JUMP_RAIL_MIN

  const currentLabel = activeShared
    ? (sharedSubfolderId ? (folderPathById.get(sharedSubfolderId) || activeShared.name) : activeShared.name)
    : selectedFolder === 'all'
      ? 'All Items'
      : selectedFolder === 'none' ? 'Unfiled' : folderPath(folders, selectedFolder)

  // The entry list is the page's only scroll container (see the shell on the
  // Passwords root).
  const listRef = useRef(null)

  // The row cap is per-view: a new folder or query starts at PAGE_SIZE again.
  // Deliberately NOT keyed on `filteredItems` — saving an entry shouldn't throw
  // you back to the first 100 rows.
  useEffect(() => {
    setRenderLimit(PAGE_SIZE)
    // The list is its own scroller, so nothing resets it for us: without this,
    // clamping leaves you at the bottom of the folder you just picked. 'instant'
    // is required — a bare `scrollTop = 0` animates under the global
    // `scroll-behavior: smooth`.
    if (listRef.current) listRef.current.scrollTo({ top: 0, behavior: 'instant' })
  }, [selectedFolder, sharedSubfolderId, query])

  // The "Show more" button doubles as the sentinel: it auto-appends when it
  // scrolls near the container's edge and still works as a plain button.
  // `renderLimit` is in the deps on purpose — re-observing re-fires while the
  // sentinel is still in view, which is what keeps a long list filling in.
  // IntersectionObserver callbacks are async, so this can't spin synchronously.
  const moreRef = useRef(null)
  useEffect(() => {
    const el = moreRef.current
    if (!el) return
    // `root` has to be the list container. With the viewport as root, the
    // container's own clip is applied before the intersection while `rootMargin`
    // expands only the root's rect — so the 400px lookahead silently becomes zero
    // and the list visibly stalls at every batch boundary.
    const io = new window.IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setRenderLimit((n) => n + PAGE_SIZE)
    }, { root: listRef.current, rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [renderLimit, filteredItems.length])

  // ---- A-Z jump rail ----
  // A jump can target a row past `renderLimit`, which isn't in the DOM yet. So the
  // scroll is attempted first and, if the row is missing, the cap is raised far
  // enough to include it and the scroll finishes in the effect below once React has
  // mounted it. (Jumping to 'Z' in a huge vault therefore mounts everything above
  // it — unavoidable without a virtualiser, and only the cost of asking for 'Z'.)
  const [pendingJump, setPendingJump] = useState(null) // { id, instant }

  const scrollToEntry = (id, instant) => {
    const el = document.querySelector(`[data-entry-id="${id}"]`)
    if (!el) return false
    // The list is the only scroll container, so this needs no offset arithmetic —
    // `scroll-mt-1` on the rows supplies the breathing room. index.css sets
    // `scroll-behavior: smooth` globally, so 'instant' has to be explicit: during
    // a rail drag, animating every letter fights the pointer.
    el.scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start', inline: 'nearest' })
    return true
  }

  const jumpToLetter = (entry, instant) => {
    if (scrollToEntry(entry.id, instant)) return
    setRenderLimit((n) => Math.max(n, Math.ceil((entry.index + 1) / PAGE_SIZE) * PAGE_SIZE))
    setPendingJump({ id: entry.id, instant })
  }

  useEffect(() => {
    if (!pendingJump) return
    if (scrollToEntry(pendingJump.id, pendingJump.instant)) setPendingJump(null)
  }, [pendingJump, renderedItems])

  // Dragging down the rail scrubs through letters, like the iOS contacts index.
  // Pointer Events (not touch/mouse) so one path covers both; `touch-none` on the
  // rail is what stops a touch-drag from scrolling the page instead.
  const railDragRef = useRef(false)
  const railLastRef = useRef(null)

  const railJumpFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y)
    const btn = el && el.closest('[data-letter]')
    if (!btn) return
    const letter = btn.getAttribute('data-letter')
    if (letter === railLastRef.current) return // same letter, nothing to redo
    railLastRef.current = letter
    const entry = letterIndex.find((e) => e.letter === letter)
    if (entry) jumpToLetter(entry, true)
  }

  const onRailPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    railDragRef.current = true
    railLastRef.current = null
    railJumpFromPoint(e.clientX, e.clientY)
  }
  const onRailPointerMove = (e) => { if (railDragRef.current) railJumpFromPoint(e.clientX, e.clientY) }
  const onRailPointerUp = () => { railDragRef.current = false; railLastRef.current = null }

  // Re-apply the per-breakpoint sidebar default when the viewport crosses `lg`.
  // Only a *crossing* fires, so an explicit collapse/expand sticks until the
  // layout genuinely changes. matchMedia against DESKTOP_MQ is the exact query
  // Tailwind's `lg:` compiles to here (see DESKTOP_MQ), so the JS state can't
  // drift from the CSS.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const onChange = (e) => setSidebarOpen(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // A viewport-fixed menu can't track its anchor, so close it on any scroll.
  // Capture phase, so the sidebar's own internal scroll counts too.
  useEffect(() => {
    if (!folderMenu) return
    const close = () => setFolderMenu(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [folderMenu])

  // Picking a folder always drops the query: a global result set that ignores the
  // folder you just clicked makes the click look broken. Also re-collapses the
  // mobile summary bar (a no-op when it's the desktop rail).
  const chooseFolder = (key) => {
    setSelectedFolder(key)
    setQuery('')
    if (!window.matchMedia(DESKTOP_MQ).matches) setSidebarOpen(false)
  }

  // Sharing
  const handleOpenShare = async (folder) => {
    setShareTarget(folder)
    await vault.loadMyShares().catch(() => {})
  }
  const handleShare = async (email, permission) => { await vault.shareFolder(shareTarget.id, email, permission) }
  const handleRevoke = async (shareId) => { await vault.revokeShare(shareId) }
  const handleSelectShared = async (s) => {
    chooseFolder(`shared:${s.shareId}`)
    setSharedSubfolderId(null)
    setSelected(null)
    await vault.openSharedFolder(s)
  }

  // Select a subfolder inside a shared tree. Subfolders now render in the sidebar
  // before the shared root is opened, so this also activates + opens the parent
  // share (from the prefetched cache) when it isn't the current one.
  const handleSelectSharedSubfolder = async (s, id) => {
    setSharedSubfolderId(id)
    setQuery('')
    setSelected(null)
    if (!window.matchMedia(DESKTOP_MQ).matches) setSidebarOpen(false)
    if (!activeShared || activeShared.shareId !== s.shareId) {
      setSelectedFolder(`shared:${s.shareId}`)
      await vault.openSharedFolder(s)
    }
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
          if (!created || !created.id) throw new Error(`Could not create folder "${name}" during import`)
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
    <div className='flex gap-1 mt-1 items-center' style={{ paddingLeft: `${depth * INDENT_PX}px` }}>
      <input
        className={`${inputClass(isDark)} min-w-0 !py-1.5`}
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
        className={`${primaryBtn(isDark)} !px-2 !py-1.5 flex-shrink-0`}
        onClick={() => handleAddFolder(parentId)}
      >
        ✓
      </button>
      <button
        title='Cancel (Esc)'
        onClick={cancelAddFolder}
        className={`px-2 py-1.5 rounded-lg flex-shrink-0 ${isDark ? 'text-theme-secondary-dark hover:bg-white/10' : 'text-theme-secondary-light hover:bg-black/5'}`}
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
    } else if (target.type === 'bulk') {
      const ids = target.ids || []
      if (selected && ids.includes(selected.id)) setSelected(null)
      setMoving(true)
      setMoveError(null)
      try {
        await vault.deleteItems(ids)
        clearSelection()
      } catch (err) {
        setMoveError(err.message || 'Failed to delete entries')
      }
      setMoving(false)
    } else {
      await vault.deleteFolder(target.id)
    }
  }

  // ---- Multi-select of entries for bulk move ----
  const clearSelection = () => setSelectedIds(new Set())
  // Clear the selection when the view changes to avoid acting on items that are
  // no longer visible. Keyed on `isSearching`, not `query`: entering or leaving
  // search wipes the selection, but refining a query keeps it, so you can tick
  // some results, narrow the search and tick more.
  useEffect(() => { setSelectedIds(new Set()) }, [selectedFolder, sharedSubfolderId, isSearching])

  const toggleItemSelected = (id) => setSelectedIds((prev) => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  // Over `filteredItems`, not `renderedItems`: otherwise the header checkbox would
  // flip back off as soon as scrolling mounted the next batch of rows.
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.id))
  const toggleSelectAllFiltered = () => setSelectedIds((prev) => {
    const n = new Set(prev)
    if (filteredItems.every((i) => n.has(i.id))) filteredItems.forEach((i) => n.delete(i.id))
    else filteredItems.forEach((i) => n.add(i.id))
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

  // ---- Real-time sync: another participant changed a shared folder ----
  const handleApplyUpdates = async () => {
    await vault.applyUpdates()
    // Refresh the open shared pane from the just-updated cache (shareId/ownerId
    // are stable, so the pre-refresh `activeShared` object is fine here).
    if (activeShared) vault.openSharedFolder(activeShared).catch(() => {})
  }
  // Auto-apply when it's safe (no entry open/being edited). If an entry IS open, a
  // banner is shown instead (below); closing the panel re-runs this and applies.
  useEffect(() => {
    if (vault.updatesAvailable && selected === null) handleApplyUpdates()
  }, [vault.updatesAvailable, selected])

  // Keep an open entry panel in sync with its underlying data. When a Refresh pulls
  // another user's edit, the list gets a fresh copy (newer updatedAt) but `selected`
  // still points at the stale object; re-seed it and bump the nonce so the panel
  // remounts with the latest. A no-op after your own save (updatedAt already matches).
  // If the entry is gone (deleted by another user), close the panel.
  useEffect(() => {
    if (!selected || !selected.id) return
    const source = activeShared ? sharedItems : items
    const fresh = source.find((i) => i.id === selected.id)
    if (!fresh) {
      setSelected(null)
    } else if (fresh.updatedAt !== selected.updatedAt) {
      setSelected(fresh)
      setPanelNonce((n) => n + 1)
    }
  }, [items, sharedItems, activeShared, selected])

  // Re-wrap a shared folder's whole subtree to the correct key so recipients can
  // read every entry (fixes access broken by a past key conflict).
  const handleRepairSharing = async (folder) => {
    setRepairStatus({ state: 'running', message: `Repairing sharing for “${folder.name}”…` })
    try {
      const res = await vault.repairFolderSharing(folder.id)
      setRepairStatus({ state: 'done', message: `Sharing repaired — ${res.items} entr${res.items === 1 ? 'y' : 'ies'} re-encrypted for recipients.` })
      setTimeout(() => setRepairStatus(null), 6000)
    } catch (err) {
      setRepairStatus({ state: 'error', message: err.message || 'Repair failed' })
    }
  }

  const folderTab = (key, label, count) => (
    <button
      key={key}
      onClick={() => chooseFolder(key)}
      className={`w-full text-left px-2 py-1.5 rounded-lg text-sm flex justify-between items-center transition-all duration-200 ${isDark ? 'text-theme-dark' : 'text-theme-light'} ${selectedFolder === key ? (isDark ? 'bg-white/10 font-medium' : 'bg-black/10 font-medium') : (isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}
    >
      <span className='truncate'>{label}</span>
      <span className='text-xs opacity-60'>{count}</span>
    </button>
  )

  return (
    // `min-h-0` here, on the columns row, and on the rows+rail wrapper are the
    // three load-bearing ones: a column flex item defaults to `min-height: auto`,
    // which pins it to its content height and silently makes the entry list grow
    // instead of scroll.
    <div className='flex-1 min-h-0 flex flex-col'>
      {/* Toolbar. Buttons are compact below `sm` (smaller text + padding, restored
          at sm+) so all three fit one row on a phone rather than wrapping Lock onto
          its own line. */}
      <div className='flex flex-wrap gap-2 mb-6 justify-between items-center flex-shrink-0'>
        <div className='flex flex-wrap gap-2'>
          <button
            className={`${primaryBtn(isDark)} text-sm sm:text-base !px-3 sm:!px-4`}
            onClick={() => setSelected({})}
            disabled={isSharedView && !canEditShared}
            title={isSharedView && !canEditShared ? 'You have view-only access to this folder' : undefined}
          >
            + New Entry
          </button>
          <button
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
            onClick={() => setImportOpen(true)}
          >
            Import
          </button>
          <button
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 disabled:opacity-50 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
            onClick={() => setExportOpen(true)}
            disabled={items.length === 0}
            title={items.length === 0 ? 'No entries to export' : 'Export your vault to a KeePass .kdbx file'}
          >
            Export
          </button>
          {/* Version history is owner-only — not shown when viewing a folder
              shared WITH me. */}
          {!isSharedView && (
            <button
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
              onClick={() => setHistoryTarget({ mode: 'global', target: null })}
              title='See recent changes across your vault'
            >
              Activity
            </button>
          )}
        </div>
        <button
          title='Lock vault'
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
          onClick={() => vault.lock()}
        >
          {/* Icon-only below `sm` so the toolbar doesn't wrap Lock onto its own
              line on a narrow phone. */}
          🔒<span className='hidden sm:inline'> Lock</span>
        </button>
      </div>

      {/* Shown only when an entry is open/being edited — otherwise updates apply
          automatically. Lets the user pull another participant's changes without
          losing their unsaved edits. */}
      {vault.updatesAvailable && selected !== null && (
        <div className={`flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-lg flex-shrink-0 border ${isDark ? 'bg-amber-400/10 border-amber-400/30 text-theme-dark' : 'bg-amber-500/10 border-amber-500/30 text-theme-light'}`}>
          <span className='text-sm flex items-center gap-2'>
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4 flex-shrink-0'>
              <path fillRule='evenodd' d='M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z' clipRule='evenodd' />
            </svg>
            Updates available from another user.
          </span>
          <button
            onClick={handleApplyUpdates}
            className={`text-sm font-medium px-3 py-1 rounded-lg flex-shrink-0 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
          >
            Refresh
          </button>
        </div>
      )}

      {/* Repair-sharing status. */}
      {repairStatus && (
        <div className={`flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-lg flex-shrink-0 border ${repairStatus.state === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : (isDark ? 'bg-white/5 border-white/10 text-theme-dark' : 'bg-black/5 border-black/10 text-theme-light')}`}>
          <span className='text-sm flex items-center gap-2'>
            {repairStatus.state === 'running' && <LoadingSpinner className='flex' svgClassName={`!h-4 !w-4 ${isDark ? '!fill-gray-300 !text-gray-300/30' : '!fill-gray-600 !text-gray-600/30'}`} />}
            {repairStatus.message}
          </span>
          {repairStatus.state !== 'running' && (
            <button
              onClick={() => setRepairStatus(null)}
              className={`text-sm px-2 py-1 rounded-lg flex-shrink-0 ${isDark ? 'text-theme-secondary-dark hover:bg-white/10' : 'text-theme-secondary-light hover:bg-black/5'}`}
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <div className='flex flex-col lg:flex-row gap-6 flex-1 min-h-0'>
        {/* Folder sidebar. `relative z-20` lifts it above the entry list: the
            glass classes use backdrop-filter, which creates a stacking context,
            so without this the sidebar's popups render behind the entries when
            they stack below it on small screens.

            The card never scrolls itself — the tree below does. That keeps the
            scrollbar inside the card's padding instead of running down the rounded
            edge and squaring off the right-hand corners; `flex-col` + `min-h-0` on
            the tree is what lets it take the leftover height.

            On desktop the card fills the shell (`lg:h-full`). On mobile it's a
            summary bar stacked above the list, so it stays `flex-shrink-0` (its own
            content height) and `max-h-[55%]` bounds the tree when expanded rather
            than letting it push the list away — expanding is transient there
            anyway, since picking a folder auto-collapses it. */}
        <div className={`${cardClass(isDark)} relative z-20 flex-shrink-0 lg:shrink-0 !p-3 ${sidebarOpen ? 'flex flex-col min-h-0 max-h-[55%] lg:max-h-none lg:w-60 lg:h-full' : 'lg:w-auto lg:self-start'}`}>
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? 'Hide folders' : 'Show folders'}
            className={`flex items-center gap-2 text-left w-full flex-shrink-0 ${sidebarOpen ? 'mb-2' : 'lg:w-auto'} ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}
          >
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className={`flex-shrink-0 w-4 h-4 transition-transform duration-200 ${sidebarOpen ? 'rotate-90' : ''} ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              <path fillRule='evenodd' d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z' clipRule='evenodd' />
            </svg>
            <span className={`text-sm font-medium truncate flex-1 ${sidebarOpen ? '' : 'lg:hidden'}`}>
              {sidebarOpen ? 'Folders' : currentLabel}
            </span>
            <span className={`text-xs opacity-60 flex-shrink-0 ${sidebarOpen ? 'hidden' : 'lg:hidden'}`}>{filteredItems.length}</span>
          </button>

          {sidebarOpen && (
            // `-mr-2 pr-2` insets the scrollbar from the card's rounded corner while
            // keeping the rows their full width. `overflow-x-hidden` pairs with
            // overflow-y: leaving x visible makes it compute to auto, so a deeply
            // indented folder name could add a horizontal scrollbar.
            <div className='space-y-1 thin-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden -mr-2 pr-2'>
              {folderTab('all', 'All Items', items.length)}
              {folderTab('none', 'Unfiled', items.filter((i) => !i.folderId).length)}
              <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`} />
              {visibleFolders.map((f) => {
                const isCurrent = selectedFolder === f.id
                const drop = dropTarget && dropTarget.id === f.id ? dropTarget.mode : null
                const dropClass = drop === 'before'
                  ? 'shadow-[inset_0_2px_0_0_#FFD500]'
                  : drop === 'after'
                    ? 'shadow-[inset_0_-2px_0_0_#FFD500]'
                    : drop === 'inside'
                      ? 'ring-2 ring-inset ring-amber-400'
                      : ''
                return (
                  <div key={f.id}>
                    <div
                      data-folder-id={f.id}
                      className={`group flex items-center rounded-lg transition-all duration-200 ${dragId === f.id ? 'opacity-40' : ''} ${isCurrent ? (isDark ? 'bg-white/10' : 'bg-black/10') : (isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')} ${dropClass}`}
                      style={{ paddingLeft: `${f.depth * INDENT_PX}px` }}
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
                            // `flex-1 min-w-0` or the input's intrinsic width
                            // overflows the tightened row and gets clipped; `!py-1`
                            // keeps it the row's height. 16px font (unprefixed) so
                            // the rename never triggers iOS zoom.
                            className={`${inputClass(isDark)} flex-1 min-w-0 !py-1 my-0.5`}
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
                            {/* Shared-with-others indicator: sits before the name (off
                                the count, which it used to crowd). Hover shows who it's
                                shared with; click opens the share manager (also the
                                path to that list on touch, which has no hover). */}
                            {sharedFolderIds.has(f.id) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleOpenShare(f) }}
                                onMouseEnter={(e) => setShareHover({ folderId: f.id, rect: e.currentTarget.getBoundingClientRect() })}
                                onMouseLeave={() => setShareHover(null)}
                                title='Shared — click to manage'
                                className={`flex-shrink-0 w-5 h-6 flex items-center justify-center ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
                              >
                                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-3.5 h-3.5'>
                                  <path d='M7.5 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM3 19.5a8.25 8.25 0 0116.5 0 .75.75 0 01-.75.75H3.75A.75.75 0 013 19.5z' />
                                  <path d='M17.25 9.75a3 3 0 100-6 3 3 0 000 6zM21.75 20.25a.75.75 0 00.75-.75 6.75 6.75 0 00-4.5-6.364' />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => chooseFolder(f.id)}
                              onDoubleClick={() => startRename(f)}
                              title={f.name}
                              className={`flex-1 min-w-0 text-left px-1 py-1.5 text-sm flex justify-between items-center ${isDark ? 'text-theme-dark' : 'text-theme-light'} ${isCurrent ? 'font-medium' : ''}`}
                            >
                              <span className='truncate'>{f.name}</span>
                              <span className='text-xs opacity-60 flex-shrink-0 ml-1'>{items.filter((i) => i.folderId === f.id).length}</span>
                            </button>
                            {/* The menu itself is rendered at the VaultView root —
                                see the comment there for why it can't live here. */}
                            <div className='flex-shrink-0'>
                              <button
                                title='Folder actions'
                                onClick={(e) => setFolderMenu(
                                  folderMenu && folderMenu.folder.id === f.id
                                    ? null
                                    : { folder: f, rect: e.currentTarget.getBoundingClientRect() }
                                )}
                                className={`px-1 py-2 rounded transition-opacity duration-200 ${folderMenu && folderMenu.folder.id === f.id ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'} ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
                              >
                                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='w-4 h-4'>
                                  <path d='M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 11.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 17a1.5 1.5 0 110-3 1.5 1.5 0 010 3z' />
                                </svg>
                              </button>
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
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-sm mt-2 transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:bg-white/5' : 'text-theme-secondary-light hover:bg-black/5'}`}
                  >
                    + New Folder
                  </button>
                  )}

              {/* Folders other people have shared with me */}
              {(sharedFolders || []).length > 0 && (
                <>
                  <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`} />
                  <p className={`px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                    Shared with me
                  </p>
                  {sharedFolders.map((s) => {
                    const key = `shared:${s.shareId}`
                    const isCurrent = selectedFolder === key
                    // Counts/subfolders/carets come from the prefetched subtree, so
                    // they show before the folder is ever clicked. `sharedSubfolders`
                    // is only current when this share is open; the prefetched tree
                    // covers the not-yet-open ones too. Subfolder ids double as the
                    // collapse key; the root uses its own folderId.
                    const tree = (sharedTrees && sharedTrees[s.shareId]) || { items: [], folders: [] }
                    // `tree.folders` includes the root folder itself — drop it so the
                    // shared root isn't rendered twice (once as this button, once as a
                    // subfolder). Filter AFTER ordering so its children keep their depth.
                    const subs = orderFolders(tree.folders || [], collapsed).filter((f) => f.id !== s.folderId)
                    // Independent of collapse state, so the caret persists when collapsed.
                    const rootHasChildren = (tree.folders || []).some((f) => f.id !== s.folderId)
                    const rootCollapsed = collapsed.has(s.folderId)
                    const countIn = (fid) => (tree.items || []).filter((i) => i.folderId === fid).length
                    return (
                      <div key={s.shareId}>
                        <div className={`group flex items-center rounded-lg transition-all duration-200 ${isCurrent && !sharedSubfolderId ? (isDark ? 'bg-white/10' : 'bg-black/10') : (isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}>
                          {rootHasChildren
                            ? (
                              <button
                                title={rootCollapsed ? 'Expand' : 'Collapse'}
                                onClick={() => toggleCollapse(s.folderId)}
                                className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-transform duration-200 ${rootCollapsed ? '' : 'rotate-90'} ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
                              >
                                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='w-3.5 h-3.5'>
                                  <path fillRule='evenodd' d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z' clipRule='evenodd' />
                                </svg>
                              </button>
                              )
                            : <span className='flex-shrink-0 w-5' />}
                          <button
                            onClick={() => handleSelectShared(s)}
                            title={`${s.name} — shared by ${s.ownerEmail || 'someone'} (${s.permission === 'edit' ? 'can edit' : 'view only'})`}
                            className={`flex-1 min-w-0 text-left px-1 py-1.5 text-sm flex justify-between items-center gap-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'} ${isCurrent && !sharedSubfolderId ? 'font-medium' : ''}`}
                          >
                            <span className='truncate'>{s.name}</span>
                            <span className='flex items-center gap-2 flex-shrink-0'>
                              {s.permission === 'view' && (
                                <span className='text-[10px] opacity-60'>view</span>
                              )}
                              <span className='text-xs opacity-60'>{countIn(s.folderId)}</span>
                            </span>
                          </button>
                        </div>

                        {/* Subfolders of the shared tree — shown up front from the
                            prefetched subtree, no click required. */}
                        {rootHasChildren && !rootCollapsed && subs.map((f) => {
                          const subActive = isCurrent && sharedSubfolderId === f.id
                          return (
                            <div
                              key={f.id}
                              style={{ paddingLeft: `${8 + f.depth * INDENT_PX}px` }}
                              className={`group flex items-center rounded-lg transition-all duration-200 ${subActive ? (isDark ? 'bg-white/10' : 'bg-black/10') : (isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}
                            >
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
                              <button
                                onClick={() => handleSelectSharedSubfolder(s, f.id)}
                                title={f.name}
                                className={`flex-1 min-w-0 text-left px-1 py-1.5 text-sm flex justify-between items-center gap-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'} ${subActive ? 'font-medium' : ''}`}
                              >
                                <span className='truncate'>{f.name}</span>
                                <span className='text-xs opacity-60 flex-shrink-0'>{countIn(f.id)}</span>
                              </button>
                            </div>
                          )
                        })}

                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Entries + detail panel. `min-h-0` is load-bearing below `lg`, where the
            columns row is `flex-col` and this becomes a *column* flex item: without
            it `min-height: auto` pins it to its content height and the entry list
            inflates the whole shell instead of scrolling. */}
        <div className='flex-1 min-w-0 min-h-0'>
          <div className='flex gap-6 h-full'>
            {/* Entry list */}
            <div className='flex-1 min-w-0 flex flex-col min-h-0'>
              {/* Context row: which folder you're in, or the scope of the search. */}
              <div className='flex items-center gap-2 mb-2 px-1 flex-shrink-0'>
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                  {isSearching
                    ? <path fillRule='evenodd' d='M10.5 3.75a6.75 6.75 0 104.153 12.078l3.535 3.535a.75.75 0 101.06-1.06l-3.535-3.536A6.75 6.75 0 0010.5 3.75zm-5.25 6.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0z' clipRule='evenodd' />
                    : selectedFolder === 'all' || selectedFolder === 'none'
                      ? <path fillRule='evenodd' d='M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z' clipRule='evenodd' />
                      : <path d='M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z' />}
                </svg>
                {isSearching
                  ? (
                    <p className={`text-sm truncate ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                      {activeShared ? 'Searching this shared folder' : 'Searching all folders'} · {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
                    </p>
                    )
                  : (
                    <>
                      <h3
                        title={currentLabel}
                        className={`text-base font-semibold truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}
                      >
                        {currentLabel}
                      </h3>
                      <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>({filteredItems.length})</span>
                    </>
                    )}
                {activeShared && !isSearching && (
                  // Just the permission pill inline; the owner's email lives in the
                  // tooltip so the breadcrumb keeps room when the panel is open.
                  <span
                    title={`Shared by ${activeShared.ownerEmail || 'someone'} · ${activeShared.permission === 'edit' ? 'can edit' : 'view only'}`}
                    className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${isDark ? 'bg-white/10 text-theme-secondary-dark' : 'bg-black/10 text-theme-secondary-light'}`}
                  >
                    {activeShared.permission === 'edit' ? 'can edit' : 'view only'}
                  </span>
                )}
              </div>

              {/* Search bar. It sits outside the scroll container, so it needs no
                  sticky treatment and nothing ever passes behind it — hence no
                  opaque background or backdrop-blur either (a backdrop-filter layer
                  directly above the one element that scrolls constantly is the most
                  likely source of paint jank here). */}
              <div className='h-14 flex items-center gap-2 px-2 mb-1 flex-shrink-0'>
                {filteredItems.length > 0 && (!isSharedView || canEditShared) && (
                  <input
                    type='checkbox'
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    title={`Select all ${filteredItems.length}`}
                    className='flex-shrink-0 w-4 h-4 cursor-pointer'
                  />
                )}
                <div className='relative flex-1 min-w-0'>
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                    <path fillRule='evenodd' d='M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z' clipRule='evenodd' />
                  </svg>
                  <input
                    className={`${inputClass(isDark)} pl-8 pr-8`}
                    type='text'
                    placeholder='Search title, username, URL, notes…'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }}
                    autoComplete='off'
                    autoCorrect='off'
                    autoCapitalize='off'
                    spellCheck='false'
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      title='Clear search (Esc)'
                      className={`absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-xs ${isDark ? 'text-theme-secondary-dark hover:bg-white/10' : 'text-theme-secondary-light hover:bg-black/5'}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {filteredItems.length === 0
                ? (
                  <div className={`${cardClass(isDark)} text-center py-16`}>
                    {isSearching
                      ? (
                        <>
                          <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                            No entries match “{query.trim()}”.
                          </p>
                          <button
                            onClick={() => setQuery('')}
                            className={`mt-3 text-sm underline ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
                          >
                            Clear search
                          </button>
                        </>
                        )
                      : (
                        <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                          No entries here yet. Click <strong>+ New Entry</strong> or import a KeePass file.
                        </p>
                        )}
                  </div>
                  )
                : (
                  <div className='flex gap-1 items-start flex-1 min-h-0'>
                    {/* The only scroll container on the page. `self-stretch`
                        overrides the wrapper's `items-start` for this child alone,
                        leaving the A-Z rail top-aligned beside it. `pb-4` keeps the
                        last row off the clip edge. */}
                    <div ref={listRef} className='flex-1 min-w-0 space-y-1 thin-scrollbar self-stretch overflow-y-auto overflow-x-hidden pb-4'>
                      {renderedItems.map((item) => {
                        const isActive = selected && selected.id === item.id
                        const isChecked = selectedIds.has(item.id)
                        // While searching, results span folders, so the folder path is
                        // more useful than the username as the subtitle.
                        const sub = isSearching
                          ? (item.folderId ? (folderPathById.get(item.folderId) || '') : 'Unfiled')
                          : (item.username || item.url || '')
                        return (
                          <div
                            key={item.id}
                            data-entry-id={item.id}
                            // No `glass-*` here, unlike the cards: each is a
                            // backdrop-blur layer, and at this density there can be 100
                            // on screen under a blurred bar. Flat tints read the same at
                            // this row height and keep scrolling smooth.
                            className={`group flex items-center gap-2 px-3 py-2 scroll-mt-1 rounded-lg cursor-pointer transition-colors duration-150 border ${isActive ? (isDark ? 'bg-white/10 border-white/30' : 'bg-black/5 border-black/30') : isChecked ? (isDark ? 'bg-white/5 border-white/20' : 'bg-black/5 border-black/20') : (isDark ? 'bg-white/[0.04] hover:bg-white/10 border-white/10' : 'bg-white/50 hover:bg-white/80 border-black/10')}`}
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
                            {/* Title and subtitle share one line to halve the row
                                height. The max-w on the title plus min-w-0 on the
                                subtitle is what lets both truncate. */}
                            <div className='min-w-0 flex-1 flex items-baseline gap-2 sm:gap-3'>
                              <p className={`text-sm font-medium truncate flex-shrink-0 max-w-[55%] ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{item.title || '(untitled)'}</p>
                              <p title={sub} className={`text-xs truncate min-w-0 flex-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>{sub}</p>
                            </div>
                            {!isSharedView && (
                              <button
                                title='Delete entry'
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'item', id: item.id, name: item.title }) }}
                                className='opacity-0 group-hover:opacity-100 focus:opacity-100 text-red-400 hover:text-red-300 px-1 flex-shrink-0'
                              >
                                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='w-4 h-4'>
                                  <path fillRule='evenodd' d='M8.75 1a1 1 0 00-.95.68L7.42 3H4.5a.75.75 0 000 1.5h11a.75.75 0 000-1.5h-2.92l-.38-1.32A1 1 0 0011.25 1h-2.5zM5.06 6a.75.75 0 011.5.06l.4 8a.75.75 0 01-1.5.08l-.4-8zm9.38.06a.75.75 0 10-1.5-.06l-.4 8a.75.75 0 001.5.08l.4-8zM10 6a.75.75 0 01.75.75v8a.75.75 0 01-1.5 0v-8A.75.75 0 0110 6z' clipRule='evenodd' />
                                </svg>
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {hasMore && (
                        <button
                          ref={moreRef}
                          onClick={() => setRenderLimit((n) => n + PAGE_SIZE)}
                          className={`w-full py-3 text-sm rounded-lg transition-colors duration-150 ${isDark ? 'text-theme-secondary-dark hover:bg-white/5' : 'text-theme-secondary-light hover:bg-black/5'}`}
                        >
                          Show more ({filteredItems.length - renderedItems.length} remaining)
                        </button>
                      )}
                    </div>

                    {/* A-Z jump rail. Outside the scroll container, so it's genuinely
                        motionless — no sticky needed. `overflow-y-auto` only matters
                        on a very short window: 27 letters is ~380px. */}
                    {showJumpRail && (
                      <div
                        onPointerDown={onRailPointerDown}
                        onPointerMove={onRailPointerMove}
                        onPointerUp={onRailPointerUp}
                        onPointerCancel={onRailPointerUp}
                        className='self-start flex-shrink-0 flex flex-col items-center py-1 touch-none select-none max-h-full overflow-y-auto thin-scrollbar'
                      >
                        {letterIndex.map((e) => (
                          <button
                            key={e.letter}
                            data-letter={e.letter}
                            title={`Jump to ${e.letter}`}
                            onClick={() => jumpToLetter(e, false)}
                            className={`w-5 py-[2px] rounded text-[10px] font-semibold leading-none transition-colors duration-100 ${isDark ? 'text-theme-secondary-dark hover:bg-white/10 hover:text-theme-dark' : 'text-theme-secondary-light hover:bg-black/10 hover:text-theme-light'}`}
                          >
                            {e.letter}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
            </div>

            {/* Detail panel: side column on large screens, overlay on small.
                `defaultFolderId` is skipped while searching — the results span
                folders, so `selectedFolder` no longer describes the list and a new
                entry defaults to no folder rather than a misleading one. */}
            {selected !== null && (
              <PasswordEntryPanel
                key={`${selected.id || 'new'}:${panelNonce}`}
                isDark={isDark}
                entry={selected.id ? selected : null}
                folders={allFolders}
                readOnly={isSharedView && !canEditShared}
                hideDelete={isSharedView}
                hideFolder={isSharedView}
                defaultFolderId={!isSharedView && !isSearching && selectedFolder !== 'all' && selectedFolder !== 'none' ? selectedFolder : null}
                onSave={handleSaveEntry}
                onDelete={(entry) => setConfirmDelete({ type: 'item', id: entry.id, name: entry.title })}
                onClose={() => setSelected(null)}
                // History is owner-only; hide it for folders shared WITH me.
                onHistory={!isSharedView && selected.id ? () => setHistoryTarget({ mode: 'item', target: selected }) : null}
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

      <ExportVaultModal
        open={exportOpen}
        items={items}
        folders={folders}
        onClose={() => setExportOpen(false)}
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

      <HistoryModal
        open={historyTarget !== null}
        isDark={isDark}
        mode={historyTarget?.mode || 'global'}
        target={historyTarget?.target || null}
        onClose={() => setHistoryTarget(null)}
      />

      <ConfirmModal
        open={confirmDelete !== null}
        title={confirmDelete?.type === 'folder'
          ? 'Delete folder?'
          : confirmDelete?.type === 'bulk'
            ? 'Delete entries?'
            : 'Delete entry?'}
        message={confirmDelete?.type === 'folder'
          ? `Delete folder "${confirmDelete?.name}" and any subfolders? Their entries will be moved to Unfiled (no passwords are deleted).`
          : confirmDelete?.type === 'bulk'
            ? `Permanently delete ${confirmDelete?.count} selected ${confirmDelete?.count === 1 ? 'entry' : 'entries'}? This cannot be undone.`
            : `Delete "${confirmDelete?.name || 'this entry'}"? This cannot be undone.`}
        cancelFunc={() => setConfirmDelete(null)}
        confirmFunc={handleConfirmDelete}
      />

      {/* Folder ⋮ menu, hoisted out of the sidebar. The sidebar scrolls internally
          on desktop, and its glass class sets backdrop-filter — which makes it a
          containing block for fixed descendants as well as clipping them, so even a
          `fixed` menu rendered inside it would be trapped. Up here there is no such
          ancestor, so it's anchored to the button's viewport rect instead. */}
      {folderMenu && (
        <>
          <div className='fixed inset-0 z-[60]' onClick={() => setFolderMenu(null)} />
          <div
            className={`fixed z-[61] min-w-[160px] rounded-lg shadow-xl border py-1 ${isDark ? 'bg-neutral-800 border-white/10' : 'bg-white border-gray-200'}`}
            style={{
              top: Math.min(folderMenu.rect.bottom + 4, window.innerHeight - 160),
              left: Math.min(folderMenu.rect.right - 160, window.innerWidth - 168)
            }}
          >
            <FolderMenuItem isDark={isDark} onClick={() => { const f = folderMenu.folder; setFolderMenu(null); handleOpenShare(f) }}>Share…</FolderMenuItem>
            {sharedFolderIds.has(folderMenu.folder.id) && (
              <FolderMenuItem isDark={isDark} onClick={() => { const f = folderMenu.folder; setFolderMenu(null); handleRepairSharing(f) }}>Repair sharing</FolderMenuItem>
            )}
            <FolderMenuItem isDark={isDark} onClick={() => { const f = folderMenu.folder; setFolderMenu(null); startRename(f) }}>Rename</FolderMenuItem>
            <FolderMenuItem isDark={isDark} onClick={() => { const f = folderMenu.folder; setFolderMenu(null); startAdding(f.id) }}>New subfolder</FolderMenuItem>
            <FolderMenuItem isDark={isDark} onClick={() => { const f = folderMenu.folder; setFolderMenu(null); setHistoryTarget({ mode: 'folder', target: f }) }}>Version history…</FolderMenuItem>
            <FolderMenuItem isDark={isDark} danger onClick={() => { const f = folderMenu.folder; setFolderMenu(null); setConfirmDelete({ type: 'folder', id: f.id, name: f.name }) }}>Delete</FolderMenuItem>
          </div>
        </>
      )}

      {/* Hover card listing who a folder is shared with. Hoisted out of the
          sidebar for the same backdrop-filter reason as the ⋮ menu, and
          pointer-events-none so it's purely informational and never flickers. */}
      {shareHover && (() => {
        const list = (myShares || []).filter((s) => s.folderId === shareHover.folderId)
        return (
          <div
            className={`fixed z-[61] min-w-[200px] max-w-[280px] rounded-lg shadow-xl border p-3 pointer-events-none ${isDark ? 'bg-neutral-800 border-white/10' : 'bg-white border-gray-200'}`}
            style={{
              top: Math.min(shareHover.rect.bottom + 6, window.innerHeight - 160),
              left: Math.min(shareHover.rect.left, window.innerWidth - 288)
            }}
          >
            <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Shared with</p>
            {list.length === 0
              ? <p className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>No active shares.</p>
              : (
                <ul className='space-y-1.5'>
                  {list.map((s) => (
                    <li key={s.id} className='flex items-center justify-between gap-3'>
                      <span className={`text-xs truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{s.recipientEmail}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${s.permission === 'edit' ? (isDark ? 'bg-white/10 text-theme-dark' : 'bg-black/10 text-theme-light') : (isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light')}`}>
                        {s.permission === 'edit' ? 'can edit' : 'view only'}
                      </span>
                    </li>
                  ))}
                </ul>
                )}
          </div>
        )
      })()}

      {/* Floating bulk-action bar — fixed so it never reflows the entry list.
          Fixed width, single line; the select flexes to fill the remaining space. */}
      {selectedIds.size > 0 && (
        <div className='fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md'>
          {moveError && <div className='mb-2 text-center text-xs text-red-400'>{moveError}</div>}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl shadow-2xl border backdrop-blur ${isDark ? 'bg-neutral-800/95 border-white/10' : 'bg-white/95 border-black/10'}`}>
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
            {/* Delete-all: owned entries only. Recipients can't delete shared
                entries, so it's hidden while a shared folder is open. */}
            {!isSharedView && (
              <button
                onClick={() => setConfirmDelete({ type: 'bulk', ids: [...selectedIds], count: selectedIds.size })}
                disabled={moving}
                title='Delete selected'
                className='p-2 rounded-lg flex-shrink-0 text-red-400 hover:bg-red-500/10 disabled:opacity-50'
              >
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-5 h-5'>
                  <path fillRule='evenodd' d='M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z' clipRule='evenodd' />
                </svg>
              </button>
            )}
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
          className={`fixed z-50 pointer-events-none px-3 py-1.5 rounded-lg text-sm shadow-xl border ${isDark ? 'bg-neutral-800 text-theme-dark border-white/20' : 'bg-white text-theme-light border-black/20'}`}
          style={{ left: dragPos.x + 12, top: dragPos.y + 12 }}
        >
          {(folders.find((f) => f.id === dragId) || {}).name || 'Folder'}
        </div>
      )}
    </div>
  )
}

export default Passwords
