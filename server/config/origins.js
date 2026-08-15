export const buildAllowedOrigins = (env = process.env) => [
  env.CLIENT_DOMAIN,
  env.PORTAL_DOMAIN,
  env.SITE_RENDERER_DOMAIN,
  env.CHATBOT_ORIGIN
].filter(Boolean)

export const isOriginAllowed = (origin, allowedOrigins) =>
  !origin || allowedOrigins.includes(origin)
