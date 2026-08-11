# Claude Code Session Notes - Bakerrang Project

## Project Overview
Full-stack learning playground with React frontend and Express backend. Features include:
- Polyglot language learning tools with speech-to-text
- Voice cloning and text-to-speech capabilities
- Supermarket shopping list management
- Story generation tools
- Google OAuth authentication
- **Zero-knowledge Password Vault** (`/passwords`) — KeePass-style, client-side encrypted

## Password Vault + Security Hardening (2026-07)

### Zero-Knowledge Password Vault ✅
A KeePass-style password manager at `/passwords` where **the server never sees plaintext** — all encryption happens in the browser.

**Crypto model (client-side):**
- Separate **master password** (not the Google login). `client/src/utils/crypto.js` derives a master key via **Argon2id** (`hash-wasm`) and uses **AES-256-GCM** (Web Crypto).
- Key hierarchy: master key wraps a random **vault key**, which wraps a **per-item content key** (per-item keys keep Phase 2 sharing forward-compatible). Wrong master password fails via the GCM auth tag — no server-side password check. **No recovery by design.**
- Unlock state lives only in memory in `client/src/providers/VaultProvider.jsx` (auto-locks after 15 min); never persisted.
- KeePass `.kdbx` import decrypts **in-browser** (`kdbxweb` + hash-wasm Argon2) via `KeePassImportModal.jsx`; supports key files, rebuilds the nested group hierarchy as vault folders, and lets you pick which entries to import.

**Storage (server, ciphertext only):** Firestore `vaults/{userId}` doc + `items` and `folders` subcollections. Ownership is structural (everything under `vaults/{userId}`). See `server/services/vaultService.js` + `server/routes/vault.js` (mounted `/vault`, behind `isAuthenticated` + rate limit). Endpoints include vault init/`key` (master-password change), item CRUD + `/items/bulk` (import) + `/items/move` (bulk move), and folder CRUD + `/folders/reorder` (drag-and-drop order/parent). Move/reorder only touch plaintext metadata (`folderId`, `parentId`, `position`) — never re-encrypt.

**UI (`Passwords.jsx`, `PasswordEntryPanel.jsx`):**
- Master-detail: entry list + a responsive **side panel** (slides in on desktop, full-screen overlay with a ← Back button on mobile) — replaces the old modal.
- Folders: nested tree with expand/collapse chevrons, drag-and-drop reorder/re-parent (Pointer Events, works on touch via a grip handle), rename, and a **⋮ kebab menu** per folder (Rename / New subfolder / Delete). Deleting a folder cascades to subfolders and moves their entries to Unfiled (no passwords deleted).
- Entries: Username / Password (show-hide eye icon, copy, generate) / URL / Notes; **multi-select checkboxes** + a floating bottom **bulk-move bar**.
- **No `type="password"` inputs for vault data.** Browsers only offer "Save password?" for real password inputs — which was both annoying and would have put vault entries into the *browser's* password manager. The entry password and the KeePass file password use `type="text"` + the `.mask-text` class (`-webkit-text-security: disc`, in `index.css`) instead, plus `autoComplete='off'` / `data-1p-ignore` / `data-lpignore`. The show/hide eye just toggles that class. The master-password fields (create/unlock) deliberately stay real `type="password"` so a password manager can still fill them.
- Folder dropdowns use a **custom `FolderSelect` component** (`client/src/components/FolderSelect.jsx`), NOT a native `<select>`. Native selects render their **option popup as an OS-drawn window** that can't be reliably themed for dark mode (it kept rendering white) — so both the closed control and the open list are plain themed DOM here. Used in the entry panel and the bulk-move bar (`dropUp` for the bottom bar). `color-scheme` still follows the theme (`index.css`, keyed on `html.dark`) for other native controls (checkboxes). Don't reintroduce a native `<select>` for themed dropdowns.

### Backend Security Hardening ✅
The backend had **zero encryption** and several gaps before this work. Fixed:
- **Session** (`server/app.js`): secret moved to `process.env.SESSION_SECRET`; `resave:false`, `saveUninitialized:false`; cookie `secure:'auto'` (works on local http, Secure in prod), `httpOnly`, `sameSite:'lax'`; persistent **Firestore session store** (`server/client/firestoreSessionStore.js`) replacing the in-memory store.
- **helmet**, **express-rate-limit**, and **CSRF** (double-submit via `csrf-csrf`, enforced on authenticated mutations, `/chatbot` exempt) — `server/middleware/security.js`. Client `request()` (`client/src/utils/index.js`) auto-attaches the `x-csrf-token` header and retries once on 403.
- Fixed a **broken-access-control** bug in `server/routes/textToSpeech.js` (missing `return` after 403 let privileged actions run).
- `server/.env` untracked (`git rm --cached`), added to `.dockerignore`; `.env.example` added.
- **CSRF/production gating** keys off `NODE_ENV === 'production'`; set `NODE_ENV=production` when deploying. Local dev needs no env for cookies to work.

**⚠️ Operational follow-ups the user must still do by hand:** rotate every key that was in the committed `server/.env` (OpenAI, ElevenLabs, Google OAuth secret, Deepgram, Blizzard) and scrub git history — they remain retrievable from history.

