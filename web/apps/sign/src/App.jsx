import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AccountMenu, AppSwitcher, BrandLink, ProductEmblem, resolveDestinations } from '@bakerrang/web-app-shell'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { Button, IconButton } from '@bakerrang/web-ui'
import logoUrl from '../../polyglot/src/assets/bakerrang-logo.png'
import { handshapes, handshapeById } from './vision/handshapes.js'
import { createHold } from './vision/hold.js'
import { useCamera } from './useCamera.js'

const destinations = resolveDestinations(import.meta.env)
const DEAD = 'D M N P Q R S T U'

const Icon = ({ name, className = '' }) => {
  const paths = {
    alert: <><path d='M12 4 2.8 19.5h18.4z' /><path d='M12 10v4.2M12 17h.01' /></>,
    camera: <><rect x='3' y='6.5' width='18' height='13' rx='2' /><path d='m8 6.5 1.4-2h5.2l1.4 2' /><circle cx='12' cy='13' r='3.2' /></>,
    cameraOff: <><path d='M4.5 7.8A2 2 0 0 0 3 9.7v7.8a2 2 0 0 0 2 2h12.7M9 6.5l.8-2h4.4l1 2H19a2 2 0 0 1 2 2v7.7M3 3l18 18' /></>,
    check: <path d='m5 12.5 4.5 4.5L19 7.5' />,
    chevron: <path d='m7 14 5-5 5 5' />,
    close: <path d='M6 6l12 12M18 6 6 18' />,
    device: <><rect x='5' y='2.5' width='14' height='19' rx='2' /><path d='M10 18.5h4' /></>,
    hand: <path d='M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5V4a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.8a6 6 0 0 1-5.1-2.8L3.6 14a1.5 1.5 0 0 1 2.5-1.6L8 15' />,
    mirror: <><path d='M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6M9.5 12.5 6 16l3.5 3.5' /></>,
    stop: <rect x='6.5' y='6.5' width='11' height='11' rx='1.5' fill='currentColor' stroke='none' />
  }
  return <svg className={`sg-icon ${className}`.trim()} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.75' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>{paths[name]}</svg>
}

const GoogleIcon = () => <svg className='sg-google' viewBox='0 0 24 24' aria-hidden='true'><path fill='currentColor' d='M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1-.8 2.6-2.3 3.6l3.6 2.8c2.1-2 3.7-4.9 3.7-8.3zM12 24c3.2 0 5.9-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.3 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2l-3.7 2.9C3.2 21.3 7.3 24 12 24zM4.9 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.8C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.2l3.7-2.9zM12 4.8c1.8 0 3 .8 3.7 1.4l2.7-2.7C16.9 1.9 14.4.9 12 .9 7.3.9 3.2 3.6 1.2 6.8l3.7 2.9C5.9 6.7 8.7 4.8 12 4.8z' /></svg>

const AppBar = ({ signedIn }) => {
  const auth = useAuth()
  const handleLogin = () => auth.login()
  return (
    <header className='sg-bar'>
      <div className='sg-bar__inner'>
        <BrandLink logoSrc={logoUrl} launcherUrl={destinations.launcher.url} appName='Sign' appUrl='/' />
        <div className='sg-spacer' />
        {signedIn
          ? <div className='sg-chrome'><AppSwitcher destinations={destinations} current='sign' /><AccountMenu destinations={destinations} themeControl /></div>
          : <Button variant='ghost' size='small' onClick={handleLogin}><GoogleIcon />Sign in</Button>}
      </div>
    </header>
  )
}

const CropMarks = ({ dim = false, locked = false }) => <div className={`sg-crop ${dim ? 'is-dim' : ''} ${locked ? 'is-locked' : ''}`.trim()} aria-hidden='true'><i /><i /><i /><i /></div>

