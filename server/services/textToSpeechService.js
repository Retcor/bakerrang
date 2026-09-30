import axios from 'axios'
import { db } from '../client/firestoreClient.js'
import { toVoiceRecord } from '../domain/voice.js'
import { VOICE_AUDIO_TYPES, voiceMimeType } from '../multer.js'
import { createClient as createDeepgramClient } from '@deepgram/sdk'
let httpClient = axios
export const _setHttpClient = (client) => { httpClient = client || axios }
let firestore = db
export const _setDb = (database) => { firestore = database || db }
const apiKey = process.env.ELEVEN_LABS_API_KEY
const baseUrl = 'https://api.elevenlabs.io'
const modelId = 'eleven_multilingual_v2'
const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY)

export const convertTextToSpeech = async (input, voice = 'MjGS5hZkkMThMX72MRqu') => {
  const url = `${baseUrl}/v1/text-to-speech/${voice}?optimize_streaming_latency=4&output_format=mp3_44100_128`
  const options = {
    method: 'POST',
    headers: {
      accept: 'audio/mpeg',
      'content-type': 'application/json',
      'xi-api-key': apiKey
    },
    responseType: 'stream',
    data: {
      text: input,
      model_id: modelId,
      voice_settings: {
        stability: 0,
        similarity_boost: 0,
        style: 0,
        use_speaker_boost: true
      }
    }
  }

  return httpClient(url, options)
}

export class VoiceNotFoundError extends Error {
  constructor () { super('Voice not found'); this.name = 'VoiceNotFoundError' }
}

// Anything the provider (or our own write-after-provider) got wrong. The cause is
// kept for fixed-shape logging (`{status, code, name}` only) and never sent to a client.
export class VoiceProviderError extends Error {
  constructor (cause) { super('Voice provider request failed'); this.name = 'VoiceProviderError'; this.cause = cause }
}

const PROVIDER_TIMEOUT_MS = 90000
const voices = () => firestore.collection('voices')

const isProviderGone = (error) => (error?.response?.status ?? error?.status) === 404

export const listVoices = async userId => {
  const snapshot = await voices().where('userId', '==', userId).get()
  return snapshot.docs.map(doc => toVoiceRecord(doc.id, doc.data()))
}
export const getVoices = listVoices

// Structural ownership: the voice document's `userId` is the only authority.
const readOwnedVoice = async (userId, voiceId) => {
  const snapshot = await voices().doc(voiceId).get()
  const data = snapshot.exists ? snapshot.data() : null
  return data && data.userId === userId ? data : null
}
export const userOwnsVoice = async (userId, voiceId) => Boolean(await readOwnedVoice(userId, voiceId))

const sampleForm = (name, description, files = []) => {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('description', description)
  files.forEach((file, index) => {
    const type = voiceMimeType(file.mimetype)
    // Neutral names: the browser's original filename never reaches the provider.
    formData.append('files', new Blob([file.buffer], { type }), `sample-${index + 1}.${VOICE_AUDIO_TYPES[type]}`)
  })
  return formData
}

const providerPost = (path, formData, timeout = PROVIDER_TIMEOUT_MS) => httpClient({
  url: `${baseUrl}${path}`,
  method: 'POST',
  headers: { 'Content-Type': 'multipart/form-data', 'xi-api-key': apiKey },
  data: formData,
  timeout
})

const providerDelete = (voiceId) => httpClient({
  url: `${baseUrl}/v1/voices/${voiceId}`,
  method: 'DELETE',
  headers: { 'xi-api-key': apiKey },
  timeout: 30000
})

