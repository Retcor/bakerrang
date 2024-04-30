import React, { useEffect, useRef } from 'react'

const AudioStreamPlayer = ({ audioSrc, handleAudioEnded, controlTrigger }) => {
  const audioRef = useRef(null)

  useEffect(() => {
    // setup audio play button element
    const audioElement = audioRef.current

    const audioEnded = () => {
      if (handleAudioEnded) {
        handleAudioEnded()
      }
    }

    audioElement.addEventListener('ended', audioEnded)

    return () => {
      audioElement.removeEventListener('ended', audioEnded)
    }
  }, [])

  useEffect(() => {
    if (controlTrigger && audioSrc) {
      const audioElement = audioRef.current

      if (controlTrigger === 'PLAY') {
        audioElement.src = audioSrc
        audioElement.play()
      } else if (controlTrigger === 'RESUME') {
        audioElement.play()
      } else if (controlTrigger === 'PAUSE') {
        audioElement.pause()
      } else if (controlTrigger === 'STOP') {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }, [controlTrigger, audioSrc])

  return (
    <audio ref={audioRef} />
  )
}

export default AudioStreamPlayer
