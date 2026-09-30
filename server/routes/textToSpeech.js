import express from 'express'
import {
  convertTextToSpeech, createVoice, deleteVoice, getDeepgramTranscription, getLanguages,
  listVoices, setPrimaryVoice, updateVoice, userOwnsVoice, VoiceNotFoundError
} from '../services/textToSpeechService.js'
import { voiceUpload } from '../multer.js'
import { userCanAccess } from '../client/firestoreClient.js'
import { createSpeechToken, readSpeechToken } from '../services/speechTokenService.js'
import { noStore, speechLimiter, voiceCreateLimiter, voiceEditLimiter } from '../middleware/contentSecurity.js'
import { logProviderError } from '../logging/providerError.js'
import { cleanVoiceDescription, cleanVoiceName, validVoiceId } from '../domain/voice.js'

const router = express.Router()

// Voices are account-private data: no voice-management response is ever cached.
// (`/v1/voices` and `/v1/voice` are separate path segments, so both are listed.)
router.use(['/v1/voices', '/v1/voice'], noStore)

router.get('/v1/voices', async (req, res, next) => {
  try {
    res.json(await listVoices(req.user.id))
  } catch (error) {
    logProviderError('voices', error)
    res.status(500).json({ error: 'Voices failed' })
  }
})

router.get('/v1/languages', async (req, res, next) => {
  try {
    res.send(await getLanguages())
  } catch (error) {
    logProviderError('languages', error)
    res.status(500).json({ error: 'Languages failed' })
  }
})

router.get('/v1/convert/:voiceId', async (req, res, next) => {
  const canModify = await userCanAccess(req.user.id, req.params.voiceId, 'voices')
  if (!canModify) {
    return res.status(403).json({ error: 'Not authorized to access this voice record.' })
  }

  try {
    const ttsResponse = await convertTextToSpeech(req.query.prompt, req.params.voiceId)
    res.setHeader('Content-Type', 'audio/mpeg')
    ttsResponse.data.pipe(res)
  } catch (error) {
    logProviderError('speech-legacy', error)
    if (res.headersSent) return res.destroy()
    res.status(500).json({ error: 'Speech failed' })
  }
})

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const codePointLength = (value) => [...value].length

router.post('/v1/speech-tokens', noStore, speechLimiter, async (req, res) => {
  if (!isPlainObject(req.body)) return res.status(400).json({ error: 'Invalid speech request', field: 'body' })
  if (!validVoiceId(req.body.voiceId)) return res.status(400).json({ error: 'Invalid speech request', field: 'voiceId' })
  if (typeof req.body.text !== 'string') return res.status(400).json({ error: 'Invalid speech request', field: 'text' })
  const text = req.body.text.trim()
  if (codePointLength(text) < 1 || codePointLength(text) > 500) return res.status(400).json({ error: 'Invalid speech request', field: 'text' })

  try {
    if (!await userCanAccess(req.user.id, req.body.voiceId, 'voices')) {
      return res.status(404).json({ error: 'Voice not found' })
    }
    const minted = createSpeechToken({ userId: req.user.id, voiceId: req.body.voiceId, text })
    res.json({ url: `/text/to/speech/v1/speech/${minted.token}`, expiresAt: minted.expiresAt })
  } catch (error) {
    logProviderError('speech-token', error)
    res.status(500).json({ error: 'Speech failed' })
  }
})

router.get('/v1/speech/:token', noStore, async (req, res) => {
  const payload = readSpeechToken(req.params.token, { userId: req.user.id })
  if (!payload) return res.status(404).json({ error: 'Speech not found' })
  try {
    if (!await userCanAccess(req.user.id, payload.vid, 'voices')) {
      return res.status(404).json({ error: 'Speech not found' })
    }
    const ttsResponse = await convertTextToSpeech(payload.t, payload.vid)
    res.setHeader('Content-Type', 'audio/mpeg')
    ttsResponse.data.pipe(res)
  } catch (error) {
    logProviderError('speech', error)
    if (res.headersSent) return res.destroy()
    res.status(502).json({ error: 'Speech failed' })
  }
})

router.post('/google/transcribe', async (req, res, next) => {
  try {
    res.send(await getDeepgramTranscription(req.body.audio, req.body.lang))
  } catch (error) {
    logProviderError('transcribe', error)
    res.status(500).json({ error: 'Transcription failed' })
  }
})

const LEGACY_FORBIDDEN = { error: 'Not authorized to access this voice record.' }

