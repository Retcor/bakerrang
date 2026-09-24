/* eslint-disable react/jsx-handler-names, react/jsx-closing-tag-location, react/jsx-indent */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AccountMenu, AppSwitcher, BrandLink, ProductEmblem, resolveDestinations } from '@bakerrang/web-app-shell'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { Button, IconButton, useDismiss } from '@bakerrang/web-ui'
import logoUrl from './assets/bakerrang-logo.png'
import { useStories } from './state/StoriesProvider.jsx'
import { useStoryGeneration } from './state/useStoryGeneration.js'
import { useNarration } from './state/useNarration.js'
import { getReadingPosition, setReadingPosition } from './state/readingPosition.js'
import { cleanStoryText } from './text.js'

const destinations = resolveDestinations(import.meta.env)

const Icon = ({ name }) => {
  const paths = {
    back: <><path d='M19 12H5' /><path d='M11 6l-6 6 6 6' /></>,
    left: <path d='M15 5l-7 7 7 7' />,
    right: <path d='M9 5l7 7-7 7' />,
    plus: <><path d='M12 5v14' /><path d='M5 12h14' /></>,
    more: <><circle cx='5' cy='12' r='1.2' /><circle cx='12' cy='12' r='1.2' /><circle cx='19' cy='12' r='1.2' /></>,
    speaker: <><path d='M4 9.5h3.5L12 5.5v13l-4.5-4H4z' /><path d='M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11' /></>,
    pause: <><path d='M8.5 5.5v13' /><path d='M15.5 5.5v13' /></>,
    pencil: <><path d='M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z' /><path d='M14 7l3 3' /></>,
    trash: <><path d='M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13' /><path d='M10 11v6M14 11v6' /></>,
    check: <path d='M5 12.5l4.5 4.5L19 7.5' />,
    close: <><path d='M6 6l12 12' /><path d='M18 6L6 18' /></>
  }
  return <svg className='sb-icon' viewBox='0 0 24 24' aria-hidden='true'>{paths[name]}</svg>
}

const GoogleIcon = () => <svg className='sb-google' viewBox='0 0 24 24' aria-hidden='true'><path fill='currentColor' d='M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1-.8 2.6-2.3 3.6l3.6 2.8c2.1-2 3.7-4.9 3.7-8.3zM12 24c3.2 0 5.9-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.3 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2l-3.7 2.9C3.2 21.3 7.3 24 12 24zM4.9 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.8C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.2l3.7-2.9zM12 4.8c1.8 0 3 .8 3.7 1.4l2.7-2.7C16.9 1.9 14.4.9 12 .9 7.3.9 3.2 3.6 1.2 6.8l3.7 2.9C5.9 6.7 8.7 4.8 12 4.8z' /></svg>

const AppBar = ({ signedIn = true }) => {
  const auth = useAuth()
  return (
    <header className='sb-appbar'>
      <div className='sb-appbar__inner'>
        <BrandLink logoSrc={logoUrl} launcherUrl={destinations.launcher.url} appName='Story Book' appUrl='/' />
        <div className='sb-spacer' />
        {signedIn
          ? <div className='sb-chrome'><AppSwitcher destinations={destinations} current='storybook' /><AccountMenu destinations={destinations} themeControl /></div>
          : <Button variant='ghost' size='small' onClick={auth.login}><GoogleIcon />Sign in</Button>}
      </div>
    </header>
  )
}

export const AuthBoundary = ({ children }) => {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (auth.status !== AUTH_STATUS.AUTHENTICATED || location.pathname !== '/') return
    try {
      const returnTo = sessionStorage.getItem('sb.return')
      if (returnTo && returnTo !== '/') {
        sessionStorage.removeItem('sb.return')
        navigate(returnTo, { replace: true })
      }
    } catch {}
  }, [auth.status, location.pathname, navigate])

  if (auth.status === AUTH_STATUS.LOADING) return <main className='sb-auth-loading' aria-label='Checking sign-in status' />
  if (auth.status === AUTH_STATUS.ANONYMOUS) {
    const knownRoute = location.pathname === '/' || location.pathname === '/new' || /^\/story\/[^/]+(?:\/[^/]+)?$/.test(location.pathname)
    if (!knownRoute) return <NotFound />
    if (location.pathname !== '/') {
      try { sessionStorage.setItem('sb.return', `${location.pathname}${location.search}`) } catch {}
    }
    return <Welcome />
  }
  return children
}