### Phase 2: Folder Sharing ✅ (built)
Share a **whole folder** with another Google user, still zero-knowledge — the server never sees the folder key or any plaintext.

**Crypto:** every vault has an **RSA-OAEP keypair** (`createKeyPair` in `crypto.js`): public key stored plaintext, private key AES-GCM-wrapped by the vault key. Vaults created before Phase 2 **auto-migrate** (keypair generated + saved on next unlock, `ensureKeypair` in `VaultProvider`). Sharing a folder mints a random **folder key**, wrapped to the owner (vault key → `folder.wrappedFolderKey`) and to each recipient (their public key → `share.wrappedFolderKey`). Each entry's content key is re-wrapped to the folder key (`folderWrappedItemKey`), and the folder name is re-encrypted with the folder key (`folder.sharedName`) so recipients can read it.

**Storage/authz:** top-level `vault_shares` collection `{ownerId, folderId, recipientUserId, recipientEmail, permission, wrappedFolderKey}`. Shared entries stay under the **owner's** vault; cross-user endpoints (`/vault/shared/...`) are the *only* place a user touches another user's data, and **every one is gated on a matching share record** (`requireShare`), with `edit` required for writes. Entries a recipient adds have no vault-key copy, so the owner decrypts those via the folder key (handled in `loadEntries`).

**Decisions made:** folder-level (not per-entry) sharing; recipient **must already have a vault** (else a clear "they need to set up their vault" error); **simple revoke** (drops the share — no key rotation, so warn the user to change the password); **edit + view-only** permissions enforced server-side.

**UI:** folder kebab → **Share…** (`ShareFolderModal.jsx`) to add by email with edit/view and revoke; a **"Shared with me"** section in the sidebar; view-only hides Save and disables New Entry; recipients can't delete or re-file shared entries.

**Sharing is recursive (subtree).** Sharing a parent shares **every descendant folder and entry**, present and future — one folder key covers the whole subtree, so a move *within* it needs no re-wrap. The server resolves access by walking `parentId` (`folderSubtreeIds` + `requireShareForFolder`), so a share on a parent authorizes anything beneath it.

**Only the owner manages folder structure.** Recipients (with `edit`) can add/edit entries, bulk-move them between existing folders, and **KeePass-import** into the selected shared folder (groups are flattened) via `/vault/shared/:ownerId/...`; the owner sees all of it. Recipients **cannot create folders** — there is deliberately no route for it (an earlier attempt produced duplicate folders in the owner's tree). Because recipient-created folders/entries have no vault-key copy, the owner's `loadEntries` falls back to the subtree folder key (`subtreeKeyForFolder`) — folders decrypt via `sharedName`, entries via `folderWrappedItemKey`. Moving entries **into** a shared subtree re-wraps their keys; moving **out** clears the stale key (`moveItems` `folderKeys` map).

Owners see a **people icon** in the sidebar on folders they've shared.

## Password Vault — Round 3: real-time sync + sharing fixes (2026-08)

### Vault UX additions
- **KDBX export** (`ExportVaultModal.jsx`): downloads a password-encrypted KeePass 2.x
  `.kdbx` built **in-browser** from the already-decrypted `items`/`folders` — prompts for a
  **separate export password** (not the master), never uploads plaintext. Uses `kdbxweb`
  2.1.1 `Kdbx.create/createGroup/createEntry/save`. The kdbxweb interop shim + Argon2
  registration were factored out of `KeePassImportModal.jsx` into **`client/src/utils/kdbx.js`**
  (`getKdbxweb`/`ensureArgon2`) so import and export share one source. **Export** button sits
  beside **Import** in the toolbar (was "Import KeePass", now just "Import").
- **Delete All** in the bulk-move bar: a red trash button between the folder dropdown and
  Clear, **owned views only** (hidden when `isSharedView`), confirmed via the existing
  `ConfirmModal` (`confirmDelete.type === 'bulk'`). Backed by `vault.deleteItems(ids)` which
  loops the vetted per-item DELETE (no new endpoint).
- **Shared indicator**: the people icon moved off the entry count to a leading position on
  owned shared folders; **hovering** shows a hoisted card listing each recipient's email +
  edit/view (from `myShares`), **clicking** opens the share manager (touch has no hover).
- **Shared folders populated up front**: recipient's "Shared with me" folders now show entry
  counts, subfolders, and expand carets **without clicking** — `VaultProvider` prefetches
  each share's subtree at unlock into `sharedTrees` (`{ [shareId]: { items, folders } }`,
  mirrored in `sharedTreesRef`) via `fetchSharedTree`/`loadSharedTrees`, reusing the existing
  `GET /vault/shared/:ownerId/tree/:rootId` endpoint. `openSharedFolder` reads that cache.
- **Eye toggle** on the create + unlock master-password fields via a shared
  `MasterPasswordInput` (toggles `type` password/text — stays a real password input so
  managers can fill it).
- **Loading buttons keep their size**: Save/Export/Import buttons render the label
  invisibly with the spinner overlaid (`relative` + `absolute inset-0`) instead of shrinking.
- **Shared-folder header** shows just a compact `can edit`/`view only` **pill**; the owner
  email is in its tooltip (keeps the breadcrumb room when the entry panel is open).

