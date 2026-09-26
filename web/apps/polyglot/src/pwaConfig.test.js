import { describe, expect, it } from 'vitest'
import { POLYGLOT_PWA_OPTIONS } from '../vite.config.js'

describe('Polyglot PWA', () => {
  it('has its own identity and never runtime-caches private API or audio content', () => {
    expect(POLYGLOT_PWA_OPTIONS.manifest).toMatchObject({ id: '/', name: 'Polyglot — BakerRang', short_name: 'Polyglot', start_url: '/', display: 'standalone' })
    expect(POLYGLOT_PWA_OPTIONS.workbox.runtimeCaching).toEqual([])
    expect(POLYGLOT_PWA_OPTIONS.workbox.globPatterns.join(' ')).not.toMatch(/api|audio|voice|translation/i)
  })
})