const ExampleHand = () => (
  <svg className='sg-example-hand' viewBox='0 0 1000 563' preserveAspectRatio='xMidYMid slice' aria-hidden='true'>
    <rect width='1000' height='563' fill='#1b1a18' />
    <rect y='350' width='1000' height='213' fill='#191816' />
    <path d='M80 563C120 385 300 342 402 332h196c108 10 286 53 332 231Z' fill='#221f1c' />
    <ellipse cx='500' cy='205' rx='84' ry='106' fill='#24211e' />
    <path d='M440 563 432 383c0-45 31-82 74-88l31-5v-178c0-25 20-45 45-45s45 20 45 45v235l88-2c24-1 45 18 45 42s-18 44-42 45l-149 6v125Z' fill='#57504a' />
    <path d='M466 563 460 392c-2-35 21-66 55-73l43-9v253Z' fill='#4c4640' opacity='.72' />
    <g fill='none' stroke='rgba(255,255,255,.78)' strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M536 488 535 366 581 290 582 216 582 112' />
      <path d='M535 366 610 389 660 388 714 387' />
      <path d='M535 366 575 369 612 370' /><path d='M535 366 565 398 590 420' />
    </g>
    <g fill='#fff'>{[[536, 488], [535, 366], [581, 290], [582, 216], [582, 112], [610, 389], [660, 388], [714, 387], [575, 369], [612, 370], [565, 398], [590, 420]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r='6' />)}</g>
    <g><rect x='548' y='38' width='76' height='58' rx='5' fill='#0c0b0a' stroke='#fff' strokeWidth='2.5' /><text x='576' y='77' fill='#fff' fontFamily='Archivo Expanded, Archivo, sans-serif' fontWeight='800' fontSize='34'>L</text><path d='m596 67 7 7 14-16' fill='none' stroke='#fff' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' /></g>
  </svg>
)

const Rail = ({ active = false, example = false }) => (
  <div className='sg-rail'>
    <span className='sg-rail__lit'><i className={`sg-rec ${active ? '' : 'is-off'}`} />{active ? 'Camera on' : 'Camera off'}</span>
    <span className='sg-rail__divider' aria-hidden='true' />
    <span className='sg-rail__lit'><Icon name='mirror' />Mirror</span>
    <span className='sg-spacer' />
    {example ? <span className='sg-example-tag'>Example</span> : <span className='sg-rail__lit'><Icon name='device' /><span className='sg-long'>Stays on this device</span><span className='sg-short'>On device</span></span>}
  </div>
)

const Caption = ({ glyph, name, meta, side, held = false, quiet = false }) => (
  <div className='sg-caption' aria-hidden='true'>
    <div className={`sg-caption__glyph ${glyph?.length > 1 ? 'is-long' : ''} ${glyph ? '' : 'is-none'}`.trim()}>{glyph || <Icon name='hand' />}</div>
    <div className='sg-caption__text'><div className={`sg-caption__name ${quiet ? 'is-quiet' : ''}`}>{name}</div><div className='sg-caption__meta'>{meta}</div></div>
    <div className={`sg-caption__side ${held ? 'is-held' : ''}`.trim()}>{held && <Icon name='check' />}<span>{side}</span></div>
  </div>
)

const Welcome = () => {
  const auth = useAuth()
  const handleLogin = () => auth.login()
  return (
    <div className='sg-page sg-page--welcome'>
      <AppBar signedIn={false} />
      <main className='sg-welcome'>
        <section className='sg-welcome__copy'>
          <h1>Hold up a handshape. Sign reads it.</h1>
          <p className='sg-lead'>Practise the ASL handshapes with your camera. Sign shows what it reads at your hand, and tells you when you’re holding the one you’re practising.</p>
          <Button className='sg-welcome__button' variant='gold' onClick={handleLogin}><GoogleIcon />Sign in with Google</Button>
          <p className='sg-fine'><Icon name='device' /><span>Sign reads your hand on this device. No video or images leave your browser.</span></p>
          <p className='sg-cover'>Reads 20 handshapes: 17 letters of the manual alphabet, 1, 5 and I love you. It can’t read <span>{DEAD}</span> yet, and it isn’t an interpreter.</p>
        </section>
        <section className='sg-example' aria-label='Example: Sign reading the letter L'>
          <div className='sg-finder sg-finder--example'><Rail active example /><div className='sg-well'><div className='sg-plate'><ExampleHand /><CropMarks locked /></div></div><Caption glyph='L' name='Letter L' meta='Target L · held for 1.2 s' side='Held' held /></div>
          <p>Drawn example. In the app, this is your own camera, mirrored.</p>
        </section>
      </main>
    </div>
  )
}

