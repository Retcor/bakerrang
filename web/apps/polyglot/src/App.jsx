/* eslint-disable react/jsx-handler-names, react/jsx-closing-tag-location */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AccountMenu, AppSwitcher, BrandLink, ProductEmblem, resolveDestinations } from '@bakerrang/web-app-shell'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { Button } from '@bakerrang/web-ui'
import logoUrl from './assets/bakerrang-logo.png'
import { apiBaseUrl, apiClient } from './providers.jsx'
import { createPolyglotApi } from './api/polyglot.js'
import { LANGUAGES, languageByCode } from './languages.js'
import { readPair, readVoice, writePair, writeVoice } from './state/preferences.js'
import { useRecorder } from './state/useRecorder.js'
import { useTurns } from './state/useTurns.js'

const destinations = resolveDestinations(import.meta.env)
const api = createPolyglotApi({ apiClient, apiBaseUrl })

const Icon = ({ name }) => {
  const paths = {
    mic: <><rect x='9' y='3' width='6' height='11' rx='3' /><path d='M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7' /></>,
    stop: <rect x='6.5' y='6.5' width='11' height='11' rx='1.5' fill='currentColor' stroke='none' />,
    swap: <><path d='M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6M9.5 12.5 6 16l3.5 3.5' /></>,
    chevron: <path d='m7 10 5 5 5-5' />,
    keyboard: <><rect x='2.5' y='6' width='19' height='12' rx='2' /><path d='M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9' /></>,
    send: <><path d='M5 12h14M13 6l6 6-6 6' /></>,
    replay: <path d='M4 12a8 8 0 1 0 2.4-5.7L4 8.6M4 4v4.6h4.6' />,
    copy: <><rect x='8.5' y='8.5' width='11' height='11' rx='1.5' /><path d='M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5' /></>,
    check: <path d='m5 12.5 4.5 4.5L19 7.5' />,
    voice: <path d='M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2' />,
    more: <path d='M5 12h.01M12 12h.01M19 12h.01' strokeWidth='3' />,
    close: <path d='M6 6l12 12M18 6 6 18' />,
    alert: <><path d='M12 4 2.8 19.5h18.4z' /><path d='M12 10v4.2M12 17h.01' /></>,
    offline: <><path d='M2 8.8a15 15 0 0 1 4.2-2.7M9.6 5.2A15 15 0 0 1 22 8.8M5 12.4a10 10 0 0 1 5-2.6M17 11.6a10 10 0 0 1 2 .8M8.5 15.8a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18' /></>
  }
  return <svg className='pg-icon' viewBox='0 0 24 24' aria-hidden='true'>{paths[name]}</svg>
}

const GoogleIcon = () => <svg className='pg-google' viewBox='0 0 24 24' aria-hidden='true'><path fill='currentColor' d='M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1-.8 2.6-2.3 3.6l3.6 2.8c2.1-2 3.7-4.9 3.7-8.3zM12 24c3.2 0 5.9-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.3 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2l-3.7 2.9C3.2 21.3 7.3 24 12 24zM4.9 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.8C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.2l3.7-2.9zM12 4.8c1.8 0 3 .8 3.7 1.4l2.7-2.7C16.9 1.9 14.4.9 12 .9 7.3.9 3.2 3.6 1.2 6.8l3.7 2.9C5.9 6.7 8.7 4.8 12 4.8z' /></svg>

const AppBar = ({ signedIn = true }) => {
  const auth = useAuth()
  return (
    <header className='pg-bar'><div className='pg-bar__inner'>
      <BrandLink logoSrc={logoUrl} launcherUrl={destinations.launcher.url} appName='Polyglot' appUrl='/' />
      <div className='pg-spacer' />
      {signedIn
        ? <div className='pg-chrome'><AppSwitcher destinations={destinations} current='polyglot' /><AccountMenu destinations={destinations} themeControl /></div>
        : <Button variant='ghost' size='small' onClick={auth.login}><GoogleIcon />Sign in</Button>}
    </div></header>
  )
}

