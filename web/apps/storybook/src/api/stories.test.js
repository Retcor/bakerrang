import { describe, expect, it, vi } from 'vitest'
import { createStoriesApi } from './stories.js'

describe('Story Book API', () => {
  it('keeps story prompts and narration text in POST bodies, never URLs', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('ok') })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('ok') })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ url: '/text/to/speech/v1/speech/opaque-token' }) })
    const api = createStoriesApi({ apiClient: { request, getJson: vi.fn() }, apiBaseUrl: 'https://api.example.test' })
    await api.writeStory('cats & dogs?')
    await api.drawPage('before / ', 'now & then?')
    const narrationUrl = await api.narrationUrl('voice-id', 'read & listen?')
    expect(request.mock.calls[0]).toEqual(['/chat/gpt/story', { method: 'POST', body: { idea: 'cats & dogs?' }, signal: undefined }])
    expect(request.mock.calls[1]).toEqual(['/chat/gpt/image', { method: 'POST', body: { prompt: 'before / now & then?' }, signal: undefined }])
    expect(request.mock.calls[2]).toEqual(['/text/to/speech/v1/speech-tokens', { method: 'POST', body: { voiceId: 'voice-id', text: 'read & listen?' }, signal: undefined }])
    expect(narrationUrl).toBe('https://api.example.test/text/to/speech/v1/speech/opaque-token')
    expect(JSON.stringify(request.mock.calls)).not.toContain('?prompt=')
  })

  it('uses an empty previous-page prompt for the first illustration', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('image') })
    const api = createStoriesApi({ apiClient: { request }, apiBaseUrl: '' })
    await api.drawPage('', 'Page one')
    expect(request.mock.calls[0][0]).toBe('/chat/gpt/image')
    expect(request.mock.calls[0][1].body.prompt).toBe('Page one')
  })
})
