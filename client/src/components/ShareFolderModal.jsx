import React, { useEffect, useState } from 'react'
import { LoadingSpinner } from './index.js'
import FolderSelect from './FolderSelect.jsx'

// Share a folder with another user by email, and manage who currently has
// access. The folder key is wrapped to each recipient's public key client-side,
// so the server never learns it.
const ShareFolderModal = ({ open, isDark, folder, shares = [], onShare, onRevoke, onClose }) => {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState('edit')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      setEmail(''); setPermission('edit'); setError(null); setBusy(false)
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open || !folder) return null

  const handleShare = async () => {
    const trimmed = email.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await onShare(trimmed, permission)
      setEmail('')
    } catch (err) {
      setError(err.message || 'Could not share this folder')
    }
    setBusy(false)
  }

  const handleRevoke = async (shareId) => {
    setError(null)
    try {
      await onRevoke(shareId)
    } catch (err) {
      setError(err.message || 'Could not revoke access')
    }
  }

  const inputClass = `w-full px-3 py-2 rounded-lg outline-none transition-all duration-200 ${isDark ? 'bg-white/5 text-theme-dark placeholder:text-theme-secondary-dark border border-white/10 focus:border-white/30' : 'bg-white text-theme-light placeholder:text-theme-secondary-light border border-black/15 focus:border-black/40'}`
  const labelClass = `block text-xs font-semibold mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`

  return (
    <div className='fixed inset-0 z-50' style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}>
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-full max-w-lg p-6 rounded-xl shadow-2xl z-10 max-h-[85vh] overflow-y-auto ${isDark ? 'glass-modal-dark border border-white/10' : 'glass-modal-light border border-black/10'}`}
        style={{ top: '10vh' }}
      >
        <h2 className={`text-xl font-medium mb-1 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Share folder</h2>
        <p className={`text-xs mb-4 truncate ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
          “{folder.name}” — everything in this folder, including entries added later.
        </p>

        <div className='space-y-3'>
          <div>
            <label className={labelClass}>Share with (Google account email)</label>
            <input
              className={inputClass}
              type='email'
              placeholder='person@gmail.com'
              autoComplete='off'
              data-1p-ignore
              data-lpignore='true'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) handleShare() }}
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass}>Access</label>
            <FolderSelect
              isDark={isDark}
              value={permission}
              options={[
                { value: 'edit', label: 'Can edit', depth: 0 },
                { value: 'view', label: 'View only', depth: 0 }
              ]}
              onChange={setPermission}
            />
          </div>
          {error && <p className='text-sm text-red-400'>{error}</p>}
          <button
            className={`px-4 py-2 rounded-lg font-medium shadow-lg disabled:opacity-50 w-full ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
            onClick={handleShare}
            disabled={!email.trim() || busy}
          >
            {busy
              ? <LoadingSpinner className='flex justify-center' svgClassName={`!h-4 !w-4 ${isDark ? '!fill-gray-800 !text-gray-800/40' : '!fill-white !text-white/40'}`} />
              : 'Share'}
          </button>
        </div>

        <div className={`mt-5 pt-4 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
            People with access ({shares.length})
          </p>
          {shares.length === 0
            ? (
              <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                Not shared with anyone yet.
              </p>
              )
            : (
              <div className='space-y-1'>
                {shares.map((s) => (
                  <div key={s.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    <div className='min-w-0'>
                      <p className={`text-sm truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{s.recipientEmail}</p>
                      <p className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                        {s.permission === 'edit' ? 'Can edit' : 'View only'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(s.id)}
                      className='text-sm text-red-400 hover:text-red-300 px-2 flex-shrink-0'
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
              )}
          <p className={`text-[11px] mt-3 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
            Revoking stops future access. Anything they already opened they may still have — change the password to be certain.
          </p>
        </div>

        <div className='flex justify-end mt-5'>
          <button
            className={`px-4 py-2 rounded-lg ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShareFolderModal
