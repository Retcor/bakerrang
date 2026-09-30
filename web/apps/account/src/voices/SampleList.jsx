import React, { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icons.jsx'

export const formatDuration = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export const formatSize = (bytes) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const TYPE_LABELS = { 'audio/webm': 'WebM audio', 'audio/mp4': 'MP4 audio', 'audio/ogg': 'Ogg audio', 'audio/mpeg': 'MP3 audio', 'audio/wav': 'WAV audio' }

export const sampleMeta = (sample) => sample.source === 'rec'
  ? `${formatDuration(sample.durationMs)} · ${TYPE_LABELS[sample.type] || 'audio'}`
  : formatSize(sample.size)

// Play/Pause and Remove per sample. Playback is a local blob URL only; nothing is uploaded here.
export const SampleList = ({ samples, disabled, onRemove }) => {
  const [playingId, setPlayingId] = useState(null)
  const audio = useRef(null)

  const stop = () => {
    audio.current?.pause()
    audio.current = null
    setPlayingId(null)
  }

  useEffect(() => stop, [])
  useEffect(() => {
    if (playingId && !samples.some((sample) => sample.id === playingId)) stop()
  }, [samples, playingId])

  const toggle = (sample) => {
    if (playingId === sample.id) { stop(); return }
    audio.current?.pause()
    const element = new window.Audio(sample.url)
    element.addEventListener('ended', () => { if (audio.current === element) stop() })
    audio.current = element
    setPlayingId(sample.id)
    Promise.resolve(element.play()).catch(stop)
  }

  return (
    <ul className='ac-samples' aria-label='Samples'>
      {samples.map((sample) => {
        const playing = playingId === sample.id
        return (
          <li className='ac-sample' key={sample.id}>
            <span className='ac-sample__icon'><Icon name={sample.source === 'rec' ? 'wave' : 'upload'} /></span>
            <div>
              <div className='ac-sample__name'>{sample.name}</div>
              <div className='ac-sample__meta'>{sampleMeta(sample)}</div>
            </div>
            <div className='ac-sample__acts'>
              <button type='button' className='ac-ibtn' aria-label={`${playing ? 'Pause' : 'Play'} ${sample.name}`} aria-pressed={playing} disabled={disabled} onClick={() => toggle(sample)}><Icon name={playing ? 'pause' : 'play'} /></button>
              <button type='button' className='ac-ibtn' aria-label={`Remove ${sample.name}`} disabled={disabled} onClick={() => onRemove(sample)}><Icon name='x' /></button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
