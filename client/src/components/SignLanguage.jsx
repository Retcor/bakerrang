import React, { useState, useEffect, useRef, useCallback } from 'react'
import { HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'
import { SERVER_PREFIX } from '../App.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'
import ContentWrapper from './ContentWrapper.jsx'

const MOVE_THRESHOLD = 0.008
const MIN_SIGNING_FRAMES = 8
const DEBOUNCE_MS = 600

const SignLanguage = () => {
  const { isDark } = useTheme()
  const isDarkRef = useRef(isDark)
  useEffect(() => { isDarkRef.current = isDark }, [isDark])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const animFrameRef = useRef(null)
  const streamRef = useRef(null)
  const prevLandmarksRef = useRef(null)
  const signingFramesRef = useRef(0)
  const lastRequestTimeRef = useRef(0)
  const isProcessingRef = useRef(false)

  const [isActive, setIsActive] = useState(false)
  const [status, setStatus] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)

  const calcVelocity = (current, prev) => {
    if (!prev || prev.length === 0) return 0
    let total = 0
    let count = 0
    for (let h = 0; h < Math.min(current.length, prev.length); h++) {
      for (let i = 0; i < current[h].length; i++) {
        const dx = current[h][i].x - (prev[h]?.[i]?.x || 0)
        const dy = current[h][i].y - (prev[h]?.[i]?.y || 0)
        total += Math.sqrt(dx * dx + dy * dy)
        count++
      }
    }
    return count > 0 ? total / count : 0
  }

  const captureAndInterpret = useCallback(async () => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setStatus('processing')

    try {
      const video = videoRef.current
      if (!video) return

      const cap = document.createElement('canvas')
      cap.width = 320
      cap.height = 240
      cap.getContext('2d').drawImage(video, 0, 0, 320, 240)
      const base64 = cap.toDataURL('image/jpeg', 0.7).split(',')[1]

      const res = await fetch(`${SERVER_PREFIX}/sign-language/interpret`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      })
      if (res.ok) {
        const { word } = await res.json()
        if (word) setTranscript(prev => prev ? prev + ' ' + word : word)
      }
    } catch (err) {
      console.error('Interpret error:', err)
    } finally {
      isProcessingRef.current = false
      setStatus('ready')
    }
  }, [])

  const startLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !handLandmarkerRef.current) return

    const ctx = canvas.getContext('2d')
    const drawingUtils = new DrawingUtils(ctx)

    const loop = () => {
      animFrameRef.current = requestAnimationFrame(loop)
      if (video.readyState < 2) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let results
      try {
        results = handLandmarkerRef.current.detectForVideo(video, performance.now())
      } catch {
        return
      }

      const dark = isDarkRef.current
      if (results.landmarks.length > 0) {
        for (const landmarks of results.landmarks) {
          drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: dark ? '#a3e635' : '#16a34a',
            lineWidth: 2
          })
          drawingUtils.drawLandmarks(landmarks, {
            color: dark ? '#fbbf24' : '#d97706',
            lineWidth: 1,
            radius: 3
          })
        }

        const velocity = calcVelocity(results.landmarks, prevLandmarksRef.current)
        prevLandmarksRef.current = results.landmarks

        if (velocity > MOVE_THRESHOLD) {
          signingFramesRef.current++
          if (signingFramesRef.current > 3) setStatus('signing')
        } else if (signingFramesRef.current >= MIN_SIGNING_FRAMES) {
          const now = Date.now()
          if (now - lastRequestTimeRef.current > DEBOUNCE_MS && !isProcessingRef.current) {
            signingFramesRef.current = 0
            lastRequestTimeRef.current = now
            captureAndInterpret()
          } else {
            signingFramesRef.current = 0
            setStatus('ready')
          }
        } else {
          signingFramesRef.current = 0
          if (!isProcessingRef.current) setStatus('ready')
        }
      } else {
        prevLandmarksRef.current = null
        signingFramesRef.current = 0
        if (!isProcessingRef.current) setStatus('ready')
      }
    }

    loop()
  }, [captureAndInterpret])

  const startCamera = useCallback(async () => {
    setError(null)
    setStatus('loading')

    try {
      if (!handLandmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2
        })
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      const video = videoRef.current
      video.srcObject = stream
      await new Promise(resolve => { video.onloadeddata = resolve })
      await video.play()

      setIsActive(true)
      setStatus('ready')
      startLoop()
    } catch (err) {
      setError(err.message || 'Could not start camera')
      setStatus('idle')
    }
  }, [startLoop])

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    prevLandmarksRef.current = null
    signingFramesRef.current = 0
    isProcessingRef.current = false
    setIsActive(false)
    setStatus('idle')
  }, [])

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const statusConfig = {
    idle: { dot: 'bg-gray-400', label: 'Camera off', cls: 'text-gray-400' },
    loading: { dot: 'bg-blue-400 animate-pulse', label: 'Loading model...', cls: 'text-blue-400' },
    ready: { dot: isDark ? 'bg-green-400' : 'bg-green-500', label: 'Ready — sign to begin', cls: isDark ? 'text-green-400' : 'text-green-600' },
    signing: { dot: 'bg-yellow-400 animate-pulse', label: 'Signing detected...', cls: isDark ? 'text-yellow-300' : 'text-yellow-600' },
    processing: { dot: isDark ? 'bg-lime-400 animate-pulse' : 'bg-lime-600 animate-pulse', label: 'Interpreting...', cls: isDark ? 'text-lime-400' : 'text-lime-600' }
  }
  const s = statusConfig[status] || statusConfig.idle

  const btnBase = 'px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2'
  const btnPrimary = `${btnBase} ${isDark ? 'bg-accent-dark text-black hover:opacity-90' : 'bg-accent-light text-black hover:opacity-90'}`
  const btnGlass = `${btnBase} ${isDark ? 'glass-card-dark border border-white/10 text-theme-dark hover:bg-white/10' : 'glass-card-light border border-black/10 text-theme-light hover:bg-black/5'}`

  return (
    <ContentWrapper title='Sign Language Interpreter'>
      {/* Hero */}
      <div className={`rounded-2xl p-8 mb-6 transition-all duration-300 ${isDark ? 'glass-card-dark border-white/10' : 'glass-card-light border-black/10'} border`}>
        <div className='flex items-center gap-4 mb-6'>
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className={`w-8 h-8 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              <path strokeLinecap='round' strokeLinejoin='round' d='M10.05 4.575a1.575 1.575 0 1 0-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 0 1 3.15 0v1.5m-3.15 0 .075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 0 1 3.15 0V15M6.9 7.575a1.575 1.575 0 1 0-3.15 0v8.175a6.75 6.75 0 0 0 6.75 6.75h2.018a5.25 5.25 0 0 0 3.712-1.538l1.732-1.732a5.25 5.25 0 0 0 1.538-3.712l.003-2.024a.668.668 0 0 1 .198-.471 1.575 1.575 0 1 0-2.228-2.228 3.818 3.818 0 0 0-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0 1 16.35 15m0 0a4.49 4.49 0 0 1 .186-1.317' />
            </svg>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>ASL Interpreter</h2>
            <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Sign American Sign Language — words appear as English text in real time</p>
          </div>
        </div>
        <div className='grid grid-cols-3 gap-4'>
          {[
            { label: 'ASL', desc: 'American Sign Language' },
            { label: 'Real-time', desc: 'Word-by-word transcription' },
            { label: 'GPT-4o Vision', desc: 'Broad vocabulary recognition' }
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl p-4 text-center ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <div className={`font-bold text-base ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{stat.label}</div>
              <div className={`text-xs mt-1 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>{stat.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Camera card */}
      <div className={`rounded-2xl p-6 mb-6 ${isDark ? 'glass-card-dark border-white/10' : 'glass-card-light border-black/10'} border`}>
        <div className='relative w-full rounded-xl overflow-hidden bg-black aspect-video mb-4'>
          <video ref={videoRef} className='w-full h-full object-cover' playsInline muted />
          <canvas ref={canvasRef} className='absolute inset-0 w-full h-full' style={{ pointerEvents: 'none' }} />
          {!isActive && (
            <div className='absolute inset-0 flex items-center justify-center'>
              <div className='text-center text-white/40'>
                <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1' stroke='currentColor' className='w-16 h-16 mx-auto mb-2 opacity-50'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z' />
                  <path strokeLinecap='round' strokeLinejoin='round' d='M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z' />
                </svg>
                <p className='text-sm'>Camera off</p>
              </div>
            </div>
          )}
        </div>

        <div className='flex items-center justify-between flex-wrap gap-3'>
          <div className='flex items-center gap-2'>
            <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
            <span className={`text-sm font-medium ${s.cls}`}>{s.label}</span>
          </div>
          <div className='flex items-center gap-3'>
            {!isActive
              ? (
                <button onClick={startCamera} disabled={status === 'loading'} className={`${btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'>
                    <path d='M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z' />
                  </svg>
                  Start Camera
                </button>
                )
              : (
                <button onClick={stopCamera} className={btnGlass}>
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'>
                    <path fillRule='evenodd' d='M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm6-2.438c0-.724.588-1.312 1.313-1.312h4.874c.725 0 1.313.588 1.313 1.313v4.874c0 .725-.588 1.313-1.313 1.313H9.564a1.312 1.312 0 01-1.313-1.313V9.564z' clipRule='evenodd' />
                  </svg>
                  Stop Camera
                </button>
                )}
          </div>
        </div>

        {error && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {error}
          </div>
        )}
      </div>

      {/* Transcript card */}
      <div className={`rounded-2xl p-6 ${isDark ? 'glass-card-dark border-white/10' : 'glass-card-light border-black/10'} border`}>
        <div className='flex items-center justify-between mb-4'>
          <h3 className={`font-semibold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Transcript</h3>
          {transcript && (
            <button
              onClick={() => setTranscript('')}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:bg-white/10' : 'text-theme-secondary-light hover:bg-black/5'}`}
            >
              Clear
            </button>
          )}
        </div>
        <div className={`min-h-[80px] rounded-xl p-4 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
          {transcript
            ? <p className={`text-lg leading-relaxed ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{transcript}</p>
            : <p className={`text-sm ${isDark ? 'text-white/30' : 'text-black/30'}`}>Signed words will appear here...</p>}
        </div>
      </div>
    </ContentWrapper>
  )
}

export default SignLanguage
