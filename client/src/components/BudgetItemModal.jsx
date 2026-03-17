import React, { useState, useEffect } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const CATEGORY_COLORS = {
  'one-time': '#3B82F6',
  debt: '#EF4444',
  utility: '#8B5CF6',
  payday: '#10B981'
}

const DAY_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Fixed day of month' },
  { value: 'first', label: 'First day of month' },
  { value: 'last', label: 'Last day of month' }
]

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'weekly', label: 'Weekly' }
]

const BudgetItemModal = ({ entry, onClose, onSave, onDelete }) => {
  const { isDark } = useTheme()
  const isPayday = entry._type === 'payday'

  const [name, setName] = useState(entry.name || '')
  const [amount, setAmount] = useState(entry.amount?.toString() || '')
  const [dayType, setDayType] = useState(entry.dayType || 'fixed')
  const [day, setDay] = useState(entry.day?.toString() || '1')
  const [notes, setNotes] = useState(entry.notes || '')
  const [url, setUrl] = useState(entry.url || '')
  const [autoPay, setAutoPay] = useState(entry.autoPay || false)
  const [active, setActive] = useState(entry.active !== false)
  const [balance, setBalance] = useState(entry.balance?.toString() || '')
  const [endDate, setEndDate] = useState(entry.endDate || '')
  const [frequency, setFrequency] = useState(entry.frequency || 'monthly')
  const [startDate, setStartDate] = useState(entry.startDate || new Date().toISOString().slice(0, 10))

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [])

  const inputClass = `w-full px-3 py-2 rounded-lg text-sm border transition-colors duration-200 outline-none
    ${isDark
      ? 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/40'
      : 'bg-black/5 border-black/15 text-gray-900 placeholder-gray-400 focus:border-black/30'}`

  const selectClass = `w-full px-3 py-2 rounded-lg text-sm border transition-colors duration-200 outline-none cursor-pointer
    ${isDark
      ? 'bg-white/10 border-white/20 text-white focus:border-white/40'
      : 'bg-black/5 border-black/15 text-gray-900 focus:border-black/30'}`

  const labelClass = `block text-xs font-medium mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`

  const handleSave = () => {
    if (!name.trim() || !amount) return
    const base = { id: entry.id, name: name.trim(), amount: parseFloat(amount) || 0 }

    if (isPayday) {
      onSave({
        ...base,
        frequency,
        dayType: frequency === 'monthly' ? dayType : undefined,
        day: frequency === 'monthly' && dayType === 'fixed' ? parseInt(day, 10) : undefined,
        startDate: frequency !== 'monthly' ? startDate : undefined
      })
    } else {
      onSave({
        ...base,
        category: entry.category,
        dayType: entry.category === 'one-time' ? 'specific' : dayType,
        day: entry.category === 'one-time' ? day : (dayType === 'fixed' ? parseInt(day, 10) : dayType),
        notes: notes.trim(),
        url: url.trim(),
        autoPay,
        active,
        balance: entry.category === 'debt' && balance ? parseFloat(balance) : null,
        endDate: entry.category === 'debt' && endDate ? endDate : null
      })
    }
  }

  const accentColor = CATEGORY_COLORS[isPayday ? 'payday' : entry.category]

  return (
    <div className='fixed inset-0 z-50 flex justify-center items-start pt-[10vh]'>
      {/* Backdrop */}
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />

      {/* Modal */}
      <div className={`relative z-10 w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden
        ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'}`}
      >
        {/* Header */}
        <div className='px-6 py-4 flex items-center justify-between' style={{ borderBottom: `2px solid ${accentColor}30` }}>
          <div className='flex items-center gap-3'>
            <span className='w-3 h-3 rounded-full flex-shrink-0' style={{ backgroundColor: accentColor }} />
            <h2 className={`text-base font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              Edit {isPayday ? 'Payday' : entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors duration-200 ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
          >
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2' stroke='currentColor' className='w-4 h-4'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className='px-6 py-4 max-h-[65vh] overflow-y-auto space-y-3'>
          {/* Name */}
          <div>
            <label className={labelClass}>Name</label>
            <input type='text' value={name} onChange={e => setName(e.target.value)} className={inputClass} />
          </div>

          {/* Amount */}
          <div>
            <label className={labelClass}>{isPayday ? 'Payday Amount ($)' : 'Amount ($)'}</label>
            <input type='number' value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} />
          </div>

          {/* Payday-specific */}
          {isPayday && (
            <>
              <div>
                <label className={labelClass}>Frequency</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)} className={selectClass}>
                  {FREQUENCY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className={isDark ? 'bg-gray-800' : 'bg-white'}>{o.label}</option>
                  ))}
                </select>
              </div>
              {frequency === 'monthly'
                ? (
                  <>
                    <div>
                      <label className={labelClass}>Day Type</label>
                      <select value={dayType} onChange={e => setDayType(e.target.value)} className={selectClass}>
                        {DAY_TYPE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value} className={isDark ? 'bg-gray-800' : 'bg-white'}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {dayType === 'fixed' && (
                      <div>
                        <label className={labelClass}>Day of Month</label>
                        <input type='number' value={day} onChange={e => setDay(e.target.value)} className={inputClass} min='1' max='31' />
                      </div>
                    )}
                  </>
                  )
                : (
                  <div>
                    <label className={labelClass}>First Occurrence Date</label>
                    <input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
                  </div>
                  )}
            </>
          )}

          {/* Item-specific day */}
          {!isPayday && entry.category !== 'one-time' && (
            <>
              <div>
                <label className={labelClass}>Day Type</label>
                <select value={dayType} onChange={e => setDayType(e.target.value)} className={selectClass}>
                  {DAY_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className={isDark ? 'bg-gray-800' : 'bg-white'}>{o.label}</option>
                  ))}
                </select>
              </div>
              {dayType === 'fixed' && (
                <div>
                  <label className={labelClass}>Day of Month</label>
                  <input type='number' value={day} onChange={e => setDay(e.target.value)} className={inputClass} min='1' max='31' />
                </div>
              )}
            </>
          )}

          {!isPayday && entry.category === 'one-time' && (
            <div>
              <label className={labelClass}>Date</label>
              <input type='date' value={day} onChange={e => setDay(e.target.value)} className={inputClass} />
            </div>
          )}

          {/* Debt extras */}
          {!isPayday && entry.category === 'debt' && (
            <>
              <div>
                <label className={labelClass}>Remaining Balance ($, optional)</label>
                <input type='number' value={balance} onChange={e => setBalance(e.target.value)} className={inputClass} placeholder='0.00' />
              </div>
              <div>
                <label className={labelClass}>End Date (optional)</label>
                <input type='date' value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
              </div>
            </>
          )}

          {/* Optional fields */}
          {!isPayday && (
            <>
              <div>
                <label className={labelClass}>Notes (optional)</label>
                <input type='text' value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder='Add a note...' />
              </div>
              <div>
                <label className={labelClass}>URL (optional)</label>
                <input type='text' value={url} onChange={e => setUrl(e.target.value)} className={inputClass} placeholder='https://...' />
              </div>
              <div className='flex items-center gap-6'>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input type='checkbox' checked={autoPay} onChange={e => setAutoPay(e.target.checked)} className='w-4 h-4 rounded accent-emerald-500' />
                  <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Auto-pay</span>
                </label>
                {entry.category !== 'one-time' && (
                  <label className='flex items-center gap-2 cursor-pointer'>
                    <input type='checkbox' checked={active} onChange={e => setActive(e.target.checked)} className='w-4 h-4 rounded accent-emerald-500' />
                    <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Active</span>
                  </label>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 flex items-center justify-between border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          <button
            onClick={onDelete}
            className='px-4 py-2 rounded-lg text-sm font-medium text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors duration-200'
          >
            Delete
          </button>
          <div className='flex gap-2'>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                ${isDark ? 'hover:bg-white/10 text-theme-secondary-dark' : 'hover:bg-black/10 text-theme-secondary-light'}`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !amount}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${(!name.trim() || !amount)
                  ? 'opacity-40 cursor-not-allowed'
                  : isDark ? 'bg-accent-dark text-gray-900 hover:opacity-90' : 'bg-accent-light text-white hover:opacity-90'}`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BudgetItemModal