const Welcome = () => {
  const auth = useAuth()
  return (
    <div className='pg-page'><AppBar signedIn={false} /><main className='pg-welcome'>
      <section><ProductEmblem id='polyglot' className='pg-welcome__mark' /><h1>Say it. Hear it in another language.</h1><p>Polyglot listens, shows what it heard, translates it, then speaks the result in a voice you’ve cloned in your BakerRang account.</p><Button variant='gold' onClick={auth.login}><GoogleIcon />Sign in with Google</Button><p className='pg-fine'>Your speech is sent to transcription, translation and voice services. Polyglot itself keeps none of it.</p></section>
      <section className='pg-example' aria-label='Example conversation'><header><span>A conversation</span><b>Example</b></header>{[
        ['01', 'EN→ES', 'Excuse me, where is the station?', 'Disculpe, ¿dónde está la estación?'],
        ['02', 'ES→EN', 'Está dos calles más adelante.', 'It’s two streets further ahead.'],
        ['03', 'EN→ES', 'Thank you very much.', 'Muchas gracias.']
      ].map(([n, dir, heard, said]) => <div className='pg-example__turn' key={n}><div><b>{n}</b><span>{dir}</span></div><div><small>{heard}</small><p>{said}</p></div></div>)}</section>
    </main></div>
  )
}

const useOnline = () => {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const yes = () => setOnline(true)
    const no = () => setOnline(false)
    window.addEventListener('online', yes); window.addEventListener('offline', no)
    return () => { window.removeEventListener('online', yes); window.removeEventListener('offline', no) }
  }, [])
  return online
}

const moveOptionFocus = (event) => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const buttons = [...event.currentTarget.parentElement.querySelectorAll('button')]
  const index = buttons.indexOf(event.currentTarget)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  event.preventDefault()
  buttons[next]?.focus()
}

const LanguagePicker = ({ side, value, open, onOpen, onClose, onPick }) => {
  const language = languageByCode(value)
  const [search, setSearch] = useState('')
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const filtered = LANGUAGES.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()) || item.code.toLowerCase().startsWith(search.toLowerCase()))
  useEffect(() => { if (open) { setSearch(''); requestAnimationFrame(() => inputRef.current?.focus()) } }, [open])
  useEffect(() => {
    if (!open) return
    const outside = (event) => { if (!panelRef.current?.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key) }
  }, [onClose, open])
  return (
    <div className={`pg-picker-wrap ${open ? 'is-open' : ''}`} ref={panelRef}>
      <button className='pg-language' type='button' aria-haspopup='listbox' aria-expanded={open} onClick={onOpen}><span>{side === 'from' ? 'Speak' : 'Into'}</span><b>{language.name}</b><Icon name='chevron' /></button>
      {open && <><button className='pg-sheet-scrim' aria-label='Close language picker' onClick={onClose} /><div className='pg-picker' role='dialog' aria-label={`Choose ${side === 'from' ? 'source' : 'target'} language`}>
        <header><b>{side === 'from' ? 'Speak' : 'Translate into'}</b><button onClick={onClose} aria-label='Close'><Icon name='close' /></button></header>
        <label className='pg-find'><span className='pg-sr'>Find a language</span><input ref={inputRef} value={search} placeholder='Find a language…' onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); event.currentTarget.closest('.pg-picker').querySelector('.pg-options button')?.focus() } }} /></label>
        <div className='pg-options' role='listbox' aria-label='Languages'>{filtered.length ? filtered.map((item) => <button key={item.code} role='option' aria-selected={item.code === value} onKeyDown={moveOptionFocus} onClick={() => { onPick(item.code); onClose() }}><span>{item.name}</span><small>{item.code}</small>{item.code === value && <Icon name='check' />}</button>) : <p>No language found.</p>}</div>
      </div></>}
    </div>
  )
}

const VoicePicker = ({ voices, value, open, onOpen, onClose, onPick }) => {
  const ref = useRef(null)
  const selected = voices.find((voice) => voice.id === value)
  useEffect(() => {
    if (!open) return
    const outside = (event) => { if (!ref.current?.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key) }
  }, [onClose, open])
  return (
    <div className={`pg-voice-wrap ${open ? 'is-open' : ''}`} ref={ref}><button className='pg-voice' aria-label={selected ? `Speaking voice: ${selected.name}` : 'No cloned voice. Add or manage a voice'} aria-haspopup='dialog' aria-expanded={open} onClick={onOpen}><Icon name='voice' /><span>{selected?.name || 'Add a voice'}</span><Icon name='chevron' /></button>
      {open && <><button className='pg-sheet-scrim' aria-label='Close voice picker' onClick={onClose} /><div className='pg-voice-panel'><header><b>Your voice</b><button onClick={onClose} aria-label='Close'><Icon name='close' /></button></header>{voices.length
        ? <div role='radiogroup'>{voices.map((voice) => <button key={voice.id} role='radio' aria-checked={voice.id === value} onClick={() => { onPick(voice.id); onClose() }}><i /> <span>{voice.name}</span>{voice.isPrimary && <small>Primary</small>}</button>)}</div>
        : <p>Translations are shown even without a cloned voice. <a href={destinations.account.url}>Add a voice in Account</a> to hear them spoken.</p>}<a className='pg-manage' href={destinations.account.url}>Manage voices in Account</a></div></>}
    </div>
  )
}

