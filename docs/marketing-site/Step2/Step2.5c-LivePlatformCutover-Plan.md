# Step 2.5c — Live Platform Bootstrap + API Cutover Plan (analysis)

> **Planning / read-only.** Companion to
> [Step2.5c-LivePlatformCutover-Spec.md](Step2.5c-LivePlatformCutover-Spec.md). No GCP, DNS,
> Firestore, IAM, GitHub, or deployment change is performed by producing this document. All
> live-state facts below were captured with read-only `gcloud describe/get-iam-policy` on
> 2026-08-29 and reconciled against `server/` source.

## 0. The one finding that shapes everything

The MAIN deploy workflow updates Cloud Run **image only**:
`_deploy-cloud-run.yml` runs `gcloud run services update "$SERVICE" --image <digest>` and then
**asserts the runtime service account is unchanged**. It never sets env vars or secrets. It also
inherits whatever env/secret config already exists on the service.

The current `server/` code calls `validateServerRuntimeConfig()` at process start
([server/app.js:37](../../../server/app.js)) which **hard-fails** if any of
`FIRESTORE_PROJECT_ID`, `MEDIA_BUCKET_NAME`, `PORTAL_DOMAIN`, `SITE_RENDERER_DOMAIN` is missing,
and (because `NODE_ENV=production` is baked into [server/Dockerfile:5](../../../server/Dockerfile))
also `PREVIEW_TOKEN_SECRET`. None of those five are on the live service today.

Therefore the platform config **must be applied to the service before the new image is deployed**,
or the new revision crash-loops at boot and never becomes Ready. This makes **Option A mandatory,
not merely safer** (see §4). It is the spine of the whole cutover.

---

## Output 1 — Current live API state (verified)

| Field | Value |
|---|---|
| Project / region | `avian-cable-379805` / `us-west1` |
| Service | `bakerrang-api` |
| Latest ready revision | `bakerrang-api-00026-wtv` |
| Image | `gcr.io/avian-cable-379805/bakerrang-api@sha256:832368b6d011e9142a6fa0e6169840a3f10dacce48ca105f2725d7203074f711` |
| Runtime SA | `bakerrang-api@avian-cable-379805.iam.gserviceaccount.com` |

Revision and image **match** the Spec's known values — nothing has moved since the last audit.

**Live env (plain values):** `GOOGLE_OAUTH_CLIENT_ID`, `CLIENT_DOMAIN=https://bakerrang.com`,
`SERVER_DOMAIN=https://api.bakerrang.com`, `CHATBOT_ORIGIN=https://danbaker.info`,
`CHATBOT_VOICE_ID`, `BLIZZARD_CLIENT_ID`.

**Live secret env (resource:version → env):**

| Env var | Secret resource |
|---|---|
| `CHAT_GPT_API_KEY` | `bakerrang-chat-gpt-api-key:latest` |
| `ELEVEN_LABS_API_KEY` | `bakerrang-eleven-labs-api-key:latest` |
| `DEEPGRAM_API_KEY` | `bakerrang-deepgram-api-key:latest` |
| `BLIZZARD_CLIENT_SECRET` | `bakerrang-blizzard-client-secret:latest` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `bakerrang-google-oauth-client-secret:latest` |
| `SESSION_SECRET` | `bakerrang-session-secret:latest` |
| `CSRF_SECRET` | `bakerrang-csrf-secret:latest` |

**NOT currently on the service:** `NODE_ENV`, `FIRESTORE_PROJECT_ID`, `MEDIA_BUCKET_NAME`,
`PORTAL_DOMAIN`, `SITE_RENDERER_DOMAIN`, `PREVIEW_TOKEN_SECRET`, `ALLOW_DRAFT_PUBLIC_SITES`.
(`NODE_ENV=production` is supplied by the image itself, not Cloud Run env.)

**IAM (verified):**
- Runtime SA project roles: `roles/datastore.user` only (least-privilege — good).
- `gs://bakerrang-media-marketing`: runtime SA has `roles/storage.objectAdmin`; `allUsers` has
  `roles/storage.objectViewer` (intended public-read). UBLA on.
