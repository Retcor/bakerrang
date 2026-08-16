export const DEFAULT_SITE_PRIMARY_COLOR = '#334155'
export const DEFAULT_SITE_ACCENT_COLOR = '#0f766e'
export const DEFAULT_SITE_NAME = 'Website'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export const contrastColor = (hexColor) => {
  const hex = HEX_COLOR.test(hexColor) ? hexColor.slice(1) : 'ffffff'
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  const whiteContrast = 1.05 / (luminance + 0.05)
  const inkContrast = (luminance + 0.05) / (0.0152 + 0.05)
  return whiteContrast >= inkContrast ? '#ffffff' : '#111827'
}

export const fallbackSiteName = (definition) => {
  const hero = (Array.isArray(definition?.pages) ? definition.pages : [])
    .flatMap((page) => Array.isArray(page?.sections) ? page.sections : [])
    .find((section) => section?.id === 'hero' && section?.type === 'hero')
  const title = typeof hero?.content?.title === 'string' ? hero.content.title.trim() : ''
  return title ? title.slice(0, 80) : DEFAULT_SITE_NAME
}

export const siteBrandingResponse = (branding, definition) => {
  const siteName = typeof branding?.siteName === 'string' && branding.siteName.trim()
    ? branding.siteName.trim().slice(0, 80)
    : fallbackSiteName(definition)
  return {
    siteName,
    primaryColor: HEX_COLOR.test(branding?.primaryColor || '')
      ? branding.primaryColor.toLowerCase()
      : DEFAULT_SITE_PRIMARY_COLOR,
    accentColor: HEX_COLOR.test(branding?.accentColor || '')
      ? branding.accentColor.toLowerCase()
      : DEFAULT_SITE_ACCENT_COLOR,
    ...(typeof branding?.logoMediaId === 'string' && branding.logoMediaId.trim()
      ? { logoMediaId: branding.logoMediaId.trim() }
      : {})
  }
}

export const validateSiteBranding = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof body.siteName !== 'string' || !body.siteName.trim()) {
    const error = new Error('Site name is required')
    error.status = 400
    throw error
  }
  const siteName = body.siteName.trim()
  if (siteName.length > 80) {
    const error = new Error('Site name must be 80 characters or fewer')
    error.status = 400
    throw error
  }
  for (const [key, label] of [['primaryColor', 'Primary color'], ['accentColor', 'Accent color']]) {
    if (typeof body[key] !== 'string' || !HEX_COLOR.test(body[key])) {
      const error = new Error(`${label} must use the #RRGGBB format`)
      error.status = 400
      throw error
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'logoMediaId') && body.logoMediaId !== null && (
    typeof body.logoMediaId !== 'string' || !body.logoMediaId.trim()
  )) {
    const error = new Error('Logo image is invalid')
    error.status = 400
    throw error
  }
  return {
    siteName,
    primaryColor: body.primaryColor.toLowerCase(),
    accentColor: body.accentColor.toLowerCase(),
    ...(typeof body.logoMediaId === 'string' ? { logoMediaId: body.logoMediaId.trim() } : {})
  }
}
