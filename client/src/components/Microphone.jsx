import React, { useState } from 'react'
import { debounce } from '../utils/index.js'
import { LoadingSpinner } from './index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'

const Microphone = ({ className, buttonClassName, setSpeechToText, lang, isLoading }) => {
  const { isDark } = useTheme()
  const [isRecording, setIsRecording] = useState(false)

  const handleMicrophoneClick = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser')
      return
    }

    if (isRecording) {
      // Stop recording
      setIsRecording(false)
    } else {
      // Start recording
      setIsRecording(true)

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()

      recognition.interimResults = true
      recognition.lang = lang || 'en-US'
      recognition.continuous = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1]
        if (result.isFinal) {
          setSpeechToText(result[0].transcript)
          setIsRecording(false)
        }
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
      }

      try {
        recognition.start()
      } catch (error) {
        console.error('Failed to start speech recognition:', error)
        setIsRecording(false)
      }
    }
  }

  return (
    <button
      onClick={handleMicrophoneClick}
      className={`rounded-full w-8 h-8 flex items-center justify-center p-0 transition-all duration-200 ${
        isRecording
          ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-lg'
          : (isDark ? 'glass-dark text-theme-dark hover:bg-white/20 hover:text-blue-400' : 'glass-light text-theme-light hover:bg-black/20 hover:text-blue-500')
      } ${buttonClassName}`}
    >
      {isLoading ? (
        <LoadingSpinner className='flex justify-center items-center' svgClassName='!h-3/5 !w-3/5' />
      ) : (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          fill='none'
          viewBox='0 0 24 24'
          strokeWidth='1.5'
          stroke='currentColor'
          className={`w-3/5 h-3/5 self-center ${isRecording ? 'text-white' : ''}`}
        >
          <path strokeLinecap='round' strokeLinejoin='round' d='M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z' />
        </svg>
      )}
    </button>
  )
}

export default Microphone