// Create (no `id`) or, for the legacy client, edit-with-files (an `id` in the body).
// Only name, description, consent and the sample files are read from the request.
router.post('/v1/voice', voiceCreateLimiter, voiceUpload, async (req, res) => {
  const body = isPlainObject(req.body) ? req.body : {}
  const files = req.files || []

  if (body.id !== undefined && body.id !== '') {
    if (!validVoiceId(body.id)) return res.status(400).json({ error: 'Invalid voice', field: 'name' })
    const name = cleanVoiceName(body.name)
    const description = cleanVoiceDescription(body.description)
    if (name === null) return res.status(400).json({ error: 'Invalid voice', field: 'name' })
    if (description === null) return res.status(400).json({ error: 'Invalid voice', field: 'description' })
    try {
      return res.json(await updateVoice(req.user.id, body.id, { name, description }, files))
    } catch (error) {
      if (error instanceof VoiceNotFoundError) return res.status(403).json(LEGACY_FORBIDDEN)
      logProviderError('voice-save', error.cause || error)
      return res.status(500).json({ error: 'Voice save failed' })
    }
  }

  const name = cleanVoiceName(body.name)
  if (name === null) return res.status(400).json({ error: 'Invalid voice', field: 'name' })
  const description = cleanVoiceDescription(body.description)
  if (description === null) return res.status(400).json({ error: 'Invalid voice', field: 'description' })
  if (files.length < 1 || files.length > 3) return res.status(400).json({ error: 'Invalid voice', field: 'files' })

  try {
    res.json(await createVoice(req.user.id, { name, description, consent: body.consent === 'true' }, files))
  } catch (error) {
    logProviderError('voice-create', error.cause || error)
    res.status(502).json({ error: "Voice couldn't be created" })
  }
})

router.patch('/v1/voices/:voiceId', voiceEditLimiter, async (req, res) => {
  if (!validVoiceId(req.params.voiceId)) return res.status(400).json({ error: 'Invalid voice' })
  const body = isPlainObject(req.body) ? req.body : {}
  const hasName = Object.hasOwn(body, 'name')
  const hasDescription = Object.hasOwn(body, 'description')
  if (!hasName && !hasDescription) return res.status(400).json({ error: 'Invalid voice', field: 'name' })
  const name = hasName ? cleanVoiceName(body.name) : undefined
  const description = hasDescription ? cleanVoiceDescription(body.description) : undefined
  if (name === null) return res.status(400).json({ error: 'Invalid voice', field: 'name' })
  if (description === null) return res.status(400).json({ error: 'Invalid voice', field: 'description' })

  try {
    res.json(await updateVoice(req.user.id, req.params.voiceId, { name, description }))
  } catch (error) {
    if (error instanceof VoiceNotFoundError) return res.status(404).json({ error: 'Voice not found' })
    logProviderError('voice-rename', error.cause || error)
    res.status(502).json({ error: "Voice couldn't be renamed" })
  }
})

router.put('/v1/voices/primary', voiceEditLimiter, async (req, res) => {
  const voiceId = isPlainObject(req.body) ? req.body.voiceId : undefined
  if (!validVoiceId(voiceId)) return res.status(400).json({ error: 'Invalid voice' })
  try {
    res.json(await setPrimaryVoice(req.user.id, voiceId))
  } catch (error) {
    if (error instanceof VoiceNotFoundError) return res.status(404).json({ error: 'Voice not found' })
    logProviderError('voice-primary', error)
    res.status(500).json({ error: 'Voice update failed' })
  }
})

// Legacy client only ("Update All"); removed at the final cleanup. Each voice is
// ownership-checked and only name, description and isPrimary are ever stored.
router.put('/v1/voices', voiceEditLimiter, async (req, res) => {
  if (!req.body.voices || !Array.isArray(req.body.voices)) {
    return res.status(400).json({ error: 'Invalid input, expected an array of voices.' })
  }

  const results = await Promise.allSettled(req.body.voices.map(voice => processVoiceUpdate(req.user.id, voice)))
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
  const successes = results.filter(result => result.status === 'fulfilled').map(result => result.value)

  errors.forEach((error) => logProviderError('voice-update', error.cause || error))
  res.json({
    successes,
    warnings: errors.length > 0 ? errors.map(() => ({ error: 'Voice update failed' })) : undefined
  })
})

const processVoiceUpdate = async (userId, voice) => {
  if (!isPlainObject(voice) || !validVoiceId(voice.id)) throw new Error('Voice record is missing an identifier.')
  const name = cleanVoiceName(voice.name)
  const description = cleanVoiceDescription(voice.description)
  if (name === null || description === null) throw new Error('Voice record is invalid.')
  if (!await userOwnsVoice(userId, voice.id)) throw new Error('Not authorized to access this voice record.')
  return updateVoice(userId, voice.id, { name, description, isPrimary: voice.isPrimary === true })
}

router.delete('/v1/voice/:voiceId', voiceEditLimiter, async (req, res) => {
  if (!validVoiceId(req.params.voiceId)) return res.status(400).json({ error: 'Invalid voice' })
  try {
    await deleteVoice(req.user.id, req.params.voiceId)
    res.status(200).json({ success: true, message: `Successfully deleted voice ${req.params.voiceId}` })
  } catch (error) {
    if (error instanceof VoiceNotFoundError) return res.status(403).json(LEGACY_FORBIDDEN)
    logProviderError('voice-delete', error.cause || error)
    res.status(502).json({ error: "Voice couldn't be deleted" })
  }
})

export default router
