import axios from 'axios'
import { db } from '../client/firestoreClient.js'
import { v1p1beta1 as speech } from '@google-cloud/speech'
const apiKey = process.env.ELEVEN_LABS_API_KEY
const baseUrl = 'https://api.elevenlabs.io'
const modelId = 'eleven_multilingual_v2'
const speechToTextClient = new speech.SpeechClient()

export const convertTextToSpeech = async (input, voice = 'MjGS5hZkkMThMX72MRqu') => {
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

export const getVoices = async userId => {
  const query = db
    .collection('voices')
    .where('userId', '==', userId)
  const snapshot = await query.get()

  if (snapshot.size > 0) {
    return snapshot.docs.map(doc => doc.data())
  } else {
    return []
  }
}

export const getLanguages = async () => {
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

export const getGoogleTextToSpeech = async (audioBytes, lang) => {
  const audio = {
    content: audioBytes,
  };
  const config = {
    languageCode: lang,
    enableAutomaticPunctuation: true,
  };
  const request = {
    audio: audio,
    config: config,
  };

  const [response] = await speechToTextClient.recognize(request);
  const transcription = response.results
    .map(result => result.alternatives[0].transcript)
    .join('\n');
  return { transcription }
}

export const postVoice = async (userId, voice, files) => {
  const url = `${baseUrl}/v1/voices/${voice.id ? `${voice.id}/edit` : 'add'}`
  const formData = new FormData()
  formData.append('name', voice.name)
  formData.append('description', voice.description)

  if (files && files.length) {
    // Append each file to the new FormData object
    files.forEach((file, index) => {
      const blob = new Blob([file.buffer], { type: file.mimetype })
      formData.append('files', blob, file.originalname)
    })
  }

  const options = {
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
      'xi-api-key': apiKey
    },
    data: formData
  }

  // Save at 3rd party vendor
  const postVoiceRes = await axios(options)

  // Now save it on our side so we can associate it to a user
  const updatedVoice = postVoiceRes.data
  // Update the voice id if it's returned. It's only returned if it's a new record
  if (updatedVoice?.voice_id) {
    voice.id = updatedVoice.voice_id
  }

  const collection = db.collection('voices')

  try {
    // Check if the record already exists
    const existingDoc = await collection.doc(voice.id).get()
    voice.userId = userId

    if (existingDoc.exists) {
      // Update the existing record
      await collection.doc(voice.id).update(voice)
      console.log(`Voice record with ID ${voice.id} already exists. Updating with any new details.`)
    } else {
      // Store a new record
      await collection.doc(voice.id).set(voice)
      console.log(`New voice record with ID ${voice.id} stored successfully.`)
    }
  } catch (error) {
    console.error('Error checking or storing voice record:', error)
  }

  return voice
}

export const deleteVoice = async (userId, voiceId) => {
  const url = `${baseUrl}/v1/voices/${voiceId}`
  const options = {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey
    }
  }

  // Delete from 3rd party vendor
  await axios(url, options)
  // Now delete it on our side
  const collection = db.collection('voices')

  try {
    // Check if the record already exists
    const existingDoc = await collection.doc(voiceId).get()

    if (existingDoc.exists) {
      // Update the existing record
      await collection.doc(voiceId).delete()
      console.log(`Voice record with ID ${voiceId} deleted successfully.`)
    }
  } catch (error) {
    console.error('Error deleting voice record:', error)
  }
}