- `bakerrang-preview-token-secret`: runtime SA has `roles/secretmanager.secretAccessor`. Secret
  exists (`gcloud secrets list` confirms all 7 legacy secrets + preview token).

Every asserted precondition in the Spec is confirmed true.

---

## Output 2 — Current server production runtime requirements (from source, `NODE_ENV=production`)

Validated at startup by [runtimeConfig.js](../../../server/config/runtimeConfig.js) /
[firestoreConfig.js](../../../server/config/firestoreConfig.js) /
[mediaConfig.js](../../../server/config/mediaConfig.js):

**Required — process refuses to start without these:**
- `FIRESTORE_PROJECT_ID` — no fallback anymore. The old hardcoded-pin (`avian-cable-379805`)
  fallback described in Step 1.5.5B has been **removed**; `resolveFirestoreProject` now throws.
- `MEDIA_BUCKET_NAME`
- `SESSION_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `SERVER_DOMAIN` (must be a bare absolute http/https origin)
- `PORTAL_DOMAIN` (bare absolute origin)
- `SITE_RENDERER_DOMAIN` (bare absolute origin)
- `PREVIEW_TOKEN_SECRET` — required because `NODE_ENV==='production'`.

**Optional — validated only if present, feature-gated otherwise:**
- `CLIENT_DOMAIN` — optional origin; if set, must be a valid bare origin. Drives CORS + OAuth
  `client` target + `/login` failure redirect. In practice always set for BakerRang.
- `CSRF_SECRET` — falls back to `SESSION_SECRET` if absent. Present today; keep it.
- `CHATBOT_ORIGIN`, `CHATBOT_VOICE_ID` — chatbot feature/CORS.
- `CHAT_GPT_API_KEY`, `ELEVEN_LABS_API_KEY`, `DEEPGRAM_API_KEY`, `BLIZZARD_CLIENT_ID`,
  `BLIZZARD_CLIENT_SECRET` — legacy feature keys; read lazily by their routes, not at boot.
- `PORT` — provided by Cloud Run.

**Legacy but currently used:** `CLIENT_DOMAIN`, `CHATBOT_ORIGIN`, `CHATBOT_VOICE_ID`, all five
third-party keys above. These stay — they are live BakerRang functionality.

**Must be absent / false in production:**
- `ALLOW_DRAFT_PUBLIC_SITES` — `draftPreviewEnabled` returns false whenever
  `NODE_ENV==='production'` regardless of this flag ([publicSite.js](../../../server/config/publicSite.js)),
  so production cannot leak DRAFT sites even if it were set. Leave it **unset**. Do not add it.
- `NODE_ENV` anything other than `production` — the image already bakes `production`; do not
  override it to a weaker value via Cloud Run env.

---

## Output 3 — Target live API env/secret contract

Additive delta only — **preserve every existing variable and secret above.**

**Add (plain env):**
```
FIRESTORE_PROJECT_ID   = avian-cable-379805
MEDIA_BUCKET_NAME      = bakerrang-media-marketing
PORTAL_DOMAIN          = https://portal.bakerrang.com
SITE_RENDERER_DOMAIN   = https://sites.bakerrang.com
```

**Add (secret env):**
```
PREVIEW_TOKEN_SECRET   -> bakerrang-preview-token-secret:latest
```

**Preserve unchanged:** `GOOGLE_OAUTH_CLIENT_ID`, `CLIENT_DOMAIN=https://bakerrang.com`,
`SERVER_DOMAIN=https://api.bakerrang.com`, `CHATBOT_ORIGIN`, `CHATBOT_VOICE_ID`,
`BLIZZARD_CLIENT_ID`, and all seven existing secret mappings.

**Do not add:** `NODE_ENV` (baked in image), `ALLOW_DRAFT_PUBLIC_SITES` (must stay absent).

Net final env count: 13 existing + 4 new plain + 1 new secret = 18 container env entries.

---

## Output 4 — Safest configuration-update approach

