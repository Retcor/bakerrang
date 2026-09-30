import express from 'express'
import { db } from '../client/firestoreClient.js'

export const THEME_PREFERENCES = Object.freeze(['light', 'dark', 'system'])

const hasValidTheme = (theme) => THEME_PREFERENCES.includes(theme)

// Fixed-shape 5xx: the client gets one message and the log gets {code, name}
// only, never a body, an id or an email.
const failed = (res, routeId, error) => {
  console.error(`[account] ${routeId} failed`, { code: error?.code, name: error?.name })
  return res.status(500).json({ error: 'Account request failed' })
}

export const createAccountRouter = ({ firestore = db } = {}) => {
  const router = express.Router()

  router.get('/preferences', async (req, res) => {
    try {
      const snapshot = await firestore.collection('users').doc(req.user.id).get()
      const theme = snapshot.exists ? snapshot.data()?.preferences?.theme : undefined
      return res.json(hasValidTheme(theme) ? { theme } : {})
    } catch (error) {
      return failed(res, 'preferences-get', error)
    }
  })

  router.put('/preferences', async (req, res) => {
    const theme = req.body?.theme
    if (!hasValidTheme(theme) || Object.keys(req.body || {}).some((key) => key !== 'theme')) {
      return res.status(400).json({ error: 'theme must be light, dark, or system' })
    }

    try {
      const ref = firestore.collection('users').doc(req.user.id)
      // Read-merge-write in one transaction, and only `preferences.theme` changes:
      // every other preferences key and user field survives. The client never
      // supplies a whole object, so stale client state cannot replace anything.
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref)
        const currentPreferences = snapshot.exists ? snapshot.data()?.preferences : undefined
        transaction.set(ref, {
          preferences: { ...(currentPreferences || {}), theme }
        }, { merge: true })
      })
      return res.json({ theme })
    } catch (error) {
      return failed(res, 'preferences-put', error)
    }
  })

  return router
}

export default createAccountRouter()
