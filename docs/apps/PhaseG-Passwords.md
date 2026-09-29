# Phase G — Passwords extraction (`passwords.bakerrang.com`)

> **Status: APPROVED (product, security, design) — PHASE G READY FOR CODEX** after the four post-approval contract
> corrections (2026-09-27): §5.4 plaintext residency (honest v1 wording), §11.2 exact-match KDF acceptance, §12.2a
> sharing-keypair race + L1 reconciliation, and the gold Save wording + §16.3 dependency-audit gate. The security architecture was audited and locked first (§§1–18).
> Product and design followed (§§19–29). The owner's decisions are recorded below. The Impeccable finish verdict is
> **ship** (§29a). **No production code has been written.**
> Author role: Planner / Product-Design / Security-Architecture authority.
> Builds on the locked [Phase 0 architecture](Phase0-EcosystemArchitecture.md) and the Phase C–F template
> ([Budget](PhaseF-Budget.md), [Budget runbook](Budget-PhaseF-Runbook.md), [Sign](PhaseE-SignLanguage.md)). No earlier phase
> is reopened. Where Phase G changes a shared mechanism, it says so (§23: the per-app nginx config).
>
> Design artifacts (consumer Impeccable world, `web/`):
> - Surface brief and direction contract: [`web/.impeccable/surfaces/passwords.md`](../../web/.impeccable/surfaces/passwords.md)
> - Interactive comp: [`web/.impeccable/mocks/passwords-comp.html`](../../web/.impeccable/mocks/passwords-comp.html) (all
>   states from its review panel or `?state=`; every value in it is synthetic)
> - App-icon master (spec): [`web/.impeccable/mocks/passwords-icon.svg`](../../web/.impeccable/mocks/passwords-icon.svg)
> - Legacy audit captures and review captures: `web/.impeccable/review/passwords/*.png` (gitignored run output, synthetic data)

**Roadmap change (orchestrator, 2026-09-27).** **WoW Advisor is retired from migration.** It stays live in legacy only
until a later decommission. There will be no WoW app, Cloud Run service, subdomain, data migration, fixes or redesign, and
no Impeccable cycle. The legacy implementation is **not** deleted yet. The working tree had no uncommitted WoW Phase G
artifacts to discard (`git status` was clean at the start of this phase). **Phase G is now Passwords.** Remaining consumer
work: Phase G (Passwords), Phase H (Account), then legacy/decommission cleanup (which now includes WoW). See the Phase 0
supersede note.

**Owner decisions (2026-09-27):**
1. **Keep folder sharing.** Share/Revoke, "Shared with me", edit vs view-only, and recipients' per-entry history carry
   forward. Existing shares keep working with no data change.
2. **Search matches title, username and URL only.** Notes are secret-class, like passwords: they're never kept in the
   index, search state or any list state. (A v1 entry is one encrypted blob, so building the index briefly decrypts all of
   it; §5.4 locks the exact residency contract.)
3. **Structure: "Three panes, evolved"** from the legacy UI: folder tree | dense entry list with the A–Z rail | entry sheet.
   Entries open in a read-only **View** first, with an explicit **Edit** (a security requirement, §15).
4. **More gold, icon-only tools (owner review of the comp, 2026-09-27).** The first comp read "a little too black and
   white". Gold now marks action across Passwords: gold fills on New entry and on every sheet/dialog commit, gold switches
   and checked boxes, and Gold Text on active states. **Copy, Show, Open, Edit, Version history and Delete become
   icon-only** buttons with accessible names and tooltips. Every other control keeps its label. This supersedes the world's
   "one gold fill per surface" rule **for Passwords only** (§19.3).
5. Naming: `passwords.bakerrang.com`, `web/apps/passwords`, `@bakerrang/web-passwords`, service `web-passwords` /
   `bakerrang-web-passwords`, OAuth target `passwords`, `PASSWORDS_DOMAIN`, `VITE_PASSWORDS_URL` (already the registry
   env key). No conflict was found (§23).

---

## 1. Legacy implementation inventory (repository truth)

Everything below was read from source, and the security-relevant parts were then **observed running**: the real legacy
client was run against a throwaway in-memory API, seeded with synthetic data that the **real** `crypto.js` encrypted.
Findings marked **(observed)** were measured in that harness, not inferred from code.

### 1.1 Where it lives

| Layer | Truth |
|---|---|
| Route | `/passwords` → `<Passwords />` inside the legacy `MainContent` shell (`client/src/App.jsx:36`). `VaultProvider` wraps **every** legacy route (`MainContent.jsx:44`), so vault state outlives navigation between legacy pages. `/login` sits outside `MainContent`, so logout unmounts it. |
| Page | `client/src/components/Passwords.jsx` (1,717 lines): create/unlock views, the three-pane vault, folder tree + drag-reorder, search, A–Z rail, bulk bar, folder ⋮ menu, share hover card. |
| Entry panel | `client/src/components/PasswordEntryPanel.jsx` (277): the always-editable form, copy/reveal/generate/open-URL, and `generatePassword`. |
| Modals | `KeePassImportModal.jsx` (276), `ExportVaultModal.jsx` (175), `ShareFolderModal.jsx` (152), `HistoryModal.jsx` (400), `ConfirmModal.jsx` (62), `FolderSelect.jsx` (56, a custom listbox). |
| State + keys | `client/src/providers/VaultProvider.jsx` (1,054): the unlock state machine, key refs, decryption, sharing, 12 s revision polling, history reads, auto-lock. |
| Crypto | `client/src/utils/crypto.js` (250). `client/src/utils/kdbx.js` (33) is the kdbxweb interop + Argon2 registration. `client/src/utils/vaultSettings.js` holds the setting defaults. |
| Settings UI | `client/src/components/Account.jsx:200–270`: the "Password Vault" section (auto-lock select + inline-autofill switch). **Account depends on `useVault()`.** |
| Launcher tiles | Legacy `AppGrid.jsx:71`. New registry `web/packages/web-app-shell/src/index.jsx:13`: `{ id:'passwords', …, legacyPath:'/passwords', liveUrl:null, envKey:'VITE_PASSWORDS_URL' }`. The `passwords` ProductEmblem (padlock) and `--accent-passwords` (`#aeb8c2` / `#4d5867`) exist. |
| New Launcher copy | `web/apps/launcher/src/Launcher.jsx:116–120`: the "Vault" module, with the tag **"Zero-knowledge"** and "We store the locked bytes and never see your passwords." (§5.3 reviews the claim.) |
| Server | `server/routes/vault.js` (111) + `server/services/vaultService.js` (932), mounted `app.use('/vault', vaultLimiter, isAuthenticated, vaultRouter)` (`server/app.js:123`). |
| Maintenance | `server/scripts/backfillAuditBaseline.js`, a manual operator script that resets and seeds audit history from stored ciphertext. It never decrypts. |
| Browser extension | `extension/` (MV3). The Vite alias `@vault-crypto` points at **`client/src/utils/crypto.js`** (`extension/vite.config.js`). It reads `GET /vault`, `/vault/items`, `/vault/folders`, and **exports the raw vault key** into `chrome.storage.session`, so it relies on the key being extractable. The classifier ignores `extension/` (`ci:[] deploy:[]`), so it's built by hand. |
| Firestore | `vaults/{uid}` + subcollections `items`, `folders`, `audit`; top-level `vault_shares`. **Not in `firestore.indexes.json`:** the audit composite indexes (targetId/folderId + createdAt desc). They were created by hand from the console link. |
| Dependencies | `hash-wasm@4.12.0` (Argon2id), `kdbxweb@2.1.1` (KeePass). Both are bundled, with no CDN. |
| Tests | **None.** No test covers `crypto.js`, `vaultService.js`, `routes/vault.js`, the provider or any component. (`server/test/tenantExportService.test.js` only names `/vault` as excluded data.) |
| History | `ffb34fa` (vault + KeePass import + backend hardening) → `31ed020` (mobile, move, reorder) → `fd2c979` (folder sharing) → `b1fd515` (recipients can't create folders) → `58fa581` (auto-lock setting, extension inline fields, open-URL) → `14cf127` (real-time sync) → `fb81ea6`, `bf47f98` (version history, incl. shared entries). **One ciphertext format since `ffb34fa`.** No format migration has ever run. The only data migration is the in-client keypair backfill (`ensureKeypair`). |
| Environment | No vault-specific env vars. Session/CSRF secrets are shared (`SESSION_SECRET`, `CSRF_SECRET`). The API base is `VITE_API_BASE_URL`. |

### 1.2 What the product actually is

A **personal password vault with folder sharing**, protected by a master password that is separate from Google sign-in.
Entries have five fields (`title`, `username`, `password`, `url`, `notes`). Folders nest. Sharing is by folder, to
another BakerRang user who already has a vault. The server stores ciphertext only. A version-history log records every
change to data you own. There's KeePass import/export, and a Chrome/Edge extension that autofills from your personal
entries.

### 1.3 Capability inventory (what exists, verified)

| Capability | Exists | Notes |
|---|---|---|
| Master password create / unlock | yes | Create requires ≥ 8 chars + confirm. **No change-master-password UI** (the provider exports `changeMasterPassword`, but nothing calls it; `PUT /vault/key` is live and unguarded, S4). |
| Recovery | **no, by design** | Forgetting the master password loses the vault. The create screen says so. |
| Entry fields | title, username, password, url, notes | No TOTP, custom fields, attachments, tags, favorites or entry icons. |
| Folders | nested, drag-reorder, rename, ⋮ menu, delete cascades (entries → Unfiled) | |
| Search | title + username + URL + **notes**, multi-token AND, ignores the selected folder | Notes drop out in Phase G (owner decision 2). |
| A–Z jump rail | yes (≥ 20 results), drag-scrub | |
| Password generator | yes: 20 chars, fixed 80-char set, `crypto.getRandomValues` | Modulo reduction; no class guarantee (CR7). |
| Show/hide password | CSS mask on a `type="text"` input | Leaks (S7, S8). |
| Copy username/password | yes, `navigator.clipboard.writeText` | No announcement; failure silently ignored; no auto-clear. |
| Open URL | yes, http(s) only, `noopener,noreferrer` | A good guard; kept. |
| Bulk select / move / delete | yes | Hover-trash on each row too. |
| KeePass `.kdbx` import | yes, in-browser, key files, group → folder tree, pick entries | |
| KeePass `.kdbx` export | yes, in-browser, separate export password | Owned entries only (not shared-with-me). |
| Folder sharing | yes: recursive subtree, edit/view, revoke (no key rotation), "Repair sharing" | |
| Real-time sync | 12 s poll of `GET /vault/revisions` (non-secret counters) while unlocked + visible | |
| Version history | owner: per entry / folder / vault-wide Activity; recipients: per entry, subtree-scoped, co-recipients redacted | Kept forever; deleted entries stay decryptable in history. |
| Settings | `autoLockMs` (15 m / 1 h / 8 h / Never; default 8 h), `inlineAutofill` (extension) | Plaintext on the vault doc, edited in **Account**. |
| Offline | none | |
| Favorites, tags, TOTP, breach checks, password health, attachments | no | |

### 1.4 Persisted schema (exact, as written today)

```js
// vaults/{userId}
{ userId, kdf: { algo:'argon2id', iterations:3, memory:65536, parallelism:1, hashLength:32, salt:<b64 16 bytes> },
  protectedVaultKey: { iv:<b64 12B>, ct:<b64 32B key + 16B tag> },
  publicKey?: <b64 SPKI RSA-2048>, protectedPrivateKey?: { iv, ct },   // absent on pre-sharing vaults until next unlock
  settings?: { autoLockMs?: number|null, inlineAutofill?: boolean },   // PLAINTEXT, non-secret
  createdAt: ms, updatedAt: ms }

// vaults/{userId}/items/{itemId}      (itemId: server randomUUID, or client-supplied if sent — S12)
{ folderId: string|null,
  ciphertext: { iv, ct },                 // AES-GCM(JSON {title,username,password,url,notes}, itemKey)
  wrappedItemKey: { iv, ct } | null,      // AES-GCM(itemKey raw, vaultKey); null for recipient-created entries
  folderWrappedItemKey: { iv, ct } | null,// AES-GCM(itemKey raw, folderKey) when inside a shared subtree
  createdAt: ms, updatedAt: ms }

// vaults/{userId}/folders/{folderId}
{ parentId: string|null, position: number|null,
  ciphertext?: { iv, ct },                // AES-GCM(JSON {name}, vaultKey); absent on recipient-created folders (none can exist now)
  sharedName?: { iv, ct },                // AES-GCM(JSON {name}, folderKey) inside a shared subtree
  shared?: true, wrappedFolderKey?: { iv, ct },   // on a share root: AES-GCM(folderKey raw, vaultKey)
  createdAt: ms, updatedAt: ms }

// vaults/{ownerId}/audit/{auditId}
{ action:'item.create|update|delete|move'|'folder.create|update|delete|move', targetType, targetId, folderId,
  snapshot: {wrappedItemKey,ciphertext,folderWrappedItemKey,folderId} | {ciphertext,sharedName} | null,
  meta: {fromFolderId,toFolderId} | {toParentId,position} | null, actorId, actorEmail, createdAt }

// vault_shares/{shareId}
{ id, ownerId, folderId, recipientUserId, recipientEmail, permission:'edit'|'view',
  wrappedFolderKey: <b64 RSA-OAEP(folderKey raw, recipient public key)>, contentRev: int, lastWriterId?, createdAt }
```

**Plaintext on the server (all non-secret, but metadata):** ids, folder tree shape (`parentId`, `position`), entry and
folder counts, which folder each entry is in, all timestamps, the `shared` flag, the share graph (owner, recipient id,
**recipient email**, permission), actor ids and emails in history, settings, and ciphertext **sizes**, which roughly
reveal field lengths. JSON isn't padded.

### 1.5 API surface (all under `isAuthenticated` + `vaultLimiter` 300/15 min/IP; mutations under global double-submit CSRF)

`GET /vault` · `POST /vault` · `PUT /vault/key` · `PUT /vault/settings` · `POST /vault/keys` · `GET /vault/pubkey?email=` ·
`GET|POST /vault/items` · `POST /vault/items/bulk` · `PUT /vault/items/move` · `PUT|DELETE /vault/items/:id` ·
`GET /vault/audit`, `/audit/item/:id`, `/audit/folder/:id` · `POST|GET /vault/shares` · `GET /vault/revisions` ·
`GET /vault/shares/folder/:folderId` · `DELETE /vault/shares/:id` · `GET /vault/shared` ·
`GET /vault/shared/:ownerId/tree/:rootId` · `POST /vault/shared/:ownerId/folders/:folderId/items` ·
`POST /vault/shared/:ownerId/items/bulk` · `PUT /vault/shared/:ownerId/items/move` · `PUT /vault/shared/:ownerId/items/:id` ·
`GET /vault/shared/:ownerId/audit/item/:id` · `GET|POST /vault/folders` · `PUT /vault/folders/reorder` ·
`PUT /vault/folders/:id/share-setup` · `PUT|DELETE /vault/folders/:id`.

Error handling: `handle()` returns `error.message` for every status, including 5xx, and `console.error(error)` logs the raw
object for 5xx. There's **no `Cache-Control`** on any `/vault` response (Budget got `noStore`; the vault didn't). The body
limit is the global 10 MB JSON parser.

---

## 2. Security architecture and data path

```
 ┌──────────────────────────── browser: passwords.bakerrang.com (JS served by web-passwords / nginx) ─────────────────────────┐
 │                                                                                                                              │
 │  master password ──typed──▶ Argon2id(m=64MiB,t=3,p=1, salt from server) ──▶ masterKey (AES-256, memory only)                │
 │                                                          │                                                                   │
 │   GET /vault ◀── { kdf, protectedVaultKey, publicKey, protectedPrivateKey, settings }                                     │
 │                                                          ▼                                                                   │
 │                              vaultKey = AES-GCM-decrypt(protectedVaultKey, masterKey)   ← wrong password = GCM tag failure  │
 │                              privateKey (RSA-OAEP) = AES-GCM-decrypt(protectedPrivateKey, vaultKey)                          │
 │                                                          │                                                                   │
 │   GET /vault/items ◀── [{ ciphertext, wrappedItemKey, folderWrappedItemKey, folderId, rev }]  (ciphertext only)             │
 │                                                          ▼                                                                   │
 │        itemKey = decrypt(wrappedItemKey, vaultKey)  or  decrypt(folderWrappedItemKey, folderKey)                             │
 │        { title, username, password, url, notes } = decrypt(ciphertext, itemKey)                                              │
 │          ├─ INDEX (while unlocked): ONLY id, folderId, title, username, url, rev     ← full decrypt is transient (§5.4)      │
 │          └─ OPEN ENTRY (memory while its sheet is open): + password, notes             ← decrypted again on open             │
 │                                                                                                                              │
 │   edit ──▶ new itemKey ─▶ AES-GCM(JSON entry) ─▶ PUT /vault/items/:id { ciphertext, wrappedItemKey, folderWrappedItemKey,  │
 │            folderId, expectedRev }                                                   (ciphertext + ids only; no plaintext)  │
 │                                                                                                                              │
 │   share ──▶ POST /vault/pubkey {email} ◀── recipient publicKey (SERVER-SUPPLIED, unverified — §6 T12)                       │
 │             folderKey ─RSA-OAEP─▶ share.wrappedFolderKey ;  folderKey ─AES-GCM(vaultKey)─▶ folder.wrappedFolderKey           │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
            │ HTTPS, same-site credentialed fetch, session cookie (HttpOnly, host-only api.bakerrang.com), CSRF header
            ▼
 ┌──────────── api.bakerrang.com (Express) ────────────┐        ┌──────────── Firestore ────────────┐
 │ identity = req.user.id (session)                    │ ─────▶ │ vaults/{uid}/{items,folders,audit}│
 │ structural ownership: vaults/{req.user.id}/…        │        │ vault_shares (share graph)        │
 │ cross-user only via a matching vault_shares record  │        │ ciphertext + structural metadata  │
 │ validates shapes/sizes; can't decrypt anything      │        └───────────────────────────────────┘
 └─────────────────────────────────────────────────────┘
```

