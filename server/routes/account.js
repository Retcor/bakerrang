import express from 'express'
import { db } from '../client/firestoreClient.js'

export const THEME_PREFERENCES = Object.freeze(['light', 'dark', 'system'])

const hasValidTheme = (theme) => THEME_PREFERENCES.includes(theme)

export const createAccountRouter = ({ firestore = db } = {}) => {
  const router = express.Router()

  router.get('/preferences', async (req, res, next) => {
    try {
      const snapshot = await firestore.collection('users').doc(req.user.id).get()
      const theme = snapshot.exists ? snapshot.data()?.preferences?.theme : undefined
      res.set('Cache-Control', 'no-store')
      return res.json(hasValidTheme(theme) ? { theme } : {})
    } catch (error) {
      next(error)
    }
  })

  router.put('/preferences', async (req, res, next) => {
    const theme = req.body?.theme
    if (!hasValidTheme(theme) || Object.keys(req.body || {}).some((key) => key !== 'theme')) {
      return res.status(400).json({ error: 'theme must be light, dark, or system' })
    }

    try {
      const ref = firestore.collection('users').doc(req.user.id)
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref)
        const currentPreferences = snapshot.exists ? snapshot.data()?.preferences : undefined
        transaction.set(ref, {
          preferences: { ...(currentPreferences || {}), theme }
        }, { merge: true })
      })
      res.set('Cache-Control', 'no-store')
      return res.json({ theme })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default createAccountRouter()
