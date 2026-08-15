import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { doubleCsrf } from 'csrf-csrf'

// Local dev runs over plain http where Secure/__Host- cookies won't stick, so
// only tighten these when NODE_ENV is explicitly 'production'. This makes local
// development work out of the box; set NODE_ENV=production when deploying.
const isProd = process.env.NODE_ENV === 'production'

const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.SESSION_SECRET,
  getSessionIdentifier: (req) => req.sessionID || '',
  cookieName: isProd ? '__Host-bakerrang.x-csrf-token' : 'bakerrang.x-csrf-token',
  cookieOptions: { sameSite: 'lax', secure: isProd, httpOnly: true, path: '/' },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
})

export { generateCsrfToken }

// Double-submit CSRF protection. GET/HEAD/OPTIONS are ignored by the library.
// The public /chatbot endpoint (which may be embedded on other origins that
// can't fetch a token) is exempt. We also skip unauthenticated requests: they
// carry no privileges (isAuthenticated rejects them anyway) and lack a stable
// session id to bind the token to. CSRF attacks target logged-in users, so
// enforcing it on authenticated sessions is what matters.
export const csrfProtection = (req, res, next) => {
  if (req.path.startsWith('/chatbot')) return next()
  if (typeof req.isAuthenticated === 'function' && !req.isAuthenticated()) return next()
  return doubleCsrfProtection(req, res, next)
}

const limiter = (max) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false
})

export const authLimiter = limiter(100)
export const vaultLimiter = limiter(300)
export const tenantLimiter = limiter(300)
export const chatbotLimiter = limiter(60)

export const publicLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.params.tenantId}:${ipKeyGenerator(req.ip)}`
})
