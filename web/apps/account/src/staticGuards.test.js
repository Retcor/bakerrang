import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(appRoot, '../../..')

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = path.join(dir, entry)
  return statSync(full).isDirectory() ? walk(full) : [full]
})
const isSource = (file) => /\.(js|jsx|css)$/.test(file) && !/\.test\.(js|jsx)$/.test(file) && !file.includes(`${path.sep}test-support${path.sep}`)
const sources = walk(path.join(appRoot, 'src')).filter(isSource).map((file) => ({ file: path.relative(appRoot, file).replaceAll('\\', '/'), text: readFileSync(file, 'utf8') }))
const everything = [...sources, { file: 'index.html', text: readFileSync(path.join(appRoot, 'index.html'), 'utf8') }]

const offenders = (pattern) => everything.filter(({ text }) => pattern.test(text)).map(({ file }) => file)

describe('Account owns only global concerns', () => {
  it('has source to check', () => {
    expect(sources.map(({ file }) => file)).toEqual(expect.arrayContaining(['src/App.jsx', 'src/voices/useVoices.js', 'src/styles/account.css']))
  })

  it('contains nothing about Supermarket or product licences', () => {
    expect(offenders(/supermarket|licen[cs]e/i)).toEqual([])
  })

  it('contains no password-vault code, settings or requests, and does not import Passwords', () => {
    expect(offenders(/vault|useVault|VaultProvider|autoLock|inlineAutofill|\/vault/)).toEqual([])
    expect(offenders(/apps\/passwords|web-passwords|hash-wasm|kdbxweb/)).toEqual([])
  })

  it('has no theme logic of its own: no cookie, no preferences fetch, no local storage', () => {
    expect(offenders(/document\.cookie|br_theme|\/account\/preferences/)).toEqual([])
    expect(offenders(/localStorage|sessionStorage|indexedDB|caches\.|caches\)|navigator\.storage/)).toEqual([])
  })

  it('never builds markup from strings and never logs', () => {
    expect(offenders(/dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write/)).toEqual([])
    expect(offenders(/\bconsole\./)).toEqual([])
  })

  it('loads no third-party font or script (the CSP allows only self-hosted assets)', () => {
    expect(offenders(/fonts\.googleapis|fonts\.gstatic|https?:\/\/(?!myaccount\.google\.com|localhost)/)).toEqual([])
  })

  it('imports only React, the router and shared web packages', () => {
    const bad = []
    for (const { file, text } of sources.filter(({ file: name }) => /\.jsx?$/.test(name))) {
      for (const match of text.matchAll(/from '([^']+)'/g)) {
        const source = match[1]
        const allowed = source.startsWith('.') || source === 'react' || source === 'react-dom/client' || source === 'react-router-dom' || /^@bakerrang\/web-(api-client|app-shell|auth|theme|tokens|ui)(\/|$)/.test(source) || source === 'virtual:pwa-register'
        if (!allowed) bad.push(`${file}: ${source}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('never reaches into the B2B platform workspace', () => {
    expect(offenders(/platform\//)).toEqual([])
  })
})

describe('legacy Account (LH-1)', () => {
  const legacy = readFileSync(path.join(repoRoot, 'client/src/components/Account.jsx'), 'utf8')

  it('no longer offers Supermarket licences or vault settings', () => {
    for (const forbidden of [/supermarket/i, /productLicenses/, /ProductLicense/, /useVault/, /FolderSelect/, /AUTO_LOCK_OPTIONS/, /licenses/, /autoLock/, /inlineAutofill/]) {
      expect(legacy).not.toMatch(forbidden)
    }
  })

  it('points to Passwords for vault settings', () => {
    expect(legacy).toContain('Vault settings moved to Passwords.')
    expect(legacy).toContain("import.meta.env.VITE_PASSWORDS_URL || 'https://passwords.bakerrang.com'")
  })

  it('keeps cloned-voice management working until the final cleanup', () => {
    expect(legacy).toContain('Cloned Voices')
    expect(legacy).toContain('AddVoiceModal')
    expect(legacy).toContain('/text/to/speech/v1/voices')
  })

  it('leaves the legacy Supermarket page itself in place (owner decision 2)', () => {
    expect(statSync(path.join(repoRoot, 'client/src/components/SuperMarket.jsx')).isFile()).toBe(true)
    expect(statSync(path.join(repoRoot, 'server/routes/superMarket.js')).isFile()).toBe(true)
  })
})

describe('Account is registered as a shared destination, not a tool', () => {
  const shell = readFileSync(path.join(repoRoot, 'web/packages/web-app-shell/src/index.jsx'), 'utf8')

  // The live URL itself is asserted by the registry test in web-app-shell, which the cutover
  // PR updates. This guard covers what must hold before and after the flip.
  it('keeps the legacy route and env key in the registry entry', () => {
    const definition = shell.slice(shell.indexOf('export const ACCOUNT_DEFINITION'), shell.indexOf('export const LAUNCHER_DEFINITION'))
    expect(definition).toContain("legacyPath: '/account'")
    expect(definition).toContain("envKey: 'VITE_ACCOUNT_URL'")
  })

  it('does not put Account in the tool grid', () => {
    const tools = shell.slice(shell.indexOf('export const TOOL_DEFINITIONS'), shell.indexOf('export const ACCOUNT_DEFINITION'))
    expect(tools).not.toContain("id: 'account'")
  })
})
