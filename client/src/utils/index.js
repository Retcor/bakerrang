import { SERVER_PREFIX } from '../App.jsx'

export const request = (url, method, headers, body) => {
  const options = {
    credentials: 'include',
    method
  }

  if (headers) {
    options.headers = headers
  }

  if (body) {
    options.body = body
  }

  return fetch(url, options)
}

export const debounce = (func, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      func(...args)
    }, delay)
  }
}

export const blobToBase64 = (blob) => {
  return new Promise((resolve, _) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

export const getTextToSpeechAudioSrc = async (text, voice) => {
  const res = await request(`${SERVER_PREFIX}/text/to/speech/v1/convert/${voice}?prompt=${text}`, 'GET', {
    Accept: 'audio/mpeg'
  })
  const buffer = await res.arrayBuffer()
  const blob = new Blob([buffer], { type: 'audio/mpeg' })
  return URL.createObjectURL(blob)
}
