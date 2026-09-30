/* eslint-disable react/jsx-handler-names */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAnnounce } from '../announce.jsx'
import { Icon } from '../Icons.jsx'
import { DiscardGuard } from './DiscardGuard.jsx'
import { SampleList, formatDuration } from './SampleList.jsx'
import { MAX_RECORDING_MS, SAMPLE_EXTENSIONS, baseAudioType, isSupportedSampleType, useRecorder } from './useRecorder.js'

export const MAX_SAMPLES = 3
export const MAX_SAMPLE_BYTES = 10 * 1024 * 1024
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024
const TOO_LARGE = 'Those samples are too large. Keep each under 10 MB.'

let sampleCounter = 0
const nextSampleId = () => `sample-${++sampleCounter}`

const FAILURES = {
  provider: "ElevenLabs couldn't create the voice. Nothing was saved. Try again.",
  too_large: TOO_LARGE,
  invalid: "The voice couldn't be created. Check the highlighted fields.",
  busy: 'Too many requests. Please wait a moment, then try again.',
  auth: 'Your session ended. Sign in again to create the voice.'
}

// The one place a voice is created (docs/apps/PhaseH-Account.md §7, §15). Samples stay in memory
// (blob URLs revoked on remove, close and unmount); nothing is stored in the browser.
export const AddVoiceEditor = ({ online, onCreate, onCreated, onRefresh, onCancel, onDirtyChange, guard }) => {
  const announce = useAnnounce()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [consent, setConsent] = useState(false)
  const [samples, setSamples] = useState([])
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('edit') // edit | creating | failed | unknown
  const [failure, setFailure] = useState('')
  const [sampleProblem, setSampleProblem] = useState('')
  const [focusRequest, setFocusRequest] = useState({ target: 'name', count: 0 })
  const nameRef = useRef(null)
  const recordRef = useRef(null)
  const consentRef = useRef(null)
  const urls = useRef(new Set())
  const recordingCount = useRef(0)

  const creating = phase === 'creating'

  const addSample = useCallback((sample) => {
    urls.current.add(sample.url)
    setSamples((current) => [...current, sample])
  }, [])

  const onRecorded = useCallback(({ blob, type, durationMs }) => {
    recordingCount.current += 1
    const label = `Recording ${recordingCount.current}`
    const file = new File([blob], `${label}.${SAMPLE_EXTENSIONS[type] || 'webm'}`, { type })
    addSample({ id: nextSampleId(), name: label, type, size: file.size, file, durationMs, url: URL.createObjectURL(file), source: 'rec' })
    announce('Recording added.')
  }, [addSample, announce])

  const recorder = useRecorder({ onSample: onRecorded })
  const recording = recorder.state === 'recording'
  const full = samples.length + (recording ? 1 : 0) >= MAX_SAMPLES

  useEffect(() => {
    const urlSet = urls.current
    return () => urlSet.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    onDirtyChange?.(Boolean(name || description || consent || samples.length || recording))
  }, [consent, description, name, onDirtyChange, recording, samples.length])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  // One-shot focus requests (first render, first invalid field): typing never re-triggers them.
  useEffect(() => {
    const target = { name: nameRef, samples: recordRef, consent: consentRef }[focusRequest.target]
    target?.current?.focus()
  }, [focusRequest])
  const focusOn = (target) => setFocusRequest((current) => ({ target, count: current.count + 1 }))

  const clearFailure = () => { if (phase === 'failed') setPhase('edit') }

  const handleFiles = (event) => {
    const incoming = [...event.target.files]
    event.target.value = ''
    let problem = ''
    let total = samples.reduce((sum, sample) => sum + sample.size, 0)
    let room = MAX_SAMPLES - samples.length - (recording ? 1 : 0)
    for (const file of incoming) {
      if (room <= 0) { problem = 'You can add up to 3 samples.'; break }
      if (!isSupportedSampleType(file.type)) { problem = "That file isn't a supported audio type."; continue }
      if (file.size > MAX_SAMPLE_BYTES || total + file.size > MAX_TOTAL_BYTES) { problem = TOO_LARGE; continue }
      total += file.size
      room -= 1
      addSample({ id: nextSampleId(), name: file.name, type: baseAudioType(file.type), size: file.size, file, url: URL.createObjectURL(file), source: 'file' })
    }
    setSampleProblem(problem)
    setErrors((current) => ({ ...current, samples: false }))
    clearFailure()
  }

  const removeSample = (sample) => {
    URL.revokeObjectURL(sample.url)
    urls.current.delete(sample.url)
    setSamples((current) => current.filter((item) => item.id !== sample.id))
    announce(`Removed ${sample.name}.`)
  }

  const startRecording = () => {
    if (full || creating) return
    setSampleProblem('')
    recorder.start()
    announce('Recording started.')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (creating || recording) return
    if (phase === 'unknown') { onRefresh(); return }
    if (!online) return
    const next = { name: !name.trim(), samples: samples.length === 0, consent: !consent }
    setErrors(next)
    if (next.name || next.samples || next.consent) {
      focusOn(next.name ? 'name' : next.samples ? 'samples' : 'consent')
      announce('Check the highlighted fields.')
      return
    }
    setPhase('creating')
    setFailure('')
    announce('Creating voice.')
    const result = await onCreate({ name: name.trim(), description: description.trim(), consent, files: samples.map((sample) => sample.file) })
    if (result.ok) { onCreated(result.result); return }
    if (result.kind === 'stale') return
    if (result.kind === 'unknown') { setPhase('unknown'); return }
    setFailure(FAILURES[result.kind] || FAILURES.provider)
    setPhase('failed')
    if (result.kind === 'invalid' && result.field === 'name') { setErrors({ name: true }); focusOn('name') }
  }

  const disabled = creating
  const blocked = creating || recording || !online
  const guardOpen = Boolean(guard)

  return (
    <div className='ac-editor ac-editor--top' id='ac-add-editor'>
      <form onSubmit={submit} aria-labelledby='ac-add-h' aria-busy={creating || undefined} noValidate>
        {guardOpen && <DiscardGuard signOut={guard.signOut} onKeep={guard.onKeep} onDiscard={guard.onDiscard} />}
        <h3 id='ac-add-h' tabIndex={-1}>Add a voice</h3>
        <p className='ac-editor__intro'>Clone a voice from a few minutes of speech or less. Story Book and Polyglot can then read aloud in it.</p>
        {phase === 'unknown' && (
          <div className='ac-notice' role='alert'>
            <Icon name='alert' />
            <strong>Account couldn't confirm the new voice.</strong>
            <span>It may still have been created. Refresh your voices to check before you try again, so you don't clone it twice.</span>
          </div>
        )}
        <div className='ac-fields'>
          <div className='ac-f ac-f--3'>
            <label htmlFor='ac-add-name'>Name</label>
            <input className='ac-in' id='ac-add-name' ref={nameRef} maxLength={60} placeholder='e.g. My voice' autoComplete='off' value={name} disabled={disabled} aria-invalid={errors.name || undefined} aria-describedby={errors.name ? 'ac-add-name-err' : undefined} onChange={(event) => { setName(event.target.value); setErrors((current) => ({ ...current, name: false })); clearFailure() }} />
            {errors.name && <span className='ac-err' id='ac-add-name-err'><Icon name='alert' />Give the voice a name.</span>}
          </div>
          <div className='ac-f ac-f--3'>
            <label htmlFor='ac-add-desc'>Description <small>(optional)</small></label>
            <input className='ac-in' id='ac-add-desc' maxLength={200} placeholder='e.g. Recorded at my desk' autoComplete='off' value={description} disabled={disabled} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <fieldset className='ac-f ac-f--6' aria-describedby={errors.samples ? 'ac-add-samples-err' : 'ac-add-samples-hint'}>
            <legend>Samples <small>(up to 3)</small></legend>
            <p className='ac-hint' id='ac-add-samples-hint' style={{ margin: '0 0 6px' }}>One or two minutes of clear speech in a quiet room works best. Recordings or audio files, 10 MB each.</p>
            {recorder.state === 'denied' && <p className='ac-note' role='alert' style={{ color: 'var(--ink)', marginBottom: 8 }}><Icon name='alert' /><span>Account can't use your microphone. Allow it in your browser's site settings, or add audio files instead.</span></p>}
            {sampleProblem && <p className='ac-note' role='alert' style={{ color: 'var(--ink)', marginBottom: 8 }}><Icon name='alert' /><span>{sampleProblem}</span></p>}
            <div className='ac-samples__tools'>
              {recorder.supported && <button type='button' ref={recordRef} className='ac-btn ac-btn--ghost' aria-disabled={full || recording || creating || undefined} onClick={startRecording}><Icon name='mic' />Record a sample</button>}
              <label className='ac-btn ac-btn--ghost' aria-disabled={full || creating || undefined}>
                <Icon name='upload' />Add audio files
                <input type='file' accept='audio/*' multiple className='ac-sr' disabled={full || creating} onChange={handleFiles} ref={recorder.supported ? undefined : recordRef} />
              </label>
            </div>
            <SampleList samples={samples} disabled={disabled} onRemove={removeSample} />
            {recording && (
              <div className='ac-rec' role='group' aria-label='Recording'>
                <span className='ac-rec__dot' aria-hidden='true' />
                <div>
                  <div className='ac-rec__time'><span className='ac-sr'>Recording, </span>Recording · <span className='ac-tnum'>{formatDuration(recorder.elapsedMs)}</span> <span className='ac-sample__meta'>of {formatDuration(MAX_RECORDING_MS)}</span></div>
                  <div className='ac-rec__rule' aria-hidden='true'><i style={{ width: `${(recorder.elapsedMs / MAX_RECORDING_MS) * 100}%` }} /></div>
                </div>
                <button type='button' className='ac-btn ac-btn--ink ac-btn--sm' onClick={() => { recorder.stop() }}><Icon name='stop' />Stop</button>
              </div>
            )}
            {errors.samples && <span className='ac-err' id='ac-add-samples-err' style={{ marginTop: 6 }}><Icon name='alert' />Add at least one recording or audio file.</span>}
          </fieldset>
          <div className='ac-f ac-f--6'>
            <label className='ac-check'>
              <input type='checkbox' ref={consentRef} checked={consent} disabled={disabled} aria-invalid={errors.consent || undefined} aria-describedby={errors.consent ? 'ac-add-consent-err' : undefined} onChange={(event) => { setConsent(event.target.checked); setErrors((current) => ({ ...current, consent: false })); clearFailure() }} />
              <span>This is my voice, or I have permission from the person speaking to clone it.</span>
            </label>
            {errors.consent && <span className='ac-err' id='ac-add-consent-err'><Icon name='alert' />Confirm you have the right to clone this voice.</span>}
          </div>
          <p className='ac-note ac-f--6'><Icon name='info' /><span>Samples go to ElevenLabs, which creates and stores the voice. BakerRang keeps the name and description, not the audio.</span></p>
        </div>
        <div className='ac-foot'>
          {creating && <span className='ac-foot__status'><span className='ac-spin' aria-hidden='true' />This can take up to a minute.</span>}
          {phase === 'failed' && <span className='ac-foot__status is-problem' role='alert'><Icon name='alert' />{failure}</span>}
          {phase !== 'creating' && phase !== 'failed' && <span className='ac-foot__status' />}
          <button type='button' className='ac-btn ac-btn--quiet' aria-disabled={creating || undefined} onClick={() => { if (!creating) onCancel() }}>Cancel</button>
          <button type='submit' className='ac-btn ac-btn--ink' aria-disabled={(phase === 'unknown' ? false : blocked) || undefined}>
            {creating ? <><span className='ac-spin' aria-hidden='true' />Creating voice…</> : phase === 'unknown' ? 'Refresh voices' : 'Create voice'}
          </button>
        </div>
      </form>
    </div>
  )
}
