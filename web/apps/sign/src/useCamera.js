import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision'
import { GestureEstimator } from 'fingerpose'
import { staticGestures } from './vision/handshapes.js'
import { classifyFrame } from './vision/classify.js'
import { motionOverride } from './vision/motion.js'
import { createStabilizer } from './vision/stabilizer.js'

const constraints = { audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
export const cameraError = error => ({ NotAllowedError: 'denied', SecurityError: 'denied', NotFoundError: 'noCamera', OverconstrainedError: 'noCamera', NotReadableError: 'cameraBusy', AbortError: 'cameraBusy' }[error?.name] || 'readerFailed')

export function useCamera ({ videoRef, canvasRef, onReading }) {
  const [state, setState] = useState('off')
  const [reading, setReading] = useState(null)
  const active = useRef(false); const stream = useRef(null); const reader = useRef(null); const raf = useRef(null); const trajectory = useRef([]); const lastVideo = useRef(-1); const lastFrame = useRef(0); const stabilizer = useRef(createStabilizer()); const failures = useRef(0)
  const stop = useCallback((next = 'off') => {
    active.current = false; if (raf.current) cancelAnimationFrame(raf.current); raf.current = null
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.parentElement?.style.removeProperty('--sg-ar')
    }
    const canvas = canvasRef.current; if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    trajectory.current = []; setReading(null); setState(next)
  }, [canvasRef, videoRef])
  const loadReader = useCallback(async () => {
    if (reader.current) return reader.current
    const vision = await FilesetResolver.forVisionTasks('/vendor/tasks-vision-0.10.34')
    const baseOptions = { modelAssetPath: '/vendor/hand_landmarker-f16-v1.task' }
    try { reader.current = await HandLandmarker.createFromOptions(vision, { baseOptions: { ...baseOptions, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1 }) } catch { reader.current = await HandLandmarker.createFromOptions(vision, { baseOptions: { ...baseOptions, delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 1 }) }
    return reader.current
  }, [])
  const loop = useCallback(() => {
    raf.current = requestAnimationFrame(loop)
    const video = videoRef.current; const canvas = canvasRef.current
    if (!active.current || !video || !canvas || video.readyState < 2 || video.currentTime === lastVideo.current || performance.now() - lastFrame.current < 33) return
    lastVideo.current = video.currentTime; lastFrame.current = performance.now()
    const displayWidth = Math.max(1, canvas.clientWidth); const displayHeight = Math.max(1, canvas.clientHeight); const pixelRatio = Math.max(1, window.devicePixelRatio || 1)
    const nextWidth = Math.round(displayWidth * pixelRatio); const nextHeight = Math.round(displayHeight * pixelRatio)
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) { canvas.width = nextWidth; canvas.height = nextHeight }
    const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height)
    try {
      const result = reader.current.detectForVideo(video, performance.now()); const landmarks = result.landmarks?.[0]
      let raw = null
      if (landmarks) {
        failures.current = 0; trajectory.current.push({ pinky: landmarks[20], index: landmarks[8] }); if (trajectory.current.length > 30) trajectory.current.shift()
        raw = motionOverride(classifyFrame(landmarks, { width: video.videoWidth, height: video.videoHeight }, new GestureEstimator(staticGestures)), trajectory.current)
        const drawing = new DrawingUtils(context); const mirrored = landmarks.map(point => ({ ...point, x: 1 - point.x }))
        drawing.drawConnectors(mirrored, HandLandmarker.HAND_CONNECTIONS, { color: 'rgba(255,255,255,.78)', lineWidth: 2 }); drawing.drawLandmarks(mirrored, { color: '#fff', radius: 3 })
        if (raw) {
          const tip = mirrored.reduce((highest, point) => point.y < highest.y ? point : highest)
          const fontSize = Math.max(22 * pixelRatio, canvas.height * 0.075); const paddingX = 10 * pixelRatio; const paddingY = 7 * pixelRatio
          context.font = `800 ${fontSize}px "Archivo Expanded", Archivo, sans-serif`
          const textWidth = context.measureText(raw).width; const chipWidth = textWidth + paddingX * 2; const chipHeight = fontSize + paddingY * 2
          const chipX = Math.min(Math.max(tip.x * canvas.width - chipWidth / 2, 8 * pixelRatio), canvas.width - chipWidth - 8 * pixelRatio)
          const chipY = Math.max(tip.y * canvas.height - chipHeight - 12 * pixelRatio, 8 * pixelRatio)
          context.fillStyle = '#0c0b0a'; context.strokeStyle = 'rgba(255,255,255,.55)'; context.lineWidth = 1.5 * pixelRatio
          context.beginPath(); context.roundRect(chipX, chipY, chipWidth, chipHeight, 4 * pixelRatio); context.fill(); context.stroke()
          context.fillStyle = '#fff'; context.textAlign = 'center'; context.textBaseline = 'middle'
          context.fillText(raw, chipX + chipWidth / 2, chipY + chipHeight / 2)
        }
      } else trajectory.current = []
      const next = stabilizer.current(raw, performance.now()); if (next.changed) { setReading(next.reading); onReading(next.reading) }
    } catch { failures.current += 1; if (failures.current >= 30) stop('readerFailed') }
  }, [canvasRef, onReading, stop, videoRef])
  const start = useCallback(async () => {
    if (active.current || state === 'loading' || state === 'permission') return
    if (!navigator.mediaDevices || !window.isSecureContext) { setState('unsupported'); return }
    active.current = true; setState('loading')
    try {
      await loadReader(); if (!active.current) return
      setState('permission')
      let nextStream
      try { nextStream = await navigator.mediaDevices.getUserMedia(constraints) } catch (error) { if (error.name !== 'OverconstrainedError') throw error; nextStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true }) }
      if (!active.current) { nextStream.getTracks().forEach(track => track.stop()); return }
      stream.current = nextStream; nextStream.getTracks().forEach(track => { track.onended = () => stop('cameraLost') })
      const video = videoRef.current; if (!video) { stop(); return }; video.srcObject = nextStream; await video.play(); if (!active.current) return
      video.parentElement?.style.setProperty('--sg-ar', String(video.videoWidth / video.videoHeight))
      setState('on'); loop()
    } catch (error) { if (active.current) stop(cameraError(error)) }
  }, [loadReader, loop, state, stop, videoRef])
  useEffect(() => { const hidden = () => { if (document.visibilityState === 'hidden' && active.current) stop('paused') }; document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', hidden); return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', hidden); stop() } }, [stop])
  return { state, reading, start, stop, active: state === 'on' || state === 'loading' || state === 'permission' }
}
