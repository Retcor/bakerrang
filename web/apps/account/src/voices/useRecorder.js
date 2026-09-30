import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_RECORDING_MS = 5 * 60 * 1000

// Sample types the server accepts (server/multer.js), keyed by base type. Recordings and
// picked files are checked against the same allowlist before any upload starts.
export const SAMPLE_EXTENSIONS = Object.freeze({
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac'
})

export const baseAudioType = (type) => String(type || '').split(';')[0].trim().toLowerCase()
export const isSupportedSampleType = (type) => Object.hasOwn(SAMPLE_EXTENSIONS, baseAudioType(type))

// Preference order: what Chrome/Firefox and Safari can actually produce.
const RECORDER_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export const recorderSupported = () =>
  typeof window !== 'undefined' && typeof window.MediaRecorder === 'function' && Boolean(navigator.mediaDevices?.getUserMedia)

const pickRecorderType = () => RECORDER_TYPES.find((type) => window.MediaRecorder.isTypeSupported?.(type)) || ''

// In-browser recording with an honest MIME type and extension (the legacy recorder labelled
// every take audio/mp3). The microphone is released on stop, cancel, pagehide and unmount.
// `state`: idle | recording | denied.
export const useRecorder = ({ onSample }) => {
  const [state, setState] = useState('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const session = useRef(null)
  const onSampleRef = useRef(onSample)
  onSampleRef.current = onSample

  // Releases one recording session and its microphone tracks; a late `stop` event from an
  // older session can never touch a newer one.
  const release = useCallback((target) => {
    if (session.current === target) session.current = null
    window.clearInterval(target.timer)
    target.stream.getTracks().forEach((track) => track.stop())
  }, [])

  const finish = useCallback((deliver) => {
    const current = session.current
    if (!current) return
    current.deliver = deliver
    if (current.recorder.state !== 'inactive') current.recorder.stop()
    else release(current)
  }, [release])

  const stop = useCallback(() => finish(true), [finish])
  const cancel = useCallback(() => {
    finish(false)
    setState('idle')
    setElapsedMs(0)
  }, [finish])

  const start = useCallback(async () => {
    if (session.current || !recorderSupported()) return
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setState('denied')
      return
    }
    const mimeType = pickRecorderType()
    const recorder = mimeType ? new window.MediaRecorder(stream, { mimeType }) : new window.MediaRecorder(stream)
    const chunks = []
    const startedAt = Date.now()
    const current = { recorder, stream, deliver: false, timer: 0 }
    session.current = current
    recorder.addEventListener('dataavailable', (event) => { if (event.data?.size) chunks.push(event.data) })
    recorder.addEventListener('stop', () => {
      const deliver = current.deliver
      const took = Date.now() - startedAt
      release(current)
      setState('idle')
      setElapsedMs(0)
      if (!deliver || !chunks.length) return
      // The recorder's own type is the honest one; fall back to what was requested.
      const type = baseAudioType(recorder.mimeType || mimeType) || 'audio/webm'
      onSampleRef.current?.({ blob: new Blob(chunks, { type }), type, durationMs: Math.min(took, MAX_RECORDING_MS) })
    })
    current.timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      setElapsedMs(Math.min(elapsed, MAX_RECORDING_MS))
      if (elapsed >= MAX_RECORDING_MS) finish(true)
    }, 250)
    setElapsedMs(0)
    setState('recording')
    recorder.start()
  }, [finish, release])

  useEffect(() => {
    const onHide = () => finish(false)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      const current = session.current
      if (current) {
        current.deliver = false
        if (current.recorder.state !== 'inactive') current.recorder.stop()
        release(current)
      }
    }
  }, [finish, release])

  return { supported: recorderSupported(), state, elapsedMs, start, stop, cancel }
}
