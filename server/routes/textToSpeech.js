import express from 'express'
import {
  convertTextToSpeech, deleteVoice, getGoogleTextToSpeech, getLanguages,
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

router.post('/google/transcribe', async (req, res, next) => {
  try {
    res.send(await getGoogleTextToSpeech(req.body.audio, req.body.lang))
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

router.put('/v1/voices', async (req, res, next) => {
  if (!req.body.voices || !Array.isArray(req.body.voices)) {
    return res.status(400).json({ error: 'Invalid input, expected an array of voices.' });
  }

  const results = await Promise.allSettled(req.body.voices.map(voice => {
    return processVoiceUpdate(req.user.id, voice);
  }));

  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
  const successes = results.filter(result => result.status === 'fulfilled').map(result => result.value);

  if (errors.length > 0) {
    console.error('Errors encountered:', errors);
  }

  res.json({
    successes: successes,
    warnings: errors.length > 0 ? errors : undefined
  });
});

const processVoiceUpdate = async (userId, voice) => {
  if (!voice.id) {
    throw new Error(`Voice record ${voice.name} is missing an identifier.`);
  }

  const canModify = await userCanAccess(userId, voice.id, 'voices');
  if (!canModify) {
    throw new Error(`Not authorized to access voice record ${voice.name}.`);
  }

  try {
    return await postVoice(userId, voice);
  } catch (error) {
    console.error(`Failed to process voice ${voice.name}:`, error);
    throw error;
  }
}

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