const cameraCopy = {
  off: ['Hold your hand up to the camera and Sign reads the handshape.', 'Your camera stays on this device. Sign sends no video or images anywhere.'],
  loading: ['Loading the hand reader…', 'The first start downloads about 20 MB. Later starts are quicker.'],
  permission: ['Waiting for camera permission…', 'Allow camera access in your browser to begin.'],
  denied: ['Sign can’t see your camera.', 'Allow camera access for sign.bakerrang.com in your browser settings, then try again.'],
  noCamera: ['No camera found on this device.', 'Sign needs a camera to read your hand.'],
  cameraBusy: ['Your camera is being used by another app.', 'Close the other app, then try again.'],
  unsupported: ['This browser can’t share a camera with Sign.', 'Try a current version of Chrome, Edge or Safari.'],
  readerFailed: ['Sign couldn’t start its hand reader on this device.', 'Check your connection and try again.'],
  cameraLost: ['The camera stopped.', 'Reconnect it, then try again.'],
  paused: ['Camera paused while Sign was in the background.', 'Start it again when you’re ready.']
}

const IdlePlate = ({ state }) => {
  const [title, detail] = cameraCopy[state] || cameraCopy.off
  const loading = state === 'loading' || state === 'permission'
  const problem = !['off', 'loading', 'permission'].includes(state)
  return <div className='sg-idle'>{state === 'off' && <ProductEmblem id='sign' className='sg-idle__emblem' />}{loading && <span className='sg-spinner' />}{problem && <Icon name={state === 'noCamera' || state === 'cameraBusy' ? 'cameraOff' : 'alert'} className='sg-idle__alert' />}<p>{title}</p>{loading && <div className='sg-steps'><b>Reader</b><span>Camera</span></div>}<small>{detail}</small></div>
}

const Picker = ({ open, setOpen, target, held, onSelect, onClear, triggerRef }) => {
  const gridRef = useRef(null)
  const [active, setActive] = useState(target || 'A')
  const [position, setPosition] = useState({})
  const typeAhead = useRef('')
  const activeShape = handshapeById(active) || handshapes[0]
  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 400)), bottom: window.innerHeight - rect.top + 8 })
  }, [triggerRef])
  useLayoutEffect(() => {
    if (!open) return undefined
    setActive(target || 'A'); place(); requestAnimationFrame(() => gridRef.current?.focus())
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, place, target])
  const close = useCallback(() => { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()) }, [setOpen, triggerRef])
  const move = delta => {
    const index = Math.max(0, handshapes.findIndex(shape => shape.id === active))
    setActive(handshapes[Math.max(0, Math.min(handshapes.length - 1, index + delta))].id)
  }
  const onKeyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); onClear(); close(); return }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(active); close(); return }
    const directions = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 5, ArrowUp: -5 }
    if (directions[event.key]) { event.preventDefault(); move(directions[event.key]); return }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setActive(event.key === 'Home' ? handshapes[0].id : handshapes.at(-1).id); return }
    if (event.key.length === 1) {
      typeAhead.current += event.key.toUpperCase()
      const match = handshapes.find(shape => shape.id.startsWith(typeAhead.current))
      if (match) setActive(match.id)
      window.clearTimeout(typeAhead.timer); typeAhead.timer = window.setTimeout(() => { typeAhead.current = '' }, 600)
    }
  }
  return (
    <>
      {open && <button className='sg-scrim' aria-label='Close handshape picker' onClick={close} />}
      <div className={`sg-picker ${open ? 'is-open' : ''}`} style={position} role='dialog' aria-modal={false} aria-labelledby='sg-picker-title'>
        <div className='sg-picker__head'><h2 id='sg-picker-title'>Handshapes Sign reads</h2><span><b>{held.length}</b> of 20 held</span><IconButton className='sg-picker__close' aria-label='Close' onClick={close}><Icon name='close' /></IconButton></div>
        <div ref={gridRef} className='sg-picker__grid' role='listbox' tabIndex='0' aria-activedescendant={`sg-shape-${active}`} onKeyDown={onKeyDown}>
          {handshapes.map(shape => <button id={`sg-shape-${shape.id}`} key={shape.id} className={`${shape.id === active ? 'is-active' : ''} ${shape.glyph.length > 1 ? 'is-long' : ''}`} role='option' aria-selected={shape.id === target} onPointerMove={() => setActive(shape.id)} onClick={() => { onSelect(shape.id); close() }}><span>{shape.glyph}</span>{held.includes(shape.id) && <Icon name='check' className='sg-picker__tick' />}{shape.motion && <small>move</small>}</button>)}
        </div>
        <div className='sg-picker__desc'><b>{activeShape.name}{held.includes(activeShape.id) ? ' · held' : ''}</b><p>{activeShape.howTo}</p></div>
        <p className='sg-picker__foot'><strong>Can’t read yet:</strong> <span>{DEAD}</span>. Sign reads one hand at a time. It’s a practice aid, not an interpreter.</p>
      </div>
    </>
  )
}

