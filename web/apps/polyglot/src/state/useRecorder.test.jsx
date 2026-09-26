// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecorder } from './useRecorder.js'

let tracks
let recorders

class FakeRecorder {
  constructor () { this.state = 'inactive'; this.mimeType = 'audio/webm;codecs=opus'; recorders.push(this) }
  start () { this.state = 'recording' }
  stop () { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) }); this.onstop?.() }
}

beforeEach(() => {
  vi.useFakeTimers()
  tracks = [{ stop: vi.fn() }]
  recorders = []
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks }) } })
  globalThis.MediaRecorder = FakeRecorder
})

afterEach(() => { vi.useRealTimers(); cleanup() })

describe('recording lifecycle', () => {
  it('requests the microphone only on start and releases every track on stop', async () => {
    const onCapture = vi.fn()
    const { result } = renderHook(() => useRecorder({ onCapture }))
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
    await act(() => result.current.start())
    act(() => result.current.stop())
    expect(tracks[0].stop).toHaveBeenCalledOnce()
    expect(onCapture).toHaveBeenCalledWith(expect.any(Blob), 'audio/webm;codecs=opus')
  })

  it('auto-stops at 60 seconds and captures normally', async () => {
    const onCapture = vi.fn()
    const { result } = renderHook(() => useRecorder({ onCapture, maxMs: 60000 }))
    await act(() => result.current.start())
    act(() => vi.advanceTimersByTime(60000))
    expect(tracks[0].stop).toHaveBeenCalledOnce()
    expect(onCapture).toHaveBeenCalledOnce()
  })

  it('cancel and unmount release tracks without retaining a blob', async () => {
    const onCapture = vi.fn()
    const { result, unmount } = renderHook(() => useRecorder({ onCapture }))
    await act(() => result.current.start())
    act(() => result.current.cancel())
    expect(tracks[0].stop).toHaveBeenCalledOnce()
    expect(onCapture).not.toHaveBeenCalled()
    tracks = [{ stop: vi.fn() }]
    await act(() => result.current.start())
    unmount()
    expect(tracks[0].stop).toHaveBeenCalledOnce()
  })

  it('releases tracks when the tab is hidden or the page is left', async () => {
    const { result, unmount } = renderHook(() => useRecorder({ onCapture: vi.fn() }))
    await act(() => result.current.start())
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(tracks[0].stop).toHaveBeenCalledOnce()
    unmount()

    tracks = [{ stop: vi.fn() }]
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    const second = renderHook(() => useRecorder({ onCapture: vi.fn() }))
    await act(() => second.result.current.start())
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(tracks[0].stop).toHaveBeenCalledOnce()
    second.unmount()
  })
})