### Real-time sync (polling model — NOT websockets)
Shared-folder changes propagate to other logged-in participants **without a refresh**, still
zero-knowledge (server signals only a non-secret counter; clients re-fetch + decrypt locally).
Chosen over SSE/WebSocket because the app runs on **GKE (multi-pod) with no message bus** —
a push connection would need cross-pod fan-out. Polling a counter needs zero new infra.

- **Server** (`vaultService.js` + `routes/vault.js`): each `vault_shares` doc gains
  `contentRev` (int) + `lastWriterId`. **`bumpShareRevs(ownerId, folderIds, actorId)`** —
  fire-and-forget, called from **every** mutation (owner + shared side) — increments
  `contentRev` on every share whose subtree contains a changed folder, stamping the actor.
  A few mutations pre-read the folder id (`deleteItem`, owner `moveItems` source via `getAll`,
  `updateItem`/`updateFolder` old values); `deleteFolder` bumps **before** deleting (awaited)
  so the tree still contains the subtree. **`GET /vault/revisions`** returns
  `{ received: {shareId:{rev,mine}}, owned: {...} }` — `mine` = the last writer was me.
- **Client** (`VaultProvider.jsx`): a 12s poll (paused when tab hidden) while `unlocked`
  diffs the counters vs a baseline (`revsRef`), skipping any change flagged **`mine`** (so you
  never notify yourself). **Structural** flags (a share newly appearing / disappearing) fire
  **only on the received side** — an owned-share add/revoke is your own action, so revoking a
  user no longer notifies the owner. Detected changes set `updatesAvailable`; `applyUpdates()`
  re-fetches the affected shared trees / owned entries.
- **UI** (`Passwords.jsx`): if no entry panel is open, changes **auto-apply**; if one is open,
  a **"Updates available — Refresh"** banner shows instead (protects unsaved edits), applying
  on close or click. An effect keyed on the open entry's `updatedAt` **re-seeds the panel**
  (via a `panelNonce` in its `key`) when a Refresh pulls an edit, and **closes it** if the
  entry was deleted by someone else — a no-op after your own save.

### ⚠️ Sharing key rule: ONE key per subtree, resolve to the OUTERMOST shared ancestor
Sharing a **subfolder** of an already-shared folder used to mint a **second, different**
folder key and stamp it on the subfolder, which then shadowed the parent share's key —
owner edits got wrapped with the wrong key and recipients saw **"(unreadable entry)"**.
Fixed in `VaultProvider.jsx` with `outermostSharedRecord(byId, folderId)` (the topmost
ancestor-or-self with a `wrappedFolderKey`), used by `subtreeKeyForFolder`, `loadEntries`'
`subtreeKey`, and `repairSharedSubtrees` (only heals from topmost roots). **`shareFolder`
now reuses the outermost ancestor's key** for a nested share instead of generating one.
Keep this invariant: never resolve a folder's key to the *nearest* shared ancestor — always
the outermost.

- **`saveItem` fallback** (`reencryptItemKeepingKey` in `crypto.js`): if the folder key can't
  be resolved when editing an existing shared entry, re-encrypt under the entry's **existing
  content key** so its `folderWrappedItemKey` stays valid (recipients keep access) instead of
  minting a vault-only key that silently locks them out.
- **Repair sharing** action (folder kebab, shown for shared folders): re-wraps a shared
  folder's whole subtree to the correct key via `repairFolderSharing` →
  `buildSubtreeSetup(...,false)` → `PUT /vault/folders/:id/share-setup` (force, not
  onlyMissing). Heals entries broken by a past key conflict; only re-wraps **owner-owned**
  entries (recipient-created ones must be re-saved by the recipient). Shows an inline status
  banner; recipients auto-refresh via the rev bump.

## Password Vault — Version History / audit log (2026-08)

An **owner-only** version history for the vault: every create / update / delete /
move of an entry or folder you **own** is recorded, so you can see *what* changed on
an entry, *when*, and *who* did it (yourself vs. a share-recipient), and find a
recently-deleted entry. **Never shown for folders/entries shared WITH you.** Still
zero-knowledge — records store ciphertext snapshots decrypted only in the browser.

**Storage:** subcollection `vaults/{ownerId}/audit/{auditId}` (structural ownership,
owner-only). Record = `{ action, targetType, targetId, folderId, actorId, actorEmail,
createdAt, snapshot, meta }`. `action` ∈ `item.{create,update,delete,move}` /
`folder.{create,update,delete,move}`. `snapshot` is the decryptable ciphertext state
(item = `{ wrappedItemKey, ciphertext, folderWrappedItemKey, folderId }` →
`decryptItem`; folder = `{ ciphertext, sharedName }` → `decryptFolder`); `null` for
pure moves (which carry `meta.{fromFolderId,toFolderId}` instead). Bulk ops → one
record per item/folder (per-entry history stays complete).

