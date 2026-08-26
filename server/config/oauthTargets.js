const TARGET_ENV_KEYS = Object.freeze({
  client: 'CLIENT_DOMAIN',
  portal: 'PORTAL_DOMAIN'
})

const httpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

export const isValidOAuthTarget = (target) =>
  Object.hasOwn(TARGET_ENV_KEYS, target)

export const oauthTargetFromQuery = (target) => {
  if (target === undefined) return 'client'
  if (!isValidOAuthTarget(target)) {
    throw httpError(400, 'Invalid OAuth target')
  }
  return target
}

export const resolveOAuthTarget = (target = 'client', env = process.env) => {
  if (!isValidOAuthTarget(target)) {
    throw httpError(500, 'Invalid stored OAuth target')
  }

  const envKey = TARGET_ENV_KEYS[target]
  const url = env[envKey]
  if (!url) {
    throw httpError(500, `${envKey} is not configured`)
  }
  return url
}

export const consumeOAuthTarget = (session, env = process.env) => {
  const target = session && session.oauthTarget !== undefined
    ? session.oauthTarget
    : 'client'
  if (session) delete session.oauthTarget
  return resolveOAuthTarget(target, env)
}
