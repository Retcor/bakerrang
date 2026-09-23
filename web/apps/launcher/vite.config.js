import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { THEME_BOOT_SCRIPT } from '@bakerrang/web-theme/boot'

const themeBoot = {
  name: 'bakerrang-theme-boot',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace('<head>', `<head>\n    <script>${THEME_BOOT_SCRIPT}</script>`)
  }
}

export default defineConfig({
  plugins: [
    themeBoot,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
        'android-chrome-512x512.png'
      ],
      manifest: {
        id: '/',
        name: 'BakerRang Launcher',
        short_name: 'BakerRang',
        description: 'Open six focused BakerRang tools from one workshop.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#161514',
        background_color: '#161514',
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{html,css,js,woff2,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        runtimeCaching: []
      }
    })
  ]
})
