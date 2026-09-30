import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { THEME_BOOT_SCRIPT } from '@bakerrang/web-theme/boot'

// The theme boot is a served file, not an inline script: the app's CSP allows
// only `script-src 'self'`.
const themeBoot = {
  name: 'account-theme-boot',
  transformIndexHtml: { order: 'pre', handler: (html) => html.replace('<head>', '<head>\n    <script src="/theme-boot.js"></script>') },
  generateBundle () { this.emitFile({ type: 'asset', fileName: 'theme-boot.js', source: THEME_BOOT_SCRIPT }) }
}

export const ACCOUNT_PWA_OPTIONS = {
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png'],
  manifest: {
    id: '/',
    name: 'Account — BakerRang',
    short_name: 'Account',
    description: 'Your BakerRang profile, theme and voices.',
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
  // Shell only: no API response (identity, preferences, voices) is ever cached.
  workbox: { globPatterns: ['**/*.{html,css,js,woff2,png,ico,webmanifest}'], navigateFallback: 'index.html', runtimeCaching: [] }
}

export default defineConfig({ plugins: [themeBoot, react(), VitePWA(ACCOUNT_PWA_OPTIONS)] })
