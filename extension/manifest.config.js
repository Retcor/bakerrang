import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Bakerrang Vault Autofill',
  version: '0.1.0',
  description: 'Autofill logins from your zero-knowledge Bakerrang password vault, matched to the current site.',

  // storage      -> chrome.storage.session (in-memory unlock state)
  // activeTab    -> read the active tab's URL + message its content script when the popup is open
  // alarms       -> periodic auto-lock check
  permissions: ['storage', 'activeTab', 'alarms'],

  // Required so the service worker's fetch() sends the api.bakerrang.com session
  // cookie and is exempt from page CORS.
  host_permissions: ['https://api.bakerrang.com/*'],

  // Store / chrome://extensions / installed-extension icon. Paths are relative to
  // the extension root; crxjs copies them into dist and rewrites the manifest.
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png'
  },

  background: {
    service_worker: 'src/background.js',
    type: 'module'
  },

  action: {
    default_popup: 'src/popup/popup.html',
    default_title: 'Bakerrang Vault',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png'
    }
  },

  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content.js'],
      run_at: 'document_idle',
      // Bank/enterprise logins often live in a cross-origin iframe (e.g. Barclays
      // embeds www.barclaycardus.com inside cards.barclaycardus.com). Inject into
      // every frame so the field detector can reach those forms.
      all_frames: true
    }
  ],

  // Argon2id (hash-wasm) needs WebAssembly, which MV3 gates behind
  // 'wasm-unsafe-eval'. All code is bundled locally ('self') — no remote code.
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
})
