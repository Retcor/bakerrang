import React, { useEffect, useState } from 'react'
import { LoadingSpinner } from './index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { getKdbxweb, ensureArgon2 } from '../utils/kdbx.js'

// Triggers a browser download of an ArrayBuffer without leaving a dangling
// object URL. There is no shared download helper in the app, so this is local.
const downloadBuffer = (buffer, filename) => {
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Rebuilds the vault's folder tree as nested KeePass groups and writes every
// entry into its group, then serialises to an encrypted KDBX4 (Argon2) buffer.
// `folders`/`items` are already-decrypted plaintext held in memory by the vault,
// so nothing here touches the server or the vault crypto — the file is encrypted
// solely with the user-supplied export password.
const buildKdbx = async (password, folders, items) => {
  ensureArgon2()
  const kdbxweb = getKdbxweb()
  const credentials = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(password))
  const db = kdbxweb.Kdbx.create(credentials, 'BakerRang Vault')
  const root = db.getDefaultGroup()

  // Create groups parent-before-child so every parent group exists when its
  // children are added. Folders whose parent is missing hang off the root.
  const idSet = new Set(folders.map((f) => f.id))
  const childrenByParent = new Map()
  for (const f of folders) {
    const pid = f.parentId && idSet.has(f.parentId) ? f.parentId : null
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(f)
  }
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => {
      const pa = typeof a.position === 'number' ? a.position : Number.MAX_SAFE_INTEGER
      const pb = typeof b.position === 'number' ? b.position : Number.MAX_SAFE_INTEGER
      if (pa !== pb) return pa - pb
      return (a.name || '').localeCompare(b.name || '')
    })
  }
  const groupMap = new Map()
  const walk = (parentId, parentGroup) => {
    for (const f of (childrenByParent.get(parentId) || [])) {
      const g = db.createGroup(parentGroup, f.name || 'Folder')
      groupMap.set(f.id, g)
      walk(f.id, g)
    }
  }
  walk(null, root)

  for (const item of items) {
    const group = (item.folderId && groupMap.get(item.folderId)) || root
    const entry = db.createEntry(group)
    entry.fields.set('Title', item.title || '')
    entry.fields.set('UserName', item.username || '')
    entry.fields.set('URL', item.url || '')
    entry.fields.set('Notes', item.notes || '')
    entry.fields.set('Password', kdbxweb.ProtectedValue.fromString(item.password || ''))
  }

  return db.save()
}

const ExportVaultModal = ({ open, items, folders, onClose }) => {
  const { isDark } = useTheme()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setPassword(''); setConfirm(''); setError(null); setBusy(false)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const canExport = password.length >= 8 && password === confirm && (items || []).length > 0

  const handleExport = async () => {
    setBusy(true)
    setError(null)
    try {
      const buffer = await buildKdbx(password, folders || [], items || [])
      const date = new Date().toISOString().slice(0, 10)
      downloadBuffer(buffer, `bakerrang-vault-${date}.kdbx`)
      onClose()
    } catch (err) {
      console.error('Vault export failed:', err)
      setError(err.message || 'Export failed')
      setBusy(false)
    }
  }

  if (!open) return null

  const inputClass = `w-full px-3 py-2 rounded-lg outline-none transition-all duration-200 ${isDark ? 'bg-white/5 text-theme-dark placeholder:text-theme-secondary-dark border border-white/10 focus:border-white/30' : 'bg-black/5 text-theme-light placeholder:text-theme-secondary-light border border-black/10 focus:border-black/30'}`

  return (
    <div className='fixed inset-0 z-50' style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}>
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-full max-w-md p-6 rounded-xl shadow-2xl z-10 max-h-[85vh] overflow-y-auto ${isDark ? 'glass-modal-dark border border-white/10' : 'glass-modal-light border border-black/10'}`}
        style={{ top: '10vh' }}
      >
        <h2 className={`text-xl font-medium mb-1 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Export vault</h2>
        <p className={`text-xs mb-4 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
          Downloads a KeePass 2.x (.kdbx) file built and encrypted here in your browser. Choose a password to
          protect the file — it can be different from your master password, and it isn't recoverable.
        </p>

        <div className={`flex items-start gap-2 p-3 mb-4 rounded-lg ${isDark ? 'bg-amber-400/10 border border-amber-400/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
          <span className='text-lg leading-none'>⚠️</span>
          <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
            The exported file contains <strong>all of your passwords</strong>. Anyone with the file and this
            export password can read them — store it somewhere safe.
          </span>
        </div>

        <div className='space-y-3'>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Export password (min 8 chars)</label>
            <input
              className={inputClass}
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Confirm export password</label>
            <input
              className={inputClass}
              type='password'
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canExport && !busy) handleExport() }}
            />
          </div>
          {confirm.length > 0 && password !== confirm && <p className='text-xs text-red-400'>Passwords do not match.</p>}
          {(items || []).length === 0 && <p className='text-xs text-red-400'>Your vault has no entries to export.</p>}
          {error && <p className='text-sm text-red-400'>{error}</p>}
          <div className='flex justify-end gap-2 pt-2'>
            <button className={`px-4 py-2 rounded-lg ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`} onClick={onClose}>Cancel</button>
            <button
              className={`relative px-4 py-2 rounded-lg font-medium shadow-lg disabled:opacity-50 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
              onClick={handleExport}
              disabled={!canExport || busy}
            >
              <span className={busy ? 'invisible' : ''}>Export .kdbx</span>
              {busy && (
                <span className='absolute inset-0 flex items-center justify-center'>
                  <LoadingSpinner svgClassName={`!h-4 !w-4 ${isDark ? '!fill-gray-800 !text-gray-800/40' : '!fill-white !text-white/40'}`} />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExportVaultModal
