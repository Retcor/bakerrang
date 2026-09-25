import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chunkSpeech } from '../api/polyglot.js'
import { appendTurn, findTurn, nextTurnIdentity, removeTurn, updateTurn } from './turns.js'

const stopAudio = (audio) => {
  if (!audio) return
  audio.onended = null
  audio.onerror = null
  audio.pause?.()
  audio.removeAttribute?.('src')
  audio.src = ''
  audio.load?.()
}

const micError = (error) => error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'micDenied' : 'micUnavailable'

export const useTurns = ({ api, audioFactory = () => new Audio(), onSignedOut, onVoiceUnavailable }) => {
  const [turns, setTurns] = useState([])
  const [announcement, setAnnouncement] = useState('')
  const activeRef = useRef(null)
  const audioRef = useRef(null)
  const playbackSeqRef = useRef(0)
  const idCounterRef = useRef(0)
  const displaySeqRef = useRef(0)
  const turnsRef = useRef(turns)
  turnsRef.current = turns

  const patch = useCallback((id, update) => setTurns((items) => updateTurn(items, id, update)), [])
  const isCurrent = useCallback((id, signal) => activeRef.current?.id === id && !signal.aborted, [])

  const stopPlayback = useCallback((complete = true) => {
    playbackSeqRef.current += 1
    const playback = audioRef.current
    audioRef.current = null
    stopAudio(playback?.audio)
    playback?.resolve?.()
    if (complete && playback?.turnId) patch(playback.turnId, { phase: 'done' })
    if (activeRef.current?.id === playback?.turnId) activeRef.current = null
  }, [patch])

  const play = useCallback(async (turnId, voiceId, text, controller, auto = true) => {
    stopPlayback(false)
    const playback = ++playbackSeqRef.current
    try {
      for (const chunk of chunkSpeech(text)) {
        if (playback !== playbackSeqRef.current) return
        if (!isCurrent(turnId, controller.signal) && auto) return
        const url = await api.mintSpeech(voiceId, chunk, { signal: controller.signal })
        if (playback !== playbackSeqRef.current) return
        if (!isCurrent(turnId, controller.signal) && auto) return
        await new Promise((resolve, reject) => {
          const audio = audioFactory()
          audioRef.current = { audio, turnId, resolve }
          audio.src = url
          audio.onended = () => playback === playbackSeqRef.current && resolve()
          audio.onerror = () => playback === playbackSeqRef.current && reject(new Error('Speech playback failed'))
          const abort = () => { stopAudio(audio); resolve() }
          controller.signal.addEventListener('abort', abort, { once: true })
          Promise.resolve(audio.play()).catch(reject).finally(() => controller.signal.removeEventListener('abort', abort))
        })
      }
      if (auto && isCurrent(turnId, controller.signal)) {
        patch(turnId, { phase: 'done' })
        activeRef.current = null
      }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) onSignedOut?.()
      if (error.status === 403) onVoiceUnavailable?.(voiceId)
      if (auto && isCurrent(turnId, controller.signal)) {
        patch(turnId, { phase: 'done', error: error.status === 401 ? 'signedOut' : 'speakFailed' })
        activeRef.current = null
      }
      throw error
    } finally {
      audioRef.current = null
    }
  }, [api, audioFactory, isCurrent, onSignedOut, onVoiceUnavailable, patch, stopPlayback])

  const translateTurn = useCallback(async (turnId, text, controller) => {
    const turn = findTurn(turnsRef.current, turnId)
    if (!turn) return
    patch(turnId, { phase: 'translating', error: null })
    setAnnouncement(`Translating into ${turn.toName}`)
    try {
      const said = await api.translate(text, turn.from, turn.to, { signal: controller.signal })
      if (!isCurrent(turnId, controller.signal)) return
      patch(turnId, { said, phase: turn.voiceId ? 'speaking' : 'done' })
      setAnnouncement(`${turn.toName}: ${said}`)
      if (!turn.voiceId) {
        activeRef.current = null
        return
      }
      setAnnouncement(`Speaking in ${turn.voiceName}`)
      await play(turnId, turn.voiceId, said, controller, true)
    } catch (error) {
      if (controller.signal.aborted || !isCurrent(turnId, controller.signal)) return
      if (error.status === 401) {
        patch(turnId, { phase: 'done', error: 'signedOut' })
        onSignedOut?.()
      } else patch(turnId, { phase: 'translateFailed', error: error.status === 429 ? 'rateLimited' : 'translateFailed' })
      activeRef.current = null
    }
  }, [api, isCurrent, onSignedOut, patch, play])

  const begin = useCallback(({ from, to, fromName, toName, voiceId, voiceName, heard = '', phase = 'listening' }) => {
    stopPlayback(true)
    activeRef.current?.controller.abort()
    const identity = nextTurnIdentity(idCounterRef, displaySeqRef)
    const controller = new AbortController()
    const turn = { ...identity, from, to, fromName, toName, voiceId: voiceId || null, voiceName: voiceName || null, phase, heard, said: '' }
    activeRef.current = { id: turn.id, controller }
    setTurns((items) => {
      const next = appendTurn(items, turn)
      turnsRef.current = next
      return next
    })
    setAnnouncement(phase === 'listening' ? 'Listening' : `Translating into ${toName}`)
    return turn.id
  }, [stopPlayback])

  const beginTyped = useCallback((snapshot, text) => {
    const id = begin({ ...snapshot, heard: text, phase: 'translating' })
    const controller = activeRef.current.controller
    queueMicrotask(() => translateTurn(id, text, controller))
    return id
  }, [begin, translateTurn])

  const processRecording = useCallback(async (turnId, capturedBlob) => {
    const active = activeRef.current
    if (!active || active.id !== turnId) return
    let rawAudio = capturedBlob
    let heard
    patch(turnId, { phase: 'transcribing' })
    setAnnouncement('Transcribing')
    try {
      const turn = findTurn(turnsRef.current, turnId)
      heard = await api.transcribe(rawAudio, turn.from, { signal: active.controller.signal })
    } catch (error) {
      if (active.controller.signal.aborted || !isCurrent(turnId, active.controller.signal)) return
      patch(turnId, { phase: 'done', error: error.status === 401 ? 'signedOut' : 'transcribeFailed' })
      activeRef.current = null
      if (error.status === 401) onSignedOut?.()
    } finally {
      rawAudio = null
    }
    if (!isCurrent(turnId, active.controller.signal)) return
    if (!heard.trim()) {
      patch(turnId, { phase: 'done', error: 'nothingHeard' })
      activeRef.current = null
      return
    }
    patch(turnId, { heard: heard.trim() })
    await translateTurn(turnId, heard.trim(), active.controller)
  }, [api, isCurrent, onSignedOut, patch, translateTurn])

  const failMicrophone = useCallback((turnId, error) => {
    if (activeRef.current?.id !== turnId) return
    activeRef.current.controller.abort()
    activeRef.current = null
    patch(turnId, { phase: 'done', error: micError(error) })
  }, [patch])

  const retry = useCallback((id) => {
    const turn = findTurn(turnsRef.current, id)
    if (!turn?.heard) return
    activeRef.current?.controller.abort()
    const controller = new AbortController()
    activeRef.current = { id, controller }
    translateTurn(id, turn.heard, controller).catch(() => {})
  }, [translateTurn])

  const cancel = useCallback(() => {
    const id = activeRef.current?.id
    activeRef.current?.controller.abort()
    activeRef.current = null
    stopPlayback(false)
    if (id) setTurns((items) => removeTurn(items, id))
    setAnnouncement('Cancelled')
  }, [stopPlayback])

  const clear = useCallback(() => {
    activeRef.current?.controller.abort()
    activeRef.current = null
    stopPlayback(false)
    displaySeqRef.current = 0
    setTurns([])
    setAnnouncement('Conversation cleared')
  }, [stopPlayback])

  const discard = useCallback((id) => setTurns((items) => removeTurn(items, id)), [])

  const replay = useCallback(async (id, voiceId) => {
    const turn = findTurn(turnsRef.current, id)
    if (!turn?.said || !voiceId) return
    stopPlayback(false)
    const controller = new AbortController()
    try { await play(id, voiceId, turn.said, controller, false) } catch {}
  }, [play, stopPlayback])

  useEffect(() => () => {
    activeRef.current?.controller.abort()
    activeRef.current = null
    stopPlayback(false)
    setTurns([])
  }, [stopPlayback])

  const activeTurn = useMemo(() => activeRef.current ? findTurn(turns, activeRef.current.id) : null, [turns])
  return { turns, activeTurn, announcement, begin, beginTyped, processRecording, failMicrophone, retry, cancel, clear, discard, replay, stopPlayback }
}
