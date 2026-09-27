// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPlan } from '../api/budget.js'
import { usePlan } from './usePlan.js'

vi.mock('../api/budget.js', () => ({ loadPlan: vi.fn() }))

const empty = { paydays: [], bills: [] }
const deferred = () => { let resolve; let reject; const promise = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject }); return { promise, resolve, reject } }

beforeEach(() => {
  loadPlan.mockReset()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Budget plan state races', () => {
  it('ignores an older load after a replacement load wins', async () => {
    const first = deferred(); const second = deferred()
    loadPlan.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
    const { result } = renderHook(() => usePlan({ active: true, editorOpen: false }))
    await waitFor(() => expect(loadPlan).toHaveBeenCalledTimes(1))
    act(() => { result.current.load() })
    await waitFor(() => expect(loadPlan).toHaveBeenCalledTimes(2))
    const latest = { paydays: [{ id: 'latest' }], bills: [] }
    await act(async () => { second.resolve(latest); await second.promise })
    await waitFor(() => expect(result.current.plan).toEqual(latest))
    await act(async () => { first.resolve({ paydays: [{ id: 'stale' }], bills: [] }); await first.promise })
    expect(result.current.plan).toEqual(latest)
  })

  it('aborts an in-flight load and clears private state on auth loss', async () => {
    const pending = deferred(); let signal
    loadPlan.mockImplementation(({ signal: value }) => { signal = value; return pending.promise })
    const { result, rerender } = renderHook(({ active }) => usePlan({ active, editorOpen: false }), { initialProps: { active: true } })
    await waitFor(() => expect(loadPlan).toHaveBeenCalledTimes(1))
    rerender({ active: false })
    expect(signal.aborted).toBe(true); expect(result.current.status).toBe('idle'); expect(result.current.plan).toEqual(empty)
  })

  it('skips visibility refresh while an editor is open', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    loadPlan.mockResolvedValue(empty)
    const { rerender } = renderHook(({ editorOpen }) => usePlan({ active: true, editorOpen }), { initialProps: { editorOpen: false } })
    await waitFor(() => expect(loadPlan).toHaveBeenCalledTimes(1))
    now.mockReturnValue(62001)
    rerender({ editorOpen: true }); act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(loadPlan).toHaveBeenCalledTimes(1)
    rerender({ editorOpen: false }); act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(loadPlan).toHaveBeenCalledTimes(2))
  })

  it('applies server-confirmed payday unpins and revisions', async () => {
    loadPlan.mockResolvedValue({ paydays: [{ id: 'p' }], bills: [{ id: 'b', paydayId: 'p', rev: 1 }] })
    const { result } = renderHook(() => usePlan({ active: true, editorOpen: false }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.remove('payday', 'p', { unpinned: [{ id: 'b', rev: 2 }] }))
    expect(result.current.plan).toEqual({ paydays: [], bills: [{ id: 'b', paydayId: null, rev: 2 }] })
  })
})
