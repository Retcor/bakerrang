// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStoryGeneration } from './useStoryGeneration.js'

afterEach(cleanup)

const setup = (overrides = {}) => {
  const api = {
    writeStory: vi.fn().mockResolvedValue('Page one.\nPage two.'),
    drawPage: vi.fn().mockResolvedValue('raw-picture'),
    saveStory: vi.fn().mockResolvedValue({}),
    ...overrides
  }
  const onSaved = vi.fn()
  const imageProcessor = vi.fn().mockImplementation(async (value, width) => `${value}-${width}`)
  const hook = renderHook(() => useStoryGeneration({
    api,
    onSaved,
    imageProcessor,
    randomUUID: () => 'story-id',
    now: () => '2026-09-22T00:00:00.000Z'
  }))
  return { ...hook, api, onSaved, imageProcessor }
}

describe('story generation', () => {
  it('tracks real work, draws every page in parallel, and auto-saves compressed images', async () => {
    const { result, api, onSaved } = setup()
    await act(() => result.current.start('a moon garden'))
    await waitFor(() => expect(result.current.state.phase).toBe('saved'))
    expect(api.drawPage).toHaveBeenNthCalledWith(1, '', 'Page one.', expect.any(Object))
    expect(api.drawPage).toHaveBeenNthCalledWith(2, 'Page one.', 'Page two.', expect.any(Object))
    expect(api.saveStory).toHaveBeenCalledWith(expect.objectContaining({
      id: 'story-id',
      title: 'A moon garden',
      thumbnail: 'raw-picture-200',
      pages: [{ reply: 'Page one.', image: 'raw-picture-400' }, { reply: 'Page two.', image: 'raw-picture-400' }]
    }))
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('keeps picture failures as null and preserves the save retry path', async () => {
    const { result, api, imageProcessor } = setup({
      drawPage: vi.fn().mockRejectedValueOnce(new Error('draw failed')).mockResolvedValueOnce('raw-picture'),
      saveStory: vi.fn().mockRejectedValueOnce(new Error('save failed')).mockResolvedValueOnce({})
    })
    imageProcessor.mockRejectedValueOnce(new Error('conversion failed')).mockImplementation(async (value, width) => `${value}-${width}`)
    await act(() => result.current.start('a storm'))
    await waitFor(() => expect(result.current.state.phase).toBe('saveFailed'))
    expect(result.current.state.story.pages[0].image).toBeNull()
    await act(() => result.current.retrySave())
    await waitFor(() => expect(result.current.state.phase).toBe('saved'))
    expect(api.saveStory).toHaveBeenCalledTimes(2)
  })

  it('shows a writing failure without attempting a save', async () => {
    const { result, api } = setup({ writeStory: vi.fn().mockRejectedValue(new Error('offline')) })
    await act(() => result.current.start('an idea'))
    await waitFor(() => expect(result.current.state.phase).toBe('writeFailed'))
    expect(api.saveStory).not.toHaveBeenCalled()
  })
})
