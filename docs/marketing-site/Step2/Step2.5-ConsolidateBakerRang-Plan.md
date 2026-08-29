# Step 2.5 Plan (Revision 2) — Single Live Cloud Environment + DEV as Local-Dev Backing

**Status:** Planning / read-only. **Nothing was migrated, deleted, deployed, or mutated.**

**This revision supersedes the previous data-migration plan.** The key change: **there is no
DEV → MAIN Firestore or media migration.** The live platform starts **clean** in the existing MAIN
project; `bakerrang-dev` is demoted from "a second deployed environment" to "a cheap backing project
that holds only local-development Firestore + media." All GCP/repo facts below were verified live via
`gcloud` and by reading source. Items I could not directly observe are marked **(verify)**.

Discovery ground truth (unchanged, carried from Rev 1):
`MAIN = avian-cable-379805` (num `307696703523`, `us-west1`); `DEV = bakerrang-dev`
(num `1006288410962`, `us-west1`). MAIN serves `bakerrang.com`/`api.bakerrang.com` via **Cloud Run
domain mappings** (Compute API disabled → no LB). DEV runs a full external ALB at `8.232.231.135`.
Full inventory is in §5/§6 and the Appendix.

---

## 1. Corrected target architecture

```
LOCAL DEVELOPMENT (no GCP deploy, no DNS, no LB)
    localhost client (3000) · API (8080) · Portal (~3001) · Renderer (3002)
        ↓  (developer ADC / local Google credentials)
    bakerrang-dev Firestore (default)   +   gs://bakerrang-dev-media-marketing
        FIRESTORE_PROJECT_ID=bakerrang-dev
        MEDIA_BUCKET_NAME=bakerrang-dev-media-marketing

LIVE (the one and only deployed environment)
    main branch ── CI/CD ──▶ avian-cable-379805
        bakerrang-api · bakerrang-portal · bakerrang-site-renderer · bakerrang-client   (Cloud Run)
        Firestore (default)  [starts CLEAN — legacy app data already lives here]
        gs://bakerrang-media-marketing  [NEW, starts empty]
        ONE external Application Load Balancer  (api/portal/sites/apex + customer custom domains)
        FIRESTORE_PROJECT_ID=avian-cable-379805
        MEDIA_BUCKET_NAME=bakerrang-media-marketing
```

One deployed cloud environment. `bakerrang-dev` keeps **only** Firestore + the media bucket (plus the
IAM the developer needs to reach them); its Cloud Run / LB / WIF / deploy stack is deleted (§6).

---

## 2. Exact local-vs-live data model

| Concern | LOCAL (dev) | LIVE (prod) |
|---|---|---|
| Firestore project | `bakerrang-dev` `(default)` | `avian-cable-379805` `(default)` |
| Firestore contents | throwaway platform test data (tenants, leads, media, `siteDomains`, …) | legacy app data (users, vaults, wow, resumes, …) **already present**; platform collections **start empty** |
| Media bucket | `gs://bakerrang-dev-media-marketing` (public-read, `tenants/{id}/media/{id}`) | `gs://bakerrang-media-marketing` (NEW, same design, starts empty) |
| Auth to data | developer ADC (`gcloud auth application-default login`) | Cloud Run runtime SAs (`bakerrang-api@`, `bakerrang-frontend@`) |
| Ingress | direct `localhost` | one external ALB + DNS/TLS |

- **No export/import** of `tenants`, `members`, `site`, `published`, `leads`, `notes`, `media`,
  `siteDomains`, `tenantSiteDomains`, `users`, or any other DEV platform collection into MAIN.
- **No media object copy** DEV → MAIN. Live media accrues from live uploads.
- The `users` **collision concern disappears** entirely — MAIN's real `users`/`vaults`/etc. are never
  touched by a migration, and DEV `users` are never imported.

**Separation is explicit and must stay explicit.** `server/config/firestoreConfig.js`
(`resolveFirestoreProject`) already **requires** `FIRESTORE_PROJECT_ID` and throws if unset — there is
**no implicit/default project fallback**, and this plan keeps it that way. Same for
`resolveMediaBucketName` (`MEDIA_BUCKET_NAME` required).