**Decision: Option A — config first (on the old image), verify, then deploy the new image.**
This is not a preference; it is required by §0. The image-only CI deploy cannot introduce env, and
the new image will not boot without it.

Why it is also the *safest* shape:
- The intermediate revision runs the **known-good old image** with only **inert extra vars**
  added. The old image either ignores `FIRESTORE_PROJECT_ID` or reads the identical
  `avian-cable-379805` it already targets; the other four adds are unread by old code. So the
  intermediate revision is behaviorally identical to today plus unused config → maximum safety,
  and it independently proves the config/secret wiring is valid before any code changes.
- Use the **merge** forms (`--update-env-vars`, `--update-secrets`), never the replace forms
  (`--set-env-vars`, `--set-secrets`), so no legacy variable or secret is dropped.
- Then the operator dispatches the normal MAIN `api` workflow, which swaps image-only and inherits
  this config.

**Step A — apply config to the old image (creates a new revision, LIVE):**
```powershell
gcloud run services update bakerrang-api `
  --project avian-cable-379805 --region us-west1 `
  --update-env-vars "FIRESTORE_PROJECT_ID=avian-cable-379805,MEDIA_BUCKET_NAME=bakerrang-media-marketing,PORTAL_DOMAIN=https://portal.bakerrang.com,SITE_RENDERER_DOMAIN=https://sites.bakerrang.com" `
  --update-secrets "PREVIEW_TOKEN_SECRET=bakerrang-preview-token-secret:latest"
```

**Verify Step A before touching the image:**
```powershell
gcloud run services describe bakerrang-api --project avian-cable-379805 --region us-west1 --format="value(status.latestReadyRevisionName)"
gcloud run services describe bakerrang-api --project avian-cable-379805 --region us-west1 --format="value(spec.template.spec.containers[0].env[].name)"
# smoke: must still return "Healthy" on the OLD image with the new config present
curl.exe -s https://api.bakerrang.com/health
```
The env-name list must now contain all 18 names; `/health` must return `Healthy`; legacy BakerRang
login/vault/etc. must still work. Only then proceed to the image deploy (§12).

Rejected — **Option B (config + image together):** it would require a hand-built
`gcloud run deploy --image <newdigest> --update-env-vars ... --update-secrets ...`, bypassing the
audited CI path (WIF, immutable tag, digest verify, runtime-SA-unchanged assertion, smoke), and
would conflate two independent failure domains (bad config vs bad code) into one revision. Only use
B if the CI path is unavailable, and even then run the config update first as its own revision.

---

## Output 5 — Secret wiring syntax (resource names only, no values)

The new revision maps exactly one new secret and preserves the seven existing:

```
PREVIEW_TOKEN_SECRET        -> bakerrang-preview-token-secret:latest   # NEW
CHAT_GPT_API_KEY            -> bakerrang-chat-gpt-api-key:latest
ELEVEN_LABS_API_KEY        -> bakerrang-eleven-labs-api-key:latest
DEEPGRAM_API_KEY           -> bakerrang-deepgram-api-key:latest
BLIZZARD_CLIENT_SECRET     -> bakerrang-blizzard-client-secret:latest
GOOGLE_OAUTH_CLIENT_SECRET -> bakerrang-google-oauth-client-secret:latest
SESSION_SECRET             -> bakerrang-session-secret:latest
CSRF_SECRET                -> bakerrang-csrf-secret:latest
```

`--update-secrets "PREVIEW_TOKEN_SECRET=bakerrang-preview-token-secret:latest"` adds only the new
mapping and leaves the other seven intact. The runtime SA already holds `secretAccessor` on the
preview secret (verified), so no IAM change is needed.

---

## Output 6 — OAuth / cookies / CORS findings

**CORS:** allowed origins are built at boot from
`[CLIENT_DOMAIN, PORTAL_DOMAIN, SITE_RENDERER_DOMAIN, CHATBOT_ORIGIN]`
([origins.js](../../../server/config/origins.js)). Until `PORTAL_DOMAIN` and
`SITE_RENDERER_DOMAIN` are in the API env, browser calls from `portal.bakerrang.com` /
`sites.bakerrang.com` are denied. Adding them in §3/§4 fixes this. The delegate answers allowed
origins with `{ origin: true, credentials: true }`; custom ACTIVE domains are additionally allowed
only for `POST /public/sites/:id/leads` via the domain registry.

**Session cookie:** `sameSite:lax`, `secure:'auto'`, `httpOnly`, no explicit `domain`
([app.js:69](../../../server/app.js)). Host-only to `api.bakerrang.com`. `portal.bakerrang.com` and
`api.bakerrang.com` share the registrable domain `bakerrang.com`, so requests portal→API are
**same-site**; `lax` permits them, and `credentials:'include'` sends the cookie. **No cookie-domain
broadening is needed or wanted** (matches the Step 1.5 decision). `app.set('trust proxy', 1)` makes
`secure:'auto'` correct behind Cloud Run TLS.

**CSRF cookie:** `__Host-bakerrang.x-csrf-token`, `secure`, `sameSite:lax` (because the image runs
`NODE_ENV=production`). Unauthenticated and `/chatbot` requests are skipped. Portal state-changing
calls fetch a token from `/auth/csrf` and send `x-csrf-token`.

**OAuth callback / redirect:** `callbackURL = ${SERVER_DOMAIN}/auth/google/callback` =
`https://api.bakerrang.com/auth/google/callback` — **unchanged**. Portal login is a full navigation
to `…/auth/google?target=portal`; the target is stored in the session and consumed in the callback,
which then redirects to `resolveOAuthTarget('portal') = env.PORTAL_DOMAIN`. The browser never talks
to Google from `portal.bakerrang.com` directly — it bounces through the API domain.

