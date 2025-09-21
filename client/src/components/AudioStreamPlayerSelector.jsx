import React, { useEffect, useRef, useState } from 'react'
import { getTextToSpeechAudioSrc } from '../utils/index.js'
import { LoadingSpinner } from './index.js'
import { useAppContext } from '../providers/AppProvider.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'
import AudioStreamPlayer from './AudioStreamPlayer.jsx'

const AudioStreamPlayerSelector = ({ prompt }) => {
  const { isDark } = useTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioMap, setAudioMap] = useState({})
  const [anchorEl, setAnchorEl] = useState(null)
  const [audioSrc, setAudioSrc] = useState(null)
  const [isVoiceLoading, setIsVoiceLoading] = useState(false)
  const [controlTrigger, setControlTrigger] = useState(null)
  const { voices } = useAppContext()
  const playModalRef = useRef()

  useEffect(() => {
    const handleClickOutsidePlayModal = (e) => {
      if (playModalRef.current?.contains(e.target)) {
        return
      }
      // Check if the click is on the button itself - if so, let the button handle it
      if (anchorEl && anchorEl.contains(e.target)) {
        return
      }
      handleClose()
    }

    if (anchorEl) {
      document.addEventListener('mousedown', handleClickOutsidePlayModal)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutsidePlayModal)
    }
  }, [anchorEl])

  useEffect(() => {
    setAudioMap({})
  }, [prompt])

  const handleAudioEnded = () => {
    setControlTrigger(null)
    setIsPlaying(false)
  }

  const calculateModalPosition = (anchorEl) => {
    const modalWidth = 192 // w-48 width used for modal
    const viewportWidth = window.innerWidth
    const buttonRect = anchorEl.getBoundingClientRect()
    let right = null
    let left = null

    // Calculate space available on the right side
    const buttonToScreenEdgeWidth = viewportWidth - buttonRect.right

    // If there's not enough space on the right, position from the right edge
    if (modalWidth > buttonToScreenEdgeWidth) {
      right = 0 // Align to the right edge of the button
    } else {
      left = 0 // Default left alignment
    }

    return { right, left }
  }

  const handlePlayButton = (event) => {
    event.stopPropagation()
    if (anchorEl) {
      // If dropdown is already open, close it
      setAnchorEl(null)
    } else {
      // If dropdown is closed, open it
      setAnchorEl(event.currentTarget)
    }
  }

  const handleVoiceSelect = async (voice) => {
    handleClose()

    if (!audioMap || !audioMap[voice]) {
      setIsVoiceLoading(true)
      const audioSrc = await getTextToSpeechAudioSrc(prompt, voice)
      setIsVoiceLoading(false)

      const newAudioMap = { ...audioMap }
      newAudioMap[voice] = audioSrc

      setAudioMap(newAudioMap)
      setAudioSrc(audioSrc)
    } else {
      setAudioSrc(audioMap[voice])
    }

    setControlTrigger('PLAY')
    setIsPlaying(true)
  }

  const handlePause = () => {
    if (isPlaying) {
      setControlTrigger('PAUSE')
      setIsPlaying(false)
    }
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const open = Boolean(anchorEl)

  return (
    <div className="relative">
      <AudioStreamPlayer audioSrc={audioSrc} handleAudioEnded={handleAudioEnded} controlTrigger={controlTrigger} />

      {isPlaying
        ? (
          <button className={`px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20 border border-white/20' : 'glass-light text-theme-light hover:bg-black/20 border border-black/20'}`} onClick={handlePause}>
            <svg
              className='w-4 h-4 fill-current'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path d='M14 19h4V5h-4v14zm-6 0h4V5h-4v14z' />
            </svg>
            <span>Pause</span>
          </button>
          )
        : isVoiceLoading
          ? (
            <div className={`px-3 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 ${isDark ? 'glass-dark text-theme-dark border border-white/20' : 'glass-light text-theme-light border border-black/20'}`}>
              <LoadingSpinner svgClassName='!h-4 !w-4' />
              <span>Loading...</span>
            </div>
          )
          : (
            <button className={`px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20 border border-white/20' : 'glass-light text-theme-light hover:bg-black/20 border border-black/20'}`} onClick={handlePlayButton}>
              <svg
                className='w-4 h-4 fill-current'
                viewBox='0 0 24 24'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path d='M8 5v14l11-7z' />
              </svg>
              <span>Narrate</span>
              <svg className='w-4 h-4 fill-current opacity-60' viewBox='0 0 24 24'>
                <path d='M7 10l5 5 5-5z' />
              </svg>
            </button>
            )}
      {open && (
        <div ref={playModalRef} className='absolute right-0 top-full mt-2 z-50'>
          <div className={`shadow-xl py-2 rounded-xl w-48 font-medium transition-all duration-200 ${isDark ? 'glass-dropdown-dark' : 'glass-dropdown-light'}`}>
            <ul className="space-y-1 px-2">
              {voices.map((voice) => (
                <li
                  key={voice.id}
                  className={`cursor-pointer px-4 py-2 rounded-lg transition-all duration-200 text-sm w-full text-left ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-black/20'}`}
                  onClick={() => handleVoiceSelect(voice.id)}
                >
                  {voice.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default AudioStreamPlayerSelector
