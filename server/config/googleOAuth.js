export const buildGoogleStrategyOptions = (env = process.env) => ({
  clientID: env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  callbackURL: `${env.SERVER_DOMAIN}/auth/google/callback`,
  state: true
})
