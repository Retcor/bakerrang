import type { SiteTheme } from '@bakerrang/site-schema'
import { DEFAULT_SITE_THEME } from './theme'

export interface ThemePreset {
  description: string
  name: 'Modern' | 'Classic' | 'Bold' | 'Friendly' | 'Midnight'
  theme: SiteTheme
}

const copyTheme = (theme: SiteTheme): SiteTheme => ({ ...theme, colors: { ...theme.colors } })

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    name: 'Modern',
    description: 'Clean, balanced, and ready for almost any business.',
    theme: copyTheme(DEFAULT_SITE_THEME)
  },
  {
    name: 'Classic',
    description: 'Warm, editorial, and quietly traditional.',
    theme: {
      colors: { primary: '#6b4f3b', accent: '#8b5a2b', background: '#fbf5eb', text: '#2f241d' },
      headingFont: 'playfair', bodyFont: 'sourceSerif', cornerStyle: 'soft', contentWidth: 'standard', sectionSpacing: 'comfortable'
    }
  },
  {
    name: 'Bold',
    description: 'High-contrast, direct, and confidently modern.',
    theme: {
      colors: { primary: '#1d4ed8', accent: '#dc2626', background: '#f8fafc', text: '#111827' },
      headingFont: 'montserrat', bodyFont: 'inter', cornerStyle: 'square', contentWidth: 'wide', sectionSpacing: 'spacious'
    }
  },
  {
    name: 'Friendly',
    description: 'Warm, welcoming, and approachable.',
    theme: {
      colors: { primary: '#a44a3f', accent: '#d97706', background: '#fff7ed', text: '#3f2b26' },
      headingFont: 'poppins', bodyFont: 'workSans', cornerStyle: 'rounded', contentWidth: 'standard', sectionSpacing: 'comfortable'
    }
  },
  {
    name: 'Midnight',
    description: 'Dark, polished, and built around luminous accents.',
    theme: {
      colors: { primary: '#60a5fa', accent: '#fbbf24', background: '#111827', text: '#f8fafc' },
      headingFont: 'montserrat', bodyFont: 'inter', cornerStyle: 'soft', contentWidth: 'wide', sectionSpacing: 'spacious'
    }
  }
]

export const cloneTheme = copyTheme
