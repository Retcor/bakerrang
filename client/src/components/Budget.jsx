import React, { useState, useEffect, useRef } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'
import ContentWrapper from './ContentWrapper.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import BudgetItemModal from './BudgetItemModal.jsx'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  'one-time': '#3B82F6',
  debt: '#EF4444',
  utility: '#8B5CF6',
  payday: '#10B981'
}

const CATEGORY_BG = {
  'one-time': 'bg-blue-500',
  debt: 'bg-red-500',
  utility: 'bg-purple-500',
  payday: 'bg-emerald-500'
}

const CATEGORY_LIGHT_BG = {
  'one-time': 'bg-blue-100 text-blue-800',
  debt: 'bg-red-100 text-red-800',
  utility: 'bg-purple-100 text-purple-800',
  payday: 'bg-emerald-100 text-emerald-800'
}

const CATEGORY_DARK_BG = {
  'one-time': 'bg-blue-900/50 text-blue-300',
  debt: 'bg-red-900/50 text-red-300',
  utility: 'bg-purple-900/50 text-purple-300',
  payday: 'bg-emerald-900/50 text-emerald-300'
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// ─── Utility helpers ──────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const lastDayOfMonth = (year, month) => new Date(year, month + 1, 0).getDate()

/** Returns all dates (as day numbers) a payday falls on within the given month/year */
const getPaydayDaysInMonth = (payday, year, month) => {
  const days = []
  const last = lastDayOfMonth(year, month)

  if (payday.frequency === 'monthly') {
    if (payday.dayType === 'first') {
      days.push(1)
    } else if (payday.dayType === 'last') {
      days.push(last)
    } else {
      const d = parseInt(payday.day, 10)
      if (d >= 1 && d <= last) days.push(d)
    }
  } else {
    // biweekly or weekly
    const interval = payday.frequency === 'biweekly' ? 14 : 7
    const anchor = new Date(payday.startDate)
    // Walk forward from anchor until we've passed the month
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month, last)

    // Find first occurrence at or after monthStart
    let cur = new Date(anchor)
    // Move anchor forward to first occurrence >= monthStart
    while (cur < monthStart) {
      cur = new Date(cur.getTime() + interval * 86400000)
    }
    // Also check if going backward from anchor hits any days in the month
    let back = new Date(anchor)
    while (back > monthStart) {
      back = new Date(back.getTime() - interval * 86400000)
    }
    back = new Date(back.getTime() + interval * 86400000)
    cur = back

    while (cur <= monthEnd) {
      if (cur.getFullYear() === year && cur.getMonth() === month) {
        days.push(cur.getDate())
      }
      cur = new Date(cur.getTime() + interval * 86400000)
    }
  }

  return [...new Set(days)].sort((a, b) => a - b)
}

/** Returns the day number(s) an item falls on for a given month/year, or [] if not applicable */
const getItemDaysInMonth = (item, year, month) => {
  if (!item.active) return []

  const last = lastDayOfMonth(year, month)

  if (item.category === 'one-time') {
    const d = new Date(item.day)
    if (d.getFullYear() === year && d.getMonth() === month) {
      return [d.getDate()]
    }
    return []
  }

  // Check end date for debt items
  if (item.endDate) {
    const end = new Date(item.endDate)
    const endYear = end.getFullYear()
    const endMonth = end.getMonth()
    if (year > endYear || (year === endYear && month > endMonth)) return []
  }

  if (item.dayType === 'first') return [1]
  if (item.dayType === 'last') return [last]

  const d = parseInt(item.day, 10)
  if (d >= 1 && d <= last) return [d]
  // If day > last (e.g., 31st in a 30-day month), use last day
  if (d > last) return [last]
  return []
}

/** Build calendar entries for a month: array of {day, entries[]} */
const buildCalendarEntries = (items, paydays, year, month) => {
  const map = {}

  paydays.forEach(pd => {
    getPaydayDaysInMonth(pd, year, month).forEach(day => {
      if (!map[day]) map[day] = []
      map[day].push({ ...pd, _type: 'payday' })
    })
  })

  items.forEach(item => {
    getItemDaysInMonth(item, year, month).forEach(day => {
      if (!map[day]) map[day] = []
      map[day].push({ ...item, _type: 'item' })
    })
  })

  return map
}

