import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.CHAT_GPT_API_KEY,
})

export const prompt = async input => {
  console.log(`prompting for content ${input.substring(0, 50)}`)
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: input }]
  })
  return res.choices[0].message.content
}

export const image = async input => {
  console.log(`prompting for image content ${input.substring(0, 50)}`)
  try {
    const imagePrompt = await prompt(`Based off this story text meant for kids, can you generate a safe prompt that I can send to Dall-E to generate an image based on the main point of the story? The story text is: ${input}`)
    console.log(`imagePrompt: ${imagePrompt}`)
    const res = await openai.images.generate({
      model: "dall-e-3",
      prompt: `${imagePrompt}`,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json'
    })
    if (res.created) {
      return res?.data[0].b64_json || ''
    } else {
      return ''
    }
  } catch (e) {
    console.log(e)
    return ''
  }
}

export const translate = async (language, input) => {
  return prompt(`Translate this to ${language} and only return the translation: ${input}`)
}

export const promptStory = async input => {
  return prompt(`Tell me a 3 paragraph story about: ${input}`)
}