const Welcome = () => {
  const auth = useAuth()
  return (
    <div className='sb-page sb-page--paper'><AppBar signedIn={false} /><main className='sb-stage sb-stage--single'><div className='sb-spread sb-welcome'>
      <section className='sb-pageleaf sb-pageleaf--verso'><div className='sb-running'>An example page</div><div className='sb-welcome-art' aria-label='An open book waiting for a story'><ProductEmblem id='storybook' /></div><div className='sb-folio'>1</div></section>
      <div className='sb-gutter' />
      <section className='sb-pageleaf sb-pageleaf--recto'><div className='sb-running' /><div className='sb-storytext'><h1>Type an idea. Read the story it becomes.</h1><p>Story Book writes a short story from a single idea, draws a picture for every page, and keeps it in your private library.</p><p>Any page can be read aloud in a voice you’ve cloned in your BakerRang account.</p><Button variant='gold' onClick={auth.login}><GoogleIcon />Sign in with Google</Button></div><p className='sb-fine'>Part of BakerRang. <a href={destinations.launcher.url}>See all the tools</a></p></section>
    </div>
    </main>
    </div>
  )
}

const formatDate = (iso, long = false) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.valueOf())) return ''
  return date.toLocaleDateString('en-US', long ? { month: 'long', day: 'numeric', year: 'numeric' } : { day: 'numeric', month: 'short' })
}

const StoryMenu = ({ story, onRename, onDelete }) => {
  const [open, setOpen] = useState(false)
  const dismiss = useCallback(() => setOpen(false), [])
  const ref = useDismiss({ open, onDismiss: dismiss })
  return (
    <div className={`sb-menu ${open ? 'is-open' : ''}`} ref={ref}>
      <IconButton className='sb-menu__trigger' aria-label={`Options for ${story.title}`} aria-expanded={open} aria-haspopup='true' onClick={() => setOpen(!open)}><Icon name='more' /></IconButton>
      <div className='sb-popover' role='menu'>
        <button role='menuitem' onClick={() => { setOpen(false); onRename() }}><Icon name='pencil' />Rename</button>
        <div className='sb-popover__rule' />
        <button className='is-danger' role='menuitem' onClick={() => { setOpen(false); onDelete() }}><Icon name='trash' />Delete story</button>
      </div>
    </div>
  )
}

const RenameField = ({ story, onCancel, onSave }) => {
  const [title, setTitle] = useState(story.title)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  const submit = async (event) => {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try { await onSave(title); onCancel() } finally { setSaving(false) }
  }
  return <form className='sb-rename' onSubmit={submit}><label className='sb-sr' htmlFor={`rename-${story.id}`}>Story title</label><input ref={inputRef} id={`rename-${story.id}`} value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /><Button variant='ghost' size='small' disabled={saving || !title.trim()}>Save</Button><button type='button' className='sb-quiet' onClick={onCancel}>Cancel</button></form>
}

const ConfirmDialog = ({ story, onCancel, onConfirm }) => {
  const cancelRef = useRef(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const close = (event) => { if (event.key === 'Escape') onCancel() }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onCancel])
  return (
    <div className='sb-scrim' onPointerDown={onCancel}><div className='sb-dialog' role='alertdialog' aria-modal='true' aria-labelledby='delete-title' aria-describedby='delete-description' onPointerDown={(event) => event.stopPropagation()}>
      <h2 id='delete-title'>Delete <q>{story.title}</q>?</h2><p id='delete-description'>This removes the story and its pictures from your library. It can’t be undone.</p><div className='sb-dialog__actions'><Button ref={cancelRef} variant='ghost' onClick={onCancel}>Keep it</Button><button className='sb-danger-button' onClick={onConfirm}>Delete story</button></div>
    </div>
    </div>
  )
}

