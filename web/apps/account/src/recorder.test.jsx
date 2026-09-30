// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authStore } from './test-support/mockAuth.js'
import { serverRef } from './test-support/mockApi.js'
import { createFakeServer, twoVoices } from './test-support/fakeServer.js'
import { fakeFile, installBrowserStubs, installRecorder, removeRecorder, renderApp, resetBrowserState } from './test-support/harness.jsx'

vi.mock('@bakerrang/web-auth', async () => (await import('./test-support/mockAuth.js')).mockAuthModule)
vi.mock('@bakerrang/web-api-client', async (importOriginal) => (await import('./test-support/mockApi.js')).apiClientModule(await importOriginal()))

let server
let user
beforeEach(() => {
  resetBrowserState()
  installBrowserStubs()
  authStore.reset()
  server = createFakeServer({ voices: twoVoices() })
  serverRef.current = server
  vi.useFakeTimers({ shouldAdvanceTime: true })
  user = userEvent.setup({ applyAccept: false, advanceTimers: vi.advanceTimersByTime })
})
afterEach(() => {
  cleanup()
  removeRecorder()
  vi.useRealTimers()
})

const status = () => document.querySelector('[role="status"][aria-live="polite"]').textContent
const openAdd = async () => {
  renderApp()
  await screen.findByRole('list', { name: 'Your voices' })
  await user.click(screen.getByRole('button', { name: 'Add voice' }))
}
const record = () => user.click(screen.getByRole('button', { name: 'Record a sample' }))
const stop = () => user.click(screen.getByRole('button', { name: 'Stop' }))
const tick = (ms) => act(async () => { vi.advanceTimersByTime(ms) })

describe('recording a sample', () => {
  it('records with the best supported type, shows the running time, and adds an honestly named sample', async () => {
    const recorder = installRecorder()
    await openAdd()
    await record()
    expect(recorder.getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(recorder.instances[0].requested).toBe('audio/webm;codecs=opus')
    const group = await screen.findByRole('group', { name: 'Recording' })
    expect(group.textContent).toContain('Recording · 0:00')
    expect(group.textContent).toContain('of 5:00')
    await waitFor(() => expect(status()).toBe('Recording started.'))
    await tick(42000)
    expect(within(screen.getByRole('group', { name: 'Recording' })).getByText('0:42')).not.toBeNull()
    await stop()
    expect(screen.queryByRole('group', { name: 'Recording' })).toBeNull()
    const samples = screen.getByRole('list', { name: 'Samples' })
    expect(within(samples).getByText('Recording 1')).not.toBeNull()
    expect(within(samples).getByText(/WebM audio/)).not.toBeNull()
    await waitFor(() => expect(status()).toBe('Recording added.'))
    expect(recorder.tracks[0].stop).toHaveBeenCalled()
  })

  it('uploads the recording under its real type and extension, never as mp3', async () => {
    installRecorder({ mimeType: 'audio/webm;codecs=opus' })
    await openAdd()
    await record()
    await stop()
    await user.type(screen.getByLabelText('Name'), 'Desk')
    await user.click(screen.getByLabelText(/This is my voice/))
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    await waitFor(() => expect(server.callsTo('POST', '/text/to/speech/v1/voice')).toHaveLength(1))
    const [file] = server.callsTo('POST', '/text/to/speech/v1/voice')[0].body.files
    expect(file.type).toBe('audio/webm')
    expect(file.name).toBe('Recording 1.webm')
  })

  it('labels a Safari MP4 recording as MP4/m4a, not mp3', async () => {
    installRecorder({ mimeType: 'audio/mp4', supportedTypes: ['audio/mp4'] })
    await openAdd()
    await record()
    await stop()
    expect(within(screen.getByRole('list', { name: 'Samples' })).getByText(/MP4 audio/)).not.toBeNull()
    await user.type(screen.getByLabelText('Name'), 'Phone')
    await user.click(screen.getByLabelText(/This is my voice/))
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    await waitFor(() => expect(server.callsTo('POST', '/text/to/speech/v1/voice')).toHaveLength(1))
    const [file] = server.callsTo('POST', '/text/to/speech/v1/voice')[0].body.files
    expect(file.type).toBe('audio/mp4')
    expect(file.name).toBe('Recording 1.m4a')
  })

  it('stops by itself at 5:00', async () => {
    const recorder = installRecorder()
    await openAdd()
    await record()
    await tick(299000)
    expect(screen.getByRole('group', { name: 'Recording' })).not.toBeNull()
    await tick(2000)
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Recording' })).toBeNull())
    expect(within(screen.getByRole('list', { name: 'Samples' })).getByText(/5:00/)).not.toBeNull()
    expect(recorder.tracks[0].stop).toHaveBeenCalled()
  })

  it('counts a recording in progress toward the three-sample limit and blocks Create until it stops', async () => {
    installRecorder()
    await openAdd()
    await user.upload(screen.getByLabelText('Add audio files'), [fakeFile('a.mp3', 'audio/mpeg'), fakeFile('b.mp3', 'audio/mpeg')])
    await record()
    expect(screen.getByLabelText('Add audio files').disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Record a sample' }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('button', { name: 'Create voice' }).getAttribute('aria-disabled')).toBe('true')
    await stop()
    expect(within(screen.getByRole('list', { name: 'Samples' })).getAllByRole('listitem')).toHaveLength(3)
  })

  it('explains a blocked microphone and offers audio files instead', async () => {
    installRecorder({ deny: true })
    await openAdd()
    await record()
    const alert = await screen.findByText("Account can't use your microphone. Allow it in your browser's site settings, or add audio files instead.")
    expect(alert.closest('[role="alert"]')).not.toBeNull()
    expect(screen.queryByRole('group', { name: 'Recording' })).toBeNull()
    expect(screen.getByLabelText('Add audio files')).not.toBeNull()
  })

  it('hides Record when the browser cannot record, leaving audio files', async () => {
    removeRecorder()
    await openAdd()
    expect(screen.queryByRole('button', { name: 'Record a sample' })).toBeNull()
    expect(screen.getByLabelText('Add audio files')).not.toBeNull()
  })
})

describe('the microphone is always released', () => {
  it('on Cancel of the editor, discarding the take', async () => {
    const recorder = installRecorder()
    await openAdd()
    await record()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(recorder.tracks[0].stop).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: 'Add a voice' })).toBeNull()
  })

  it('on unmount', async () => {
    const recorder = installRecorder()
    await openAdd()
    await record()
    cleanup()
    expect(recorder.tracks[0].stop).toHaveBeenCalled()
  })

  it('on pagehide, without adding a sample', async () => {
    const recorder = installRecorder()
    await openAdd()
    await record()
    await act(async () => { window.dispatchEvent(new Event('pagehide')) })
    expect(recorder.tracks[0].stop).toHaveBeenCalled()
    expect(screen.queryByRole('group', { name: 'Recording' })).toBeNull()
    expect(screen.queryByText('Recording 1')).toBeNull()
  })

  it('on sign-out mid-recording', async () => {
    const recorder = installRecorder()
    await openAdd()
    await record()
    await act(async () => { await authStore.get().logout() })
    await screen.findByRole('heading', { level: 1, name: 'Your BakerRang account.' })
    expect(recorder.tracks[0].stop).toHaveBeenCalled()
  })

  it('and blob URLs are revoked with the editor', async () => {
    installRecorder()
    await openAdd()
    await record()
    await stop()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sample-1'))
  })
})