**Server** (`vaultService.js` + `routes/vault.js`): `logAudit(ownerId, entries, actor)`
— fire-and-forget, batched, best-effort (mirrors `bumpShareRevs`; callers `.catch()`
and never await) — is called from **every owned-data mutation**, including the
`/vault/shared/...` recipient paths (logged under the **owner's** vault with the
**recipient** as `actor` — that's what attributes an edit to "user X"). Mutation
service fns took an optional trailing `actor` = `{ id, email }`, threaded from routes
via `actorOf(req)` (always from the session, never the body). Reader `listAudit(ownerId,
{ targetId, folderId, limit, before })` backs three **owner-only GET** routes (no CSRF):
`/vault/audit`, `/vault/audit/item/:id`, `/vault/audit/folder/:id`.

**⚠️ Firestore composite index required:** the `item`/`folder` queries combine
`where('targetId'|'folderId','==',…)` with `orderBy('createdAt','desc')` — Firestore
errors on the first such call with a **one-click create link**. Create it, then retry.
The global `/vault/audit` query is single-field (createdAt) and needs no composite index.

**Client:** `VaultProvider` exposes `getAudit` / `getItemHistory` / `getFolderHistory`
(inline `request().then(jsonOrThrow)`) + **`decryptSnapshot(record)`** (reuses
`loadEntries`' key resolution: vault key first, `subtreeKeyForFolder` folder-key
fallback). `HistoryModal.jsx` (modeled on `ShareFolderModal`, hoisted at `VaultView`
root) renders a reverse-chron timeline in three modes — `item` (per-entry, with a
field-level diff vs. the previous version + deleted-entry contents), `folder` (the
folder's own events + entries within it), `global` (**Activity** — vault-wide, for
finding deleted entries). "You" vs. actor email comes from `useAuth()`. Surfaced via a
clock **IconButton** in `PasswordEntryPanel` header (`onHistory`, non-new entries),
a **"Version history…"** folder ⋮ item, and an **Activity** toolbar button (owned view
only).

**Shared entries (recipient view).** An entry in a folder shared WITH you also shows the
clock button (view-only shares included) — **entries only**, no folder/global history for
recipients, no new sidebar UI. Reads go through **`GET /vault/shared/:ownerId/audit/item/:id`**
→ `listSharedItemAudit`, which: (1) authorizes via the existing `requireShareForFolder`
(view is enough), (2) **filters records to the shared subtree** (`folderSubtreeIds`) so an
entry's history from when it lived in the owner's *private* folders is never returned, and
(3) **redacts co-recipients server-side** — any actor who isn't the requester or the owner
has `actorId` + `actorEmail` stripped, so a recipient can't discover who else the folder is
shared with. Client decrypts snapshots with the **folder key** via `decryptSharedSnapshot`
(not the vault key); `HistoryModal`'s `shared` prop swaps in the endpoint + decryptor and
labels actors **You / owner email / "Another collaborator"**. Same composite index as owner
item history — no new index.

## Browser Extension — Vault Autofill (2026-08)

A Chrome/Edge **Manifest V3** extension in the top-level `extension/` folder that
autofills logins from the vault, matched to the current tab's URL. **v1 scope: autofill
only (read), personal vault only** (no saving new logins, no password generation, no
shared-folder entries, no Firefox — those are the documented phase-2 list).

**Zero-knowledge preserved.** All decryption happens locally in the extension's service
worker, reusing the web app's **real** crypto module via a Vite alias
`@vault-crypto` → `client/src/utils/crypto.js` (single source of truth, **not** a copy —
`vite.config.js`). The read path needs only the already-exported `unlockVault()` +
`decryptItem()`, so **`crypto.js` is unchanged**. Master password is never stored;
`chrome.storage.session` holds only the raw vault key (base64) + still-encrypted records,
wiped on browser close, with a 15-min auto-lock (`chrome.alarms`) mirroring the app.

**Auth needs no server change.** The three read endpoints (`GET /vault`, `/vault/items`,
`/vault/folders`) are all GET (no CSRF). The MV3 **service-worker** `fetch` with the
`host_permissions` entry for `api.bakerrang.com` sends the httpOnly `connect.sid` session
cookie automatically and bypasses page CORS — **verified working** (returns 200). So the
extension is authenticated as whoever is logged into the web app in that browser.

**Architecture:** `src/background.js` (service worker — API + crypto + unlock state +
auto-lock + message handlers `status`/`unlock`/`matchesForTab`/`fill`/`lock`),
`src/lib/{api,session,match}.js`, `src/content.js` (field detection + fill), `src/popup/*`
(the only place the master password is typed). Build: **Vite 4 + `@crxjs/vite-plugin`**;
install needs `npm install --legacy-peer-deps` (crxjs 1.x declares a stale Vite peer
range). MV3 CSP includes `'wasm-unsafe-eval'` for Argon2id (hash-wasm).

**Cross-origin iframe logins** (e.g. Barclays embeds `www.barclaycardus.com` in
`cards.barclaycardus.com`): the content script uses **`all_frames: true`** so it injects
into every frame. The `fill` message is broadcast to all frames and a frame **responds
only if it actually filled**, so the empty top frame doesn't win the response race and
falsely report "No login fields found." Filling uses the native value setter +
focus + a full keydown/input/keyup/change event sequence so React/Angular-controlled
inputs register the change, plus a **corrective 150 ms second pass** that re-applies
the value only where it didn't stick — needed for autofill-hardened bank fields (e.g.
Citi's `#userId`, `autocomplete="one-time-code"`) that blank the value by re-syncing
from their framework model right after the first programmatic set. Note the
isolated-world caveat: a fill that works in a DevTools/page-world test can still fail
in the content script, so test with the actual loaded extension.

**Field-detection still-open cases (phase 2):** shadow-DOM forms (querySelector doesn't
pierce shadow roots), reveal-on-click forms (fields don't exist until a button is
clicked), and separate-origin popup **windows** (a distinct tab, not an iframe).

**Loading / reloading (also in `extension/README.md`):** `npm run build` writes `dist`;
load it once via `chrome://extensions` → Developer mode → **Load unpacked** → pick
`extension/dist`. After any change you need **two reloads**: (1) ↻ the extension card
(mandatory for `manifest.config.js` changes like permissions/`all_frames`), then (2)
**refresh the target web page** (content scripts only inject at page load — forgetting
this is the #1 "my fix didn't work" cause).

### Round 2 enhancements (2026-08)
- **Server-synced vault settings.** Plaintext `settings` map `{ autoLockMs, inlineAutofill }`
  on the `vaults/{userId}` doc (non-secret prefs; the first server-readable plaintext there).
  `getVault` returns it; new `updateSettings` service fn + **`PUT /vault/settings`** route
  (auth + CSRF gated). Shared defaults/options live in `client/src/utils/vaultSettings.js`
  (`DEFAULT_SETTINGS` = 8h / inline on; `AUTO_LOCK_OPTIONS`). The extension mirrors the same
  defaults in `extension/src/lib/session.js`.
- **Configurable auto-lock (default 8h).** `VaultProvider` no longer hard-codes 15 min — it
  reads `autoLockMs` from `settings` (state), `null` = never lock (effect early-returns).
  `settings` + `updateSettings` are exposed on the vault context. Edited on the **Account
  page** (new "Password Vault" section: `FolderSelect` dropdown + a toggle switch). Extension
  auto-lock is driven by `isIdleExpired(state)` off the same setting. Changes apply on next
  vault load/unlock per context (not live-pushed).
- **Clickable entry URL.** `PasswordEntryPanel` URL field gained an open-in-new-tab
  `IconButton` (disabled when empty). `openUrl()` prepends `https://` when schemeless and
  **only** opens `http(s)` (blocks `javascript:` etc.) with `noopener,noreferrer` — the app's
  only external-link opener.
- **Inline autofill (extension, opt-in via `inlineAutofill`).** On focus of a login field the
  content script asks `background.inlineMatches` (metadata only, does **not** reset the idle
  timer) and, if matches, shows a small key icon over the field; click fills (or shows a
  chooser for multiples) via `background.fillHere`, which decrypts in the SW and sends `fill`
  back to **that exact frame** (`sender.frameId`) — no broadcast, works in iframes. The popup
  Fill path is unchanged. No new manifest permissions.
- **Eye icon** on the popup master-password field (`popup.js` `renderLocked`) toggles
  `input.type` password/text.

## Branding / Logos (2026-08)

The app logo is a blocky pixel **"B" monogram** — **golden-yellow `#FFC018` + neutral
charcoal `#303030`/`#181818`** (sampled from the art), transparent PNG. It replaced an
earlier circular "BR" badge; the logo went through several iterations before this one.
Assets:
- **In-app logo** (bundled, imported): `client/src/assets/bakerrang-logo.png` — used in the
  header (`MainContent.jsx`, **logo only**, `h-12`; the old "BakerRang" text + "AI" pill were
  removed) and the login page (`Login.jsx`, a large `h-44` badge above the tagline, no
  wordmark). Import it, don't hardcode.
- **Favicons / PWA** (served at web root from `client/public/`): `favicon.ico` (a 32px
  PNG-embedded ICO), `favicon-16/32x32.png`, `apple-touch-icon.png`,
  `android-chrome-192/512x512.png`, and `site.webmanifest`. Linked in `client/index.html`;
  tab `<title>` is "BakerRang". `site.webmanifest` is brand-tuned (`theme_color: #FFD500`,
  `background_color: #1a1a1a`) — keep it; don't overwrite with a generic package manifest.
- **Extension icons**: `extension/icons/icon-{16,32,48,128}.png`, wired via the manifest
  `icons` map + `action.default_icon` (`manifest.config.js`); the popup (`popup.js`) shows
  `icon-48.png`. **Rebuild the extension (`npm run build`) after changing icons** so `dist`
  updates, then reload the extension card.

Source package: `~/Downloads/bakerrang-logo-assets` (1680px `-master.png`).

**⚠️ Logo packages have shipped with ~84% transparent padding** (mark ~16% of each frame →
renders as a tiny dot everywhere, favicons included). Every asset above was **auto-trimmed
from the master and regenerated tightly** (mark ~90% fill) — done with the running browser's
`<canvas>` (no ImageMagick/sharp installed): draw the master, compute the alpha bounding box,
redraw cropped+centered at each target size, `toDataURL` → write bytes. If you swap logos
again, **check the alpha fill first** and re-trim if it's padded.

Browser favicon and extension-toolbar icons cache hard — hard-refresh / reload to see updates.

## Color Scheme / Palette (2026-08)

The palette is **gold accent + neutral charcoal**, matched to the logo. It replaced the
original split accent (lime `#D4ED31` in dark / blue `#1e40af` in light — both **retired**).

- **Single source of truth: CSS vars in `:root`** (`client/src/index.css`):
  `--brand-gold: #FFD500` (primary accent, both modes), `--brand-gold-hover: #F0C400`,
  `--brand-gold-deep: #9A6B00` (accent **text/SVG on light bg**, where bright gold would be
  illegible), `--brand-ink: #1f2937` (dark text placed **on** gold fills). Mirrored as a
  `brand` token in `tailwind.config.cjs` (`bg-brand`/`text-brand`) for new markup.
- **Accent classes** (all reference the vars): `.text-brand-{light,dark}`,
  `.text-accent-{light,dark}`, `.btn-primary-{light,dark}`, `.bg-accent-{light,dark}`,
  `.fill-accent-{light,dark}`. Buttons/fills are bright gold with `--brand-ink` text in both
  modes; only accent **text** differs (deep amber on light, bright gold on dark).
- **Surfaces:** dark mode is a **solid neutral charcoal `#1a1a1a`** (`.dark-theme-bg`, was a
  warm brown-black gradient); light mode is a **neutral light-gray gradient** (`.light-theme-bg`,
  was warm cream). Dark glass borders carry a faint gold tint `rgba(255,213,0,0.14)`.
- **Dropdowns/modals:** dark dropdowns (`.glass-dropdown-dark`, plus `FolderSelect`'s list =
  `bg-neutral-800`) are **neutral charcoal**, not pure black / blue-slate. Modal panels use
  dedicated **`.glass-modal-{light,dark}`** (`~0.97` opaque) instead of the translucent
  `.glass-card-*` — a 60%-opaque card goes muddy-gray over the `bg-black/50` backdrop. All 5
  modals (Confirm/AddVoice/BudgetItem/ShareFolder/KeePassImport) use these.
- **⚠️ Text-on-accent gotcha:** anything on `bg-accent-*` must use **dark** text
  (`text-gray-900` / `var(--brand-ink)`), **never white** — the old blue-accent used white
  text, which is illegible on gold. This was fixed across ~15 components; keep it dark if you
  add new accent surfaces.
- The WoW inline focus-borders (`WoWChat.jsx`, `WoWAdvisor.jsx`) and the Passwords folder
  drag-drop indicator (`Passwords.jsx`) use the gold hex directly (`#FFD500`) — keep in sync
  with `--brand-gold` if it changes. Domain colors (WoW class colors, Budget category colors,
  SignLanguage canvas) are intentionally **not** themed.

## Recent Major Updates (2025-09-14)

### Theme System Implementation ✅
- **Added comprehensive dark/light mode** with glassmorphism styling
- **Theme toggle** located in user dropdown (MainContent.jsx)
- **ThemeProvider.jsx** - React context for theme management
- **localStorage persistence** - theme persists across sessions
- **Glassmorphism CSS classes** added to index.css

### Key Files Modified
- `client/src/providers/ThemeProvider.jsx` - Core theme management
- `client/src/App.jsx` - Wrapped with ThemeProvider
- `client/src/MainContent.jsx` - Added theme toggle to user dropdown
- `client/src/index.css` - Added glassmorphism CSS classes
- All page and component files updated for theme support

## Comprehensive UI Modernization (Previous Session)

### Login Page Complete Redesign ✅
- **Modern glassmorphism layout** with floating particles and decorative elements
- **Updated tagline** to "Building AI tools that bring people together"
- **Enhanced GoogleLogin button** with theme-adaptive styling and gradient overlays
- **Background redesign** with soft gray-blue gradient replacing harsh black/yellow

### Navigation Bar Modernization ✅
- **Logo enhancement** - Replaced star icon with "AI" badge next to "BakerRang"
- **Removed Account from navbar** - Moved to profile dropdown only
- **Modern menu styling** with better spacing and hover effects
- **Profile dropdown improvements** - Solid backgrounds for better visibility
- **Click-outside functionality** - Dropdowns close when clicking elsewhere
- **Fixed hover box positioning** - No longer appears outside dropdown boundaries

### Account Page Complete Redesign ✅
- **Separated sections** for "Cloned Voices" and "SuperMarket Licenses"
- **Section headers** with descriptive icons and explanatory text
- **Empty states** with helpful messaging and guidance
- **Primary voice selection** - Only shows checkmark for currently selected primary voice
- **Enhanced delete buttons** - Proper red styling with hover effects
- **Modern checkbox design** - Smaller, cleaner appearance with vertical label layout
- **License content display** - Fixed content not appearing in license boxes

### Storybook Page Major Overhaul ✅
- **Hero section** with book icon and "AI Story Generator" branding
- **Smart input visibility** - Input shows when no story exists, hides during story display
- **Enhanced story generation** - Enter key support for quick generation
- **"New Story" functionality** - Returns to input prompt instead of generating immediately
- **Loading indicators** - Progress bar with percentage and descriptive text
- **Story display layout** - Grid layout with text and AI-generated images
- **Pagination system** - Navigate between story pages with modern buttons
- **Audio narration** - Voice selection dropdown with "Narrate" button

### Modal System Improvements ✅
- **Centered positioning** - All modals appear in center of viewport (pt-[15vh]/pt-[20vh])
- **Scroll locking** - Background scrolling disabled with comprehensive CSS properties
- **Glassmorphism styling** - Semi-transparent backgrounds with backdrop blur
- **Improved visibility** - Better text contrast and overlay coverage
- **Consistent behavior** - Applied to ConfirmModal and AddVoiceModal

### Dropdown System Fixes ✅
- **AudioStreamPlayerSelector** - Fixed positioning and toggle behavior
- **Profile dropdown** - Added click-outside functionality
- **Proper toggle logic** - Dropdowns close when clicked again or clicking elsewhere
- **Enhanced "Narrate" button** - Clear voice selection indication with dropdown arrow

## Recent Session Updates (2025-09-20)

### SuperMarket Page Modernization ✅
- **Complete redesign** of SuperMarket shopping list management page
- **Hero section** with shopping cart icon and "Shopping List Manager" branding
- **Smart statistics** showing available products count and items in cart
- **Empty state messaging** with guidance to visit Account page for licenses
- **Enhanced action buttons** with icons for "Sort by Count" and "Reset All"
- **Responsive grid layout** for product display

### ProductCounter Component Enhancement ✅
- **Modern card design** with hover effects and scale animations
- **Visual feedback system** for items in cart with accent color highlights
- **Enhanced +/- buttons** with proper SVG icons (minus/plus)
- **Dynamic styling** based on product count state
- **"Added" badge** indicator for items with count > 0
- **Improved accessibility** with disabled states and proper contrast

## Current Session Updates (2025-09-21)

### Polyglot Page Modernization ✅
- **Complete hero section** with translation icon and "AI Language Translator" branding
- **Statistics grid** showing supported languages, real-time speed, and voice synthesis
- **Translation Workspace** with unified glassmorphism card design
- **Language selection bar** with clean dropdown layout (removed "From"/"To" labels)
- **Enhanced input/output sections** with proper headers and visual hierarchy
- **Translate button** with modern loading states and visual feedback
- **Fixed microphone functionality** - replaced browser speech recognition with working backend transcription

### PolyglotInstant Page Modernization ✅
- **Hero section** with "Instant Voice Translator" branding and download icon
- **Statistics showcase** highlighting one-click operation, instant translation, and language count
- **Translation Control Center** with streamlined interface design
- **Simplified language selection** without explicit labels (clean dropdown-swap-dropdown layout)
- **Large, prominent microphone button** (160px mobile, 192px desktop) as focal point
- **Modern processing indicator** with spinner animation and proper positioning
- **Mobile-responsive design** with optimized spacing and button sizes
- **Voice information display** positioned prominently under main title

### Speech Recognition System Overhaul ✅
- **Replaced unreliable browser speech recognition** with backend Google Speech-to-Text API
- **Updated SpeechToText component** to use GoogleSpeechToText + AudioRecorder workflow
- **Microphone functionality now works** on Polyglot page using same reliable system as PolyglotInstant
- **AudioRecorder component** handles media recording and base64 conversion
- **Backend transcription** via `/text/to/speech/google/transcribe` endpoint
- **Visual feedback improvements** with red pulsating microphone during recording

### Mobile Navigation System Fix ✅
- **Fixed hamburger menu navigation** on smaller screens that was completely non-functional
- **Added missing Account link** to mobile menu (was only in desktop dropdown)
- **Fixed click-outside handler logic** with proper ref management for mobile vs desktop menus
- **Removed duplicate mobile menu** that was causing conflicts
- **Simplified Link components** - removed complex overlay elements that blocked click events
- **Proper mobile menu positioning** within hamburger button container with unified ref scope
- **All navigation now works** on mobile devices with complete feature parity

### UI Polish & Consistency ✅
- **Removed redundant labels** ("From"/"To") from both Polyglot pages for cleaner interface
- **Consistent glassmorphism styling** across all new components
- **Modern loading animations** with proper spinner designs
- **Enhanced mobile responsiveness** with progressive sizing (sm:, lg: breakpoints)
- **Fixed JSX syntax errors** that were preventing app compilation
- **Improved button sizing** and spacing for better touch targets on mobile
- **Processing indicators** now properly contained within content areas

### Key Design Patterns Established
- **Hero sections** with icon, title, description, and statistics
- **Empty states** with helpful icons and actionable messaging
- **Action button groups** with proper spacing and visual hierarchy
- **Card-based layouts** with glassmorphism effects and hover animations
- **Consistent icon usage** throughout the interface
- **Theme-adaptive styling** across all new components

### CSS Classes Available
```css
/* Glassmorphism backgrounds */
.glass-light, .glass-dark
.glass-card-light, .glass-card-dark
.glass-hover-light, .glass-hover-dark

/* Theme backgrounds */
.light-theme-bg, .dark-theme-bg

/* Theme text colors */
.text-theme-light, .text-theme-dark
.text-theme-secondary-light, .text-theme-secondary-dark
```

### Component Architecture
- All components use `useTheme()` hook
- Consistent glassmorphism styling patterns
- Material Tailwind dependencies removed and replaced
- Proper z-index hierarchy (z-50 dropdowns, z-40 nav, z-10 content)

### Fixed Issues (Previous Sessions)
- ✅ Google Speech-to-Text empty transcriptions (microphone selection issue)
- ✅ Login button dark mode styling inconsistencies
- ✅ Yellow text visibility problems in light mode
- ✅ Theme color hardcoding - replaced all #D4ED31 references with theme classes
- ✅ Floating input labels disappearing in dark mode
- ✅ Delete button visibility in Account page
- ✅ Primary checkbox showing multiple selections
- ✅ Modal positioning and scroll locking issues
- ✅ Dropdown z-index problems (appearing behind content)
- ✅ AudioStreamPlayerSelector dropdown positioning
- ✅ Profile dropdown click-outside functionality
- ✅ App crashes with infinite re-renders in dropdowns
- ✅ Generate Story button positioning in input field
- ✅ PolyglotInstant microphone loading indicator bug
- ✅ Material Tailwind Alert/Button replacements
- ✅ Prop passing consistency across components

### Fixed Issues (Current Session)
- ✅ **Mobile hamburger menu navigation completely non-functional** - Fixed click-outside handler, ref management, and duplicate menu removal
- ✅ **Microphone not working on Polyglot page** - Replaced unreliable browser speech recognition with backend Google Speech-to-Text API
- ✅ **JSX syntax errors preventing app compilation** - Fixed template literal syntax issues in Polyglot.jsx
- ✅ **Processing translation indicator overflowing content area** - Repositioned with proper spacing and container bounds
- ✅ **Missing Account link in mobile menu** - Added complete feature parity between mobile and desktop navigation
- ✅ **Complex overlay elements blocking click events** - Simplified Link components for reliable navigation
- ✅ **Inconsistent dropdown styling across components** - Unified glassmorphism design patterns

## Development Commands
```bash
# Client development
cd client && npm run dev

# Linting (if available)
npm run lint

# Type checking (if available)
npm run typecheck
```

## Git Status Reference
- Main branch: `main`
- Recent work focused on voice recording features and UI improvements
- All theme changes ready for commit when requested

## Notes for Future Sessions
- Theme system is complete and fully functional
- All 24+ components support dark/light modes
- Glassmorphism effects work across all UI elements
- Material Tailwind dependency has been removed
- Z-index issues have been resolved
- No outstanding theme-related bugs
- **SuperMarket page modernization complete** - follows established design patterns
- **ProductCounter component enhanced** with modern card design and interactions
- **Modal consistency achieved** - All modals use unified glassmorphism styling and button design

### Modernization Status
- ✅ **Login page** - Complete glassmorphism redesign with floating particles
- ✅ **Account page** - Separated "Cloned Voices" and "SuperMarket Licenses" sections
- ✅ **MainContent/Navigation** - Modern navbar with AI badge, mobile menu fixed, removed Account from nav
- ✅ **Storybook page** - Hero section, smart input visibility, loading states, story display
- ✅ **SuperMarket page** - Hero section, statistics, grid layout, enhanced product cards
- ✅ **Polyglot page** - Hero section, statistics, translation workspace, working microphone
- ✅ **PolyglotInstant page** - Hero section, control center, large microphone button, mobile responsive
- ✅ **All modals** - Centered positioning with scroll locking and glassmorphism
- ✅ **Dropdown systems** - Proper toggle behavior and click-outside functionality
- ✅ **Speech recognition** - Backend Google Speech-to-Text API replacing unreliable browser API
- ✅ **Mobile navigation** - Hamburger menu fully functional with complete feature parity
- ✅ **Theme consistency** - All hardcoded colors replaced with theme-adaptive classes

### Key Component Updates
- **InputWrapper.jsx** - Added onKeyDown prop for Enter key support
- **ConfirmModal.jsx** - Centered positioning, scroll locking, and unified glassmorphism styling
- **AddVoiceModal.jsx** - Enhanced positioning, glassmorphism styling, and consistent button design
- **AudioStreamPlayerSelector.jsx** - Fixed dropdown positioning and "Narrate" button design
- **ProductCounter.jsx** - Modern card design with hover effects and visual feedback
- **SuperMarket.jsx** - Complete redesign with hero section and statistics
- **Polyglot.jsx** - Complete modernization with hero section, statistics, and translation workspace
- **PolyglotInstant.jsx** - Streamlined design with large microphone button and mobile responsiveness
- **SpeechToText.jsx** - Replaced Microphone component with GoogleSpeechToText for reliable transcription
- **MainContent.jsx** - Fixed mobile navigation with proper ref management and click-outside handling
- **LoadingSpinner.jsx** - Attempted modernization (reverted to original design per user preference)

## Component Patterns
When updating components:
1. Import `useTheme` from `../providers/ThemeProvider.jsx`
2. Use `const { isDark } = useTheme()`
3. Apply conditional glass classes: `${isDark ? 'glass-dark' : 'glass-light'}`
4. Use theme text colors: `${isDark ? 'text-theme-dark' : 'text-theme-light'}`
5. Add transition classes for smooth theme switching

## Architecture Notes
- React 18 with Vite build system
- StandardJS linting rules
- Component-based architecture with shared utilities
- Context providers for app state and theme management