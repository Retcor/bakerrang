import express from 'express'
import {
  v1ConvertTextToSpeech, v1GetLanguages,
  v1GetVoices
} from '../services/textToSpeechService.js'

const router = express.Router()
router.get('/v1/voices', async (req, res, next) => {
  try {
    res.send(await v1GetVoices(req.user.id))
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

router.get('/v1/languages', async (req, res, next) => {
  try {
    res.send(await v1GetLanguages())
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

router.get('/v1/convert/:voiceId', async (req, res, next) => {
  try {
    const ttsResponse = await v1ConvertTextToSpeech(req.query.prompt, req.params.voiceId)
    res.send(ttsResponse.data)
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

export default router
