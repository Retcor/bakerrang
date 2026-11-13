# Codex Session Notes - BakerRang Project

## Project Overview
A small family of consumer web tools sharing one Google sign-in:
- **`server/`** — Express API (`api.bakerrang.com`) on Cloud Run: Google OAuth + Firestore sessions,
  account preferences + cloned voices, Story Book (ChatGPT story/image), Polyglot (translation +
  ElevenLabs TTS + Deepgram transcription), Budget, the **zero-knowledge Password Vault** (`/vault`),
  and the public `/chatbot` used by the external dan-baker-info site (keep it).
- **`web/`** — npm workspace of Vite + React 18 apps, each its own Cloud Run service + subdomain:
  `launcher` (`launch.`), `storybook`, `polyglot`, `sign`, `budget`, `passwords`, `account`, plus shared
  `@bakerrang/web-*` packages. Follow `web/AGENTS.md`; design truth is `web/PRODUCT.md` + `web/DESIGN.md`.
- **`bakerrang.com` / `www.`** are served by the Launcher service and only 301-redirect (old paths →
  matching subdomain, else the Launcher) — `web/nginx/apps/launcher.conf`.
- Per-app migration history: `docs/apps/Phase*.md`. CI/CD: `docs/CI-CD.md`.

**Retired 2026-11-12 (deleted, do not reintroduce):** the legacy combined `client/` SPA, the `platform/`
multi-tenant marketing-site workspace (tenants/sites/leads/media/previews backend), WoW Advisor + its
`addon/`, SuperMarket, and the Chrome autofill `extension/`. `scripts/ci/classify-changes.mjs` keeps
no-op tombstone rules for those paths so stale deploy ranges stay classifiable — don't remove them.

## Password Vault (`web/apps/passwords` + `server/services/vaultService.js`)

**Zero-knowledge.** The server stores ciphertext only; all crypto runs in the browser
(`web/apps/passwords/src/vault/crypto.js`).
- Separate **master password** (not the Google login) → **Argon2id** master key → wraps a random
  **vault key** → wraps a **per-item content key** (AES-256-GCM, Web Crypto). Wrong password fails via the
  GCM tag; **no recovery by design**.
- Unlock state lives only in memory (`src/state/useVault.js`), so a page refresh always locks. The
  `autoLockMs` setting (default 8h, `null` = never) only drives the idle timer.
- Storage: Firestore `vaults/{userId}` + `items` / `folders` / `audit` subcollections (structural
  ownership). Routes in `server/routes/vault.js` (mounted `/vault`, `isAuthenticated` + rate limit +
  `noStore`). The only plaintext vault preference is `settings.autoLockMs` (`PUT /vault/settings`);
  `getVault` returns only known settings keys.
- `PUT /vault/key` (master-password change) exists server-side but has **no UI yet** — a future Passwords
  feature.
- **No `type="password"` inputs for vault data** (avoids browser "save password"); entry passwords use
  `type="text"` + masking. Master-password fields stay real password inputs.

**Folder sharing** (still zero-knowledge): each vault has an RSA-OAEP keypair (private key wrapped by
the vault key; `src/vault/keypair.js` migrates old vaults on unlock). Sharing a folder mints a **folder
key** wrapped to the owner (vault key) and to each recipient (their public key); entries carry a
`folderWrappedItemKey`. Server collection `vault_shares`; every cross-user `/vault/shared/:ownerId/...`
route is gated on a matching share (`requireShareForFolder`, `edit` for writes). Sharing is **recursive
(subtree)**; only the owner manages folder structure — recipients have no create-folder route.
- ⚠️ **ONE key per subtree: always resolve a folder's key to the OUTERMOST shared ancestor**, never the
  nearest. A nested share reuses the outermost ancestor's key (a second key previously caused
  "unreadable entry" for recipients).
- Simple revoke (drops the share, no key rotation).

**Real-time sync is polling, not websockets.** Every mutation calls `bumpShareRevs` (fire-and-forget),
incrementing `contentRev` + `lastWriterId` on affected shares; the client polls `GET /vault/revisions`
every 12s while unlocked and visible, ignoring changes flagged `mine`.

**Version history** (owner-only audit): `logAudit` (fire-and-forget) records every owned-data mutation in
`vaults/{ownerId}/audit` with ciphertext snapshots; recipient edits are logged under the owner's vault
with the recipient as actor (always from the session). Recipients can read an entry's history via
`/vault/shared/:ownerId/audit/item/:id`, filtered to the shared subtree with co-recipients redacted.
⚠️ The item/folder history queries need the two `audit` composite indexes in `firestore.indexes.json`.

## Backend security notes
- Session: `SESSION_SECRET`, Firestore session store, cookie `secure:'auto'`, `httpOnly`,
  `sameSite:'lax'`. helmet, express-rate-limit, and double-submit CSRF (`csrf-csrf`; enforced on
  authenticated mutations, `/chatbot` exempt) — `server/middleware/security.js`. `NODE_ENV=production`
  gates the strict cookie/CSRF settings.
- CORS allowlist = the web app `*_DOMAIN` origins + `CHATBOT_ORIGIN` (`server/config/origins.js`).
  OAuth return targets are a closed symbolic set (`server/config/oauthTargets.js`); a login with no
  `?target=` returns to the Launcher.
- ⚠️ **Operational follow-up the user must still do by hand:** rotate every key that was ever in the
  committed `server/.env` and scrub git history — they remain retrievable from history.

## Development Commands
```bash
cd server && npm ci && npm test && npm run lint
cd web && npm ci && npm test && npm run lint
cd web && npm run dev:passwords   # or dev:launcher, dev:storybook, ...
node --test scripts/ci/*.test.mjs
```
