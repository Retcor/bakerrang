export const THEME_VALUES = Object.freeze(['light', 'dark', 'system'])
export const THEME_COOKIE = 'br_theme'

export const isThemePreference = (value) => THEME_VALUES.includes(value)

export const readThemeCookie = (cookie = '') => {
  const entry = String(cookie).split(';').map((part) => part.trim()).find((part) => part.startsWith(`${THEME_COOKIE}=`))
  if (!entry) return null
  const value = decodeURIComponent(entry.slice(THEME_COOKIE.length + 1))
  return isThemePreference(value) ? value : null
}

export const resolveTheme = (preference, prefersDark = false) => {
  const normalized = isThemePreference(preference) ? preference : 'system'
  return normalized === 'system' ? (prefersDark ? 'dark' : 'light') : normalized
}

export const applyResolvedTheme = (documentElement, resolvedTheme) => {
  documentElement.dataset.theme = resolvedTheme
  documentElement.classList.toggle('dark', resolvedTheme === 'dark')
}

export const themeCookieValue = (preference, locationLike = globalThis.location) => {
  if (!isThemePreference(preference)) throw new TypeError('Invalid theme preference')
  const hostname = locationLike?.hostname || ''
  const protocol = locationLike?.protocol || ''
  const productionDomain = hostname === 'bakerrang.com' || hostname.endsWith('.bakerrang.com')
  const parts = [
    `${THEME_COOKIE}=${preference}`,
    'Path=/',
    'SameSite=Lax',
    'Max-Age=31536000'
  ]
  if (productionDomain) parts.push('Domain=.bakerrang.com')
  if (productionDomain && protocol === 'https:') parts.push('Secure')
  return parts.join('; ')
}

export const THEME_BOOT_SCRIPT = '(function(){var m=[\'light\',\'dark\',\'system\'];var c=document.cookie.split(\';\').map(function(v){return v.trim()}).find(function(v){return v.indexOf(\'br_theme=\')===0});var p=c?decodeURIComponent(c.slice(9)):\'system\';if(m.indexOf(p)<0)p=\'system\';var r=p===\'system\'?(window.matchMedia(\'(prefers-color-scheme: dark)\').matches?\'dark\':\'light\'):p;document.documentElement.setAttribute(\'data-theme\',r);document.documentElement.classList.toggle(\'dark\',r===\'dark\')})();'
