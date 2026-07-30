import React, { useEffect, useRef, useState } from 'react'

// A themed dropdown that replaces the native <select>, whose option popup is an
// OS-drawn window that can't be reliably styled for dark mode. This renders the
// open list as normal DOM, so both the closed control and the list are fully
// theme-controlled. `options` is [{ value, label, depth }].
const FolderSelect = ({ isDark, value, options, placeholder, onChange, dropUp, disabled, className }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button
        type='button'
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 lg:py-1.5 rounded-lg text-sm border transition-all duration-200 disabled:opacity-50 ${isDark ? 'bg-white/5 text-theme-dark border-white/10 hover:border-white/30' : 'bg-white text-theme-light border-black/15 hover:border-black/40'}`}
      >
        <span className={`truncate ${!selected ? (isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light') : ''}`}>
          {selected ? selected.label : (placeholder || 'Select…')}
        </span>
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='currentColor' className='w-4 h-4 flex-shrink-0 opacity-70'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M6 8l4 4 4-4' />
        </svg>
      </button>

      {open && (
        <div className={`absolute left-0 w-full z-50 max-h-60 overflow-auto rounded-lg border shadow-xl py-1 ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} ${isDark ? 'bg-gray-800 border-white/10' : 'bg-white border-black/10'}`}>
          {options.map((o) => (
            <button
              key={o.value}
              type='button'
              onClick={() => { onChange(o.value); setOpen(false) }}
              style={{ paddingLeft: `${12 + (o.depth || 0) * 14}px` }}
              className={`w-full text-left pr-3 py-2 text-sm truncate transition-colors duration-150 ${o.value === value ? (isDark ? 'bg-white/10 text-theme-dark' : 'bg-black/5 text-theme-light') : (isDark ? 'text-theme-dark hover:bg-white/10' : 'text-theme-light hover:bg-black/5')}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default FolderSelect
