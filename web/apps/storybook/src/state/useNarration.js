import { useCallback, useEffect, useRef, useState } from 'react'
import { chunkText } from '../text.js'

const readVoice = (storage) => {
  try { return storage.getItem('sb.voice') } catch { return null }
}

export const useNarration = ({ api, storyId, page, text, audioFactory = () => new Audio(), storage = globalThis.localStorage }) => {
  const [voices, setVoices] = useState(null)
  const [voicesStatus, setVoicesStatus] = useState('idle')
  const [voiceId, setVoiceId] = useState(() => readVoice(storage))
  const [playing, setPlaying] = useState(false)
  const [chunkIndex, setChunkIndex] = useState(-1)
  const [error, setError] = useState(null)
  const audioRef = useRef(null)
  const playbackRef = useRef(0)
  const chunks = chunkText(text)

  const cancel = useCallback((updateState) => {
    playbackRef.current += 1
    const audio = audioRef.current
    audioRef.current = null
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
      audio.removeAttribute?.('src')
      audio.src = ''
      audio.load?.()
    }
    if (updateState) {
      setPlaying(false)
      setChunkIndex(-1)
      setError(null)
    }
  }, [])

  const stop = useCallback(() => cancel(true), [cancel])

  const loadVoices = useCallback(async () => {
    if (voicesStatus === 'ready') return voices
    setVoicesStatus('loading')
    try {
      const loaded = await api.listVoices()
      setVoices(loaded)
      const preferred = loaded.find((voice) => voice.id === readVoice(storage)) || loaded.find((voice) => voice.isPrimary) || loaded[0]
      if (preferred) setVoiceId(preferred.id)
      setVoicesStatus('ready')
      return loaded
    } catch (nextError) {
      setError(nextError)
      setVoicesStatus('error')
      return null
    }
  }, [api, storage, voices, voicesStatus])

  const playChunk = useCallback(async (index, selectedVoice, playback) => {
    if (playback !== playbackRef.current) return
    if (!chunks[index]) {
      stop()
      return
    }
    let source
    try {
      source = await api.narrationUrl(selectedVoice, chunks[index])
    } catch (nextError) {
      if (playback !== playbackRef.current) return
      stop()
      setError(nextError)
      return
    }
    if (playback !== playbackRef.current) return
    const audio = audioFactory()
    audioRef.current = audio
    setChunkIndex(index)
    setPlaying(true)
    setError(null)
    audio.src = source
    audio.onended = () => {
      if (playback !== playbackRef.current || audioRef.current !== audio) return
      playChunk(index + 1, selectedVoice, playback).catch(() => {})
    }
    audio.onerror = () => {
      if (playback !== playbackRef.current || audioRef.current !== audio) return
      stop()
      setError(new Error('Could not read this page aloud'))
    }
    Promise.resolve(audio.play()).catch((nextError) => {
      if (playback !== playbackRef.current || audioRef.current !== audio) return
      stop()
      setError(nextError)
    })
  }, [api, audioFactory, chunks, stop])

  const start = useCallback((selectedVoice = voiceId) => {
    if (!selectedVoice) return
    try { storage.setItem('sb.voice', selectedVoice) } catch {}
    setVoiceId(selectedVoice)
    stop()
    playChunk(0, selectedVoice, playbackRef.current).catch(() => {})
  }, [playChunk, stop, storage, voiceId])

  useEffect(() => {
    stop()
  }, [page, storyId, stop])

  useEffect(() => () => cancel(false), [cancel])

  return { voices, voicesStatus, voiceId, playing, chunkIndex, chunks, error, loadVoices, start, stop }
}
