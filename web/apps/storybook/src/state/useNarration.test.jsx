// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNarration } from './useNarration.js'

afterEach(cleanup)

const audio = ({ errorOnLoad = false } = {}) => {
  const teardownError = vi.fn()
  const value = {
    pause: vi.fn(),
    removeAttribute: vi.fn(),
    play: vi.fn().mockResolvedValue(),
    src: '',
    onended: null,
    onerror: null,
    teardownError
  }
  value.load = vi.fn(() => {
    if (!errorOnLoad) return
    queueMicrotask(() => {
      teardownError()
      value.onerror?.(new Event('error'))
    })
  })
  value.fail = () => value.onerror?.(new Event('error'))
  value.finish = () => value.onended?.(new Event('ended'))
  return value
}

describe('narration', () => {
  it('loads cloned voices lazily and remembers the selected voice', async () => {
    const api = { listVoices: vi.fn().mockResolvedValue([{ id: 'primary', name: 'Reader', isPrimary: true }]), narrationUrl: vi.fn().mockResolvedValue('/audio') }
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    const { result } = renderHook(() => useNarration({ api, storyId: 'a', page: 1, text: 'Hello.', audioFactory: audio, storage }))
    expect(api.listVoices).not.toHaveBeenCalled()
    await act(() => result.current.loadVoices())
    expect(result.current.voicesStatus).toBe('ready')
    act(() => result.current.start('primary'))
    expect(storage.setItem).toHaveBeenCalledWith('sb.voice', 'primary')
    await waitFor(() => expect(result.current.playing).toBe(true))
  })

  it('ignores the browser error caused by intentional source teardown and can restart', async () => {
    const first = audio({ errorOnLoad: true })
    const second = audio()
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValue(second)
    const api = { listVoices: vi.fn(), narrationUrl: vi.fn().mockResolvedValue('/audio') }
    const { result } = renderHook(() => useNarration({ api, storyId: 'a', page: 1, text: 'Hello.', audioFactory: factory, storage: localStorage }))

    act(() => result.current.start('voice'))
    await waitFor(() => expect(first.play).toHaveBeenCalled())
    act(() => result.current.stop())
    await waitFor(() => expect(first.teardownError).toHaveBeenCalled())
    expect(result.current.error).toBeNull()
    expect(result.current.playing).toBe(false)
    expect(result.current.chunkIndex).toBe(-1)

    act(() => result.current.start('voice'))
    await waitFor(() => expect(second.play).toHaveBeenCalled())
    expect(result.current.playing).toBe(true)
  })

  it('stops without an error on page and story changes', async () => {
    const first = audio({ errorOnLoad: true })
    const second = audio({ errorOnLoad: true })
    const third = audio({ errorOnLoad: true })
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second).mockReturnValue(third)
    const api = { listVoices: vi.fn(), narrationUrl: vi.fn().mockResolvedValue('/audio') }
    const { result, rerender, unmount } = renderHook(({ storyId, page }) => useNarration({ api, storyId, page, text: 'Hello.', audioFactory: factory, storage: localStorage }), { initialProps: { storyId: 'a', page: 1 } })

    act(() => result.current.start('voice'))
    await waitFor(() => expect(first.play).toHaveBeenCalled())
    rerender({ storyId: 'a', page: 2 })
    await waitFor(() => expect(first.teardownError).toHaveBeenCalled())
    expect(result.current.error).toBeNull()

    act(() => result.current.start('voice'))
    await waitFor(() => expect(second.play).toHaveBeenCalled())
    rerender({ storyId: 'b', page: 2 })
    await waitFor(() => expect(second.teardownError).toHaveBeenCalled())
    expect(result.current.error).toBeNull()

    act(() => result.current.start('voice'))
    await waitFor(() => expect(third.play).toHaveBeenCalled())
    unmount()
    await waitFor(() => expect(third.teardownError).toHaveBeenCalled())
    expect(third.pause).toHaveBeenCalled()
    expect(third.src).toBe('')
  })

  it('ignores stale callbacks after narration is replaced', async () => {
    const first = audio()
    const second = audio()
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValue(second)
    const api = { listVoices: vi.fn(), narrationUrl: vi.fn().mockResolvedValue('/audio') }
    const { result } = renderHook(() => useNarration({ api, storyId: 'a', page: 1, text: 'Hello.', audioFactory: factory, storage: localStorage }))

    act(() => result.current.start('voice'))
    await waitFor(() => expect(first.play).toHaveBeenCalled())
    const staleError = first.onerror
    act(() => result.current.start('voice'))
    await waitFor(() => expect(second.play).toHaveBeenCalled())
    act(() => staleError(new Event('error')))

    expect(second.pause).not.toHaveBeenCalled()
    expect(result.current.playing).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('reports a genuine error from the active playback', async () => {
    const current = audio({ errorOnLoad: true })
    const api = { listVoices: vi.fn(), narrationUrl: vi.fn().mockResolvedValue('/audio') }
    const { result } = renderHook(() => useNarration({ api, storyId: 'a', page: 1, text: 'Hello.', audioFactory: () => current, storage: localStorage }))

    act(() => result.current.start('voice'))
    await waitFor(() => expect(current.play).toHaveBeenCalled())
    act(() => current.fail())

    await waitFor(() => expect(result.current.error?.message).toBe('Could not read this page aloud'))
    expect(result.current.playing).toBe(false)
    expect(result.current.chunkIndex).toBe(-1)
  })
})
