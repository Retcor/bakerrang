import React, { useEffect, useRef, useState } from 'react'
import { SERVER_PREFIX } from "../App"
import LoadingSpinner from "./icons/LoadingSpinner.jsx";

const AudioStreamPlayer = ({ prompt }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)
  const [audioMap, setAudioMap] = useState({})
  const [anchorEl, setAnchorEl] = useState(null)
  const [isVoiceLoading, setIsVoiceLoading] = useState(false)
  const [voices, setVoices] = useState([])
  const playModalRef = useRef()

  useEffect(() => {
    // setup the voice selections
    fetch(`${SERVER_PREFIX}/text/to/speech/v1/voices`)
      .then(response => response.json())
      .then(json => {
        setVoices(json);
      });
    // setup audio play button element
    const audioElement = audioRef.current

    const handleAudioEnded = () => {
      setIsPlaying(false)
    }

    const handleClickOutsidePlayModal = (e) => {
      if (playModalRef.current.contains(e.target)) {
        return
      }
      handleClose()
    }

    audioElement.addEventListener('ended', handleAudioEnded)
    document.addEventListener('mousedown', handleClickOutsidePlayModal)

    return () => {
      audioElement.removeEventListener('ended', handleAudioEnded)
      document.removeEventListener('mousedown', handleClickOutsidePlayModal)
    }
  }, [])

  const handlePlayButton = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleVoiceSelect = async (voice) => {
    const audioElement = audioRef.current
    handleClose()

    if (!audioMap || !audioMap[voice]) {
      setIsVoiceLoading(true)
      const res = await fetch(`${SERVER_PREFIX}/text/to/speech/v1/convert/${voice}?prompt=${prompt}`, {
        headers: {
          Accept: 'audio/mpeg',
        },
      })
      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: 'audio/mpeg' });
      const audioSrc = URL.createObjectURL(blob)
      setIsVoiceLoading(false)
      const newAudioMap = {...audioSrc}
      newAudioMap[voice] = audioSrc
      setAudioMap(newAudioMap)

      audioElement.src = audioSrc
      audioElement.play()
    } else {
      audioElement.src = audioMap[voice]
      audioElement.play()
    }

    setIsPlaying(true)
  }

  const handlePause = () => {
    if (isPlaying) {
      const audioElement = audioRef.current
      audioElement.pause()
      setIsPlaying(false)
    }
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const open = Boolean(anchorEl)

  return (
    <div>
      <audio ref={audioRef} />

      {isPlaying ? (
        <button className="mr-2 focus:outline-none" onClick={handlePause}>
          <svg
            className="w-6 h-6 fill-current text-gray hover:text-blue-500"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M14 19h4V5h-4v14zm-6 0h4V5h-4v14z" />
          </svg>
        </button>
      ) : isVoiceLoading ? <LoadingSpinner /> : (
        <button className="mr-2 focus:outline-none" onClick={handlePlayButton}>
          <svg
            className="w-6 h-6 fill-current text-gray hover:text-blue-500"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
      {open && (
        <div style={{top: anchorEl.clientY, left: anchorEl.clientX}} ref={playModalRef} className="absolute z-10">
          <div className="bg-gray-700 border border-gray-600 shadow-lg py-2 rounded w-48">
            <ul>
              {voices.map((voice) => (
                <li
                  key={voice.voice_id}
                  className="cursor-pointer px-4 py-2 hover:bg-gray-600"
                  onClick={() => handleVoiceSelect(voice.voice_id)}
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

export default AudioStreamPlayer