const StageRule = ({ turn, hasVoice }) => {
  const phaseOrder = ['transcribing', 'translating', 'speaking', 'done']
  const current = phaseOrder.indexOf(turn.phase)
  return (
    <div className='pg-stages' aria-label='Translation progress'>{['Heard', 'Translated', hasVoice ? 'Spoken' : 'Shown'].map((label, index) => {
      const done = turn.phase === 'done' || index < current || (!hasVoice && index === 2 && turn.said)
      const now = !done && ((turn.phase === 'transcribing' && index === 0) || (turn.phase === 'translating' && index === 1) || (turn.phase === 'speaking' && index === 2))
      return <div key={label} className={`${done ? 'is-done' : ''} ${now ? 'is-now' : ''}`}><i /><span>{label}</span></div>
    })}</div>
  )
}

const TurnProblem = ({ turn, onRetry, onDiscard, onTalkAgain, onTypeInstead }) => {
  const messages = {
    nothingHeard: ['Didn’t catch that.', 'Try again a little closer to the mic.'],
    micDenied: ['Polyglot needs your microphone.', 'Allow it in your browser’s site settings, or type instead.'],
    micUnavailable: ['No microphone available here.', 'You can type instead.'],
    transcribeFailed: ['Couldn’t make that out.', 'Please say it again.'],
    translateFailed: ['Couldn’t translate that.', 'What we heard is still here, so you don’t have to say it again.'],
    rateLimited: ['That’s a lot of translating.', 'Wait a minute and try again.'],
    signedOut: ['You’ve been signed out.', 'Sign in to continue.']
  }
  const message = messages[turn.error]
  if (!message) return null
  const needsTalkAgain = ['nothingHeard', 'transcribeFailed'].includes(turn.error)
  const needsTypeInstead = ['micDenied', 'micUnavailable'].includes(turn.error)
  return <div className='pg-problem'><Icon name='alert' /><div><strong>{message[0]}</strong><p>{message[1]}</p><div>{turn.error === 'translateFailed' || turn.error === 'rateLimited' ? <button onClick={() => onRetry(turn.id)}>Try again</button> : null}{needsTalkAgain ? <button onClick={onTalkAgain}>Talk again</button> : null}{needsTypeInstead ? <button onClick={onTypeInstead}>Type instead</button> : null}<button onClick={() => onDiscard(turn.id)}>Discard</button></div></div></div>
}

const TurnActions = ({ turn, newest, voice, copied, onCopy, onReplay }) => {
  const [menu, setMenu] = useState(false)
  const [up, setUp] = useState(false)
  const buttonRef = useRef(null)
  const firstRef = useRef(null)
  const ref = useRef(null)
  const close = useCallback((restore = false) => { setMenu(false); if (restore) requestAnimationFrame(() => buttonRef.current?.focus()) }, [])
  const open = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    setUp(Boolean(rect && window.innerHeight - rect.bottom < 150))
    setMenu(true)
    requestAnimationFrame(() => firstRef.current?.focus())
  }
  useEffect(() => {
    if (!menu) return
    const outside = (event) => { if (!ref.current?.contains(event.target)) close() }
    const key = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(true) } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key) }
  }, [close, menu])
  const run = async (action) => { await action(); close(true) }
  return (
    <div className={`pg-actions ${newest ? 'is-newest' : ''}`} ref={ref}>
      <div className='pg-actions__direct'><button aria-label={`Copy ${turn.toName} text`} onClick={() => onCopy(turn.id)}><Icon name={copied ? 'check' : 'copy'} /></button>{voice && <button aria-label={`Say it again in ${voice.name}`} onClick={() => onReplay(turn.id)}><Icon name='replay' /></button>}</div>
      {!newest && <button ref={buttonRef} className='pg-more' aria-label={`Actions for turn ${String(turn.n).padStart(2, '0')}`} aria-haspopup='menu' aria-expanded={menu} onClick={() => menu ? close() : open()}><Icon name={copied ? 'check' : 'more'} /></button>}
      {menu && <div className={`pg-turn-menu ${up ? 'is-up' : ''}`} role='menu'><button ref={firstRef} role='menuitem' onKeyDown={moveOptionFocus} onClick={() => run(() => onCopy(turn.id))}>Copy {turn.toName} text</button>{voice && <button role='menuitem' onKeyDown={moveOptionFocus} onClick={() => run(() => onReplay(turn.id))}>Say it again in {voice.name}</button>}</div>}
    </div>
  )
}