const Library = () => {
  const { stories, status, error, loadStories, renameStory, deleteStory } = useStories()
  const [renaming, setRenaming] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [notice, setNotice] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!location.state?.deleted) return
    setNotice(`Deleted “${location.state.deleted}”.`)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const remove = async () => {
    const title = deleting.title
    await deleteStory(deleting.id)
    setDeleting(null)
    setNotice(`Deleted “${title}”.`)
  }

  let content
  if (status === 'loading' || status === 'idle') content = <div aria-busy='true' aria-label='Loading your stories'>{Array.from({ length: 4 }, (_, index) => <div className='sb-skeleton' key={index}><i /><span><i /><i /></span></div>)}</div>
  else if (status === 'error') content = <div className='sb-empty' role='alert'><h2>Your stories didn’t load.</h2><p>{error?.message || 'Check your connection, then try again. Nothing has been lost.'}</p><Button variant='ghost' onClick={loadStories}>Try again</Button></div>
  else if (!stories.length) content = <div className='sb-empty'><ProductEmblem id='storybook' /><h2>Nothing here yet.</h2><p>Every story you write is listed here, like the contents of a book. Start with a single idea.</p><Link className='br-button br-button--gold' to='/new'><Icon name='plus' />Begin your first story</Link></div>
  else {
    content = (
      <ol className='sb-contents-list'>{stories.map((story) => {
        const position = getReadingPosition(story.id)
        return (
          <li className='sb-entry' key={story.id}>
            {renaming !== story.id && <Link className='sb-entry__link' to={`/story/${story.id}/${position || 1}`} aria-label={`${story.title}${position ? `, continue from page ${position}` : ''}`} />}
            <div className={`sb-thumb ${story.thumbnail ? '' : 'sb-thumb--type'}`}>{story.thumbnail ? <img src={`data:image/jpeg;base64,${story.thumbnail}`} alt='' width='64' height='64' loading='lazy' decoding='async' /> : story.title.slice(0, 1)}{position && <span className='sb-ribbon' aria-hidden='true' />}</div>
            <div className='sb-entry__body'>{renaming === story.id
              ? <RenameField story={story} onCancel={() => setRenaming(null)} onSave={(title) => renameStory(story.id, title)} />
              : <><div className='sb-entry__top'><span className='sb-entry__title'>{story.title}</span><span className='sb-leader' /><span className='sb-entry__meta'>{position && <><b>Stopped at p. {position}</b> · </>}{story.pageCount} pp · {formatDate(story.createdAt)}</span></div><p className='sb-entry__excerpt'>{story.excerpt}</p></>}
            </div>
            {renaming !== story.id && <StoryMenu story={story} onRename={() => setRenaming(story.id)} onDelete={() => setDeleting(story)} />}
          </li>
        )
      })}
      </ol>
    )
  }

  return <div className='sb-page'><AppBar /><main className='sb-desk'><article className='sb-leaf' aria-labelledby='stories-title'><header className='sb-contents-head'><div><h1 id='stories-title'>Stories</h1><p>{status === 'ready' ? `${stories.length || 'No'} ${stories.length === 1 ? 'story' : 'stories'}${stories.length ? ' · newest first' : ' yet'}` : 'Loading…'}</p></div>{stories.length > 0 && <Link className='br-button br-button--gold sb-library-action' to='/new'><Icon name='plus' />Begin a new story</Link>}</header>{notice && <div className='sb-status' role='status'>{notice}<IconButton aria-label='Dismiss' onClick={() => setNotice(null)}><Icon name='close' /></IconButton></div>}{content}</article></main>{stories.length > 0 && <div className='sb-mobile-action'><Link className='br-button br-button--gold' to='/new'><Icon name='plus' />Begin a new story</Link></div>}{deleting && <ConfirmDialog story={deleting} onCancel={() => setDeleting(null)} onConfirm={remove} />}</div>
}

