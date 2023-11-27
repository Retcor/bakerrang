import express from 'express'
import {
  convertTextToSpeech, deleteVoice, getLanguages,
  getVoices, postVoice
} from '../services/textToSpeechService.js'
import multipart from '../multer.js'
import { userCanAccess } from '../client/firestoreClient.js'

const router = express.Router()
router.get('/v1/voices', async (req, res, next) => {
  try {
    res.send(await getVoices(req.user.id))
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

router.get('/v1/languages', async (req, res, next) => {
  try {
    res.send(await getLanguages())
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

router.get('/v1/convert/:voiceId', async (req, res, next) => {
  const canModify = await userCanAccess(req.user.id, req.params.voiceId, 'voices')
  if (!canModify) {
    res.status(403).json({ error: 'Not authorized to access this voice record.' })
  }

  try {
    const ttsResponse = await convertTextToSpeech(req.query.prompt, req.params.voiceId)
    res.send(ttsResponse.data)
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

router.post('/v1/voice', multipart.array('files', 3), async (req, res, next) => {
  if (req.body.id) {
    const canModify = await userCanAccess(req.user.id, req.body.id, 'voices')
    if (!canModify) {
      res.status(403).json({ error: 'Not authorized to access this voice record.' })
    }
  }

  try {
    const postVoiceRes = await postVoice(req.user.id, req.body, req.files)
    res.send(postVoiceRes)
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

router.delete('/v1/voice/:voiceId', multipart.array('files'), async (req, res, next) => {
  const canModify = await userCanAccess(req.user.id, req.params.voiceId, 'voices')
  if (!canModify) {
    res.status(403).json({ error: 'Not authorized to access this voice record.' })
  }

  try {
    await deleteVoice(req.user.id, req.params.voiceId)
    res.status(200).send({ message: `Successfully deleted voice ${req.params.voiceId}` })
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

export default router
