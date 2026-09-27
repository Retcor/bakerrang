import { describe, expect, it } from 'vitest'
import { BUDGET_PWA_OPTIONS } from '../vite.config.js'

describe('Budget PWA', () => {
  it('has the approved isolated identity and never runtime-caches API data', () => {
    expect(BUDGET_PWA_OPTIONS.manifest).toMatchObject({ id: '/', name: 'Budget — BakerRang', short_name: 'Budget', start_url: '/', scope: '/' })
    expect(BUDGET_PWA_OPTIONS.workbox.runtimeCaching).toEqual([])
    expect(BUDGET_PWA_OPTIONS.workbox.globPatterns.join(' ')).not.toMatch(/api|json/)
  })
})
