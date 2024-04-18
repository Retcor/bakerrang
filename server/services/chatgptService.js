import { OpenAI  } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.CHAT_GPT_API_KEY,
  organization: process.env.ORGANIZATION_ID,
  project: process.env.PROJECT_ID,
})

export const prompt = async input => {
  console.log(`prompting for content ${input.substring(0, 50)}`)
  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: input }]
  })
  return res.choices[0].message.content
}

export const image = async input => {
  console.log(`prompting for image content ${input.substring(0, 50)}`)
  try {
    const res = await openai.images.generate({
      prompt: `Generate an image based on a summary of the following text: ${input}`,
      n: 1,
      size: '256x256',
      response_format: 'b64_json'
    })
    if (res.created) {
      return res?.data[0].b64_json || ''
    } else {
      return ''
    }
  } catch (e) {
    return ''
  }
}

export const translate = async (language, input) => {
  return prompt(`Translate this to ${language} and only return the translation: ${input}`)
}

export const promptStory = async input => {
  return prompt(`Tell me a 1 paragraph story about: ${input}`)
}
