import React, { useState } from 'react'
import { useTheme } from '../../providers/ThemeProvider.jsx'
import { SERVER_PREFIX } from '../../App.jsx'
import CharacterPanel from './CharacterPanel.jsx'
import WoWChat from './WoWChat.jsx'

const REGIONS = [
  { value: 'us', label: 'US' },
  { value: 'eu', label: 'EU' },
  { value: 'kr', label: 'KR' },
  { value: 'tw', label: 'TW' }
]

const RECENTS_KEY = 'wow_advisor_recents'
const MAX_RECENTS = 10

function loadRecents () {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecent (name, realm, region) {
  const key = `${name.toLowerCase()}-${realm.toLowerCase()}-${region}`
  const existing = loadRecents().filter(r =>
    `${r.name.toLowerCase()}-${r.realm.toLowerCase()}-${r.region}` !== key
  )
  const updated = [{ name, realm, region }, ...existing].slice(0, MAX_RECENTS)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(updated))
  return updated
}

function removeRecent (name, realm, region) {
  const key = `${name.toLowerCase()}-${realm.toLowerCase()}-${region}`
  const updated = loadRecents().filter(r =>
    `${r.name.toLowerCase()}-${r.realm.toLowerCase()}-${r.region}` !== key
  )
  localStorage.setItem(RECENTS_KEY, JSON.stringify(updated))
  return updated
}

