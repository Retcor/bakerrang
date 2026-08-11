import React, { useEffect, useMemo, useState } from 'react'
import { useVault } from '../providers/VaultProvider.jsx'
import { useAuth } from '../providers/AuthProvider.jsx'
import { LoadingSpinner } from './index.js'

// Version history (audit log) for the password vault. Owner-only: shows the
// create / edit / delete / move events recorded for an entry, a folder (its own
// events plus the entries inside it), or the whole vault ("Vault activity").
//
// Everything the server returns is ciphertext + ids/actor/timestamp; the actual
// field values are decrypted here, client-side, via vault.decryptSnapshot — so
// history is as zero-knowledge as the vault itself.
const PAGE = 50

const FIELDS = [
  ['title', 'Title'],
  ['username', 'Username'],
  ['password', 'Password'],
  ['url', 'URL'],
  ['notes', 'Notes']
]

// Compact relative time, with an absolute string for the tooltip.
const rel = (ms) => {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ms).toLocaleDateString()
}

const ACTION_META = {
  'item.baseline': { label: 'Initial version', dot: 'bg-gray-400' },
  'folder.baseline': { label: 'Initial version', dot: 'bg-gray-400' },
  'item.create': { label: 'Created', dot: 'bg-green-500' },
  'item.update': { label: 'Edited', dot: 'bg-amber-500' },
  'item.delete': { label: 'Deleted', dot: 'bg-red-500' },
  'item.move': { label: 'Moved', dot: 'bg-sky-500' },
  'folder.create': { label: 'Folder created', dot: 'bg-green-500' },
  'folder.update': { label: 'Folder renamed', dot: 'bg-amber-500' },
  'folder.delete': { label: 'Folder deleted', dot: 'bg-red-500' },
  'folder.move': { label: 'Folder moved', dot: 'bg-sky-500' }
}