const GenerationSteps = ({ state }) => {
  const drawingDone = state.done.filter(Boolean).length
  const stage = (name) => {
    if (name === 'writing') return state.phase === 'writing' ? 'now' : ['drawing', 'saving', 'saved', 'saveFailed'].includes(state.phase) ? 'done' : state.phase === 'writeFailed' ? 'error' : 'wait'
    if (name === 'drawing') return state.phase === 'drawing' ? 'now' : ['saving', 'saved', 'saveFailed'].includes(state.phase) ? 'done' : 'wait'
    return state.phase === 'saving' ? 'now' : state.phase === 'saved' ? 'done' : state.phase === 'saveFailed' ? 'error' : 'wait'
  }
  const rows = [
    ['writing', 'Writing the story', state.phase === 'writing' ? 'Usually under half a minute.' : state.total ? `Written — ${state.total} pages.` : ''],
    ['drawing', 'Drawing the pictures', state.phase === 'drawing' ? `${drawingDone} of ${state.total} ready. Pages are drawn at the same time.` : state.total ? `Finished ${state.total} pages.` : 'One per page.'],
    ['saving', 'Saving to your library', state.phase === 'saveFailed' ? 'Saving failed.' : '']
  ]
  return <ol className='sb-steps' aria-live='polite'>{rows.map(([key, title, detail]) => <li key={key} className={`is-${stage(key)}`}><span className='sb-step-icon'>{stage(key) === 'now' ? <i className='sb-spinner' /> : stage(key) === 'done' ? <Icon name='check' /> : stage(key) === 'error' ? '!' : '·'}</span><span><b>{title}</b>{detail && <small>{detail}</small>}</span></li>)}</ol>
}

