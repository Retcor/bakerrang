import test from 'node:test'
import assert from 'node:assert/strict'
import type { SiteTheme } from '@bakerrang/site-schema'
import {
  colorContrast,
  DEFAULT_SITE_THEME,
  resolveSiteTheme
} from '../../../packages/site-components/src/theme.ts'

const customTheme = (overrides: Partial<SiteTheme> = {}): SiteTheme => ({
  ...DEFAULT_SITE_THEME,
  ...overrides,
  colors: { ...DEFAULT_SITE_THEME.colors, ...(overrides.colors || {}) }
})

test('default Theme resolves the expected safe scoped CSS variables', () => {
  const style = resolveSiteTheme(DEFAULT_SITE_THEME)
  assert.equal(style['--site-primary'], '#334155')
  assert.equal(style['--site-accent'], '#0f766e')
  assert.equal(style['--site-bg'], '#f8fafc')
  assert.equal(style['--site-fg'], '#172033')
  assert.equal(style['--site-radius'], '0.375rem')
  assert.equal(style['--site-radius-large'], '0.75rem')
  assert.equal(style['--site-content-width'], '72rem')
  assert.equal(style['--site-section-space'], '4rem')
  assert.equal(style['--site-section-space-lg'], '6rem')
})

test('custom light and dark colors derive readable foregrounds, surfaces, borders, and muted text', () => {
  for (const theme of [
    customTheme({ colors: { primary: '#ffffff', accent: '#000000', background: '#ffffff', text: '#111827' } }),
    customTheme({ colors: { primary: '#000000', accent: '#ffffff', background: '#101820', text: '#f8fafc' } })
  ]) {
    const style = resolveSiteTheme(theme)
    assert.ok(colorContrast(style['--site-primary'], style['--site-primary-fg']) >= 4.5)
    assert.ok(colorContrast(style['--site-accent'], style['--site-accent-fg']) >= 4.5)
    assert.ok(colorContrast(style['--site-muted'], style['--site-bg']) >= 4.5)
    assert.ok(colorContrast(style['--site-muted'], style['--site-surface']) >= 4.5)
    assert.match(style['--site-surface'], /^#[0-9a-f]{6}$/)
    assert.match(style['--site-border'], /^#[0-9a-f]{6}$/)
  }
})

test('corner, width, spacing, and font enums map to fixed safe values', () => {
  assert.equal(resolveSiteTheme(customTheme({ cornerStyle: 'rounded' }))['--site-radius'], '0.75rem')
  assert.equal(resolveSiteTheme(customTheme({ cornerStyle: 'square' }))['--site-radius-large'], '0')
  assert.equal(resolveSiteTheme(customTheme({ contentWidth: 'narrow' }))['--site-content-width'], '60rem')
  assert.equal(resolveSiteTheme(customTheme({ contentWidth: 'wide' }))['--site-content-width'], '84rem')
  assert.equal(resolveSiteTheme(customTheme({ sectionSpacing: 'compact' }))['--site-section-space-lg'], '4.5rem')
  assert.equal(resolveSiteTheme(customTheme({ sectionSpacing: 'spacious' }))['--site-section-space'], '6rem')
  assert.match(resolveSiteTheme(customTheme({ headingFont: 'playfair' }))['--site-heading-font'], /--font-site-playfair/)
  assert.match(resolveSiteTheme(customTheme({ bodyFont: 'workSans' }))['--site-body-font'], /--font-site-work-sans/)
})

test('resolver tolerates old/default sites and emits only the approved variable set', () => {
  const style = resolveSiteTheme()
  assert.deepEqual(Object.keys(style).sort(), [
    '--site-accent', '--site-accent-fg', '--site-bg', '--site-body-font', '--site-border',
    '--site-content-width', '--site-fg', '--site-heading-font', '--site-hero-space',
    '--site-hero-space-lg', '--site-muted', '--site-primary', '--site-primary-fg',
    '--site-radius', '--site-radius-large', '--site-section-space', '--site-section-space-lg',
    '--site-surface'
  ])
})
