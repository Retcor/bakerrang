import { useCallback, useEffect, useRef, useState } from 'react'

const stopTracks = (stream) => stream?.getTracks?.().forEach((track) => track.stop())

export const useRecorder = ({ onCapture, onFailure, maxMs = 60000 }) => {
  const mediaRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const capRef = useRef(null)
  const tickRef = useRef(null)
  const saveRef = useRef(false)
  const generationRef = useRef(0)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)

  const release = useCallback(() => {
    clearTimeout(capRef.current)
    clearInterval(tickRef.current)
    capRef.current = null
    tickRef.current = null
    stopTracks(streamRef.current)
    streamRef.current = null
    setRecording(false)
  }, [])

  const finish = useCallback((save = false) => {
    generationRef.current += 1
    const recorder = mediaRef.current
    saveRef.current = save
    release()
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else {
      mediaRef.current = null
      chunksRef.current = []
    }
  }, [release])

  const cancel = useCallback(() => finish(false), [finish])
  const stop = useCallback(() => finish(true), [finish])

  const start = useCallback(async () => {
    if (!globalThis.navigator?.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      const error = Object.assign(new Error('Microphone unavailable'), { code: 'UNAVAILABLE' })
      onFailure?.(error)
      throw error
    }
    try {
      const generation = ++generationRef.current
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (generation !== generationRef.current) {
        stopTracks(stream)
        return false
      }
      const recorder = new MediaRecorder(stream)
      streamRef.current = stream
      mediaRef.current = recorder
      chunksRef.current = []
      saveRef.current = false
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const chunks = chunksRef.current
        const save = saveRef.current
        const mimeType = recorder.mimeType
        chunksRef.current = []
        mediaRef.current = null
        if (save && chunks.length) onCapture?.(new Blob(chunks, { type: mimeType }), mimeType)
      }
      recorder.start()
      setSeconds(0)
      setRecording(true)
      tickRef.current = setInterval(() => setSeconds((value) => value + 1), 1000)
      capRef.current = setTimeout(() => finish(true), maxMs)
      return true
    } catch (error) {
      release()
      chunksRef.current = []
      mediaRef.current = null
      onFailure?.(error)
      throw error
    }
  }, [finish, maxMs, onCapture, onFailure, release])

  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') cancel() }
    const pagehide = () => cancel()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', pagehide)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', pagehide)
      cancel()
    }
  }, [cancel])

  return { recording, seconds, start, stop, cancel }
}

export { stopTracks }
