import { SERVER_PREFIX } from '../App.jsx'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

let csrfToken = null

const fetchCsrfToken = async () => {
  const res = await fetch(`${SERVER_PREFIX}/auth/csrf`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to obtain CSRF token')
  const data = await res.json()
  csrfToken = data.csrfToken
  return csrfToken
}

export const request = async (url, method = 'GET', headers, body) => {
  const verb = (method || 'GET').toUpperCase()
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

  const isMutating = MUTATING_METHODS.has(verb)
  if (isMutating) {
    if (!csrfToken) await fetchCsrfToken()
    options.headers = { ...(options.headers || {}), 'x-csrf-token': csrfToken }
  }

  let res = await fetch(url, options)

  // A rotated/expired CSRF token surfaces as a 403; refresh once and retry.
  if (isMutating && res.status === 403) {
    try {
      await fetchCsrfToken()
      options.headers = { ...(options.headers || {}), 'x-csrf-token': csrfToken }
      res = await fetch(url, options)
    } catch (err) {
      // Keep the original 403 response if we couldn't refresh the token.
    }
  }

  return res
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
  return new Promise((resolve) => {
    const reader = new window.FileReader()
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
