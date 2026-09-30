# Phase H — Account extraction (`account.bakerrang.com`)

> **Status: PLANNING COMPLETE: PHASE H READY FOR CHATGPT REVIEW.** The product, ownership and API decisions were audited
> from repository truth and locked first (§§1–13). Design followed (§§14–20). The Impeccable finish verdict is **ship**
> (§24). **No production code has been written.** Nothing was committed or pushed.
> Author role: Planner / Product-Design / Architecture authority.
> Builds on the locked [Phase 0 architecture](Phase0-EcosystemArchitecture.md) (§8 Account, §9 theme, §11.S Supermarket)
> and the Phase C–G template ([Passwords](PhaseG-Passwords.md), [Passwords runbook](Passwords-PhaseG-Runbook.md),
> [Budget](PhaseF-Budget.md)). No completed phase is reopened. Where Phase H changes a shared mechanism it says so (§11.4:
> three small `web-theme` fixes; §12: `/auth/check` no-store).
>
> Design artifacts (consumer Impeccable world, `web/`):
> - Surface brief and direction contract: [`web/.impeccable/surfaces/account.md`](../../web/.impeccable/surfaces/account.md)
> - Interactive comp: [`web/.impeccable/mocks/account-comp.html`](../../web/.impeccable/mocks/account-comp.html) (every state
>   from its review panel or `?state=`; all data synthetic)
> - App-icon master: [`web/.impeccable/mocks/account-icon.svg`](../../web/.impeccable/mocks/account-icon.svg)
> - Legacy audit + review captures: `web/.impeccable/review/account/*.png` (gitignored run output, synthetic data)

**Ecosystem state (recorded).** Launcher, Story Book, Polyglot, Sign, Budget and **Passwords (Phase G) are complete**,
deployed, accepted and cut over. **Phase H = Account**, the last consumer extraction. WoW Advisor stays legacy-only until a
later decommission. Supermarket is retired. **Final legacy/decommission cleanup follows Phase H** (the apex cutover,
`client/` retirement, and the Supermarket and WoW backend and data removal).

**Owner decisions (2026-09-29):**
1. **Voices stay in Account, with full management.** Repo truth forced the question: the largest legacy Account section is
   *Cloned Voices*, and Phases C/D locked "voices are Account-owned". Story Book and Polyglot link to Account to add or
   manage a voice. Account gets list, add (upload or in-browser recording, with a consent confirmation), rename, make
   primary and delete. Story Book and Polyglot keep only their per-device voice choice.
2. **Supermarket is removed from Account only**, in the new app **and** legacy Account. The legacy `/supermarket` page and
   the `/supermarket/licenses` backend stay until the final cleanup (the legacy page still calls them).
3. **Structure: "Section rail + one ruled sheet"**, chosen on the Impeccable decision page from three dealt structures
   (seed `e184acff`, surface scope, mode Operate). Code-led (no image generation available).

Planner decisions (locked here, not left to Codex): vault settings are owned by Passwords (§4); identity is read-only with
initials, never a remote photo (§6); no account deletion or export in Phase H (§8); Account stays off the tool grid (§18);
Account ships as its own PWA (§17) with a strict per-app nginx header set (§16.2).

---

## 1. Exact legacy Account inventory (repository truth)

Everything below was read from source. The UI was then **observed running**: the real legacy client ran against a
throwaway in-memory API with synthetic data, captured at 1440×900 and 390×844 in both themes
(`review/account/legacy-*.png`).

### 1.1 Where it lives

| Layer | Truth |
|---|---|
| Route | `/account` → `<Account />` inside legacy `MainContent` (`client/src/App.jsx:32`). Reached from the legacy avatar dropdown (`MainContent.jsx:109`). |
| Page | `client/src/components/Account.jsx` (282 lines): **three sections, in order**: Cloned Voices (`:78–141`), SuperMarket Licenses (`:143–198`), Password Vault (`:200–274`). |
| Voice UI | `VoiceRow.jsx` (per-voice Name/Description inputs, a "Primary" tick, Delete + `ConfirmModal`), `AddVoiceModal.jsx` (name, description, `DropzoneWrapper` up to 3 audio files, `AudioRecorder`), `ConfirmModal.jsx`. |
| Supermarket UI | `ProductLicense.jsx` + `productLicenses` (`client/src/constants/index.js:209`), 26 license cards. |
| Vault UI | Auto-lock `FolderSelect` + inline-autofill switch; **Account imports `useVault()`** (`Account.jsx:5,17`) and `AUTO_LOCK_OPTIONS` (`utils/vaultSettings.js`). |
| Providers | `AppProvider.jsx` (fetches `GET /text/to/speech/v1/voices` once on shell mount; `voices` + `setVoices` shared with Story Book/Polyglot legacy pages), `VaultProvider.jsx` (wraps every legacy route), `ThemeProvider.jsx` (**localStorage `bakerrang-theme`, light/dark only**), `AuthProvider.jsx` (30 s `/auth/check` poll, GET logout). |
| Theme | **Not in Account.** A light/dark toggle sits in the legacy avatar dropdown (`MainContent.jsx:117`). Legacy never reads or writes `br_theme` or `/account/preferences`. |
| Identity | **Not in Account.** The legacy header shows `auth.user.photo` (a Google `lh3.googleusercontent.com` URL) in the avatar button. |
| Session | Logout = `GET /auth/logout` from the avatar dropdown. Nothing in Account. |
| Lifecycle | **None.** No delete account, data export, purge, email change or Google unlink exists anywhere (consumer side). |
| Notifications / app prefs | **None.** |
| Browser storage | `localStorage.bakerrang-theme` (legacy theme). Nothing else. |
| Tests | None cover `Account.jsx`, voices or licenses. `server/test/accountPreferences.test.js` covers `/account/preferences`. `server/test/polyglot.test.js` covers speech tokens and provider-error redaction. |

### 1.2 Server surface touched by Account

| Route | File | Behavior today |
|---|---|---|
| `GET /account/preferences` | `routes/account.js` | `app.use('/account', isAuthenticated, accountRouter)` (`app.js:119`). Returns `{ theme }` only when stored, else `{}`. `no-store` on 200 only. Errors → `next(error)` → Express default handler. No rate limit. |
| `PUT /account/preferences` | same | Body must be exactly `{ theme: 'light'\|'dark'\|'system' }` (any other key → 400). Transaction: read `users/{id}.preferences`, write `{ preferences: { ...current, theme } }` with `merge:true`. Returns `{ theme }`. |
| `GET /text/to/speech/v1/voices` | `routes/textToSpeech.js` | `where('userId','==',uid)`, returns **raw** docs (`doc.data()`, incl. `userId`). No `no-store`. |
| `POST /text/to/speech/v1/voice` | same | `multer.memoryStorage()` with **no limits** (any size, any type, any count before `.array('files',3)` trims). Forwards to ElevenLabs `/v1/voices/add`, then stores **the whole multipart body** (`voice = req.body`) + `userId` in `voices/{elevenLabsVoiceId}`: mass assignment. |
| `PUT /text/to/speech/v1/voices` ("Update All") | same | For every voice in the body: ownership check → ElevenLabs `/v1/voices/{id}/edit` → `update(voice)` with the **whole client object**. This is the only way "Primary" persists. |
| `DELETE /text/to/speech/v1/voice/:voiceId` | same | Ownership check (403) → ElevenLabs DELETE → Firestore delete. A provider 404 throws, so a voice already gone at ElevenLabs can never be removed from BakerRang. |
| `GET`/`POST /supermarket/licenses` | `routes/superMarket.js` | `licenses/{userId}` = `{ licenses: string[] }`. `res.status(500).send(error)` leaks raw errors. |
| `GET /vault`, `PUT /vault/settings` | `routes/vault.js` | Vault settings (owned by Passwords since Phase G). |
| `/auth/check` | `routes/auth.js:100` | Returns the **session snapshot** `{ id, displayName, email, photo }` captured at sign-in. No `Cache-Control`. |
| `POST /auth/logout` (+ legacy GET) | `routes/auth.js:110` | `req.logout()`; the host-only `connect.sid` session is shared by every app in the browser. |

### 1.3 Observed legacy defects (captures + code)

| # | Finding | Evidence |
|---|---|---|
| L1 | **Rename is a no-op.** `VoiceRow` keeps name/description in local state; "Update All" sends the context `voices`, which never receive them. Users can type a new name and nothing saves. | `VoiceRow.jsx:9–10`, `Account.jsx:70` |
| L2 | "Primary" is local until a separate **Update All**, which also calls ElevenLabs *edit* for every voice. | `VoiceRow.jsx:16`, `textToSpeech.js:114` |
| L3 | Every input is **unlabelled** (placeholder-style floating labels not associated). Observed: `labels: null` on all six. | captured probe |
| L4 | The recorder labels WebM/Opus (Chrome) or MP4 (Safari) as `audio/mp3` named `recording.mp3`. | `AudioRecorder.jsx:32`, `AddVoiceModal.jsx:136` |
| L5 | "Audio files up to 10mb each" is copy only; nothing enforces it client- or server-side. | `DropzoneWrapper.jsx`, `multer.js` |
| L6 | The page is **3,884 px** tall on desktop and **9,776 px** on a phone; ~80% of it is the Supermarket grid. | `legacy-01`, `legacy-03` |
| L7 | A draggable modal (`AddVoiceModal`) with scroll-locking body styles and no focus trap. | `AddVoiceModal.jsx:110–256` |
| L8 | Account needs the vault provider to render its third section; it shows "Set up your password vault on the Passwords page first" when there's no vault. | `Account.jsx:223` |

---

## 2. Every current setting/preference and its owner

