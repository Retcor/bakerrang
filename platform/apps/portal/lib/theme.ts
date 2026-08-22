import type { SiteFont, SiteTheme } from '@bakerrang/site-schema'

export const DEFAULT_SITE_THEME: SiteTheme = {
  colors: {
    primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033'
  },
  headingFont: 'inter', bodyFont: 'inter', cornerStyle: 'soft',
  contentWidth: 'standard', sectionSpacing: 'comfortable'
}

export const SITE_FONT_OPTIONS: ReadonlyArray<{ value: SiteFont, label: string, family: string }> = [
  { value: 'inter', label: 'Inter', family: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  { value: 'poppins', label: 'Poppins', family: 'Poppins, ui-sans-serif, system-ui, sans-serif' },
  { value: 'montserrat', label: 'Montserrat', family: 'Montserrat, ui-sans-serif, system-ui, sans-serif' },
  { value: 'workSans', label: 'Work Sans', family: '"Work Sans", ui-sans-serif, system-ui, sans-serif' },
  { value: 'lora', label: 'Lora', family: 'Lora, ui-serif, Georgia, serif' },
  { value: 'merriweather', label: 'Merriweather', family: 'Merriweather, ui-serif, Georgia, serif' },
  { value: 'playfair', label: 'Playfair Display', family: '"Playfair Display", ui-serif, Georgia, serif' },
  { value: 'sourceSerif', label: 'Source Serif 4', family: '"Source Serif 4", ui-serif, Georgia, serif' }
]

const channel = (hex: string, offset: number) => {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}
const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
export const themeColorContrast = (first: string, second: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(first) || !/^#[0-9a-f]{6}$/i.test(second)) return null
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

export const previewForeground = (background: string) => {
  const white = themeColorContrast(background, '#ffffff') ?? 0
  const ink = themeColorContrast(background, '#111827') ?? 0
  return white >= ink ? '#ffffff' : '#111827'
}
