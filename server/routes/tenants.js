import express from 'express'
import multer from 'multer'
import * as tenantService from '../services/tenantService.js'
import * as siteService from '../services/siteService.js'
import * as leadService from '../services/leadService.js'
import * as mediaService from '../services/mediaService.js'
import * as siteDomainService from '../services/siteDomainService.js'
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

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
}).single('file')

const parseMediaUpload = (req, res, next) => {
  mediaUpload(req, res, (error) => {
    if (!error) return next()
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Image must be 10 MB or smaller' })
    }
    return res.status(400).json({ error: 'Media upload is invalid' })
  })
}

export const createTenantRouter = (deps = {}) => {
  const service = deps.tenantService || tenantService
  const sites = deps.siteService || siteService
  const leads = deps.leadService || leadService
  const media = deps.mediaService || mediaService
  const domains = deps.siteDomainService || siteDomainService
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

  router.get('/:tenantId/site/domain', platformAdmin, noStore, handle(
    (req) => domains.getSiteDomain(req.params.tenantId)
  ))

  router.put('/:tenantId/site/domain', platformAdmin, noStore, handle(
    (req) => domains.registerSiteDomain(req.params.tenantId, req.body, req.user.id)
  ))

  router.post('/:tenantId/site/domain/verify', platformAdmin, noStore, handle(
    (req) => domains.verifySiteDomain(req.params.tenantId, req.user.id)
  ))

  router.post('/:tenantId/site/domain/activate', platformAdmin, noStore, handle(
    (req) => domains.activateSiteDomain(req.params.tenantId, req.user.id)
  ))

  router.post('/:tenantId/site/domain/disable', platformAdmin, noStore, handle(
    (req) => domains.disableSiteDomain(req.params.tenantId, req.user.id)
  ))

  router.delete('/:tenantId/site/domain', platformAdmin, noStore, handle(
    (req) => domains.removeSiteDomain(req.params.tenantId)
  ))

  router.put('/:tenantId/site/branding', platformAdmin, handle(
    (req) => sites.updateSiteBranding(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/profile', platformAdmin, handle(
    (req) => sites.updateBusinessProfile(req.params.tenantId, req.body)
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

  router.put('/:tenantId/site/pages/home/sections/gallery', platformAdmin, handle(
    (req) => sites.upsertHomeGallery(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/pages/home/sections/testimonials', platformAdmin, handle(
    (req) => sites.upsertHomeTestimonials(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/pages/home/composition', platformAdmin, handle(
    (req) => sites.composeHomeSections(req.params.tenantId, req.body)
  ))

  router.get('/:tenantId/media', platformAdmin, noStore, handle(
    (req) => media.listMedia(req.params.tenantId)
  ))

  router.post('/:tenantId/media', platformAdmin, noStore, parseMediaUpload, handle(
    (req) => media.createMedia(req.params.tenantId, req.file, req.user.id),
    201
  ))

  router.get('/:tenantId/site', tenantRole(allTenantRoles), handle(
    (req) => sites.getSite(req.params.tenantId)
  ))

  router.get('/:tenantId/leads', tenantRole(allTenantRoles), noStore, handle(
    (req) => leads.listTenantLeads(req.params.tenantId)
  ))

  router.get('/:tenantId/leads/:leadId/notes', tenantRole(allTenantRoles), noStore, handle(
    (req) => leads.listLeadNotes(req.params.tenantId, req.params.leadId)
  ))

  router.post('/:tenantId/leads/:leadId/notes', tenantRole(allTenantRoles), noStore, handle(
    (req) => leads.createLeadNote(req.params.tenantId, req.params.leadId, req.body, req.user.id),
    201
  ))

  router.get('/:tenantId/leads/:leadId', tenantRole(allTenantRoles), noStore, handle(
    (req) => leads.getTenantLead(req.params.tenantId, req.params.leadId)
  ))

  router.patch('/:tenantId/leads/:leadId', tenantRole(allTenantRoles), noStore, handle(
    (req) => leads.updateLeadStatus(req.params.tenantId, req.params.leadId, req.body)
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
