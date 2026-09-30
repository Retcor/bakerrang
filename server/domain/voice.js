// Account-owned cloned voices (`voices/{elevenLabsVoiceId}`).
// The only voice shape that leaves the server, and the only fields a client can set.
export const VOICE_NAME_MAX = 60
export const VOICE_DESCRIPTION_MAX = 200

const codePointLength = (value) => [...value].length

export const validVoiceId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)

// Trimmed name of 1..60 characters, or null when invalid.
export const cleanVoiceName = (value) => {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name && codePointLength(name) <= VOICE_NAME_MAX ? name : null
}

// Trimmed description of 0..200 characters ('' when absent), or null when invalid.
export const cleanVoiceDescription = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return null
  const description = value.trim()
  return codePointLength(description) <= VOICE_DESCRIPTION_MAX ? description : null
}

// Built field by field, never a spread: `userId` and any stray stored field stay server-side.
export const toVoiceRecord = (id, data = {}) => ({
  id: typeof data.id === 'string' && data.id ? data.id : id,
  name: typeof data.name === 'string' ? data.name : '',
  description: typeof data.description === 'string' ? data.description : '',
  isPrimary: data.isPrimary === true
})
