import React, { useEffect, useRef, useState } from 'react'
import { SERVER_PREFIX } from '../App.jsx'
import { useAppContext } from '../providers/AppProvider.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'
import AudioStreamPlayer from './AudioStreamPlayer.jsx'

// Split text into sentence-grouped chunks so each generates quickly
const chunkText = (text, maxLen = 220) => {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text]
  const chunks = []
  let current = ''
  for (const s of sentences) {
    if (current && (current + s).length > maxLen) {
      chunks.push(current.trim())
      current = s
    } else {
      current += s
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(c => c.length > 0)
}

const AudioStreamPlayerSelector = ({ prompt }) => {
  const { isDark } = useTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [anchorEl, setAnchorEl] = useState(null)
  const [audioSrc, setAudioSrc] = useState(null)
  const [controlTrigger, setControlTrigger] = useState(null)
  const [chunkQueue, setChunkQueue] = useState([])
  const [currentChunkIdx, setCurrentChunkIdx] = useState(0)
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

  const handleAudioEnded = () => {
    const nextIdx = currentChunkIdx + 1
    if (nextIdx < chunkQueue.length) {
      setCurrentChunkIdx(nextIdx)
      setAudioSrc(chunkQueue[nextIdx])
      // controlTrigger stays 'PLAY' — AudioStreamPlayer fires on audioSrc change
    } else {
      setControlTrigger(null)
      setIsPlaying(false)
      setChunkQueue([])
      setCurrentChunkIdx(0)
    }
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

  const handleVoiceSelect = (voice) => {
    handleClose()

    const chunks = chunkText(prompt)
    const urls = chunks.map(chunk =>
      `${SERVER_PREFIX}/text/to/speech/v1/convert/${voice}?prompt=${encodeURIComponent(chunk)}`
    )

    setChunkQueue(urls)
    setCurrentChunkIdx(0)
    setAudioSrc(urls[0])
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
