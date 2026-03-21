import express from 'express'
import { askChatbot } from '../services/chatbotService.js'
import { convertTextToSpeech } from '../services/textToSpeechService.js'

const router = express.Router()

// POST /chatbot/ask
// Body: { question: string, history: [{role: 'user'|'assistant', content: string}] }
// Returns: { answer: string }
router.post('/ask', async (req, res) => {
  try {
    const { question, history } = req.body
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required' })
    }
    const answer = await askChatbot(question.trim(), history || [])
    res.json({ answer })
  } catch (err) {
    console.error('Chatbot ask error:', err)
    res.status(500).json({ error: 'Failed to generate a response' })
  }
})

// GET /chatbot/speak?text=...
// Streams ElevenLabs TTS audio using Dan's configured voice (CHATBOT_VOICE_ID)
router.get('/speak', async (req, res) => {
  try {
    const { text } = req.query
    if (!text) {
      return res.status(400).json({ error: 'text is required' })
    }
    const voiceId = process.env.CHATBOT_VOICE_ID
    if (!voiceId) {
      return res.status(500).json({ error: 'CHATBOT_VOICE_ID is not configured on the server' })
    }
    const ttsResponse = await convertTextToSpeech(text, voiceId)
    res.setHeader('Content-Type', 'audio/mpeg')
    ttsResponse.data.pipe(res)
  } catch (err) {
    console.error('Chatbot speak error:', err)
    res.status(500).json({ error: 'Failed to generate audio' })
  }
})

export default router
