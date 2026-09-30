import React, { useState } from 'react'
import { AddVoiceModal, ContentWrapper, LoadingSpinner } from './index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { useAppContext } from '../providers/AppProvider.jsx'
import VoiceRow from './VoiceRow.jsx'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'

const PASSWORDS_URL = import.meta.env.VITE_PASSWORDS_URL || 'https://passwords.bakerrang.com'

const Account = () => {
  const { isDark } = useTheme()
  const { voices, setVoices } = useAppContext()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [isVoicesUpdating, setIsVoicesUpdating] = useState(false)

  const addVoiceSuccess = voice => {
    setVoices([...voices, voice])
    setAddModalOpen(false)
  }

  const updateVoices = async () => {
    setIsVoicesUpdating(true)
    await request(`${SERVER_PREFIX}/text/to/speech/v1/voices`, 'PUT', { 'Content-Type': 'application/json' }, JSON.stringify({ voices }))
    setIsVoicesUpdating(false)
  }

  return (
    <ContentWrapper title='Account'>
      <div className='space-y-8 mt-8'>

        {/* Cloned Voices Section */}
        <section className={`rounded-2xl transition-all duration-300 overflow-hidden ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          {/* Section Header */}
          <div className={`px-8 py-6 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-4'>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
                  <svg className={`w-6 h-6 ${isDark ? 'text-gray-900' : 'text-gray-900'}`} fill='currentColor' viewBox='0 0 20 20'>
                    <path fillRule='evenodd' d='M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z' clipRule='evenodd' />
                  </svg>
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                    Cloned Voices
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                    Manage your custom voice clones for text-to-speech
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-3'>
                <button
                  onClick={() => setAddModalOpen(true)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
                >
                  Add Voice
                </button>
                <button
                  onClick={() => updateVoices()}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
                >
                  {isVoicesUpdating ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Update All'}
                </button>
              </div>
            </div>
          </div>

          {/* Voices Content */}
          <div className='p-8'>
            {voices && voices.length > 0
              ? (
                <div className='space-y-4'>
                  {voices.map(v => (
                    <div key={v.id} className={`p-4 rounded-xl transition-all duration-200 ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>
                      <VoiceRow voice={v} />
                    </div>
                  ))}
                </div>
                )
              : (
                <div className='text-center py-12'>
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                    <svg className={`w-8 h-8 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' />
                    </svg>
                  </div>
                  <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>No voices yet</h3>
                  <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                    Add your first voice clone to get started
                  </p>
                </div>
                )}
          </div>
        </section>

        {/* Vault settings moved to Passwords (Phase H). */}
        <section className={`rounded-2xl px-8 py-6 ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'}`}>
          <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
            Vault settings moved to Passwords.{' '}
            <a href={PASSWORDS_URL} className={`underline font-medium ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Open Passwords</a>
          </p>
        </section>

        <AddVoiceModal open={addModalOpen} cancel={() => setAddModalOpen(false)} success={addVoiceSuccess} />
      </div>
    </ContentWrapper>
  )
}

export default Account
