export const SITE_FONTS = Object.freeze([
  'inter', 'poppins', 'montserrat', 'workSans',
  'lora', 'merriweather', 'playfair', 'sourceSerif'
])
export const CORNER_STYLES = Object.freeze(['rounded', 'soft', 'square'])
export const CONTENT_WIDTHS = Object.freeze(['narrow', 'standard', 'wide'])
export const SECTION_SPACINGS = Object.freeze(['compact', 'comfortable', 'spacious'])

export const DEFAULT_SITE_THEME = Object.freeze({
  colors: Object.freeze({
    primary: '#334155',
    accent: '#0f766e',
    background: '#f8fafc',
    text: '#172033'
  }),
  headingFont: 'inter',
  bodyFont: 'inter',
  cornerStyle: 'soft',
  contentWidth: 'standard',
  sectionSpacing: 'comfortable'
})

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const validColor = (value) => typeof value === 'string' && HEX_COLOR.test(value)
const normalizedColor = (value, fallback) => validColor(value) ? value.toLowerCase() : fallback
const enumValue = (value, allowed, fallback) => allowed.includes(value) ? value : fallback

export const normalizeSiteTheme = (theme) => {
  const value = theme && typeof theme === 'object' && !Array.isArray(theme) ? theme : {}
  const colors = value.colors && typeof value.colors === 'object' && !Array.isArray(value.colors)
    ? value.colors
    : {}
  return {
    colors: {
      primary: normalizedColor(colors.primary, DEFAULT_SITE_THEME.colors.primary),
      accent: normalizedColor(colors.accent, DEFAULT_SITE_THEME.colors.accent),
      background: normalizedColor(colors.background, DEFAULT_SITE_THEME.colors.background),
      text: normalizedColor(colors.text, DEFAULT_SITE_THEME.colors.text)
    },
    headingFont: enumValue(value.headingFont, SITE_FONTS, DEFAULT_SITE_THEME.headingFont),
    bodyFont: enumValue(value.bodyFont, SITE_FONTS, DEFAULT_SITE_THEME.bodyFont),
    cornerStyle: enumValue(value.cornerStyle, CORNER_STYLES, DEFAULT_SITE_THEME.cornerStyle),
    contentWidth: enumValue(value.contentWidth, CONTENT_WIDTHS, DEFAULT_SITE_THEME.contentWidth),
    sectionSpacing: enumValue(value.sectionSpacing, SECTION_SPACINGS, DEFAULT_SITE_THEME.sectionSpacing)
  }
}

const invalid = (message) => {
  const error = new Error(message)
  error.status = 400
  throw error
}

export const validateSiteTheme = (input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const colors = body.colors && typeof body.colors === 'object' && !Array.isArray(body.colors)
    ? body.colors
    : {}
  for (const [key, label] of [
    ['primary', 'Primary color'],
    ['accent', 'Accent color'],
    ['background', 'Background color'],
    ['text', 'Text color']
  ]) {
    if (!own(colors, key) || !validColor(colors[key])) {
      invalid(`${label} must use the #RRGGBB format`)
    }
  }
  for (const [key, label, allowed] of [
    ['headingFont', 'Heading font', SITE_FONTS],
    ['bodyFont', 'Body font', SITE_FONTS],
    ['cornerStyle', 'Corner style', CORNER_STYLES],
    ['contentWidth', 'Content width', CONTENT_WIDTHS],
    ['sectionSpacing', 'Section spacing', SECTION_SPACINGS]
  ]) {
    if (!allowed.includes(body[key])) invalid(`${label} is not supported`)
  }
  return {
    colors: {
      primary: colors.primary.toLowerCase(),
      accent: colors.accent.toLowerCase(),
      background: colors.background.toLowerCase(),
      text: colors.text.toLowerCase()
    },
    headingFont: body.headingFont,
    bodyFont: body.bodyFont,
    cornerStyle: body.cornerStyle,
    contentWidth: body.contentWidth,
    sectionSpacing: body.sectionSpacing
  }
}
