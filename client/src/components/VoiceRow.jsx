import React, { useState } from 'react'
import { Button } from '@material-tailwind/react'
import { InputWrapper, LoadingSpinner, ConfirmModal } from './index.js'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'
import { useAppContext } from '../providers/AppProvider.jsx'

const VoiceRow = ({ voice }) => {
  const [name, setName] = useState(voice.name)
  const [description, setDescription] = useState(voice.description)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { voices, setVoices } = useAppContext()

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
      <div className='mr-4 mb-4 md:mb-0 relative'>
        <span className='absolute left-12 md:-left-1 text-[#D4ED31] text-xs top-3 md:-top-2'>Primary</span>
        <div className='p-2 cursor-pointer bg-gray-700 rounded-[7px] w-10 h-10' onClick={handleMarkAsPrimary}>
          <svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' stroke='currentColor' className={`w-6 h-6 ${voice.isPrimary ? 'text-green-500' : 'text-gray-700'}`}>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
          </svg>
        </div>
      </div>
      <div className='md:mr-4 mb-4 md:mb-0 flex justify-end'>
        <Button onClick={() => setConfirmOpen(true)} disabled={deleteLoading} className='text-white font-bold bg-red-500 hover:bg-red-700'>
          {deleteLoading ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Delete'}
        </Button>
      </div>
    </div>
  )
}

export default VoiceRow
