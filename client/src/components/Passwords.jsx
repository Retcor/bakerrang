import React, { useMemo, useState } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { useVault } from '../providers/VaultProvider.jsx'
import { LoadingSpinner, ConfirmModal } from './index.js'
import PasswordEntryModal from './PasswordEntryModal.jsx'
import KeePassImportModal from './KeePassImportModal.jsx'

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

const cardClass = (isDark) => `rounded-2xl p-6 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`
const inputClass = (isDark) => `w-full px-3 py-2 rounded-lg outline-none transition-all duration-200 ${isDark ? 'bg-white/5 text-theme-dark placeholder:text-theme-secondary-dark border border-white/10 focus:border-white/30' : 'bg-black/5 text-theme-light placeholder:text-theme-secondary-light border border-black/10 focus:border-black/30'}`
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
          {busy ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Create Vault'}
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
          {busy ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Unlock'}
        </button>
      </div>
    </div>
  )
}

const VaultView = ({ isDark, vault }) => {
  const { items, folders } = vault
  const [selectedFolder, setSelectedFolder] = useState('all') // 'all' | 'none' | folderId
  const [editing, setEditing] = useState(null) // entry object or {} for new
  const [importOpen, setImportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // { type, id, name }
  const [newFolderName, setNewFolderName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)

  const visibleItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    if (selectedFolder === 'all') return sorted
    if (selectedFolder === 'none') return sorted.filter((i) => !i.folderId)
    return sorted.filter((i) => i.folderId === selectedFolder)
  }, [items, selectedFolder])

  const handleSaveEntry = async (entry) => {
    await vault.saveItem(entry)
    setEditing(null)
  }

  // Map each KeePass group name to a vault folder (reusing folders that already
  // match by name), then bulk-import the selected entries into them.
  const handleImportKeepass = async (selected) => {
    const folderIdByName = {}
    folders.forEach((f) => { folderIdByName[f.name] = f.id })
    const groupNames = [...new Set(selected.map((e) => e.group).filter(Boolean))]
    for (const name of groupNames) {
      if (!folderIdByName[name]) {
        const created = await vault.saveFolder({ name })
        folderIdByName[name] = created.id
      }
    }
    const withFolder = selected.map((e) => ({
      title: e.title,
      username: e.username,
      password: e.password,
      url: e.url,
      notes: e.notes,
      folderId: e.group ? folderIdByName[e.group] : null
    }))
    await vault.importItems(withFolder)
  }

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return
    await vault.saveFolder({ name: newFolderName.trim() })
    setNewFolderName('')
    setAddingFolder(false)
  }

  const handleConfirmDelete = async () => {
    const target = confirmDelete
    setConfirmDelete(null)
    if (target.type === 'item') await vault.deleteItem(target.id)
    else await vault.deleteFolder(target.id)
  }

  const folderTab = (key, label, count) => (
    <button
      key={key}
      onClick={() => setSelectedFolder(key)}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-all duration-200 ${selectedFolder === key ? (isDark ? 'bg-white/15 text-theme-dark' : 'bg-black/10 text-theme-light') : (isDark ? 'text-theme-secondary-dark hover:bg-white/5' : 'text-theme-secondary-light hover:bg-black/5')}`}
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
          <button className={primaryBtn(isDark)} onClick={() => setEditing({})}>+ New Entry</button>
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

      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        {/* Folder sidebar */}
        <div className={`${cardClass(isDark)} md:col-span-1 h-fit`}>
          <div className='space-y-1'>
            {folderTab('all', 'All Items', items.length)}
            {folderTab('none', 'Unfiled', items.filter((i) => !i.folderId).length)}
            <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`} />
            {folders.map((f) => (
              <div key={f.id} className='group flex items-center'>
                {folderTab(f.id, f.name, items.filter((i) => i.folderId === f.id).length)}
                <button
                  title='Delete folder'
                  onClick={() => setConfirmDelete({ type: 'folder', id: f.id, name: f.name })}
                  className='ml-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 px-1'
                >
                  ×
                </button>
              </div>
            ))}
            {addingFolder
              ? (
                <div className='flex gap-1 mt-2'>
                  <input
                    className={inputClass(isDark)}
                    placeholder='Folder name'
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddFolder() }}
                    autoFocus
                  />
                  <button className={primaryBtn(isDark)} onClick={handleAddFolder}>✓</button>
                </div>
                )
              : (
                <button
                  onClick={() => setAddingFolder(true)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm mt-2 transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:bg-white/5' : 'text-theme-secondary-light hover:bg-black/5'}`}
                >
                  + New Folder
                </button>
                )}
          </div>
        </div>

        {/* Entry list */}
        <div className='md:col-span-3'>
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
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className={`group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-200 ${isDark ? 'glass-dark hover:bg-white/10 border border-white/10' : 'glass-light hover:bg-black/5 border border-black/10'}`}
                    onClick={() => setEditing(item)}
                  >
                    <div className='min-w-0'>
                      <p className={`font-medium truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{item.title || '(untitled)'}</p>
                      <p className={`text-xs truncate ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>{item.username || item.url || ''}</p>
                    </div>
                    <button
                      title='Delete entry'
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'item', id: item.id, name: item.title }) }}
                      className='opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 px-2 flex-shrink-0'
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              )}
        </div>
      </div>

      <PasswordEntryModal
        open={editing !== null}
        entry={editing && editing.id ? editing : null}
        folders={folders}
        defaultFolderId={selectedFolder !== 'all' && selectedFolder !== 'none' ? selectedFolder : null}
        onSave={handleSaveEntry}
        onCancel={() => setEditing(null)}
      />

      <KeePassImportModal
        open={importOpen}
        onImport={handleImportKeepass}
        onClose={() => setImportOpen(false)}
      />

      <ConfirmModal
        open={confirmDelete !== null}
        title={confirmDelete?.type === 'folder' ? 'Delete folder?' : 'Delete entry?'}
        message={confirmDelete?.type === 'folder'
          ? `Delete folder "${confirmDelete?.name}"? Entries inside will be moved to Unfiled.`
          : `Delete "${confirmDelete?.name || 'this entry'}"? This cannot be undone.`}
        cancelFunc={() => setConfirmDelete(null)}
        confirmFunc={handleConfirmDelete}
      />
    </div>
  )
}

export default Passwords