**Separation of concerns (locked):** Google sign-in decides **who may fetch which ciphertext**. The master password
decides **who can decrypt it**. They're independent: a Google session never yields a key, and the master password is
never sent anywhere.

---

## 3. Cryptographic audit

### 3.1 Parameters (exact)

| Item | Value | Source |
|---|---|---|
| Data encryption | **AES-256-GCM**, Web Crypto `subtle.encrypt`, 128-bit tag (the Web Crypto default) | `encryptBytes` |
| IV / nonce | **96-bit random** from `crypto.getRandomValues`, fresh on **every** encryption, stored beside the ciphertext | `randomBytes(12)` |
| Nonce uniqueness | Random 96-bit IVs. A key is safe to 2³² encryptions (NIST SP 800-38D). The busiest key (the vault key) wraps one item key per save plus folder names: orders of magnitude below that. Item keys are **fresh per save**, except `reencryptItemKeepingKey`, which reuses a content key with a fresh IV (fine). | |
| Vault key | 256-bit random, generated once at vault creation, **never rotated** (not even on a master-password change) | `createVault` |
| Item key | 256-bit random per save | `encryptItem` |
| Folder key (sharing) | 256-bit random per shared subtree (one key per subtree, outermost root wins) | `generateFolderKeyRaw` |
| KDF | **Argon2id** (`hash-wasm` 4.12.0, WASM), **m = 65,536 KiB (64 MiB), t = 3, p = 1**, 32-byte output | `DEFAULT_KDF` |
| KDF inputs | UTF-8 master password (hash-wasm encodes it) + a 16-byte random salt per vault. No pepper or secret server input. | `deriveMasterKey` |
| KDF parameter storage | Plaintext on the vault doc (`kdf`), read back at unlock. **Every existing vault uses exactly `DEFAULT_KDF`**: only `createVault` and the unused `rewrapVaultKey` write it, and both use the default. | |
| Master key | Argon2 output imported as an AES-GCM key. It wraps only the vault key. | |
| Sharing keypair | **RSA-OAEP 2048, SHA-256**, e = 65537. Public SPKI stored plaintext; private PKCS#8 AES-GCM-wrapped by the vault key. | `createKeyPair` |
| Ciphertext encoding | JSON `{ iv, ct }`, both standard base64 (`btoa`). `ct` = ciphertext‖tag. Entry plaintext = `JSON.stringify({title,username,password,url,notes})`, UTF-8, unpadded. | |
| Version marker | **None on blobs.** `kdf.algo` is the only de facto version. Everything is "v1" by construction (one format since `ffb34fa`). | |
| Associated data | **None.** No AAD binds a blob to its item id, field role, owner or folder. | |
| Key extractability | Every AES key is imported `extractable: true`. The RSA private key is non-extractable. | `importAesKey` |
| Integrity | GCM authenticates each blob. A wrong key or any tampered bit throws `OperationError`. That's how a wrong master password is detected (no server check). | `decryptBytes` |

### 3.2 Checklist of unsafe patterns

| Pattern looked for | Present? |
|---|---|
| AES-CBC without MAC / AES-ECB | **No** (GCM only) |
| Static or reused IVs, counter nonces | **No** (random per call) |
| Home-grown cipher, obfuscation, XOR, hashing-as-encryption | **No** (Web Crypto + Argon2 only) |
| Hard-coded keys / server-side universal key | **No** (no key exists server-side) |
| Weak KDF | **No.** 64 MiB / t=3 / p=1 exceeds the OWASP Argon2id baselines (19 MiB t=2, or 46 MiB t=1). But see CR5. |
| Deterministic ciphertext | **No** (random IVs, fresh item keys) |
| Missing integrity | **Per blob: no** (GCM). **Context binding: missing** (CR1). |
| `Math.random` for secrets | **No.** The generator uses `getRandomValues`. Legacy `uid()` elsewhere (Budget) isn't vault code. |

**Verdict: the cryptography is sound and is not replaced.** Phase G changes **no ciphertext format**. The findings are
hardening gaps. None is a break.

### 3.3 Cryptographic findings

| # | Finding | Severity | Phase G action |
|---|---|---|---|
| CR1 | **No AAD / context binding.** An attacker who can *write* Firestore (but not ship code) can swap whole blobs between entries, roll an entry back to an older ciphertext (e.g. from its own audit history), or move a `wrappedItemKey` pair onto another id. Each blob still authenticates. Confidentiality is unaffected. | Low–Medium (needs DB write access) | **DEFER** a v2 envelope (§11.5 specifies the migration). Documented under "not protected against" (§6). No silent change. |
| CR2 | **No per-blob version marker.** | Low | **Rule locked now:** a blob without `v` is v1. `v` is reserved. The Phase G server strips unknown blob keys on write (§12.2), so a future v2 needs an explicit validator change. |
| CR3 | **Vault key is extractable** in the web app. XSS can export the raw key and keep a durable way to decrypt future data and all history. | Medium (defense-in-depth) | **IMPROVE:** the new app imports the vault key **non-extractable** (`unlockVault(pw, meta, { extractable:false })`, the new module's default). The extension keeps `extractable:true` when it moves to the new module (§11.3). Folder and item keys are only ever handled as raw bytes decrypted from wrappers, so nothing else needs export. |
| CR4 | **A master-password change doesn't rotate the vault key.** Old `protectedVaultKey` copies (backups, PITR, exports) plus the old password still open current data. | Medium (latent: there's no change UI today) | **DEFER** vault-key rotation (a full re-encrypt) and the change-password UI. Harden the existing route anyway (S4). Never claim "changing your master password re-secures your vault". |
| CR5 | **The server accepts any `kdf`** (it checks only that `algo` and `salt` are strings). A client or compromised session can store weak parameters (t=1, m=8), and a malicious `GET /vault` could send huge ones (m = 4 GiB) that freeze or crash the tab. | Medium | **IMPROVE both sides:** both accept **exactly** the one configuration every existing vault uses and reject anything else before Argon2 runs (§11.2). |
| CR6 | **The master-password floor is 8 characters.** Offline guessing against a stolen DB is the real attack, so length is the only protection that matters. | Medium | **IMPROVE:** **12 characters** minimum for **new** vaults (and any future change). Existing vaults are never forced to change. No composition rules. |
| CR7 | **Generator bias.** `values[i] % 80` over `Uint32`: bias ≈ 3.7 × 10⁻⁹, negligible, but it isn't uniform. No class guarantee. | Low | **IMPROVE:** rejection sampling + class guarantee (§15.4). |
| CR8 | **RSA-OAEP-2048** is fine through 2030 (NIST 112-bit). **The public key is server-supplied with no fingerprint check**, so an active server can substitute its own key during a share (MITM). | Medium (active server) | **DEFER** fingerprint verification. Documented under "not protected against". |
| CR9 | **The vault key never rotates, and revoking a share doesn't rotate the folder key.** A revoked recipient who kept the folder key, and later obtains ciphertext (e.g. a DB leak), can decrypt entries added after the revoke. | Low–Medium | **KEEP** (owner-agreed design). The revoke copy is kept and sharpened (§19.6). Rotation on revoke is **DEFER**. |

---

## 4. Authentication versus vault encryption

| Question | Answer (legacy = Phase G unless noted) |
|---|---|
| What stops another BakerRang user from retrieving my vault? | **Structural ownership.** Every owner route resolves `vaults/{req.user.id}/…`, with the id from the session and never from the body. The only cross-user paths are `/vault/shared/:ownerId/…`, and each one first requires a `vault_shares` record with `ownerId` + `recipientUserId === me` whose subtree contains the target folder (`requireShareForFolder`; `edit` is required for writes). Even with retrieval, they'd get ciphertext only. |
| What stops BakerRang infrastructure from reading secrets? | The server holds no key. Decryption needs the master password, which is typed only into the browser and never sent. An operator with full DB access sees ciphertext + metadata (§1.4). **Caveat:** the operator also serves the JavaScript, so a malicious or compromised deploy could ship code that captures the master password (T4). |
| Is there a vault/master password? | Yes, separate from Google, and required at every unlock. |
| A separate encryption secret? | The random vault key, wrapped by the master-password-derived key. |
| Does Google OAuth alone grant decryption? | **No.** A Google session (or a stolen session cookie) can fetch, delete or corrupt ciphertext, but can't decrypt it. |
| Key recovery? | **None, by design.** No escrow, no recovery key, no server copy. Phase G **does not add recovery** (a recovery code would be a second master password to protect, and escrow breaks the model). Copy stays explicit. |
| Lost master password | The vault is unrecoverable. The only path is a new vault, which requires deleting the old one. There's no delete-vault route today, so the user would be stuck with an unusable vault. **DEFER:** "Delete vault and start over" (an owner-only, CSRF'd, typed-confirmation destructive route). It's recorded as an open product gap (§30 R3), not built. |
| Is the Google session ever used as key material? | No, nowhere. |

---

## 5. Plaintext exposure analysis

### 5.1 The ten questions (legacy → Phase G)

| # | Question | Legacy (observed where marked) | Phase G (locked) |
|---|---|---|---|
| 1 | Where is plaintext first entered? | Entry-panel inputs, the KeePass file + its password, the master-password field. | The same surfaces. Secret-class values (password, notes, master password) go into **uncontrolled** inputs (§15.2). |
| 2 | Where is encryption performed? | In the browser (`crypto.js`, Web Crypto). | Same module, lifted (§11). |
| 3 | Does plaintext reach the backend? | **No.** Every write body is `{ciphertext, wrapped keys, ids, folderId}` (verified in the provider and on the fake API). The **metadata** listed in §1.4 does reach it. | No. Tested (§27: every vault request body checked for synthetic sentinels). |
| 4 | Can the server decrypt stored values? | No. | No. |
| 5 | Can a database administrator decrypt? | No, without the master password. **Offline guessing** against Argon2id is possible with a stolen DB. | Same. The 12-char floor for new vaults (CR6). |
| 6 | Can logs contain plaintext? | Server: no plaintext exists to log. Raw 5xx error objects are logged (could include doc paths/ids). **`GET /vault/pubkey?email=`** puts the recipient email in the URL: morgan redacts query values, **but Cloud Run's platform request log records the full URL** (S9). Client: `console.error(err)` in import/export (no plaintext observed). | Server logs `{route, code, name}` only. Recipient lookup moves to a POST body. The client logs nothing from vault code in production. |
| 7 | Can browser persistence contain plaintext? | **No** (observed: localStorage = `bakerrang-theme` only; sessionStorage, IndexedDB and Cache Storage untouched). **But:** the password is in the DOM `value` **attribute** (S7, observed), and `outerHTML`, DOM snapshots and DOM-reading extensions see it. | No storage writes at all (tested). Secrets are never in DOM attributes (tested). |
| 8 | Can network requests contain plaintext? | No. Transport is HTTPS. The recipient email is in a query string (S9). | No. No query strings on `/vault` routes except non-secret audit pagination (`limit`, `before`). |
| 9 | Is plaintext retained in state longer than necessary? | **Yes.** Every entry's password + notes is decrypted at unlock into React state for the whole session (default 8 h, or "Never"). **After Lock, decrypted shared-folder passwords stay in React state** (S1, observed: all 3 synthetic shared passwords found by walking the fiber tree after Lock). In-flight loads can repopulate state after a lock (S2). | The index and all React state hold only id, folder, title, username, url and rev. Building the index decrypts each whole v1 entry, so password and notes exist **briefly in local variables** during that step and are dropped at once. They're **retained** only for an explicitly open entry, and inside History/Import/Export while those are open (§5.4). `lock()` clears everything and an epoch guard drops late results (§18.3). Tested by the same fiber-walk (§27). JS strings can't be zeroed, so this **reduces** residency. It doesn't guarantee erasure (stated honestly). |
| 10 | What happens after sign-out? | `GET /auth/logout` then `navigate('/login')` unmounts `VaultProvider`, and its refs become unreachable (GC-dependent). No explicit lock. | Sign-out calls `lock()` first (§18.2). `web-auth` → ANONYMOUS also locks. Nothing survives in reachable state. |

