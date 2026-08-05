# Bakerrang Vault Autofill (browser extension)

A Chrome/Edge (Manifest V3) extension that autofills logins from the
zero-knowledge Bakerrang password vault, matched to the current tab's URL.

It preserves the vault's zero-knowledge model: all decryption happens locally in
the extension's service worker using the web app's real crypto module
(`client/src/utils/crypto.js`, imported via the `@vault-crypto` alias — never
copied, so the two can't drift). The server only ever returns encrypted data, and
the master password is never stored.

## How it works

- **Popup** (`src/popup/`) — the only place you type the master password. Shows the
  entries that match the current site with a **Fill** button, plus **Lock**.
- **Background service worker** (`src/background.js`) — fetches the encrypted vault
  from `https://api.bakerrang.com`, unlocks it with `unlockVault()`, decrypts
  entries with `decryptItem()`, matches URLs, and holds unlock state in
  `chrome.storage.session` (in-memory; wiped on browser close). Auto-locks after
  15 minutes of inactivity, mirroring the web app.
- **Content script** (`src/content.js`) — passive until it receives a fill command,
  then writes the username/password into the page's login fields (using the native
  value setter so React/controlled inputs register the change).

Authentication is automatic: the service worker's requests carry the same
`connect.sid` session cookie as the web app, so **as long as you are logged into
the Bakerrang web app in this browser**, the extension is authenticated. No API
keys, no separate login.

## Build & load (unpacked)

```bash
cd extension
npm install --legacy-peer-deps
npm run build
```

> `--legacy-peer-deps` is needed because `@crxjs/vite-plugin@1.x` declares an
> outdated Vite peer range (Vite 2); it works fine with the Vite 4 used here.

Then load it in Chrome/Edge (first time):

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/dist` folder (the `dist`
   folder itself, not `extension/`).

## Reloading after a change

`npm run build` only rewrites `dist` — the browser does **not** pick that up on its
own. After any change you need **two reloads**:

1. **Reload the extension:** `chrome://extensions` → click the **↻ reload icon** on
   the extension card. Required for every code change, and mandatory for any
   `manifest.config.js` change (permissions, `all_frames`, etc.), which only take
   effect on reload.
2. **Reload the target web page:** content scripts are injected at page load, so a
   tab that was already open is still running the *old* content script until you
   refresh it. Always refresh the site you're testing before trying Fill again.

Forgetting step 2 is the most common "my fix didn't work" cause.

Rebuild + both reloads in short:

```bash
cd extension && npm run build   # then ↻ the extension, then refresh the page
```

### Live-development alternative

Run `npm run dev` instead of `build` and load `dist` the same way. crxjs then
rebuilds and hot-reloads on file changes, so you usually skip the manual extension
reload — but you still refresh the target page for content-script changes.

## Using it

1. Log into the Bakerrang web app so a session exists in this browser.
2. Click the extension icon, enter your **master password**, and unlock.
3. On any site with a saved login, open the popup and click **Fill**.

## Scope (v1)

Autofill only — read access to your **personal** vault. Not yet included: saving
new logins, generating passwords, entries from folders shared with you, and
Firefox support. See the plan for the phase-2 list.

## Authentication (verified working)

The extension carries the same `connect.sid` session cookie as the web app: the
service-worker `fetch` to a host in `host_permissions` sends the httpOnly cookie
and bypasses page CORS, so no API keys or separate login are needed — just be
logged into the web app in the same browser. **This was confirmed** (the check
below returns `200`), so no server-side CORS/cookie changes were required.

If you ever need to re-check it (e.g. after a server change), open the service
worker console (`chrome://extensions` → this extension → **service worker**) and
run:

```js
(await fetch('https://api.bakerrang.com/vault/items', { credentials: 'include' })).status
```

Expect `200`. A `401` means the cookie isn't being attached — see the plan's Risks
section for fallbacks.