**Google OAuth console — required human action:** **None expected.** Because the callback stays on
`api.bakerrang.com` (already an authorized redirect URI, since live login works) and the portal uses
the server redirect flow (no Google Identity JS on the portal origin), **no new Authorized redirect
URI and no new Authorized JavaScript origin are required for the Portal.** Human action is limited to
*confirming* (read-only, in the existing OAuth client) that `https://api.bakerrang.com/auth/google/callback`
is present. Do **not** modify the OAuth client. If a future portal feature adds a Google JS SDK on
`portal.bakerrang.com`, that origin would then need adding — out of scope for 2.5c.

---

## Output 7 — Old API compatibility with Portal

The old GCR image predates the platform (the Spec states this is the platform code's *first*
deployment to `bakerrang-api`). It therefore **lacks** the entire `/tenants` router and the
target-aware OAuth. Concretely:

| Portal need | Route | On old image? |
|---|---|---|
| Session/login state | `GET /auth/check` | **Yes** (legacy) — testable now |
| Logout | `GET/POST /auth/logout` | **Yes** (legacy) — testable now |
| `?target=portal` login redirect | `GET /auth/google?target=portal` | **No** — old image ignores target, redirects to CLIENT_DOMAIN |
| List businesses | `GET /tenants` (`requirePlatformAdmin`) | **No** → 404 |
| Create business | `POST /tenants` | **No** → 404 |
| Site editor / domain / media / leads | `/tenants/:id/site*`, `/media`, `/leads*` | **No** → 404 |

**Testable against the old API now:** the portal *shell*, anonymous vs. authenticated state, and
CORS reachability (once §4 config adds `PORTAL_DOMAIN`). **Not verifiable until cutover:** login-as-
portal redirect, business list/create, and every site/media/lead feature. **Full Portal function
requires the API cutover.**

---

## Output 8 — Old API compatibility with Renderer

The renderer (server-side) fetches public endpoints on `api.bakerrang.com`:
`GET /public/sites/:tenantId`, `GET /public/sites/:tenantId/published`,
`GET /public/sites/:tenantId/domain`, `GET /public/domains/:hostname`, and
`GET /public/preview/:tenantId` (Bearer preview token). The old image has **none** of the `/public`
routers. Every renderer content fetch returns 404 today → the renderer can only prove it boots and
serves `robots.txt` (its CI smoke), not that it renders a real site. **Full Renderer verification
waits for the API cutover.**

