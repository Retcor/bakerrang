import { Configuration, OpenAIApi } from 'openai'

const openai = new OpenAIApi(
    new Configuration({
        apiKey: process.env.CHAT_GPT_API_KEY,
    })
)

export const prompt = async input => {
    console.log(`prompting for content ${input}`)
    const res = await openai.createChatCompletion({
        model: "gpt-4",
        messages: [{role: "user", content: input}],
    });
    const reply = res.data.choices[0].message.content
    console.log(reply)
    return reply
}

export const image = async input => {
    console.log(`prompting for image content ${input}`)
    try {
        const res = await openai.createImage({
            prompt: `In the style of a children's book, generate me an image based off this text: ${input}`,
            n: 1,
            size: "256x256",
            response_format: "b64_json"
        });
        if (res.status === 200) {
            return res?.data.data[0].b64_json || ''
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
    return prompt(`Tell me a 3 paragraph story about: ${input}`)
}