---

## 3. Local development configuration requirements

Audited from source (`server/config/runtimeConfig.js`, `platform/apps/site-renderer/.env.example`,
`client/src/App.jsx`, `client/vite.config.js`).

**API (`server/`) — minimal local `.env` contract** (validators are exact names from
`validateServerRuntimeConfig`):
```
NODE_ENV=development
PORT=8080
FIRESTORE_PROJECT_ID=bakerrang-dev
MEDIA_BUCKET_NAME=bakerrang-dev-media-marketing
SESSION_SECRET=<local dev value>
GOOGLE_OAUTH_CLIENT_ID=<dev OAuth client>
GOOGLE_OAUTH_CLIENT_SECRET=<dev OAuth secret>
SERVER_DOMAIN=http://localhost:8080         # required, must be a bare http/https origin
PORTAL_DOMAIN=http://localhost:3001         # required (CORS/allowed origins)
SITE_RENDERER_DOMAIN=http://localhost:3002  # required
CLIENT_DOMAIN=http://localhost:3000         # optional
# PREVIEW_TOKEN_SECRET only *required* when NODE_ENV=production; set locally to test preview links
# Legacy feature keys as needed: CSRF_SECRET, CHAT_GPT_API_KEY, ELEVEN_LABS_API_KEY,
#   DEEPGRAM_API_KEY, BLIZZARD_CLIENT_ID, BLIZZARD_CLIENT_SECRET, CHATBOT_VOICE_ID
# ALLOW_DRAFT_PUBLIC_SITES=true to preview DRAFT sites locally (production-ceilinged)
```
Note: there is **no `CHATBOT_ORIGIN`** validator in the codebase (the chatbot uses `CHATBOT_VOICE_ID`);
the spec's "CHATBOT_ORIGIN if applicable" resolves to **not applicable**.

**Renderer (`platform/apps/site-renderer/`) local** (from its `.env.example`):
```
SITE_API_BASE_URL=http://localhost:8080            # server-side fetch target (required)
NEXT_PUBLIC_SITE_API_BASE_URL=http://localhost:8080 # build/client (lead form)
SITE_PUBLIC_ORIGIN=http://localhost:3002           # required, valid origin
SITE_PUBLIC_INDEXING_ENABLED=false                 # must be exactly 'true'|'false'
```

**Portal (`platform/apps/portal/`) local:** `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`,
`NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=http://localhost:3002`, `PORTAL_BASE_URL=http://localhost:3001`,
`CUSTOM_DOMAIN_IPV4_ADDRESS`/`CUSTOM_DOMAIN_CNAME_TARGET` (any placeholder locally). **(verify** exact
portal dev port — renderer/API ports are pinned by their `.env.example`; portal assumed 3001**)**.

**Client (`client/`) local:** `npm run dev` (Vite, port 3000). The API base is **hard-coded** at
`client/src/App.jsx:20` (`SERVER_PREFIX='https://api.bakerrang.com'`) — so a client pointed at a local
API needs a source/local override **(verify** whether local dev currently just uses the deployed API;
if so, no change needed**)**. No build-args, no runtime env otherwise.

**Never commit local credentials or secret values.** `.env` files stay untracked (already the pattern —
`server/.env` is git-ignored).

---

## 4. Local custom-domain testing approach

The renderer resolves a request's `Host` → tenant by calling the API's public domain endpoint, backed
by DEV Firestore. Audited mechanics:

- **Host normalization** (`server/domain/siteDomain.js` → `normalizeRequestHostname`): it **strips the
  port** (`^(.+):(\d{1,5})$` → keeps the host), lowercases, IDNA-normalizes, and then requires a
  **valid DNS hostname with ≥ 2 labels**, rejecting IPs and bare single labels. **Consequence:**
  `localhost:3002` normalizes to `localhost`, which has one label → **rejected**. Use a **dotted** fake
  hostname instead: `test.localhost`, `acme.local`, `demo.test` all normalize cleanly (port stripped).
