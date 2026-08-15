import { getMembership, getPlatformRole } from '../services/tenantService.js'

const defaultDeps = { getMembership, getPlatformRole }

const userIdOf = (req) => req.user && req.user.id

const fail = (res, status, message) => res.status(status).json({ error: message })

export const createRequirePlatformAdmin = (deps = defaultDeps) => async (req, res, next) => {
  const userId = userIdOf(req)
  if (!userId) return fail(res, 401, 'User not authenticated')

  try {
    const platformRole = await deps.getPlatformRole(userId)
    if (platformRole !== 'PLATFORM_ADMIN') return fail(res, 403, 'Platform administrator access required')
    req.platformRole = platformRole
    next()
  } catch (error) {
    console.error('Platform authorization failed:', error)
    fail(res, 500, 'Authorization check failed')
  }
}

export const requirePlatformAdmin = createRequirePlatformAdmin()

export const requireTenantRole = (allowedRoles, deps = defaultDeps) => async (req, res, next) => {
  const userId = userIdOf(req)
  if (!userId) return fail(res, 401, 'User not authenticated')

  const tenantId = req.params && req.params.tenantId
  if (!tenantId) return fail(res, 400, 'tenantId route parameter is required')

  try {
    const platformRole = await deps.getPlatformRole(userId)
    if (platformRole === 'PLATFORM_ADMIN') {
      req.platformRole = platformRole
      return next()
    }

    const membership = await deps.getMembership(tenantId, userId)
    if (!membership || !allowedRoles.includes(membership.role)) {
      return fail(res, 403, 'Tenant access denied')
    }

    req.membership = membership
    next()
  } catch (error) {
    console.error('Tenant authorization failed:', error)
    fail(res, 500, 'Authorization check failed')
  }
}
