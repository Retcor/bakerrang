import { describe, expect, it } from 'vitest'
import { STORYBOOK_PWA_OPTIONS } from '../vite.config.js'

describe('Story Book PWA configuration', () => {
  it('keeps its independent identity and never runtime-caches private product data', () => {
    expect(STORYBOOK_PWA_OPTIONS.manifest).toMatchObject({
      id: '/',
      name: 'Story Book — BakerRang',
      short_name: 'Story Book',
      start_url: '/',
      scope: '/',
      display: 'standalone'
    })
    expect(STORYBOOK_PWA_OPTIONS.manifest.icons).toEqual([
      expect.objectContaining({ src: '/android-chrome-192x192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/android-chrome-512x512.png', sizes: '512x512' })
    ])
    expect(STORYBOOK_PWA_OPTIONS.workbox.runtimeCaching).toEqual([])
  })
})
