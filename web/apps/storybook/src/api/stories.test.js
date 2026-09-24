import { describe, expect, it, vi } from 'vitest'
import { createStoriesApi } from './stories.js'

describe('Story Book API', () => {
  it('encodes ideas, generated text, ids, and narration prompts', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('ok') })
    const api = createStoriesApi({ apiClient: { request, getJson: vi.fn() }, apiBaseUrl: 'https://api.example.test' })
    await api.writeStory('cats & dogs?')
    await api.drawPage('before / ', 'now & then?')
    expect(request.mock.calls[0][0]).toContain('cats%20%26%20dogs%3F')
    expect(request.mock.calls[1][0]).toContain('before%20%2F%20now%20%26%20then%3F')
    expect(api.narrationUrl('voice/id', 'read & listen?')).toContain('/voice%2Fid?prompt=read%20%26%20listen%3F')
  })

  it('uses an empty previous-page prompt for the first illustration', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('image') })
    const api = createStoriesApi({ apiClient: { request }, apiBaseUrl: '' })
    await api.drawPage('', 'Page one')
    expect(decodeURIComponent(request.mock.calls[0][0])).toContain('prompt=Page one')
    expect(request.mock.calls[0][0]).not.toContain('undefined')
  })
})
