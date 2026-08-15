import express from 'express'
import * as tenantService from '../services/tenantService.js'
import * as siteService from '../services/siteService.js'
import * as leadService from '../services/leadService.js'
import { requirePlatformAdmin, requireTenantRole } from '../middleware/tenantAuth.js'

const allTenantRoles = ['OWNER', 'ADMIN', 'STAFF']
const tenantManagerRoles = ['OWNER', 'ADMIN']

const handle = (fn, successStatus = 200) => async (req, res) => {
  try {
    res.status(successStatus).json(await fn(req))
  } catch (error) {
    const status = error.status || 500
    if (status >= 500) console.error(error)
    res.status(status).json({
      error: status >= 500 ? 'Tenant operation failed' : error.message
    })
  }
}

const noStore = (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

export const createTenantRouter = (deps = {}) => {
  const service = deps.tenantService || tenantService
  const sites = deps.siteService || siteService
  const leads = deps.leadService || leadService
  const platformAdmin = deps.requirePlatformAdmin || requirePlatformAdmin
  const tenantRole = deps.requireTenantRole || requireTenantRole
  const router = express.Router()

  router.post('/', platformAdmin, handle(
    (req) => service.createTenant(req.user.id, req.body),
    201
  ))

  router.get('/', platformAdmin, handle(() => service.listTenants()))

  router.post('/:tenantId/site', platformAdmin, handle(
    (req) => sites.initializeSite(req.params.tenantId, req.user.id),
    201
  ))

  router.post('/:tenantId/site/publish', platformAdmin, handle(
    (req) => sites.publishSite(req.params.tenantId, req.user.id)
  ))

  router.post('/:tenantId/site/unpublish', platformAdmin, handle(
    (req) => sites.unpublishSite(req.params.tenantId, req.user.id)
  ))

  router.patch('/:tenantId/site/pages/home/sections/hero', platformAdmin, handle(
    (req) => sites.updateHomeHero(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/pages/home/sections/services', platformAdmin, handle(
    (req) => sites.upsertHomeServices(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/pages/home/sections/contact', platformAdmin, handle(
    (req) => sites.upsertHomeContact(req.params.tenantId, req.body)
  ))

  router.get('/:tenantId/site', tenantRole(allTenantRoles), handle(
    (req) => sites.getSite(req.params.tenantId)
  ))

  router.get('/:tenantId/leads', tenantRole(allTenantRoles), noStore, handle(
    (req) => leads.listTenantLeads(req.params.tenantId)
  ))

  router.get('/:tenantId/leads/:leadId', tenantRole(allTenantRoles), noStore, handle(
    (req) => leads.getTenantLead(req.params.tenantId, req.params.leadId)
  ))

  router.get('/:tenantId', tenantRole(allTenantRoles), handle(
    (req) => service.getTenant(req.params.tenantId)
  ))

  router.post('/:tenantId/members', platformAdmin, handle(
    (req) => service.addMember(req.params.tenantId, req.body, req.user.id),
    201
  ))

  router.get('/:tenantId/members', tenantRole(tenantManagerRoles), handle(
    (req) => service.listMembers(req.params.tenantId)
  ))

  return router
}

export default createTenantRouter()
