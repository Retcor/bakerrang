import { jsonOrThrow, joinApiUrl } from '@bakerrang/web-api-client'

const readBlob = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(reader.error || new Error('Could not read recording'))
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
  reader.readAsDataURL(blob)
})

export const chunkSpeech = (text) => {
  if ([...text].length <= 400) return [text]
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
  const chunks = []
  for (const sentence of sentences) {
    const value = sentence.trim()
    if (!value) continue
    if ([...value].length > 220) {
      for (let start = 0; start < value.length; start += 220) chunks.push(value.slice(start, start + 220))
    } else if (chunks.length && [...`${chunks.at(-1)} ${value}`].length <= 220) {
      chunks[chunks.length - 1] += ` ${value}`
    } else chunks.push(value)
  }
  return chunks
}

let voicesPromise

export const createPolyglotApi = ({ apiClient, apiBaseUrl }) => ({
  transcribe: async (blob, lang, { signal } = {}) => {
    const audio = await readBlob(blob)
    const response = await jsonOrThrow(await apiClient.request('/text/to/speech/google/transcribe', { method: 'POST', body: { audio, lang }, signal }))
    return response.transcription || ''
  },
  translate: async (text, sourceLanguage, targetLanguage, { signal } = {}) => {
    const response = await jsonOrThrow(await apiClient.request('/chat/gpt/translate', { method: 'POST', body: { text, sourceLanguage, targetLanguage }, signal }))
    return response.translation
  },
  mintSpeech: async (voiceId, text, { signal } = {}) => {
    const response = await jsonOrThrow(await apiClient.request('/text/to/speech/v1/speech-tokens', { method: 'POST', body: { voiceId, text }, signal }))
    return joinApiUrl(apiBaseUrl, response.url)
  },
  listVoices: () => {
    voicesPromise ||= apiClient.getJson('/text/to/speech/v1/voices').catch((error) => { voicesPromise = null; throw error })
    return voicesPromise
  }
})

export const _resetVoiceCache = () => { voicesPromise = null }
