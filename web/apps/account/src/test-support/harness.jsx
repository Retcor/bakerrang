import React from 'react'
import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { App } from '../App.jsx'
import { AppProviders } from '../providers.jsx'

// jsdom has no matchMedia, blob URLs, scrollIntoView or media playback.
export const installBrowserStubs = ({ reducedMotion = false, online = true } = {}) => {
  let urlCount = 0
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
  URL.createObjectURL = vi.fn(() => `blob:sample-${++urlCount}`)
  URL.revokeObjectURL = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  globalThis.CSS = globalThis.CSS || { escape: (value) => String(value) }
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
  const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), addEventListener: vi.fn() }
  window.Audio = vi.fn(() => audio)
  return { audio }
}

export const setOnline = (online) => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
  act(() => { window.dispatchEvent(new Event(online ? 'online' : 'offline')) })
}

export const resetBrowserState = () => {
  document.cookie = 'br_theme=; Path=/; Max-Age=0'
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.remove('dark')
  window.history.replaceState(null, '', '/')
}

export const renderApp = (path = '/') => render(
  <MemoryRouter initialEntries={[path]}>
    <AppProviders>
      <App />
    </AppProviders>
  </MemoryRouter>
)

// A file the size a test asks for, without allocating it.
export const fakeFile = (name, type, size = 2048) => {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// A controllable MediaRecorder/getUserMedia pair for the recorder tests.
export const installRecorder = ({ mimeType = 'audio/webm;codecs=opus', supportedTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'], deny = false } = {}) => {
  const tracks = [{ stop: vi.fn() }]
  const stream = { getTracks: () => tracks }
  const instances = []
  class FakeRecorder {
    constructor (streamArg, options = {}) {
      this.stream = streamArg
      this.requested = options.mimeType
      this.mimeType = mimeType
      this.state = 'inactive'
      this.listeners = {}
      instances.push(this)
    }

    static isTypeSupported (type) { return supportedTypes.includes(type) }
    addEventListener (name, handler) { this.listeners[name] = handler }
    start () { this.state = 'recording' }
    stop () {
      this.state = 'inactive'
      this.listeners.dataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: this.mimeType }) })
      this.listeners.stop?.()
    }
  }
  window.MediaRecorder = FakeRecorder
  const getUserMedia = deny ? vi.fn(() => Promise.reject(new DOMException('denied', 'NotAllowedError'))) : vi.fn(() => Promise.resolve(stream))
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  return { tracks, instances, getUserMedia }
}

export const removeRecorder = () => {
  delete window.MediaRecorder
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
}
