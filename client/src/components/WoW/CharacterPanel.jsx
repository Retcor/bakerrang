import React from 'react'
import { useTheme } from '../../providers/ThemeProvider.jsx'

const CLASS_COLORS = {
  'Warrior': '#C69B3A',
  'Paladin': '#F48CBA',
  'Hunter': '#AAD372',
  'Rogue': '#FFF468',
  'Priest': '#FFFFFF',
  'Death Knight': '#C41E3A',
  'Shaman': '#0070DD',
  'Mage': '#3FC7EB',
  'Warlock': '#8788EE',
  'Monk': '#00FF98',
  'Druid': '#FF7C0A',
  'Demon Hunter': '#A330C9',
  'Evoker': '#33937F'
}

function getMPlusColor(score) {
  if (score >= 3000) return '#ff8c00'
  if (score >= 2500) return '#a335ee'
  if (score >= 2000) return '#0070dd'
  if (score >= 1000) return '#1eff00'
  return '#9d9d9d'
}

function getIlvlColor(ilvl, avg) {
  if (ilvl <= 0) return '#4b5563'
  if (ilvl >= avg + 10) return '#1eff00'
  if (ilvl < avg - 10) return '#ff4040'
  return '#ffffff'
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CharacterPanel = ({ character, onReset }) => {
  const { isDark } = useTheme()
  const classColor = CLASS_COLORS[character.class] || '#ffffff'

  const cardClass = isDark
    ? 'glass-card-dark text-white'
    : 'glass-card-light text-gray-900'

  return (
    <div className={`rounded-2xl p-5 ${cardClass} flex flex-col gap-5`}>
      {/* Header */}
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-bold leading-tight' style={{ color: classColor }}>
            {character.name}
          </h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            {character.realm} — {character.region} · Level {character.level}
          </p>
          <p className='text-sm font-medium mt-1' style={{ color: classColor }}>
            {character.race} {character.class} · {character.spec}
          </p>
        </div>
        <button
          onClick={onReset}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white/70' : 'bg-black/10 hover:bg-black/20 text-gray-600'}`}
        >
          Change
        </button>
      </div>

      {/* Key Stats */}
      <div className='grid grid-cols-2 gap-3'>
        <div className={`rounded-xl p-3 ${isDark ? 'bg-black/20' : 'bg-white/50'}`}>
          <p className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Item Level</p>
          <p className={`text-2xl font-bold ${isDark ? 'text-brand-dark' : 'text-brand-light'}`}>{character.equippedIlvl}</p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>avg {character.avgIlvl}</p>
        </div>
        <div className={`rounded-xl p-3 ${isDark ? 'bg-black/20' : 'bg-white/50'}`}>
          <p className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>M+ Score</p>
          <p className='text-2xl font-bold' style={{ color: getMPlusColor(character.mPlusScore) }}>
            {character.mPlusScore || '—'}
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>current season</p>
        </div>
      </div>

      {/* Raid Progress */}
      {character.raidProgress && character.raidProgress.length > 0 && (
        <div>
          <p className={`text-xs uppercase tracking-wide mb-2 font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Raid Progress</p>
          <div className='flex flex-col gap-1'>
            {character.raidProgress.slice(0, 3).map((r, i) => (
              <div key={i} className='flex justify-between items-center'>
                <span className={`text-xs truncate ${isDark ? 'text-white/70' : 'text-gray-600'}`}>{r.raid.replace(/-/g, ' ')}</span>
                <span className={`text-xs font-medium ml-2 shrink-0 ${isDark ? 'text-white/90' : 'text-gray-800'}`}>{r.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gear Slots */}
      {character.slots && character.slots.length > 0 && (
        <div>
          <p className={`text-xs uppercase tracking-wide mb-2 font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Gear Breakdown</p>
          <div className='grid grid-cols-2 gap-x-4 gap-y-0.5'>
            {character.slots.map((slot, i) => (
              <div key={i} className='flex justify-between items-center py-0.5'>
                <span className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{slot.label}</span>
                <span
                  className='text-xs font-semibold tabular-nums'
                  style={{ color: getIlvlColor(slot.ilvl, character.equippedIlvl) }}
                >
                  {slot.ilvl || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent M+ Runs */}
      {character.recentRuns && character.recentRuns.length > 0 && (
        <div>
          <p className={`text-xs uppercase tracking-wide mb-2 font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Recent M+ Runs</p>
          <div className='flex flex-col gap-1'>
            {character.recentRuns.map((run, i) => (
              <div key={i} className='flex justify-between items-center'>
                <span className={`text-xs truncate ${isDark ? 'text-white/70' : 'text-gray-600'}`}>{run.dungeon}</span>
                <span className={`text-xs font-bold shrink-0 ml-2`} style={{ color: '#3FC7EB' }}>+{run.keystoneLevel}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CharacterPanel