---

## Output 9 — Minimal live Firestore bootstrap

MAIN Firestore already holds legacy production data; no DEV import. The platform authorizes by
reading `users/{userId}.platformRole` ([tenantService.js:76](../../../server/services/tenantService.js),
`getPlatformRole`) and comparing `=== 'PLATFORM_ADMIN'`
([tenantAuth.js](../../../server/middleware/tenantAuth.js)).

**Exact minimum:**
1. Operator logs in through live OAuth (`https://api.bakerrang.com/auth/google`). This runs
   `checkAndStoreUser`, creating/merging `users/{googleProfileId}` with Google profile fields only.
   The doc **id is the Google profile id** (`profile.id`), **not** the email.
2. Manually set on that one doc:
   - **field:** `platformRole` — **string value:** `PLATFORM_ADMIN` (exact case).

That is the whole bootstrap. `PLATFORM_ADMIN` **bypasses** tenant-role checks, so **no membership,
no tenant, and no other document is required** before creating the first tenant. The first business
is then created through the normal product flow: `POST /tenants` from the Portal (or a CSRF-correct
API call), which writes `tenants/{uuid}` via `createTenant`. **No seed or migration script is
needed** — one field edit, then product flows.

Safety note: `checkAndStoreUser` is a `{merge:true}` write of Google fields only and deliberately
never writes `platformRole` ([authService.js](../../../server/services/authService.js)), so a later
login can never erase the admin grant.

---

## Output 10 — Firestore collision assessment

| Collection / path | Origin | Collision risk |
|---|---|---|
| `users/{id}` | **Shared** legacy (vault sharing) + platform (`platformRole`, membership) | **Safe by design.** Platform only *reads* `platformRole` and *adds* a `tenants/{id}/members/{userId}` subcollection. Login sync is merge-only and never touches `platformRole`. This is the single shared collection — call it out, but it is intentional and guarded. |
| `tenants` (+ `/members`, `/site`, `/leads` (+`/notes`), `/media`) | New | No legacy collection named `tenants`. Safe. |
| `siteDomains/{hostname}` | New top-level | New. Safe. |
| `tenantSiteDomains/{tenantId}` | New top-level | New. Safe. |
| Audit data | Legacy `vaults/{ownerId}/audit` only | Platform has **no** separate audit collection (lead accountability is an inline `updatedByUserId` field). No overlap. |
| Sessions | Legacy Firestore session store | Unchanged; shares the same Firestore client. Safe. |

Legacy collections (`storybooks`, `vaults`, `vault_shares`, `wow_*`, `resume_chunks`, budget/
supermarket, etc.) do not intersect any platform path. **No dangerous overlap. No data migration.**
Pointing the new image at the same project (`FIRESTORE_PROJECT_ID=avian-cable-379805`) is exactly
what makes the shared `users` collection and legacy data continue to work.

---

## Output 11 — Index requirements

Platform queries with an `orderBy`/`limit`:
- `listTenantLeads` — `tenants/{id}/leads` `.orderBy('createdAt','desc').limit(51)`
- `listLeadNotes` — `…/leads/{id}/notes` `.orderBy('createdAt','desc').limit(51)`
- `listMedia` — `tenants/{id}/media` `.orderBy('createdAt','desc').limit(51)`

All three are **single-field `orderBy` with no `where`** → covered by Firestore's **automatic
single-field indexes**. Every other platform read is a document `get`, a `getAll`, or an unfiltered
`collection.get()` (`listTenants`, `getMembership`, `resolveActiveDomain`, all `siteDomains`/
`tenantSiteDomains` lookups) — none need an index.

- **Required now for 2.5c Portal/Renderer:** **none.**
- **Required later:** none for shipped queries. (A future paginated/filtered leads inbox — e.g.
  `where(status)` + `orderBy(createdAt)` — would need a composite index; not present today.)
- **Not required:** composite indexes for leads/notes/media lists.

