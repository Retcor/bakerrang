import { languageByCode } from '../languages.js'

export const DEFAULT_PAIR = Object.freeze({ from: 'en-US', to: 'es-ES' })

export const readPair = (storage = globalThis.localStorage) => {
  try {
    const pair = JSON.parse(storage.getItem('pg.pair'))
    if (languageByCode(pair?.from) && languageByCode(pair?.to) && pair.from !== pair.to) return pair
  } catch {}
  return { ...DEFAULT_PAIR }
}

export const writePair = (pair, storage = globalThis.localStorage) => {
  try { storage.setItem('pg.pair', JSON.stringify(pair)) } catch {}
}

export const readVoice = (storage = globalThis.localStorage) => {
  try { return storage.getItem('pg.voice') } catch { return null }
}

export const writeVoice = (voiceId, storage = globalThis.localStorage) => {
  try {
    if (voiceId) storage.setItem('pg.voice', voiceId)
    else storage.removeItem('pg.voice')
  } catch {}
}