### 5.2 Additional observed exposures
- **S8 (observed):** the password `<input type="text" class="mask-text">` is **unnamed** in the accessibility tree
  (labels aren't associated), and its value is the plaintext. A screen reader reads the "hidden" password aloud on focus.
  History's masked old passwords are CSS-masked **text nodes**, which are also read aloud.
- **S10 (observed):** the mask shows one dot per character (19 dots for a 19-char password), which leaks the exact length.
- Opening an entry **autofocuses Title in an editable form** (observed): on a phone the keyboard opens and the entry is
  one keystroke from an accidental edit.

### 5.3 Claims review (what copy may say)

| Claim | Verdict | Phase G copy |
|---|---|---|
| "Zero-knowledge" (Launcher tag, PRODUCT.md, DESIGN.md "Vault" component) | **Retire the term.** The *contents* claim holds against a passive server, but BakerRang does see metadata (structure, counts, timings, the share graph, recipient emails), and it serves the code. The term overpromises to a lay reader. | Tag: **"Encrypted on your device"**. |
| "We store the locked bytes and never see your passwords." (Launcher) | Mostly true. "Never" is absolute. | **"Encrypted on your device before it's saved. BakerRang keeps the encrypted copy and can't read your entries."** |
| "end-to-end encrypted", "secure vault", "bank-grade", "military-grade", "unhackable" | Don't use. | — |
| "Only you can unlock it" | True (no recovery exists). | Allowed, paired with **"If you forget your master password, BakerRang can't recover it."** |
| Clipboard "cleared" | False (no auto-clear, §15.3). | Never claimed. |
| In-app disclosure | New: **"How your vault is protected"**, a short sheet in Vault settings listing what is encrypted, what BakerRang can see (account email, how many entries and folders, how they're arranged, when things change, who you share with), and what it relies on (the app code your browser loads from BakerRang). | §19.6 |

---

### 5.4 Plaintext-residency contract (locked)
A v1 entry is **one** AES-GCM blob holding `{ title, username, password, url, notes }`. There's no separate index
ciphertext, and Phase G adds none (no v2, no migration). So the honest contract is about **retention**, not about
decryption:
1. **Index construction** (unlock, refresh, applying shared updates) decrypts each entry's whole blob. The full plaintext
   (the decrypted bytes, the JSON string and the parsed object, including password and notes) exists **only in short-lived
   local variables inside one function call** (`vault/index.js buildIndexEntry(record, keys)`).
2. That function **copies out only** `title`, `username` and `url` (plus the record's `id`, `folderId` and `rev`), then
   drops every reference to the parsed object, the decoded string and the plaintext bytes before returning. The byte
   buffer is overwritten with `.fill(0)`. The string and object become unreachable; JS can't zero strings, so memory
   release is up to the garbage collector.
3. **No password or notes are ever stored** in the index, search state, list state, React state or any ref that outlives
   that call. Returned index objects are plain `{ id, folderId, title, username, url, rev, source }`, and they're built
   field by field, never by spreading the decrypted object.
4. **Opening an entry** decrypts that one record again (`openEntry(id)`) and keeps password and notes in the sheet's
   state **only for that open-entry lifetime**. Closing, switching entries, lock, sign-out and `pagehide` drop them.
5. **History, KeePass import and export** may hold secret-class plaintext only while their surface is open: decrypted
   history versions, the import preview, and the export build (which decrypts all entries inside the export function and
   never stores them in state). Closing the surface, lock and sign-out drop it (§18.3).
6. **Allowed copy:** "Passwords and notes aren't kept in the list or search; they're held only while you have an entry
   open." **Never:** "password and notes are decrypted only when the entry is opened."
7. **Test (§27 "Index residency"):** after index construction, a deep scan of the index and a walk of the React fiber tree
   find no password or notes sentinel.

## 6. Threat model (personal vault, pragmatic)

**Assets:** entry contents (especially passwords and notes), the master password, the vault key. **Secondary:**
metadata and the share graph. **Trust boundary:** the browser tab running unmodified BakerRang code.

| # | Threat | Protected? | How / why not |
|---|---|---|---|
| T1 | Another BakerRang user | **Yes** | Structural ownership + share-gated cross-user routes. Even a share grants only ciphertext plus the folder key for that subtree. Id params are validated (§12.1). Tested cross-user (§27). |
| T2 | Stolen database contents (read) | **Contents: yes. Metadata: no.** | Ciphertext only. Security depends on master-password strength vs offline Argon2id guessing (64 MiB/t=3). Metadata (§1.4) is exposed. |
| T3 | DB **write** access without code deploy | **Partially** | It can delete, corrupt, roll back or swap blobs between entries (CR1). It can't read. Tampering inside a blob is detected (GCM). Denial and rollback aren't. |
| T4 | Server/application compromise or a malicious operator who **ships code** | **No** | Whoever controls the JS served from `passwords.bakerrang.com` (or the build pipeline, or a dependency) can capture the master password at the next unlock. That's inherent to web-delivered client-side encryption. Mitigations are process: immutable digest-pinned images, scoped WIF, no runtime CDNs, bundled/locked dependencies, CSP. **Stated plainly in the disclosure.** |
| T5 | Accidental operator access (logs, consoles, backups) | **Yes, for contents** | No plaintext exists server-side. Logs are fixed-shape. Recipient emails leave URLs (S9). |
| T6 | Browser XSS on `passwords.` | **No, once unlocked** | Injected script runs with the app's authority: it can decrypt any ciphertext via the in-memory key, read the open entry, or capture the master password. Phase G **reduces the surface**: a strict CSP (no inline script, no third-party origins, `frame-ancestors 'none'`), no `dangerouslySetInnerHTML`/markdown, text-only rendering, http(s)-only links, a **non-extractable** vault key (so no durable key theft), and short plaintext residency. XSS is the top residual risk, and the design keeps the attack surface minimal. |
| T7 | Compromised authenticated session (stolen cookie) | **Contents: yes. Integrity/availability: no.** | An attacker can list ciphertext, delete entries, write garbage, create shares **from** the victim's vault (useless: they can't produce a valid wrapped folder key), and (legacy) **overwrite `protectedVaultKey` or the sharing public key**. Phase G closes the key overwrites (S4, S5) and records key changes in history. Deletion by a stolen session remains possible (documented). |
| T8 | CSRF | **Yes** | Global double-submit CSRF on authenticated mutations (`x-csrf-token`, `__Host-` cookie in prod), `SameSite=Lax` session, CORS allowlist. Phase G adds `POST /vault/pubkey`, which is covered. |
| T9 | Network interception | **Yes** | HTTPS only (HSTS on `passwords.`), no mixed content (`upgrade-insecure-requests`), ciphertext-only bodies. |
| T10 | Malicious browser extension (DOM or clipboard access) | **No** (out of the app's control) | An extension with page access can read the DOM and any revealed value. Phase G keeps secrets **out of the DOM until revealed**, never in attributes, and never in the accessibility tree while hidden. That limits passive DOM scraping. It can't stop a determined extension. |
| T11 | Clipboard exposure (history, sync, other apps) | **No** | Copying puts the secret on the OS clipboard, where clipboard history/sync (Windows Win+V, Apple Universal Clipboard, Android) may keep it. No reliable clear exists for the web (§15.3). Copy is an explicit gesture, and nothing claims otherwise. |
| T12 | Active server substitutes a recipient's public key during a share | **No** | CR8. Fingerprint verification is DEFERRED. |
| T13 | Lost unlock secret | **No recovery** (by design) | §4. |
| T14 | Malicious stored fields/URLs (e.g. a KeePass import or a share recipient writing `javascript:` URLs or HTML into titles) | **Yes** | Everything renders as React text. URLs link only if `new URL()` gives `http:`/`https:`. There are no favicons or remote fetches for entry URLs, and nothing is interpreted as HTML or markdown. |
| T15 | Walk-up access to an unlocked device | **Partially** | Idle auto-lock (15 m / 1 h / 8 h / Never; the user's choice, default 8 h), wall-clock checks on resume, lock on `pagehide`/bfcache, a Lock button, and reveal auto-hides after 30 s. "Never" is honestly labelled. |
| T16 | Clickjacking | **Yes** | `frame-ancestors 'none'` + `X-Frame-Options: DENY` on `passwords.` |
| T17 | Offline brute force of the master password in the browser | Not a server concern | Unlock is offline, so no server lockout is possible or claimed. |

---

## 7. Findings register (all security/privacy findings, severity, action)

| # | Finding | Severity | Action (where) |
|---|---|---|---|
| **S1** | **Decrypted shared-folder entries survive Lock** (`lock()` never clears `sharedTrees`/`sharedTreesRef`). Observed. | **High** (the lock boundary fails for shared data) | New app: `lock()` contract + fiber-walk test (§18.3). **Legacy hotfix L1** (§24): clear them in legacy `lock()`. |
| **S2** | Async loads (`loadEntries`, `loadSharedTrees`, `applyUpdates`) aren't cancelled or epoch-checked, so a lock during a load can repopulate plaintext. | Medium | Epoch guard + AbortController (§18.3). Legacy L1 includes the epoch check for `loadSharedTrees`. |
| **S3** | `/vault` responses have no `Cache-Control: no-store`. | Medium | `noStore` first on the mount (B1). |
| **S4** | `PUT /vault/key` overwrites `protectedVaultKey` + `kdf` with no concurrency check or audit. A stolen session (or a buggy client) can **silently make the vault unopenable**: it just looks like "wrong password". No UI uses it. | **High** (irreversible data loss) | kdf validation + required `expectedKeyRev` CAS + an audit record `vault.key-change` (B4). The UI stays deferred. |
| **S5** | `POST /vault/keys` overwrites the sharing keypair unconditionally. A stolen session can swap in an attacker public key, and future shares **to** the victim are then wrapped to the attacker. | **High** (confidentiality of future shares) | **Set-once**: 409 if `publicKey` exists (B5). The legacy `ensureKeypair` only calls it when missing (unaffected). |
| **S6** | `kdf` unvalidated (CR5). | Medium | B4 + the client's exact-match check (§11.2). |
| **S7** | The password is in the DOM `value` attribute (React attribute syncing). Observed. | **High** (secret in the DOM at rest) | No secret ever in an input in View. Uncontrolled edit inputs (§15.2). Tested. |
| **S8** | The hidden password is exposed to AT, in an unnamed field. Observed. | **High** (a11y + disclosure) | §15.1 / §21. |
| **S9** | Recipient email in the `GET /vault/pubkey` query string → Cloud Run request logs. | Low–Medium (privacy) | `POST /vault/pubkey` (B6). GET kept only for legacy, and removed at decommission. |
| **S10** | The mask leaks password length. Observed. | Low | A fixed 12-bullet mask (§15.1). |
| **S11** | 5xx responses echo `error.message`, and raw errors are logged. | Low | Fixed 500 body + fixed-shape log (B7). |
| **S12** | Create routes accept a client-supplied `id` (`item.id \|\| randomUUID()`, same for folders) with `set()`: create-as-overwrite, and ids with `/` address nested paths (still inside the caller's own vault). | Low | Server-generated ids only (B8). The legacy client never sends ids on create. |
| **S13** | Id params (`:id`, `:ownerId`, `:folderId`, `:rootId`) unvalidated. | Low | `^[A-Za-z0-9_-]{1,128}$` → 400 (B9). |
| **S14** | Same-entry edits are last-write-wins (two tabs/devices, legacy + new). A stale `folderId` in a PUT can undo a move. | Medium (integrity) | Server-owned `rev` + optional `expectedRev` CAS (B10, §14). |
| **S15** | No CSP, no `frame-ancestors`, no `nosniff` anywhere in the consumer web tier. | **High** for a client-decrypted vault | `passwords.`-only nginx config with a strict CSP + headers (§16). The ecosystem-wide baseline is flagged as follow-up work, not done here. |
| **S16** | `console.error` of raw import/export errors on the client. | Low | Removed. Fixed messages (§17). |
| **S17** | Master password min 8 (CR6). | Medium | 12 for new vaults. |
| **S18** | Unlock shows "Incorrect master password." for **any** failure (network, 500, bad meta). | Low (misleading) | Distinct states (§19.7). |
| **S19** | The row hover-trash deletes with one confirm and is invisible on touch. | Low (accidental loss) | RETIRE (delete lives in the entry sheet + bulk bar). |
| **S20** | Audit/history keeps every past ciphertext forever. "Delete" doesn't erase the entry from history. | Low (expectation) | KEEP, and disclose it ("Deleted entries stay in Activity"). Purge is DEFER. |
| — | **Ownership is correct**: session-derived, structural, share-gated. Revoke is enforced server-side. Co-recipients are redacted in shared history. Recipients can't create folders or delete shared entries. | — | Kept and tested. |
| — | **Crypto is sound** (§3.2). | — | Lifted, not replaced. |

---

## 8. Existing data: compatibility and migration

- **Schema:** exactly §1.4. **One format** (v1). Entry ciphertext is the same five-field JSON everywhere. Record variants
  that exist in the wild and must all keep working:
  (a) own entry: `wrappedItemKey` + maybe `folderWrappedItemKey`;
  (b) recipient-created entry in my shared folder: `wrappedItemKey:null`, folder key only;
  (c) an entry a recipient re-encrypted: `wrappedItemKey:null` (the server nulls it on shared PUT);
  (d) a stale `wrappedItemKey` from before that server fix, where the vault-key path fails and the folder-key path works;
  (e) a pre-sharing vault with no keypair (backfilled on unlock);
  (f) entries a past key conflict left unreadable ("(unreadable entry)", which "Repair sharing" heals where the owner can).
- **Counts:** the planner didn't read production vault data. Nothing about the plan depends on counts. Runbook STEP 0b gives the
  operator a read-only **count-only** query (vault docs, items per vault, shares) for the acceptance record. It never
  exports ciphertext.
- **Can every existing entry be decrypted under the Phase G architecture?** **Yes.** The new crypto module is the legacy
  module with additive options only (§11.1), and the key-resolution order is lifted verbatim: vault key → outermost
  shared-subtree folder key → "(unreadable)". This is proven by committed **legacy-generated fixtures** covering variants
  (a)–(e) (§27).
- **Migration needed?** **No.** No ciphertext rewrite, no new collection, no backfill job. Server-side additions are
  **additive fields** only (`rev` on items/folders, `keyRev` on the vault doc), written lazily by the next write. Absent = 0.
- **Lazy migration:** none (the keypair backfill already exists and is unchanged).
- **Coexistence:** the legacy page, the new app and the extension all read and write the same documents. Legacy writes
  keep their semantics and bump `rev` server-side, so the new app detects them (§14). Nothing the new app writes is
  unreadable to legacy or the extension (same format, extra fields ignored).
- **Rollback:** revert the web app, the registry flip or the server PR in any order after the flip is reverted. Data needs
  no rollback: `rev`/`keyRev` are ignored by legacy. The only server behavior a rollback loses is the hardening itself.
- **Never destroyed or silently invalidated:** the new app never deletes, rewrites or "repairs" an entry except by an
  explicit user action (Save, Delete, Move, Repair access), and it lists unreadable entries instead of hiding them
  (§19.7 "Can't open this entry").

---

## 9. Keep / Improve / Retire / Defer

| Legacy thing | Verdict | Why |
|---|---|---|
| Master-password create / unlock | **IMPROVE** | 12-char floor for new vaults, a no-recovery acknowledgment, distinct failure states, the exact-match KDF check (§11.2). |
| Three-pane layout (folders \| list \| entry) | **KEEP** (owner decision 3) | The owner likes it, and it's the product's identity. |
| Always-editable entry panel | **REPLACE** → **View**, then **Edit** | S7, S8, accidental edits, phone keyboard. |
| Fields: title, username, password, URL, notes | **KEEP** | No new fields. |
| Folders: nest, rename, ⋮ menu, cascade delete to Unfiled | **KEEP** | |
| Folder drag-reorder / re-parent | **KEEP + IMPROVE** | Add a keyboard path: ⋮ → "Move folder…" (a listbox of valid parents + Up/Down). |
| Search | **IMPROVE** | Title/username/URL only (owner decision 2). |
| A–Z jump rail | **KEEP + IMPROVE** | Named, 24 px targets on phone, keyboard-reachable. |
| Generator | **IMPROVE** | Rejection sampling, class guarantee, length 12–64, symbols toggle. It fills only the Replace field. |
| Show/hide | **REPLACE** mechanism, **KEEP** gesture | §15.1. |
| Copy username / password | **KEEP + IMPROVE** | Announced, failure path, no clipboard promises. |
| Open URL | **KEEP** | A real `<a>` when valid http(s). No favicons, ever. |
| Bulk select / move / delete | **KEEP + REFINE** | Bottom bar in world style. |
| Row hover-trash | **RETIRE** | S19. |
| KeePass import / export | **KEEP** | Onboarding and exit. Both stay in-browser, lazy-loaded chunks. |
| Folder sharing (share, revoke, shared-with-me, edit/view) | **KEEP** (owner decision 1) | Plus server hardening (S5, S9). |
| "Repair sharing" | **REFINE** → "Repair access" inside the Share dialog | The root cause is fixed. It's rarely needed and doesn't belong in every folder menu. |
| Real-time sync (12 s revisions poll) | **KEEP** | + a visibility refresh for your own vault (§14). |
| Version history (entry / folder / Activity; recipient entry history) | **KEEP** | Secrets in history follow the reveal contract. Retention disclosed (S20). |
| Settings (auto-lock, inline autofill) | **MOVE** from legacy Account into Passwords → "Vault settings" | Phase 0 §8: product settings live in the product. Phase H Account must not port them. Legacy Account keeps its copy until retirement (same server fields). |
| Auto-lock options 15 m / 1 h / 8 h / Never | **KEEP** (identical: shared with the extension and legacy Account) | "Never" gets honest consequence copy. |
| Change master password | **DEFER** | No UI exists today. It's meaningless without vault-key rotation (CR4). The route is hardened (S4). |
| Delete vault / start over | **DEFER** | §4, §30 R3. |
| Share-key fingerprints, AAD v2, key rotation on revoke, Trusted Types, clipboard auto-clear, Argon2 in a Worker | **DEFER** | §3, §15.3, §16. |
| TOTP, attachments, favorites, tags, breach/health checks, password history per field, autofill from the web app, offline vault | **Not added** | Not in legacy. Keep the product small and trustworthy. |

---

## 10. Final product structure (one paragraph)

**Passwords** keeps your logins in folders, locked with a master password that only you know. Sign in with Google, unlock
with the master password, and the vault opens in three panes: **folders** on the left (yours, then "Shared with me"), a
dense **entry list** in the middle with search and the A–Z rail, and the **entry sheet** on the right, which opens in
**View**. In View you can copy the username, show or copy the password, and open the website. **Edit** changes fields. The
password is replaced, never edited in place. Everything is encrypted in the browser before it's saved. Lock by hand or
automatically after the idle time you choose.

---

## 11. Encryption / key contract (locked)

### 11.1 Module
`web/apps/passwords/src/vault/crypto.js` is a **verbatim lift** of `client/src/utils/crypto.js`, with only these
additive, backward-compatible changes. Every exported name, argument order and output shape is unchanged:
1. `unlockVault(masterPassword, vaultMeta, { extractable = false } = {})`. The flag is passed to the final `importAesKey`
   of the vault key. The **web app uses the default (non-extractable)**. `createVault` also returns a non-extractable
   `vaultKey`, keeping the raw bytes only long enough to wrap them.
2. `rewrapVaultKey` is **not exported** from the new module (there's no caller; the CR4 deferral). It stays in legacy.
3. `assertKdfSupported(kdf)` (new, pure) implements §11.2 and runs first in `unlockVault`.
4. `generatePassword({ length, symbols })` (new, pure; §15.4) lives in `vault/generator.js`, not in crypto.js.
No other change. **Any future change to encryption output requires a versioned blob (§11.5) and review.**

### 11.2 KDF acceptance: exact match (client and server share one constant; drift test)
Phase G accepts **exactly one** KDF configuration:

```js
{ algo: 'argon2id', iterations: 3, memory: 65536 /* KiB = 64 MiB */, parallelism: 1, hashLength: 32,
  salt: <standard padded base64 decoding to exactly 16 bytes> }
```

- **Every field** must be present, with exactly this value and type (integers as JSON numbers, not strings).
- The **client** passes only these five parameters to Argon2 explicitly and ignores any unknown extra keys in stored
  metadata. The **server** writes only these six keys.
- **Anything else:** the client throws `UnsupportedKdfError` **before Argon2 runs** ("This vault uses settings Passwords
  doesn't support. Nothing was changed."). The server answers `POST /vault` and `PUT /vault/key` with `400 {"error":"Invalid kdf
  parameters"}` and writes nothing.
- Constants: `web/apps/passwords/src/vault/kdf.js` and `server/domain/vaultKdf.js`, identical, with a drift test.

**Rationale (repository truth):**
1. `DEFAULT_KDF` (`argon2id`, t = 3, m = 65,536 KiB, p = 1, 32-byte output) and the 16-byte salt have been unchanged since the
   vault's first commit `ffb34fa`. The server has required `kdf.algo` since that commit. Every vault is written by
   `createVault` with those values. The only other writer, `rewrapVaultKey` → `PUT /vault/key`, has no caller and uses the
   same constant. So **every existing vault is accepted**, and a wider range would admit no legitimate vault.
2. **Phase G exposes no KDF-changing UI**, so no legitimate client can produce another configuration.
3. The check exists to stop a corrupt or malicious `GET /vault` (or a stolen-session write) from choosing the browser's
   work factor. Any range lets an attacker pick its most expensive point. The earlier draft's ceiling (1 GiB × 10 passes ×
   4 lanes) could itself exhaust or stall a phone, while 64 MiB × 3 is the cost every user already pays today.
4. It's the smallest compatibility surface. **Implementers must not widen it.** A future stronger KDF (for example, raised
   at a master-password change) is a separate reviewed change to this constant, plus its own rewrap flow.

### 11.3 Key lifecycle
| Key | Created | Held | Destroyed (reference dropped) |
|---|---|---|---|
| Master password | typed | the unlock field's DOM value, uncontrolled; read once on submit | the field is cleared (`input.value = ''`) right after the read, success or failure |
| masterKey | Argon2 on unlock/create | a local variable in `unlockVault` | on return |
| vaultKey | unwrapped at unlock | `keysRef.current.vault` (a **non-extractable** CryptoKey) | `lock()` |
| privateKey | unwrapped at unlock | `keysRef.current.private` (non-extractable, as today) | `lock()` |
| folder keys (owner/shared) | unwrapped on demand | `keysRef.current.folders: Map` | `lock()` |
| item keys | per decrypt/encrypt | local variables | on return |
| raw key bytes (`Uint8Array`) | transient during wrap/unwrap | local | `.fill(0)` after use (best effort; the JS engine may copy) |

The extension keeps its current alias to the legacy module until decommission. At decommission (not Phase G) its alias
moves to the new module and its `unlock` passes `{ extractable: true }`. That's the only caller allowed to.

### 11.4 Ciphertext format (unchanged)
Blob = `{ iv: base64(12 bytes), ct: base64(ciphertext ‖ 16-byte tag) }`, standard base64 with padding. Entry plaintext =
`JSON.stringify({ title, username, password, url, notes })` (all strings, in this key order). Folder plaintext =
`{ name }`. No AAD. A blob without `v` is v1.

### 11.5 Deferred v2 envelope (design only; **not built in Phase G**)
`{ v:2, iv, ct }` with AAD = UTF-8 `bakerrang-vault:v2:<ownerId>:<kind>:<recordId>:<role>` (kind ∈ item|folder|vault;
role ∈ content|itemKey|folderItemKey|name|sharedName|folderKey|vaultKey|privateKey). Migration would be **lazy**: read v1
and v2, write v2 on the next save of that record, never a bulk rewrite. The extension and the legacy client must learn v2
first, and a server validator accepts `v:2` only then. Rollback: v1 readers can't read v2 records, so v2 may only ship
after legacy retires and the extension is updated. It's recorded so the choice is explicit.

---

## 12. API contracts (Phase G)

### 12.1 Mount and cross-cutting rules
- `app.use('/vault', noStore, vaultLimiter, isAuthenticated, vaultRouter)`. **`Cache-Control: no-store` on every
  response**, including 401/4xx/5xx.
- Signed out → `401 {"isAuthenticated":false,"message":"User not authenticated"}` (unchanged).
- CSRF: every POST/PUT/DELETE goes through the global double-submit `csrfProtection` (403 on a missing or bad token;
  `web-api-client` retries once). GETs are exempt.
- CORS: `PASSWORDS_DOMAIN` added to `buildAllowedOrigins`, credentials allowed, exactly like `BUDGET_DOMAIN`.
- **Id params** (`:id :ownerId :folderId :rootId :shareId`) must match `^[A-Za-z0-9_-]{1,128}$`, else
  `400 {"error":"Invalid id"}` (router `param` handlers, before any Firestore call).
- **Cipher blob validator (writes):** a plain object with `iv` matching `^[A-Za-z0-9+/]{16}$` (exactly 12 bytes), and `ct`
  matching `^[A-Za-z0-9+/]+={0,2}$` with 24 ≤ length ≤ 200,000 (so ≥ 16 decoded bytes, the GCM tag). The server
  **stores `{iv, ct}` only** (other keys are stripped). The legacy client sends exactly these.
- Body: the global JSON parser (10 MB, needed for bulk import). **Unknown body fields are ignored.** Ciphertext is never in a
  query string.
- Errors: 4xx bodies are the fixed strings listed per route. **Every 5xx is `{"error":"Vault operation failed"}`.**
  Logging: `console.error('[vault] <route-id> failed', { code: err.code, name: err.name })` only, never bodies, ids,
  emails or error objects.
- Rate limits: `vaultLimiter` 300 / 15 min / IP (unchanged: unlock ≈ 6 calls, poll ≈ 75 / 15 min). **New
  `vaultLookupLimiter`**: 20 / 15 min **per user** (`u:<id>`) on `/pubkey` (both methods), with
  `{"error":"Too many lookups. Please wait a moment."}`.
- `rev`: a server-owned integer on items and folders (missing = 0). **Every** write to an item or folder (legacy or new
  route, owner or shared) sets `rev = prev + 1` **inside a transaction**. Clients never set it.

### 12.2 Vault metadata
| Route | Contract |
|---|---|
| `GET /vault` | 200 `{ kdf, protectedVaultKey, publicKey, protectedPrivateKey, settings, createdAt, keyRev }` (`keyRev` new, default 0). 404 `{"error":"Vault not initialized"}`. |
| `POST /vault` | Body `{ kdf, protectedVaultKey, publicKey?, protectedPrivateKey? }`. `kdf` per §11.2 (stored as the six known keys only), blobs per §12.1, `publicKey` base64 300–800 chars, and both keys present together or neither. 409 `{"error":"Vault already exists"}` (transaction: read then create). 201 → `{ kdf, protectedVaultKey, publicKey, createdAt, keyRev:0 }`. (Legacy expects 200. Its `jsonOrThrow` accepts any 2xx, which was verified in the provider.) |
| `PUT /vault/key` | Body `{ kdf, protectedVaultKey, expectedKeyRev }`. Validation as above, and `expectedKeyRev` a required integer ≥ 0. 404 if no vault. `stored.keyRev ?? 0 !== expectedKeyRev` → 409 `{"error":"Vault key changed","code":"conflict"}`. Success: transaction write, `keyRev+1`, plus audit `{action:'vault.key-change', targetType:'vault', targetId:<uid>, snapshot:null}` → 200 `{ kdf, protectedVaultKey, keyRev }`. **No Phase G client calls it.** |
| `PUT /vault/settings` | Unchanged semantics: `autoLockMs` null or 60,000–604,800,000; `inlineAutofill` boolean; merge. 404 if no vault. |
| `POST /vault/keys` | **Set-once, atomic, idempotent (§12.2a).** Body `{ publicKey, protectedPrivateKey }`, validated as today. One Firestore **transaction**: read the vault doc → 404 if missing → if `publicKey` is already stored: **an equal `publicKey` → 200 `{ publicKey }`** (a retry after a lost response) and **a different one → 409 `{"error":"Sharing keys already set","code":"keys_exist"}`**, writing nothing → otherwise write both keys → 200 `{ publicKey }`. Two concurrent first writers can't both win: the loser's transaction re-reads on contention and takes the 409 branch. **The stored pair is never overwritten.** |
| `POST /vault/pubkey` (new) | Body `{ email }`: a string with an `@`, trimmed, ≤ 254 chars, lowercased. 404 `{"error":"No BakerRang user with that email"}`. 409 `{"error":"That person hasn't set up Passwords yet"}`. 200 `{ userId, email, publicKey }`. `vaultLookupLimiter`. |
| `GET /vault/pubkey?email=` | **Legacy only.** Same behavior + limiter. Removed at decommission. |

### 12.2a Sharing-keypair initialization race (locked)
**Scenario:** a pre-sharing vault has no keypair. Tabs or devices A and B both `GET /vault` and see none. Both generate
different pairs. A's `POST /vault/keys` wins, and B's arrives at an already-initialized vault. Both clients hold the **same
vault key** (it's one vault), so the winner's `protectedPrivateKey` unwraps for B too.

**Server:** the §12.2 row. There's exactly one stored pair, and it's never overwritten. A loser gets 409 `keys_exist`.

**New app** (`vault/keypair.js`, `ensureKeypair(vaultKey, meta)`, run inside the vault epoch before any sharing load or
share action):
1. The meta has `publicKey` + `protectedPrivateKey` → `unwrapPrivateKey(vaultKey, meta.protectedPrivateKey)` → done.
2. Otherwise → `createKeyPair(vaultKey)` → `POST /vault/keys`:
   - **200** → use the generated pair.
   - **409 `keys_exist`** → drop every reference to the generated pair (it's never stored or used) → a fresh `GET /vault`
     → it must now have both keys → unwrap the **stored** private key → update the in-memory meta → done.
   - **Anything else**, a refetch still without keys, or a stored private key that won't unwrap → **the unlock still
     completes** (the vault key is valid), but sharing enters a *Sharing unavailable* state. There's no Shared with me
     load and Share is disabled, with a ruled notice: "Sharing keys couldn't be set up. Folders shared with you can't be
     opened right now." plus **Try again**, which re-runs step 1 with a fresh `GET /vault`.
3. It **never** answers a 409 by generating and posting another pair, and never retries a POST once keys exist.

**Legacy client (today, verified in `VaultProvider.jsx`):** `ensureKeypair` POSTs through `jsonOrThrow`, so a 409 throws.
`unlock()` rejects, and `UnlockView` shows **"Incorrect master password."** (misleading). Every retry reuses the stale
`metaRef` without keys and fails the same way until a page reload. **Legacy can't recover on its own**, so **hotfix L1 is
extended** (the minimum):
- Move the key-initialization logic into a dependency-free helper,
  `client/src/utils/vaultKeypair.js → ensureKeypairWith({ meta, vaultKey, createKeyPair, unwrapPrivateKey, postKeys,
  getMeta })`. `postKeys` returns `{ status, body }` without throwing.
- On **409**: `getMeta()` (`GET /vault`) → `metaRef.current = fresh` → unwrap `fresh.protectedPrivateKey` → continue the
  unlock. Discard the generated pair.
- 200 and the already-has-keys path are unchanged. No other legacy behavior changes.
- The helper takes its crypto functions as arguments, so the web workspace's tests can import it without legacy
  dependencies.

**Ordering:** L1 is harmless against today's server (which never returns 409), so **PR 1b (L1) deploys before or with
PR 1**. Legacy never meets the new 409 without the reconciliation.

### 12.3 Items (owner)
| Route | Contract |
|---|---|
| `GET /vault/items` | 200 `ItemRecord[]` = `{ id, folderId, ciphertext, wrappedItemKey, folderWrappedItemKey, createdAt, updatedAt, rev }` (built field by field, never a raw spread). |
| `POST /vault/items` | Body `{ folderId, ciphertext, wrappedItemKey, folderWrappedItemKey? }`. **Any body `id` is ignored**; the server uses `randomUUID()`. `folderId` null or an id (§12.1). 200 `ItemRecord` (`rev:1`). Audit + rev bump as today. |
| `POST /vault/items/bulk` | Body `{ items: [...] }`, 1–2,000 items, each as above. 200 `ItemRecord[]`, in order. |
| `PUT /vault/items/:id` | Body `{ folderId, ciphertext, wrappedItemKey, folderWrappedItemKey?, expectedRev? }`. Transaction: missing → 404 `{"error":"Entry not found"}`; `expectedRev` present and `≠ stored.rev ?? 0` → **409 `{"error":"Entry changed","code":"conflict","current": ItemRecord}`**; otherwise replace the four fields, `updatedAt`, `rev+1` → 200 `ItemRecord`. Without `expectedRev` (legacy) it's the unconditional write, as today, but `rev` still bumps. |
| `DELETE /vault/items/:id` | Idempotent: 200 `{"success":true}` whether or not it existed (legacy semantics). The audit snapshot is written when it existed. |
| `PUT /vault/items/move` | Body `{ ids: string[1..2000], folderId: id\|null, folderKeys?: { [id]: blob } }`. Runs in transactions of ≤ 400: read all → any missing → 404 `{"error":"Entry not found"}` (no writes in that chunk) → set `folderId`, `folderWrappedItemKey` (the legacy rule: supplied key, else null when `folderKeys` is present), `updatedAt`, `rev+1` → 200 `{ success:true, revs:{ [id]: rev } }`. |

### 12.4 Folders (owner)
`GET /vault/folders` → `FolderRecord[]` `{ id, parentId, position, ciphertext?, sharedName?, shared?, wrappedFolderKey?,
createdAt, updatedAt, rev }`. `POST /vault/folders` ignores a body id (server UUID) → `FolderRecord` (`rev:1`).
`PUT /vault/folders/:id` takes an optional `expectedRev` → 409 `{"error":"Folder changed","code":"conflict","current":FolderRecord}`,
bumps `rev`. `PUT /vault/folders/reorder`: unchanged semantics (positions are last-write-wins, non-secret), bumps `rev` on
each touched folder, returns `{ success:true }`. `PUT /vault/folders/:id/share-setup` and `DELETE /vault/folders/:id` are
unchanged apart from §12.1 (the delete keeps the cascade-to-Unfiled behavior and bumps `rev` on detached entries).

### 12.5 Sharing
Unchanged semantics apart from §12.1 and: `POST /vault/shares` validates `recipientEmail` like `/pubkey` and 404/409s
with the same fixed strings. `PUT /vault/shared/:ownerId/items/:id` takes the optional `expectedRev` with the same 409
contract (`current` is the shared-shape record) and bumps `rev`. `PUT /vault/shared/:ownerId/items/move` uses the §12.3
transactional form and returns `revs`. `GET /vault/shared/:ownerId/tree/:rootId` items include `rev`. `requireShareForFolder`,
the recipient restrictions (no folder create, no delete), co-recipient redaction and revoke are **unchanged and tested**.

### 12.6 History
`GET /vault/audit`, `/audit/item/:id`, `/audit/folder/:id`, `/shared/:ownerId/audit/item/:id`: `limit` an integer 1–200
(default 50), `before` an integer ms > 0, else `400 {"error":"Invalid query"}`. Records are unchanged (+ the new
`vault.key-change` action, which clients render as "Vault key changed").

### 12.7 What the server can and can't validate
It **can** check: JSON shape, blob syntax and sizes, id syntax, ownership, share permissions, folder existence on
share-setup, `rev` conflicts, the exact KDF configuration, email syntax, and counts. It **can't** check: that ciphertext decrypts, that a
wrapped key matches its ciphertext, that a `sharedName` matches a `ciphertext` name, or that a public key belongs to the
email it's filed under. Those are client responsibilities and are covered by the client tests.

---

## 13. Persistence model
Firestore paths and shapes are §1.4, plus: items and folders gain `rev` (integer), and the vault doc gains `keyRev`
(integer), all additive. **No new collections, no index changes.** The two existing hand-made audit composite indexes
(`audit`: `targetId ==` + `createdAt desc`; `folderId ==` + `createdAt desc`) are **codified** into
`firestore.indexes.json` in PR 1, so the environment is reproducible. That's a no-op in prod, where they already exist.

**Client-side persistence: none.** No vault data, index, settings cache, draft, search query or selection is written to
localStorage, sessionStorage, IndexedDB, Cache Storage or cookies. The only client-stored value is the ecosystem
`br_theme` cookie (theme enum). There's no "remember last folder": a per-viewer convenience isn't worth a storage
exception on a vault.

---

## 14. Concurrency model
- **Scope:** several tabs, devices, the legacy page and the new app can all be open on one vault, and shared folders add
  other people.
- **Different entries:** separate documents, so no lost updates (unchanged).
- **Same entry:** the new app sends `expectedRev` on every PUT. On **409** the sheet shows "This entry was changed
  somewhere else." with **Use latest** (decrypts `current` and re-seeds View; the draft is discarded) and **Cancel**. If
  the decrypted `current` equals the draft's fields, it's treated as success (our own write landed before a timeout).
- **Delete races:** PUT → 404 → "This entry was deleted somewhere else." → **Remove from view**. DELETE of a missing
  entry → success (idempotent).
- **Moves:** a move bumps `rev`, so a concurrent stale edit gets 409, and a stale `folderId` can't undo the move.
- **Legacy writers:** legacy PUTs carry no `expectedRev`, so legacy stays last-write-wins by design (documented R2), but
  its write bumps `rev`, so the new app never silently overwrites a legacy edit.
- **Sharing-keypair initialization:** exactly one pair wins (a set-once transaction), and losers reconcile to the stored pair
  (§12.2a), in the new app and in legacy (L1).
- **Stale loads:** a visibility refresh on `visible` after ≥ 60 s, when no sheet is in Edit and no write is in flight,
  refetches items and folders and rebuilds the index. The shared revisions poll (12 s, visible only) is kept, and its
  auto-apply rule stays: apply when no sheet is in **Edit**, otherwise a "Changes from another person are ready ·
  Refresh" notice.
- **One write in flight** per sheet. Save/Delete are `aria-disabled` while pending. Responses apply only if their op
  token and the vault epoch are still current (§18.3).
- **Creates** aren't made idempotent (the vault had no double-create reports, and each entry is its own doc). A retried
  create after a timeout may duplicate an entry, which the user can see and delete. Recorded as R4.

---

## 15. Reveal, copy, and generator contract (locked)

### 15.1 Display in View
- **Hidden by default, every time a sheet opens.** The password line shows a **fixed 12-bullet mask** (`••••••••••••`,
  not length-revealing) as `aria-hidden` text, inside an element labelled **"Password, hidden"**. **No password value
  exists in the DOM, the accessibility tree, an attribute, a `title` or a `data-*` while hidden.**
- **Show:** a real icon-only `<button aria-pressed="false">` named "Show password" (eye icon; tooltip "Show"). Pressing it renders the value as **text** in a
  `<span class="secret">` (the system monospace stack, §20) and sets `aria-pressed="true"`, "Hide password". The live
  region says **"Password shown"** or **"Password hidden"**, never the value. Screen-reader users reach the value by
  moving to it, and it's never announced by a live region.
- **Auto-hide after 30 s** revealed (the "draining rule", §19.4). It also hides immediately on: sheet close, selecting
  another entry, switching to Edit, lock, sign-out, `visibilitychange → hidden`, `pagehide`, and route change.
- Notes: shown as plain text in View (they were opened deliberately). They're secret-class: never retained in the index or
  search state, held only while their entry is open, and not searchable (§5.4).
- Username is shown plainly. It isn't secret-class.

### 15.2 Edit
- Editing an existing entry **never places the current password in an input.** The Password row reads
  "Unchanged" with a **Replace password** button. Replace reveals an empty field with Show and **Generate**. Leaving it
  empty keeps the current password. A new entry shows the empty field directly.
- Secret-class inputs (the replacement password, notes, the master password, the export password, the KeePass file
  password) are **uncontrolled**: their value is assigned with `ref.current.value = …` only when seeding notes, and read on
  submit. There's **never a `value`/`defaultValue` prop**, so React never syncs a `value` attribute (S7). Tested:
  `getAttribute('value') === null` and the sentinel is absent from `outerHTML`.
- The replacement field is `type="text"` with the world mask class (`-webkit-text-security: disc`), `autocomplete="off"`,
  `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`, `data-1p-ignore`, `data-lpignore="true"` (legacy's
  proven way to keep browsers from offering to save vault passwords). If `CSS.supports('-webkit-text-security','disc')`
  is false, the field starts **shown**, with its toggle, so the UI never pretends to mask. It's labelled "New password",
  and the accessible description says masking is visual only.
- The master-password fields stay real `type="password"` (legacy decision: password managers may fill them), with a
  Show toggle.

### 15.3 Copy
- **Explicit gesture only.** `navigator.clipboard.writeText` is called synchronously inside the click/keypress handler.
  There's no copy on selection, no copy on open and no keyboard shortcut in Phase G.
- **Success:** the icon-only Copy button (named "Copy password"; tooltip "Copy") turns into a Gold Text check with the tooltip
  "Copied" held for 2 s. It keeps its 40 px (44 px phone) box, so nothing beside it moves. The polite live region says
  **"Password copied"** / **"Username copied"**, never the value.
- **Failure** (API missing, permission denied, insecure context): "Couldn't copy. Your browser blocked the clipboard."
  plus **"Show password"** so the user can select it manually. The value never enters a fallback `<textarea>` or
  `execCommand` path.
- **No auto-clear, and no claim of clearing.** A web page can't reliably clear the clipboard: writes need page focus,
  checking whether the clipboard still holds our value needs a permission prompt, and OS clipboard history/sync keep
  copies regardless. Blindly overwriting could also destroy something the user copied since. Vault settings' disclosure
  says: "Copied passwords stay on your clipboard until you copy something else, and your device may keep clipboard
  history." Auto-clear is **DEFER**, and only as an opt-in with honest copy.
- Copy buttons never carry the value in any attribute. The handler reads it from the open-entry state at click time.

### 15.4 Generator (`vault/generator.js`)
- Source: `crypto.getRandomValues(new Uint32Array(n))`. **`Math.random` is banned in `src/`** (a static test).
- **Uniform choice by rejection:** draw a `Uint32` `x`, accept if `x < 2³² − (2³² mod N)`, index `x mod N`.
- Classes: lowercase `a–z`, uppercase `A–Z`, digits `0–9`, symbols `!#$%&*+-=?@^_~` (14 chars, chosen to avoid quote,
  backslash, space and bracket characters that break some sites and shells). Symbols can be toggled (on by default).
  **Every enabled class appears at least once:** if a draw misses a class, discard the **whole** password and redraw
  (unbiased; expected redraws are tiny at length ≥ 12).
- Length: 12–64, default **20**. Entropy at the default is 20·log₂(76) ≈ 125 bits. The UI never shows entropy numbers
  or "strength" meters.
- Look-alike characters are **not** removed (the monospace reveal disambiguates, §20).
- Workflow: in the Replace/New field, **Generate** fills the field with a new value (shown, so the user sees what they're
  saving). The options sit inline under the field (a Length stepper with drawn minus/plus icons, and a squared Symbols switch), with
  no popover. On phone the field takes its own full-width row with Show inside it, and Generate goes on the next row. Nothing is saved until Save. Generating
  again replaces it. Generated values are never copied automatically.

---

## 16. Browser security contract

### 16.1 Headers (`web/nginx/apps/passwords.conf`, served only by `web-passwords`)
Every `location` block carries the full set, with `always` (nginx drops server-level `add_header` in any location that
declares its own, a known trap, so they're repeated per location and a config test enforces it):
```
Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:;
  font-src 'self'; connect-src 'self' https://api.bakerrang.com; manifest-src 'self'; worker-src 'self';
  base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```
- `'wasm-unsafe-eval'` is required by hash-wasm's Argon2 (a WebAssembly compile). There's **no `'unsafe-inline'` and no
  `'unsafe-eval'`**.
- **The theme boot script can't be inline** under this CSP. Passwords' `vite.config.js` emits it as a same-origin
  `theme-boot.js` (the exact `THEME_BOOT_SCRIPT` string, emitted with `emitFile`) and injects
  `<script src="/theme-boot.js"></script>` as the first child of `<head>`. A blocking classic script still runs before
  first paint (no flash). Other apps are untouched.
- `connect-src` names the production API. The build-time `VITE_API_BASE_URL` for `web-passwords` must equal it (a CI
  workflow test).
- Only `passwords.` gets these headers. **The existing shared `nginx/nginx.conf` is unchanged**, so no other app is
  disturbed. A baseline set for the other apps is a separate follow-up.
- **Deferred:** `require-trusted-types-for 'script'` (kdbxweb's XML handling must be proven compatible first) and CSP
  reporting.

### 16.2 Rendering rules
No `dangerouslySetInnerHTML`, `innerHTML`, markdown, or HTML parsing of any entry/folder/share/history value (a static
test greps `src/`). Every value renders as React text. Entry URLs link only when `new URL(value.trim() || schemeless →
'https://'+value)` has protocol `http:`/`https:`, as `<a href target="_blank" rel="noopener noreferrer">`. Anything else
shows as text with no link. **No favicons, website previews or any request to an entry's domain** (it would leak the
vault's site list to third parties). No third-party runtime scripts, fonts, images or analytics. `hash-wasm` and `kdbxweb`
are bundled. kdbxweb loads as a **lazy chunk** on Import/Export only.

### 16.3 Dependencies
New to `web/package-lock.json`: `hash-wasm@4.12.0` and `kdbxweb@2.1.1`, pinned exactly (the versions legacy runs today).
No others.

**Dependency-security gate (PR 2):**
- Regenerate `web/package-lock.json` with the canonical Docker/Linux `npm run relock` (never a Windows `npm install`).
- Run `npm audit --json` in `web/` before and after adding the two packages, and record both results in the PR.
- **Pass** = no advisory whose dependency path runs through `hash-wasm@4.12.0` or `kdbxweb@2.1.1` (including their
  transitive dependencies), and no advisory count increase attributable to them.
- Existing advisories on unrelated paths are **reported separately** in the PR as pre-existing. They don't block Phase G
  and aren't fixed here.
- **Don't** run `npm audit fix`, and don't upgrade or re-pin any unrelated dependency in Phase G.

---

## 17. Privacy, logging and cache contract
- **Server:** §12.1 (fixed logs, fixed 5xx, no-store, no query secrets). No new Cloud Logging exclusion is needed once the new
  app uses `POST /vault/pubkey`. The legacy GET remains a known residual until decommission (runbook note, R6).
- **Client:** no `console.*` in `src/vault/**`, `src/entry/**` or `src/state/**` (a static test). Errors map to fixed
  copy. Error objects are never rendered. No analytics exist, and none are added.
- **Service worker:** shell-only precache, **`runtimeCaching: []`**. The API is cross-origin and never intercepted.
- **HTTP cache:** API `no-store`. `index.html`/`sw.js` `no-cache` (as today). Hashed assets are immutable.
- **Browser storage:** §13 (none). Tested by spying on `localStorage`, `sessionStorage`, `indexedDB.open`, `caches.open`
  and `document.cookie` writes across a full session (unlock → open → reveal → copy → edit → save → share → lock).
- **URLs:** `/` only. No entry, folder or search terms in the URL or history. Page `<title>` is always
  "Passwords — BakerRang" (never an entry title).
- **Screenshots/evidence:** synthetic data only (§28).

---

## 18. Auth, session and the lock lifecycle

### 18.1 Auth
`AuthProvider` (`web-auth`) with `oauthTarget='passwords'` (`VITE_OAUTH_TARGET=passwords`). Sign in → `GET
/auth/google?target=passwords` → back to `PASSWORDS_DOMAIN`. Unknown targets stay 400, and an unset env var gives the
existing 500, so arbitrary redirects stay impossible. The session is the shared host-only `connect.sid` on
`api.bakerrang.com` (`SameSite=Lax`, same-site), with no cookie change. `LOADING` → quiet ground; `ANONYMOUS` → Welcome;
`AUTHENTICATED` → the vault state machine.

### 18.2 Vault state machine
`META_LOADING` → `NO_VAULT` (Create) | `LOCKED` (Unlock) | `META_FAILED` (Try again) → `UNLOCKING` → `UNLOCKED` → `LOCKED`.
**Lock triggers:** the Lock button; idle ≥ `autoLockMs` (activity = pointerdown, keydown, touchstart, and scroll in the
capture phase; also checked by **wall clock** on `visibilitychange → visible` and on `focus`, because background timers are
throttled); `pagehide` (including bfcache, so a restored page is locked); **sign-out** (lock first, then POST logout);
`web-auth` → `ANONYMOUS` (including a failed auth check: fail closed, and an unsaved edit is lost, which is documented).
"Never" disables only the idle trigger.

### 18.3 `lock()` (single function, synchronous state clearing)
1. `epochRef.current += 1`. Every async continuation captures the epoch at start and **drops its result** if it changed.
2. Abort every in-flight request (one `AbortController` per epoch).
3. Drop references: vault key, private key, folder-key maps, raw records, the index, the open entry (and its reveal
   timer), shared trees and shared-with-me, the history dialog's decrypted records, KeePass import results, the export
   dialog, the bulk selection, the generator state, and any draft.
4. Close every dialog, clear the search query, set status `LOCKED`, and move focus to the master-password field.
**Test (§27):** after unlock → open own and shared entries → reveal → open history → import preview → lock, a walk of the
React fiber tree (the observed-S1 method) finds **no** synthetic sentinel, and a load that resolves after lock changes
nothing.

---

## 19. UX structure: "Three panes, evolved" (locked)

Direction contract: [`web/.impeccable/surfaces/passwords.md`](../../web/.impeccable/surfaces/passwords.md). Comp:
[`passwords-comp.html`](../../web/.impeccable/mocks/passwords-comp.html). The comp is the contract for layout, states and
copy. Where the comp and this document disagree on behavior, this document wins.

```
┌ bar 58px: B | Passwords ··························································· switcher · avatar ┐
│ [+ New entry](GOLD)  Import  Export  Activity                                 Vault settings  [🔒 Lock] │
├───────────────────┬──────────────────────────────────────────────┬─────────────────────────────────────┤
│ FOLDERS           │ Personal › Banking   3                       │ ‹  Example Bank            ◷  Edit  │
│ All entries    30 │ [☐] [⌕ Search title, username, website   ]   │ ─────────────────────────────────── │
│ Unfiled        12 │ ─────────────────────────────────────────────│ USERNAME                            │
│ ─────────────     │ ☐ Example Bank        demo.user@example.test │ demo.user@example.test    [Copy]    │
│ ⋮⋮ ▾ Personal   4 │ ☐ Sample Credit Union demo_user            A │ PASSWORD                            │
│ ⋮⋮    Banking   3 │ ☐ Test Brokerage      demo.user            C │ ••••••••••••       [Show] [Copy]    │
│ ⋮⋮   Work       4 │   (flat rows, hairline rules, hover Plane) E │ WEBSITE                             │
│ ⋮⋮ 👥 Home…     4 │                                              │ bank.example.test ↗                 │
│ + New folder      │                                          …   │ FOLDER  Personal › Banking          │
│ SHARED WITH ME    │                                              │ NOTES                               │
│   Family (demo) 3 │                                              │ Card ending 0000 (synthetic)        │
└───────────────────┴──────────────────────────────────────────────┴─────────────────────────────────────┘
phone ≤640: bar · toolbar (New entry gold, icons, Lock) · folder bar ("All entries 30 ▾") · search · list + A–Z rail;
            an entry opens full-screen with ‹ Back; Edit has a sticky Save/Cancel foot above the keyboard/safe area.
```

### 19.1 Routes
`/` (everything) and `*` → Not found ("That page isn't in Passwords." → Back to Passwords). React Router 6 for ecosystem
parity. **No other URL state** (§17).

### 19.2 Component map (`web/apps/passwords/src/`)
`App.jsx` (auth gate, bar via `BrandLink`/`AppSwitcher`/`AccountMenu`/`ProductEmblem`) · `state/VaultProvider.jsx` (the §18
machine, epoch, keys, index, sync, lifted logic) · `state/useEntry.js` (open entry: decrypt on open, reveal timer, draft,
op tokens) · `vault/{crypto,kdf,generator,kdbx,keys,index,search}.js` (pure; `keys.js` = the lifted outermost-subtree
resolution) · `api/vault.js` (typed wrappers, `VaultApiError {status, code, current}`) · `views/{Welcome,CreateVault,Unlock,
MetaFailed}.jsx` · `vault/VaultView.jsx` (toolbar + three panes) · `folders/{FolderRail,FolderRow,FolderMenu,MoveFolderDialog,
FolderBar}.jsx` · `list/{EntryList,EntryRow,JumpRail,BulkBar}.jsx` · `entry/{EntrySheet,EntryView,EntryEdit,SecretLine,
ReplacePassword,GeneratorPopover,CopyButton}.jsx` · `dialogs/{Dialog,ImportDialog,ExportDialog,ShareDialog,HistoryDialog,
VaultSettingsDialog,ConfirmDialog}.jsx` (a native `<dialog>` + `showModal()` base) · `controls/Listbox.jsx` (the
`FolderSelect` successor; **never a native `<select>`**) · `NotFound.jsx`. Nothing graduates to `web-ui` in Phase G (no
second app renders these identically).

### 19.3 Visual contract (summary; DESIGN.md "Product layer: Passwords" is authoritative)
The world's charcoal/light grounds, Archivo/Archivo Expanded, 1px rules, and 4/8 px radii. The three panes are ruled
columns on the ground, **not cards**: the folder rail and the sheet are Ground 2 bands separated by `line-strong` rules.
Rows are flat at rest with a hairline, and fill Plane on hover and when selected, with a **1px Passwords Slate underline**
under the title (the accent's only UI use besides the emblem). **Gold marks action (owner, decision 4)**, a Passwords-only
exception to the world's one-gold rule:
- **Gold fills:** New entry in the toolbar (ghost in the empty-vault toolbar, where the in-state New entry is gold). Every
  sheet/dialog commit: Save, Add entry, Use latest, Remove from view, Share, Import N, Export N, Move, and Vault
  settings' Done. The gate primaries: Sign in with Google, Create vault, Unlock.
- **Gold controls:** the on-state of switches, and checked or mixed checkboxes (a gold fill with an Ink-on-Gold tick; in
  light mode the edge is Gold Text for contrast).
- **Gold Text accents:** a pressed Show, the Copied check, the draining rule, the current A–Z letter, the selected
  folder's count, the Generate icon, and icon-tool hover.

Cancel, Lock, Replace password, Generate, Revoke and Clear stay quiet or ghost. **Icon-only tools:** Copy, Show, Open,
Edit, Version history and Delete (the editor foot and the bulk bar) are 40 px icon buttons (44 px on phone) with an
`aria-label` and a hover/focus tooltip. The inline delete confirm keeps its text "Delete" (a destructive confirm must
say what it does). Kind marks are small-caps text (SHARED, VIEW ONLY, CAN EDIT, CAN'T OPEN). The rail
abbreviates it to **VIEW**, with a screen-reader-only ", view only", so the folder name isn't truncated. Errors are
Ink + a drawn icon. Danger text appears only for Delete, the destructive confirms and Sign out.

### 19.4 Signature: "The Mask and the Draining Rule"
Hidden, the password is a fixed row of 12 bullets in Ink 3, set on the same baseline as the username above it.
**Show** replaces them in place with the value in the monospace secret face. Under it, a 1px Gold Text rule spans the value's
width and **drains right to left over 30 s** (a linear `scaleX` 1→0). When it's empty, the bullets return. The rule
*is* the auto-hide timer, so the user can see that secrets don't stay out. **Reduced motion:** no drain; a static
"Hides after 30 seconds" hint in Ink 3 instead. No other ambient motion. The sheet slides in 160 ms (4 px) and is instant
under reduced motion.

### 19.5 Editor field map and copy
- **View:** header ‹ (phone: "‹ Back") · the title (Expanded) · History (clock, "Version history") · **Edit**. Rows:
  **Username** (value + Copy) · **Password** (mask + Show + Copy) · **Website** (link text ↗, or plain text if not http(s))
  · **Folder** (path) · **Notes** (text, preserving line breaks) · a foot line in Ink 3: "Changed Sep 26, 2026" and, for
  shared entries, "In Family (demo) · shared by friend@example.test · Can edit".
- **Edit:** Title ("e.g. Example Bank") · Username · Password ("Unchanged" + **Replace password**; for a new entry the
  empty "Password" field) with Show / **Generate** · Website ("https://") · Folder (Listbox; hidden in shared view) ·
  Notes (uncontrolled textarea) · foot: **Delete** (Danger text, owned existing entries only, confirmed inline: "Delete
  Example Bank? It moves to Activity history and leaves your vault. This can't be undone." → **Delete** / **Keep it**) ·
  status · **Cancel** · **Save** / **Add entry** (gold: the sheet's one commit; owner decision 4, §19.3). View-only shared entries have no Edit.
- **Dirty guard:** Cancel, Esc, selecting another entry, switching folders, lock-by-button and sign-out with a dirty
  draft → an inline "Discard changes to Example Bank? **Keep editing** / **Discard**". Auto-lock and auth loss **don't
  wait** (security wins). `beforeunload` is armed only while dirty.

### 19.6 Dialogs (native `<dialog>`, focus trapped, Esc closes, focus returns; full-height sheets on phone)
- **Import from KeePass** (lifted flow): file + file password (uncontrolled) + optional key file → entry picker grouped by
  KeePass group → Import N. "Your file is opened here in your browser. The file and its password are never uploaded."
- **Export to KeePass:** export password + confirm (min 12, uncontrolled) → download. "Anyone with this file and its
  password can read every entry. Store it like your master password." Owned entries only, as legacy.
- **Share "Home & Utilities":** recipient email → Can edit | View only → Share. List of people (email · permission ·
  **Revoke**, a quiet action, not Danger). Revoke copy: "Revoking stops access from now on. Anything they already opened,
  they may still have, so change those passwords if that matters." **Repair access** (a quiet link): "Re-encrypts this folder's entries for the people
  it's shared with. Use it if someone sees 'Can't open this entry'."
- **Version history / Activity** (lifted modes, **redesigned to the legacy model at the owner's request, 2026-09-27**). The
  owner found the first comp's ruled rows hard to scan. Legacy made it easy to see what changed: a coloured dot per action
  (green Created, amber Edited) and each change in its own block.
  - **Layout:** a reverse-chronological **timeline**. Each event is its own **section**, a Plane 2 block with a 1px Line edge
    and 4px radius, on a 1px `line-strong` spine with a 13px **coloured node**.
  - **Header:** the action as a coloured small-caps label (**Created** green, **Edited** amber, **Moved** blue,
    **Deleted** red, **Renamed** amber, and vault-level events such as "Vault key changed" in Ink 3). Then the entry and
    its folder (Activity only), and the time as a relative phrase plus a date ("Yesterday · Sep 26, 9:14 PM", in a
    `<time datetime>`). A "by You / email / Another person" line follows.
  - **Legend:** a compact key under the lead (Created · Edited · Moved · Deleted).
  - **Colour tokens (Passwords-scoped, AA as text in both themes):** created `#6fcf97` / `#1e7a45`, edited `#f2a93b` /
    `#8a4a00` (the light value is pushed toward orange so it stays distinct from Gold Text `#8a6300`), moved `#8ab4d8` / `#2f6690`, deleted = Danger, vault = Ink 3. The words carry every meaning; colour is
    never the only signal.
  - **What changed:** changed fields sit in an **amber-tinted row** with a CHANGED tag and old → new (`<del>` in Ink 3,
    an arrow, `<ins>` in Ink; the screen-reader text reads "was … now …"). On the tint, labels, struck-out values and the mask use Ink 2, so they stay at AA or better on both tints (about 6:1). A line then lists the unchanged fields ("Title,
    username, website and notes didn't change."). A Created event lists the fields it was created with. A Moved event
    shows Folder old → new. A Deleted event (Activity) has "Show what it held" / "Hide what it held" (`aria-expanded`).
    Activity adds a search field ("Search entries, folders, people") and "Load earlier changes".
  - **Secret fields follow §15.1:** a fixed mask, a per-version icon Show ("Show the password from this version",
    `aria-pressed`, announced by state only), never in the DOM while hidden. A shown old password carries the **same signature as the sheet**: the Gold Text draining rule over 30 s (under reduced motion, "Hides after 30 seconds"). It auto-hides at expiry, on dialog close, on collapsing its record, on lock, and on `visibilitychange`/`pagehide`. The app can decide "changed" only by
    decrypting both versions in memory. It renders just the CHANGED tag, never the old value, unless that version is
    shown.
  - "Deleted entries stay here: BakerRang can't read them, and they can't be removed yet." On phone, fields stack (label
    over value) and the time drops under the action.
- **Vault settings:** **Lock after** (Listbox: 15 minutes · 1 hour · 8 hours · Never; "Never" adds "Your unlocked vault
  stays in this tab until you lock it or close the tab.") · **Browser extension fills logins on the page** (switch;
  "Applies to the BakerRang Vault Autofill extension.") · **How your vault is protected** (the §5.3 disclosure, including
  the clipboard sentence).

### 19.7 States (copy locked)
| State | Shows | Recovery |
|---|---|---|
| Signed out (Welcome) | Masthead **"Your passwords, locked before they leave this device."** Lead: "Passwords keeps your logins in folders, encrypted in your browser with a master password only you know. BakerRang stores the encrypted copy and can't read it." Gold **Sign in with Google**. Facts (ruled list): "Encrypted on your device" · "Separate master password" · "No recovery. If you forget it, it's gone." | Sign in |
| Checking vault (> 300 ms) | Quiet ground + "Opening Passwords…" | — |
| Couldn't reach vault (META_FAILED) | "Passwords couldn't reach your vault." / "Nothing was changed. Check your connection, then try again." + ghost **Try again**. Never shows Create. | Try again |
| No vault (Create) | "Create your vault" · "Choose a master password. It encrypts everything here and never leaves this device." · Master password (min 12; hint "Use 12 or more characters. A few unrelated words works well.") · Confirm · checkbox "I understand BakerRang can't recover this password." · gold **Create vault** | — |
| Creating | "Creating your vault…" (Argon2 takes a moment) | — |
| Locked (Unlock) | "Unlock Passwords" · Master password · gold **Unlock** · "Forgot it? BakerRang can't recover it." | — |
| Unlocking | "Unlocking…" (a CSS spinner; it keeps turning while Argon2 blocks the main thread) | — |
| Wrong password | "That master password didn't unlock the vault." Field cleared, focus returned. | retype |
| Unlock network/server failure | "Passwords couldn't load your vault. Nothing was changed." + Try again | Try again |
| Unsupported KDF (§11.2) | "This vault uses settings Passwords doesn't support. Nothing was changed." | — |
| Empty vault | "Your vault is empty." / "Add your first login, or bring your passwords over from KeePass." · gold **New entry** + ghost **Import from KeePass** (the toolbar New entry is ghost in this state) | — |
| Empty folder | "Nothing in Banking yet." | — |
| No search results | "No entries match "bank"." + Clear search | — |
| Can't open this entry | a row tagged CAN'T OPEN (Ink 3). The sheet says "This entry can't be decrypted with your keys." + owner shared folder: "Repair access in Share settings may fix it." | Repair access |
| Saving / saved | Save → "Saving…" (form `aria-busy`); saved → the live region "Saved Example Bank." | — |
| Save failed | "Couldn't save. Your changes are still here." | Save again |
| Conflict / deleted elsewhere | §14 copy | Use latest / Remove from view |
| Offline (unlocked) | Ruled notice "You're offline." / "You can read what's unlocked. Changes can't be saved until you're back." Save `aria-disabled`. | — |
| Updates from others | Ruled notice "Changes from another person are ready." + Refresh (only while a sheet is in Edit, else auto-applied) | Refresh |
| View-only shared | Sheet foot "View only · shared by …". No Edit, no Delete, no New entry in that folder. | — |
| Locked by idle | the Unlock view + Ink 3 line "Locked after 8 hours without activity." | — |
| Copy failed | §15.3 | Show password |

---

## 20. Responsive / mobile contract
- **≥ 1100 px:** three panes: rail 248 px · list `1fr` · sheet 440 px. The page itself doesn't scroll; each pane scrolls
  internally (the legacy app-shell behavior, kept). The toolbar is one row.
- **641–1099 px:** the rail collapses into the **folder bar** above the list (legacy mobile summary bar: current folder +
  count + chevron, opening the tree as a popover panel). List | sheet (sheet 400 px).
- **≤ 640 px (390 × 844 reference):** one pane at a time. Toolbar: gold **New entry**, **Activity** (icon), a **More** (⋯)
  menu holding Import from KeePass, Export to KeePass and Vault settings, and a **Lock** button that keeps its label (it
  matters). With 44 px targets, the legacy row of four icons plus a labelled Lock doesn't fit 358 px. Folder bar, search (48 px), then the list with the A–Z rail (letters on
  **24 px** targets, drag-scrub kept; hidden below 20 results). Rows are ≥ 60 px (the title on one line, the username/
  website/folder on the second), so titles no longer truncate at 12 characters as legacy's single line did. An entry opens as a
  **full-screen sheet** with "‹ Back" (and system back/Esc). View's Copy/Show buttons are **44 × 44**. Edit's foot
  (Cancel · Save) is sticky at the bottom of the sheet inside `env(safe-area-inset-bottom)`. The viewport meta adds
  `interactive-widget=resizes-content` so Android shrinks the layout for the keyboard (iOS scrolls the focused field into
  view natively). **Opening an existing entry never focuses a field** (no keyboard pop). New entry focuses Title.
- The bulk bar is a fixed bottom bar (full width on phone, inside the safe area). Its Move listbox opens upward.
- Dialogs are full-height sheets on phone, with the primary action in a sticky foot.
- **No horizontal scrolling at 360–430 px.** Long titles wrap to 2 lines in the sheet header and ellipsize in rows (the full
  title is available in the sheet, never in a `title` attribute).
- **Secret face:** revealed passwords use `ui-monospace, "SF Mono", "Cascadia Mono", Consolas, "Roboto Mono", monospace`
  at 16 px, `letter-spacing: 0.04em`, wrapping anywhere. A system stack means no new font file, network request or CSP
  change (DESIGN.md "Mono-for-Secrets" scoped rule).

## 21. Accessibility contract
- **Landmarks/semantics:** bar `<header>`; `<main>` with three regions: `<nav aria-label="Folders">` (a tree:
  `role="tree"`, `treeitem`s with `aria-expanded`, `aria-level`, `aria-selected`, arrow keys ↑↓←→ Home End, Enter opens),
  `<section aria-label="Entries">` (a list of `<button>` rows, each with the title as its name and the username/website as
  `aria-describedby`), and `<section aria-label="Example Bank">` for the sheet. The `<h1>` is visually hidden "Passwords"
  (the bar carries the wordmark). The sheet title is an `<h2>`.
- **Labels:** every input has an associated `<label for>` (legacy's weren't associated). Icon buttons have visible text or
  an `aria-label` ("Import from KeePass", "Export to KeePass", "Activity", "Vault settings", "Lock vault", "Copy username",
  "Copy password", "Show password", "Version history", "Folder actions for Banking", "Reorder Banking"). There's **no
  `title`-only naming**, and glyph icons (⟳ ⧉ ✓) are replaced by drawn SVG with `aria-hidden`. **Icon-only tools** (Copy, Show, Open, Edit, Version history, Delete) carry an `aria-label` naming the action and its object ("Copy password", "Edit Example Bank", "Delete 3 selected entries") plus a visual tooltip on hover **and keyboard focus**; the tooltip text is never a secret.
- **Secrets and AT:** §15.1. The hidden password isn't in the accessibility tree. Reveal and copy are announced by
  state, never by value. The replacement-password field's accessible description says it's visually masked.
- **Live region:** one polite `role="status"` for "Password shown/hidden", "Username/Password copied", "Saved …",
  "Deleted …", "Moved 3 entries to Banking.", "Vault locked." Errors use `role="alert"` in their context.
- **Focus:** opening a sheet moves focus to its `<h2>` (tabindex −1), not a field. Closing returns it to the row.
  Dialogs use `showModal()` (native trap), and focus returns to the opener. After lock, focus goes to the master-password
  field. The focus ring is the world's 2px Gold Text outline, 3px offset.
- **Keyboard:** everything is reachable with Tab; `/` focuses search (the only single-key shortcut, ignored inside
  inputs); Esc closes the sheet/dialog (subject to the dirty guard). **Drag-reorder has a keyboard equivalent** (the
  "Move folder…" dialog). The A–Z rail is a `role="navigation" aria-label="Jump to letter"` with button letters.
- **Touch targets:** ≥ 44 px on phone for every action (the rail's letters are the stated exception at 24 px, WCAG 2.2
  AA minimum, with the list itself as the primary path).
- **Color independence:** permission, shared and can't-open are text tags. Validation is Ink + icon + message. Nothing
  depends on the accent.
- **Reduced motion:** the drain, sheet slide and row transitions are instant. **Contrast:** AA in both themes (world
  tokens; the Passwords Slate underline is decorative, and the text next to it carries meaning).

## 22. PWA
App-local `vite.config.js` exports `PASSWORDS_PWA_OPTIONS` (config test): `registerType:'autoUpdate'`, `id:'/'`,
`name:'Passwords — BakerRang'`, `short_name:'Passwords'`, `description:'Your logins, encrypted on this device before
they're saved.'`, `start_url:'/'`, `scope:'/'`, `display:'standalone'`, `theme_color`/`background_color` `'#161514'`,
maskable 192/512 icons. Workbox: `globPatterns: ['**/*.{html,css,js,woff2,png,ico,webmanifest}']`,
`navigateFallback:'index.html'`, **`runtimeCaching: []`**. The lazy kdbxweb chunk is precached like any hashed asset (code,
not data). **No offline vault:** a cold start offline loads the shell, the auth check fails, and the result is Welcome (the
ecosystem standard). An unlocked tab that goes offline keeps working read-only from memory (§19.7). Icons are rasterized
from `web/.impeccable/mocks/passwords-icon.svg` by an app-local `scripts/generate-icons.cjs` (cloned from Budget), with the
canonical `bakerrang-logo.png` composited, never redrawn. Provenance goes in `apps/passwords/ASSETS.md`.

## 23. CI / CD / deployment (extend the Phase C–F mechanisms; no redesign)
Naming check: nothing in `scripts/ci`, `.github/workflows`, `web/`, `server/config` or the registry uses `passwords` for anything
else. The registry id is `passwords`, the env key `VITE_PASSWORDS_URL`, the token `--accent-passwords`.

| Mechanism | Change |
|---|---|
| `web/apps/passwords` | `@bakerrang/web-passwords`, dev **3050**, preview **4178**, root script `npm run dev:passwords`. Deps: the shared packages + `react-router-dom@6.28.0` + **`hash-wasm@4.12.0`, `kdbxweb@2.1.1`** (§16.3). |
| `web/package-lock.json` | `npm run relock` (the Docker/Linux relock). |
| `web/Dockerfile` | deps stage `COPY apps/passwords/package.json …`. **Runner stage (shared change):** `COPY nginx/ /tmp/nginx/` then `RUN if [ -f "/tmp/nginx/apps/$APP.conf" ]; then cp "/tmp/nginx/apps/$APP.conf" /etc/nginx/conf.d/default.conf; else cp /tmp/nginx/nginx.conf /etc/nginx/conf.d/default.conf; fi && rm -rf /tmp/nginx && nginx -t`. Every other app still gets the byte-identical shared `nginx.conf` (a test asserts it). |
| `web/nginx/apps/passwords.conf` | new (§16.1): the shared config's locations + the header set in each location. |
| `scripts/ci/classify-changes.mjs` | `ALL_WEB_SERVICES` += `'web-passwords'`; rule `{ prefix:'web/apps/passwords/', ci:['web-passwords'], deploy:['web-passwords'] }`; **`web/nginx/apps/passwords.conf` → `web-passwords` only** (a more specific rule before the `web/nginx/` fan-out); outputs `web_passwords`, `deploy_web_passwords`. |
| `ci.yml` | a `web-passwords` build + Docker packaging (`--build-arg APP=passwords --build-arg VITE_OAUTH_TARGET=passwords`), plus a **header smoke**: run the built image, `curl -sI /` and assert the CSP, `X-Frame-Options`, `nosniff`, and that `/nope` also carries them. Added to `ci-passed`. |
| `deploy.yml` / `_deploy-cloud-run.yml` | the `web-passwords` option/job/case (`WEB_PASSWORDS_SERVICE`, `PASSWORDS_BASE_URL`, `image_name="web-passwords"`, SPA-shell assertion) + a **post-deploy header assertion** on the live URL (CSP present, `frame-ancestors 'none'`). |
| `stale-deploy-guard.mjs`, `rollback.yml`/`rollback.ps1`, `verify-live.yml`/`verify-live.ps1` | `web-passwords` everywhere Budget appears; verify-live adds a `PasswordsHeaders` assertion. |
| Tests | classifier (passwords-only → `web-passwords`; `web/nginx/apps/passwords.conf` → only `web-passwords`; `web/nginx/nginx.conf` → all six; `web/packages/**` → all six: launcher, storybook, polyglot, sign, budget, passwords; `server/` → api only), deployment-workflow, stale-guard, rollback and verify-live tests. |
| GitHub `production` Environment | `WEB_PASSWORDS_SERVICE=bakerrang-web-passwords`, `PASSWORDS_BASE_URL=https://passwords.bakerrang.com`. |
| Immutable SHA / WIF | Unchanged: `…/web-passwords:<sha>`, deploy by digest, scoped `roles/run.developer` on `bakerrang-web-passwords` only. |

**Selective deploy:** a Passwords-only change deploys only `web-passwords`. A `web/packages/**` change deploys all six web
apps. PR 2 touches `web/Dockerfile`, so it deploys all six (the shared nginx config is unchanged for the other five).

## 24. Coexistence, deployment and cutover
| Entry | Before the flip | After the flip |
|---|---|---|
| Launcher Vault module + every app switcher | `https://bakerrang.com/passwords` | `https://passwords.bakerrang.com` |
| Legacy `bakerrang.com/passwords` | working, unchanged UI (+ L1 hotfix) | unchanged; retired at decommission |
| Legacy Account "Password Vault" settings | working | working until the Account phase (Phase H must not port it) |
| Extension | reads the same endpoints; alias still → legacy crypto | unchanged (it moves at decommission, §11.3) |
| Apex, Story Book, Polyglot, Sign, Budget | unchanged | unchanged (registry flip redeploys them, with no behavior change) |
| WoW | legacy, untouched | legacy, untouched (decommission later) |

1. **PR 1: server** (B1–B12 below) + `node:test` suites + `.env.example` + `firestore.indexes.json`. Deployable alone. The
   legacy client and extension are unaffected (their contracts hold, 201-vs-200 included).
2. **PR 1b: legacy hotfix L1** (client-only, tiny), **deployed before or together with PR 1**:
   - `lock()` also clears `sharedTrees`/`sharedTreesRef` and `rawFoldersRef`.
   - `loadSharedTrees`/`applyUpdates`/`loadEntries` drop results when `vaultKeyRef.current` changed since they started.
   - `ensureKeypair` reconciles a 409 from set-once `POST /vault/keys` via `client/src/utils/vaultKeypair.js` (§12.2a).

   It deploys the legacy `client`. It exists because legacy stays live: S1 is a lock-boundary failure, and without the
   reconciliation, set-once would strand a racing legacy tab.
3. **PR 2: app + CI + Launcher copy + runbook**: `web/apps/passwords`, Dockerfile runner change, `nginx/apps/passwords.conf`,
   classifier, workflows, rollback/verify-live, the Launcher Vault copy (§5.3: tag "Encrypted on your device" + the new
   sentence), `docs/apps/Passwords-PhaseG-Runbook.md`. `liveUrl` stays `null`.
4. **Operator runbook** → first deploy via CI → verify on `run.app` (including headers) → map `passwords.bakerrang.com` → DNS.
5. **Live acceptance** (§28) directly on `passwords.bakerrang.com`.
6. **PR 3: flip:** `liveUrl:'https://passwords.bakerrang.com'` (a shared package, so all six redeploy) + `index.test.jsx`.
7. **Rollback:** `rollback.yml` for `web-passwords`; revert PR 3 to restore the legacy destination; revert PR 1 only after
   PR 3 (the new app needs `rev`, `/pubkey` POST and `no-store`). Data needs nothing (§8).

**Server change list (PR 1):**
| # | Change | Where |
|---|---|---|
| B1 | `noStore` first on `/vault` | `server/app.js` |
| B2 | Id `param` validation (§12.1) | `routes/vault.js` |
| B3 | The strict cipher-blob validator + strip-unknown-keys (§12.1) | new `server/domain/vaultShapes.js` (pure) |
| B4 | KDF exact-match check (§11.2) on `POST /vault` and `PUT /vault/key`; `keyRev` CAS + audit on `PUT /vault/key` | new `server/domain/vaultKdf.js`, `vaultService.js` |
| B5 | `POST /vault/keys` set-once, in a transaction, idempotent for an equal `publicKey`, 409 `keys_exist` otherwise (§12.2a) | `vaultService.js` |
| B6 | `POST /vault/pubkey` + `vaultLookupLimiter` on both methods; recipient email validation (also in `createShare`) | `routes/vault.js`, `middleware/security.js` |
| B7 | Fixed 5xx body + fixed-shape logs in `handle()` | `routes/vault.js` |
| B8 | Server-generated ids on item/folder creates (ignore body `id`) | `vaultService.js` |
| B9 | `rev` on every item/folder write, in transactions; optional `expectedRev` CAS on item/folder/shared-item PUT; transactional moves with `revs` | `vaultService.js` |
| B10 | Audit query validation (§12.6) | `vaultService.js` |
| B11 | OAuth target `passwords: 'PASSWORDS_DOMAIN'`; CORS `env.PASSWORDS_DOMAIN`; `.env.example` `PASSWORDS_DOMAIN=` (local `http://localhost:3050`) | `config/oauthTargets.js`, `config/origins.js` |
| B12 | `_setDb` test seam in `vaultService.js` (the budget/lead pattern); codify the two audit indexes | `vaultService.js`, `firestore.indexes.json` |

### 24.1 Runbook specification (`docs/apps/Passwords-PhaseG-Runbook.md`, written in PR 2)
Clone the Budget runbook's structure and voice exactly (PowerShell, copy-pasteable, expected output after each check).
Targets: `web-passwords` / `bakerrang-web-passwords` / `https://passwords.bakerrang.com` / `bakerrang-api` /
`avian-cable-379805` / `us-west1` / runtime SA `bakerrang-frontend@…`, plus an "Until final cutover" block.
- **STEP 0** variables (`$PasswordsService`, `$PasswordsHost`, `$PasswordsBaseUrl`, …); confirm project + auth.
  **STEP 0b** optional read-only counts (vault docs, total items, shares): **count aggregation only, never document
  reads or exports**.
- **STEP 1** `gh variable set/get` `WEB_PASSWORDS_SERVICE`, `PASSWORDS_BASE_URL`.
- **STEP 2** `gcloud run services update $ApiService --update-env-vars "PASSWORDS_DOMAIN=$PasswordsBaseUrl"` (PR 1 deployed
  first) + verify. Never remove existing vars.
- **STEP 3–5** Bootstrap `bakerrang-web-passwords` from the current `bakerrang-web-budget` image (SA, port 8080,
  unauthenticated); copy `roles/run.developer` members from `bakerrang-web-budget`; verify SA-user. No project-wide roles.
- **STEP 6** Push PR 2 → normal deploy; `gh run watch`.
- **STEP 7** `run.app` checks: shell 200 + `<div id="root"`, `/nope` → shell, the manifest name, `sw.js`, **and the headers**
  (`Invoke-WebRequest -Method Head` shows the exact CSP, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, HSTS on `/`
  and `/nope`). `theme-boot.js` is served, and `index.html` contains **no inline `<script>`**.
- **STEP 8** API: `OPTIONS`/`GET https://api.bakerrang.com/vault` with `Origin: https://passwords.bakerrang.com` → ACAO echoes it
  with credentials; the 401 carries `cache-control: no-store`.
- **STEP 9–11** domain mapping (**never apex**), DNS records, certificate `Ready` loop.
- **STEP 12** direct-host acceptance = §28 rows as numbered checklists, **using a disposable test vault first** (a second
  Google account), then the owner's real vault for rows 3, 5 and 14 only.
- **STEP 13** Security/privacy inspection (§28 rows 10–13) with exact DevTools steps. **Evidence rule: never screenshot or
  paste a real revealed password, note or username; blur or use the test vault.**
- **STEP 14** Coexistence (legacy + new + extension).
- **STEP 15** Registry cutover PR snippet ("do NOT remove `legacyPath:'/passwords'`, do NOT delete the legacy page").
- **STEP 16** Post-cutover smoke: the Launcher + every app switcher open `passwords.bakerrang.com`.
- **STEP 17** Rollback (a/b/c as Budget) + the server order note.
- **STEP 18** Extension note: no action in Phase G; confirm autofill still works against the same vault (row 16).
- **FINAL EXPECTED STATE.** No key-rotation step. The legacy `GET /vault/pubkey` logging residual is documented in R6.

---

## 25. Shared-package impact / registry
| Package | Change |
|---|---|
| `web-app-shell` | **Implementation PRs: none.** `legacyPath:'/passwords'` (verified) and `liveUrl:null` stay. **Flip PR:** `liveUrl`. |
| `web-theme` | None. Passwords re-emits `THEME_BOOT_SCRIPT` as a file; the package is unchanged. |
| `web-ui`, `web-tokens`, `web-auth`, `web-api-client` | None. |
| Launcher | The Vault module copy only (§5.3), in PR 2. (Its "six apps … game advice" line isn't touched: WoW is out of scope.) |

---

## 26. Legacy design inheritance

Audit method: the real legacy UI was run with synthetic data and captured at 1440×900 (dark + light) and 390×844
(`web/.impeccable/review/passwords/legacy-*.png`).

**1. The strongest qualities of the current design**
- **It's a real tool, not a landing page.** It opens straight into the work: a KeePass-grade **three-pane
  master-detail** (folders | entries | entry) that power users recognize immediately.
- **Density with calm.** One-line entry rows (a medium-weight title, then the username in quiet grey on the same line)
  make 15+ entries visible at once without feeling crowded.
- **The folder tree feels like software:** chevrons, indent, counts right-aligned, a grip handle and a ⋮ menu that appear
  on hover, and "Shared with me" as a separate labelled group.
- **The A–Z rail** down the list's right edge: distinctive, fast, and it scrubs.
- **One loud action.** A gold "+ New Entry" is the only strong fill in the toolbar. Import/Export/Activity are quiet
  outlined icon squares, and **Lock sits apart on the far right**, which reads as a deliberate, safe place.
- **The entry panel as a sheet** beside the list: title in the header, history in the corner, fields stacked with
  their tools (copy, reveal, open) right beside them.
- **Charcoal-and-gold restraint** in dark mode; the light mode is clean and neutral.

**2. PRESERVE**
Three-pane master-detail and its proportions (≈ 240 / fluid / 440) · one-line dense entry rows (title + username) · the folder tree's
anatomy (grip, chevron, indent, name, count, ⋮; shared-by-me people icon; "Shared with me" group) · "All entries" /
"Unfiled" at the top of the tree · the A–Z rail and its scrubbing · the context header ("All Items (30)" → "All entries 30")
· search above the list with the select-all checkbox beside it · a single gold New-entry action at the toolbar's left,
quiet icon tools after it, Lock alone at the right · the entry sheet's header (back · title · history) and field order
(Username, Password, URL, Folder, Notes) with per-field tools · the floating bulk bar at the bottom · the drag chip ·
the phone pattern (folder summary bar above the list; an entry as a full-screen sheet with Back) · dark as the signature
look.

**3. REFINE**
- Typography → the world's Archivo (legacy used Poppins): titles 500, usernames Ink 3, the sheet title in Archivo Expanded.
- Rows → flat at rest with a hairline, Plane on hover/selection, the Passwords Slate 1px title underline (legacy boxed
  every row in its own rounded border: 30 boxes).
- Panels → ruled Ground 2 columns instead of rounded glass cards.
- Toolbar icons → world-drawn SVG at 1.75 stroke, with accessible names (visible labels at ≥ 1280 px).
- The A–Z rail → named, 24 px phone targets, keyboard-reachable.
- The entry sheet → a View mode (a definition list of ruled rows) with Edit as an explicit mode.
- Copy/reveal/open tools → icon-only buttons with names and tooltips, quiet at rest and gold on hover or when active (legacy: four
  always-gold squares with glyph icons). Edit, History and Delete are icon-only too.
- Gold → kept as the product's action colour (owner decision 4): gold commit buttons (Save included, as in legacy), gold
  switches and checked boxes, and Gold Text active states. It's never a surface wash.
- Phone rows → two lines so titles stop truncating at ~12 characters.
- Folder drag → plus a keyboard "Move folder…".
- Version history → the legacy model kept (owner): each change its own section with a coloured action marker (green Created,
  amber Edited, blue Moved, red Deleted) and changed fields highlighted in amber, now on a timeline spine with old → new
  diffs, an "unchanged" line, and masked secrets with a per-version Show.

**4. REPLACE, and why**
| Legacy | Why it must change | Replacement |
|---|---|---|
| Always-editable panel with the real password in a masked text input | Secret in the DOM `value` attribute and read aloud to screen readers (S7, S8, observed); autofocus opens the keyboard; accidental edits | View-first sheet; Replace-password flow; uncontrolled inputs |
| One dot per character | Leaks length (S10) | A fixed 12-bullet mask + the draining rule |
| Four always-gold icon squares with glyphs | Gold on every tool at rest meant nothing; the glyphs were unnamed | Icon-only drawn tools that turn gold on hover or when active; gold stays on commit buttons (owner decision 4) |
| Glassmorphism cards, backdrop blur, amber warning boxes, emoji ⚠️ | Banned by the world; security theater | Ruled planes, Ink notices with drawn icons |
| ⟳ ⧉ ✓ glyph buttons with only `title` names | Unnamed/unstable for AT; font-dependent | Drawn SVG + real names |
| Row hover-trash | Accidental deletes; invisible on touch (S19) | Delete in the sheet + bulk bar |
| Unassociated labels | Unnamed fields | `<label for>` everywhere |
| Poppins | Not the ecosystem face | Archivo |

**5. How the new app still reads as Passwords**
Put the two side by side and it's the same room, re-lit: the folder tree on the left with its counts and ⋮, the dense
list with the A–Z rail on the right edge, the gold New-entry at the top left with the quiet icons and a separate Lock at
the far right, and the entry sheet beside the list with its tools beside each field. What changed is material and
discipline. Glass and boxes became ruled Archivo planes. Gold still marks every action, but it now means "do this" or "this is on"
rather than decorating every tool. The password now sits behind a fixed mask
that visibly drains back into hiding. A long-time user finds every control where their hands expect it.

---

## 27. Deterministic test plan
**Automated.** Vitest + Testing Library in `web/`; `node:test` + FakeDb in `server/`. Behavior, not snapshots. All
fixtures are synthetic (sentinel values like `SENTINEL-PW-7f3a…`).

| Area | Tests |
|---|---|
| **Legacy-compat vectors** | `web/apps/passwords/src/vault/__fixtures__/legacy-v1.json` is produced **once** by `scripts/make-legacy-fixtures.mjs`, which imports the legacy `client/src/utils/crypto.js`. It covers a vault (master = a synthetic passphrase), an own entry, an entry with an extra folder copy, a recipient-created entry (folder key only), a stale-`wrappedItemKey` entry, a folder name + sharedName, a shared-with-me share (RSA-wrapped folder key), and a pre-sharing vault. The test proves the new module unlocks and decrypts **every** record to the expected plaintext, via the same key-resolution order (vault key → outermost subtree folder key). The script is kept, and its output is committed (no cross-workspace import at test time). |
| `vault/crypto.js` | Round trip; **wrong key → throws**; **tampering** (flip one bit in `ct`, `iv`, or the tag) → throws; blob shape (`iv` decodes to 12 bytes, `ct` ≥ 16); **nonce uniqueness** (10,000 encryptions under one key → 10,000 distinct IVs); fresh item key per `encryptItem` (two encryptions of the same entry → different `wrappedItemKey` and `ct`); **`unlockVault` default → `extractable === false`** (`exportKey` rejects), `{extractable:true}` → exportable; `reencryptItemKeepingKey` keeps the folder copy valid; RSA wrap/unwrap. |
| `vault/kdf.js` + server `vaultKdf.js` | **Accepted, the highest (and only) configuration:** the exact default `{argon2id, t:3, m:65536, p:1, hashLength:32}` + a 16-byte salt, as (a) a literal copy of `DEFAULT_KDF`, (b) every `kdf` object in the committed legacy fixtures (`legacy-v1.json`, all vault variants incl. pre-sharing), and (c) the same with an unknown extra key (ignored). **Rejected, each with an Argon2 spy asserting zero calls and the `UnsupportedKdfError` copy:** iterations 2 and 4; memory 65535, 65537, 131072 and 1048576; parallelism 0 and 2; hashLength 31 and 33; algo `argon2d`, `argon2i` and missing; salt of 15 and 17 bytes, non-base64, and missing; numbers as strings (`"3"`), non-integers (`3.5`), negatives and `null`. **Drift test:** the same table through the client and server modules → identical verdicts. **Server:** `POST /vault` and `PUT /vault/key` with each rejected `kdf` → 400, nothing written. **Known-answer vector:** Argon2id at the accepted params with a fixed salt and password → a fixed hex, so a dependency bump that changes output fails. |
| `vault/generator.js` | Length bounds; every enabled class present in 10,000 draws; symbols-off excludes symbols; alphabet exactly as specified; **uses only `crypto.getRandomValues`** (spy; a mocked sequence exercises the rejection threshold `x ≥ 2³² − (2³² mod N)` → redraw); a χ² uniformity check per position over 200,000 characters (deterministic PRNG-backed mock). **Static test: no `Math.random` in `src/`.** |
| Index / search | The index built from decrypted records contains **no password or notes** (deep scan for sentinels); search matches title/username/URL and **not notes**; multi-token AND; accent folding (legacy parity). |
| Reveal / copy (components) | View: the mask is 12 bullets regardless of length; the **sentinel password is absent from `document.body.outerHTML` and from every attribute** until Show; the accessibility snapshot has no sentinel; Show → value present in a text node, `aria-pressed=true`, status "Password shown" (**the status text never contains the sentinel**); auto-hide after 30 s (fake timers); hides on close/switch/Edit/lock/`visibilitychange` hidden/`pagehide`; Copy → `writeText` called with the value inside the click, status "Password copied"; rejection → failure copy + Show offer, with no `execCommand`/textarea path; **no clipboard write ever happens without a click**. |
| Edit | Existing entry: no input holds the current password; Replace → empty field; empty replace keeps the old password (the encrypted payload decrypts to the old value); uncontrolled fields → `getAttribute('value') === null`, notes absent from `outerHTML`; Generate fills the field without saving; dirty guard; 409 → conflict copy → Use latest decrypts `current`; 409 equal to the draft → success; 404 → deleted-elsewhere. |
| **Index residency** | With synthetic entries whose password and notes are unique sentinels, run index construction through `VaultProvider` (unlock with fixtures) → a deep scan of the index store and of every value reachable from the React fiber tree (the §18.3 walk) finds **no password or notes sentinel**, while titles, usernames and URLs are present. `buildIndexEntry` returns objects whose keys are exactly `{id, folderId, title, username, url, rev, source}`, and its plaintext `Uint8Array` is all zeros after return (a spy on the decrypt output). Then open one entry → only **that** entry's password/notes sentinels appear, and close → gone again. The same after a shared-folder refresh and after `applyUpdates`. |
| **Sharing-keypair race** | **Server** (node:test + FakeDb, `beforeCommit` interleave): a vault without keys; two `POST /vault/keys` with different pairs P1 and P2, arranged so both transactions read before either commits → **exactly one 200 and one 409 `keys_exist`**; the stored `publicKey`/`protectedPrivateKey` equal the winner's. A retry with the winner's pair → 200 (idempotent); a POST with P3 → 409; the stored pair is unchanged throughout. **Clients** (vitest, a fake API with the same set-once semantics and a barrier that releases the POSTs only after both clients have read `GET /vault` without keys), three scenarios against the committed pre-sharing fixture vault, same synthetic master password: (a) new app + new app; (b) new app + legacy `ensureKeypairWith`, imported by relative path in the test only, crypto injected; (c) legacy + legacy. For each: exactly one POST → 200 and one → 409; the fake store holds the winner's pair and **no overwrite** was attempted; the loser makes **no second POST**; **both clients finish unlocked**, and each holds a private key that unwraps a random folder key wrapped (RSA-OAEP) to the **stored** public key. The loser's generated pair is never persisted. |
| **Lock hygiene** | The full sequence (unlock → open own entry → reveal → open a shared entry → history → import preview → lock) → **a React fiber walk finds no sentinel**; key refs are null; the index is empty; a load resolving after lock is dropped (epoch); idle lock with fake timers; the **wall-clock check** on `visibilitychange` locks when time has passed; `pagehide` locks; sign-out calls `lock()` before logout; `web-auth` ANONYMOUS locks. |
| Storage / network privacy | Spies over a full session: no `localStorage`/`sessionStorage`/`indexedDB`/`caches` writes and no cookie writes other than `br_theme`; **every captured request body contains no sentinel** (password, notes, title, username, url, master password); no `/vault` URL has a query string except `audit` pagination. |
| Rendering safety | A title `<img src=x onerror=…>` renders as text; a `javascript:alert(1)` URL → no `<a>`; `data:` → no link; http(s) → an `<a rel="noopener noreferrer">`; static grep: no `dangerouslySetInnerHTML`/`innerHTML` in `src/`; **no `console.` in `src/vault`, `src/entry`, `src/state`**. |
| Accessibility | Every input labelled; icon buttons named; tree keyboard; dialog focus trap + return; sheet focus to `<h2>`; live-region texts; no autofocus on opening an existing entry. |
| PWA / CSP build | `PASSWORDS_PWA_OPTIONS` identity, `runtimeCaching: []`; built `dist/index.html` has **no inline `<script>`** and references `/theme-boot.js` first in `<head>`; `theme-boot.js` equals `THEME_BOOT_SCRIPT`; the kdbxweb chunk is lazy (not in the entry chunk). |
| nginx config | `passwords.conf`: every `location` has all eight headers with `always`; the CSP string exactly equals the spec; `nginx.conf` is unchanged byte for byte; the Dockerfile selection logic is exercised for `APP=passwords` and `APP=budget`. |
| Server `vaultShapes`/routes (FakeDb + the express harness) | 401 unauthenticated; **`no-store` on 200/4xx/5xx**; invalid ids → 400 before any read; the blob validator (12-byte IV, short `ct`, extra keys stripped); **the legacy client's exact request shapes still pass** (recorded fixtures of every legacy body); POST `/vault` bad kdf → 400, dup → 409; `PUT /vault/key` without/with a stale `expectedKeyRev` → 400/409, success → `keyRev+1` + an audit record; **`POST /vault/keys` twice → 409 the second time and the first key unchanged**; `POST /vault/pubkey` 200/404/409 + limiter; the legacy GET still works; create ignores a body `id`; **`rev` bumps on every write path** (owner, shared, move, legacy PUT without `expectedRev`); `expectedRev` stale → 409 with `current`; missing → 404; transactional move → `revs`, a missing id → 404 with no writes; **FakeDb `beforeCommit` interleave**: two PUTs with the same `expectedRev` → exactly one 200, one 409; **cross-user**: user A can't read/update/delete/move B's items by id or via `shared/B/…` without a share; view-only shares can't write; revoked shares lose access; recipients can't create folders; co-recipient redaction holds; audit query validation; 5xx body fixed and the console spy sees `{code,name}` only. |
| Auth / CORS | `oauthTarget.test.js` (`passwords` → `PASSWORDS_DOMAIN`; unset → 500), `cors.test.js`. |
| CI | §23 tests. |

## 28. Live acceptance matrix (`passwords.bakerrang.com`, before the flip)
**Evidence rule:** only the disposable test vault may appear in screenshots or recordings. Real-vault rows are recorded as
pass/fail text only. Never paste a real password, note or username.

| # | Check | Pass when |
|---|---|---|
| 1 | Shell + headers | HTTPS; `/` and `/nope` serve the shell; the manifest "Passwords — BakerRang"; the exact CSP, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, HSTS; `index.html` has no inline script; DevTools console shows **zero CSP violations** through rows 2–9. |
| 2 | Signed out | Welcome; the gold "Sign in with Google"; `?target=passwords` returns here; already signed in elsewhere → no prompt. |
| 3 | **Real existing vault** | The owner unlocks their real vault. The entry, folder and shared-with-me counts match legacy (compare counts only). No "Can't open" rows that legacy could open. |
| 4 | Create (test account) | A new vault rejects 11 characters and accepts 12 with the acknowledgment; the vault doc's kdf equals the default. |
| 5 | Unlock | Wrong password → the locked copy, field cleared; correct → vault; network off during unlock → "couldn't load", **not** "wrong password". |
| 6 | Create / edit / delete (test vault) | Add an entry; edit the title; Replace + Generate + Save; empty Replace keeps the old password (Show confirms); delete with inline confirm; reload → persisted. |
| 7 | Reveal | Mask = 12 bullets for 8- and 30-char passwords; Show reveals in mono; the drain runs 30 s and re-hides; switching tabs hides immediately. |
| 8 | Copy | Username/password copy with the "Copied" state; paste elsewhere matches; with clipboard permission blocked → the failure copy + Show. |
| 9 | Search / folders / A–Z / bulk | Search ignores notes; drag reorder + keyboard "Move folder…"; the rail jumps; bulk move and bulk delete. |
| 10 | **DOM / AT inspection** | Elements panel: search the DOM for the test password → **not found** while hidden, and never in any attribute even while editing; the Accessibility pane on the password row shows no value. |
| 11 | **Network inspection** | Every `/vault` request body holds only ciphertext/ids (search the HAR for the test password, title and master password → none); no query strings except audit pagination; the recipient lookup is a POST. |
| 12 | **Storage inspection** | Application tab: Local/Session Storage, IndexedDB and Cache Storage hold no vault data (the SW cache = shell assets only); cookies = `br_theme` only on `passwords.`. |
| 13 | **Response headers** | Every `/vault` response (200/401/409) has `cache-control: no-store`; the ACAO is exactly `https://passwords.bakerrang.com` with credentials. |
| 14 | Concurrency | Two tabs: edit the same entry → the second Save gets "changed somewhere else" → Use latest shows the first; different entries → both persist; delete in A, save in B → "deleted somewhere else". |
| 15 | **Legacy coexistence** | Edit in legacy → visible in the new app after a refresh; edit in new → legacy shows it; a legacy edit then a stale new edit → 409 (the new app never overwrites a legacy edit silently). |
| 16 | Extension | The Chrome/Edge extension still unlocks and autofills a test login; "Browser extension fills logins" toggled in the new app changes extension behavior after its next unlock. |
| 17 | Sharing (two test accounts) | Share a folder Can edit → the recipient sees it, adds an entry, the owner reads it; View only blocks edits; Revoke removes access; Repair access completes; the recipient history hides co-recipients. |
| 18 | Lock | The Lock button, idle (set 15 min, or a temporary lower test via settings), a bfcache back/forward → locked; sign-out → Welcome; after lock, reveal/copy controls are gone. |
| 19 | Mobile (real iOS Safari + Android Chrome, 390-wide) | No horizontal scroll; opening an entry doesn't raise the keyboard; Copy/Show 44 px; Edit's Save stays reachable above the keyboard; the rail scrubs; the entry sheet's Back and system back work. |
| 20 | Keyboard + screen reader | NVDA/VoiceOver: the tree, list, sheet, reveal ("Password shown", value only when navigated to), copy ("Password copied"), dialogs trap and return focus. |
| 21 | Themes + motion | Light/dark/system with no flash (external theme-boot); reduced motion → no drain, static hint. |
| 22 | PWA + offline | Installable as "Passwords"; offline after unlock → read-only notice; cold start offline → Welcome. |
| 23 | App switcher / cutover | Pre-flip: switchers open legacy `/passwords`; after PR 3: the Launcher and every app open `passwords.bakerrang.com`; other destinations unchanged; apex unchanged. |
| 24 | Deploy mechanics | A Passwords-only commit deploys only `web-passwords`; rollback + verify-live cover it; the other five apps keep the shared nginx config. |

---

## 29. Impeccable process and finish review
- **Order kept:** the repository audit (§1), the security audit and lock (§§2–18) and the legacy **visual** audit (§26) all
  came first. The legacy client was run for real against a throwaway API seeded with synthetic data encrypted by the
  real `crypto.js`, and captured (`review/passwords/legacy-*.png`). Visual work began only after that.
- **Structure:** the owner chose **"Three panes, evolved"** in the structured question (2026-09-27; the other option was
  "Two panes + folder path"). A user-pinned direction beats the roll, so **no concept-seed round ran and there is no
  seed key**, which the brief's FORM block records. Mode **Operate**. **Code-led**: no image generation was available, so
  the comp is the contract.
- **Direction contract** written to `web/.impeccable/surfaces/passwords.md` before the comp (all six blocks + FINISH).
- **Comp** (`passwords-comp.html`, 35 states, `?state=`), then **two batched inspection rounds** at 390/1024/1280/1440 in
  both themes. Fixed in those rounds: phone horizontal overflow, a duplicate tablet title, the rail tag truncation, and
  the full-height panes. The comp **enforces §15 itself**: measured on every capture, no secret is in the rendered DOM or
  any attribute except the two revealed states, and the replacement field is uncontrolled. Detector: two radius
  advisories fixed (the switch is now machined, not a pill), then `[]`.
- **Icon master** `passwords-icon.svg`: the shared Passwords emblem in Slate, the mask-and-drain signature, and the
  canonical B badge in Budget's position (render `review/passwords/icon-512.png`).

### 29a. Finish review record
A fresh `impeccable-finish-reviewer` (no shared context) reviewed the comp, the icon, the captures and the legacy
captures against the contract, §§15/19–21/26, and the Budget layer as the calibration sibling.
- **Round 0, `recapture`:** two invalid evidence files. `icon-budget-ref.png` showed an XML error, because the
  **pre-existing Phase F file `budget-icon.svg` isn't valid XML** (`--` inside a comment). It's reported here, **not
  repaired**: it's a completed phase and the shipped Budget PNGs are unaffected. The Passwords master had the same bug,
  which was fixed. A welcome capture had also lost 10 px to a scrollbar gutter. Both were recaptured.
- **Round 1, `fix`** with 8 material fixes. It **confirmed legacy descent** ("the same room re-lit"), the signature, View
  first, and gold = New entry. The fixes:
  1. the empty-vault rail misreported contents;
  2. a stale bulk capture made the columns look short;
  3. the phone generator field clipped the value;
  4. the conflict state had two ink primaries;
  5. Revoke used Danger;
  6. the Welcome example clipped;
  7. comp-scaffolding copy sat in Vault settings;
  8. the phone toolbar needed a citation.

  Ceiling notes also came back: the Label rule on the rail heads, the A–Z current-letter mark, and a missing Copied
  capture.
- **All fixed in one batch → verdict: all 8 `resolved`**, plus two small regressions: the rail-head spacing was inverted,
  and Show shifted when Copy became "Copied". Fixed (28/12 px spacing; Copy reserves its "Copied" width) → **regression
  pass: both `resolved`, no new regressions → `ship`.** The scope is the scored fixes and regressions, not a fresh full
  review. The reviewer's optional polish (right-align Copy so the tool column has one edge) was applied and measured.
- **Owner review of the comp (2026-09-27): "a little too black and white"; many buttons can be icons.** This is recorded as
  owner decision 4 (§19.3): gold commit buttons, gold switches and checked boxes, and Gold Text active states. Copy, Show,
  Open, Edit, History and Delete became icon-only with names and tooltips. It was verified: every icon button is named,
  no layout moves on Copied, there's no overflow at 390/1440, the detector returns `[]`, and a secret appears only
  when revealed. A scoped review and a documenter refresh followed (§29a).
- **Documenter:** `web/DESIGN.md` gains "Product layer: Passwords" (+ 13 typography roles, 32 components and a spacing
  token in the frontmatter). `.impeccable/design.json` gains additive `pass-*` typography, motion (`drain` 30 s,
  `sheet-in`, `copied-hold`), breakpoints, four component snippets, and scoped rules, dos, don'ts and `notCanonized`
  entries. The frontmatter parses (strict YAML) and design.json is valid JSON. The one craft-floor defect it recorded
  (glyph −/+ in the Length stepper) was then fixed in the comp and its note removed.
- **Owner amendments (2026-09-27), reviewed in scope:**
  - **More gold + icon-only tools** (owner decision 4). Reviewer: `fix` (one stale contract line) → `ship`. The documenter
    recorded "The Gold Marks Action Rule" as a scoped exception to the world's Reserved Gold Rule.
  - **Version history / Activity to the legacy model** (§19.6): colour-coded sections on a timeline, amber changed-field rows
    with old → new. Reviewer: `fix`, with 3 findings:
    1. AA on the amber tint → Ink 2 on the tint, and the light Edited colour moved to `#8a4a00`;
    2. history reveals lacked the draining rule and auto-hide → they now carry the signature;
    3. the phone search placeholder clipped.

    All 3 were resolved, plus the reviewer's colour-collision note → `ship`. The documenter then recorded the history tokens
    (history-only, Passwords-scoped) and the timeline component. These verdicts cover the scored changes; they aren't
    fresh whole-surface reviews.
- **Implementation must NOT copy these comp shortcuts** (DESIGN.md records them as non-canonical): the Google Fonts CDN
  link (the app self-hosts Archivo via `web-tokens`, and the CSP forbids third-party origins); `innerHTML` string
  rendering (React, no remount of focused controls, secret fields uncontrolled); aria-modal overlays (native
  `<dialog>.showModal()`); trigger-only listboxes (the full ARIA listbox); the folder ⋮ opening Share directly (the
  app opens the folder menu, §19.2); the review panel; synthetic data.

## 30. Files created / updated by this planning phase
| File | Status |
|---|---|
| `docs/apps/PhaseG-Passwords.md` | **new** (this document) |
| `web/.impeccable/surfaces/passwords.md` | **new** (surface brief + direction contract) |
| `web/.impeccable/mocks/passwords-comp.html` | **new** (interactive comp, finish verdict `ship`) |
| `web/.impeccable/mocks/passwords-icon.svg` | **new** (app-icon master) |
| `web/.impeccable/review/passwords/*.png` | **new**, gitignored run output (legacy audit + review captures; synthetic data only) |
| `web/DESIGN.md` | updated: "Product layer: Passwords" + frontmatter (documenter, from the finished comp) |
| `web/.impeccable/design.json` | updated: additive Passwords entries (documenter) |
| `web/PRODUCT.md` | updated: "Product: Passwords (Phase G truth)"; Passwords capability line reworded (no "zero-knowledge"); WoW marked retired from migration |
| `docs/apps/Phase0-EcosystemArchitecture.md` | updated: the 2026-09-27 supersede note (WoW retired from migration; Phase G = Passwords; Phase H = Account; Account must not port vault settings) |
| **Created by implementation later (not now):** `web/apps/passwords/**`, the server changes (§24 B1–B12), legacy hotfix L1, CI/CD (§23), `web/nginx/apps/passwords.conf`, the Launcher copy line, `docs/apps/Passwords-PhaseG-Runbook.md` | — |

No production code was written. Nothing was committed or pushed. The repo-root platform ("Business Workshop") design world
wasn't touched. No WoW artifact was created or removed.

## 31. Risks, open items and security blockers
- **R1** T4/T6 residual: web-delivered client-side encryption trusts the code the browser loads. It's mitigated (CSP,
  pinned bundled deps, digest-pinned deploys), never eliminated, and stated in the disclosure.
- **R2** Legacy PUTs remain last-write-wins until legacy retires. The new app can't be silently overwritten by them (rev),
  but a legacy save can overwrite a new-app save.
- **R3** No "delete vault / start over" and no master-password change (CR4). A user who forgets the master password is
  stuck with an unopenable vault. **Product gap, deferred, not a Phase G blocker.**
- **R4** A retried create after a timeout may duplicate an entry (visible, deletable).
- **R5** The planner didn't count production vault data (by design). STEP 0b gives counts.
- **R6** The legacy `GET /vault/pubkey?email=` keeps writing recipient emails to Cloud Run request logs until legacy
  retires (low volume: only when a legacy user shares).
- **R7** `-webkit-text-security` support varies (Firefox), which is handled by the "starts shown" rule (§15.2) and
  acceptance row 10.
- **R8** Argon2 blocks the main thread ~0.5–1.5 s on phones. A Worker is deferred.

**Unresolved SECURITY blockers: none.** Every finding has a locked action or an explicit, documented deferral.
