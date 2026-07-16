import express from 'express'
import passport from 'passport'
import { checkAndStoreUser } from '../services/authService.js'
import { generateCsrfToken } from '../middleware/security.js'
const router = express.Router()

// Middleware to check if the user is authenticated
export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next()
  }
  res.status(401).json({ isAuthenticated: false, message: 'User not authenticated' })
}

router.get('/google',
  passport.authenticate('google', {
    scope: ['https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email']
  })
)

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_DOMAIN}/login` }),
  async (req, res) => {
    await checkAndStoreUser(req.user)

    // If authentication is successful, Passport.js has already updated req.user and the session.
    // Redirect the user to a different route on the frontend.
    res.redirect(process.env.CLIENT_DOMAIN)
  }
)

router.get('/check', isAuthenticated, (req, res) => {
  res.json({ isAuthenticated: true, user: req.user })
})

// Issues a CSRF token (and sets the paired cookie) for the client to attach
// as the `x-csrf-token` header on state-changing requests.
router.get('/csrf', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) })
})

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' })
    }
    return res.status(200).json({ message: 'Logged out successfully!' })
  })
})

export default router