The only composite index in the system is the **legacy vault-audit** one
(`targetId|folderId` + `orderBy(createdAt)`), already created in production via the console; it is
unrelated to 2.5c and is not in `firestore.indexes.json`. No workflow deploys `firestore.indexes.json`,
so no index step is part of this cutover. **No source change to `firestore.indexes.json` is needed.**

---

## Output 12 — Controlled API cutover sequence

Refined from source. Steps 1–2 are read-only capture; Step 3 is the first LIVE change.

1. **Capture rollback baseline (read-only):**
   ```powershell
   gcloud run services describe bakerrang-api --project avian-cable-379805 --region us-west1 --format="value(status.latestReadyRevisionName,spec.template.spec.containers[0].image,spec.template.spec.serviceAccountName)"
   gcloud run services describe bakerrang-api --project avian-cable-379805 --region us-west1 --format="value(spec.template.spec.containers[0].env[].name)"
   ```
   Expect `bakerrang-api-00026-wtv` / the `sha256:8323…` image / `bakerrang-api@…` SA.
2. **Confirm rollback target** = revision `bakerrang-api-00026-wtv` (old image + old config, fully
   working). Note it explicitly.
3. **Apply config to the OLD image** — the §4 Step A `--update-env-vars`/`--update-secrets` command
   (LIVE; new revision, old code).
4. **Verify the config revision:** env-name list shows all 18; `curl https://api.bakerrang.com/health`
   → `Healthy`; spot-check legacy login + one authed feature. **Do not proceed if any legacy flow
   breaks** — the only change so far is added config, so a break means bad config; fix or roll back
   before deploying code.
5. **Deploy the new image via the audited path:** GitHub → Actions → **Deploy MAIN** →
   `workflow_dispatch`, `service = api`, from `main`. CI swaps image-only (inheriting the new config),
   verifies digest, asserts runtime SA unchanged, and smokes `/health`.
6. **Verify deployment:** new ready revision, image digest = the git-SHA build, runtime SA still
   `bakerrang-api@…` (the workflow already asserts this; re-confirm from the run summary).
7. **Smoke `/health`** on `https://api.bakerrang.com` → `Healthy`.
8. **Verify legacy APIs still work** (the risk that justifies rollback): Google login end-to-end,
   `GET /auth/check`, a vault read, one TTS/chat action.
9. **Verify auth for platform:** log in, confirm session cookie + CSRF token issuance.
10. **Bootstrap PLATFORM_ADMIN** (§9): set `platformRole='PLATFORM_ADMIN'` on the operator's
    `users/{profileId}` doc. Confirm `GET /tenants` now returns 200 (was 403 before the grant).
11. **Create the first live tenant** through the Portal (`POST /tenants`). Confirm `tenants/{uuid}`
    exists and appears in the Portal business list.
12. **Verify Renderer / public-site APIs:** initialize + publish the tenant's site from the Portal,
    then confirm `GET /public/sites/:tenantId/published` returns content and the renderer renders it.
13. **Verify media upload:** `POST /tenants/:id/media` (PLATFORM_ADMIN) → object lands in
    `gs://bakerrang-media-marketing`, metadata doc created, public URL 200s.
14. **Verify lead capture:** publish a `leadForm` contact action, then anonymous
    `POST /public/sites/:id/leads` → `tenants/{id}/leads/{leadId}` created; confirm it shows in the
    Portal leads inbox.
15. **Only then declare the API cutover successful.**

---

## Output 13 — Rollback procedure

Re-read live state at rollback time (`describe` above). Two mechanisms:

**Primary — revision traffic rollback (safest, seconds, no rebuild):**
```powershell
gcloud run services update-traffic bakerrang-api `
  --project avian-cable-379805 --region us-west1 `
  --to-revisions bakerrang-api-00026-wtv=100
```
This atomically reverts **both image and config** to the last fully-working served revision. Prefer
this whenever the new image is Ready but functionally wrong (breaks legacy BakerRang). Cloud Run
already auto-protects the crash-loop case: if the new image never becomes Ready, traffic stays on
the previous Ready revision — but still run this to pin intent.

