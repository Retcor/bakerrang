import React, { useEffect, useMemo, useState } from 'react'
import * as kdbxwebModule from 'kdbxweb'
import { argon2d, argon2id } from 'hash-wasm'
import { LoadingSpinner } from './index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'

// kdbxweb ships a webpack UMD bundle; depending on the bundler's CJS interop
// the full API lands on either the default export or the namespace itself.
// Normalise so kdbxweb.CryptoEngine/Kdbx/Credentials are always present.
const kdbxweb = kdbxwebModule.default || kdbxwebModule

// KDBX4 files use Argon2 for key derivation, which kdbxweb does not bundle.
// Wire hash-wasm's implementation in. kdbxweb passes memory already in KiB,
// type 0 = Argon2d, type 2 = Argon2id.
let argon2Registered = false
const registerArgon2 = () => {
  if (argon2Registered) return
  kdbxweb.CryptoEngine.setArgon2Impl(async (password, salt, memory, iterations, length, parallelism, type) => {
    const fn = type === kdbxweb.CryptoEngine.Argon2TypeArgon2id ? argon2id : argon2d
    const hash = await fn({
      password: new Uint8Array(password),
      salt: new Uint8Array(salt),
      parallelism,
      iterations,
      memorySize: memory,
      hashLength: length,
      outputType: 'binary'
    })
    return hash.buffer
  })
  argon2Registered = true
}

const fieldText = (value) => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value.getText === 'function') return value.getText() // ProtectedValue
  return String(value)
}

// Recursively flatten KeePass groups into a list of entries tagged with their
// folder path. `pathArr` is the array of group names from the root down to the
// current group ([] for the root group, whose entries are treated as unfiled).
// Each entry carries `groupPath` (the array, used to rebuild a nested folder
// tree on import) and `group` (the joined string, used for display grouping).
// recycleBinId (if any) is skipped.
const flattenGroup = (group, out, recycleBinId, pathArr) => {
  const groupLabel = pathArr.join(' / ')
  for (const entry of group.entries) {
    const f = entry.fields
    out.push({
      key: entry.uuid ? entry.uuid.id : `${out.length}`,
      group: groupLabel,
      groupPath: pathArr,
      title: fieldText(f.get('Title')),
      username: fieldText(f.get('UserName')),
      password: fieldText(f.get('Password')),
      url: fieldText(f.get('URL')),
      notes: fieldText(f.get('Notes')),
      selected: true
    })
  }
  for (const child of group.groups) {
    if (recycleBinId && child.uuid && child.uuid.id === recycleBinId) continue
    flattenGroup(child, out, recycleBinId, [...pathArr, fieldText(child.name)])
  }
}

// Turns a kdbxweb error into a specific, actionable message.
const describeError = (err) => {
  const code = err && err.code
  switch (code) {
    case 'InvalidKey':
      return 'Incorrect password, or this database also needs a key file. Add the key file below if you use one.'
    case 'InvalidVersion':
      return 'Unsupported format. This looks like a KeePass 1.x (.kdb) file — open it in KeePass 2 and "Save As" a .kdbx first.'
    case 'Unsupported':
      return `This database uses a feature the importer can't handle (${err.message}). Older databases using the Twofish cipher aren't supported — re-save it in KeePass using AES.`
    case 'FileCorrupt':
      return 'This does not look like a valid .kdbx file (it may be corrupt or a different format).'
    default:
      return `Could not open the file: ${err && err.message ? err.message : 'unknown error'}`
  }
}

