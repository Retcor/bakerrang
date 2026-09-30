import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { THEME_BOOT_SCRIPT } from '@bakerrang/web-theme/boot'
import viteConfig, { ACCOUNT_PWA_OPTIONS } from '../vite.config.js'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (...parts) => readFileSync(path.join(appRoot, ...parts), 'utf8')

describe('Account PWA', () => {
  it('has its own identity and installs as "Account"', () => {
    expect(ACCOUNT_PWA_OPTIONS.manifest).toMatchObject({
      id: '/',
      name: 'Account — BakerRang',
      short_name: 'Account',
      description: 'Your BakerRang profile, theme and voices.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#161514',
      background_color: '#161514'
    })
    expect(ACCOUNT_PWA_OPTIONS.manifest.icons.map((icon) => [icon.sizes, icon.purpose])).toEqual([['192x192', 'any maskable'], ['512x512', 'any maskable']])
    expect(ACCOUNT_PWA_OPTIONS.registerType).toBe('autoUpdate')
  })

  it('caches the shell only: no runtime caching, and nothing that could hold identity, preferences or voices', () => {
    expect(ACCOUNT_PWA_OPTIONS.workbox.runtimeCaching).toEqual([])
    expect(ACCOUNT_PWA_OPTIONS.workbox.navigateFallback).toBe('index.html')
    expect(ACCOUNT_PWA_OPTIONS.workbox.globPatterns).toEqual(['**/*.{html,css,js,woff2,png,ico,webmanifest}'])
  })

  it('ships the shared BakerRang favicon set, byte-for-byte, like every other web app', () => {
    const repoRoot = path.resolve(appRoot, '../../..')
    for (const file of ['android-chrome-192x192.png', 'android-chrome-512x512.png', 'apple-touch-icon.png', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon.ico']) {
      expect(readFileSync(path.join(appRoot, 'public', file)).equals(readFileSync(path.join(repoRoot, 'client/public', file))), file).toBe(true)
    }
  })
})

describe('theme boot without an inline script', () => {
  const [themeBoot] = viteConfig.plugins

  it('injects a same-origin script tag first in <head> and leaves no inline script in the page', () => {
    const html = themeBoot.transformIndexHtml.handler(read('index.html'))
    expect(html.match(/<head>\s*<script src="\/theme-boot\.js"><\/script>/)).not.toBeNull()
    expect(html.match(/<script(?![^>]*\bsrc=)[^>]*>/g)).toBeNull()
    expect(html.indexOf('/theme-boot.js')).toBeLessThan(html.indexOf('/src/main.jsx'))
    expect(html).not.toMatch(/onload=|onclick=|javascript:/i)
  })

  it('emits theme-boot.js as exactly the shared boot script', () => {
    const emitFile = vi.fn()
    themeBoot.generateBundle.call({ emitFile })
    expect(emitFile).toHaveBeenCalledWith({ type: 'asset', fileName: 'theme-boot.js', source: THEME_BOOT_SCRIPT })
  })
})

describe('per-app nginx headers (web/nginx/apps/account.conf)', () => {
  const conf = readFileSync(path.resolve(appRoot, '../../nginx/apps/account.conf'), 'utf8')
  const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; font-src 'self'; connect-src 'self' https://api.bakerrang.com; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests"
  const expectedHeaders = [
    ['Content-Security-Policy', csp],
    ['Strict-Transport-Security', 'max-age=31536000'],
    ['X-Frame-Options', 'DENY'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'no-referrer'],
    ['Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), clipboard-read=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Cross-Origin-Resource-Policy', 'same-origin']
  ]
  const locations = [...conf.matchAll(/location ([^{]+)\{([\s\S]*?)\n {4}\}/g)].map((match) => ({ path: match[1].trim(), body: match[2] }))

  it('serves the index, the service worker and everything else with all eight headers, always', () => {
    expect(locations.map((location) => location.path)).toEqual(['= /index.html', '= /sw.js', '/'])
    for (const location of locations) {
      for (const [name, value] of expectedHeaders) {
        expect(location.body, `${location.path} ${name}`).toContain(`add_header ${name} "${value}" always;`)
      }
    }
  })

  it('allows the microphone for itself only and no WASM, third-party origin or inline script', () => {
    expect(csp).not.toContain('wasm-unsafe-eval')
    expect(csp).not.toContain("'unsafe-inline'")
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp.match(/https?:\/\/[^\s;]+/g)).toEqual(['https://api.bakerrang.com'])
    expect(conf).toContain('microphone=(self)')
    expect(conf).not.toContain('microphone=()')
  })

  it('leaves the shared nginx.conf without CSP, so other apps are unaffected', () => {
    expect(readFileSync(path.resolve(appRoot, '../../nginx/nginx.conf'), 'utf8')).not.toContain('Content-Security-Policy')
  })
})