const Turn = ({ turn, newest, voice, copied, seconds, onCopy, onReplay, onRetry, onDiscard, onStop, onTalkAgain, onTypeInstead }) => {
  const inFlight = ['listening', 'transcribing', 'translating', 'speaking'].includes(turn.phase)
  return (
    <article className={`pg-turn ${newest ? 'is-newest' : ''}`} data-turn-id={turn.id}>
      <div className='pg-turn__gutter'><b>{String(turn.n).padStart(2, '0')}</b><span>{languageByCode(turn.from)?.short}→{languageByCode(turn.to)?.short}</span></div>
      <div className='pg-turn__body'>
        {turn.phase === 'listening' && <p className='pg-listening'>Listening in {turn.fromName} <b>{seconds >= 50 ? 'Stopping at 1:00' : `0:${String(seconds).padStart(2, '0')}`}</b></p>}
        {turn.phase === 'transcribing' && <p className='pg-working'>Working out what you said…</p>}
        {turn.heard && <p className='pg-heard' lang={turn.from} dir='auto'>{turn.heard}</p>}
        {turn.phase === 'translating' && <p className='pg-working'>Translating into {turn.toName}…</p>}
        {turn.said && <p className={`pg-said ${turn.said.length > 64 ? 'is-long' : ''}`} lang={turn.to} dir='auto'>{turn.said}</p>}
        {turn.phase === 'speaking' && <p className='pg-working'>Speaking in <b>{turn.voiceName}</b> <button onClick={onStop}>Stop</button></p>}
        {turn.error === 'speakFailed' && <p className='pg-playback-error'>Couldn’t play your voice. <button onClick={() => onReplay(turn.id)}>Try again</button></p>}
        <TurnProblem turn={turn} onRetry={onRetry} onDiscard={onDiscard} onTalkAgain={onTalkAgain} onTypeInstead={onTypeInstead} />
        {inFlight && <StageRule turn={turn} hasVoice={Boolean(turn.voiceId)} />}
      </div>
      {turn.said && <TurnActions turn={turn} newest={newest} voice={voice} copied={copied} onCopy={onCopy} onReplay={onReplay} />}
    </article>
  )
}

const Empty = ({ from, to, voice }) => <div className='pg-empty'><ProductEmblem id='polyglot' /><h1>Tap Talk and speak {from.name}.</h1><p>Polyglot shows what it heard, translates it into {to.name}{voice ? `, and says it in ${voice.name}.` : '.'}</p>{voice ? <small>This conversation stays only on this screen until you clear or leave it.</small> : <small>Add a cloned voice in Account to hear translations spoken.</small>}</div>

