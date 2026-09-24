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
  const chunks = chunkText(text)

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute?.('src')
      audio.src = ''
      audio.load?.()
    }
    audioRef.current = null
    setPlaying(false)
    setChunkIndex(-1)
  }, [])

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

  const playChunk = useCallback((index, selectedVoice) => {
    if (!chunks[index]) {
      stop()
      return
    }
    const audio = audioFactory()
    audioRef.current = audio
    setChunkIndex(index)
    setPlaying(true)
    setError(null)
    audio.src = api.narrationUrl(selectedVoice, chunks[index])
    audio.onended = () => playChunk(index + 1, selectedVoice)
    audio.onerror = () => {
      stop()
      setError(new Error('Could not read this page aloud'))
    }
    Promise.resolve(audio.play()).catch((nextError) => {
      stop()
      setError(nextError)
    })
  }, [api, audioFactory, chunks, stop])

  const start = useCallback((selectedVoice = voiceId) => {
    if (!selectedVoice) return
    try { storage.setItem('sb.voice', selectedVoice) } catch {}
    setVoiceId(selectedVoice)
    stop()
    playChunk(0, selectedVoice)
  }, [playChunk, stop, storage, voiceId])

  useEffect(() => {
    stop()
  }, [page, storyId, stop])

  useEffect(() => stop, [stop])

  return { voices, voicesStatus, voiceId, playing, chunkIndex, chunks, error, loadVoices, start, stop }
}
