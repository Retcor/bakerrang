import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_VERSION = 'v1'
const TOKEN_TTL_SECONDS = 15 * 60
const INVALID_PREVIEW_MESSAGE = 'Preview authorization failed'

const httpError = (status, message) => Object.assign(new Error(message), { status })

const secretOf = (options) => {
  const secret = options?.secret ?? process.env.PREVIEW_TOKEN_SECRET
  if (typeof secret !== 'string' || !secret) {
    throw new Error('PREVIEW_TOKEN_SECRET is not configured')
  }
  return secret
}

const nowSeconds = (options) => Math.floor((options?.now ?? Date.now()) / 1000)

const invalidPreviewToken = () => httpError(401, INVALID_PREVIEW_MESSAGE)

const encode = (value) => Buffer.from(value).toString('base64url')

const decode = (value) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalidPreviewToken()
  const decoded = Buffer.from(value, 'base64url')
  if (decoded.toString('base64url') !== value) throw invalidPreviewToken()
  return decoded
}

const signatureFor = (version, payload, secret) => createHmac('sha256', secret)
  .update(`${version}.${payload}`)
  .digest()

export const createPreviewToken = (tenantId, options = {}) => {
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new TypeError('tenantId is required')
  }
  const issuedAt = nowSeconds(options)
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS
  const payload = encode(JSON.stringify({ tenantId, iat: issuedAt, exp: expiresAt }))
  const signature = signatureFor(TOKEN_VERSION, payload, secretOf(options)).toString('base64url')
  return {
    token: `${TOKEN_VERSION}.${payload}.${signature}`,
    expiresAt
  }
}

export const verifyPreviewToken = (token, options = {}) => {
  const secret = secretOf(options)
  if (typeof token !== 'string') throw invalidPreviewToken()
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) throw invalidPreviewToken()

  const suppliedSignature = decode(parts[2])
  const expectedSignature = signatureFor(parts[0], parts[1], secret)
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) throw invalidPreviewToken()

  let payload
  try {
    payload = JSON.parse(decode(parts[1]).toString('utf8'))
  } catch (error) {
    if (error?.status === 401) throw error
    throw invalidPreviewToken()
  }

  if (
    !payload || typeof payload !== 'object' || Array.isArray(payload) ||
    Object.keys(payload).sort().join(',') !== 'exp,iat,tenantId' ||
    typeof payload.tenantId !== 'string' || !payload.tenantId ||
    !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) ||
    payload.iat > nowSeconds(options) || payload.exp <= payload.iat ||
    payload.exp <= nowSeconds(options)
  ) throw invalidPreviewToken()

  return payload
}

export const previewTokenTtlSeconds = TOKEN_TTL_SECONDS
