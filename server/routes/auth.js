import express from 'express'
import passport from 'passport'
import { checkAndStoreUser } from '../services/authService.js'
import { generateCsrfToken } from '../middleware/security.js'
import {
  consumeOAuthTarget,
  oauthTargetFromQuery,
  resolveOAuthTarget
} from '../config/oauthTargets.js'
const router = express.Router()

export const GOOGLE_AUTH_OPTIONS = Object.freeze({
  scope: [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ]
})

export const GOOGLE_CALLBACK_AUTH_OPTIONS = Object.freeze({
  failureRedirect: `${process.env.CLIENT_DOMAIN}/login`,
  keepSessionInfo: true
})

const saveSession = (req) => new Promise((resolve, reject) => {
  if (!req.session || typeof req.session.save !== 'function') {
    return reject(new Error('Session is unavailable'))
  }
  req.session.save((error) => error ? reject(error) : resolve())
})

// Middleware to check if the user is authenticated
export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next()
  }
  res.status(401).json({ isAuthenticated: false, message: 'User not authenticated' })
}

export const rememberOAuthTarget = (env = process.env) => async (req, res, next) => {
  let target
  try {
    target = oauthTargetFromQuery(req.query && req.query.target)
    // Validate configuration before redirecting the browser away to Google.
    resolveOAuthTarget(target, env)
  } catch (error) {
    if (error.status >= 500) console.error('OAuth target configuration failed:', error)
    return res.status(error.status || 500).json({
      error: error.status === 400 ? error.message : 'OAuth configuration error'
    })
  }

  req.session.oauthTarget = target
  try {
    await saveSession(req)
    next()
  } catch (error) {
    next(error)
  }
}

export const createOAuthCallbackHandler = ({
  env = process.env,
  storeUser = checkAndStoreUser
} = {}) => async (req, res, next) => {
  await storeUser(req.user)

  let redirectUrl
  let targetError
  try {
    redirectUrl = consumeOAuthTarget(req.session, env)
  } catch (error) {
    targetError = error
  }

  try {
    // Persist removal of the one-time target before redirecting or reporting a
    // configuration problem so it cannot leak into a later login attempt.
    await saveSession(req)
  } catch (error) {
    return next(error)
  }

  if (targetError) {
    console.error('OAuth callback target resolution failed:', targetError)
    return res.status(500).json({ error: 'OAuth configuration error' })
  }
  res.redirect(redirectUrl)
}

router.get('/google',
  rememberOAuthTarget(),
  passport.authenticate('google', GOOGLE_AUTH_OPTIONS)
)

router.get('/google/callback',
  passport.authenticate('google', GOOGLE_CALLBACK_AUTH_OPTIONS),
  createOAuthCallbackHandler()
)

router.get('/check', isAuthenticated, (req, res) => {
  res.json({ isAuthenticated: true, user: req.user })
})

// Issues a CSRF token (and sets the paired cookie) for the client to attach
// as the `x-csrf-token` header on state-changing requests.
router.get('/csrf', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) })
})

export const logoutHandler = (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' })
    }
    return res.status(200).json({ message: 'Logged out successfully!' })
  })
}

// GET remains temporarily for the existing BakerRang client. New consumers
// use the CSRF-protected POST route.
router.get('/logout', logoutHandler)
router.post('/logout', logoutHandler)

export default router