const Compose = () => {
  const navigate = useNavigate()
  const { api, seedStory } = useStories()
  const [idea, setIdea] = useState('')
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  const onSaved = useCallback((story) => {
    seedStory(story)
    const missing = story.pages.map((page, index) => page.image ? null : index + 1).filter(Boolean)
    navigate(`/story/${story.id}/1`, { replace: true, state: { saved: true, missing } })
  }, [navigate, seedStory])
  const generation = useStoryGeneration({ api, onSaved })
  const active = generation.state.phase !== 'idle'
  const submit = (event) => { event?.preventDefault(); if (idea.trim() && !active) generation.start(idea) }
  const handleKeyDown = (event) => { if (event.key === 'Enter' && !event.shiftKey) submit(event) }
  const state = generation.state

  return (
    <div className='sb-page sb-page--paper'><AppBar /><main className='sb-stage sb-stage--single'><div className='sb-spread sb-compose'>
      <section className={`sb-pageleaf sb-pageleaf--verso ${active ? 'show-mobile' : ''}`}><div className='sb-running'>New story</div>{active
        ? <div className='sb-slots'><div className='sb-slots__row' style={{ '--slot-count': state.total || 3 }}>{Array.from({ length: state.total || 3 }, (_, index) => <div className={`sb-slot ${state.done[index] ? 'is-done' : ''}`} key={index}>{state.done[index] ? <Icon name='check' /> : state.phase === 'drawing' ? <span><i className='sb-dot' />Drawing</span> : null}<em>{state.total ? index + 1 : ''}</em></div>)}</div><p>{state.phase === 'writing' ? 'Pages appear once the story is written.' : 'Pictures land here as each one is finished.'}</p></div>
        : <div className='sb-compose-idle'><ProductEmblem id='storybook' /><p>Each page gets its own picture. They’ll appear here as they’re drawn.</p></div>}<div className='sb-folio' />
      </section>
      <div className='sb-gutter' />
      <section className='sb-pageleaf sb-pageleaf--recto'><div className='sb-running' /><div className='sb-storytext sb-compose-text'>{!active
        ? <><h1>What’s the story about?</h1>{!online && <div className='sb-generation-error' role='status'><b>You’re offline.</b><span>Reconnect before writing a story. Story Book doesn’t store private stories offline.</span></div>}<form onSubmit={submit}><label className='sb-sr' htmlFor='story-idea'>Story idea</label><textarea id='story-idea' rows='3' maxLength='300' value={idea} onChange={(event) => setIdea(event.target.value)} onKeyDown={handleKeyDown} placeholder='A lighthouse that forgets how to shine the night before a storm…' /><div className='sb-counter'><span>Enter to write · Shift+Enter for a new line</span><span>{idea.length} / 300</span></div><p className='sb-help'>You’ll get a short story, a few pages long, with a picture for each page. It’s saved to your library as soon as it’s ready.</p><div className='sb-compose-actions'><Button variant='gold' disabled={!idea.trim() || !online} type='submit'>Write the story</Button><Link className='sb-quiet' to='/'>Cancel</Link></div></form></>
        : <><p className='sb-idea'>“{state.idea}”</p><GenerationSteps state={state} />{state.phase === 'writeFailed' && <><div className='sb-generation-error'><b>Nothing was written, and nothing was saved.</b><span>Your idea is still here. It’s usually a brief hiccup — try again.</span></div><div className='sb-compose-actions'><Button variant='gold' onClick={() => generation.start(state.idea)}>Try again</Button><button className='sb-quiet' onClick={() => { generation.reset(); setIdea(state.idea) }}>Edit the idea</button></div></>}{state.phase === 'saveFailed' && <><div className='sb-generation-error'><b>Your story is written but not saved yet.</b><span>Leaving this page now would lose it.</span></div><div className='sb-compose-actions'><Button variant='gold' onClick={generation.retrySave}>Try saving again</Button></div></>}{['writing', 'drawing', 'saving'].includes(state.phase) && <p className='sb-help'>Stay on this page until it’s saved. It opens at page one when it’s ready.</p>}</>}
                                                                                        </div>
      </section>
    </div>
    </main>
    </div>
  )
}

const Plate = ({ page, number, title }) => page.image
  ? <div className='sb-plate'><img src={`data:image/jpeg;base64,${page.image}`} alt='' /></div>
  : <div className='sb-plate sb-plate--type'><strong>{number}</strong><em>{title}</em><span>No picture for this page — it couldn’t be drawn when the story was made.</span></div>

export const ReadAloud = ({ narration }) => {
  const [open, setOpen] = useState(false)
  const dismiss = useCallback(() => setOpen(false), [])
  const ref = useDismiss({ open, onDismiss: dismiss })
  if (narration.playing) return <button className='sb-aloud is-playing' onClick={narration.stop}><Icon name='pause' />Pause <span>{narration.chunkIndex + 1}/{narration.chunks.length}</span></button>
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) narration.loadVoices()
  }
  return <div className={`sb-menu sb-aloud-menu ${open ? 'is-open' : ''}`} ref={ref}><button className='sb-aloud' aria-haspopup='true' aria-expanded={open} onClick={toggle}><Icon name='speaker' /><span>Read aloud</span></button><div className='sb-popover sb-voices' role='menu'><h3>Read this page aloud</h3>{narration.voicesStatus === 'loading' && <p>Loading your voices…</p>}{narration.voicesStatus === 'error' && <p role='alert'>Your voices didn’t load. Check your connection and try again.</p>}{narration.voicesStatus === 'ready' && narration.voices?.length === 0 && <><p>Read aloud uses a voice you’ve cloned. You haven’t added one yet.</p><a href={destinations.account.url}>Set up a voice in Account</a></>}{narration.voices?.map((voice) => <button key={voice.id} role='menuitemradio' aria-checked={narration.voiceId === voice.id} onClick={() => { setOpen(false); narration.start(voice.id) }}><i className={narration.voiceId === voice.id ? 'is-selected' : ''} />{voice.name}{voice.isPrimary && <small>Primary</small>}</button>)}{narration.error && <p className='is-danger' role='alert'>Couldn’t read this page aloud. Pick a voice to try again.</p>}</div></div>
}