Caveat: `00026-wtv` is old image **and** old config. Rolling to it also removes the platform config,
which is correct for a full abort. If you want to keep the good config but drop only the bad *code*,
roll to the **intermediate config revision** from §4 Step A instead (capture its name in Step 4).

**Secondary — image/config rollback by redeploy (slower, only if no good revision is servable):**
```powershell
gcloud run services update bakerrang-api `
  --project avian-cable-379805 --region us-west1 `
  --image gcr.io/avian-cable-379805/bakerrang-api@sha256:832368b6d011e9142a6fa0e6169840a3f10dacce48ca105f2725d7203074f711
```
Then, only if the platform config must also be removed, re-run with `--remove-env-vars` /
`--remove-secrets` for the five added keys. This path is error-prone; use traffic rollback unless the
target revision was deleted.

**Recommended:** traffic rollback to `bakerrang-api-00026-wtv` is the primary; it is the fastest and
least error-prone and restores a known-good state exactly.

---

## Output 14 — Documentation updates required (after a real cutover)

Capture only commands actually executed; do not pre-write speculative history.

- [docs/infra/live-environment-bootstrap.md](../../infra/live-environment-bootstrap.md):
  - Add a **"Live API cutover"** subsection under the existing "Existing live API audit" section:
    the §4 Step A `--update-env-vars`/`--update-secrets` command, the final 18-var env contract
    (§3), and the §13 `update-traffic` rollback command. Move `bakerrang-api` config/image out of
    the "still the old GCR image" state description once cutover lands.
- [docs/CI-CD.md](../../CI-CD.md):
  - Note that the MAIN `api` deploy is **image-only** and that env/secret config is applied **out of
    band** by a reviewed `gcloud run services update`, sequenced *before* the first platform image
    (the §0 finding). This is the single most surprising operational fact and belongs in the doc.
- Update the project [CLAUDE.md](../../../CLAUDE.md) marketing-site index with a Step 2.5c line once
  executed.

No `.env.example` change (already lists the full contract). No `firestore.indexes.json` change (§11).

---

## Output 15 — Blockers before API deployment

1. **Config must be applied first (§0/§4).** Without the four env vars + preview secret on the
   service, the new image crash-loops. This is the hard blocker; §4 Step A clears it.
2. **PLATFORM_ADMIN bootstrap (§9)** is required before any Portal business feature returns
   non-403 — but it is done *after* the image is live (operator must log in against the new image
   first). Not a pre-deploy blocker; a post-deploy gate for §12 Steps 10–14.
3. **Confirm (read-only) the OAuth redirect URI** `https://api.bakerrang.com/auth/google/callback`
   exists in the live OAuth client (§6). Expected present; verify, don't modify.
4. **Operator must have Firestore write access** to set `platformRole` (console or a
   `datastore.user`+ identity). Not a code blocker.

No blocker requires a code change. Nothing in `firestore.indexes.json`, the OAuth client, DNS,
service accounts, or GitHub settings needs to change for 2.5c.

---

## Output 16 — Is the 2.5c API cutover ready to execute?

**Yes — ready, conditional on performing §4 Step A (config) before the §12 Step 5 image deploy.**

- All infrastructure preconditions are verified present: preview secret + its IAM, media bucket +
  objectAdmin, runtime SA `datastore.user`, all legacy secrets, unchanged revision/image baseline.
- The runtime contract is fully known and additive; no secret values are handled.
- No new Firestore index, no OAuth-client change, no data migration, no service-account change.
- The only sequencing hazard (image-only CI vs. boot-time required config) is understood and
  neutralized by Option A, and a fast, exact rollback (`update-traffic` → `bakerrang-api-00026-wtv`)
  is available.

The Client stays on its current image and runtime SA; its runtime-SA migration is explicitly out of
scope for 2.5c (§14 of the Spec) and unaffected by the API cutover.

**Recommended human confirmations before dispatch:** (a) OAuth redirect URI present; (b) operator
Firestore-write path for the `platformRole` grant; (c) a maintenance-friendly window, since Steps 3
and 5 are both live-impacting on the primary API.
