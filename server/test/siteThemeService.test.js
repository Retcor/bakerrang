import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SITE_THEME,
  normalizeSiteTheme,
  validateSiteTheme
} from '../domain/siteTheme.js'
import {
  _setDb,
  getPublishedSiteDefinition,
  getSite,
  initializeSite,
  publishSite,
  updateSiteBranding,
  updateSiteTheme
} from '../services/siteService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb

const customTheme = (overrides = {}) => ({
  colors: {
    primary: '#AABBCC',
    accent: '#DDEEFF',
    background: '#101820',
    text: '#F7F8F9',
    ...(overrides.colors || {})
  },
  headingFont: 'poppins',
  bodyFont: 'lora',
  cornerStyle: 'rounded',
  contentWidth: 'wide',
  sectionSpacing: 'spacious',
  ...overrides
})

beforeEach(() => {
  fakeDb = new FakeDb().seed('tenants/tenant-1', { name: 'Theme Tenant' })
  _setDb(fakeDb)
})

afterEach(() => _setDb())

test('DEFAULT_SITE_THEME has the complete stable V1 shape', () => {
  assert.deepEqual(DEFAULT_SITE_THEME, {
    colors: {
      primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033'
    },
    headingFont: 'inter',
    bodyFont: 'inter',
    cornerStyle: 'soft',
    contentWidth: 'standard',
    sectionSpacing: 'comfortable'
  })
})

test('Theme validation normalizes colors and persists only approved fields', () => {
  assert.deepEqual(validateSiteTheme({ ...customTheme(), ignored: true }), {
    colors: {
      primary: '#aabbcc', accent: '#ddeeff', background: '#101820', text: '#f7f8f9'
    },
    headingFont: 'poppins',
    bodyFont: 'lora',
    cornerStyle: 'rounded',
    contentWidth: 'wide',
    sectionSpacing: 'spacious'
  })
})

test('Theme validation rejects unsafe colors and every unsupported enum', () => {
  for (const color of ['red', '#123', 'rgb(0,0,0)', 'var(--x)', 'url(x)', '#gggggg']) {
    assert.throws(() => validateSiteTheme(customTheme({
      colors: { ...customTheme().colors, primary: color }
    })), { status: 400 })
  }
  for (const key of ['headingFont', 'bodyFont', 'cornerStyle', 'contentWidth', 'sectionSpacing']) {
    assert.throws(() => validateSiteTheme(customTheme({ [key]: 'unsupported' })), { status: 400 })
  }
})

test('read normalization fills defaults, seeds legacy colors, and tolerates partial malformed Theme', () => {
  assert.deepEqual(normalizeSiteTheme(), DEFAULT_SITE_THEME)
  assert.deepEqual(normalizeSiteTheme(undefined, {
    primaryColor: '#ABCDEF', accentColor: '#123456'
  }).colors, {
    primary: '#abcdef', accent: '#123456', background: '#f8fafc', text: '#172033'
  })
  assert.deepEqual(normalizeSiteTheme({
    colors: { background: '#000000', primary: 'bad' },
    headingFont: 'playfair',
    bodyFont: 'bad',
    cornerStyle: 'square'
  }, { primaryColor: '#010203' }), {
    colors: {
      primary: '#010203', accent: '#0f766e', background: '#000000', text: '#172033'
    },
    headingFont: 'playfair',
    bodyFont: 'inter',
    cornerStyle: 'square',
    contentWidth: 'standard',
    sectionSpacing: 'comfortable'
  })
})

test('identity-only Branding saves preserve legacy colors without writing Theme', async () => {
  await initializeSite('tenant-1', 'admin')
  const config = fakeDb.data('tenants/tenant-1/site/config')
  delete config.theme
  config.branding.primaryColor = '#112233'
  config.branding.accentColor = '#445566'
  fakeDb.seed('tenants/tenant-1/site/config', config)

  const site = await updateSiteBranding('tenant-1', { siteName: 'Renamed' })
  const stored = fakeDb.data('tenants/tenant-1/site/config')
  assert.deepEqual(stored.branding, {
    siteName: 'Renamed', primaryColor: '#112233', accentColor: '#445566'
  })
  assert.equal(Object.hasOwn(stored, 'theme'), false)
  assert.equal(site.theme.colors.primary, '#112233')
})

test('Theme updates only WORKING state through preview and publish lifecycle', async () => {
  await initializeSite('tenant-1', 'admin')
  const themeA = validateSiteTheme(customTheme({
    colors: {
      ...customTheme().colors, primary: '#111111'
    }
  }))
  const themeB = validateSiteTheme(customTheme({
    colors: { ...customTheme().colors, primary: '#222222' },
    headingFont: 'montserrat',
    contentWidth: 'narrow'
  }))
  await updateSiteTheme('tenant-1', themeA)
  await publishSite('tenant-1', 'admin')
  const snapshotA = fakeDb.data('tenants/tenant-1/site/config/published/current')

  const working = await updateSiteTheme('tenant-1', { ...themeB, unknown: 'drop' })
  assert.deepEqual(working.theme, themeB)
  assert.deepEqual((await getSite('tenant-1')).theme, themeB)
  assert.deepEqual((await getPublishedSiteDefinition('tenant-1')).theme, themeA)
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config/published/current'), snapshotA)
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config').theme, themeB)

  await publishSite('tenant-1', 'admin')
  assert.deepEqual((await getPublishedSiteDefinition('tenant-1')).theme, themeB)
})

test('old published snapshots without Theme normalize from their legacy Branding', async () => {
  fakeDb.seed('tenants/tenant-1/site/config', { status: 'PUBLISHED' })
  fakeDb.seed('tenants/tenant-1/site/config/published/current', {
    siteDefinition: {
      status: 'PUBLISHED',
      branding: { siteName: 'Old', primaryColor: '#ABCDEF', accentColor: '#123456' },
      pages: []
    }
  })
  const published = await getPublishedSiteDefinition('tenant-1')
  assert.equal(published.theme.colors.primary, '#abcdef')
  assert.equal(published.theme.colors.accent, '#123456')
  assert.equal(published.theme.headingFont, 'inter')
})