const Reader = () => {
  const { id, page: pageParam } = useParams()
  const { getStory, renameStory, deleteStory, api } = useStories()
  const navigate = useNavigate()
  const location = useLocation()
  const [story, setStory] = useState(null)
  const [status, setStatus] = useState('loading')
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [direction, setDirection] = useState('')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    getStory(id).then((loaded) => { if (!cancelled) { setStory(loaded); setStatus('ready') } }).catch((error) => { if (!cancelled) setStatus(error.status === 404 ? 'not-found' : 'error') })
    return () => { cancelled = true }
  }, [getStory, id])

  const requested = Number.parseInt(pageParam || '1', 10)
  const total = story?.pages?.length || 1
  const page = Math.min(Math.max(Number.isInteger(requested) ? requested : 1, 1), total)
  useEffect(() => {
    if (!story || page === requested) return
    navigate(`/story/${id}/${page}`, { replace: true })
  }, [id, navigate, page, requested, story])
  useEffect(() => { if (story) setReadingPosition(story.id, page, total) }, [page, story, total])

  const current = story?.pages?.[page - 1]
  const narration = useNarration({ api, storyId: id, page, text: current?.reply || '' })
  const turn = useCallback((next) => {
    if (next < 1 || next > total || next === page) return
    setDirection(next > page ? 'next' : 'prev')
    narration.stop()
    navigate(`/story/${id}/${next}`)
  }, [id, navigate, narration, page, total])

  useEffect(() => {
    const keys = (event) => {
      if (event.target.closest?.('input,textarea,button') || deleting) return
      if (event.key === 'ArrowRight') turn(page + 1)
      if (event.key === 'ArrowLeft') turn(page - 1)
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [deleting, page, turn])

  const swipe = useRef(null)
  const pointerDown = (event) => { if (event.pointerType !== 'mouse') swipe.current = [event.clientX, event.clientY] }
  const pointerUp = (event) => {
    if (!swipe.current) return
    const dx = event.clientX - swipe.current[0]
    const dy = event.clientY - swipe.current[1]
    swipe.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? page + 1 : page - 1)
  }

  if (status === 'loading') return <div className='sb-page'><ReadingBar title='' /><main className='sb-reader-loading' aria-label='Loading story'><i /></main></div>
  if (status === 'not-found') return <NotFound story />
  if (status === 'error') return <div className='sb-page'><AppBar /><main className='sb-desk'><article className='sb-leaf sb-lost'><h1>This story didn’t load.</h1><p>Check your connection, then try again.</p><Button variant='ghost' onClick={() => window.location.reload()}>Try again</Button></article></main></div>

  const saveRename = async (title) => {
    const summary = await renameStory(story.id, title)
    setStory((value) => ({ ...value, title: summary.title }))
  }
  const remove = async () => { await deleteStory(story.id); navigate('/', { replace: true, state: { deleted: story.title } }) }
  const chunks = narration.chunks.length ? narration.chunks : [cleanStoryText(current.reply)]

  return (
    <div className='sb-page sb-reader' onPointerDown={pointerDown} onPointerUp={pointerUp}><ReadingBar title={story.title} saved={location.state?.saved} renaming={renaming} story={story} onRename={() => setRenaming(true)} onCancelRename={() => setRenaming(false)} onSaveRename={saveRename} onDelete={() => setDeleting(true)} narration={narration} />
      <main className={`sb-reader-stage turning-${direction}`}><button className='sb-turn' disabled={page === 1} aria-label='Previous page' onClick={() => turn(page - 1)}><Icon name='left' /></button><div className='sb-book'><div className='sb-spread'>
        <section className='sb-pageleaf sb-pageleaf--verso'><div className='sb-running'>{story.title}</div><Plate page={current} number={page} title={story.title} /><div className='sb-folio'>{page}</div></section><div className='sb-gutter' /><section className={`sb-pageleaf sb-pageleaf--recto ${narration.playing ? 'is-narrating' : ''}`}><div className='sb-running'>{page > 1 ? story.title : ''}</div><div className='sb-storytext'>{page === 1 && <><h1>{story.title}</h1><p className='sb-byline'>{formatDate(story.createdAt, true)} · {total} pages</p></>}<p>{chunks.map((chunk, index) => <span className={`sb-chunk ${narration.playing && narration.chunkIndex === index ? 'is-current' : ''}`} key={index}>{chunk}{' '}</span>)}</p>{page === total && <div className='sb-end'><em>The end.</em><Link className='br-button br-button--ghost br-button--small' to='/new'>Write another story</Link><Link className='br-button br-button--ghost br-button--small' to='/'>Back to stories</Link></div>}</div><div className='sb-folio'>{page} / {total}</div></section>
                                                                                                                                                                                                                                 </div><nav className='sb-page-rule' aria-label='Pages'>{story.pages.map((item, index) => <button key={index} aria-current={index + 1 === page ? 'page' : undefined} aria-label={`Page ${index + 1}`} onClick={() => turn(index + 1)} />)}<span>Page {page} of {total}</span></nav>
                                                                                                                                                                                                        </div><button className='sb-turn' disabled={page === total} aria-label='Next page' onClick={() => turn(page + 1)}><Icon name='right' /></button>
      </main>
      <nav className='sb-pagebar' aria-label='Page controls'><button disabled={page === 1} aria-label='Previous page' onClick={() => turn(page - 1)}><Icon name='left' /></button><span>{page} / {total}</span><button disabled={page === total} aria-label='Next page' onClick={() => turn(page + 1)}><Icon name='right' /></button><ReadAloud narration={narration} /></nav>
      {deleting && <ConfirmDialog story={story} onCancel={() => setDeleting(false)} onConfirm={remove} />}
    </div>
  )
}

