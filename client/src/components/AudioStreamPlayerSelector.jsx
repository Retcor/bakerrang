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
      handleClose()
    }
    document.addEventListener('mousedown', handleClickOutsidePlayModal)

    return () => {
      document.removeEventListener('mousedown', handleClickOutsidePlayModal)
    }
  }, [])

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
    let left = null

    // We need to calculate the width from the button to the edge of the screen
    // if it's less than the modal width, then we know the modal will appear outside the screen
    const buttonToScreenEdgeWidth = viewportWidth - buttonRect.right
    if (modalWidth > buttonToScreenEdgeWidth) {
      left = buttonRect.width - modalWidth
    }

    return { left }
  }

  const handlePlayButton = (event) => {
    setAnchorEl(event.currentTarget)
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
    <div>
      <AudioStreamPlayer audioSrc={audioSrc} handleAudioEnded={handleAudioEnded} controlTrigger={controlTrigger} />

      {isPlaying
        ? (
          <button className='mr-2 focus:outline-none transition-all duration-200' onClick={handlePause}>
            <svg
              className={`w-6 h-6 fill-current transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:text-blue-400' : 'text-theme-secondary-light hover:text-blue-500'}`}
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path d='M14 19h4V5h-4v14zm-6 0h4V5h-4v14z' />
            </svg>
          </button>
          )
        : isVoiceLoading
          ? <LoadingSpinner className='mr-2' />
          : (
            <button className='mr-2 focus:outline-none transition-all duration-200' onClick={handlePlayButton}>
              <svg
                className={`w-6 h-6 fill-current transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:text-blue-400' : 'text-theme-secondary-light hover:text-blue-500'}`}
                viewBox='0 0 24 24'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path d='M8 5v14l11-7z' />
              </svg>
            </button>
            )}
      {open && (
        <div style={calculateModalPosition(anchorEl)} ref={playModalRef} className='absolute z-50'>
          <div className={`shadow-lg py-2 rounded w-48 font-bold transition-all duration-200 ${isDark ? 'glass-dropdown-dark' : 'glass-dropdown-light'}`}>
            <ul>
              {voices.map((voice) => (
                <li
                  key={voice.id}
                  className={`cursor-pointer px-4 py-2 transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-black/20'}`}
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
