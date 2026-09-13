import express from 'express'
import { timingSafeEqual } from 'node:crypto'
import { drainLeadNotifications } from '../services/leadNotificationService.js'

const authorized = (req, token) => {
  if (typeof token !== 'string' || !token) return false
  const supplied = Buffer.from(req.get('authorization') || '')
  const expected = Buffer.from(`Bearer ${token}`)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export const createInternalLeadNotificationRouter = ({
  drain = drainLeadNotifications,
  env = process.env
} = {}) => {
  const router = express.Router()
  router.post('/lead-notifications/drain', async (req, res) => {
    if (!authorized(req, env.INTERNAL_DRAIN_TOKEN)) return res.status(401).json({ error: 'Unauthorized' })
    try {
      res.json(await drain({ env }))
    } catch (error) {
      console.error('Lead notification drain failed:', error)
      res.status(500).json({ error: 'Lead notification drain failed' })
    }
  })
  return router
}

export default createInternalLeadNotificationRouter()