/** Monthly summary: group items under their preceding payday */
const buildMonthlySummary = (items, paydays, year, month) => {
  // Collect sorted payday occurrences with amounts
  const pdOccurrences = []
  paydays.forEach(pd => {
    getPaydayDaysInMonth(pd, year, month).forEach(day => {
      pdOccurrences.push({ ...pd, _day: day })
    })
  })
  pdOccurrences.sort((a, b) => a._day - b._day)

  // Collect item occurrences
  const itemOccurrences = []
  items.forEach(item => {
    if (!item.active) return
    getItemDaysInMonth(item, year, month).forEach(day => {
      itemOccurrences.push({ ...item, _day: day })
    })
  })
  itemOccurrences.sort((a, b) => a._day - b._day)

  // Assign items to paydays
  const groups = pdOccurrences.map(pd => ({ payday: pd, items: [] }))
  const unassigned = []

  itemOccurrences.forEach(item => {
    // If pinned to a specific payday, go there directly
    if (item.paydayId) {
      const target = groups.find(g => g.payday.id === item.paydayId)
      if (target) { target.items.push(item); return }
      // Pinned payday not in this month — fall through to chronological logic
    }

    // Find the last payday that is <= item day
    let assigned = false
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].payday._day <= item._day) {
        groups[i].items.push(item)
        assigned = true
        break
      }
    }
    if (!assigned) {
      // Item is before first payday — put it under first payday if exists
      if (groups.length > 0) {
        groups[0].items.push(item)
      } else {
        unassigned.push(item)
      }
    }
  })

  return { groups, unassigned }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CategoryBadge = ({ category, isDark }) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${isDark ? CATEGORY_DARK_BG[category] : CATEGORY_LIGHT_BG[category]}`}>
    {category}
  </span>
)

const FormField = ({ label, children, isDark }) => (
  <div className='mb-3'>
    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
      {label}
    </label>
    {children}
  </div>
)

const TextInput = ({ value, onChange, placeholder, type = 'text', isDark, className = '' }) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full px-3 py-2 rounded-lg text-sm border transition-colors duration-200 outline-none
      ${isDark
        ? 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/40'
        : 'bg-black/5 border-black/15 text-gray-900 placeholder-gray-400 focus:border-black/30'}
      ${className}`}
  />
)

const SelectInput = ({ value, onChange, options, isDark }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className={`w-full px-3 py-2 rounded-lg text-sm border transition-colors duration-200 outline-none cursor-pointer
      ${isDark
        ? 'bg-white/10 border-white/20 text-white focus:border-white/40'
        : 'bg-black/5 border-black/15 text-gray-900 focus:border-black/30'}`}
  >
    {options.map(o => (
      <option key={o.value} value={o.value} className={isDark ? 'bg-gray-800' : 'bg-white'}>
        {o.label}
      </option>
    ))}
  </select>
)

// ─── Item Form ────────────────────────────────────────────────────────────────

