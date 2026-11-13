export const buildAllowedOrigins = (env = process.env) => [
  env.LAUNCHER_DOMAIN,
  env.STORYBOOK_DOMAIN,
  env.POLYGLOT_DOMAIN,
  env.SIGN_DOMAIN,
  env.BUDGET_DOMAIN,
  env.PASSWORDS_DOMAIN,
  env.ACCOUNT_DOMAIN,
  env.CHATBOT_ORIGIN
].filter(Boolean)

export const isOriginAllowed = (origin, allowedOrigins) =>
  !origin || allowedOrigins.includes(origin)

export const createCorsOptionsDelegate = ({ allowedOrigins }) => (req, callback) => {
  const origin = req.get('Origin')
  if (isOriginAllowed(origin, allowedOrigins)) return callback(null, { origin: true, credentials: true })
  return callback(new Error(`CORS: origin ${origin} not allowed`))
}