- **Resolution data** (`server/services/siteDomainService.js`): active domains live in
  `siteDomains/{hostname}` (status `ACTIVE`) with a `tenantSiteDomains/{tenantId}` pointer;
  `resolveActiveDomain(hostname)` returns `{ tenantId, canonicalHost }`. So local custom-domain testing
  just needs a **fake `siteDomains/{acme.local}` ACTIVE doc** (pointing at a local test tenant) in DEV
  Firestore — creatable through the normal portal domain flow or a one-off local write.

**Two supported local methods:**
- **A — curl with explicit Host** (fastest, no OS changes):
  `curl -H "Host: acme.local" http://localhost:3002/` and `…/contact`.
- **B — hosts file** (real browser): add `127.0.0.1 acme.local` to
  `C:\Windows\System32\drivers\etc\hosts`, then browse `http://acme.local:3002/`. The renderer forwards
  the `Host` (`acme.local:3002`) to the API, whose normalizer strips `:3002` → `acme.local`.

**Locally reproducible** (application-level): Host → tenant resolution, `/`, `/contact`, other renderer
routes, published-site content, redirects, and canonical/SEO logic (set `SITE_PUBLIC_ORIGIN` to the
hostname under test where canonical URLs matter).
**Not reproduced locally** (infrastructure): public DNS, Google LB routing, managed-certificate
issuance, real HTTPS custom-domain activation. No public DNS or TLS is needed for app-level testing.

---

## 5. Exact DEV resources to KEEP

- **Project `bakerrang-dev`** (do **not** delete the project).
- **Firestore `(default)`** — local-dev/test platform data.
- **Bucket `gs://bakerrang-dev-media-marketing`** — local-dev uploads/gallery/hero/logo/published-media
  testing (keep its public-read IAM if the local renderer still serves public image URLs).
- **Minimal IAM** for the developer's own Google account to read/write those two resources locally
  (Firestore User + Storage Object Admin on the bucket, or via ADC as the owner account). No runtime SA
  is required for local work.

Optional keep **(verify** need before removing**):** DEV secrets are **not** needed locally (local `.env`
holds dev values), so DEV Secret Manager entries are in the *remove* set unless a local flow reads them.

---

## 6. Exact DEV resources to REMOVE (deployed stack only)

After live consolidation succeeds (do **not** delete during planning):

- **Cloud Run:** `bakerrang-api-dev`, `bakerrang-portal-dev`, `bakerrang-site-renderer-dev`.
- **External LB:** forwarding rule `bakerrang-web-dev-https-rule`; target proxy
  `bakerrang-web-dev-https-proxy`; URL map `bakerrang-web-dev-map`; backend services
  `bakerrang-{api,portal,renderer}-dev-backend`; serverless NEGs `bakerrang-{api,portal,renderer}-dev-neg`;
  Certificate Manager cert `bakerrang-dev-cert`; reserved IP `bakerrang-web-dev-ip` (`8.232.231.135`).
- **Artifact Registry:** repo `bakerrang-dev` and `cloud-run-source-deploy` (deployment images no longer
  needed).
- **WIF:** provider `github/providers/bakerrang-dev`, pool `github`, deployer SA
  `bakerrang-github-dev-deployer@…`.
- **Runtime deploy SAs (if unused locally):** `bakerrang-api-dev@`, `bakerrang-frontend-dev@`.
- **Secrets (if not used locally):** the eight `bakerrang-dev-*` entries.
- **GitHub:** `development` Environment + its variables; `.github/workflows/deploy-dev.yml`;
  `.github/workflows/verify-gcp-auth-dev.yml`.