const KeePassImportModal = ({ open, onImport, onClose }) => {
  const { isDark } = useTheme()
  const [file, setFile] = useState(null)
  const [keyFile, setKeyFile] = useState(null)
  const [password, setPassword] = useState('')
  const [entries, setEntries] = useState(null) // null until parsed
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setFile(null); setKeyFile(null); setPassword(''); setEntries(null); setError(null); setLoading(false); setImporting(false)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleParse = async () => {
    setLoading(true)
    setError(null)
    try {
      registerArgon2()
      const buffer = await file.arrayBuffer()
      const keyFileBuffer = keyFile ? await keyFile.arrayBuffer() : null
      const pwd = password ? kdbxweb.ProtectedValue.fromString(password) : null
      const credentials = new kdbxweb.Credentials(pwd, keyFileBuffer)
      const db = await kdbxweb.Kdbx.load(buffer, credentials)
      const recycleBinId = db.meta && db.meta.recycleBinUuid ? db.meta.recycleBinUuid.id : null
      const flat = []
      flattenGroup(db.getDefaultGroup(), flat, recycleBinId, [])
      setEntries(flat)
    } catch (err) {
      console.error('KeePass import failed:', err)
      setError(describeError(err))
    }
    setLoading(false)
  }

  const toggle = (key) => setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, selected: !e.selected } : e)))
  const setAll = (selected) => setEntries((prev) => prev.map((e) => ({ ...e, selected })))
  const setGroupSelected = (group, selected) => setEntries((prev) => prev.map((e) => ((e.group || '') === group ? { ...e, selected } : e)))

  // Group the flat entry list by folder path for a readable, tree-like display.
  const groupedEntries = useMemo(() => {
    if (!entries) return []
    const map = new Map()
    for (const e of entries) {
      const key = e.group || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, groupItems]) => ({
        group,
        items: [...groupItems].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      }))
  }, [entries])

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    try {
      const selected = entries.filter((e) => e.selected)
      await onImport(selected)
      onClose()
    } catch (err) {
      setError(err.message || 'Import failed')
      setImporting(false)
    }
  }

  if (!open) return null

  const inputClass = `w-full px-3 py-2 rounded-lg outline-none transition-all duration-200 ${isDark ? 'bg-white/5 text-theme-dark placeholder:text-theme-secondary-dark border border-white/10 focus:border-white/30' : 'bg-black/5 text-theme-light placeholder:text-theme-secondary-light border border-black/10 focus:border-black/30'}`
  const selectedCount = entries ? entries.filter((e) => e.selected).length : 0

  return (
    <div className='fixed inset-0 z-50' style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}>
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-full max-w-2xl p-6 rounded-xl shadow-2xl z-10 max-h-[85vh] overflow-y-auto ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'}`}
        style={{ top: '8vh' }}
      >
        <h2 className={`text-xl font-medium mb-1 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Import from KeePass</h2>
        <p className={`text-xs mb-4 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
          Your .kdbx file is decrypted here in your browser — the file and its password are never uploaded.
        </p>

        {!entries && (
          <div className='space-y-3'>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>KeePass file (.kdbx)</label>
              <input
                type='file'
                accept='.kdbx'
                onChange={(e) => { setFile(e.target.files[0] || null); setError(null) }}
                className={`text-sm ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Master password for this file</label>
              <input
                className={`${inputClass} mask-text`}
                type='text'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && file && (password || keyFile)) handleParse() }}
                autoComplete='off'
                autoCorrect='off'
                autoCapitalize='off'
                spellCheck='false'
                data-1p-ignore
                data-lpignore='true'
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Key file (optional — only if your database uses one)</label>
              <input
                type='file'
                onChange={(e) => { setKeyFile(e.target.files[0] || null); setError(null) }}
                className={`text-sm ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}
              />
            </div>
            {error && <p className='text-sm text-red-400'>{error}</p>}
            <div className='flex justify-end gap-2 pt-2'>
              <button className={`px-4 py-2 rounded-lg ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`} onClick={onClose}>Cancel</button>
              <button
                className={`px-4 py-2 rounded-lg font-medium shadow-lg disabled:opacity-50 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
                onClick={handleParse}
                disabled={!file || (!password && !keyFile) || loading}
              >
                {loading
                  ? <LoadingSpinner className='flex justify-center' svgClassName={`!h-4 !w-4 ${isDark ? '!fill-gray-800 !text-gray-800/40' : '!fill-white !text-white/40'}`} />
                  : 'Open File'}
              </button>
            </div>
          </div>
        )}

        {entries && (
          <div>
            <div className='flex justify-between items-center mb-3'>
              <span className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                {selectedCount} of {entries.length} selected
              </span>
              <div className='flex gap-2 text-xs'>
                <button className={isDark ? 'text-brand-dark' : 'text-brand-light'} onClick={() => setAll(true)}>Select all</button>
                <button className={isDark ? 'text-brand-dark' : 'text-brand-light'} onClick={() => setAll(false)}>Select none</button>
              </div>
            </div>
            <div className={`rounded-lg border max-h-[45vh] overflow-y-auto ${isDark ? 'border-white/10' : 'border-black/10'}`}>
              {entries.length === 0 && (
                <p className={`p-4 text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>No entries found in this file.</p>
              )}
              {groupedEntries.map(({ group, items }) => {
                const allSelected = items.every((i) => i.selected)
                const groupSelectedCount = items.filter((i) => i.selected).length
                return (
                  <div key={group || '__unfiled__'}>
                    {/* Folder header with a per-folder select-all toggle */}
                    <label className={`flex items-center gap-3 px-3 py-2 cursor-pointer sticky top-0 z-10 ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>
                      <input type='checkbox' checked={allSelected} onChange={() => setGroupSelected(group, !allSelected)} />
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                        <path d='M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z' />
                      </svg>
                      <span className={`text-xs font-semibold truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                        {group || '(No folder)'}
                      </span>
                      <span className='text-[11px] opacity-60 ml-auto flex-shrink-0'>{groupSelectedCount}/{items.length}</span>
                    </label>
                    {items.map((e) => (
                      <label key={e.key} className={`flex items-center gap-3 py-2 pl-9 pr-3 cursor-pointer border-b last:border-b-0 ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-black/5 hover:bg-black/5'}`}>
                        <input type='checkbox' checked={e.selected} onChange={() => toggle(e.key)} />
                        <div className='min-w-0'>
                          <p className={`text-sm truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{e.title || '(untitled)'}</p>
                          <p className={`text-xs truncate ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                            {e.username || e.url || ''}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
            {error && <p className='text-sm text-red-400 mt-3'>{error}</p>}
            <div className='flex justify-end gap-2 mt-4'>
              <button className={`px-4 py-2 rounded-lg ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`} onClick={onClose}>Cancel</button>
              <button
                className={`px-4 py-2 rounded-lg font-medium shadow-lg disabled:opacity-50 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
              >
                {importing
                  ? <LoadingSpinner className='flex justify-center' svgClassName={`!h-4 !w-4 ${isDark ? '!fill-gray-800 !text-gray-800/40' : '!fill-white !text-white/40'}`} />
                  : `Import ${selectedCount} entr${selectedCount === 1 ? 'y' : 'ies'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default KeePassImportModal
