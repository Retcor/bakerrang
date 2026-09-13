import express from 'express'
import multer from 'multer'
import * as tenantService from '../services/tenantService.js'
import * as siteService from '../services/siteService.js'
import * as leadService from '../services/leadService.js'
import * as leadNotificationSettingsService from '../services/leadNotificationSettingsService.js'
import * as mediaService from '../services/mediaService.js'
import * as siteDomainService from '../services/siteDomainService.js'
import * as previewTokenService from '../services/previewTokenService.js'
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
      error: status >= 500 && !error.expose ? 'Tenant operation failed' : error.message
    })
  }
}

const handleNoContent = (fn) => async (req, res) => {
  try {
    await fn(req)
    res.status(204).end()
  } catch (error) {
    const status = error.status || 500
    if (status >= 500) console.error(error)
    res.status(status).json({
      error: status >= 500 && !error.expose ? 'Tenant operation failed' : error.message
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
  const leadNotifications = deps.leadNotificationSettingsService || leadNotificationSettingsService
  const media = deps.mediaService || mediaService
  const domains = deps.siteDomainService || siteDomainService
  const previewTokens = deps.previewTokenService || previewTokenService
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

  router.get('/:tenantId/site/revisions', platformAdmin, noStore, handle(
    (req) => sites.listSiteRevisions(req.params.tenantId)
  ))

  router.post('/:tenantId/site/revisions/:revisionId/restore', platformAdmin, handle(
    (req) => sites.restoreSiteRevision(req.params.tenantId, req.params.revisionId)
  ))

  router.get('/:tenantId/site/templates', platformAdmin, noStore, handle(
    () => sites.listSiteTemplates()
  ))

  router.post('/:tenantId/site/templates/:templateId/apply', platformAdmin, handle(
    (req) => sites.applySiteTemplate(req.params.tenantId, req.params.templateId)
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

  router.put('/:tenantId/site/header', platformAdmin, handle(
    (req) => sites.updateSiteHeader(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/footer', platformAdmin, handle(
    (req) => sites.updateSiteFooter(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/theme', platformAdmin, handle(
    (req) => sites.updateSiteTheme(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/seo', platformAdmin, handle(
    (req) => sites.updateSiteSeo(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/profile', platformAdmin, handle(
    (req) => sites.updateBusinessProfile(req.params.tenantId, req.body)
  ))

  router.get('/:tenantId/lead-notifications', platformAdmin, noStore, handle(
    (req) => leadNotifications.getLeadNotificationSettings(req.params.tenantId)
  ))

  router.put('/:tenantId/lead-notifications', platformAdmin, noStore, handle(
    (req) => leadNotifications.updateLeadNotificationSettings(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/business-hours', platformAdmin, handle(
    (req) => sites.updateBusinessHours(req.params.tenantId, req.body, req.body?.sectionId)
  ))

  router.put('/:tenantId/site/social-links', platformAdmin, handle(
    (req) => sites.updateSocialLinks(req.params.tenantId, req.body)
  ))

  router.put('/:tenantId/site/custom-css', platformAdmin, handle(
    (req) => sites.updateCustomCss(req.params.tenantId, req.body)
  ))

  router.post('/:tenantId/site/pages', platformAdmin, handle(
    (req) => sites.createPage(req.params.tenantId, req.body),
    201
  ))

  router.patch('/:tenantId/site/pages/:pageId', platformAdmin, handle(
    (req) => sites.updatePage(req.params.tenantId, req.params.pageId, req.body)
  ))

  router.put('/:tenantId/site/pages/:pageId/seo', platformAdmin, handle(
    (req) => sites.updatePageSeo(req.params.tenantId, req.params.pageId, req.body)
  ))

  router.post('/:tenantId/site/pages/:pageId/move', platformAdmin, handle(
    (req) => sites.movePage(req.params.tenantId, req.params.pageId, req.body?.direction)
  ))

  router.delete('/:tenantId/site/pages/:pageId', platformAdmin, handle(
    (req) => sites.deletePage(req.params.tenantId, req.params.pageId)
  ))

  router.post('/:tenantId/site/pages/:pageId/sections', platformAdmin, handle(
    (req) => sites.addSection(req.params.tenantId, req.params.pageId, req.body?.type, { afterSectionId: req.body?.afterSectionId }),
    201
  ))

  router.post('/:tenantId/site/pages/:pageId/sections/:sectionId/duplicate', platformAdmin, handle(
    (req) => sites.duplicateSection(req.params.tenantId, req.params.pageId, req.params.sectionId)
  ))

  router.delete('/:tenantId/site/pages/:pageId/sections/:sectionId', platformAdmin, handle(
    (req) => sites.removeSection(req.params.tenantId, req.params.pageId, req.params.sectionId)
  ))

  router.post('/:tenantId/site/pages/:pageId/sections/:sectionId/move', platformAdmin, handle(
    (req) => sites.moveSection(req.params.tenantId, req.params.pageId, req.params.sectionId, req.body?.direction)
  ))

  router.patch('/:tenantId/site/pages/:pageId/sections/:sectionId/visibility', platformAdmin, handle(
    (req) => sites.setSectionVisibility(req.params.tenantId, req.params.pageId, req.params.sectionId, req.body?.hidden)
  ))

  router.put('/:tenantId/site/pages/:pageId/sections/:sectionId', platformAdmin, handle(
    (req) => sites.updateSectionContent(req.params.tenantId, req.params.pageId, req.params.sectionId, req.body)
  ))

  router.get('/:tenantId/media', platformAdmin, noStore, handle(
    (req) => media.listMedia(req.params.tenantId)
  ))

  router.post('/:tenantId/media', platformAdmin, noStore, parseMediaUpload, handle(
    (req) => media.createMedia(req.params.tenantId, req.file, req.user.id),
    201
  ))

  router.delete('/:tenantId/media/:mediaId', platformAdmin, noStore, handleNoContent(
    (req) => media.deleteUnusedMedia(req.params.tenantId, req.params.mediaId)
  ))

  router.get('/:tenantId/site', tenantRole(allTenantRoles), handle(
    (req) => sites.getSite(req.params.tenantId)
  ))

  router.post('/:tenantId/site/preview-token', tenantRole(allTenantRoles), noStore, handle(
    (req) => previewTokens.createPreviewToken(req.params.tenantId)
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

  router.delete('/:tenantId/leads/:leadId', platformAdmin, noStore, handleNoContent(
    (req) => leads.deleteTenantLead(req.params.tenantId, req.params.leadId)
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
