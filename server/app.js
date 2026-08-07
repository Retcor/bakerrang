import express from 'express'
import path, { dirname } from 'path'
import cookieParser from 'cookie-parser'
import logger from 'morgan'
import cors from 'cors'
import helmet from 'helmet'

import { FirestoreSessionStore } from './client/firestoreSessionStore.js'
import { csrfProtection, authLimiter, vaultLimiter, chatbotLimiter } from './middleware/security.js'

import authRouter, { isAuthenticated } from './routes/auth.js'
import chatgptRouter from './routes/chatgpt.js'
import textToSpeechRouter from './routes/textToSpeech.js'
import superMarketRouter from './routes/superMarket.js'
import budgetRouter from './routes/budget.js'
import storybookRouter from './routes/storybook.js'
import chatbotRouter from './routes/chatbot.js'
import signLanguageRouter from './routes/signLanguage.js'
import wowRouter from './routes/wow.js'
import vaultRouter from './routes/vault.js'
import { fileURLToPath } from 'url'

import passport from 'passport'
import session from 'express-session'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

// Trust the upstream proxy so req.secure reflects X-Forwarded-Proto behind
// TLS termination (used by the 'auto' secure-cookie setting below).
app.set('trust proxy', 1)

// The client is served from a different origin than this API (a separate port
// in dev, CLIENT_DOMAIN vs SERVER_DOMAIN in prod). Helmet defaults
// Cross-Origin-Resource-Policy to 'same-origin', which blocks the browser from
// loading cross-origin no-cors subresources like <audio src> / <img src>
// (fetch() is unaffected — it's governed by CORS instead). Relax CORP to
// 'cross-origin' so TTS audio and similar media load in the client.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

const allowedOrigins = [process.env.CLIENT_DOMAIN, process.env.CHATBOT_ORIGIN].filter(Boolean)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true
}))
app.use(logger('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set. Refusing to start with an insecure session secret.')
}

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new FirestoreSessionStore(),
  cookie: {
    // 'auto' = Secure only when the connection is actually HTTPS, so the
    // cookie is stored over plain http://localhost in local dev but stays
    // Secure in production (behind the trusted TLS proxy).
    secure: 'auto',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
  }
}))

app.use(passport.initialize())
app.use(passport.session())

// CSRF protection for all state-changing requests (skips GET/HEAD/OPTIONS and
// the public /chatbot route). Must come after session + cookie-parser.
app.use(csrfProtection)

passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  callbackURL: `${process.env.SERVER_DOMAIN}/auth/google/callback`
}, (token, tokenSecret, profile, done) => {
  const authUser = {
    id: profile.id,
    displayName: profile.displayName,
    email: profile.emails[0].value,
    photo: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null
  }
  done(null, authUser)
}))

app.use('/chatbot', chatbotLimiter, chatbotRouter)
app.use('/auth', authLimiter, authRouter)
app.use('/chat/gpt', isAuthenticated, chatgptRouter)
app.use('/text/to/speech', isAuthenticated, textToSpeechRouter)
app.use('/supermarket', isAuthenticated, superMarketRouter)
app.use('/budget', isAuthenticated, budgetRouter)
app.use('/storybook', isAuthenticated, storybookRouter)
app.use('/sign-language', isAuthenticated, signLanguageRouter)
app.use('/wow', isAuthenticated, wowRouter)
app.use('/vault', vaultLimiter, isAuthenticated, vaultRouter)

app.get('/health', (req, res) => {
  res.status(200).send('Healthy')
})

app.get('/', (req, res) => {
  res.status(200).send('Healthy')
})

export default app
