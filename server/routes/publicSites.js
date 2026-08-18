import express from 'express'
import * as siteService from '../services/siteService.js'
import * as siteDomainService from '../services/siteDomainService.js'

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (error) {
    const status = error.status || 500
    if (status >= 500) console.error(error)
    res.status(status).json({
      error: status >= 500 ? 'Public site operation failed' : error.message
    })
  }
}

export const createPublicSiteRouter = (deps = {}) => {
  const service = deps.siteService || siteService
  const domains = deps.siteDomainService || siteDomainService
  const router = express.Router()

  router.get('/domains/:hostname', handle(
    (req) => domains.resolveActiveDomain(req.params.hostname)
  ))

  router.get('/sites/:tenantId/domain', handle(
    (req) => domains.getActiveDomainForTenant(req.params.tenantId)
  ))

  router.get('/sites/:tenantId/published', handle(
    (req) => service.getPublishedSiteDefinition(req.params.tenantId)
  ))

  router.get('/sites/:tenantId', handle(
    (req) => service.getPublicSite(req.params.tenantId)
  ))

  return router
}

export default createPublicSiteRouter()