| Setting / data | Stored at | Written by today | Read by today | Class | Phase H owner |
|---|---|---|---|---|---|
| `theme` (`light`/`dark`/`system`) | `users/{uid}.preferences.theme` + the `.bakerrang.com` `br_theme` cookie | `web-theme` in all 6 new apps (PUT + cookie) | `web-theme` (reconcile GET) | **Global** | **Shared `web-theme` behavior; Account = one UX surface** (§5) |
| Legacy theme | `localStorage.bakerrang-theme` | legacy `ThemeProvider` | legacy only | Retired with `client/` | final cleanup |
| `autoLockMs`, `inlineAutofill` | `vaults/{uid}.settings` | legacy Account, **Passwords "Vault settings"** | Passwords, legacy vault, the extension | **App-specific** | **Passwords** (§4) |
| Supermarket `licenses` | `licenses/{uid}.licenses` (**own collection**, not the user doc) | legacy Account, legacy `/supermarket` | legacy Account, legacy `/supermarket` | **Retired/dead** | nobody; removed from Account (§3) |
| Voices (`name`, `description`, `isPrimary`) | `voices/{elevenLabsVoiceId}` (+ ElevenLabs) | legacy Account | Story Book, Polyglot (new + legacy) | **Cross-app account asset** | **Account** (§7) |
| Per-device voice choice | each app's own `localStorage` key (Story Book `useNarration`, Polyglot) | Story Book, Polyglot | same | App-specific convenience | stays in those apps (unchanged) |
| Language pair (Polyglot) | Polyglot `localStorage` | Polyglot | Polyglot | App-specific | Polyglot (unchanged) |
| Identity (`displayName`, `email`, `emailLower`, `photo`) | `users/{uid}` (merge on each sign-in) + the session snapshot | `authService.checkAndStoreUser` | `/auth/check`, vault sharing lookup | Google-managed identity | read-only in Account (§6) |
| `platformRole` | `users/{uid}` | operator only | B2B platform authz | B2B, never consumer UI | untouched |

**Other preferences:** none. The `users/{uid}.preferences` map holds only `theme` in every code path. There are no
Story Book / Polyglot / Sign / Budget preferences on the user document, and **Phase H invents none.**

---

## 3. Supermarket settings removal plan (owner decision 2)

| Item | Action | When |
|---|---|---|
| New Account app | **Nothing Supermarket exists.** A static test fails the build if `supermarket`/`licenses` appears under `web/apps/account/**` (and `web/AGENTS.md` already bans it workspace-wide). | PR 2 |
| Legacy `Account.jsx` | **Delete** the SuperMarket Licenses section, the `licenses`/`isLicenseSaving` state, `getLicenses` effect, `saveLicenses`, and the `productLicenses` / `ProductLicense` imports. Legacy Account stops calling `/supermarket/licenses`. | PR 1b (legacy hotfix LH-1) |
| `ProductLicense.jsx`, `productLicenses` constant | **Kept** in PR 1b: the legacy `/supermarket` page (`SuperMarket.jsx`) doesn't use them, but deleting dead legacy files is final-cleanup work (they go with `client/`). A comment isn't added. | final cleanup |
| Legacy `/supermarket` page, tile, `SuperMarket.jsx`, `ProductCounter.jsx`, `assets/products/**` | **Unchanged** (owner decision 2). | final cleanup |
| `GET`/`POST /supermarket/licenses`, `superMarketService.js`, the `app.js` mount | **Unchanged.** Still called by the legacy `/supermarket` page, so not dead. | final cleanup (Phase 0 §11.S step 3) |
| Firestore `licenses/{uid}` | **Left dormant.** A separate collection, so no user document carries Supermarket fields and no reader breaks. No migration. | dropped at final cleanup (§11.S step 4); runbook STEP 0b records a count |
| Remaining callers after Phase H | exactly one: legacy `SuperMarket.jsx:19` (`GET`). Verified by grep: nothing in `web/`, `server/` (besides the route), `extension/` or `platform/` calls it. | — |

---

## 4. Passwords / vault settings separation plan

- **Where they live now (verified):** `web/apps/passwords/src/dialogs/VaultDialog.jsx:194` ("Vault settings": *Lock after*
  15 m / 1 h / 8 h / Never + *Browser extension fills logins on the page*) → `PUT /vault/settings`. Stored on
  `vaults/{uid}.settings`, which is a **different document** from `users/{uid}`, so no Account write can ever touch them.
- **New Account:** contains **no** vault control, no `VaultProvider`, no `/vault` request, no Passwords import. One quiet
  Session row says "Vault lock timing and browser-extension autofill are in Passwords." with a link to Passwords (the
  registry URL). Static test: no `vault`, `useVault`, `autoLock`, `inlineAutofill` or `/vault` in `web/apps/account/src/**`.
  Behavior test: Account renders fully with **no vault request made**.
- **Legacy Account (PR 1b, LH-1):** delete the "Password Vault" section and the `useVault`, `FolderSelect` and
  `AUTO_LOCK_OPTIONS` imports. Replace it with a two-line pointer ("Vault settings moved to Passwords." + a link to
  `import.meta.env.VITE_PASSWORDS_URL || 'https://passwords.bakerrang.com'`).
  **Why now, not at cleanup:** legacy Account and Passwords are two writers of `vaults/{uid}.settings`. Passwords sends the
  **whole** settings object (`useVault.js:489`), and the server merges read-then-write outside a transaction
  (`vaultService.updateSettings`), so a stale legacy tab can revert the other field. Removing the second writer closes that
  lost-update path. No rollback need for the legacy controls exists: Passwords is cut over and owns the same fields.
