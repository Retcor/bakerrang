const TARGET_ENV_KEYS = Object.freeze({
  launcher: 'LAUNCHER_DOMAIN',
  storybook: 'STORYBOOK_DOMAIN',
  polyglot: 'POLYGLOT_DOMAIN',
  sign: 'SIGN_DOMAIN',
  budget: 'BUDGET_DOMAIN',
  passwords: 'PASSWORDS_DOMAIN',
  account: 'ACCOUNT_DOMAIN'
})

const httpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

// Used when a login starts without ?target= (every web app passes one).
export const DEFAULT_OAUTH_TARGET = 'launcher'

export const isValidOAuthTarget = (target) =>
  Object.hasOwn(TARGET_ENV_KEYS, target)

export const oauthTargetFromQuery = (target) => {
  if (target === undefined) return DEFAULT_OAUTH_TARGET
  if (!isValidOAuthTarget(target)) {
    throw httpError(400, 'Invalid OAuth target')
  }
  return target
}

export const resolveOAuthTarget = (target = DEFAULT_OAUTH_TARGET, env = process.env) => {
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
    : DEFAULT_OAUTH_TARGET
  if (session) delete session.oauthTarget
  return resolveOAuthTarget(target, env)
}