// Creates the clone at the provider, then records it against the user. The first
// voice a user owns becomes primary (decided inside the write transaction).
export const createVoice = async (userId, { name, description, consent = false }, files, now = Date.now()) => {
  let voiceId
  try {
    const response = await providerPost('/v1/voices/add', sampleForm(name, description, files))
    voiceId = response?.data?.voice_id
  } catch (error) {
    throw new VoiceProviderError(error)
  }
  if (typeof voiceId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(voiceId)) {
    throw new VoiceProviderError(new Error('Provider returned no voice id'))
  }

  const ref = voices().doc(voiceId)
  let record
  try {
    await firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(voices().where('userId', '==', userId))
      const collision = await transaction.get(ref)
      if (collision.exists) throw new Error('Voice id already recorded')
      record = {
        id: voiceId,
        userId,
        name,
        description,
        isPrimary: existing.size === 0,
        createdAt: now,
        updatedAt: now,
        ...(consent ? { consentConfirmedAt: now } : {})
      }
      transaction.set(ref, record)
    })
  } catch (error) {
    // The clone exists at the provider but nothing points at it. Try to remove it.
    await providerDelete(voiceId).catch(() => {})
    throw new VoiceProviderError(error)
  }
  return toVoiceRecord(voiceId, record)
}

// Edits the provider copy first (it requires a name), then merge-writes only the
// approved fields. `fields.isPrimary` is honored solely for the legacy "Update All".
export const updateVoice = async (userId, voiceId, { name, description, isPrimary }, files = [], now = Date.now()) => {
  const current = await readOwnedVoice(userId, voiceId)
  if (!current) throw new VoiceNotFoundError()
  const nextName = name ?? toVoiceRecord(voiceId, current).name
  const nextDescription = description ?? toVoiceRecord(voiceId, current).description
  try {
    await providerPost(`/v1/voices/${voiceId}/edit`, sampleForm(nextName, nextDescription, files), 30000)
  } catch (error) {
    throw new VoiceProviderError(error)
  }

  const ref = voices().doc(voiceId)
  let record
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const data = snapshot.exists ? snapshot.data() : null
    if (!data || data.userId !== userId) throw new VoiceNotFoundError()
    const changes = { name: nextName, description: nextDescription, updatedAt: now }
    if (typeof isPrimary === 'boolean') changes.isPrimary = isPrimary
    transaction.set(ref, changes, { merge: true })
    record = { ...data, ...changes }
  })
  return toVoiceRecord(voiceId, record)
}

// One transaction: exactly one primary (the target) among the user's existing voices.
// A voice deleted meanwhile is skipped and never recreated.
export const setPrimaryVoice = async (userId, voiceId) => {
  const snapshot = await voices().where('userId', '==', userId).get()
  const refs = snapshot.docs.map(doc => voices().doc(doc.id))
  if (!refs.some(ref => ref.id === voiceId)) throw new VoiceNotFoundError()

  return firestore.runTransaction(async (transaction) => {
    const current = await transaction.getAll(...refs)
    const owned = current.filter(doc => doc.exists && doc.data().userId === userId)
    if (!owned.some(doc => doc.id === voiceId)) throw new VoiceNotFoundError()
    const records = []
    for (const doc of owned) {
      const isPrimary = doc.id === voiceId
      if ((doc.data().isPrimary === true) !== isPrimary) transaction.set(voices().doc(doc.id), { isPrimary }, { merge: true })
      records.push(toVoiceRecord(doc.id, { ...doc.data(), isPrimary }))
    }
    return records
  })
}

// A voice already gone at the provider (404) counts as deleted; any other provider
// failure keeps our record. No replacement primary is chosen here.
export const deleteVoice = async (userId, voiceId) => {
  if (!await userOwnsVoice(userId, voiceId)) throw new VoiceNotFoundError()
  try {
    await providerDelete(voiceId)
  } catch (error) {
    if (!isProviderGone(error)) throw new VoiceProviderError(error)
  }
  await voices().doc(voiceId).delete()
}

export const getLanguages = async () => {
  const url = `${baseUrl}/v1/models`
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'xi-api-key': apiKey
    }
  }

  const response = await httpClient(url, options)
  if (response.data) {
    const multiLingualModel = response.data.filter(model => model.model_id === modelId)[0]
    return multiLingualModel.languages.map(language => language.name)
  }
}

export const getDeepgramTranscription = async (audioBase64, lang) => {
  const audioBuffer = Buffer.from(audioBase64, 'base64')
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: 'nova-2',
      smart_format: true,
      language: lang || 'en-US'
    }
  )
  if (error) throw error
  const transcription = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
  return { transcription }
}