const ItemForm = ({ category, initial, onSave, isDark, paydays }) => {
  const isPayday = category === 'payday'

  const [name, setName] = useState(initial?.name || '')
  const [amount, setAmount] = useState(initial?.amount?.toString() || '')
  const [dayType, setDayType] = useState(initial?.dayType || 'fixed')
  const [day, setDay] = useState(initial?.day?.toString() || '1')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [url, setUrl] = useState(initial?.url || '')
  const [autoPay, setAutoPay] = useState(initial?.autoPay || false)
  const [active, setActive] = useState(initial?.active !== false)
  const [balance, setBalance] = useState(initial?.balance?.toString() || '')
  const [endDate, setEndDate] = useState(initial?.endDate || '')
  const [frequency, setFrequency] = useState(initial?.frequency || 'monthly')
  const [startDate, setStartDate] = useState(initial?.startDate || new Date().toISOString().slice(0, 10))
  const [paydayId, setPaydayId] = useState(initial?.paydayId || '')

  const dayTypeOptions = [
    { value: 'fixed', label: 'Fixed day of month' },
    { value: 'first', label: 'First day of month' },
    { value: 'last', label: 'Last day of month' }
  ]

  const frequencyOptions = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'biweekly', label: 'Biweekly' },
    { value: 'weekly', label: 'Weekly' }
  ]

  const resetForm = () => {
    setName('')
    setAmount('')
    setDayType('fixed')
    setDay('1')
    setNotes('')
    setUrl('')
    setAutoPay(false)
    setActive(true)
    setBalance('')
    setEndDate('')
    setFrequency('monthly')
    setStartDate(new Date().toISOString().slice(0, 10))
    setPaydayId('')
  }

  const handleSave = () => {
    if (!name.trim() || !amount) return
    const base = {
      id: initial?.id || uid(),
      name: name.trim(),
      amount: parseFloat(amount) || 0
    }
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
        category,
        dayType: category === 'one-time' ? 'specific' : dayType,
        day: category === 'one-time' ? day : (dayType === 'fixed' ? parseInt(day, 10) : dayType),
        notes: notes.trim(),
        url: url.trim(),
        autoPay,
        active,
        balance: category === 'debt' && balance ? parseFloat(balance) : null,
        endDate: category === 'debt' && endDate ? endDate : null,
        paydayId: paydayId || null
      })
    }
    if (!initial) resetForm()
  }

  const inputClass = `w-full px-3 py-2 rounded-lg text-sm border transition-colors duration-200 outline-none
    ${isDark
      ? 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/40'
      : 'bg-black/5 border-black/15 text-gray-900 placeholder-gray-400 focus:border-black/30'}`

  return (
    <div>
      <FormField label='Name' isDark={isDark}>
        <TextInput value={name} onChange={setName} placeholder={isPayday ? 'e.g. Primary Job' : 'e.g. Netflix'} isDark={isDark} />
      </FormField>

      <FormField label={isPayday ? 'Payday Amount ($)' : 'Amount ($)'} isDark={isDark}>
        <TextInput value={amount} onChange={setAmount} placeholder='0.00' type='number' isDark={isDark} />
      </FormField>

      {isPayday && (
        <>
          <FormField label='Frequency' isDark={isDark}>
            <SelectInput value={frequency} onChange={setFrequency} options={frequencyOptions} isDark={isDark} />
          </FormField>
          {frequency === 'monthly'
            ? (
              <>
                <FormField label='Day Type' isDark={isDark}>
                  <SelectInput value={dayType} onChange={setDayType} options={dayTypeOptions} isDark={isDark} />
                </FormField>
                {dayType === 'fixed' && (
                  <FormField label='Day of Month' isDark={isDark}>
                    <TextInput value={day} onChange={setDay} placeholder='1–31' type='number' isDark={isDark} />
                  </FormField>
                )}
              </>
              )
            : (
              <FormField label='First Occurrence Date' isDark={isDark}>
                <input type='date' value={startDate} onChange={e => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </FormField>
              )}
        </>
      )}

      {!isPayday && category !== 'one-time' && (
        <>
          <FormField label='Day Type' isDark={isDark}>
            <SelectInput value={dayType} onChange={setDayType} options={dayTypeOptions} isDark={isDark} />
          </FormField>
          {dayType === 'fixed' && (
            <FormField label='Day of Month' isDark={isDark}>
              <TextInput value={day} onChange={setDay} placeholder='1–31' type='number' isDark={isDark} />
            </FormField>
          )}
        </>
      )}

      {category === 'one-time' && (
        <FormField label='Date' isDark={isDark}>
          <input type='date' value={day} onChange={e => setDay(e.target.value)}
            className={inputClass}
          />
        </FormField>
      )}

      {category === 'debt' && (
        <>
          <FormField label='Remaining Balance ($, optional)' isDark={isDark}>
            <TextInput value={balance} onChange={setBalance} placeholder='0.00' type='number' isDark={isDark} />
          </FormField>
          <FormField label='End Date (optional)' isDark={isDark}>
            <input type='date' value={endDate} onChange={e => setEndDate(e.target.value)}
              className={inputClass}
            />
          </FormField>
        </>
      )}

      {!isPayday && (
        <>
          <FormField label='Notes (optional)' isDark={isDark}>
            <TextInput value={notes} onChange={setNotes} placeholder='Add a note...' isDark={isDark} />
          </FormField>
          <FormField label='URL (optional)' isDark={isDark}>
            <TextInput value={url} onChange={setUrl} placeholder='https://...' isDark={isDark} />
          </FormField>

          {paydays && paydays.length > 0 && (
            <FormField label='Associate with Payday (optional)' isDark={isDark}>
              <select
                value={paydayId}
                onChange={e => setPaydayId(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm border transition-colors duration-200 outline-none cursor-pointer
                  ${isDark
                    ? 'bg-white/10 border-white/20 text-white focus:border-white/40'
                    : 'bg-black/5 border-black/15 text-gray-900 focus:border-black/30'}`}
              >
                <option value='' className={isDark ? 'bg-gray-800' : 'bg-white'}>(auto-assign)</option>
                {paydays.map(pd => (
                  <option key={pd.id} value={pd.id} className={isDark ? 'bg-gray-800' : 'bg-white'}>{pd.name}</option>
                ))}
              </select>
            </FormField>
          )}

          <div className='flex items-center gap-4 mt-4 mb-3'>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox' checked={autoPay} onChange={e => setAutoPay(e.target.checked)}
                className='w-4 h-4 rounded accent-emerald-500'
              />
              <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Auto-pay</span>
            </label>
            {category !== 'one-time' && (
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='checkbox' checked={active} onChange={e => setActive(e.target.checked)}
                  className='w-4 h-4 rounded accent-emerald-500'
                />
                <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Active</span>
              </label>
            )}
          </div>
        </>
      )}

      <button
        onClick={handleSave}
        disabled={!name.trim() || !amount}
        className={`w-full py-2 rounded-lg text-sm font-medium transition-all duration-200 mt-4
          ${(!name.trim() || !amount)
            ? isDark
              ? 'bg-white/10 text-white/30 cursor-not-allowed border border-white/10'
              : 'bg-black/8 text-black/30 cursor-not-allowed border border-black/10'
            : isDark
              ? 'bg-accent-dark text-gray-900 hover:opacity-90'
              : 'bg-accent-light text-white hover:opacity-90'}`}
      >
        {initial ? 'Update' : 'Add'} {isPayday ? 'Payday' : category.charAt(0).toUpperCase() + category.slice(1)}
      </button>
    </div>
  )
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

const CalendarCell = ({ day, entries, isDark, onEntryClick, col }) => {
  const [hovered, setHovered] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const today = new Date()

  const mobileLimit = 1
  const desktopLimit = 3
  const visibleMobile = expanded ? entries.length : mobileLimit
  const visibleDesktop = expanded ? entries.length : desktopLimit
  const hiddenMobile = entries.length - mobileLimit
  const hiddenDesktop = entries.length - desktopLimit

  return (
    <div className={`min-h-[52px] sm:min-h-[80px] md:min-h-[90px] p-1 border-b border-r overflow-visible
      ${isDark ? 'border-white/5' : 'border-black/5'}`}
    >
      {day && (
        <>
          <span className={`text-xs font-medium leading-none block mb-1
            ${today.getDate() === day ? (isDark ? 'text-accent-dark font-bold' : 'text-accent-light font-bold') : (isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light')}`}
          >
            {day}
          </span>
          <div className='space-y-0.5'>
            {entries.map((entry, i) => {
              const hiddenOnMobile = i >= visibleMobile
              const hiddenOnDesktop = i >= visibleDesktop
              if (hiddenOnMobile && hiddenOnDesktop) return null
              return (
                <div
                  key={`${entry.id}-${i}`}
                  className={`relative overflow-visible${hiddenOnMobile ? ' hidden sm:block' : ''}${!hiddenOnMobile && hiddenOnDesktop ? ' sm:hidden' : ''}`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <button
                    onClick={() => onEntryClick(entry)}
                    className='w-full text-left px-1.5 py-0.5 rounded text-xs truncate text-white font-medium transition-opacity hover:opacity-80'
                    style={{ backgroundColor: CATEGORY_COLORS[entry._type === 'payday' ? 'payday' : entry.category] }}
                  >
                    {entry._type === 'payday' ? '💰 ' : ''}{entry.name}
                  </button>
                  {hovered === i && (
                    <div className={`absolute top-full mt-1 z-[100] w-44 rounded-lg p-2 shadow-xl border text-xs pointer-events-none
                      ${col >= 5 ? 'right-0' : 'left-0'}
                      ${isDark ? 'bg-gray-900 border-white/10 text-white' : 'bg-white border-black/10 text-gray-900'}`}
                    >
                      <p className='font-semibold truncate'>{entry.name}</p>
                      <p className='mt-0.5'>${parseFloat(entry.amount).toFixed(2)}</p>
                      {entry._type !== 'payday' && <CategoryBadge category={entry.category} isDark={isDark} />}
                      {entry.autoPay && <p className='mt-0.5 text-emerald-400'>✓ Auto-pay</p>}
                      {entry.notes && <p className='mt-0.5 opacity-70 truncate'>{entry.notes}</p>}
                      <p className='mt-1 opacity-50 italic'>Click to edit / delete</p>
                    </div>
                  )}
                </div>
              )
            })}
            {!expanded && hiddenMobile > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className={`text-xs px-1 sm:hidden hover:underline ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}
              >
                +{hiddenMobile} more
              </button>
            )}
            {!expanded && hiddenDesktop > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className={`text-xs px-1 hidden sm:block hover:underline ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}
              >
                +{hiddenDesktop} more
              </button>
            )}
            {expanded && entries.length > desktopLimit && (
              <button
                onClick={() => setExpanded(false)}
                className={`text-xs px-1 hover:underline ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}
              >
                show less
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const Budget = () => {
  const { isDark } = useTheme()

  // Data
  const [items, setItems] = useState([])
  const [paydays, setPaydays] = useState([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('utility')
  const [showExisting, setShowExisting] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  // Modal state
  const [editEntry, setEditEntry] = useState(null) // entry clicked on calendar
  const [confirmDelete, setConfirmDelete] = useState(null)

  const toggleGroup = (id) => setCollapsedGroups(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // ── Fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await request(`${SERVER_PREFIX}/budget`, 'GET')
        const data = await res.json()
        setItems(data.items || [])
        setPaydays(data.paydays || [])
      } catch (e) {
        console.error('Failed to load budget', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── CRUD helpers ────────────────────────────────────────────────────────────
  const handleSaveItem = async (item) => {
    const res = await request(`${SERVER_PREFIX}/budget/item`, 'POST',
      { 'Content-Type': 'application/json' }, JSON.stringify(item))
    const saved = await res.json()
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === saved.id)
      return idx >= 0 ? prev.map(i => i.id === saved.id ? saved : i) : [...prev, saved]
    })
    setEditEntry(null)
  }

  const handleDeleteItem = async (id) => {
    await request(`${SERVER_PREFIX}/budget/item/${id}`, 'DELETE')
    setItems(prev => prev.filter(i => i.id !== id))
    setConfirmDelete(null)
    setEditEntry(null)
  }

  const handleSavePayday = async (payday) => {
    const res = await request(`${SERVER_PREFIX}/budget/payday`, 'POST',
      { 'Content-Type': 'application/json' }, JSON.stringify(payday))
    const saved = await res.json()
    setPaydays(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved]
    })
    setEditEntry(null)
  }

  const handleDeletePayday = async (id) => {
    await request(`${SERVER_PREFIX}/budget/payday/${id}`, 'DELETE')
    setPaydays(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
    setEditEntry(null)
  }

  // ── Calendar data ───────────────────────────────────────────────────────────
  const calendarEntries = buildCalendarEntries(items, paydays, currentYear, currentMonth)
  const summary = buildMonthlySummary(items, paydays, currentYear, currentMonth)

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = lastDayOfMonth(currentYear, currentMonth)
  const calendarDays = []
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d)

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) } else { setCurrentMonth(m => m - 1) }
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) } else { setCurrentMonth(m => m + 1) }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const card = `rounded-2xl transition-all duration-300 ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'}`
  const tabClass = (t) => `px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer border
    ${activeTab === t
      ? (isDark ? 'bg-accent-dark text-gray-900 border-transparent' : 'bg-accent-light text-white border-transparent')
      : (isDark ? 'text-theme-secondary-dark bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' : 'text-theme-secondary-light bg-black/5 border-black/10 hover:bg-black/10 hover:border-black/20')}`

  const totalIncome = summary.groups.reduce((s, g) => s + g.payday.amount, 0)
  const totalExpenses = summary.groups.reduce((s, g) => s + g.items.reduce((ss, i) => ss + i.amount, 0), 0) +
    summary.unassigned.reduce((s, i) => s + i.amount, 0)

  return (
    <ContentWrapper title='Budget'>
      {/* Hero */}
      <div className={`${card} p-6 mb-6`}>
        <div className='flex items-center justify-between flex-wrap gap-4'>
          <div className='flex items-center space-x-4'>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className={`w-8 h-8 ${isDark ? 'text-gray-900' : 'text-white'}`}>
                <path strokeLinecap='round' strokeLinejoin='round' d='M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
              </svg>
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Budget</h2>
              <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                Track your monthly budget, bills, and income
              </p>
            </div>
          </div>
          <div className='flex gap-4 flex-wrap'>
            {[
              { label: 'Budget Items', value: items.length },
              { label: 'Paydays', value: paydays.length },
              { label: 'Monthly Out', value: `$${totalExpenses.toFixed(0)}` }
            ].map(s => (
              <div key={s.label} className={`rounded-xl px-4 py-3 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                <div className={`text-xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{s.value}</div>
                <div className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading
        ? (
          <div className={`${card} p-12 flex items-center justify-center`}>
            <div className={`w-8 h-8 border-2 rounded-full animate-spin ${isDark ? 'border-white/20 border-t-white' : 'border-black/20 border-t-black'}`} />
          </div>
          )
        : (
          <div className='flex flex-col lg:flex-row gap-4 lg:items-start'>

            {/* ── Left Sidebar ─────────────────────────────────────────────── */}
            <div className={`flex-shrink-0 transition-all duration-300 w-full ${sidebarOpen ? 'lg:w-64' : 'lg:w-10'}`}>
              {/* Toggle button */}
              <button
                onClick={() => setSidebarOpen(o => !o)}
                className={`w-full flex items-center justify-center py-2 mb-2 rounded-xl transition-all duration-200
                  ${isDark ? 'bg-white/5 hover:bg-white/10 text-theme-secondary-dark' : 'bg-black/5 hover:bg-black/10 text-theme-secondary-light'}`}
                title={sidebarOpen ? 'Collapse panel' : 'Expand panel'}
              >
                <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4'>
                  <path strokeLinecap='round' strokeLinejoin='round' d={sidebarOpen ? 'M15.75 19.5L8.25 12l7.5-7.5' : 'M8.25 4.5l7.5 7.5-7.5 7.5'} />
                </svg>
                <span className={`ml-2 text-xs font-medium${!sidebarOpen ? ' lg:hidden' : ''}`}>
                  {sidebarOpen ? 'Hide Panel' : 'Add Items'}
                </span>
              </button>

              {sidebarOpen && (
                <div className={`${card} p-4`}>
                  {/* Category tabs */}
                  <div className='grid grid-cols-2 gap-1 mb-4'>
                    {['one-time', 'debt', 'utility', 'payday'].map(t => (
                      <button key={t} className={tabClass(t)} onClick={() => { setActiveTab(t); setShowExisting(false) }}>
                        {t === 'one-time' ? 'One-time' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Color indicator */}
                  <div className='flex items-center gap-2 mb-4'>
                    <span className='w-3 h-3 rounded-full flex-shrink-0' style={{ backgroundColor: CATEGORY_COLORS[activeTab === 'payday' ? 'payday' : activeTab] }} />
                    <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                      {activeTab === 'one-time' && 'One-time expenses (single date)'}
                      {activeTab === 'debt' && 'Recurring debt payments'}
                      {activeTab === 'utility' && 'Recurring monthly bills'}
                      {activeTab === 'payday' && 'Income / paycheck entries'}
                    </span>
                  </div>

                  {/* Add form */}
                  <ItemForm
                    key={activeTab}
                    category={activeTab}
                    isDark={isDark}
                    onSave={activeTab === 'payday' ? handleSavePayday : handleSaveItem}
                    paydays={activeTab !== 'payday' ? paydays : undefined}
                  />

                  {/* Existing items list */}
                  {activeTab !== 'payday' && items.filter(i => i.category === activeTab).length > 0 && (
                    <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                      <button
                        onClick={() => setShowExisting(v => !v)}
                        className={`w-full flex items-center justify-between text-xs font-medium mb-2 transition-colors duration-200
                          ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
                      >
                        <span>Existing ({items.filter(i => i.category === activeTab).length})</span>
                        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2' stroke='currentColor'
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${showExisting ? 'rotate-180' : ''}`}>
                          <path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
                        </svg>
                      </button>
                      {showExisting && (
                        <div className='space-y-1 max-h-48 overflow-y-auto'>
                          {items.filter(i => i.category === activeTab).map(item => (
                            <button
                              key={item.id}
                              onClick={() => setEditEntry(item)}
                              className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors duration-200
                                ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}
                                ${!item.active ? 'opacity-40' : ''}`}
                            >
                              <span className={`truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{item.name}</span>
                              <span className={`ml-2 flex-shrink-0 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                                ${item.amount.toFixed(0)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'payday' && paydays.length > 0 && (
                    <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                      <button
                        onClick={() => setShowExisting(v => !v)}
                        className={`w-full flex items-center justify-between text-xs font-medium mb-2 transition-colors duration-200
                          ${isDark ? 'text-theme-secondary-dark hover:text-theme-dark' : 'text-theme-secondary-light hover:text-theme-light'}`}
                      >
                        <span>Existing ({paydays.length})</span>
                        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2' stroke='currentColor'
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${showExisting ? 'rotate-180' : ''}`}>
                          <path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
                        </svg>
                      </button>
                      {showExisting && (
                        <div className='space-y-1 max-h-48 overflow-y-auto'>
                          {paydays.map(pd => (
                            <button
                              key={pd.id}
                              onClick={() => setEditEntry({ ...pd, _type: 'payday' })}
                              className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors duration-200 ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
                            >
                              <span className={`truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{pd.name}</span>
                              <span className={`ml-2 flex-shrink-0 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                                ${pd.amount.toFixed(0)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Calendar ─────────────────────────────────────────────────── */}
            <div className='flex-1 min-w-0'>
              <div className={`${card} overflow-hidden`}>
                {/* Month navigation */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
                  <button onClick={prevMonth} className={`p-2 rounded-lg transition-colors duration-200 ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                    <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2' stroke='currentColor' className='w-4 h-4'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M15.75 19.5L8.25 12l7.5-7.5' />
                    </svg>
                  </button>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </h3>
                  <button onClick={nextMonth} className={`p-2 rounded-lg transition-colors duration-200 ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                    <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2' stroke='currentColor' className='w-4 h-4'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M8.25 4.5l7.5 7.5-7.5 7.5' />
                    </svg>
                  </button>
                </div>

                {/* Day headers */}
                <div className='grid grid-cols-7'>
                  {DAY_NAMES.map(d => (
                    <div key={d} className={`py-2 text-center text-xs font-semibold border-b border-r
                      ${isDark ? 'border-white/5 text-theme-secondary-dark' : 'border-black/5 text-theme-secondary-light'}`}>
                      <span className='hidden sm:inline'>{d}</span>
                      <span className='sm:hidden'>{d[0]}</span>
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className='grid grid-cols-7'>
                  {calendarDays.map((day, i) => (
                    <CalendarCell
                      key={i}
                      day={day}
                      col={i % 7}
                      entries={day ? (calendarEntries[day] || []) : []}
                      isDark={isDark}
                      onEntryClick={setEditEntry}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className={`flex flex-wrap gap-3 px-6 py-3 border-t ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
                  {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                    <div key={cat} className='flex items-center gap-1.5'>
                      <span className='w-3 h-3 rounded-sm flex-shrink-0' style={{ backgroundColor: color }} />
                      <span className={`text-xs capitalize ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                        {cat === 'one-time' ? 'One-time' : cat}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right Panel (Monthly Summary) ─────────────────────────────── */}
            <div className='flex-shrink-0 w-full lg:w-64'>
              <div className={`${card} p-4`}>
                <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                  {MONTH_NAMES[currentMonth]} Summary
                </h3>

                {summary.groups.length === 0 && summary.unassigned.length === 0 && (
                  <p className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                    No items this month. Add paydays and budget items to see your summary.
                  </p>
                )}

                <div className='space-y-4'>
                  {summary.groups.map((group, gi) => {
                    const groupTotal = group.items.reduce((s, i) => s + i.amount, 0)
                    const leftover = group.payday.amount - groupTotal
                    const isExpanded = collapsedGroups.has(group.payday.id)
                    const ordinal = group.payday._day
                      ? `${group.payday._day}${['st','nd','rd'][((group.payday._day + 90) % 100 - 10 + 9) % 9] || 'th'}`
                      : ''
                    return (
                      <div key={`${group.payday.id}-${gi}`} className={`rounded-xl overflow-hidden ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                        {/* Clickable header — always visible */}
                        <button
                          onClick={() => toggleGroup(group.payday.id)}
                          className={`w-full flex items-center justify-between p-3 text-left transition-colors duration-150 ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                        >
                          <div className='min-w-0 flex-1'>
                            <p className={`text-xs font-semibold truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                              💰 {group.payday.name}
                            </p>
                            <p className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                              {ordinal ? `${ordinal} — ` : ''}<span className={`font-medium ${leftover >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${leftover.toFixed(2)}</span> left
                            </p>
                          </div>
                          <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2' stroke='currentColor'
                            className={`w-3 h-3 flex-shrink-0 ml-2 transition-transform duration-200 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'} ${isExpanded ? 'rotate-180' : ''}`}
                          >
                            <path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
                          </svg>
                        </button>

                        {/* Expandable body */}
                        {isExpanded && (
                          <div className={`px-3 pb-3 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                            <div className='pt-2'>
                              {group.items.length > 0
                                ? (
                                  <div className='space-y-1 mb-2'>
                                    {group.items.map((item, ii) => (
                                      <div key={`${item.id}-${ii}`} className='flex items-center justify-between'>
                                        <div className='flex items-center gap-1 min-w-0'>
                                          <span className='w-2 h-2 rounded-full flex-shrink-0' style={{ backgroundColor: CATEGORY_COLORS[item.category] }} />
                                          <span className={`text-xs truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{item.name}</span>
                                          {item.autoPay && <span className='text-xs text-emerald-400 flex-shrink-0'>A</span>}
                                        </div>
                                        <span className={`text-xs ml-2 flex-shrink-0 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                                          ${item.amount.toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  )
                                : (
                                  <p className={`text-xs italic mb-2 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>No bills this period</p>
                                  )}
                              <div className={`pt-2 border-t flex items-center justify-between ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                                <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Income</span>
                                <span className={`text-xs font-medium ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>${group.payday.amount.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {summary.unassigned.length > 0 && (
                    <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                      <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Unassigned items</p>
                      {summary.unassigned.map((item, i) => (
                        <div key={`u-${item.id}-${i}`} className='flex items-center justify-between'>
                          <span className={`text-xs truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{item.name}</span>
                          <span className={`text-xs ml-2 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>${item.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Month totals */}
                {(summary.groups.length > 0 || summary.unassigned.length > 0) && (
                  <div className={`mt-4 pt-4 border-t space-y-1 ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                    <div className='flex justify-between'>
                      <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Total Income</span>
                      <span className={`text-xs font-semibold text-emerald-500`}>${totalIncome.toFixed(2)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Total Expenses</span>
                      <span className={`text-xs font-semibold text-red-500`}>${totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between pt-1 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                      <span className={`text-xs font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Net</span>
                      <span className={`text-xs font-bold ${(totalIncome - totalExpenses) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        ${(totalIncome - totalExpenses).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

      {/* Edit / Delete Modal */}
      {editEntry && (
        <BudgetItemModal
          entry={editEntry}
          isDark={isDark}
          onClose={() => setEditEntry(null)}
          onSave={editEntry._type === 'payday' ? handleSavePayday : handleSaveItem}
          onDelete={() => setConfirmDelete(editEntry)}
          paydays={paydays}
        />
      )}

      {/* Confirm delete */}
      <ConfirmModal
        open={!!confirmDelete}
        title='Delete Item'
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This cannot be undone.`}
        cancelFunc={() => setConfirmDelete(null)}
        confirmFunc={() =>
          confirmDelete._type === 'payday'
            ? handleDeletePayday(confirmDelete.id)
            : handleDeleteItem(confirmDelete.id)}
      />
    </ContentWrapper>
  )
}

export default Budget
