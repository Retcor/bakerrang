import express from 'express'
import {
  convertTextToSpeech, deleteVoice, getDeepgramTranscription, getLanguages,
  getVoices, postVoice
} from '../services/textToSpeechService.js'
import multipart from '../multer.js'
import { userCanAccess } from '../client/firestoreClient.js'
import { createSpeechToken, readSpeechToken } from '../services/speechTokenService.js'
import { noStore, speechLimiter } from '../middleware/contentSecurity.js'
import { logProviderError } from '../logging/providerError.js'

const router = express.Router()
router.get('/v1/voices', async (req, res, next) => {
  try {
    res.send(await getVoices(req.user.id))
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
const validVoiceId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
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

router.post('/v1/voice', multipart.array('files', 3), async (req, res, next) => {
  if (req.body.id) {
    const canModify = await userCanAccess(req.user.id, req.body.id, 'voices')
    if (!canModify) {
      return res.status(403).json({ error: 'Not authorized to access this voice record.' })
    }
  }

  try {
    const postVoiceRes = await postVoice(req.user.id, req.body, req.files)
    res.send(postVoiceRes)
  } catch (error) {
    logProviderError('voice-save', error)
    res.status(500).json({ error: 'Voice save failed' })
  }
})

router.put('/v1/voices', async (req, res, next) => {
  if (!req.body.voices || !Array.isArray(req.body.voices)) {
    return res.status(400).json({ error: 'Invalid input, expected an array of voices.' })
  }

  const results = await Promise.allSettled(req.body.voices.map(voice => {
    return processVoiceUpdate(req.user.id, voice)
  }))

  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
  const successes = results.filter(result => result.status === 'fulfilled').map(result => result.value)

  if (errors.length > 0) {
    errors.forEach((error) => logProviderError('voice-update', error))
  }

  res.json({
    successes,
    warnings: errors.length > 0 ? errors.map(() => ({ error: 'Voice update failed' })) : undefined
  })
})

const processVoiceUpdate = async (userId, voice) => {
  if (!voice.id) {
    throw new Error(`Voice record ${voice.name} is missing an identifier.`)
  }

  const canModify = await userCanAccess(userId, voice.id, 'voices')
  if (!canModify) {
    throw new Error(`Not authorized to access voice record ${voice.name}.`)
  }

  try {
    return await postVoice(userId, voice)
  } catch (error) {
    logProviderError('voice-update', error)
    throw error
  }
}

router.delete('/v1/voice/:voiceId', multipart.array('files'), async (req, res, next) => {
  const canModify = await userCanAccess(req.user.id, req.params.voiceId, 'voices')
  if (!canModify) {
    return res.status(403).json({ error: 'Not authorized to access this voice record.' })
  }

  try {
    await deleteVoice(req.user.id, req.params.voiceId)
    res.status(200).send({ message: `Successfully deleted voice ${req.params.voiceId}` })
  } catch (error) {
    logProviderError('voice-delete', error)
    res.status(500).json({ error: 'Voice delete failed' })
  }
})

export default router