- `client/src/utils/vaultSettings.js` stays (the legacy vault page and `VaultProvider` still use it).
- **No duplicate setting anywhere after PR 1b.** Writers of `vaults/{uid}.settings`: Passwords only (plus the legacy
  `/passwords` page's provider, which has no settings UI of its own).

---

## 5. Global theme ownership contract (preserved, not moved)

**Contract (Phase 0 §9, verified in `web/packages/web-theme/src/index.jsx`), unchanged by Phase H:**
1. Boot paints synchronously from `br_theme` (or `system`) before React. There's no localStorage anywhere.
2. **Anonymous change:** write `br_theme` (`.bakerrang.com`, `SameSite=Lax`, 1 year, `Secure` on https) → repaint. No API.
3. **Authenticated change (any app):** write `br_theme` → repaint → `PUT /account/preferences { theme }`.
4. **Authenticated load:** `GET /account/preferences`; an explicitly stored value that differs wins, and the cookie is
   rewritten. No stored value → nothing is overwritten.
5. `system` is stored verbatim and resolved per device.

**Account's role:** Account renders the one full-size theme control (§14) and calls **only** `useTheme().setPreference`.
It contains no cookie code, no fetch of `/account/preferences` and no theme state of its own. Other apps keep their
avatar-menu `ThemeControl` and keep persisting. **Account is not the exclusive writer.** In Account the avatar menu omits
its theme control (`AccountMenu` without `themeControl`), so the same screen doesn't show two controls.

**Duplication audit:** the only duplicate theme implementation is the legacy `ThemeProvider` (localStorage, 2-state). It
is untouched (it dies with `client/`). Legacy and new themes stay independent during coexistence, as they have since
Phase C.

**Shared `web-theme` fixes (WT-1 … WT-4, PR 2, fan-out to all seven apps):** found in the audit, small, behavior-preserving:

| # | Defect (repo truth) | Fix |
|---|---|---|
| WT-1 | **Stale reconcile.** The mount GET compares the stored value with the `preference` captured at mount (`index.jsx:40`). If the user picks a theme before the GET resolves, a stale stored value overwrites the fresh choice and the cookie. | A `userChangedRef` set by `setPreference`. The reconcile result is dropped if the user changed the theme after the GET started. |
| WT-2 | **Out-of-order PUTs.** Rapid clicks fire concurrent PUTs; arrival order decides the stored value. | Serialize: at most one PUT in flight. A newer choice made meanwhile is sent after it (only the latest pending value; intermediate ones are skipped). |
| WT-3 | **Cross-tab/app staleness.** An open tab never learns that another app changed `br_theme`. | On `visibilitychange → visible` and `focus`, re-read the cookie. If it's a valid value that differs, adopt it **without a PUT** (whoever changed it already persisted it). |
| WT-4 | No save status is exposed (Account needs "Saved to your account"). | Additive context field `persistence: 'idle' \| 'saving' \| 'saved' \| 'error'` alongside the existing `persistenceError`. Existing consumers are unaffected. |

---

## 6. Identity / profile behavior

**What BakerRang has (verified):** `users/{uid}` = `{ id, displayName, email, emailLower, photo, platformRole?,
preferences? }`, merged on every Google sign-in, plus the same four profile fields in the session snapshot. **Not stored:**
creation date, last-login time, sign-in history, a second auth method. Google is the only identity provider.

| Fact | Phase H display | Why |
|---|---|---|
| Display name | **Shown**, read-only (nameplate) | Real, useful ("am I signed in as the right person?"). |
| Email | **Shown**, read-only, tagged FROM GOOGLE | Same. It's also the identity other users share folders to. |
| Photo | **Not shown.** A 52 px initials monogram (the `AccountMenu`'s initials). | Consistent with every app's avatar button. It avoids a third-party image request (Google CDN + referrer), a CSP `img-src` exception, and broken-image states. Nothing is lost: the photo remains stored. |
| Internal user id | **Never shown** | No user purpose (it's the Google profile id). |
| Member since / last sign-in | **Not shown** | Not stored. Not invented. |
| Google linkage | Inside the nameplate: an external link **"Manage your Google account"** under the email (`https://myaccount.google.com/`, fixed URL, `target=_blank rel="noopener noreferrer"`) | Name/email changes happen at Google. The copy says so. (A separate "Signed in with" row was folded into the nameplate at the finish review, so Voices starts above the phone fold.) |

**Source:** `useAuth().user` from `web-auth` (the session snapshot, the same data `checkAndStoreUser` wrote at the last
sign-in). **No new profile endpoint** is needed. Phase 0 §8's "fresh from Firestore" rule is about authorization and
preferences; display of Google-managed fields doesn't need it. Copy (one line under the nameplate): "You sign in with
Google. Change your name and email there; BakerRang picks them up the next time you sign in." **No profile editing exists
or is invented.**

---

## 7. Voices (owner decision 1): behavior

- **List:** `GET /text/to/speech/v1/voices`, sorted in the UI primary-first, then by name. Each row: name, PRIMARY tag,
  description, and text actions **Make primary** / **Rename** / **Delete** (text labels, not icons: account actions are
  ambiguous without words).
- **Add voice** (the page's one gold action) opens **in place** under the Voices head (no modal): Name (required, 1–60),
  Description (optional, ≤ 200), Samples (1–3; **Record a sample** via `MediaRecorder` with an honest `mimeType` and
  extension, or **Add audio files** `accept="audio/*"`; 10 MB each, 25 MB total, 5-minute recording cap), each sample
  playable and removable. A **required consent checkbox**: "This is my voice, or I have permission from the person
  speaking to clone it." A disclosure: "Samples go to ElevenLabs, which creates and stores the voice. BakerRang keeps the
  name and description, not the audio." (True: `multer.memoryStorage`, no GCS/Firestore copy.) **Create voice** (ink) →
  "Creating voice… This can take up to a minute."
- **Your first voice becomes primary** (server rule, §9.3).
- **Rename** edits name and description in place (Save / Cancel). This fixes legacy L1.
- **Make primary** is one immediate action (no ElevenLabs call). It fixes legacy L2.
- **Delete** confirms inline: "Delete Storyteller? It's removed from ElevenLabs too, so Story Book and Polyglot can't speak
  in it anymore. This can't be undone." → **Keep it** / **Delete**.
- **No primary** (e.g. the primary was deleted): "No primary voice. Story Book and Polyglot start with {first by name}
  until you choose one." The server never auto-promotes on delete (it matches readers' existing `isPrimary || first`
  fallback).
- **Readers are unchanged.** Story Book and Polyglot keep their per-device choice and their existing links
  (`destinations.account.url`), which reach the new app after the registry flip.

---

## 8. Auth / session behavior

| Concern | Truth | Phase H |
|---|---|---|
| Sign in | `web-auth` `login()` → `/auth/google?target=<symbolic>` → callback → `consumeOAuthTarget` → the env domain. Unknown target → 400, unset env → 500. | New target `account` → `ACCOUNT_DOMAIN`. No arbitrary redirect is possible. |
| Current session | `GET /auth/check` (session snapshot) | Adds `Cache-Control: no-store` to `/auth/check` and `/auth/csrf` (B6). No shape change. |
| Expiry | Cookie `maxAge` 1 week; server store TTL = cookie expiry | Nothing claims a duration. |
| CSRF | Global double-submit on authenticated mutations; `web-api-client` fetches `/auth/csrf` and retries once on 403 | Reused unchanged. Multipart voice uploads carry the header too (`web-api-client` passes `FormData` through). |
| Cross-app session | Host-only `connect.sid` on `api.bakerrang.com`, `SameSite=Lax`, shared by every app in a browser | Unchanged. |
| Auth polling | `web-auth`: 60 s while visible + on `visibilitychange` | Unchanged. Account relies on it (no extra polling). |
| Sign out | `AccountMenu` → `auth.logout()` → `POST /auth/logout` | Account's **Session** section also has **Sign out**, calling the **same** `auth.logout`. It's justified because Account is the account-control page and the menu is a tiny target on phones. Copy: "Signing out here signs you out of every BakerRang app in this browser. Other devices stay signed in." (True: logout clears this session; other browsers keep theirs.) If an Add-voice or rename editor is dirty, an inline "Discard …?" guard runs first (the Budget pattern). |
| Sign out everywhere | **Not possible today**: session docs store `JSON.stringify(sess)` with no indexed user field (`firestoreSessionStore.js:43`) | **DEFER** (needs a session-schema change + TTL policy). Not shown. |
| Account-specific session system | — | **None.** |

---

## 9. Backend / API contracts

### 9.1 `/account` mount
`app.use('/account', noStore, accountLimiter, isAuthenticated, accountRouter)`:
- `noStore` first, so 401/400/5xx also carry `Cache-Control: no-store`.
- New `accountLimiter`: 300 / 15 min per IP (every app's theme GET on load + PUTs), `{"error":"Too many requests. Please wait a moment."}`.
- Signed out → `401 {"isAuthenticated":false,"message":"User not authenticated"}` (unchanged).
- 5xx → **`500 {"error":"Account request failed"}`**. Log `console.error('[account] <route-id> failed', { code, name })` only.
  No bodies, ids or emails. (Replaces `next(error)`.)

| Route | Auth / CSRF | Request | Validation | Response | Ownership / persistence | Concurrency |
|---|---|---|---|---|---|---|
| `GET /account/preferences` | session; GET (no CSRF) | — | — | `200 {theme}` when stored and valid, else `200 {}` | reads `users/{req.user.id}` fresh | — |
| `PUT /account/preferences` | session + CSRF | `{ "theme": "light"\|"dark"\|"system" }` **exactly** | any other key, missing or invalid value → `400 {"error":"theme must be light, dark, or system"}` (unchanged) | `200 {theme}` | transaction merge-writes **only** `preferences.theme`. Every other `preferences.*` key and every other user field (`platformRole`, profile) is preserved. | Last write wins on one enum (intended: the latest click). Client ordering is fixed by WT-2. |

**No generic preferences blob.** The API validates the one known global key. Unknown **stored** legacy keys under
`preferences` are preserved on write and never returned by GET. A future global preference adds a named, validated key
here. It never widens to arbitrary keys.

### 9.2 Voice routes (the TTS router; `voices` is Account-owned data)
All under the existing `app.use('/text/to/speech', isAuthenticated, textToSpeechRouter)`. **Every voice route gets
`noStore`.** `:voiceId` must match `^[A-Za-z0-9_-]{1,64}$` → else `400 {"error":"Invalid voice"}`. Ownership is
`userCanAccess(uid, voiceId, 'voices')` (structural `userId` field). The **new** routes answer a missing or foreign voice
with **`404 {"error":"Voice not found"}`** (no existence leak); legacy routes keep their 403.
Provider failures are logged via `logProviderError(scope, err)` (`{status, code, name}` only; never voice names, bodies or
the API key) and answered with fixed messages.

**Sanitized voice shape (`VoiceRecord`):** `{ id, name, description, isPrimary }`. `description` is `''` when absent;
`isPrimary` is `true` only when stored `=== true`. It's built field by field, never a spread.

| Route | Change | Contract |
|---|---|---|
| `GET /v1/voices` | **harden** | `200 VoiceRecord[]` (drops `userId` and any stray fields). Every reader (new Story Book, Polyglot, legacy) uses only `id`, `name`, `description`, `isPrimary`. Verified. |
| `POST /v1/voice` (create) | **harden** (same path, legacy-compatible) | `multipart/form-data`: `name`, `description?`, `consent?`, `files` (1–3). A new `voiceUpload` multer: `limits { files: 3, fileSize: 10 MiB, fields: 6, fieldSize: 2 KiB }`, `fileFilter` allowlist `audio/mpeg audio/mp3 audio/wav audio/x-wav audio/wave audio/webm audio/ogg audio/mp4 audio/x-m4a audio/aac audio/flac audio/x-flac` (after stripping `;codecs=…`). Total > 25 MiB → `413 {"error":"Samples are too large","field":"files"}`. Other failures → `400 {"error":"Invalid voice","field":"name\|description\|files"}`: name trimmed 1–60; description trimmed ≤ 200; 0 files, > 3 files or a bad type. **Create only when no `id`** is in the body. A body `id` keeps the legacy edit-with-files path (ownership-checked, as today). The doc is written as exactly `{ id, userId, name, description, isPrimary, createdAt, updatedAt, consentConfirmedAt? }` (`consentConfirmedAt = Date.now()` when `consent === 'true'`; the server doesn't *require* consent, because legacy's Add Voice doesn't send it until legacy retires). **`isPrimary = true` iff the user had zero voices.** Provider failure → `502 {"error":"Voice couldn't be created"}`, nothing stored. Response `200 VoiceRecord` (200 kept for the legacy client). New `voiceCreateLimiter` 20 / hour / user. |
| `PATCH /v1/voices/:voiceId` | **new** | Body `{ name?, description? }` (≥ 1 known key, else 400; unknown keys ignored). Same bounds. Calls ElevenLabs edit with the resulting name + description (the provider requires a name), then merge-writes only `name`, `description`, `updatedAt`. Provider failure → `502 {"error":"Voice couldn't be renamed"}`, Firestore unchanged. `200 VoiceRecord`. LWW (two tabs renaming the same voice: the later save wins, which is acceptable for a label). `voiceEditLimiter` 60 / 15 min / user. |
| `PUT /v1/voices/primary` | **new** | Body `{ voiceId }`. Query the user's voice ids (`where userId ==`), then **one transaction**: `getAll` those refs → the target must exist and be owned, else 404 → set `isPrimary` true on the target and false on every other existing one (merge, skipping any doc deleted meanwhile, never recreating it). No provider call. `200 VoiceRecord[]`. Idempotent. Invariant: **at most one primary**, and exactly one after success. A voice created concurrently can't be primary (the first-voice rule needs zero voices). `voiceEditLimiter`. |
| `DELETE /v1/voice/:voiceId` | **harden** | Drop the stray `multipart.array` middleware. **A provider 404 counts as already gone**, and the Firestore doc is still deleted (fixes stuck voices). Other provider failures → `502 {"error":"Voice couldn't be deleted"}`, doc kept. `200 {"success":true}` (the legacy `message` field is kept too for legacy). No auto-promotion. `voiceEditLimiter`. |
| `PUT /v1/voices` ("Update All") | **legacy only, harden** | The same, but each stored write whitelists `name`, `description`, `isPrimary` (no mass assignment). Removed at final cleanup. |
| `POST /v1/speech-tokens`, `GET /v1/speech/:token`, `GET /v1/convert/:voiceId`, `/v1/languages`, `/google/transcribe` | unchanged | Story Book / Polyglot. |

**Test seam:** `textToSpeechService.js` gains `_setDb(db)` (the budget/lead pattern). `_setHttpClient` already exists.

### 9.3 Server change list (PR 1)
| # | Change | Where |
|---|---|---|
| B1 | `/account` mount: `noStore` + `accountLimiter`; fixed 5xx + fixed-shape logs | `app.js`, `routes/account.js`, `middleware/security.js` |
| B2 | Voice read sanitizer + `noStore` on voice routes | `routes/textToSpeech.js`, `services/textToSpeechService.js` |
| B3 | `voiceUpload` multer (limits + allowlist + 25 MiB total) and create validation, doc whitelist, first-voice-primary, `consentConfirmedAt`, `voiceCreateLimiter` | `multer.js` (new named export), `routes/textToSpeech.js`, service |
| B4 | `PATCH /v1/voices/:voiceId`, `PUT /v1/voices/primary`, `voiceEditLimiter` | same |
| B5 | Delete: provider-404-is-success, fixed errors; Update All whitelist | same |
| B6 | `noStore` on `/auth/check` and `/auth/csrf` | `routes/auth.js` |
| B7 | OAuth target `account: 'ACCOUNT_DOMAIN'`; CORS `env.ACCOUNT_DOMAIN`; `.env.example` `ACCOUNT_DOMAIN=` (local `http://localhost:3060`) | `config/oauthTargets.js`, `config/origins.js` |
| B8 | `_setDb` seam in the TTS service | service |

No Firestore index change (`where userId ==` is single-field; `userCanAccess`'s two equalities merge automatically).

---

## 10. Preference persistence and concurrency model

- **Theme:** one server-side enum with last-write-wins; client-side ordering via WT-2; stale reconcile guarded by WT-1;
  cross-tab/app convergence on focus via WT-3; cross-device on next load (the backend wins when stored). An anonymous
  choice lives only in the cookie.
- **Coexistence safety (tested):** `PUT /account/preferences` touches only `preferences.theme`, so (a) vault settings
  (`vaults/{uid}`) can't be touched, (b) `platformRole`/profile survive, (c) unknown `preferences.*` keys survive, and
  (d) Supermarket data isn't on this document. Nothing replaces a whole object anywhere in the Account write paths.
- **Voices:** separate documents. Create is non-idempotent (a lost response could lead to a duplicate clone), so the UI
  shows the "couldn't confirm" state and asks for a refresh before retrying (§15). Rename is LWW. Make-primary is a
  transaction. Delete is idempotent from the user's view (provider 404 = done).
- **Legacy coexistence:** legacy Account keeps Cloned Voices until final cleanup. Its "Update All" is LWW over whole
  voices (whitelisted now), and it can overwrite a new-app rename if a stale legacy tab saves. That's documented (R2), and
  the new app refetches voices on `visibilitychange` after ≥ 60 s when no editor is open.

---

## 11. Keep / Move / Retire / Defer matrix

| Legacy Account feature | Verdict | Where / why |
|---|---|---|
| Cloned Voices: list | **KEEP** | Account (owner 1) |
| Add voice (upload + record) | **KEEP + IMPROVE** | In place, labelled, consent, honest MIME, enforced limits |
| Rename voice | **KEEP + FIX** | Legacy was a no-op (L1); new `PATCH` |
| Primary voice | **KEEP + FIX** | Immediate `PUT primary`, no provider round trip (L2) |
| Delete voice | **KEEP + IMPROVE** | Inline confirm; provider-404 handling |
| "Update All" | **RETIRE** (new app) | Replaced by per-action saves; the legacy route stays until cleanup |
| SuperMarket Licenses | **RETIRE** | Removed from new + legacy Account (owner 2) |
| Password Vault settings | **MOVE TO APP** (done in Phase G) | Passwords "Vault settings"; removed from legacy Account (LH-1) |
| Theme | **KEEP (global)**: one surface in Account, behavior in `web-theme` | §5 |
| Identity display | **ADD (read-only)** | §6 |
| Sign out | **KEEP (shared mechanism)** + a Session section | §8 |
| Sign out everywhere | **DEFER** | §8 |
| Delete account / purge / export / download data | **DEFER** | §12 |
| Email change / Google unlink | **Not applicable** | Google-managed |
| Notifications, app prefs | **None exist; none added** | — |
| Legacy draggable modal, glass cards, 26-card grid | **RETIRE** | §19 |

---

## 12. Account lifecycle (deletion / export): DEFER, deliberately

**Nothing exists** (verified: no consumer route, service or UI deletes or exports a user; `tenantDeletionService` /
`tenantExportService` are B2B tenant tools). Deletion semantics would have to cover, at minimum:
`users/{uid}`; `sessions/*` (unindexed by user); `vaults/{uid}` + `items`/`folders`/`audit`; `vault_shares` as **owner and
recipient** (recipients lose access; owners' folders shared *to* the user must be revoked); `budget/{uid}`;
`storybooks` (+ their images); `voices/*` + **ElevenLabs** deletion; `licenses/{uid}`; legacy WoW data; and **B2B**
`tenants/*/members/{uid}` + `platformRole` (a PLATFORM_ADMIN or tenant OWNER can't simply vanish). Export would need
Passwords (ciphertext only, or KeePass export in-browser), Budget, Story Book and voices at minimum.

That isn't deterministic today, so **Phase H builds neither** and Codex must not invent either. Account says, in one
honest row: "Deleting your BakerRang account or downloading a copy of your data isn't available yet." It's recorded as a
future phase (R3), not final-cleanup work.

---

## 13. Privacy / security

| Area | Audit | Phase H |
|---|---|---|
| PII in query strings | None on Account/voice routes. | Kept. Voice text only in POST bodies (unchanged speech-token design). |
| Raw provider errors | Voice routes already redact (`logProviderError`); `/account` used `next(error)`; Supermarket leaks (`send(error)`). | `/account` fixed (B1). Supermarket untouched (cleanup). |
| Email logging | `checkAndStoreUser` logs the **user id**, not email. | Unchanged. New logs carry no ids or emails. |
| Caching | `/account/preferences` 200-only `no-store`; voices none; `/auth/check` none. | Mount-level `noStore` (B1), voice routes (B2), auth (B6). The SW never caches the API (`runtimeCaching: []`). |
| Browser storage | Account needs none. | **No** localStorage/sessionStorage/IndexedDB/Cache writes by Account code; only `br_theme` (via `web-theme`). Recorded samples live in memory (Blob URLs revoked on remove/close/unmount). Tested. |
| Profile image URL | Legacy loads the Google photo. | Not rendered (§6). `img-src 'self' data:` stays strict. |
| Redirects | Symbolic OAuth targets only. | `account` added. Tested: unknown → 400. |
| Destructive confirmation | Voice delete → inline confirm with consequence. No account deletion. | §7 |
| CSRF | Global double-submit. | All new mutations (PATCH, PUT primary, multipart POST) covered. Tested with a missing token → 403. |
| CORS | Exact allowlist. | `ACCOUNT_DOMAIN` added (B7). Tested. |
| Rate limits | None on `/account` or voice writes. | `accountLimiter`, `voiceCreateLimiter`, `voiceEditLimiter` (B1, B3, B4). |
| Upload DoS | Unlimited in-memory multer. | Limits + allowlist + total cap (B3). |
| Mass assignment | Voice create and Update All store client objects. | Whitelisted (B3, B5). |
| Consent | None. | Required in UI; `consentConfirmedAt` recorded when sent. The server doesn't enforce it (legacy compat) until cleanup, and that isn't overclaimed. |
| Headers | Consumer apps use the shared nginx config (no CSP) except Passwords. | Account gets `web/nginx/apps/account.conf` (§16.2). |

**Claims Account may make:** "Your name and email come from your Google account." "Samples go to ElevenLabs, which creates
and stores the voice. BakerRang keeps the name and description, not the audio." **Never:** "your data is private/secure",
"we never store your voice" (ElevenLabs does), anything about deletion or export.

---

## 14. Final information architecture

```
┌ bar 58: B | Account ··························································· switcher · avatar ┐
│   Account (Expanded 800)                                                                        │
│   Who you're signed in as, how every BakerRang app looks, and the voices Story Book and …       │
│ ┌ rail 200 (sticky) ┐   ┌ sheet 680 ─────────────────────────────────────────────────────────┐ │
│ │ │ Profile         │   │ Profile ───────────────────────────────────────────────────────────  │ │
│ │   Appearance      │   │ [SE] Sam Example / sam.example@example.test  FROM GOOGLE             │ │
│ │   Voices          │   │      Manage your Google account ↗   (one hint line below)            │ │
│ │   Session         │   │ Appearance ────────────────────────────────────────────────────────  │ │
│ │ ───────────────── │   │ Theme            [ Light | Dark | System ]                           │ │
│ │ Settings that     │   │ Applies to       [B][SB][PG][SG][BD][PW]  ✓ Saved to your account.    │ │
│ │ belong to one app │   │ Voices 2 ─────────────────────────────────────────── [+ Add voice]  │ │
│ │ live in that app. │   │ My voice PRIMARY · Recorded at my desk          Rename  Delete       │ │
│ └───────────────────┘   │ Storyteller · Slower, warmer read    Make primary  Rename  Delete    │ │
│                         │ Session ───────────────────────────────────────────────────────────  │ │
│                         │ App settings     Vault settings are in Passwords → Open              │ │
│                         │ Your data        Deletion and export aren't available yet.           │ │
│                         │ ═══ (12px space + line-strong rule; Sign out last, set apart) ═══    │ │
│                         │ Signed in        sam@… on this browser                    Sign out   │ │
│                         └──────────────────────────────────────────────────────────────────────┘ │
phone ≤760: no rail; one column; rows stack label over value; Add voice full width under the Voices head.
```

- **Routes:** `/` (everything) and `*` → Not found ("That page isn't in Account." → Back to Account). React Router 6 for
  parity. Sections are in-page anchors (`#profile`, `#appearance`, `#voices`, `#session`), so Story Book / Polyglot links
  may target `…/#voices` later without a new route. (**The registry isn't changed to add a hash in Phase H.**)
- **Signed out:** Welcome ("Your BakerRang account." + gold Sign in with Google + three ruled fact rows) **and a working
  Appearance section**, since anonymous theme changes are part of the contract ("Saved in this browser. Sign in to keep it
  on every device.").
- **Component map (`web/apps/account/src/`):** `App.jsx` (auth gate; bar via `BrandLink appName='Account'`,
  `AppSwitcher current='account'`, `AccountMenu` **without** `themeControl`) · `AccountSheet.jsx` (head + rail + sections) ·
  `SectionRail.jsx` (IntersectionObserver scroll-spy, `aria-current="location"`) · `profile/ProfileSection.jsx` ·
  `appearance/{AppearanceSection,ThemeChoice,Relay}.jsx` · `voices/{VoicesSection,VoiceRow,AddVoiceEditor,RenameEditor,
  DeleteConfirm,SampleList,useRecorder}.js(x)` · `voices/useVoices.js` (load, op tokens, refetch-on-visible) ·
  `api/voices.js` (typed wrappers, `VoiceApiError {status, field}`) · `session/SessionSection.jsx` · `Welcome.jsx` ·
  `NotFound.jsx`. **Nothing graduates to `web-ui`** (the graduation rule: no second app renders these identically). The
  `AppSwitcher` needs `current='account'` highlighting of its separate Account item: a one-line `web-app-shell` addition
  (`aria-current="page"` on the Account item when `current === 'account'`).

---

## 15. Save behavior and async states

| Thing | Save model | States (copy locked) |
|---|---|---|
| Theme | **Immediate** (shared contract) | "Every BakerRang app on this browser uses it." · saving "Saving to your account…" · saved "Saved to your account. Your other devices pick it up the next time they open BakerRang." · error (role=alert) "Changed on this browser, but not saved to your account. Your other devices won't pick it up yet." + **Try again** (re-calls `setPreference(preference)`) · anonymous "Saved in this browser. Sign in to keep it on every device." |
| Make primary | **Immediate** single action | Row `aria-busy`; success announces "Storyteller is now your primary voice."; failure: an inline row message "Couldn't change your primary voice. Nothing was changed." |
| Rename | **Explicit** Save / Cancel | "Saving…"; empty name → "Give the voice a name."; 502 → "Couldn't rename the voice. Nothing was changed."; 404 → "This voice was deleted somewhere else." → remove from view |
| Add voice | **Explicit** Create voice | Validation (name, samples, consent; focus moves to the first error; each message is `aria-describedby` on its field); creating (form `aria-busy`, fields disabled, Cancel disabled: the provider may already be working); 502 "ElevenLabs couldn't create the voice. Nothing was saved. Try again."; 413 "Those samples are too large. Keep each under 10 MB."; network loss/timeout → **"Account couldn't confirm the new voice. It may still have been created. Refresh your voices to check before you try again, so you don't clone it twice."** + **Refresh voices** (never an automatic retry) |
| Delete | **Explicit** inline confirm | "Deleting…"; 502 "Couldn't delete the voice. Nothing was changed." |
| Recording | — | "Recording · 0:42 of 5:00" (live region announces start/stop only); auto-stop at 5:00; mic denied (role=alert) "Account can't use your microphone. Allow it in your browser's site settings, or add audio files instead."; unsupported → Record hidden, files only. The mic stops on Stop, Cancel, sign-out, `pagehide` and unmount. |
| Page | — | Checking auth > 300 ms "Opening Account…"; voices loading = two quiet skeleton rows + sr "Loading your voices…"; voices failed "Account couldn't load your voices." / "Nothing was changed. Check your connection, then try again." + Try again; empty "No voices yet." / "Clone your voice from a short recording, and Story Book and Polyglot can read aloud in it."; offline ruled notice "You're offline. You can look around, but changes can't be saved until you're back." (Add voice `aria-disabled`) |

**One editor at a time** (Add voice, or one rename, or one delete confirm). Opening another asks to discard a dirty one.
**Stale responses:** every voice op carries an op token and an auth epoch. Results are dropped if the user signed out or a
newer op on the same voice started. **Auth loss** (`web-auth` → ANONYMOUS): editors close, voices clear, Welcome shows. An
unsaved rename or Add voice is lost (documented; the recorder stops). **401 on a write** → `auth.refresh()`.

---

## 16. Design rationale and visual contract

### 16.1 Direction
Direction contract: [`web/.impeccable/surfaces/account.md`](../../web/.impeccable/surfaces/account.md). **Account is the
control room for BakerRang itself**, so it's the quietest app in the family: no desk (Story Book), no dock (Polyglot), no
finder (Sign), no ledger (Budget), no three-pane vault (Passwords). It's a **specification sheet**: a quiet section rail
beside one column of labelled rows on hairline rules. The comp is the contract for layout, states and copy. Where the comp
and this document disagree on behavior, this document wins.

- **Colour:** world tokens only. **Gold fills Add voice** (and Sign in with Google when signed out). That's the one gold
  per surface, per the world's Reserved Gold Rule, unlike Passwords' scoped exception. **Commits are ink** (Create voice,
  Save), as in Budget. **Account Grey** (`--accent-account` `#A5A59C` / `#63625a`, already in `web-tokens`) marks only the
  emblem and the rail's current section (a 1px rule). Danger text only for Delete and Sign out. Validation is Ink + a drawn
  icon + a message (the Budget Ink-Not-Red rule).
- **Type:** Archivo; Archivo Expanded for "Account", section names, the nameplate name, editor titles and the Welcome
  masthead. Kind tags (PRIMARY, FROM GOOGLE) are small caps.
- **Structure:** no panels or cards. Section heads are an Expanded name over a `line-strong` rule, and rows are `label (172px) |
  value` on Line rules. Editors and the delete confirm open **in place** as a Plane band (the Budget One Editor rule),
  all bleeding one shared 12px past the sheet edge. **Session ends with Signed in / Sign out**, set apart by 12px of
  space and a single `line-strong` rule (the row above drops its own rule, so it never doubles).
- **Theme choice (Account-scoped rule):** the world segmented control, with the checked segment carrying Plane 2 **+ 700
  weight + a 1px Ink 3 border** (≈4.5:1 light / 5.6:1 dark against the track), so selection isn't tone-only. The shared
  `ThemeControl` in other apps' avatar menus still relies on tone (follow-up R9).
- **Signature: the Relay.** Under the theme choice, six 36px hairline (`--line`) tiles (Launcher mark, Story Book, Polyglot, Sign, Budget,
  Passwords emblems in their own accents), read as ground samples and not buttons, show that one switch reaches every app. On a theme change the sheet repaints
  **at once** (no page cross-fade: a fade lets re-rendered ink reach its new colour before the ground and collapses
  contrast), and only the tiles move, taking the new ground one after another, 40 ms apart, 160 ms each. Reduced motion → they change together
  instantly. It's a `<ul>` labelled "Applies to", each tile carrying its app name for AT.
- **Legacy descent (§19):** what survives is the grouping of voice facts per row and the voice-first emphasis. The glass
  cards, the icon-tile headers and the draggable modal don't.

### 16.2 Browser security (`web/nginx/apps/account.conf`, served only by `web-account`)
It reuses Phase G's per-app nginx mechanism (no redesign). Every `location` repeats, with `always`:
```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  media-src 'self' blob:; font-src 'self'; connect-src 'self' https://api.bakerrang.com; manifest-src 'self';
  worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=(), usb=(), clipboard-read=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```
There's no `'wasm-unsafe-eval'` (Account has no WASM). `media-src blob:` is needed for sample playback. The theme boot is
emitted as `/theme-boot.js` exactly as Passwords does (`vite.config.js` `emitFile` + a `<script src>` injected first in
`<head>`), so no inline script exists. `connect-src` must equal the build-time `VITE_API_BASE_URL` (a CI test).

---

## 17. Responsive / mobile contract; PWA decision

- **≥ 1061 px:** rail 200 + sheet ≤ 680 inside a 920 column; the rail is sticky (top 82). **761–1060:** rail 168, label
  column 150. **≤ 760 (390 × 844 reference):** no rail; rows stack label over value; the theme choice spans the width
  (three 44px segments); **Add voice** is full width (48px) under the Voices head; voice actions wrap under the row at
  44px; editor fields go one column with a full-width foot; Sign out left-aligned under the email. The viewport meta has
  `interactive-widget=resizes-content`. **No horizontal overflow from 360 to 430** (tested: `scrollWidth ≤ clientWidth`).
  Identity takes one nameplate row. The profile never dominates the screen.
- **PWA: yes**, the ecosystem standard: every extracted consumer app is an installable PWA with its own identity, and
  omitting one makes Account the lone exception in the switcher. `ACCOUNT_PWA_OPTIONS`: `registerType:'autoUpdate'`,
  `id:'/'`, `name:'Account — BakerRang'`, `short_name:'Account'`, `description:'Your BakerRang profile, theme and voices.'`,
  `start_url:'/'`, `scope:'/'`, `display:'standalone'`, `theme_color`/`background_color` `'#161514'`, maskable 192/512;
  Workbox `globPatterns: ['**/*.{html,css,js,woff2,png,ico,webmanifest}']`, `navigateFallback:'index.html'`,
  **`runtimeCaching: []`** (no API caching, no voice data). Icons are rasterised from `account-icon.svg` by an app-local
  `scripts/generate-icons.cjs` (cloned from Passwords), with the canonical logo composited. Provenance goes in
  `apps/account/ASSETS.md`.

## 18. Accessibility contract

- Landmarks: bar `<header>`; `<main>`; `<nav aria-label="Account sections">` (links with `aria-current="location"`);
  each section is a `<section aria-labelledby>` with an `<h2>`; `<h1>` "Account".
- Theme: a native `<input type="radio">` group in `role="radiogroup" aria-labelledby="Theme"`. Arrow keys follow native
  radio behavior. Visible labels with drawn icons (`aria-hidden`).
- Voices: `<ul aria-label="Your voices">`. PRIMARY is text. Each action is a text button with an `aria-label` naming its
  object ("Make Storyteller your primary voice", "Rename Storyteller", "Delete Storyteller"). Sample Play/Remove are icon
  buttons with names ("Play Recording 1", `aria-pressed`) and 44px on phone.
- Forms: every field has a `<label for>`; errors are `aria-describedby` + `aria-invalid`; the consent checkbox is a
  native checkbox; Samples is a `<fieldset><legend>`; `aria-busy` while saving.
- Focus: opening an editor focuses its first field; the delete confirm focuses its question (`tabindex -1`); Cancel/Keep
  it/Save return focus to the row's control; after Create, focus goes to the new voice's Rename button; after Sign out, to
  the Welcome `<h1>`. The focus ring is the world's 2px Gold Text outline. No modals exist, so there's no trap. The avatar
  and switcher popovers return focus on Esc.
- One polite `role="status"` region ("Theme set to Dark. Saved to your account.", "Storyteller is now your primary voice.",
  "Saved …", "Deleted …", "Voice created: …", "Recording started/added."); errors `role="alert"` in context.
- Non-colour: PRIMARY / FROM GOOGLE are words; status lines have words + icons; the rail's current item is weight + a rule.
- Touch ≥ 44px on phone for every control. Reduced motion: the Relay, editor rise and repaint are instant.
- The external Google link says "(opens in a new tab)" to AT.

---

## 19. Legacy design inheritance

**Worth keeping:** voices as the page's substance; name + description per voice; Primary as a visible per-voice mark;
the two ways to add samples (drop a file / record); the "sample quality over quantity" guidance (reworded to "One or two
minutes of clear speech in a quiet room works best").
**Dated / monolith-bound:** glass cards with gold icon-tile headers (the banned icon+heading+subtitle block ×3); a
Supermarket grid that was 80% of the page; an always-editable table of voice inputs that didn't save; gold on four buttons
at once; red filled Delete buttons; a draggable modal; 12px secondary copy at low contrast; a 9,776 px phone page.
**Density/hierarchy:** three sections that had just accumulated with no order of importance, and nothing about who you
are. **Mobile:** header buttons wrap ("Update / All"), and the voice rows stack into tall cards.
The new sheet keeps the purpose and drops the chrome: it's one page of about 1,550 px on desktop and 1,960 px on a phone.

---

## 20. Registry / navigation ownership (locked)

- Account is **not a tool**: it stays out of `TOOL_DEFINITIONS` and the switcher grid. It keeps its existing entry
  points: the `AppSwitcher`'s separated "Account" item, the `AccountMenu`'s "Account" item (every app), the Launcher's
  "Your account" row, and Story Book / Polyglot voice links. **No Launcher tile.**
- `ACCOUNT_DEFINITION` (`web-app-shell`) keeps `legacyPath:'/account'`, `envKey:'VITE_ACCOUNT_URL'`, and `liveUrl:null`
  until the flip PR sets `'https://account.bakerrang.com'`.
- The Launcher "Your account" description changes from "Profile, security and preferences for every BakerRang tool." to
  **"Your profile, theme and voices for every BakerRang tool. Also in your avatar menu, top-right."** ("security"
  overclaimed: there are no security controls.) Launcher-only (PR 2).
- Naming, validated with no conflicts (grep of `scripts/ci`, `.github/workflows`, `web/`, `server/config`):
  `web/apps/account`, `@bakerrang/web-account`, logical `web-account`, Cloud Run `bakerrang-web-account`,
  `https://account.bakerrang.com`, OAuth target `account`, `ACCOUNT_DOMAIN`, `VITE_ACCOUNT_URL` (already the registry key),
  token `--accent-account` (exists), emblem `account` (exists). Dev **3060**, preview **4179**, `npm run dev:account`.

## 21. CI / CD / deployment (reuse; no redesign)

| Mechanism | Change |
|---|---|
| `web/apps/account` | Deps: the shared packages + `react-router-dom@6.28.0`. **No new third-party dependency.** |
| `web/package-lock.json` | `npm run relock` (Docker/Linux). |
| `web/Dockerfile` | deps stage `COPY apps/account/package.json …`. The runner stage already selects `nginx/apps/$APP.conf` when present (Phase G). |
| `web/nginx/apps/account.conf` | new (§16.2). |
| `scripts/ci/classify-changes.mjs` | `ALL_WEB_SERVICES` += `'web-account'` (7); `{ prefix:'web/apps/account/', ci/deploy:['web-account'] }`; `{ exact:'web/nginx/apps/account.conf' → web-account }` before the `web/nginx/` fan-out; outputs `web_account`, `deploy_web_account`. |
| `ci.yml` | a `web-account` build + Docker packaging (`--build-arg APP=account --build-arg VITE_OAUTH_TARGET=account`) + a header smoke (CSP, `X-Frame-Options`, `nosniff`, Permissions-Policy `microphone=(self)` on `/` and `/nope`); into `ci-passed`. |
| `deploy.yml` / `_deploy-cloud-run.yml` | the `web-account` option/job/case (`WEB_ACCOUNT_SERVICE`, `ACCOUNT_BASE_URL`, `image_name="web-account"`, SPA-shell assertion) + a post-deploy header assertion. |
| `stale-deploy-guard.mjs`, `rollback.yml`/`rollback.ps1`, `verify-live.yml`/`verify-live.ps1` | `web-account` wherever `web-passwords` appears (`{ Logical='web-account'; Service='bakerrang-web-account'; Package='web-account'; ExpectedSa='bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' }`), + `AccountHeaders`. |
| Tests | classifier: account-only → `web-account`; `account.conf` → only `web-account`; `web/packages/**` and `web/nginx/nginx.conf` → **all seven** (launcher, storybook, polyglot, sign, budget, passwords, account); `server/` → api only; `client/` → client only. Plus deployment-workflow, stale-guard, rollback and verify-live tests. |
| GitHub `production` Environment | `WEB_ACCOUNT_SERVICE=bakerrang-web-account`, `ACCOUNT_BASE_URL=https://account.bakerrang.com`. |
| Immutable SHA / WIF | Unchanged: `…/web-account:<sha>`, deploy by digest, scoped `roles/run.developer` on `bakerrang-web-account` only. |

**Fan-out:** PR 2 touches `web/packages/web-theme` (WT-1…4) and `web-app-shell`, so it redeploys all seven web apps. That's
the intended shared-package behavior.

## 22. Coexistence, deployment and cutover

| Entry | Before the flip | After the flip |
|---|---|---|
| Every `AccountMenu` / `AppSwitcher` Account item, the Launcher row, Story Book/Polyglot voice links | `https://bakerrang.com/account` | `https://account.bakerrang.com` |
| Legacy `bakerrang.com/account` | working: voices only, + the vault pointer (LH-1) | unchanged, reachable by URL; retired at final cleanup |
| Legacy `/supermarket` + backend | unchanged | unchanged (final cleanup) |
| Apex, other apps | unchanged | unchanged (the flip redeploys them with no behavior change) |

1. **PR 1: server** (B1–B8) + `node:test` suites + `.env.example`. Deployable alone. Legacy and the new apps are unaffected
   (the response shapes readers use are unchanged; legacy create still gets 200 + a voice).
2. **PR 1b: legacy hotfix LH-1** (client only): remove Supermarket Licenses and Password Vault sections from
   `Account.jsx` (+ imports/state/effects), add the vault pointer. Deploys `client`. Independent of PR 1, in either order.
3. **PR 2: app + shared fixes + CI + Launcher copy + runbook:** `web/apps/account`, `nginx/apps/account.conf`, WT-1…4,
   the `web-app-shell` `current='account'` line, classifier/workflows/rollback/verify-live, the Launcher row copy,
   `docs/apps/Account-PhaseH-Runbook.md`. `liveUrl` stays `null`.
4. **Operator runbook** → first deploy via CI → verify on `run.app` (incl. headers) → map `account.bakerrang.com` → DNS.
5. **Live acceptance** (§25) directly on `account.bakerrang.com`.
6. **PR 3: flip** `ACCOUNT_DEFINITION.liveUrl` (+ `index.test.jsx`); all seven redeploy.
7. **Rollback:** `rollback.yml` for `web-account`; revert PR 3 to restore the legacy destination (legacy Account still
   manages voices); revert PR 2's WT changes independently if needed (they're additive); revert PR 1 only after PR 3.
   **Data needs nothing:** `consentConfirmedAt`/`createdAt`/`updatedAt` are additive, and legacy ignores them.

### 22.1 Runbook specification (`docs/apps/Account-PhaseH-Runbook.md`, written in PR 2)
Clone the Passwords runbook's structure and voice exactly (PowerShell, copy-pasteable, expected output after each check).
Targets: `web-account` / `bakerrang-web-account` / `https://account.bakerrang.com` / `bakerrang-api` /
`avian-cable-379805` / `us-west1` / runtime SA `bakerrang-frontend@…`.
- **STEP 0** variables (`$AccountService='bakerrang-web-account'`, `$AccountHost='account.bakerrang.com'`,
  `$AccountBaseUrl='https://account.bakerrang.com'`, `$ApiService='bakerrang-api'`, `$Project`, `$Region`,
  `$FrontendRuntimeSa`), `gcloud config get-value project`, `gcloud auth list`. **STEP 0b** optional read-only **counts**
  (`voices` docs; `licenses` docs for the cleanup record; count aggregation only, never document reads).
- **STEP 1** `gh variable set WEB_ACCOUNT_SERVICE --env production --body $AccountService`; `ACCOUNT_BASE_URL`; `gh variable get` both.
- **STEP 2** after PR 1 is live: `gcloud run services update $ApiService --region $Region --update-env-vars
  "ACCOUNT_DOMAIN=$AccountBaseUrl"` (never remove existing vars) + `describe` verify.
- **STEP 3–5** bootstrap `bakerrang-web-account` from the current `bakerrang-web-passwords` image
  (`--service-account $FrontendRuntimeSa --port 8080 --allow-unauthenticated`); copy `roles/run.developer` members from
  `bakerrang-web-passwords` onto `bakerrang-web-account` only; verify SA-user. No project-wide roles.
- **STEP 6** merge PR 2 → normal deploy; `gh run watch`.
- **STEP 7** `run.app`: shell 200 + `<div id="root"`, `/nope` → shell, manifest "Account — BakerRang", `sw.js`, the exact
  header set on `/` and `/nope` (`Invoke-WebRequest -Method Head`), `theme-boot.js` served, no inline `<script>`.
- **STEP 8** API: `OPTIONS`/`GET https://api.bakerrang.com/account/preferences` and `/text/to/speech/v1/voices` with
  `Origin: https://account.bakerrang.com` → ACAO echoes with credentials; the 401 carries `cache-control: no-store`.
- **STEP 9–11** domain mapping (**never apex**), DNS records, certificate `Ready` loop.
- **STEP 12** direct-host acceptance (§25) as numbered checklists, **a disposable second Google account first**.
- **STEP 13** privacy/network inspection (rows 12–14) with exact DevTools steps. Evidence rule: synthetic voices only in
  screenshots; never a real person's recording.
- **STEP 14** legacy coexistence (row 17). **STEP 15** registry cutover PR snippet ("do NOT remove `legacyPath:'/account'`,
  do NOT delete legacy Account"). **STEP 16** post-cutover smoke (every avatar menu, switcher, Launcher row and the
  Story Book/Polyglot voice links open `account.bakerrang.com`). **STEP 17** rollback (a: `rollback.yml`; b: revert PR 3;
  c: server order note). **FINAL EXPECTED STATE** + "Until final cleanup" (legacy Account voices + `/supermarket` remain;
  `licenses` dormant).

---

## 23. Deterministic test plan

Vitest + Testing Library in `web/`; `node:test` + FakeDb + the express harness in `server/`. Behavior, not snapshots. All
fixtures synthetic.

| Area | Tests |
|---|---|
| `/account/preferences` (server) | 401 signed out (+ `no-store`); GET `{}` until stored; each enum round-trips; invalid/missing/extra keys → 400; **coexistence:** seed `users/u1` with `platformRole`, profile, `preferences.{theme,legacyKey}` → PUT → every other field and `preferences.legacyKey` unchanged; GET never returns unknown keys; `vaults/u1.settings` untouched (seeded + compared); 5xx → fixed body and the console spy sees `{code,name}` only; limiter wired. |
| `web-theme` (WT) | Existing suite green; anonymous → cookie only, no fetch; authenticated → cookie + PUT; **WT-1:** a GET resolving *after* a user choice doesn't change the preference or the cookie; **WT-2:** three rapid choices → PUTs strictly sequential, the last PUT carries the last value, at most one in flight; **WT-3:** cookie changed externally + `visibilitychange` → the preference adopts it with **no PUT**; invalid cookie ignored; **WT-4:** `persistence` saving → saved / error; **no localStorage access** (spy). |
| Voices (server) | GET sanitized (no `userId`, stray fields dropped); create: 0 / 4 files → 400; a 10 MiB + 1 file → 413/400; `text/plain` → 400; total > 25 MiB → 413; name blank/61 → 400; description 201 → 400; stored doc keys exactly as whitelisted (a multipart `evil` field isn't stored); first voice → `isPrimary:true`, second → false; `consent=true` → `consentConfirmedAt`; provider failure → 502 and nothing stored; the provider mock receives no `userId`. PATCH: foreign/missing → 404; 0 known keys → 400; the provider failure leaves Firestore unchanged; only name/description/updatedAt change. PRIMARY: foreign → 404; exactly one primary after; idempotent; **FakeDb `beforeCommit` interleave**: two concurrent primary changes → exactly one primary at the end; a voice deleted mid-flight isn't recreated. DELETE: provider 404 → doc deleted, 200; provider 500 → 502 and doc kept. Update All: whitelist. Invalid `:voiceId` → 400. `no-store` on every voice response. CSRF: missing token on POST/PATCH/PUT/DELETE → 403 (the real `csrfProtection` in one harness test). |
| Auth / CORS | `oauthTarget.test.js` (`account` → `ACCOUNT_DOMAIN`; unset → 500; unknown → 400); `cors.test.js` (`ACCOUNT_DOMAIN` allowed; others denied); `/auth/check` + `/auth/csrf` carry `no-store`. |
| Account app | Signed out → Welcome + working theme (cookie write, **no API call**); signed in → identity from `useAuth().user`, **no `<img>` of the photo**, no user id rendered; the theme choice calls `useTheme().setPreference` (mocked) and renders each persistence state; the Relay renders six named tiles and, under reduced motion, no stagger timers. Voices: list order, primary tag, Make primary (`PUT primary`) + announcement; rename validation + Save + 404 path; delete confirm → Keep it restores focus; Add voice validation (name / samples / consent, focus to the first error, `aria-describedby`); Create sends `FormData` with `consent=true` and ≤ 3 files; 502 copy; a **network-failure → "couldn't confirm" path makes no automatic retry**; offline → Add voice disabled. Recorder (mocked `MediaRecorder`/`getUserMedia`): honest `mimeType` → file extension; stops at 5:00; denied → message; tracks stopped on Cancel / sign-out / `pagehide` / unmount; Blob URLs revoked. Auth loss mid-edit → editors closed, voices cleared. Stale response after sign-out dropped (epoch). Sign out calls `auth.logout` (the shared mechanism), after a dirty-editor guard. |
| Separation (static + behavior) | No `supermarket`/`license`/`vault`/`useVault`/`autoLock`/`inlineAutofill`/`/vault` in `web/apps/account/src/**`; a full Account render issues **no `/vault` request**; no `localStorage`/`sessionStorage`/`indexedDB`/`caches` writes (spies) across a session; `AccountMenu` rendered without `themeControl`. |
| Legacy LH-1 | A web-workspace test reads `client/src/components/Account.jsx` as text: it contains no `supermarket`, `productLicenses`, `ProductLicense`, `useVault`, `FolderSelect` or `AUTO_LOCK_OPTIONS`, and it contains the Passwords pointer. |
| Rendering safety | A voice name `<img src=x onerror=…>` renders as text; the Google link is a fixed URL with `rel="noopener noreferrer"`; static grep: no `dangerouslySetInnerHTML`/`innerHTML` in `src/`; no `console.` in `src/`. |
| Accessibility | Every input labelled; radios in a named radiogroup; action buttons named with their object; rail `aria-current`; focus moves per §18; live-region texts; 44px targets at 390 (computed). |
| PWA / CSP build | `ACCOUNT_PWA_OPTIONS` identity, `runtimeCaching: []`; built `index.html` has no inline `<script>` and loads `/theme-boot.js` first; `theme-boot.js` equals `THEME_BOOT_SCRIPT`; `account.conf` has all eight headers in every `location` with `always` and the exact CSP; `nginx.conf` byte-identical. |
| Registry | `resolveDestinations` for `account` (legacy until the flip; env override wins); the flip PR test; the switcher's Account item gets `aria-current` when `current='account'`. |
| CI | §21 tests. |

## 24. Impeccable process and finish record

- **Order kept:** repository audit (§§1–13) → owner decisions (voices, Supermarket) → legacy **visual** audit (the real
  legacy client against a throwaway API with synthetic data; `review/account/legacy-*.png`) → structure round → brief →
  comp → icon → inspection → review → documentation.
- **Structure round:** `concept-seed --scope surface --mode operate` (seed `e184acff`) dealt structures 4 / 7 / 3 of seven
  grounded candidates: *Section rail + one ruled sheet* (lead), *The switchboard*, *Index, then a page per setting*. They
  were served as wireframe cards on the decision page. The **owner locked the lead**. Code-led (no image generation), so
  there's no comp round and no decision comp; the direction contract carries FIRST VIEWPORT + SIGNATURE.
- **Brief** `web/.impeccable/surfaces/account.md` (six blocks + FINISH, seed key present), written before the comp.
- **Comp** `account-comp.html` (21 states, `?state=`, both themes, reduced motion): inspection round 1 at 1440 / 1024 /
  390 in both themes fixed the status-icon wrap, the voice-row rule overhang, a clipped label button, hint spacing and
  row alignment. Round 2 was clean (no overflow at any width; every control named). Detector: three findings fixed (an
  off-scale radius, an off-scale masthead clamp, and a decorative blinking recording dot), then `[]`.
- **Icon master** `account-icon.svg`: the shared Account emblem in Account Grey, the Relay as three ground tiles
  (light / dark / split system), and the canonical B badge in the family position (render `review/account/icon-512.png`).
- **Finish review** (a fresh `impeccable-finish-reviewer`, no shared context; code-led, so no approved comp; calibrated
  against DESIGN.md and the Passwords icon):
  - **Round 0: `recapture`, twice.** The first return named four invalid files: three phone captures cropped from a 390
    layout by the scrollbar, and a Relay mid-flight frame that didn't show the stagger. Tracing the frame found a **real
    comp defect**: the theme change re-rendered the sheet, so new ink took its colour instantly while the ground was still
    cross-fading, and contrast collapsed for a moment. Fixed by making the sheet repaint **at once**, with only the tiles
    moving (the contract SIGNATURE was amended to match), and targeted DOM updates. Relay frames were then captured with a
    comp-only `?slowmo=30` review parameter at measured equivalents of ~41 ms and ~109 ms. The second return named three
    state captures that stopped at the fold. They were recaptured scrolled to Voices, which also exposed and fixed a
    lagging rail scroll-spy (now deterministic).
  - **Round 1: `fix`** with six material fixes:
    1. Phone FIRST VIEWPORT: Voices was below the 844 fold. The "Signed in with" row was folded into the nameplate and
       the phone spacing tightened; the head now ends at y=803.
    2. Sign out wasn't last or set apart. Session is now App settings → Your data → Signed in / Sign out.
    3. The theme selected state was tone-only. It now adds 700 weight + a 1px Ink 3 border.
    4. "Add audio files" lost its button padding to a label rule.
    5. The page lead wrapped at desktop. It's one line now.
    6. The editor bleeds were unequal. They're unified at 12px.

    Ceiling note: the Relay tiles read as buttons, so they moved to a hairline border.
  - **Verdict pass:** all six `resolved`, plus one regression (a doubled rule above the final Session row). It was fixed
    → **`resolved` → `ship`.** The ship covers the scored fixes and that regression. It's a verdict pass, not a fresh
    whole-surface review. The reviewer's out-of-scope note (the shared ThemeControl's tone-only state) is logged as R9.
- **Documenter:** `web/DESIGN.md` gains **"Product layer: Account"** (+431 lines, additive only; +10 `account-*`
  typography roles and 28 `account-*` components in the frontmatter; no new colour, radius or spacing tokens). It
  names the rules The Ruled Sheet, Grey Marks Place, One Gold, Unified Bleed, One Editor, Sign Out Last,
  Selected-Is-Not-Just-Tone (Account-scoped), Ink Validation and The Relay. `.impeccable/design.json` gains the matching
  `scope:"account"` typography, the `relay` and `account-editor-open` motion, breakpoints, 5 components, rules, dos and
  don'ts, and 6 `notCanonized` entries. The frontmatter parses as YAML and design.json parses as JSON (both re-verified by
  the planner). The contract's "4px monogram" wording was corrected to "52px monogram on the 4px radius". **Pre-existing
  world drift was reported, not repaired:**
  - the bar rule never hides the wordmark (it shrinks to 14px on phone);
  - avatar 36px and icon buttons 40px vs the world's 38px;
  - ghost/quiet hover fills Plane 2 vs the world's Plane;
  - the `accent-account` colorMeta note still says "emblem + hover only".
- **Implementation must NOT copy these comp shortcuts:** the Google Fonts CDN link (the app self-hosts Archivo via
  `web-tokens`, and the CSP forbids third-party origins); `innerHTML` string rendering (use React, no remount of focused
  fields); the review panel; synthetic data; the simulated timers for saving/creating/recording.

## 25. Live acceptance matrix (`account.bakerrang.com`, before the flip)

Evidence rule: a disposable second Google account and synthetic voices for screenshots. The owner's account is used only
for rows 3, 11 and 17, recorded as pass/fail text.

| # | Check | Pass when |
|---|---|---|
| 1 | Shell + headers | HTTPS; `/` and `/nope` serve the shell; manifest "Account — BakerRang"; the exact CSP + seven other headers; no inline script; **zero CSP violations** through rows 2–16. |
| 2 | Signed out | Welcome; the theme works anonymously (the cookie changes; no `/account` request in the Network tab); the gold Sign in → `?target=account` returns here; already signed in elsewhere → no prompt. |
| 3 | Identity | Name + email match the Google account; no photo request to googleusercontent; no user id anywhere in the DOM. |
| 4 | Theme from Account | Dark/Light/System repaint instantly; the Relay runs; "Saved to your account"; `PUT /account/preferences` → 200 `no-store`. |
| 5 | Reflected in another app | Open Story Book in another tab → it's already the new theme (boot from the cookie); switch back → no flash. |
| 6 | Changed elsewhere → Account | Change the theme in Budget's avatar menu, return to the open Account tab → it adopts it on focus (WT-3) with **no extra PUT**. |
| 7 | Reload / cross-device | Reload → persists; a second browser signed in → picks up the stored theme on load. |
| 8 | Voices (test account) | Add via upload and via recording (consent required); first voice PRIMARY; rename; make another primary; delete one; reload → all persisted. Story Book and Polyglot list the renamed voice with the right PRIMARY. |
| 9 | Voice limits | An 11 MB file / a `.txt` renamed `.mp3` with the wrong type / 4 files → clear errors, nothing created. |
| 10 | Supermarket absent | No Supermarket text/control/request in Account (new app), and none in legacy Account after LH-1. |
| 11 | Passwords separation | No vault control and no `/vault` request in Account; Passwords "Vault settings" still shows the owner's existing Lock after + extension values, unchanged by any Account action. |
| 12 | Network inspection | No query strings with PII; voice uploads only to `api.bakerrang.com`; every Account/voice/auth response carries `cache-control: no-store`. |
| 13 | Storage inspection | Local/Session Storage and IndexedDB have nothing from Account; Cache Storage = shell assets only; cookies = `br_theme` (+ the API's own). |
| 14 | CORS / CSRF | ACAO is exactly `https://account.bakerrang.com` with credentials; a replayed PATCH without `x-csrf-token` → 403. |
| 15 | Concurrency | Two tabs: rapid theme toggles end on the last choice in both after focus; make-primary in both tabs → exactly one PRIMARY after reload; delete in A, rename in B → "deleted somewhere else". |
| 16 | Sign out | Session → Sign out → Welcome; other open BakerRang tabs show signed out on their next focus/poll; another browser stays signed in. |
| 17 | Legacy coexistence | Legacy `/account` shows voices (+ the vault pointer, no Supermarket, no vault controls); a rename in the new app shows in legacy after a reload; the legacy `/supermarket` page still loads (owner decision 2). |
| 18 | Mobile (real iOS Safari + Android Chrome, 390) | No horizontal scroll; 44px targets; recording works (Safari MP4, Chrome WebM) and plays back; the keyboard doesn't hide Create. |
| 19 | Keyboard + screen reader | NVDA/VoiceOver: rail, radiogroup, voice actions named with their voice, editor errors announced, live-region messages, focus returns. |
| 20 | Themes + motion | Light/dark/system with no flash; reduced motion → the Relay is instant. |
| 21 | PWA | Installable as "Account"; offline cold start → Welcome/shell; offline while open → the offline notice, Add voice disabled. |
| 22 | App switching / cutover | Pre-flip every Account link → legacy; after PR 3 → `account.bakerrang.com` from every app, the Launcher row, and the Story Book/Polyglot voice links; apex unchanged. |
| 23 | Deploy mechanics | An Account-only commit deploys only `web-account`; a `web/packages/**` commit deploys all seven; rollback + verify-live cover `web-account`. |
| 24 | Rollback drill | `rollback.yml` to the previous `web-account` revision succeeds; reverting PR 3 restores the legacy destination. |

## 26. Files created / updated by this planning phase

| File | Status |
|---|---|
| `docs/apps/PhaseH-Account.md` | **new** (this document) |
| `web/.impeccable/surfaces/account.md` | **new** (surface brief + direction contract) |
| `web/.impeccable/mocks/account-comp.html` | **new** (interactive comp) |
| `web/.impeccable/mocks/account-icon.svg` | **new** (app-icon master) |
| `web/.impeccable/review/account/*.png` | **new**, gitignored run output (legacy audit + review captures; synthetic data) |
| `web/DESIGN.md` | updated: "Product layer: Account" (documenter, from the finished comp) |
| `web/.impeccable/design.json` | updated: additive Account entries (documenter) |
| `web/PRODUCT.md` | updated: "Product: Account (Phase H truth)" |
| `docs/apps/Phase0-EcosystemArchitecture.md` | updated: the 2026-09-29 supersede note |
| `CLAUDE.md` (repo root) | **not** updated (no planning-doc index exists for `docs/apps/`) |
| **Created by implementation later (not now):** `web/apps/account/**`, server B1–B8, legacy LH-1, WT-1…4, the `web-app-shell` line, `web/nginx/apps/account.conf`, CI/CD (§21), the Launcher copy line, `docs/apps/Account-PhaseH-Runbook.md` | — |

No production code was written. Nothing was committed or pushed. The repo-root platform ("Business Workshop") design
files weren't touched, and Impeccable itself wasn't updated.

## 27. Risks, open items and blockers

- **R1** Server-side consent isn't enforced until the legacy Add Voice retires (legacy doesn't send it). The UI requires
  it and `consentConfirmedAt` is recorded. **Final cleanup:** make `consent` required on create.
- **R2** Legacy "Update All" stays last-write-wins over whole voices, so a stale legacy tab can revert a new-app rename.
  It's narrow (legacy Account is off every link after the flip) and it ends at cleanup.
- **R3** No account deletion or data export (§12). **A product gap, deferred, not a Phase H blocker.** A future phase
  must design the cross-app deletion semantics (incl. B2B membership and ElevenLabs).
- **R4** No "sign out everywhere" (sessions aren't indexed by user).
- **R5** ElevenLabs behavior assumptions (the edit endpoint requires `name`; a delete 404 means gone; accepted audio
  types) are from the existing integration, not re-verified against current provider docs. Acceptance rows 8–9 verify
  them live. The server's MIME allowlist is conservative, and the provider remains the final validator.
- **R6** A retried Add voice after a lost response could clone twice. It's mitigated by the no-auto-retry "couldn't
  confirm" state; a create-idempotency key is deferred.
- **R7** Browser `MediaRecorder` formats differ (WebM/Opus vs MP4/AAC). Both are in the allowlist; acceptance row 18
  verifies both.
- **R8** Final cleanup inventory added by Phase H: the legacy `PUT /v1/voices`, the legacy `GET /auth/logout`, the legacy
  `ThemeProvider` localStorage key, `ProductLicense.jsx`/`productLicenses`, the Supermarket page/backend/`licenses` data,
  and `consent` enforcement.
- **R9** The shared `web-app-shell` `ThemeControl` (and the world Segmented Control in DESIGN.md) shows its pressed segment
  by tone alone (Plane 2 on the track, ≈1.1–1.2:1). Account's own theme choice fixes this locally (700 + 1px Ink 3
  border). Applying the same treatment to the shared control is a small follow-up **outside Phase H** (it changes every
  app's avatar menu). It was raised by the finish review.

**Unresolved blockers: none.** Every finding has a locked action or an explicit, documented deferral.
