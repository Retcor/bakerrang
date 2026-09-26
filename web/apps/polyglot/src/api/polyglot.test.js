// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { chunkSpeech, createPolyglotApi } from './polyglot.js'

describe('Polyglot API', () => {
  it('uses body-based translation and speech requests and forwards AbortSignals', async () => {
    const signal = new AbortController().signal
    const request = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ translation: 'Hola' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ url: '/text/to/speech/v1/speech/opaque' }) })
    const api = createPolyglotApi({ apiClient: { request }, apiBaseUrl: 'https://api.example' })
    expect(await api.translate('Hello & goodbye?', 'en-US', 'es-ES', { signal })).toBe('Hola')
    expect(await api.mintSpeech('voice-1', 'Hola & adiós?', { signal })).toBe('https://api.example/text/to/speech/v1/speech/opaque')
    expect(request.mock.calls[0]).toEqual(['/chat/gpt/translate', { method: 'POST', body: { text: 'Hello & goodbye?', sourceLanguage: 'en-US', targetLanguage: 'es-ES' }, signal }])
    expect(request.mock.calls[1]).toEqual(['/text/to/speech/v1/speech-tokens', { method: 'POST', body: { voiceId: 'voice-1', text: 'Hola & adiós?' }, signal }])
    expect(JSON.stringify(request.mock.calls)).not.toContain('?prompt=')
    expect(JSON.stringify(request.mock.calls)).not.toContain('Hola%20')
  })

  it('posts transcription audio as body data without a data-URL prefix', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ transcription: 'Hello' }) })
    const api = createPolyglotApi({ apiClient: { request }, apiBaseUrl: 'https://api.example' })
    const signal = new AbortController().signal
    expect(await api.transcribe(new Blob(['audio-bytes'], { type: 'audio/webm' }), 'en-US', { signal })).toBe('Hello')
    expect(request).toHaveBeenCalledWith('/text/to/speech/google/transcribe', expect.objectContaining({
      method: 'POST',
      body: { audio: expect.not.stringContaining('data:'), lang: 'en-US' },
      signal
    }))
  })

  it('keeps short speech in one request and chunks long speech below the token limit', () => {
    expect(chunkSpeech('Short sentence.')).toEqual(['Short sentence.'])
    const chunks = chunkSpeech(`${'A'.repeat(210)}. ${'B'.repeat(210)}.`)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => [...chunk].length <= 220)).toBe(true)
  })
})
