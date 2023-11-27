import React, { useState } from 'react'
import { Button } from '@material-tailwind/react'
import { InputWrapper, LoadingSpinner, ConfirmModal } from './index.js'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'
import { useAppContext } from '../providers/AppProvider.jsx'

const VoiceRow = ({ voice }) => {
  const [name, setName] = useState(voice.name)
  const [description, setDescription] = useState(voice.description)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { voices, setVoices } = useAppContext()

  const handleVoiceUpdate = async id => {
    setUpdateLoading(true)
    const formData = new FormData()
    formData.append('name', name)
    formData.append('description', description)
    formData.append('id', id)

    await request(`${SERVER_PREFIX}/text/to/speech/v1/voice`, 'POST', null, formData)
    setVoices(voices.map(v => {
      if (v.id === voice.id) {
        return { ...v, name, description }
      } else {
        return v
      }
    }))
    setUpdateLoading(false)
  }

  const handleVoiceDelete = async id => {
    setDeleteLoading(true)
    setConfirmOpen(false)
    await request(`${SERVER_PREFIX}/text/to/speech/v1/voice/${id}`, 'DELETE')
    setVoices(voices.filter(v => v.id !== voice.id))
    setDeleteLoading(false)
  }

  return (
    <div className='md:flex md:mb-4'>
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
      <div className='md:mr-4 mb-4 md:mb-0 flex justify-end'>
        <Button onClick={() => handleVoiceUpdate(voice.id)} disabled={updateLoading} className='mr-2 text-white font-bold bg-blue-500 hover:bg-blue-700'>{updateLoading ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Update'}</Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={deleteLoading} className='text-white font-bold bg-red-500 hover:bg-red-700'>{deleteLoading ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Delete'}</Button>
      </div>
    </div>
  )
}

export default VoiceRow