const HistoryModal = ({ open, isDark, mode = 'global', target = null, onClose }) => {
  const vault = useVault()
  const { auth } = useAuth()
  const meId = auth && auth.user ? auth.user.id : null

  const [records, setRecords] = useState([])
  const [decrypted, setDecrypted] = useState({}) // recordId -> decrypted fields | null
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [revealed, setRevealed] = useState({}) // recordId -> show password
  const [searchInput, setSearchInput] = useState('') // immediate input value
  const [search, setSearch] = useState('') // debounced term that drives filtering + auto-load (Activity view only)

  // Debounce the search term so filtering + page auto-loading don't fire on every
  // keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(id)
  }, [searchInput])

  // Resolve a folder id to its current name (for move summaries). Deleted folders
  // fall back to a short id so the row still reads sensibly.
  const folderName = useMemo(() => {
    const map = new Map((vault.folders || []).map((f) => [f.id, f.name]))
    return (id) => (id == null ? 'Unfiled' : (map.get(id) || 'a folder'))
  }, [vault.folders])

  const itemTitleById = useMemo(() => {
    const map = new Map((vault.items || []).map((i) => [i.id, i.title]))
    return (id) => map.get(id) || null
  }, [vault.items])

  // Client-side search over the Activity feed. The server only ever holds
  // ciphertext, so search runs over the rows already loaded + decrypted here —
  // "Load more" pulls further history to search across. Matches the entry/folder
  // name, the actor (you / email), the action, and an entry's username/URL.
  const visibleRecords = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) => {
      const parts = []
      const meta = ACTION_META[r.action]
      if (meta) parts.push(meta.label)
      if (r.actorId && r.actorId === meId) parts.push('you')
      if (r.actorEmail) parts.push(r.actorEmail)
      const f = decrypted[r.id]
      if (r.targetType === 'folder') {
        parts.push((f && f.name) || folderName(r.targetId))
      } else {
        parts.push((f && f.title) || itemTitleById(r.targetId) || '')
        if (f) { parts.push(f.username || ''); parts.push(f.url || '') }
      }
      if (r.meta) {
        if ('toFolderId' in r.meta) parts.push(folderName(r.meta.toFolderId))
        if ('fromFolderId' in r.meta) parts.push(folderName(r.meta.fromFolderId))
      }
      return parts.join(' ').toLowerCase().includes(q)
    })
  }, [records, decrypted, search, meId, folderName, itemTitleById])

  const fetchPage = (before) => {
    const q = `?limit=${PAGE}${before ? `&before=${before}` : ''}`
    if (mode === 'item') return vault.getItemHistory(target.id, q)
    if (mode === 'folder') return vault.getFolderHistory(target.id, q)
    return vault.getAudit(q)
  }

  const decryptRecords = async (recs) => {
    const pairs = await Promise.all(recs.map(async (r) => {
      try { return [r.id, await vault.decryptSnapshot(r)] } catch (err) { return [r.id, null] }
    }))
    return Object.fromEntries(pairs)
  }

  useEffect(() => {
    if (!open) return undefined
    document.body.style.overflow = 'hidden'
    let cancelled = false
    setLoading(true); setError(null); setExpandedId(null); setRevealed({}); setSearch(''); setSearchInput('')
    setRecords([]); setDecrypted({})
    ;(async () => {
      try {
        const recs = await fetchPage(null)
        const dec = await decryptRecords(recs)
        if (cancelled) return
        setRecords(recs)
        setDecrypted(dec)
        setHasMore(recs.length === PAGE)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load history')
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true; document.body.style.overflow = '' }
  }, [open, mode, target && target.id])

  const loadMore = async () => {
    if (!records.length) return
    setLoadingMore(true)
    try {
      const before = records[records.length - 1].createdAt
      const recs = await fetchPage(before)
      const dec = await decryptRecords(recs)
      setRecords((prev) => [...prev, ...recs])
      setDecrypted((prev) => ({ ...prev, ...dec }))
      setHasMore(recs.length === PAGE)
    } catch (err) {
      setError(err.message || 'Could not load more history')
    }
    setLoadingMore(false)
  }

  // While a search is active in the Activity view, keep pulling pages so the
  // client-side filter covers the whole history, not just what's loaded. Each
  // append re-runs this effect, chaining page-by-page until history is exhausted
  // (hasMore false). Bails on error and when the search is cleared.
  useEffect(() => {
    if (!open || mode !== 'global') return
    if (!search.trim()) return
    if (loading || loadingMore || error || !hasMore) return
    loadMore()
  }, [open, mode, search, loading, loadingMore, error, hasMore, records])

  if (!open) return null

  const heading = mode === 'item'
    ? 'Entry history'
    : mode === 'folder' ? 'Folder history' : 'Vault activity'
  const subheading = mode === 'item'
    ? (target && target.title) || 'Entry'
    : mode === 'folder' ? (target && target.name) || 'Folder' : 'Every change across your vault'

  const actorLabel = (r) => (r.actorId && r.actorId === meId ? 'You' : (r.actorEmail || 'Someone'))

  const inputClass = `w-full px-3 py-2 rounded-lg outline-none transition-all duration-200 ${isDark ? 'bg-white/5 text-theme-dark placeholder:text-theme-secondary-dark border border-white/10 focus:border-white/30' : 'bg-white text-theme-light placeholder:text-theme-secondary-light border border-black/15 focus:border-black/40'}`

  // The previous snapshot-bearing record (records are newest-first), used to diff
  // an edit against the version before it. Only meaningful in single-entry mode.
  const prevSnapshotFields = (idx) => {
    if (mode !== 'item') return null
    for (let j = idx + 1; j < records.length; j++) {
      const f = decrypted[records[j].id]
      if (f) return f
    }
    return null
  }

  const summaryFor = (r) => {
    const meta = ACTION_META[r.action] || { label: r.action }
    if (r.action === 'item.move') return `Moved to ${folderName(r.meta && r.meta.toFolderId)}`
    if (r.action === 'folder.move') return `Moved under ${folderName(r.meta && r.meta.toParentId)}`
    return meta.label
  }

  // A short label for WHICH thing changed — used in folder / global views where
  // rows are a mix of entries and folders.
  const targetLabel = (r) => {
    if (r.targetType === 'folder') {
      const f = decrypted[r.id]
      return (f && f.name) || folderName(r.targetId)
    }
    const f = decrypted[r.id]
    return (f && f.title) || itemTitleById(r.targetId) || '(entry)'
  }

  return (
    <div className='fixed inset-0 z-[70]' style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}>
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-full max-w-xl p-6 rounded-xl shadow-2xl z-10 max-h-[85vh] overflow-y-auto ${isDark ? 'glass-modal-dark border border-white/10' : 'glass-modal-light border border-black/10'}`}
        style={{ top: '8vh' }}
      >
        <h2 className={`text-xl font-medium ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{heading}</h2>
        <p className={`text-xs mb-4 truncate ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>{subheading}</p>

        {/* Search is Activity-only — the per-entry / per-folder views are already scoped. */}
        {mode === 'global' && !loading && !error && records.length > 0 && (
          <div className='mb-4'>
            <input
              className={inputClass}
              type='text'
              placeholder='Search by entry, folder, person, or action…'
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete='off'
              data-1p-ignore
              data-lpignore='true'
            />
          </div>
        )}

        {loading && (
          <div className='py-10'>
            <LoadingSpinner className='flex justify-center' />
          </div>
        )}

        {error && !loading && <p className='text-sm text-red-400 py-4'>{error}</p>}

        {!loading && !error && records.length === 0 && (
          <p className={`text-sm py-6 text-center ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
            No history recorded yet.
          </p>
        )}

        {!loading && !error && records.length > 0 && (
          <div className='space-y-1'>
            {visibleRecords.length === 0 && (
              <p className={`text-sm py-6 text-center ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                {(loadingMore || hasMore) ? 'Searching earlier history…' : 'No matches found.'}
              </p>
            )}
            {visibleRecords.map((r, idx) => {
              const meta = ACTION_META[r.action] || { label: r.action, dot: 'bg-gray-400' }
              const fields = decrypted[r.id]
              const isItem = r.targetType === 'item'
              const canExpand = isItem && !!fields
              const expanded = expandedId === r.id
              const prev = expanded ? prevSnapshotFields(idx) : null
              return (
                <div key={r.id} className={`rounded-lg ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                  <button
                    type='button'
                    className={`w-full flex items-start gap-3 px-3 py-2 text-left ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => canExpand && setExpandedId(expanded ? null : r.id)}
                  >
                    <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <div className='min-w-0 flex-1'>
                      <p className={`text-sm font-medium truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                        {summaryFor(r)}
                        {mode !== 'item' && (
                          <span className={`font-normal ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}> · {targetLabel(r)}</span>
                        )}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                        by {actorLabel(r)}{canExpand ? (expanded ? ' · hide details' : ' · show details') : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs flex-shrink-0 self-center ml-2 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}
                      title={new Date(r.createdAt).toLocaleString()}
                    >
                      {rel(r.createdAt)}
                    </span>
                  </button>

                  {expanded && fields && (
                    <div className={`px-3 pb-3 pt-1 ml-5 space-y-1 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                      {FIELDS.map(([key, label]) => {
                        const val = fields[key]
                        const changed = prev && (prev[key] || '') !== (val || '')
                        if (!val && !changed) return null
                        const isPw = key === 'password'
                        return (
                          <div key={key} className='flex items-baseline gap-2 pt-1'>
                            <span className={`text-[11px] w-16 flex-shrink-0 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>{label}</span>
                            <span
                              className={`text-xs break-all ${isPw && !revealed[r.id] ? 'mask-text' : ''} ${changed ? (isDark ? 'text-amber-300' : 'text-amber-700') : (isDark ? 'text-theme-dark' : 'text-theme-light')}`}
                            >
                              {val || <span className='italic opacity-60'>(empty)</span>}
                            </span>
                            {isPw && val && (
                              <button
                                type='button'
                                className={`text-[11px] flex-shrink-0 ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
                                onClick={() => setRevealed((s) => ({ ...s, [r.id]: !s[r.id] }))}
                              >
                                {revealed[r.id] ? 'hide' : 'show'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {prev && (
                        <p className={`text-[11px] pt-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                          Highlighted fields changed from the previous version.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* While searching, older pages auto-load (see the effect above), so
                show progress instead of a manual button. */}
            {search.trim()
              ? ((loadingMore || hasMore) && (
                <p className={`w-full mt-2 py-2 text-center text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                  Searching earlier history…
                </p>
                ))
              : (hasMore && (
                <button
                  type='button'
                  className={`w-full mt-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
                ))}
          </div>
        )}

        <div className='flex justify-end mt-5'>
          <button
            className={`px-4 py-2 rounded-lg ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default HistoryModal
