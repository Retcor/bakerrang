import express from 'express'
import OpenAI from 'openai'
const router = express.Router()
const openai = new OpenAI({ apiKey: process.env.CHAT_GPT_API_KEY })

router.post('/interpret', async (req, res, next) => {
  try {
    const { image } = req.body
    if (!image) return res.status(400).json({ error: 'No image provided' })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${image}`, detail: 'low' }
          },
          {
            type: 'text',
            text: 'This image may show someone making an ASL sign. What single word or very short phrase are they signing? Reply with only the word or phrase in plain text. If no recognizable ASL sign is visible, reply with nothing at all.'
          }
        ]
      }]
    })

    const word = response.choices[0].message.content?.trim() || ''
    res.json({ word })
  } catch (err) {
    next(err)
  }
})

export default router
