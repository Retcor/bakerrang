import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import manifest from './manifest.config.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Single source of truth: the extension imports the vault's real crypto module
// (client/src/utils/crypto.js) rather than a copy, so the two can never drift.
export default defineConfig({
  resolve: {
    alias: {
      '@vault-crypto': path.resolve(dirname, '../client/src/utils/crypto.js')
    }
  },
  // crypto.js lives outside this project root, so allow Vite to read the parent.
  server: {
    fs: { allow: ['..'] }
  },
  plugins: [crx({ manifest })]
})
