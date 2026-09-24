// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNarration } from './useNarration.js'

afterEach(cleanup)

const audio = () => ({ pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn(), play: vi.fn().mockResolvedValue(), src: '' })

describe('narration', () => {
  it('loads cloned voices lazily and remembers the selected voice', async () => {
    const api = { listVoices: vi.fn().mockResolvedValue([{ id: 'primary', name: 'Reader', isPrimary: true }]), narrationUrl: vi.fn(() => '/audio') }
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    const { result } = renderHook(() => useNarration({ api, storyId: 'a', page: 1, text: 'Hello.', audioFactory: audio, storage }))
    expect(api.listVoices).not.toHaveBeenCalled()
    await act(() => result.current.loadVoices())
    expect(result.current.voicesStatus).toBe('ready')
    act(() => result.current.start('primary'))
    expect(storage.setItem).toHaveBeenCalledWith('sb.voice', 'primary')
  })

  it('stops and clears audio on page change, story change, and unmount', async () => {
    const first = audio()
    const second = audio()
    const third = audio()
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second).mockReturnValue(third)
    const api = { listVoices: vi.fn(), narrationUrl: vi.fn(() => '/audio') }
    const { result, rerender, unmount } = renderHook(({ storyId, page }) => useNarration({ api, storyId, page, text: 'Hello.', audioFactory: factory, storage: localStorage }), { initialProps: { storyId: 'a', page: 1 } })
    act(() => result.current.start('voice'))
    rerender({ storyId: 'a', page: 2 })
    await waitFor(() => expect(first.pause).toHaveBeenCalled())
    act(() => result.current.start('voice'))
    rerender({ storyId: 'b', page: 2 })
    await waitFor(() => expect(second.pause).toHaveBeenCalled())
    act(() => result.current.start('voice'))
    unmount()
    expect(third.pause).toHaveBeenCalled()
    expect(third.src).toBe('')
  })
})