const HoldRule = ({ target, progress, motion }) => {
  if (motion) return <p className='sg-motion-note'>Held the moment Sign sees the motion.</p>
  const filled = Math.floor(progress * 12)
  return <div className='sg-hold-rule' role='progressbar' aria-label={`Hold ${handshapeById(target)?.name || 'the target'}`} aria-valuemin='0' aria-valuemax='100' aria-valuenow={Math.round(progress * 100)}>{Array.from({ length: 12 }, (_, index) => <i key={index} className={index < filled ? 'is-on' : ''} />)}</div>
}

const Finder = () => {
  const video = useRef(null); const canvas = useRef(null); const trigger = useRef(null)
  const [target, setTarget] = useState(null); const [held, setHeld] = useState([]); const [progress, setProgress] = useState(0)
  const [announcement, setAnnouncement] = useState(''); const [locked, setLocked] = useState(false); const [pickerOpen, setPickerOpen] = useState(false)
  const hold = useRef(createHold()); const lastReading = useRef(null); const lockTimer = useRef(null)
  const onReading = useCallback(reading => { lastReading.current = reading; setAnnouncement(reading ? `Reading: ${handshapeById(reading)?.name || reading}` : 'No hand in view') }, [])
  const camera = useCamera({ videoRef: video, canvasRef: canvas, onReading })
  useEffect(() => {
    let frame
    const tick = now => {
      const shape = handshapeById(target)
      const state = hold.current(target, lastReading.current, now, Boolean(shape?.motion))
      setProgress(previous => previous === state.progress ? previous : state.progress)
      if (state.changed && shape) {
        setHeld(values => values.includes(target) ? values : [...values, target])
        setAnnouncement(`Held: ${shape.name}`)
        requestAnimationFrame(() => setLocked(true))
        window.clearTimeout(lockTimer.current); lockTimer.current = window.setTimeout(() => setLocked(false), 900)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])
  useEffect(() => () => { window.clearTimeout(lockTimer.current); camera.stop() }, [camera.stop])
  const selected = handshapeById(target); const reading = handshapeById(camera.reading); const onTarget = Boolean(target && camera.reading === target)
  const isHeld = Boolean(target && held.includes(target) && progress === 1); const cameraOn = camera.state === 'on'; const busy = camera.state === 'loading' || camera.state === 'permission'
  const cameraLabel = cameraOn ? 'Stop camera' : busy ? 'Starting…' : camera.state === 'off' ? 'Start camera' : 'Try again'
  const caption = !cameraOn
    ? { name: camera.state === 'off' ? 'Camera off' : cameraCopy[camera.state]?.[0] || 'Camera off', meta: busy ? 'Reader · Camera' : 'Start the camera when you’re ready', quiet: true }
    : reading ? { glyph: reading.glyph, name: reading.name, meta: onTarget ? 'Reading · on target' : 'Reading · steady' } : { name: 'No hand in view', meta: 'Hold one hand inside the marks', quiet: true }
  const side = !target ? 'Choose a target to practise' : isHeld ? 'Held' : onTarget ? 'On target' : `Target ${selected.glyph} · not yet`
  const clearTarget = () => { setTarget(null); setProgress(0); hold.current(null, null, performance.now(), false); requestAnimationFrame(() => trigger.current?.focus()) }
  const selectTarget = id => { setTarget(id); setProgress(0); hold.current(id, null, performance.now(), Boolean(handshapeById(id)?.motion)) }
  const nextTarget = () => {
    const next = handshapes[(handshapes.findIndex(shape => shape.id === target) + 1) % handshapes.length]
    selectTarget(next.id)
  }
  return (
    <div className='sg-app'>
      <AppBar signedIn />
      <main className='sg-stage'>
        <div className='sg-stage__col'>
          <section className='sg-finder' aria-label='Camera, mirrored. Not recorded.'>
            <Rail active={cameraOn} />
            <div className='sg-well'><div className='sg-plate sg-plate--live'><video ref={video} muted playsInline aria-hidden='true' /><canvas ref={canvas} aria-hidden='true' />{!cameraOn && <IdlePlate state={camera.state} />}<CropMarks dim={!cameraOn} locked={locked} /></div></div>
            <Caption {...caption} side={side} held={isHeld} />
          </section>
        </div>
      </main>
      <section className='sg-target-line'>
        <div className='sg-target-line__inner'>
          <div className='sg-target-row'>
            <button ref={trigger} className='sg-target-trigger' aria-haspopup='dialog' aria-expanded={pickerOpen} onClick={() => setPickerOpen(value => !value)}><span className={`sg-target-trigger__glyph ${selected?.glyph.length > 1 ? 'is-long' : ''}`}>{selected ? selected.glyph : <Icon name='hand' />}</span><span className='sg-target-trigger__text'><small>Target</small><b>{selected ? selected.name : 'Choose a handshape'}</b></span><Icon name='chevron' /></button>
            <p className='sg-howto'>{selected ? selected.howTo : 'Pick one of the 20 handshapes Sign reads, then hold it until Sign says Held.'}</p>
            <IconButton className={`sg-clear ${target ? '' : 'is-hidden'}`} aria-label='Clear target' onClick={clearTarget} tabIndex={target ? 0 : -1}><Icon name='close' /></IconButton>
          </div>
          <div className='sg-hold-row'>
            <HoldRule target={target} progress={progress} motion={selected?.motion} />
            <span className={`sg-hold-state ${isHeld ? 'is-held' : ''}`}>{isHeld && <Icon name='check' />}{!target ? 'Reading only' : isHeld ? 'Held' : selected?.motion ? 'Not yet' : onTarget ? 'Hold it…' : 'Make the shape'}</span>
            <span className='sg-hold-slot'>{isHeld ? <Button className='sg-next' variant='ghost' size='small' onClick={nextTarget}>Next handshape</Button> : <span className='sg-tally'><b>{held.length}</b> of 20 held<span> this session</span></span>}</span>
            <button className='sg-link' onClick={() => setPickerOpen(true)}>What Sign reads</button>
          </div>
          <div className='sg-key-slot'><button className='sg-camera-key' onClick={() => cameraOn ? camera.stop() : camera.start()} aria-disabled={busy}>{busy ? <span className='sg-spinner' /> : <Icon name={cameraOn ? 'stop' : 'camera'} />}{cameraLabel}</button></div>
        </div>
      </section>
      <Picker open={pickerOpen} setOpen={setPickerOpen} target={target} held={held} onSelect={selectTarget} onClear={clearTarget} triggerRef={trigger} />
      <div className='sg-sr' aria-live='polite'>{announcement}</div>
    </div>
  )
}

const Boundary = () => {
  const auth = useAuth()
  if (auth.status === AUTH_STATUS.LOADING) return <main className='sg-loading' aria-label='Checking sign-in status'><span className='sg-spinner' /></main>
  return auth.status === AUTH_STATUS.ANONYMOUS ? <Welcome /> : <Finder />
}

export const App = () => <Boundary />
