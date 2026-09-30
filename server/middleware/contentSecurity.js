import rateLimit from 'express-rate-limit'

export const noStore = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
}

const userKey = (req) => `u:${req.user.id}`

export const translateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many translation requests. Please wait a moment.' }
})

export const speechLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many speech requests. Please wait a moment.' }
})

// Voice management (Account). Per authenticated user, mounted after isAuthenticated.
export const voiceCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' }
})

export const voiceEditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' }
})
