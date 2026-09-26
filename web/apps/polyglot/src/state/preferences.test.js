import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PAIR, readPair, readVoice, writePair, writeVoice } from './preferences.js'
import { LANGUAGES } from '../languages.js'

describe('Polyglot preferences', () => {
  it('keeps the approved legacy language set exact', () => {
    expect(LANGUAGES).toHaveLength(29)
    expect(LANGUAGES.map(({ code }) => code)).toEqual([
      'en-US', 'ar-EG', 'bg-BG', 'zh-CN', 'hr-HR', 'cs-CZ', 'da-DK', 'nl-NL', 'fi-FI', 'fil-PH',
      'fr-FR', 'de-DE', 'el-GR', 'hi-IN', 'id-ID', 'it-IT', 'ja-JP', 'ko-KR', 'ms-MY', 'pl-PL',
      'pt-BR', 'ro-RO', 'ru-RU', 'sk-SK', 'es-ES', 'sv-SE', 'ta-IN', 'tr-TR', 'uk-UA'
    ])
  })

  it('defaults to English into Spanish and rejects stale or same-language pairs', () => {
    expect(readPair({ getItem: () => null })).toEqual(DEFAULT_PAIR)
    expect(readPair({ getItem: () => JSON.stringify({ from: 'xx', to: 'es-ES' }) })).toEqual(DEFAULT_PAIR)
    expect(readPair({ getItem: () => JSON.stringify({ from: 'en-US', to: 'en-US' }) })).toEqual(DEFAULT_PAIR)
  })

  it('persists only the pair and selected voice and tolerates unavailable storage', () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn(() => 'voice-a') }
    writePair({ from: 'es-ES', to: 'en-US' }, storage)
    writeVoice('voice-a', storage)
    expect(storage.setItem.mock.calls.map(([key]) => key)).toEqual(['pg.pair', 'pg.voice'])
    expect(readVoice(storage)).toBe('voice-a')
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
    expect(readPair(broken)).toEqual(DEFAULT_PAIR)
    expect(() => writeVoice(null, broken)).not.toThrow()
  })
})
