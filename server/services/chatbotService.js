import { FieldValue } from '@google-cloud/firestore'
import { OpenAI } from 'openai'
import { db } from '../client/firestoreClient.js'

const openai = new OpenAI({ apiKey: process.env.CHAT_GPT_API_KEY })
const COLLECTION = 'resume_chunks'

const SYSTEM_PROMPT = `You are an AI assistant representing Dan Baker on his professional portfolio website.
You answer questions from potential employers and recruiters about Dan's background, skills, and experience.
Speak in first person as Dan. Be professional, enthusiastic, and concise (2-4 sentences per response unless
more detail is specifically requested). If you don't have information to confidently answer something, say so
honestly rather than guessing. Your goal is to help the visitor understand whether Dan would be a good fit
for their team.`

export const embedText = async (text) => {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  })
  return res.data[0].embedding
}

export const storeChunk = async (id, content, metadata) => {
  const embedding = await embedText(content)
  await db.collection(COLLECTION).doc(id).set({
    content,
    embedding: FieldValue.vector(embedding),
    metadata,
    updatedAt: new Date().toISOString()
  })
}

export const searchChunks = async (question, limit = 5) => {
  const queryEmbedding = await embedText(question)
  const vectorQuery = db.collection(COLLECTION).findNearest(
    'embedding',
    FieldValue.vector(queryEmbedding),
    { limit, distanceMeasure: 'COSINE' }
  )
  const snapshot = await vectorQuery.get()
  return snapshot.docs.map(doc => doc.data().content)
}

export const askChatbot = async (question, history = []) => {
  const contextChunks = await searchChunks(question)
  const context = contextChunks.join('\n\n---\n\n')

  const systemWithContext = `${SYSTEM_PROMPT}

Use the following information about Dan to answer the question:
${context}`

  const messages = [
    { role: 'system', content: systemWithContext },
    ...history.slice(-6),
    { role: 'user', content: question }
  ]

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages
  })

  return res.choices[0].message.content
}