const Instrument = () => {
  const auth = useAuth()
  const online = useOnline()
  const [pair, setPair] = useState(readPair)
  const [voices, setVoices] = useState([])
  const [voiceId, setVoiceId] = useState(readVoice)
  const [open, setOpen] = useState(null)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [copied, setCopied] = useState(null)
  const recordingTurnRef = useRef(null)
  const typeRef = useRef(null)
  const handleVoiceUnavailable = useCallback((unavailableVoiceId) => {
    setVoiceId((selectedId) => selectedId === unavailableVoiceId ? null : selectedId)
    setVoices((items) => items.filter((item) => item.id !== unavailableVoiceId))
    if (readVoice() === unavailableVoiceId) writeVoice(null)
  }, [])
  const turns = useTurns({ api, onSignedOut: auth.refresh, onVoiceUnavailable: handleVoiceUnavailable })
  const recorder = useRecorder({
    onCapture: (blob) => { const id = recordingTurnRef.current; recordingTurnRef.current = null; if (id) turns.processRecording(id, blob).catch(() => {}) },
    onFailure: () => {}
  })
  const from = languageByCode(pair.from)
  const to = languageByCode(pair.to)
  const voice = voices.find((item) => item.id === voiceId) || null
  const showTyping = useCallback(() => {
    setTyping(true)
    requestAnimationFrame(() => typeRef.current?.focus())
  }, [])
  const resizeType = useCallback((textarea = typeRef.current) => {
    if (!textarea) return
    textarea.style.height = '0px'
    const style = getComputedStyle(textarea)
    const lineHeight = Number.parseFloat(style.lineHeight) || 21
    const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0)
    textarea.style.height = `${Math.min(textarea.scrollHeight, lineHeight * 3 + padding)}px`
  }, [])

  useEffect(() => {
    let alive = true
    api.listVoices().then((items) => {
      if (!alive) return
      setVoices(items)
      const selected = items.find((item) => item.id === readVoice()) || items.find((item) => item.isPrimary) || items[0] || null
      setVoiceId(selected?.id || null)
      writeVoice(selected?.id || null)
    }).catch(() => { if (alive) setVoices([]) })
    return () => { alive = false }
  }, [])

  const snapshot = useCallback(() => ({ from: pair.from, to: pair.to, fromName: from.name, toName: to.name, voiceId: voice?.id || null, voiceName: voice?.name || null }), [from.name, pair.from, pair.to, to.name, voice])

  const beginTalk = useCallback(async () => {
    if (!online) return
    if (turns.activeTurn?.phase === 'listening') { recorder.stop(); return }
    if (turns.activeTurn && turns.activeTurn.phase !== 'speaking') return
    if (turns.activeTurn?.phase === 'speaking') turns.stopPlayback(true)
    const id = turns.begin(snapshot())
    recordingTurnRef.current = id
    try { await recorder.start() } catch (error) { recordingTurnRef.current = null; turns.failMicrophone(id, error); showTyping() }
  }, [online, recorder, showTyping, snapshot, turns])

  const cancel = useCallback(() => { recordingTurnRef.current = null; recorder.cancel(); turns.cancel() }, [recorder, turns])
  const clear = useCallback(() => { recordingTurnRef.current = null; recorder.cancel(); turns.clear() }, [recorder, turns])
  const submitTyped = () => {
    const text = draft.trim()
    if (!text || !online || turns.activeTurn) return
    turns.beginTyped(snapshot(), text)
    setDraft('')
  }
  const choosePair = (side, code) => {
    let next = { ...pair, [side]: code }
    if (next.from === next.to) next = { from: pair.to, to: pair.from }
    setPair(next); writePair(next)
  }
  const swap = () => { const next = { from: pair.to, to: pair.from }; setPair(next); writePair(next) }
  const chooseVoice = (id) => { setVoiceId(id); writeVoice(id) }
  const copy = async (id) => {
    const turn = turns.turns.find((item) => item.id === id)
    if (!turn?.said) return
    try { await navigator.clipboard.writeText(turn.said); setCopied(id); setTimeout(() => setCopied((value) => value === id ? null : value), 1600) } catch {}
  }
  const replay = (id) => turns.replay(id, voice?.id)
  useEffect(() => { if (typing) resizeType() }, [draft, resizeType, typing])

  useEffect(() => {
    const key = (event) => {
      const editable = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      if (event.key === 'Escape' && turns.activeTurn) { event.preventDefault(); cancel() } else if (event.code === 'Space' && !editable && !open) { event.preventDefault(); beginTalk().catch(() => {}) }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [beginTalk, cancel, open, turns.activeTurn])

  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') cancel() }
    const leave = () => cancel()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', leave)
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leave) }
  }, [cancel])

  useEffect(() => () => { recorder.cancel(); turns.clear() }, []) // deliberate one-time teardown

  const latestId = turns.turns.at(-1)?.id
  const busy = turns.activeTurn && ['transcribing', 'translating'].includes(turns.activeTurn.phase)
  const talkLabel = turns.activeTurn?.phase === 'listening' ? `Stop 0:${String(recorder.seconds).padStart(2, '0')}` : busy ? (turns.activeTurn.phase === 'transcribing' ? 'Transcribing…' : 'Translating…') : `Speak ${from.name}`

  return (
    <div className='pg-app'><AppBar /><main className='pg-log' id='conversation-log'>
      <div className='pg-log__column'>{turns.turns.length > 0 && <header className='pg-log-head'><span>This conversation <b>· Not saved</b></span><button onClick={clear}>Clear</button></header>}
        <div className='pg-log__fill'>{turns.turns.length === 0 ? <Empty from={from} to={to} voice={voice} /> : turns.turns.map((turn) => <Turn key={turn.id} turn={turn} newest={turn.id === latestId} voice={voice} copied={copied === turn.id} seconds={recorder.seconds} onCopy={copy} onReplay={replay} onRetry={turns.retry} onDiscard={turns.discard} onStop={turns.stopPlayback} onTalkAgain={() => beginTalk().catch(() => {})} onTypeInstead={showTyping} />)}</div>
      </div>
    </main><footer className='pg-dock'><div className='pg-dock__inner'>
      {!online && <div className='pg-offline'><Icon name='offline' />You’re offline. Polyglot needs a connection to listen and translate.</div>}
      <div className='pg-pair'><LanguagePicker side='from' value={pair.from} open={open === 'from'} onOpen={() => setOpen(open === 'from' ? null : 'from')} onClose={() => setOpen(null)} onPick={(code) => choosePair('from', code)} /><button className='pg-swap' onClick={swap} aria-label={`Swap languages. Speak ${to.name} into ${from.name}`}><Icon name='swap' /></button><LanguagePicker side='to' value={pair.to} open={open === 'to'} onOpen={() => setOpen(open === 'to' ? null : 'to')} onClose={() => setOpen(null)} onPick={(code) => choosePair('to', code)} /><div className='pg-spacer' /><VoicePicker voices={voices} value={voiceId} open={open === 'voice'} onOpen={() => setOpen(open === 'voice' ? null : 'voice')} onClose={() => setOpen(null)} onPick={chooseVoice} /></div>
      <div className={`pg-drive ${typing ? 'is-typing' : ''}`}><button className='pg-type-toggle' onClick={showTyping} aria-label='Type instead'><Icon name='keyboard' /></button><div className='pg-type'><textarea ref={typeRef} rows='1' value={draft} placeholder={`Or type in ${from.name}…`} disabled={!online || Boolean(turns.activeTurn)} onFocus={() => setTyping(true)} onChange={(event) => { setDraft(event.target.value); resizeType(event.target) }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitTyped() } }} /><button onClick={submitTyped} disabled={!draft.trim() || !online || Boolean(turns.activeTurn)} aria-label='Translate typed text'><Icon name='send' /></button></div><button className='pg-talk' onClick={beginTalk} disabled={!online} aria-disabled={Boolean(busy)} aria-pressed={turns.activeTurn?.phase === 'listening'} aria-label={turns.activeTurn?.phase === 'listening' ? 'Stop and translate' : busy ? talkLabel : `Start speaking ${from.name}`}>{busy ? <i className='pg-spinner' aria-hidden='true' /> : <Icon name={turns.activeTurn?.phase === 'listening' ? 'stop' : 'mic'} />}<span>{talkLabel}</span>{turns.activeTurn?.phase === 'listening' && <i className='pg-level' aria-hidden='true'><b /><b /><b /><b /><b /></i>}</button></div>
      {turns.activeTurn && <div className='pg-cancel'><button onClick={cancel}>Cancel</button></div>}
      <p className='pg-hints'>Space talk · Esc cancel · Enter translate typed text</p>
    </div></footer><div className='pg-sr' aria-live='polite'>{copied ? 'Copied' : turns.announcement}</div></div>
  )
}

const NotFound = () => <div className='pg-page'><AppBar /><main className='pg-lost'><h1>Nothing here.</h1><p>That page doesn’t exist. Polyglot lives on one screen.</p><a className='br-button br-button--ghost' href='/'>Open Polyglot</a></main></div>

const AuthBoundary = ({ children }) => {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === AUTH_STATUS.LOADING) return <main className='pg-auth-loading' aria-label='Checking sign-in status' />
  if (auth.status === AUTH_STATUS.ANONYMOUS) return location.pathname === '/' || location.pathname === '/instant' ? <Welcome /> : <NotFound />
  return children
}

export const App = () => <BrowserRouter><AuthBoundary><Routes><Route path='/' element={<Instrument />} /><Route path='/instant' element={<Navigate to='/' replace />} /><Route path='*' element={<NotFound />} /></Routes></AuthBoundary></BrowserRouter>

export { Instrument, StageRule, TurnActions }