const WoWAdvisor = () => {
  const { isDark } = useTheme()
  const [name, setName] = useState('')
  const [realm, setRealm] = useState('')
  const [region, setRegion] = useState('us')
  const [state, setState] = useState('search') // 'search' | 'loading' | 'loaded' | 'error'
  const [character, setCharacter] = useState(null)
  const [error, setError] = useState('')
  const [addonData, setAddonData] = useState(null)
  const [recents, setRecents] = useState(loadRecents)
  const [savedState, setSavedState] = useState('idle') // 'idle' | 'saving' | 'saved'
  const [savedAt, setSavedAt] = useState(null)

  const cardClass = isDark ? 'glass-card-dark text-white' : 'glass-card-light text-gray-900'
  const inputClass = isDark
    ? 'bg-black/30 border-white/10 text-white placeholder-white/30 focus:border-[#D4ED31]/50'
    : 'bg-white/60 border-black/10 text-gray-900 placeholder-gray-400 focus:border-[#1e40af]/50'
  const labelClass = isDark ? 'text-white/70' : 'text-gray-600'
  const selectClass = isDark
    ? 'bg-black/30 border-white/10 text-white'
    : 'bg-white/60 border-black/10 text-gray-900'

  async function checkSaved (charName, charRealm, charRegion) {
    try {
      const res = await fetch(
        `${SERVER_PREFIX}/wow/character/saved?name=${encodeURIComponent(charName)}&realm=${encodeURIComponent(charRealm)}&region=${charRegion}`,
        { credentials: 'include' }
      )
      if (!res.ok) return
      const data = await res.json()
      if (data.saved) {
        setSavedState('saved')
        setSavedAt(data.saved.updatedAt)
      }
    } catch {
      // non-fatal — user may not be logged in
    }
  }

  async function autoLoad (charName, charRealm, charRegion, parsed) {
    const trimmedName = (charName || '').trim()
    const trimmedRealm = (charRealm || '').trim()
    if (!trimmedName || !trimmedRealm) return

    setState('loading')
    setError('')

    try {
      const res = await fetch(
        `${SERVER_PREFIX}/wow/character?name=${encodeURIComponent(trimmedName)}&realm=${encodeURIComponent(trimmedRealm)}&region=${charRegion}`,
        { credentials: 'include' }
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to load character')
        setState('error')
        return
      }

      setCharacter(data)
      setAddonData(parsed)
      setState('loaded')
      setRecents(saveRecent(trimmedName, trimmedRealm, charRegion))
      setSavedState('idle')
      setSavedAt(null)
      checkSaved(trimmedName, trimmedRealm, charRegion)
    } catch {
      setError('Could not connect to the server. Please try again.')
      setState('error')
    }
  }

  async function handleSearch (e) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedRealm = realm.trim()
    if (!trimmedName || !trimmedRealm) return

    setState('loading')
    setError('')

    try {
      const res = await fetch(
        `${SERVER_PREFIX}/wow/character?name=${encodeURIComponent(trimmedName)}&realm=${encodeURIComponent(trimmedRealm)}&region=${region}`,
        { credentials: 'include' }
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to load character')
        setState('error')
        return
      }

      setCharacter(data)
      setState('loaded')
      setRecents(saveRecent(trimmedName, trimmedRealm, region))
      setSavedState('idle')
      setSavedAt(null)
      checkSaved(trimmedName, trimmedRealm, region)
    } catch {
      setError('Could not connect to the server. Please try again.')
      setState('error')
    }
  }

  function handleReset () {
    setState('search')
    setCharacter(null)
    setError('')
    setAddonData(null)
    setSavedState('idle')
    setSavedAt(null)
  }

  function handleRecentClick (recent) {
    setName(recent.name)
    setRealm(recent.realm)
    setRegion(recent.region)
    autoLoad(recent.name, recent.realm, recent.region, null)
  }

  function handleRecentRemove (e, recent) {
    e.stopPropagation()
    setRecents(removeRecent(recent.name, recent.realm, recent.region))
  }

  async function handlePasteAddonData () {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text)
      if (parsed?.worldQuests || parsed?.character || parsed?.currencies || parsed?.vault) {
        setAddonData(parsed)
        // Persist to vector DB (only when character is already loaded)
        if (character) {
          setSavedState('saving')
          try {
            await fetch(`${SERVER_PREFIX}/wow/character/persist`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ characterData: character, addonData: parsed })
            })
            setSavedState('saved')
            setSavedAt(new Date().toISOString())
          } catch {
            setSavedState('idle')
          }
        }
      } else {
        alert('Clipboard does not contain valid addon data. Run /wowadvisor in-game first.')
      }
    } catch {
      alert('Could not read clipboard. Make sure you ran /wowadvisor in-game first.')
    }
  }

  if (state === 'loaded' && character) {
    return (
      <div className='min-h-screen px-4 py-8'>
        <div className='max-w-6xl mx-auto'>
          <div className='mb-6 flex items-start justify-between gap-4 flex-wrap'>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-brand-dark' : 'text-brand-light'}`}>WoW Advisor</h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                Powered by Blizzard API + RaiderIO + GPT-4o
              </p>
            </div>
            <div className='flex items-center gap-2'>
              {savedState === 'saved' && (
                <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='currentColor' className='w-3.5 h-3.5'>
                    <path fillRule='evenodd' d='M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z' clipRule='evenodd' />
                  </svg>
                  Saved to cloud
                </span>
              )}
              <button
                onClick={handlePasteAddonData}
                disabled={savedState === 'saving'}
                title='Paste addon data copied by the /wowadvisor in-game command'
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                  addonData
                    ? isDark ? 'bg-accent-dark text-gray-900' : 'bg-accent-light text-white'
                    : isDark ? 'bg-white/10 hover:bg-white/20 text-white/70' : 'bg-black/10 hover:bg-black/20 text-gray-600'
                }`}
              >
                {savedState === 'saving'
                  ? <span className='inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin' />
                  : (
                    <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184' />
                    </svg>
                  )}
                {addonData
                  ? `Addon Data Loaded`
                  : 'Paste Addon Data'}
              </button>
            </div>
          </div>
          <div className='grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start'>
            <CharacterPanel character={character} onReset={handleReset} />
            <WoWChat character={character} savedState={savedState} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen flex items-start justify-center px-4 py-16'>
      <div className='w-full max-w-md'>
        {/* Title */}
        <div className='text-center mb-8'>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-brand-dark' : 'text-brand-light'}`}>
            WoW Advisor
          </h1>
          <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            Look up any character and get AI-powered improvement advice
          </p>
        </div>

        {/* Search Form */}
        <div className={`rounded-2xl p-6 ${cardClass}`}>
          <form onSubmit={handleSearch} className='flex flex-col gap-4'>
            <div>
              <label className={`text-xs font-semibold uppercase tracking-wide mb-1.5 block ${labelClass}`}>
                Character Name
              </label>
              <input
                type='text'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='e.g. Thrall'
                required
                className={`w-full rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors ${inputClass}`}
              />
            </div>

            <div>
              <label className={`text-xs font-semibold uppercase tracking-wide mb-1.5 block ${labelClass}`}>
                Realm
              </label>
              <input
                type='text'
                value={realm}
                onChange={e => setRealm(e.target.value)}
                placeholder='e.g. Area 52'
                required
                className={`w-full rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors ${inputClass}`}
              />
            </div>

            <div>
              <label className={`text-xs font-semibold uppercase tracking-wide mb-1.5 block ${labelClass}`}>
                Region
              </label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className={`w-full rounded-xl px-4 py-2.5 text-sm border outline-none cursor-pointer ${selectClass}`}
              >
                {REGIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {state === 'error' && (
              <div className='rounded-xl px-4 py-3 bg-red-500/20 border border-red-500/30 text-red-400 text-sm'>
                {error}
              </div>
            )}

            <button
              type='submit'
              disabled={state === 'loading' || !name.trim() || !realm.trim()}
              className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors mt-1 ${
                state === 'loading' || !name.trim() || !realm.trim()
                  ? 'bg-gray-500 cursor-not-allowed text-white'
                  : isDark ? 'bg-accent-dark text-gray-900 hover:opacity-90' : 'bg-accent-light text-white hover:opacity-90'
              }`}
            >
              {state === 'loading' ? (
                <span className='flex items-center justify-center gap-2'>
                  <span className='inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin' />
                  Loading character...
                </span>
              ) : 'Look Up Character'}
            </button>
          </form>
        </div>

        {/* Recents */}
        {recents.length > 0 && (
          <div className='mt-6'>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
              Recent
            </p>
            <div className='flex flex-col gap-1.5'>
              {recents.map(r => (
                <button
                  key={`${r.name}-${r.realm}-${r.region}`}
                  onClick={() => handleRecentClick(r)}
                  disabled={state === 'loading'}
                  className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-sm text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                    isDark
                      ? 'bg-white/5 hover:bg-white/10 text-white/80'
                      : 'bg-black/5 hover:bg-black/10 text-gray-700'
                  }`}
                >
                  <span className='flex items-center gap-2 min-w-0'>
                    <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' />
                    </svg>
                    <span className='truncate font-medium'>{r.name}</span>
                    <span className={`shrink-0 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>·</span>
                    <span className={`truncate ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{r.realm}</span>
                    <span className={`shrink-0 text-xs uppercase ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{r.region}</span>
                  </span>
                  <span
                    role='button'
                    onClick={e => handleRecentRemove(e, r)}
                    className={`ml-3 shrink-0 p-0.5 rounded transition-colors ${isDark ? 'text-white/20 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'}`}
                    title='Remove from recents'
                  >
                    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='currentColor' className='w-3.5 h-3.5'>
                      <path d='M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z' />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className={`text-center text-xs mt-6 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
          Character data from Blizzard API · M+ scores from Raider.IO
        </p>
      </div>
    </div>
  )
}

export default WoWAdvisor
