import React, { useEffect, useState } from 'react'
import { DropzoneWrapper, InputWrapper, LoadingSpinner } from './index.js'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'
import AudioRecorder from './AudioRecorder.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'

const AddVoiceModal = ({ open, success, cancel }) => {
  const { isDark } = useTheme()
  const [files, setFiles] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [recording, setRecording] = useState(null)

  useEffect(() => {
    if (open) {
      // Disable background scrolling with more specific properties
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.height = '100%'
    } else {
      // Re-enable background scrolling
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.height = ''
    }

    // Cleanup function to restore scrolling
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.height = ''
    }
  }, [open])

  useEffect(() => {
    if (audioBlob) {
      const audioFile = new File([audioBlob], 'recording.mp3', { type: 'audio/mp3' })
      setRecording(audioFile)
      setFiles([])
    }
  }, [audioBlob])

  useEffect(() => {
    if (files.length > 0) {
      clearRecording()
    }
  }, [files])

  const handleSave = async () => {
    setIsSaving(true)
    const formData = new FormData()
    formData.append('name', name)
    formData.append('description', description)

    files.forEach((file, index) => {
      formData.append('files', file, file.name)
    })

    if (recording) {
      formData.append('files', recording, recording.name)
    }

    const saveRes = await request(`${SERVER_PREFIX}/text/to/speech/v1/voice`, 'POST', null, formData)
    const voice = await saveRes.json()
    setIsSaving(false)
    success(voice)
  }

  const clearRecording = () => {
    setAudioUrl(null)
    setAudioBlob(null)
    setRecording(null)
  }

  return (
    <>
      {open && (
        <div className='fixed inset-0 z-50 flex justify-center items-start pt-[15vh] p-4' style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}>
          <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' />
          <div className={`w-full max-w-lg p-6 rounded-xl shadow-2xl relative z-10 transition-all duration-300 max-h-[90vh] overflow-y-auto ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'}`}>
            <h2 className={`text-xl font-medium mb-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Add Voice</h2>
            <p className={`text-xs mb-2 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Add a name and description (optional) and up to 3 audio files containing samples of the voice desired to be cloned.</p>
            <div className={`flex items-center p-3 mb-2 rounded-lg transition-all duration-200 ${isDark ? 'glass-dark border border-blue-400/30' : 'glass-light border border-blue-500/30'}`}>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={2}
                stroke='currentColor'
                className={`h-5 w-5 mr-2 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-500'}`}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z'
                />
              </svg>
              <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Sample quality is more important than quantity. Providing more than 5 minutes of audio in total brings little improvement.</span>
            </div>
            <InputWrapper value={name} setValue={setName} label='Name' className='mb-2' />
            <InputWrapper value={description} setValue={setDescription} label='Description' className='mb-2' />
            <DropzoneWrapper files={files} setFiles={setFiles} />
            <span className={`text-sm flex justify-center mt-5 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Or record here</span>
            <AudioRecorder className='flex justify-center mt-3' setAudioURL={setAudioUrl} setAudioBlob={setAudioBlob} />
            {audioUrl && (
              <div className='flex justify-center items-center w-full h-6 mt-4'>
                <audio controls src={audioUrl} className='h-6'>
                  Your browser does not support the audio element.
                </audio>
                <button onClick={clearRecording} className='ml-4 text-red-500 hover:text-red-400'>
                  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='w-6 h-6'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M6 6l12 12m0-12L6 18' />
                  </svg>
                </button>
              </div>
            )}
            <div className='flex justify-end mt-4'>
              <button className={`mr-2 px-4 py-2 rounded transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`} onClick={cancel}>
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded transition-all duration-200 disabled:opacity-25 ${isDark ? 'glass-dark text-blue-400 hover:bg-blue-400/20' : 'glass-light text-blue-500 hover:bg-blue-500/20'}`}
                onClick={handleSave}
                disabled={(!files.length && !recording) || !name.length || isSaving}
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
