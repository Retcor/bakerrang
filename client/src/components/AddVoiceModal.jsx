import React, { useState } from 'react'
import { DropzoneWrapper, InputWrapper, LoadingSpinner } from './index.js'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'
import { Alert } from '@material-tailwind/react'

const AddVoiceModal = ({ open, success, cancel }) => {
  const [files, setFiles] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    const formData = new FormData()
    formData.append('name', name)
    formData.append('description', description)

    files.forEach((file, index) => {
      formData.append('files', file, file.name)
    })

    const saveRes = await request(`${SERVER_PREFIX}/text/to/speech/v1/voice`, 'POST', null, formData)
    const voice = await saveRes.json()
    setIsSaving(false)
    success(voice)
  }

  return (
    <>
      {open && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <div className='fixed inset-0 bg-black opacity-50' />
          <div className='bg-gray-800 w-96 p-6 rounded-lg shadow-lg relative z-10'>
            <h2 className='text-xl text-white font-medium mb-2'>Add Voice</h2>
            <p className='text-white text-xs mb-2'>Add a name and description (optional) and up to 3 audio files containing samples of the voice desired to be cloned.</p>
            <Alert
              icon={(
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={2}
                  stroke='currentColor'
                  className='h-6 w-6'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z'
                  />
                </svg>
              )} className='text-xs mr-0 mb-2'
            >Sample quality is more important than quantity. Providing more than 5 minutes of audio in total brings little improvement.
            </Alert>
            <InputWrapper value={name} setValue={setName} label='Name' className='mb-2' />
            <InputWrapper value={description} setValue={setDescription} label='Description' className='mb-2' />
            <DropzoneWrapper files={files} setFiles={setFiles} />
            <div className='flex justify-end mt-4'>
              <button className='mr-2 px-4 py-2 text-white bg-gray-500 hover:bg-gray-700 rounded' onClick={cancel}>
                Cancel
              </button>
              <button
                className='px-4 py-2 text-white bg-blue-500 hover:bg-blue-700 rounded disabled:opacity-25'
                onClick={handleSave}
                disabled={!files.length || !name.length || isSaving}
              >
                {isSaving ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default AddVoiceModal
