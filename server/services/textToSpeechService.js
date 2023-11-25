import axios from 'axios'
import db from '../client/firestoreClient.js'
const apiKey = process.env.ELEVEN_LABS_API_KEY
const baseUrl = 'https://api.elevenlabs.io'
const modelId = 'eleven_multilingual_v2'

export const v1ConvertTextToSpeech = async (input, voice = 'MjGS5hZkkMThMX72MRqu') => {
  const url = `${baseUrl}/v1/text-to-speech/${voice}?optimize_streaming_latency=4&output_format=mp3_44100_128`
  const options = {
    method: 'POST',
    headers: {
      accept: 'audio/mpeg',
      'content-type': 'application/json',
      'xi-api-key': apiKey
    },
    responseType: 'arraybuffer',
    data: {
      text: input,
      model_id: modelId,
      voice_settings: {
        stability: 0,
        similarity_boost: 0,
        style: 0,
        use_speaker_boost: true
      }
    }
  }

  return axios(url, options)
}

export const v1GetVoices = async userId => {
  const query = db
    .collection('voices')
    .where('user_id', '==', userId)
  const snapshot = await query.get()

  if (snapshot.size > 0) {
    return snapshot.docs.map(doc => doc.data())
  } else {
    return []
  }
}

export const v1GetLanguages = async () => {
  const url = `${baseUrl}/v1/models`
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'xi-api-key': apiKey
    }
  }

  const response = await axios(url, options)
  if (response.data) {
    const multiLingualModel = response.data.filter(model => model.model_id === modelId)[0]
    return multiLingualModel.languages.map(language => language.name)
  }
}
