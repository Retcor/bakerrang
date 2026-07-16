import React, { useEffect, useState } from 'react'
import { LoadingSpinner } from './index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'

const EMPTY = { title: '', username: '', password: '', url: '', notes: '', folderId: null }

const generatePassword = (length = 20) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}'
  const values = window.crypto.getRandomValues(new Uint32Array(length))
  let out = ''
  for (let i = 0; i < length; i++) out += charset[values[i] % charset.length]
  return out
}

// entry: existing item to edit, or null to create. folders: [{ id, name }].
const PasswordEntryModal = ({ open, entry, folders = [], defaultFolderId = null, onSave, onCancel }) => {
  const { isDark } = useTheme()
  const [form, setForm] = useState(EMPTY)
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      setForm(entry ? { ...EMPTY, ...entry } : { ...EMPTY, folderId: defaultFolderId })
      setShowPassword(false)
      setSaveError(null)
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open, entry, defaultFolderId])

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

  if (!open) return null

  const fieldClass = `w-full px-3 py-2 rounded-lg outline-none transition-all duration-200 ${isDark ? 'bg-white/5 text-theme-dark placeholder:text-theme-secondary-dark border border-white/10 focus:border-white/30' : 'bg-black/5 text-theme-light placeholder:text-theme-secondary-light border border-black/10 focus:border-black/30'}`
  const labelClass = `block text-xs font-semibold mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`

  return (
    <div className='fixed inset-0 z-50' style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}>
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' onClick={onCancel} />
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-full max-w-lg p-6 rounded-xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'}`}
        style={{ top: '10vh' }}
      >
        <h2 className={`text-xl font-medium mb-4 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
          {entry ? 'Edit Entry' : 'New Entry'}
        </h2>

        <div className='space-y-3'>
          <div>
            <label className={labelClass}>Title</label>
            <input className={fieldClass} value={form.title} onChange={update('title')} placeholder='e.g. Gmail' autoFocus />
          </div>

          <div>
            <label className={labelClass}>Username</label>
            <div className='flex gap-2'>
              <input className={fieldClass} value={form.username} onChange={update('username')} placeholder='user@example.com' />
              <CopyButton isDark={isDark} active={copied === 'username'} onClick={() => copy('username')} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <div className='flex gap-2'>
              <input
                className={fieldClass}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={update('password')}
                placeholder='••••••••'
              />
              <IconButton isDark={isDark} title={showPassword ? 'Hide' : 'Show'} onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? '🙈' : '👁'}
              </IconButton>
              <IconButton isDark={isDark} title='Generate' onClick={() => setForm((p) => ({ ...p, password: generatePassword() }))}>
                ⟳
              </IconButton>
              <CopyButton isDark={isDark} active={copied === 'password'} onClick={() => copy('password')} />
            </div>
          </div>

          <div>
            <label className={labelClass}>URL</label>
            <input className={fieldClass} value={form.url} onChange={update('url')} placeholder='https://…' />
          </div>

          <div>
            <label className={labelClass}>Folder</label>
            <select className={fieldClass} value={form.folderId || ''} onChange={(e) => setForm((p) => ({ ...p, folderId: e.target.value || null }))}>
              <option value=''>No folder</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea className={fieldClass} rows={3} value={form.notes} onChange={update('notes')} placeholder='Optional notes' />
          </div>
        </div>

        {saveError && <p className='text-sm text-red-400 mt-3'>{saveError}</p>}

        <div className='flex justify-end mt-5'>
          <button className={`mr-2 px-4 py-2 rounded-lg transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg disabled:opacity-50 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
            onClick={handleSave}
            disabled={isSaving || !form.title.trim()}
          >
            {isSaving ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Save'}
          </button>
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
    className={`px-3 rounded-lg flex-shrink-0 transition-all duration-200 ${isDark ? 'bg-white/5 hover:bg-white/15 text-theme-dark border border-white/10' : 'bg-black/5 hover:bg-black/15 text-theme-light border border-black/10'}`}
  >
    {children}
  </button>
)

const CopyButton = ({ isDark, active, onClick }) => (
  <IconButton isDark={isDark} title='Copy' onClick={onClick}>
    {active ? '✓' : '⧉'}
  </IconButton>
)

export default PasswordEntryModal