const ReadingBar = ({ title, saved, renaming, story, onRename, onCancelRename, onSaveRename, onDelete, narration }) => <header className='sb-readingbar'><div className='sb-readingbar__inner'><div className='sb-readingbar__left'><Link to='/' className='sb-back'><Icon name='back' />Stories</Link>{saved && <span className='sb-saved'><Icon name='check' />Saved to your library</span>}</div>{renaming ? <RenameField story={story} onCancel={onCancelRename} onSave={onSaveRename} /> : <div className='sb-readingbar__title'>{title}</div>}<div className='sb-readingbar__right'>{narration && <span className='sb-desktop-only'><ReadAloud narration={narration} /></span>}{story && <StoryMenu story={story} onRename={onRename} onDelete={onDelete} />}<span className='sb-desktop-only'><AppSwitcher destinations={destinations} current='storybook' /></span><AccountMenu destinations={destinations} themeControl /></div></div></header>

const NotFound = ({ story = false }) => <div className='sb-page'><AppBar /><main className='sb-desk'><article className='sb-leaf sb-lost'><h1>{story ? 'This story isn’t in your library.' : 'That page has wandered off.'}</h1><p>{story ? 'It may have been deleted, or the link belongs to someone else’s account.' : 'There’s no Story Book page at this address.'}</p><Link className='br-button br-button--ghost' to='/'><Icon name='back' />Back to stories</Link></article></main></div>

export const StoryRoutes = () => <Routes><Route path='/' element={<Library />} /><Route path='/new' element={<Compose />} /><Route path='/story/:id' element={<Reader />} /><Route path='/story/:id/:page' element={<Reader />} /><Route path='*' element={<NotFound />} /></Routes>

export const App = () => <BrowserRouter><AuthBoundary><StoryRoutes /></AuthBoundary></BrowserRouter>
