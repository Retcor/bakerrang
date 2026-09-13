import { resolveFirestoreProject } from './firestoreConfig.js'
import { resolveMediaBucketName } from './mediaConfig.js'

const requireValue = (env, name, message) => {
  const value = env[name]
  if (typeof value !== 'string' || !value.trim()) throw new Error(message)
  return value.trim()
}

const requireHttpOrigin = (env, name) => {
  const value = requireValue(env, name, `${name} is required.`)
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) throw new Error()
    return url.origin
  } catch {
    throw new Error(`${name} must be a valid absolute HTTP/HTTPS origin.`)
  }
}

const validateOptionalHttpOrigin = (env, name) => {
  const value = env[name]
  if (typeof value !== 'string' || !value.trim()) return null
  return requireHttpOrigin(env, name)
}

export const validateServerRuntimeConfig = (env = process.env) => {
  const firestoreProjectId = resolveFirestoreProject(env)
  const mediaBucketName = resolveMediaBucketName(env)
  requireValue(env, 'SESSION_SECRET', 'SESSION_SECRET is not set. Refusing to start with an insecure session secret.')
  requireValue(env, 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_ID is required.')
  requireValue(env, 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_SECRET is required.')
  const serverOrigin = requireHttpOrigin(env, 'SERVER_DOMAIN')
  validateOptionalHttpOrigin(env, 'CLIENT_DOMAIN')
  requireHttpOrigin(env, 'PORTAL_DOMAIN')
  requireHttpOrigin(env, 'SITE_RENDERER_DOMAIN')

  if (env.NODE_ENV === 'production') {
    requireValue(env, 'PREVIEW_TOKEN_SECRET', 'PREVIEW_TOKEN_SECRET is not set. Refusing to start without preview signing.')
    requireValue(env, 'RESEND_API_KEY', 'RESEND_API_KEY is required for lead notifications.')
    requireValue(env, 'LEAD_NOTIFICATION_FROM', 'LEAD_NOTIFICATION_FROM is required for lead notifications.')
    requireValue(env, 'INTERNAL_DRAIN_TOKEN', 'INTERNAL_DRAIN_TOKEN is required for the internal notification drain.')
  }

  return { firestoreProjectId, mediaBucketName, serverOrigin }
}
