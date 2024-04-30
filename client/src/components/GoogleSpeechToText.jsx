import React, { useEffect, useState } from 'react'
import AudioRecorder from './AudioRecorder.jsx'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'

const GoogleSpeechToText = ({ className, setSpeechToText, lang }) => {
  const [audioBase64, setAudioBase64] = useState()

  useEffect(() => {
    if (audioBase64) {
      sendAudioToBackend(audioBase64)
    }
  }, [audioBase64])

  const sendAudioToBackend = async (audioBase64) => {
    const response = await request(
      `${SERVER_PREFIX}/text/to/speech/google/transcribe`,
      'POST',
      {
        'Content-Type': 'application/json'
      },
      JSON.stringify({ audio: audioBase64.split(',')[1], lang })
    )
    const data = await response.json()
    setSpeechToText(data.transcription)
    console.log('Transcription:', data.transcription)
  }

  return (
    <AudioRecorder setAudioBase64={setAudioBase64} className={className} />
  )
}

export default GoogleSpeechToText
