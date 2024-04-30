import React, { useState } from 'react'
import { blobToBase64 } from '../utils/index.js'

const AudioRecorder = ({ className, setAudioBlob, setAudioURL, setAudioBase64 }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [audioStream, setAudioStream] = useState(null)

  const startRecording = () => {
    // Check for MediaRecorder support
    if (!window.MediaRecorder) {
      alert('MediaRecorder not supported on this browser')
      return
    }

    // Request access to the microphone
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const recorder = new MediaRecorder(stream)
        setMediaRecorder(recorder)

        let audioChunks = []

        recorder.ondataavailable = e => {
          audioChunks.push(e.data)
        }

        recorder.onstop = async e => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
          const audioUrl = URL.createObjectURL(audioBlob)
          const base64 = await blobToBase64(audioBlob)
          if (setAudioURL) {
            setAudioURL(audioUrl)
          }
          if (setAudioBlob) {
            setAudioBlob(audioBlob)
          }
          if (setAudioBase64) {
            setAudioBase64(base64)
          }
          audioChunks = [] // Reset chunks
        }
        setIsRecording(true)
        recorder.start()
      })
      .catch(e => console.error('Error accessing media devices.', e))
  }

  const stopRecording = () => {
    if (!mediaRecorder) return
    mediaRecorder.stop()
    setIsRecording(false)
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop()) // Stop each track to release user's mic
      setAudioStream(null) // Clear the stored stream
    }
  }

  return (
    <div className={className}>
      {!isRecording
        ? (
          <button onClick={startRecording} className='pt-4 bg-gray-700 rounded-full hover:text-blue-500'>
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='bg-gray-700 w-6 h-6'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z' />
            </svg>
          </button>
          )
        : (
          <button onClick={stopRecording} className='pt-4 rounded-full bg-gray-700'>
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6 text-red-500 animate-pulse'>
              <path d='M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z' />
              <path d='M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z' />
            </svg>
          </button>
          )}
    </div>
  )
}

export default AudioRecorder
