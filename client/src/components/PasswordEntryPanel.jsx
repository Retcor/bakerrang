import React, { useEffect, useState } from 'react'
import { LoadingSpinner } from './index.js'
import FolderSelect from './FolderSelect.jsx'

const EMPTY = { title: '', username: '', password: '', url: '', notes: '', folderId: null }

const generatePassword = (length = 20) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}'
  const values = window.crypto.getRandomValues(new Uint32Array(length))
  let out = ''
  for (let i = 0; i < length; i++) out += charset[values[i] % charset.length]
  return out
}

// A responsive detail panel for viewing/editing an entry. On large screens it
// sits as a column beside the entry list, filling the app shell's height so it
// never moves while the list scrolls; on small screens it slides over the list as
// a full overlay with a Back control. Parent should remount it (via a `key`) when
// the selected entry changes so the form resets cleanly.
const PasswordEntryPanel = ({ isDark, entry, folders = [], defaultFolderId = null, readOnly = false, hideDelete = false, hideFolder = false, onSave, onDelete, onClose }) => {
  const isNew = !(entry && entry.id)
  const [form, setForm] = useState(() => (isNew ? { ...EMPTY, folderId: defaultFolderId } : { ...EMPTY, ...entry }))
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const [saveError, setSaveError] = useState(null)
  const [shown, setShown] = useState(false)

  // Trigger the slide/fade-in on mount.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const copy = async (field) => {
    try {
      await navigator.clipboard.writeText(form[field] || '')
      setCopied(field)
      setTimeout(() => setCopied(''), 1500)
    } catch (err) { /* clipboard blocked; ignore */ }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      await onSave({ ...form, folderId: form.folderId || null })
    } catch (err) {
      setSaveError(err.message || 'Failed to save entry')
      setIsSaving(false)
      return
    }
    setIsSaving(false)
  }

  const fieldClass = `w-full px-3 py-2 rounded-lg outline-none transition-all duration-200 ${isDark ? 'bg-white/5 text-theme-dark placeholder:text-theme-secondary-dark border border-white/10 focus:border-white/30' : 'bg-white text-theme-light placeholder:text-theme-secondary-light border border-black/15 focus:border-black/40'}`
  const labelClass = `block text-xs font-semibold mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`
  const folderOptions = [{ value: '', label: 'No folder', depth: 0 }, ...folders.map((f) => ({ value: f.id, label: f.name, depth: f.depth || 0 }))]

  return (
    <div
      // `position: fixed` is unprefixed (the mobile overlay), so an explicit
      // `lg:static` is mandatory — not just dropping a previous `lg:sticky`. No
      // `lg:self-start`, so the parent row's `align-items: stretch` sizes the panel
      // to the shell, giving the unprefixed `overflow-y-auto` a definite height to
      // scroll against on short windows; when the form fits there's no overflow at
      // all and nothing is clipped.
      className={`fixed inset-0 z-50 overflow-y-auto p-4 ${isDark ? 'bg-gray-900' : 'bg-white'} lg:static lg:z-auto lg:inset-auto lg:max-h-full lg:p-0 lg:bg-transparent lg:w-[440px] lg:shrink-0 transition-all duration-300 ${shown ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
    >
      <div className={`rounded-2xl p-6 min-h-full lg:min-h-0 lg:border ${isDark ? 'lg:glass-card-dark lg:border-white/10' : 'lg:glass-card-light lg:border-black/10'}`}>
        <div className='flex items-center justify-between mb-4'>
          <button
            onClick={onClose}
            title='Back to list'
            className={`flex items-center gap-1 text-sm transition-colors ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
          >
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2' stroke='currentColor' className='w-5 h-5'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M15.75 19.5L8.25 12l7.5-7.5' />
            </svg>
            <span className='lg:hidden'>Back</span>
          </button>
          <h2 className={`text-lg font-medium ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{isNew ? 'New Entry' : 'Edit Entry'}</h2>
          <span className='w-5' />
        </div>

        <div className='space-y-3'>
          <div>
            <label className={labelClass}>Title</label>
            <input className={fieldClass} value={form.title} onChange={update('title')} placeholder='e.g. Gmail' autoComplete='off' autoFocus />
          </div>

          <div>
            <label className={labelClass}>Username</label>
            <div className='flex gap-2'>
              <input
                className={fieldClass}
                value={form.username}
                onChange={update('username')}
                placeholder='user@example.com'
                autoComplete='off'
                data-1p-ignore
                data-lpignore='true'
              />
              <CopyButton isDark={isDark} active={copied === 'username'} onClick={() => copy('username')} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <div className='flex gap-2'>
              <input
                className={`${fieldClass} ${showPassword ? '' : 'mask-text'}`}
                type='text'
                value={form.password}
                onChange={update('password')}
                autoComplete='off'
                autoCorrect='off'
                autoCapitalize='off'
                spellCheck='false'
                data-1p-ignore
                data-lpignore='true'
              />
              <IconButton isDark={isDark} title={showPassword ? 'Hide' : 'Show'} onClick={() => setShowPassword((s) => !s)}>
                {showPassword
                  ? (
                    <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-5 h-5'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.066 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88' />
                    </svg>
                    )
                  : (
                    <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-5 h-5'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z' />
                      <path strokeLinecap='round' strokeLinejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                    </svg>
                    )}
              </IconButton>
              <IconButton isDark={isDark} title='Generate' onClick={() => setForm((p) => ({ ...p, password: generatePassword() }))}>
                ⟳
              </IconButton>
              <CopyButton isDark={isDark} active={copied === 'password'} onClick={() => copy('password')} />
            </div>
          </div>

          <div>
            <label className={labelClass}>URL</label>
            <input className={fieldClass} value={form.url} onChange={update('url')} placeholder='https://…' autoComplete='off' />
          </div>

          {!hideFolder && (
            <div>
              <label className={labelClass}>Folder</label>
              <FolderSelect
                isDark={isDark}
                value={form.folderId || ''}
                options={folderOptions}
                onChange={(v) => setForm((p) => ({ ...p, folderId: v || null }))}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Notes</label>
            <textarea className={fieldClass} rows={4} value={form.notes} onChange={update('notes')} placeholder='Optional notes' />
          </div>
        </div>

        {saveError && <p className='text-sm text-red-400 mt-3'>{saveError}</p>}

        {readOnly && (
          <p className={`text-xs mt-3 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
            You have view-only access to this shared folder.
          </p>
        )}

        <div className='flex justify-between items-center mt-5'>
          {!isNew && !hideDelete
            ? (
              <button
                className='px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all duration-200'
                onClick={() => onDelete(entry)}
              >
                Delete
              </button>
              )
            : <span />}
          {!readOnly && (
            <button
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg disabled:opacity-50 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
              onClick={handleSave}
              disabled={isSaving || !form.title.trim()}
            >
              {isSaving
                ? <LoadingSpinner className='flex justify-center' svgClassName={`!h-4 !w-4 ${isDark ? '!fill-gray-800 !text-gray-800/40' : '!fill-white !text-white/40'}`} />
                : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const IconButton = ({ isDark, title, onClick, children }) => (
  <button
    type='button'
    title={title}
    onClick={onClick}
    className={`px-3 rounded-lg flex-shrink-0 flex items-center justify-center font-medium shadow-lg transition-all duration-200 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
  >
    {children}
  </button>
)

const CopyButton = ({ isDark, active, onClick }) => (
  <IconButton isDark={isDark} title='Copy' onClick={onClick}>
    {active ? '✓' : '⧉'}
  </IconButton>
)

export default PasswordEntryPanel
