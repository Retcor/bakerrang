import type { CSSProperties } from 'react'
import type { SiteFont, SiteTheme } from '@bakerrang/site-schema'
import { contrastColor } from './branding.ts'

export const DEFAULT_SITE_THEME: SiteTheme = {
  colors: {
    primary: '#334155',
    accent: '#0f766e',
    background: '#f8fafc',
    text: '#172033'
  },
  headingFont: 'inter',
  bodyFont: 'inter',
  cornerStyle: 'soft',
  contentWidth: 'standard',
  sectionSpacing: 'comfortable'
}

const HEX = /^#[0-9a-f]{6}$/i
const color = (value: unknown, fallback: string) => typeof value === 'string' && HEX.test(value)
  ? value.toLowerCase()
  : fallback

const rgb = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
const hex = (channels: number[]) => `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
const mix = (from: string, to: string, amount: number) => {
  const start = rgb(from)
  const end = rgb(to)
  return hex(start.map((channel, index) => channel + (end[index] - channel) * amount))
}
const linear = (channel: number) => {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}
export const colorLuminance = (value: string) => {
  const channels = rgb(color(value, '#000000')).map(linear)
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
export const colorContrast = (first: string, second: string) => {
  const values = [colorLuminance(first), colorLuminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

const accessibleMuted = (background: string, surface: string, text: string) => {
  let amount = 0.58
  let candidate = mix(background, text, amount)
  while (
    amount < 1 &&
    Math.min(colorContrast(candidate, background), colorContrast(candidate, surface)) < 4.5
  ) {
    amount = Math.min(1, amount + 0.04)
    candidate = mix(background, text, amount)
  }
  return candidate
}

const fontFamilies: Record<SiteFont, string> = {
  inter: 'var(--font-site-inter), Inter, ui-sans-serif, system-ui, sans-serif',
  poppins: 'var(--font-site-poppins), Poppins, ui-sans-serif, system-ui, sans-serif',
  montserrat: 'var(--font-site-montserrat), Montserrat, ui-sans-serif, system-ui, sans-serif',
  workSans: 'var(--font-site-work-sans), "Work Sans", ui-sans-serif, system-ui, sans-serif',
  lora: 'var(--font-site-lora), Lora, ui-serif, Georgia, serif',
  merriweather: 'var(--font-site-merriweather), Merriweather, ui-serif, Georgia, serif',
  playfair: 'var(--font-site-playfair), "Playfair Display", ui-serif, Georgia, serif',
  sourceSerif: 'var(--font-site-source-serif), "Source Serif 4", ui-serif, Georgia, serif'
}

const radii = {
  rounded: ['0.75rem', '1rem'],
  soft: ['0.375rem', '0.75rem'],
  square: ['0', '0']
} as const
const widths = { narrow: '60rem', standard: '72rem', wide: '84rem' } as const
const spacing = {
  compact: ['3rem', '4.5rem'],
  comfortable: ['4rem', '6rem'],
  spacious: ['6rem', '8rem']
} as const

const safeTheme = (theme?: SiteTheme): SiteTheme => ({
  colors: {
    primary: color(theme?.colors?.primary, DEFAULT_SITE_THEME.colors.primary),
    accent: color(theme?.colors?.accent, DEFAULT_SITE_THEME.colors.accent),
    background: color(theme?.colors?.background, DEFAULT_SITE_THEME.colors.background),
    text: color(theme?.colors?.text, DEFAULT_SITE_THEME.colors.text)
  },
  headingFont: theme?.headingFont && theme.headingFont in fontFamilies ? theme.headingFont : DEFAULT_SITE_THEME.headingFont,
  bodyFont: theme?.bodyFont && theme.bodyFont in fontFamilies ? theme.bodyFont : DEFAULT_SITE_THEME.bodyFont,
  cornerStyle: theme?.cornerStyle && theme.cornerStyle in radii ? theme.cornerStyle : DEFAULT_SITE_THEME.cornerStyle,
  contentWidth: theme?.contentWidth && theme.contentWidth in widths ? theme.contentWidth : DEFAULT_SITE_THEME.contentWidth,
  sectionSpacing: theme?.sectionSpacing && theme.sectionSpacing in spacing ? theme.sectionSpacing : DEFAULT_SITE_THEME.sectionSpacing
})

export type SiteThemeStyle = CSSProperties & Record<`--site-${string}`, string>

export function resolveSiteTheme (theme?: SiteTheme): SiteThemeStyle {
  const safe = safeTheme(theme)
  const { primary, accent, background, text } = safe.colors
  const dark = colorLuminance(background) < 0.35
  const surface = mix(background, '#ffffff', dark ? 0.08 : 0.78)
  const border = mix(background, text, dark ? 0.28 : 0.16)
  const [radius, radiusLarge] = radii[safe.cornerStyle]
  const [sectionSpace, sectionSpaceLarge] = spacing[safe.sectionSpacing]
  return {
    '--site-primary': primary,
    '--site-primary-fg': contrastColor(primary),
    '--site-accent': accent,
    '--site-accent-fg': contrastColor(accent),
    '--site-bg': background,
    '--site-fg': text,
    '--site-surface': surface,
    '--site-border': border,
    '--site-muted': accessibleMuted(background, surface, text),
    '--site-radius': radius,
    '--site-radius-large': radiusLarge,
    '--site-content-width': widths[safe.contentWidth],
    '--site-section-space': sectionSpace,
    '--site-section-space-lg': sectionSpaceLarge,
    '--site-hero-space': `calc(${sectionSpace} * 1.25)`,
    '--site-hero-space-lg': `calc(${sectionSpaceLarge} * 1.2)`,
    '--site-heading-font': fontFamilies[safe.headingFont],
    '--site-body-font': fontFamilies[safe.bodyFont]
  }
}
