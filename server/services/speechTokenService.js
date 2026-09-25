import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const TOKEN_VERSION = 1
const TOKEN_TTL_MS = 5 * 60 * 1000
const AAD = Buffer.from('speech-token-v1')
const SALT = Buffer.from('bakerrang-speech-token')
const INFO = Buffer.from('v1')

const getKey = () => Buffer.from(hkdfSync('sha256', Buffer.from(process.env.SESSION_SECRET || ''), SALT, INFO, 32))

export const createSpeechToken = ({ userId, voiceId, text, now = Date.now() }) => {
  const expiresAt = now + TOKEN_TTL_MS
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  cipher.setAAD(AAD)
  const plaintext = Buffer.from(JSON.stringify({ v: TOKEN_VERSION, uid: userId, vid: voiceId, t: text, exp: expiresAt }))
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    token: Buffer.concat([iv, ciphertext, tag]).toString('base64url'),
    expiresAt: new Date(expiresAt).toISOString()
  }
}

export const readSpeechToken = (token, { userId, now = Date.now() }) => {
  try {
    const bytes = Buffer.from(String(token || ''), 'base64url')
    if (bytes.length < 29) return null
    const iv = bytes.subarray(0, 12)
    const tag = bytes.subarray(bytes.length - 16)
    const ciphertext = bytes.subarray(12, bytes.length - 16)
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
    decipher.setAAD(AAD)
    decipher.setAuthTag(tag)
    const payload = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'))
    if (payload?.v !== TOKEN_VERSION || payload.uid !== userId || payload.exp <= now) return null
    if (typeof payload.vid !== 'string' || typeof payload.t !== 'string') return null
    return payload
  } catch {
    return null
  }
}

export { TOKEN_TTL_MS }
