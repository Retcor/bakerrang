// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTurns } from './useTurns.js'
import { writePair, writeVoice } from './preferences.js'

afterEach(cleanup)

const snapshot = { from: 'en-US', to: 'es-ES', fromName: 'English', toName: 'Spanish', voiceId: null, voiceName: null }
const deferred = () => { let settle; let fail; const promise = new Promise((resolve, reject) => { settle = resolve; fail = reject }); return { promise, resolve: settle, reject: fail } }

describe('turn lifecycle', () => {
  it('completes typed translation without minting speech when there is no cloned voice', async () => {
    const api = { translate: vi.fn().mockResolvedValue('Hola'), mintSpeech: vi.fn(), transcribe: vi.fn() }
    const { result } = renderHook(() => useTurns({ api }))
    act(() => result.current.beginTyped(snapshot, 'Hello'))
    await waitFor(() => expect(result.current.turns[0]?.phase).toBe('done'))
    expect(result.current.turns[0]).toMatchObject({ heard: 'Hello', said: 'Hola', voiceId: null })
    expect(api.mintSpeech).not.toHaveBeenCalled()
  })

  it('never persists conversation content and leaves only the approved preference keys', async () => {
    localStorage.clear()
    sessionStorage.clear()
    const api = { translate: vi.fn().mockResolvedValue('Texto privado'), mintSpeech: vi.fn(), transcribe: vi.fn() }
    const { result } = renderHook(() => useTurns({ api }))
    act(() => result.current.beginTyped(snapshot, 'Private conversation text'))
    await waitFor(() => expect(result.current.turns[0]?.phase).toBe('done'))
    writePair({ from: 'en-US', to: 'es-ES' })
    writeVoice('voice-a')
    expect(Object.keys(localStorage).sort()).toEqual(['pg.pair', 'pg.voice'])
    expect(JSON.stringify({ ...localStorage })).not.toContain('Private conversation text')
    expect(JSON.stringify({ ...localStorage })).not.toContain('Texto privado')
    expect(sessionStorage).toHaveLength(0)
  })

  it('retains only transcript after translation failure and retries under the same stable id', async () => {
    const api = { translate: vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('Hola'), mintSpeech: vi.fn(), transcribe: vi.fn() }
    const { result } = renderHook(() => useTurns({ api }))
    act(() => result.current.beginTyped(snapshot, 'Hello'))
    await waitFor(() => expect(result.current.turns[0]?.phase).toBe('translateFailed'))
    const id = result.current.turns[0].id
    expect(result.current.turns[0].heard).toBe('Hello')
    expect(Object.hasOwn(result.current.turns[0], 'audio')).toBe(false)
    act(() => result.current.retry(id))
    await waitFor(() => expect(result.current.turns[0]?.phase).toBe('done'))
    expect(result.current.turns[0].id).toBe(id)
    expect(api.translate).toHaveBeenLastCalledWith('Hello', 'en-US', 'es-ES', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('drops stale translation results after cancel and aborts the active request', async () => {
    const pending = deferred()
    let observedSignal
    const api = { translate: vi.fn((text, from, to, { signal }) => { observedSignal = signal; return pending.promise }), mintSpeech: vi.fn(), transcribe: vi.fn() }
    const { result } = renderHook(() => useTurns({ api }))
    act(() => result.current.beginTyped(snapshot, 'Hello'))
    await waitFor(() => expect(api.translate).toHaveBeenCalled())
    act(() => result.current.cancel())
    expect(observedSignal.aborted).toBe(true)
    await act(async () => pending.resolve('Too late'))
    expect(result.current.turns).toEqual([])
  })

  it('drops a stale transcription result after cancellation', async () => {
    const pending = deferred()
    const api = { translate: vi.fn(), mintSpeech: vi.fn(), transcribe: vi.fn(() => pending.promise) }
    const { result } = renderHook(() => useTurns({ api }))
    let id
    act(() => { id = result.current.begin(snapshot) })
    act(() => { result.current.processRecording(id, new Blob(['raw audio'])) })
    await waitFor(() => expect(api.transcribe).toHaveBeenCalled())
    act(() => result.current.cancel())
    await act(() => pending.resolve('stale transcript'))
    expect(result.current.turns).toEqual([])
    expect(api.translate).not.toHaveBeenCalled()
  })

  it('snapshots language and voice at turn start', async () => {
    const pending = deferred()
    const api = { translate: vi.fn(() => pending.promise), mintSpeech: vi.fn(), transcribe: vi.fn() }
    const { result } = renderHook(() => useTurns({ api }))
    act(() => result.current.beginTyped({ ...snapshot, voiceId: 'voice-a', voiceName: 'My voice' }, 'Hello'))
    expect(result.current.turns[0]).toMatchObject({ from: 'en-US', to: 'es-ES', voiceId: 'voice-a' })
    act(() => result.current.cancel())
  })

  it('replays the stable target turn through the currently selected voice', async () => {
    const api = { translate: vi.fn().mockResolvedValue('Hola'), mintSpeech: vi.fn().mockResolvedValue('/speech/token'), transcribe: vi.fn() }
    const audioFactory = () => ({
      removeAttribute: vi.fn(),
      load: vi.fn(),
      pause: vi.fn(),
      play () { queueMicrotask(() => this.onended?.()); return Promise.resolve() }
    })
    const { result } = renderHook(() => useTurns({ api, audioFactory }))
    act(() => result.current.beginTyped({ ...snapshot, voiceId: 'voice-at-start', voiceName: 'Captured voice' }, 'Hello'))
    await waitFor(() => expect(result.current.turns[0]?.phase).toBe('done'))
    const id = result.current.turns[0].id
    await act(() => result.current.replay(id, 'voice-now'))
    expect(api.mintSpeech).toHaveBeenNthCalledWith(1, 'voice-at-start', 'Hola', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(api.mintSpeech).toHaveBeenNthCalledWith(2, 'voice-now', 'Hola', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('refreshes authentication and drops an unavailable voice when speech-token minting rejects', async () => {
    const unavailable = Object.assign(new Error('gone'), { status: 403 })
    const signedOut = Object.assign(new Error('signed out'), { status: 401 })
    const onVoiceUnavailable = vi.fn()
    const onSignedOut = vi.fn()
    const audioFactory = () => ({ removeAttribute: vi.fn(), load: vi.fn(), pause: vi.fn(), play: vi.fn() })
    const api = { translate: vi.fn().mockResolvedValue('Hola'), mintSpeech: vi.fn().mockRejectedValueOnce(unavailable).mockRejectedValueOnce(signedOut), transcribe: vi.fn() }
    const { result } = renderHook(() => useTurns({ api, audioFactory, onVoiceUnavailable, onSignedOut }))
    act(() => result.current.beginTyped({ ...snapshot, voiceId: 'voice-a', voiceName: 'Jamie' }, 'Hello'))
    await waitFor(() => expect(onVoiceUnavailable).toHaveBeenCalledWith('voice-a'))
    expect(result.current.turns[0]).toMatchObject({ phase: 'done', error: 'speakFailed' })
    await act(() => result.current.replay(result.current.turns[0].id, 'voice-b'))
    expect(onSignedOut).toHaveBeenCalledTimes(1)
  })

  it('ignores stale speech-token completion after cancellation', async () => {
    const pendingSpeech = deferred()
    const audioFactory = vi.fn(() => ({ removeAttribute: vi.fn(), load: vi.fn(), pause: vi.fn(), play: vi.fn() }))
    const api = { translate: vi.fn().mockResolvedValue('Hola'), mintSpeech: vi.fn(() => pendingSpeech.promise), transcribe: vi.fn() }
    const { result } = renderHook(() => useTurns({ api, audioFactory }))
    act(() => result.current.beginTyped({ ...snapshot, voiceId: 'voice-a', voiceName: 'Jamie' }, 'Hello'))
    await waitFor(() => expect(api.mintSpeech).toHaveBeenCalled())
    act(() => result.current.cancel())
    await act(() => pendingSpeech.resolve('/speech/too-late'))
    expect(result.current.turns).toEqual([])
    expect(audioFactory).not.toHaveBeenCalled()
  })
})
