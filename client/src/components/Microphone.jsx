import React, { useState } from 'react'
import { debounce } from '../utils/index.js'
import { LoadingSpinner } from './index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'

const Microphone = ({ className, buttonClassName, setSpeechToText, lang, isLoading }) => {
  const { isDark } = useTheme()
  const [isRecording, setIsRecording] = useState(false)
  const recognition = new window.webkitSpeechRecognition()

  recognition.interimResults = true
  recognition.lang = lang

  recognition.onresult = debounce((event) => {
    const result = event.results[event.results.length - 1]
    if (result.isFinal) {
      setSpeechToText(result[0].transcript)
    }
  }, 300)

  recognition.onend = () => {
    setIsRecording(false)
  }

  const handleStart = () => {
    setIsRecording(true)
    recognition.start()
  }

  const handleStop = () => {
    recognition.abort()
  }

  return !isRecording
    ? (
      <button onClick={handleStart} className={`rounded-full w-8 h-8 flex items-center justify-center p-0 transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20 hover:text-blue-400' : 'glass-light text-theme-light hover:bg-black/20 hover:text-blue-500'} ${buttonClassName}`}>
        {isLoading
          ? <LoadingSpinner className='flex justify-center items-center' svgClassName='!h-3/5 !w-3/5' />
          : <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-3/5 h-3/5 self-center'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z' />
          </svg>}
      </button>
      )
    : (
      <button onClick={handleStop} className={`rounded-full w-8 h-8 flex items-center justify-center p-0 transition-all duration-200 ${isDark ? 'glass-dark' : 'glass-light'} ${buttonClassName}`}>
        {isLoading
          ? <LoadingSpinner className='flex justify-center items-center' svgClassName='!h-3/5 !w-3/5' />
          : <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-3/5 h-3/5 self-center text-red-500 animate-pulse'>
            <path d='M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z' />
            <path d='M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z' />
          </svg>}
      </button>
      )
}

export default Microphone