- **DEV DNS records** (in MAIN's `bakerrang.com` zone): `api-dev`, `portal-dev`, `sites-dev`,
  `custom-dev` A records + the `custom-dev` verification `TXT`.

**KEEP:** the project, Firestore, `bakerrang-dev-media-marketing`, and the developer's local IAM (§5).

---

## 7. MAIN runtime-config checklist (audited validator names)

Deploy nothing to MAIN's live `bakerrang-api` until these are present, or the API refuses to start.

**API (`bakerrang-api`) — `validateServerRuntimeConfig` (`server/config/runtimeConfig.js`):**
| Var | Required? | Live value |
|---|---|---|
| `FIRESTORE_PROJECT_ID` | yes (no fallback) | `avian-cable-379805` |
| `MEDIA_BUCKET_NAME` | yes | `bakerrang-media-marketing` (§9) |
| `SESSION_SECRET` | yes | Secret Manager `bakerrang-session-secret` |
| `GOOGLE_OAUTH_CLIENT_ID` | yes | existing live OAuth client |
| `GOOGLE_OAUTH_CLIENT_SECRET` | yes | Secret `bakerrang-google-oauth-client-secret` |
| `SERVER_DOMAIN` | yes (origin) | `https://api.bakerrang.com` |
| `PORTAL_DOMAIN` | yes (origin) | `https://portal.bakerrang.com` |
| `SITE_RENDERER_DOMAIN` | yes (origin) | `https://sites.bakerrang.com` |
| `CLIENT_DOMAIN` | optional (origin) | `https://bakerrang.com` |
| `PREVIEW_TOKEN_SECRET` | **required when `NODE_ENV=production`** | **NEW** Secret `bakerrang-preview-token-secret` (§ secrets) |
| legacy: `CSRF_SECRET`, `CHAT_GPT_API_KEY`, `ELEVEN_LABS_API_KEY`, `DEEPGRAM_API_KEY`, `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET`, `CHATBOT_VOICE_ID` | as today | preserve existing `bakerrang-*` secrets |
| `ALLOW_DRAFT_PUBLIC_SITES` | must be **unset/false** in prod (production ceiling) | (unset) |

⚠️ **The current live `bakerrang-api` predates several of these validators** (it runs an older image).
The first pipeline deploy of `server/` to MAIN is a **live cutover** (§12/§14) and will fail to boot if
any required var is missing — so set the full env on the service *before/with* that deploy, and
**preserve every legacy var the current service already has** (audit the live service's current env with
`gcloud run services describe bakerrang-api` first; do not blind-overwrite).

**Renderer (`bakerrang-site-renderer`):** build-arg `NEXT_PUBLIC_SITE_API_BASE_URL=https://api.bakerrang.com`;
runtime `SITE_API_BASE_URL=https://api.bakerrang.com`, `SITE_PUBLIC_ORIGIN=https://sites.bakerrang.com`,
`SITE_PUBLIC_INDEXING_ENABLED=true` (live indexing on).

**Portal (`bakerrang-portal`):** build-args `NEXT_PUBLIC_API_BASE_URL=https://api.bakerrang.com`,
`NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=https://sites.bakerrang.com`,
`CUSTOM_DOMAIN_IPV4_ADDRESS=<MAIN LB IP>` (reserve early — §13),
`CUSTOM_DOMAIN_CNAME_TARGET=<optional>`; runtime `PORTAL_BASE_URL=https://portal.bakerrang.com`.

**Client (`bakerrang-client`):** none (static; API base hard-coded).

**Secrets:** MAIN already has `bakerrang-{session,csrf,google-oauth-client,chat-gpt-api-key,eleven-labs-api-key,
deepgram-api-key,blizzard-client}-secret`. **Create one new secret** `bakerrang-preview-token-secret`
(value inserted out-of-band; never in GitHub vars/docs/source). Grant the API runtime SA
`secretAccessor` on exactly the secrets it reads. (Rotate the git-exposed keys while populating.)

---

## 8. MAIN Cloud Run bootstrap plan

MAIN currently has `bakerrang-api` + `bakerrang-client` (live) but **lacks** `bakerrang-portal` and
`bakerrang-site-renderer`. Because deploy IAM is **service-scoped** (`run.developer` per named service),
the services must exist before the deployer can target them.

- **Create `bakerrang-portal` and `bakerrang-site-renderer`** as new services (bootstrap with a
  placeholder image, e.g. `gcr.io/cloudrun/hello`, then let the pipeline replace by digest). These are
  **new services on `*.run.app` only** → **zero live impact**.
- **Runtime SAs:** create `bakerrang-frontend@avian-cable-379805…` and assign it to
  `bakerrang-portal`, `bakerrang-site-renderer`, and (later) `bakerrang-client`. `bakerrang-api` keeps
  `bakerrang-api@avian-cable-379805…`.
- **Client SA migration is deliberate and separate:** `bakerrang-client` currently runs on the
  **default compute SA**; move it to `bakerrang-frontend@` in a **standalone** step (one
  `gcloud run services update --service-account` call), **never bundled into an image deploy** (the
  reusable deploy workflow fails a deploy whose runtime SA changed).
- **Grant deployer IAM** on the two new services (`run.developer`) and `serviceAccountUser` on the two
  runtime SAs after they exist (§10).

---

## 9. MAIN media + Artifact Registry plan

**Media bucket (NEW, no copy from DEV):** create **`gs://bakerrang-media-marketing`** in `us-west1`
with UBLA on, `allUsers:objectViewer` public-read (mirrors the DEV/renderer contract — verify the
current renderer still builds public object URLs), **no browser-upload CORS** (uploads are
API-streamed multipart → GCS, so CORS is unnecessary), and the same relative object scheme
`tenants/{tenantId}/media/{mediaId}`. Recommended name **`bakerrang-media-marketing`** (parallels the
DEV name; confirm global bucket-name availability before creating). Starts empty.

**Artifact Registry (NEW):** create **one** Docker repo **`bakerrang`** in `avian-cable-379805`/`us-west1`.
Image names `api`, `portal`, `site-renderer`, `client`. The reusable workflow parameterizes
`AR_REPOSITORY` + per-service `image_name`, so this is a variable value + a new `client` image name.
Legacy `gcr.io/avian-cable-379805/*` images (current api/client) **stay** temporarily for
rollback/reference — do not delete during foundation work.

---

## 10. MAIN WIF / deployer plan (mirror the proven DEV least-privilege model)

Create fresh in `avian-cable-379805` (`307696703523`) — **no reuse of DEV WIF**:

- **Pool** `github`; **provider** e.g. `bakerrang` with the **same immutable trust condition**
  independently enforced by WIF:
  `assertion.repository_owner_id == '2282360' && assertion.repository_id == '715929041' && assertion.ref == 'refs/heads/main'`.
- **Deployer SA** e.g. `bakerrang-github-deployer@avian-cable-379805…` with **no project-level roles**:
  - `roles/artifactregistry.writer` on AR repo `bakerrang` only.
  - `roles/run.developer` on the four named services only.
  - `roles/iam.serviceAccountUser` on `bakerrang-api@` and `bakerrang-frontend@` only.
  - `roles/iam.workloadIdentityUser` to
    `principalSet://…/workloadIdentityPools/github/attribute.repository_id/715929041`.
- No long-lived keys. After cutover, delete the DEV pool/provider/deployer SA (§6/§16).

---

## 11. Fourth-service (client) CI/CD plan

Keep `client/` independent (do **not** move under `platform/`). Target graph: `server/**`→API,
`platform/apps/portal/**`→Portal, `platform/apps/site-renderer/**`→Renderer, `client/**`→Client;
shared `platform/packages/*` keep their existing portal/renderer fan-out. Client-only changes must not
trigger API/Portal/Renderer; platform changes must not trigger client (already true — the classifier's
`PATH_RULES` maps `client/` to nothing today).

- **`scripts/ci/classify-changes.mjs`:** change the `{ prefix: 'client/' }` rule to
  `ci:['client'], deploy:['client']`; add `client`/`deploy_client` to the result + `writeGitHubOutputs`.
  Extend `classify-changes.test.mjs` (the test gates every workflow).
- **`ci.yml`:** add a `client-ci` job (`npm ci && npm run lint && npm run build` in `client/`, plus a
  no-build-arg `docker build client` packaging validation) gated on `changes.outputs.client`; add to
  `ci-passed`. Remove the vestigial `production` branch trigger.
- **Reusable `_deploy-cloud-run.yml`:** add a `client` case to *Resolve service configuration*
  (`service_name=$CLIENT_SERVICE`, `image_name=client`, `smoke_url=<client base>`) and to *Reuse or
  build immutable image* (`docker build "${common_args[@]}" client`, no build-args). Add `CLIENT_SERVICE`
  env.
- **Client smoke assertion** (from behavior): HTTP 200 on `https://bakerrang.com/` **and** body contains
  the SPA shell (e.g. `<div id="root"` / `<title>BakerRang`). Digest-pinned image + runtime-SA-unchanged
  check inherited from the reusable workflow.

---

## 12. Manual-first live deployment strategy

Create a **new** live workflow (do **not** repurpose `deploy-dev.yml` in place):

- **`.github/workflows/deploy.yml`**, initially **`on: workflow_dispatch` only**, restricted so dispatch
  runs against **`main`** only. Environment: **`production`** (MAIN-project vars). Authenticates to MAIN
  via **MAIN WIF** (§10); WIF independently enforces owner/repo/ref regardless of workflow config.
- This lets the full four-service pipeline be exercised against MAIN **on demand** — build → AR → deploy
  the **new** Portal/Renderer (safe) and, deliberately, the **live** API/Client (cutover, §14) — while
  `deploy-dev.yml` still exists as a fallback.
- **Activation (later, §16 step 2.5d):** flip `deploy.yml` to `on: push: branches: [main]` **and**
  simultaneously remove DEV auto-deploy (`deploy-dev.yml`). There must be **no steady state where one
  merge auto-deploys both** environments. End state: `main` → one live environment.

---

## 13. Minimal live Firestore / bootstrap requirements

Since nothing is migrated, the live platform needs only a tiny bootstrap:

- **Platform admin:** `checkAndStoreUser` (`server/services/authService.js`) merge-writes the user doc
  and **deliberately never accepts `platformRole` from the OAuth profile**; `requirePlatformAdmin`
  (`middleware/tenantAuth.js`) reads `platformRole` from `users/{id}`. **Bootstrap = one manual field
  write:** after the operator logs into the live portal once (which creates `users/{operatorId}`), set
  `users/{operatorId}.platformRole = 'PLATFORM_ADMIN'` in MAIN Firestore (console or a one-line
  `gcloud firestore`/admin write, out-of-band). No script needed.
- **Tenants:** none until the admin creates one through the portal (existing `POST /tenants`).
- **Leads / media / `siteDomains` / `tenantSiteDomains`:** start empty; created by normal product flows.
- **Indexes:** live platform lead/notes lists are single-field (`createdAt`) — no composite index. The
  audit item/folder-history queries need a composite index (`targetId|folderId` + `createdAt desc`);
  Firestore surfaces a one-click create link on first call — create it then (or add to
  `firestore.indexes.json`). Legacy vector indexes already deploy to MAIN via `.firebaserc`.

Prefer these existing mechanisms; **do not** build a data-migration/seed script.

---

## 14. Corrected 2.5a–2.5e sequence

- **2.5a — MAIN runtime foundation (zero live impact).** Enable Compute API; create AR repo `bakerrang`;
  media bucket `bakerrang-media-marketing`; runtime SA `bakerrang-frontend@`; new secret
  `bakerrang-preview-token-secret` (value out-of-band); **reserve the MAIN LB static IPv4 early**
  (it is baked into Portal images via `CUSTOM_DOMAIN_IPV4_ADDRESS`); bootstrap empty
  `bakerrang-portal` + `bakerrang-site-renderer` services; MAIN WIF pool/provider + deployer SA +
  resource-scoped IAM; set the MAIN API service env (§7) without redeploying its image yet.
- **2.5b — Unified four-service CI/CD (code; inert).** Client classifier + tests; `client-ci` +
  Docker validation; reusable-workflow client case; new `deploy.yml` (`workflow_dispatch`, Environment
  `production`, MAIN WIF). Merges to `main` do not touch MAIN until dispatched.
- **2.5c — Live platform bootstrap (no migration).** Dispatch builds so **Portal + Renderer** run
  AR-built digest images on `*.run.app` against MAIN Firestore/bucket; set the live admin `platformRole`;
  verify live Firestore/media config; prepare the controlled API upgrade (confirm full env from §7).
- **2.5d — Live cutover.** Controlled **API** deploy (live) and **Client** deploy if needed (live);
  build the MAIN LB + Certificate Manager certs; attach api/portal/sites + a test custom hostname;
  DNS cutover **subdomains first**, then **`api.bakerrang.com`**, then **`bakerrang.com` apex last**;
  verify; then flip `deploy.yml` to `push: main` and disable DEV auto-deploy.
- **2.5e — DEV deployment decommission.** Delete the DEV Cloud Run/LB/IP/NEGs/backends/certs/AR/WIF/
  deploy SAs/unneeded secrets, DEV DNS records, and the `development` Environment + DEV workflows.
  **KEEP** the `bakerrang-dev` project, Firestore, and `bakerrang-dev-media-marketing`.

Everything through 2.5c has **zero** production impact; the only scary steps are isolated in 2.5d.

---

## 15. Live-impact boundaries

**Zero / little traffic impact (safe to do anytime):**
create AR repo · create MAIN media bucket · reserve LB IP · create `bakerrang-frontend@` SA · create
MAIN WIF/deployer + IAM · bootstrap **new** `bakerrang-portal`/`bakerrang-site-renderer` services ·
set MAIN API env vars (without image redeploy) · configure the `production` GitHub Environment · all
CI/CD **code** changes · deploy/verify Portal+Renderer on `*.run.app` · build the LB and test it
against `*.run.app`/a throwaway host.

**Live impact (gate carefully, observe):**
first pipeline **deploy of `bakerrang-api`** (older live image → new validators) · any **deploy of
`bakerrang-client`** · the **client runtime-SA swap** · **`api.bakerrang.com` DNS** cutover ·
**`bakerrang.com` apex DNS** cutover · **enabling `push:main` auto-deploy** (and disabling DEV
auto-deploy in the same change).

---

## 16. Final DEV decommission checklist

Order (after live is verified; retain nothing that must be backed up — **there is no data to preserve**,
so no export needed):
1. Cloud Run: `bakerrang-api-dev`, `bakerrang-portal-dev`, `bakerrang-site-renderer-dev`.
2. LB frontend: `bakerrang-web-dev-https-rule` → `bakerrang-web-dev-https-proxy` → `bakerrang-web-dev-map`.
3. LB backends: `bakerrang-{api,portal,renderer}-dev-backend`; NEGs `bakerrang-{api,portal,renderer}-dev-neg`.
4. Cert Manager: `bakerrang-dev-cert`.
5. Reserved IP: release `bakerrang-web-dev-ip` (`8.232.231.135`).
6. Artifact Registry: `bakerrang-dev`, `cloud-run-source-deploy`.
7. WIF: provider `bakerrang-dev`, then pool `github`; deployer SA `bakerrang-github-dev-deployer@`.
8. Runtime deploy SAs `bakerrang-api-dev@`, `bakerrang-frontend-dev@` (if not used locally).
9. Secrets: `bakerrang-dev-*` (if not used locally).
10. DNS (MAIN zone): remove `api-dev`, `portal-dev`, `sites-dev`, `custom-dev` A + `custom-dev` TXT.
11. GitHub: delete `development` Environment + vars; delete `deploy-dev.yml`, `verify-gcp-auth-dev.yml`.

**KEEP:** project `bakerrang-dev`, Firestore `(default)`, `gs://bakerrang-dev-media-marketing`, and the
developer's local IAM to reach them.

---

## 17. Expected steady-state cost architecture

- **`bakerrang-dev` after decommission:** essentially **usage/storage only** — Firestore storage/ops
  for local test data + Cloud Storage for the media bucket. **Eliminated:** the DEV LB fixed hourly
  cost, the reserved LB IP, DEV Cloud Run deploy footprint, DEV Artifact Registry storage (~777 MB +
  `cloud-run-source-deploy`), and DEV WIF/deploy infra (no direct cost but removed for hygiene).
- **`avian-cable-379805` (live):** one Cloud Run set (scale-to-zero, low idle), one **new** external LB
  + one static IP, one AR repo's image storage, Firestore + one media bucket. This is the single
  intended fixed-cost surface (one LB, one IP).
- Net: the recurring saving is the **entire duplicate DEV LB + static IP + registry storage**; DEV
  drops to near-zero idle cost while remaining usable for local development.

---

## 18. Remaining blockers before starting 2.5a

1. **Compute Engine API is disabled on MAIN** — must be enabled before any LB/IP work (a prerequisite,
   not itself traffic-affecting).
2. **MAIN media bucket name availability** — confirm `bakerrang-media-marketing` is free (global
   namespace) before scripting 2.5a.
3. **Live `bakerrang-api` current env** — capture the running service's full env/secret wiring
   (`gcloud run services describe`) so the new required validators are added **without dropping** any
   legacy var (blocks the safe API cutover, not 2.5a foundation).
4. **Preview-token secret value** — must be generated/inserted out-of-band for `PREVIEW_TOKEN_SECRET`
   (required once MAIN API runs with `NODE_ENV=production`).
5. **(verify)** portal dev port + whether local `client/` should point at a local API (App.jsx hard-code).
6. **(verify)** exact `siteDomains`/`tenantSiteDomains` doc shape for seeding a local ACTIVE test domain.

None of these block the *very first* safe actions below.

---

## 19. Safe first HUMAN action

**Enable the Compute Engine API on `avian-cable-379805` and reserve the MAIN external static IPv4**
(a global/regional address for the future LB). Rationale: it is prerequisite to all LB work, has **no**
traffic impact, and the IP must be reserved **early** because `CUSTOM_DOMAIN_IPV4_ADDRESS` is baked into
Portal's immutable image at build time — so the value must exist before the first Portal build in 2.5c.
Pair it with confirming the media-bucket name is available.

---

## 20. Safe first CODEX implementation action

**Promote `client/` to a first-class deployable service in the change classifier** —
edit `scripts/ci/classify-changes.mjs` (the `client/` rule → `ci:['client'], deploy:['client']`, add
`client`/`deploy_client` outputs) and extend `scripts/ci/classify-changes.test.mjs` to lock the new
classification **and** the isolation guarantees (client-only ⇏ platform; `platform/packages/*` ⇏
client). It is pure, fully unit-tested code and **inert** until a workflow consumes `deploy_client`, so
merging it cannot deploy or break anything — the ideal first commit ahead of the CI/CD wiring in 2.5b.

---

### Appendix — key identifiers (for the implementer)

```
MAIN  : avian-cable-379805 (num 307696703523), us-west1
DEV   : bakerrang-dev      (num 1006288410962), us-west1   [KEEP: Firestore + media bucket only]
GitHub trust : owner_id 2282360, repo_id 715929041, ref refs/heads/main
DEV LB IP    : 8.232.231.135 (bakerrang-web-dev-ip)  [release in 2.5e]
MAIN media   : gs://bakerrang-media-marketing  (NEW, empty, public-read, tenants/{id}/media/{id})
DEV  media   : gs://bakerrang-dev-media-marketing  (KEEP for local dev)
API validators   : server/config/runtimeConfig.js  (FIRESTORE_PROJECT_ID, MEDIA_BUCKET_NAME,
                   SESSION_SECRET, GOOGLE_OAUTH_CLIENT_ID/SECRET, SERVER_DOMAIN, PORTAL_DOMAIN,
                   SITE_RENDERER_DOMAIN, CLIENT_DOMAIN?, PREVIEW_TOKEN_SECRET[prod])
Renderer runtime : SITE_API_BASE_URL, SITE_PUBLIC_ORIGIN, SITE_PUBLIC_INDEXING_ENABLED  (build: NEXT_PUBLIC_SITE_API_BASE_URL)
Host normalize   : server/domain/siteDomain.js normalizeRequestHostname  (strips port, needs ≥2 labels, rejects IP/localhost)
Custom domains   : siteDomains/{hostname}=ACTIVE + tenantSiteDomains/{tenantId}
Admin bootstrap  : set users/{operatorId}.platformRole='PLATFORM_ADMIN' (merge-write; never from OAuth profile)
Local ports      : client 3000 · API 8080 · renderer 3002 · portal ~3001(verify)
```
