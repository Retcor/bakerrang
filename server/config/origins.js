export const buildAllowedOrigins = (env = process.env) => [
  env.CLIENT_DOMAIN,
  env.PORTAL_DOMAIN,
  env.SITE_RENDERER_DOMAIN,
  env.CHATBOT_ORIGIN
].filter(Boolean)

export const isOriginAllowed = (origin, allowedOrigins) =>
  !origin || allowedOrigins.includes(origin)

export const isActiveCustomSiteOrigin = async (
  origin,
  resolveActiveDomain,
  expectedTenantId,
  env = process.env
) => {
  if (!origin || typeof resolveActiveDomain !== 'function' || !expectedTenantId) return false
  let url
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (env.NODE_ENV === 'production' && url.port) ||
    (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && url.protocol === 'http:'))
  ) return false
  try {
    const resolved = await resolveActiveDomain(url.host)
    return resolved.canonicalHost === url.hostname.toLowerCase() &&
      resolved.tenantId === expectedTenantId
  } catch {
    return false
  }
}

const customDomainLeadTenant = (req) => {
  const method = req.method.toUpperCase()
  if (method !== 'POST' && !(
    method === 'OPTIONS' &&
    req.get('Access-Control-Request-Method')?.toUpperCase() === 'POST'
  )) return null

  const match = req.path.match(/^\/public\/sites\/([^/]+)\/leads\/?$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export const createCorsOptionsDelegate = ({
  allowedOrigins,
  resolveActiveDomain,
  env = process.env
}) => (req, callback) => {
  const origin = req.get('Origin')
  const allow = () => callback(null, { origin: true, credentials: true })
  const deny = () => callback(new Error(`CORS: origin ${origin} not allowed`))

  if (isOriginAllowed(origin, allowedOrigins)) return allow()
  const tenantId = customDomainLeadTenant(req)
  if (!tenantId) return deny()

  isActiveCustomSiteOrigin(origin, resolveActiveDomain, tenantId, env)
    .then((allowed) => allowed ? allow() : deny())
    .catch(deny)
}
