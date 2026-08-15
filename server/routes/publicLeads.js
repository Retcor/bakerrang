import express from 'express'
import * as leadService from '../services/leadService.js'
import { publicLeadLimiter } from '../middleware/security.js'

const handle = (fn) => async (req, res) => {
  try {
    res.status(201).json(await fn(req))
  } catch (error) {
    const status = error.status || 500
    if (status >= 500) console.error(error)
    res.status(status).json({
      error: status >= 500 ? 'Lead submission failed' : error.message
    })
  }
}

export const createPublicLeadRouter = (deps = {}) => {
  const service = deps.leadService || leadService
  const limiter = deps.publicLeadLimiter || publicLeadLimiter
  const router = express.Router()

  router.post(
    '/sites/:tenantId/leads',
    limiter,
    express.json({ limit: '16kb' }),
    handle((req) => service.createPublicLead(req.params.tenantId, req.body))
  )

  router.use((error, req, res, next) => {
    if (error && error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' })
    }
    next(error)
  })

  return router
}

export default createPublicLeadRouter()
