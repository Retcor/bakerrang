import React, { useState } from 'react'
import { InputWrapper, LoadingSpinner, ConfirmModal } from './index.js'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { useAppContext } from '../providers/AppProvider.jsx'

const VoiceRow = ({ voice }) => {
  const [name, setName] = useState(voice.name)
  const [description, setDescription] = useState(voice.description)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { voices, setVoices } = useAppContext()
  const { isDark } = useTheme()

  const handleMarkAsPrimary = () => {
    setVoices(voices.map(v => {
      if (v.id === voice.id) {
        return { ...v, isPrimary: true }
      } else {
        return { ...v, isPrimary: false }
      }
    }))
  }

  const handleVoiceDelete = async id => {
    setDeleteLoading(true)
    setConfirmOpen(false)
    await request(`${SERVER_PREFIX}/text/to/speech/v1/voice/${id}`, 'DELETE')
    setVoices(voices.filter(v => v.id !== voice.id))
    setDeleteLoading(false)
  }

  return (
    <div className='md:flex md:items-center md:mb-4'>
      <ConfirmModal
        open={confirmOpen}
        title='Confirmation'
        message='Are you sure you want to delete this voice record?'
        confirmFunc={() => handleVoiceDelete(voice.id)}
        cancelFunc={() => setConfirmOpen(false)}
      />
      <div className='md:mr-4 mb-4 md:mb-0'>
        <InputWrapper value={name} setValue={setName} label='Name' />
      </div>
      <div className='md:mr-4 mb-4 md:mb-0'>
        <InputWrapper value={description} setValue={setDescription} label='Description' />
      </div>
      <div className='mr-4 mb-4 md:mb-0'>
        <div className="flex flex-col items-center space-y-1">
          <span className={`text-xs font-medium ${isDark ? 'text-brand-dark' : 'text-brand-light'}`}>Primary</span>
          <div
            className={`p-1 cursor-pointer rounded-md w-6 h-6 transition-all duration-200 ${
              voice.isPrimary
                ? isDark
                  ? 'bg-accent-dark'
                  : 'bg-accent-light'
                : isDark
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-gray-200 hover:bg-gray-300'
            }`}
            onClick={handleMarkAsPrimary}
          >
            {voice.isPrimary ? (
              <svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' stroke='currentColor' className={`w-4 h-4 ${isDark ? 'text-gray-900' : 'text-white'} stroke-2`}>
                <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
              </svg>
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>
      <div className='md:mr-4 mb-4 md:mb-0 flex justify-end'>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={deleteLoading}
          className="px-4 py-2 font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl"
        >
          {deleteLoading ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Delete'}
        </button>
      </div>
    </div>
  )
}

export default VoiceRow
