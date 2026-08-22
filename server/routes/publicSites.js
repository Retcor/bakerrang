import express from 'express'
import * as siteService from '../services/siteService.js'
import * as siteDomainService from '../services/siteDomainService.js'
import * as previewTokenService from '../services/previewTokenService.js'

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
  const previewTokens = deps.previewTokenService || previewTokenService
  const router = express.Router()

  router.get('/preview/:tenantId', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    try {
      const match = req.get('authorization')?.match(/^Bearer ([^\s]+)$/)
      if (!match) throw Object.assign(new Error('Preview authorization failed'), { status: 401 })
      const claims = previewTokens.verifyPreviewToken(match[1])
      if (claims.tenantId !== req.params.tenantId) {
        throw Object.assign(new Error('Preview authorization failed'), { status: 401 })
      }
      next()
    } catch (error) {
      res.status(error.status === 401 ? 401 : 500).json({
        error: error.status === 401 ? 'Preview authorization failed' : 'Public site operation failed'
      })
    }
  }, handle((req) => service.getSite(req.params.tenantId)))

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
