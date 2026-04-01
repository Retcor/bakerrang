import express from 'express'
import path, { dirname } from 'path'
import cookieParser from 'cookie-parser'
import logger from 'morgan'
import cors from 'cors'

import authRouter, { isAuthenticated } from './routes/auth.js'
import chatgptRouter from './routes/chatgpt.js'
import textToSpeechRouter from './routes/textToSpeech.js'
import superMarketRouter from './routes/superMarket.js'
import budgetRouter from './routes/budget.js'
import storybookRouter from './routes/storybook.js'
import chatbotRouter from './routes/chatbot.js'
import signLanguageRouter from './routes/signLanguage.js'
import wowRouter from './routes/wow.js'
import { fileURLToPath } from 'url'

import passport from 'passport'
import session from 'express-session'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

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

app.use(session({ secret: 'bakerrang-not-bangarang', resave: true, saveUninitialized: true }))

app.use(passport.initialize())
app.use(passport.session())

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

app.use('/chatbot', chatbotRouter)
app.use('/auth', authRouter)
app.use('/chat/gpt', isAuthenticated, chatgptRouter)
app.use('/text/to/speech', isAuthenticated, textToSpeechRouter)
app.use('/supermarket', isAuthenticated, superMarketRouter)
app.use('/budget', isAuthenticated, budgetRouter)
app.use('/storybook', isAuthenticated, storybookRouter)
app.use('/sign-language', isAuthenticated, signLanguageRouter)
app.use('/wow', isAuthenticated, wowRouter)

app.get('/health', (req, res) => {
  res.status(200).send('Healthy')
})

app.get('/', (req, res) => {
  res.status(200).send('Healthy')
})

export default app
