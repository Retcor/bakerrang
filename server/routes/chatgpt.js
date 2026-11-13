import express from 'express'
import { image, promptStory, translateUtterance } from '../services/chatgptService.js'
import { POLYGLOT_LANGUAGES } from '../domain/polyglotLanguages.js'
import { noStore, translateLimiter } from '../middleware/contentSecurity.js'
import { logProviderError } from '../logging/providerError.js'
const router = express.Router()

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const codePointLength = (value) => [...value].length

const invalid = (res, scope, field) => res.status(400).json({ error: `Invalid ${scope} request`, field })

router.post('/translate', noStore, translateLimiter, async (req, res) => {
  if (!isPlainObject(req.body)) return invalid(res, 'translation', 'body')
  if (typeof req.body.text !== 'string') return invalid(res, 'translation', 'text')
  const text = req.body.text.trim()
  if (codePointLength(text) < 1 || codePointLength(text) > 2000) return invalid(res, 'translation', 'text')
  if (!Object.hasOwn(POLYGLOT_LANGUAGES, req.body.sourceLanguage)) return invalid(res, 'translation', 'sourceLanguage')
  if (!Object.hasOwn(POLYGLOT_LANGUAGES, req.body.targetLanguage)) return invalid(res, 'translation', 'targetLanguage')
  if (req.body.sourceLanguage === req.body.targetLanguage) return invalid(res, 'translation', 'targetLanguage')

  try {
    const translation = await translateUtterance({
      text,
      sourceCode: req.body.sourceLanguage,
      targetCode: req.body.targetLanguage
    })
    res.json({ translation })
  } catch (error) {
    logProviderError('translate', error)
    res.status(502).json({ error: 'Translation failed' })
  }
})

router.post('/story', noStore, async (req, res) => {
  if (!isPlainObject(req.body) || typeof req.body.idea !== 'string') return invalid(res, 'story', 'body')
  const idea = req.body.idea.trim()
  if (codePointLength(idea) < 1 || codePointLength(idea) > 1000) return invalid(res, 'story', 'body')
  try {
    res.type('text/plain').send(await promptStory(idea))
  } catch (error) {
    logProviderError('story', error)
    res.status(502).json({ error: 'Story failed' })
  }
})

router.post('/image', noStore, async (req, res) => {
  if (!isPlainObject(req.body) || typeof req.body.prompt !== 'string') return invalid(res, 'image', 'body')
  const input = req.body.prompt.trim()
  if (codePointLength(input) < 1 || codePointLength(input) > 10000) return invalid(res, 'image', 'body')
  try {
    res.type('text/plain').send(await image(input))
  } catch (error) {
    logProviderError('image', error)
    res.status(502).json({ error: 'Story failed' })
  }
})

export default router
