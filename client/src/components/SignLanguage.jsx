import React, { useState, useEffect, useRef, useCallback } from 'react'
import { HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'
import { GestureEstimator } from 'fingerpose'
import { allGestures } from '../utils/aslGestures.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import ContentWrapper from './ContentWrapper.jsx'

const CONFIDENCE_THRESHOLD = 8
const MAX_TRAJ = 30

// ── J detection: pinky draws a J stroke (down then hooks left) ────────────
const detectJ = (traj) => {
  if (traj.length < 20) return false
  const pts = traj.slice(-20).map(t => t.pinky)
  const startY = pts[0].y
  const endY = pts[pts.length - 1].y
  const minX = Math.min(...pts.map(p => p.x))
  const maxX = Math.max(...pts.map(p => p.x))
  // Pinky moved down (Y increases in normalized coords) and hooked left
  return (endY - startY) > 0.08 && (maxX - minX) > 0.05
}

// ── Z detection: index draws a Z stroke (right → diag-down-left → right) ─
const detectZ = (traj) => {
  if (traj.length < 24) return false
  const pts = traj.slice(-24).map(t => t.index)
  const third = Math.floor(pts.length / 3)
  const seg1 = pts.slice(0, third)
  const seg2 = pts.slice(third, third * 2)
  const seg3 = pts.slice(third * 2)
  const dx = (arr) => arr[arr.length - 1].x - arr[0].x
  const dy = (arr) => arr[arr.length - 1].y - arr[0].y
  // seg1: rightward, seg2: down-left, seg3: rightward again
  return dx(seg1) > 0.04 &&
    dx(seg2) < -0.04 && dy(seg2) > 0.03 &&
    dx(seg3) > 0.04
}

const SignLanguage = () => {
  const { isDark } = useTheme()
  const isDarkRef = useRef(isDark)
  useEffect(() => { isDarkRef.current = isDark }, [isDark])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const estimatorRef = useRef(null)
  const animFrameRef = useRef(null)
  const streamRef = useRef(null)
  const currentSignRef = useRef('')
  const trajectoryRef = useRef([])

  const [isActive, setIsActive] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

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
        const landmarks = results.landmarks[0]

        // Draw skeleton
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
          color: dark ? '#a3e635' : '#16a34a',
          lineWidth: 2
        })
        drawingUtils.drawLandmarks(landmarks, {
          color: dark ? '#fbbf24' : '#d97706',
          lineWidth: 1,
          radius: 3
        })

        // Bounding box
        const xs = landmarks.map(l => l.x * canvas.width)
        const ys = landmarks.map(l => l.y * canvas.height)
        const x1 = Math.min(...xs) - 20
        const y1 = Math.min(...ys) - 20
        const bw = Math.max(...xs) - Math.min(...xs) + 40
        const bh = Math.max(...ys) - Math.min(...ys) + 40
        ctx.strokeStyle = dark ? '#a3e635' : '#16a34a'
        ctx.lineWidth = 2
        ctx.strokeRect(x1, y1, bw, bh)

        // Trajectory buffer (pinky tip = 20, index tip = 8)
        trajectoryRef.current.push({ pinky: landmarks[20], index: landmarks[8] })
        if (trajectoryRef.current.length > MAX_TRAJ) trajectoryRef.current.shift()

        // fingerpose classification (convert {x,y,z} objects to [x,y,z] arrays)
        const fpLandmarks = landmarks.map(l => [l.x, l.y, l.z])
        const est = estimatorRef.current.estimate(fpLandmarks, CONFIDENCE_THRESHOLD)
        const best = est.gestures.sort((a, b) => b.score - a.score)[0]
        let sign = best ? best.name : ''

        // J override: hand must be in "I" base pose
        if (sign === 'I' || sign === '') {
          if (detectJ(trajectoryRef.current)) sign = 'J'
        }

        // Z override: hand must be in "1" base pose
        if (sign === '1' || sign === '') {
          if (detectZ(trajectoryRef.current)) sign = 'Z'
        }

        currentSignRef.current = sign

        // Label above bounding box
        if (sign) {
          ctx.save()
          ctx.font = 'bold 22px sans-serif'
          ctx.fillStyle = dark ? '#a3e635' : '#16a34a'
          ctx.fillText(sign, x1, y1 - 8)
          ctx.restore()
        }
      } else {
        currentSignRef.current = ''
        trajectoryRef.current = []
      }
    }

    loop()
  }, [])

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

      if (!estimatorRef.current) {
        estimatorRef.current = new GestureEstimator(allGestures)
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
    currentSignRef.current = ''
    trajectoryRef.current = []
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
    ready: { dot: isDark ? 'bg-green-400' : 'bg-green-500', label: 'Ready — sign to begin', cls: isDark ? 'text-green-400' : 'text-green-600' }
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
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className={`w-8 h-8 ${isDark ? 'text-gray-900' : 'text-white'}`}>
              <path strokeLinecap='round' strokeLinejoin='round' d='M10.05 4.575a1.575 1.575 0 1 0-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 0 1 3.15 0v1.5m-3.15 0 .075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 0 1 3.15 0V15M6.9 7.575a1.575 1.575 0 1 0-3.15 0v8.175a6.75 6.75 0 0 0 6.75 6.75h2.018a5.25 5.25 0 0 0 3.712-1.538l1.732-1.732a5.25 5.25 0 0 0 1.538-3.712l.003-2.024a.668.668 0 0 1 .198-.471 1.575 1.575 0 1 0-2.228-2.228 3.818 3.818 0 0 0-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0 1 16.35 15m0 0a4.49 4.49 0 0 1 .186-1.317' />
            </svg>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>ASL Interpreter</h2>
            <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Sign American Sign Language — recognized instantly with no server calls</p>
          </div>
        </div>
        <div className='grid grid-cols-3 gap-4'>
          {[
            { label: 'ASL', desc: 'American Sign Language' },
            { label: 'Instant', desc: 'Client-side, zero latency' },
            { label: 'A–Z + Signs', desc: 'Alphabet & common signs' }
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

    </ContentWrapper>
  )
}

export default SignLanguage
