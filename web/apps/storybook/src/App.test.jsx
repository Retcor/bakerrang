// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthBoundary, ReadAloud, StoryRoutes } from './App.jsx'

let authState
let storiesState
let generationState
let narrationState

vi.mock('@bakerrang/web-auth', () => ({
  AUTH_STATUS: { LOADING: 'loading', ANONYMOUS: 'anonymous', AUTHENTICATED: 'authenticated' },
  useAuth: () => authState
}))

vi.mock('@bakerrang/web-app-shell', () => ({
  resolveDestinations: () => ({ launcher: { url: 'https://launch.test' }, account: { url: 'https://account.test' }, tools: [] }),
  BrandLink: () => <a href='/'>Story Book</a>,
  ProductEmblem: () => <span data-testid='emblem' />,
  AppSwitcher: () => <button>Switch app</button>,
  AccountMenu: () => <button>Account</button>
}))

vi.mock('./state/StoriesProvider.jsx', () => ({ useStories: () => storiesState }))
vi.mock('./state/useStoryGeneration.js', () => ({ useStoryGeneration: () => generationState }))
vi.mock('./state/useNarration.js', () => ({ useNarration: () => narrationState }))

const story = {
  id: 'story-1',
  title: 'The Lantern Fox',
  createdAt: '2026-09-22T00:00:00.000Z',
  thumbnail: null,
  pages: [{ reply: 'First page.', image: null }, { reply: 'The end.', image: 'picture' }]
}

const renderRoute = (route = '/') => render(<MemoryRouter initialEntries={[route]}><AuthBoundary><StoryRoutes /></AuthBoundary></MemoryRouter>)

beforeEach(() => {
  authState = { status: 'authenticated', login: vi.fn(), logout: vi.fn(), user: { displayName: 'Reader' } }
  storiesState = {
    stories: [],
    status: 'ready',
    error: null,
    loadStories: vi.fn(),
    getStory: vi.fn().mockResolvedValue(story),
    renameStory: vi.fn().mockImplementation(async (id, title) => ({ ...story, id, title })),
    deleteStory: vi.fn().mockResolvedValue(),
    seedStory: vi.fn(),
    api: {}
  }
  generationState = { state: { phase: 'idle', idea: '', total: 0, done: [], pages: [] }, start: vi.fn(), retrySave: vi.fn(), reset: vi.fn() }
  narrationState = { playing: false, stop: vi.fn(), chunks: ['First page.'], chunkIndex: -1, loadVoices: vi.fn(), start: vi.fn(), voicesStatus: 'idle', voices: null, error: null }
  sessionStorage.clear()
  localStorage.clear()
})

afterEach(cleanup)

describe('Story Book routes and library', () => {
  it('shows the signed-out welcome at / and a true not-found page for an unknown URL', () => {
    authState.status = 'anonymous'
    const first = renderRoute('/')
    expect(screen.getByRole('heading', { name: /Type an idea/ })).not.toBeNull()
    first.unmount()
    renderRoute('/lost-page')
    expect(screen.getByRole('heading', { name: /wandered off/ })).not.toBeNull()
  })

  it.each([
    ['loading', 'Loading your stories', true],
    ['ready', 'Nothing here yet', false],
    ['error', 'Your stories didn’t load', false]
  ])('renders the %s library state', (status, expected, labelled) => {
    storiesState.status = status
    storiesState.error = status === 'error' ? new Error('Network unavailable') : null
    renderRoute('/')
    expect(labelled ? screen.getByLabelText(expected) : screen.getByText(new RegExp(expected))).not.toBeNull()
  })

  it('renders summary rows with the typographic thumbnail fallback and resume position', () => {
    localStorage.setItem('sb.pos.story-1', '2')
    storiesState.stories = [{ id: story.id, title: story.title, createdAt: story.createdAt, pageCount: 2, excerpt: 'First page.', thumbnail: null }]
    renderRoute('/')
    expect(screen.getByText('The Lantern Fox')).not.toBeNull()
    expect(screen.getByText('T')).not.toBeNull()
    expect(screen.getByText(/Stopped at p. 2/)).not.toBeNull()
  })

  it('supports inline rename and irreversible delete confirmation', async () => {
    storiesState.stories = [{ id: story.id, title: story.title, createdAt: story.createdAt, pageCount: 2, excerpt: 'First page.', thumbnail: null }]
    renderRoute('/')
    await userEvent.click(screen.getByRole('button', { name: `Options for ${story.title}` }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = screen.getByLabelText('Story title')
    await userEvent.clear(input)
    await userEvent.type(input, 'Fox at Dawn')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(storiesState.renameStory).toHaveBeenCalledWith(story.id, 'Fox at Dawn')

    await userEvent.click(screen.getByRole('button', { name: `Options for ${story.title}` }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete story' }))
    expect(screen.getByRole('alertdialog')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Delete story' }))
    expect(storiesState.deleteStory).toHaveBeenCalledWith(story.id)
  })
})

describe('authoring and reading', () => {
  it('renders actual generation stages and failure recovery', () => {
    generationState.state = { phase: 'drawing', idea: 'A fox', total: 3, done: [true, false, false], pages: [] }
    const first = renderRoute('/new')
    expect(screen.getByText('1 of 3 ready. Pages are drawn at the same time.')).not.toBeNull()
    first.unmount()
    generationState.state = { phase: 'saveFailed', idea: 'A fox', total: 3, done: [true, true, true], pages: [], story }
    renderRoute('/new')
    expect(screen.getByText(/written but not saved yet/)).not.toBeNull()
  })

  it('loads a deep-linked story, navigates pages, and stops narration before turning', async () => {
    renderRoute('/story/story-1/1')
    await screen.findByRole('heading', { name: story.title })
    await userEvent.click(screen.getAllByRole('button', { name: 'Next page' })[0])
    expect(narrationState.stop).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('The end.')).not.toBeNull())
    expect(screen.getAllByRole('button', { name: 'Next page' }).every((button) => button.disabled)).toBe(true)
  })

  it('shows the owner-safe missing-story state', async () => {
    const error = Object.assign(new Error('missing'), { status: 404 })
    storiesState.getStory.mockRejectedValue(error)
    renderRoute('/story/missing/1')
    expect(await screen.findByRole('heading', { name: /isn’t in your library/ })).not.toBeNull()
  })
})

describe('read aloud menu', () => {
  it('covers loading, no-voice, error, and available cloned-voice states', async () => {
    const states = [
      [{ ...narrationState, voicesStatus: 'loading' }, /Loading your voices/],
      [{ ...narrationState, voicesStatus: 'ready', voices: [] }, /haven’t added one yet/],
      [{ ...narrationState, voicesStatus: 'error' }, /voices didn’t load/],
      [{ ...narrationState, voicesStatus: 'ready', voices: [{ id: 'v1', name: 'My voice', isPrimary: true }] }, /My voice/]
    ]
    for (const [state, expected] of states) {
      const view = render(<ReadAloud narration={state} />)
      await userEvent.click(screen.getByRole('button', { name: 'Read aloud' }))
      expect(screen.getByText(expected)).not.toBeNull()
      view.unmount()
    }
  })
})
