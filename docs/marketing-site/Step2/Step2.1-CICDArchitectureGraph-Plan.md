# Step 2.1 — CI/CD Architecture & Monorepo Dependency Graph (Architecture Plan)

**Status:** Architecture / planning only. No workflows, Terraform, GCP resources, branches, or
product code are created or changed by this document. This is the analysis that drives Steps 2.2+.

**Companion spec:** [Step2.1-CICDArchitectureGraph-Spec.md](Step2.1-CICDArchitectureGraph-Spec.md)
· **Roadmap:** [Step2-RoadMap.md](Step2-RoadMap.md) · **DEV runbook:** [DEV-DEPLOYMENT.md](../../DEV-DEPLOYMENT.md)

---

## 0. How this document is organized

Sections map 1:1 onto the 43 required outputs in the spec (§61). Section headers carry the output
number in brackets, e.g. **[O3]**. Sections 1–8 are the findings and matrices; 9–39 are the
recommendations; 40–43 are risks, sequencing, open decisions, and definition of done.

---

## 1. [O1] Executive CI/CD architecture recommendation

**Recommendation in one paragraph.** Adopt a **single centralized change-detection job** feeding
**per-service jobs**, expressed as **one CI workflow + one deploy workflow per environment that
reuse one shared reusable "build-and-deploy-Cloud-Run" workflow**. Authenticate GitHub → Google with
**Workload Identity Federation (OIDC), never a JSON key**, using **two separate deployer service
accounts** (DEV and PROD) whose trust is scoped to this repository and to the specific branch/ref.
Deploy **image-only** to Cloud Run, preserving the Step 1 rule that runtime env/secrets are managed
out-of-band. Tag every image with the **immutable commit SHA** (`<env>-<shortsha>` for readability
plus the full digest for identity), and **never deploy `latest`**. Introduce **Terraform later
(Strategy B)** — for the *new* PROD project and the CI/CD identity plumbing only — and **leave the
working DEV environment manually provisioned** rather than importing it. Local development is
untouched: `npm` commands against `.env`/`.env.local` remain the only requirement to build and run
any service, and `scripts/deploy-dev.ps1` remains a valid manual fallback.

**Why this shape.** The repository has exactly **three deployable services** with a **small, static,
knowable dependency graph** and **two independent install roots** (`server/`, `platform/`). That is
too much coupling inside `platform/` for naïve per-file path filters to be safe (a `site-schema`
edit legitimately hits two services), but far too little scale to justify Nx/Turborepo/remote-cache
machinery. A hand-authored change-detection job that emits three booleans (`api`, `portal`,
`renderer`) is the correct altitude: explicit, auditable, testable, and centralized so the
path→service map lives in exactly one place.

**Non-negotiables honored:** (1) unrelated services never redeploy; (2) shared-package changes fan
out correctly; (3) local dev never requires GitHub/GCP/Terraform; (4) CI reuses the *same* npm
scripts developers run; (5) production can only deploy from the `production` branch.

---

## 2. [O2] Actual repository / dependency findings

### 2.1 Install roots and lockfiles (verified)

There is **no root `package.json`**. The repo is a "polyrepo-in-one-folder": several independent npm
projects.

| Install root | Lockfile | Workspaces? | Node | Deployed as |
|---|---|---|---|---|
| `server/` | `server/package-lock.json` | No | 24 (`node:24-bookworm-slim`) | **API** |
| `platform/` | `platform/package-lock.json` | **Yes** (`apps/*`, `packages/*`) | 24 (`.nvmrc`, `engines >=24 <25`) | **Portal + Renderer** |
| `client/` | `client/package-lock.json` | No | 20.9 (`node:20.9-alpine`) | Legacy — **not** a platform service |
| `extension/` | `extension/package-lock.json` | No | — | Browser extension — not server-deployed |
| `addon/` | — | — | — | Not a deployable service |

**Consequence:** `server/` and `platform/` install and build **completely independently**. A change
under one install root can never affect the other's dependency tree. This is the single most
important fact for the impact matrix: **API is fully decoupled from Portal/Renderer at the build
level.**

### 2.2 Server (API) findings

- Self-contained ESM (`"type": "module"`). A cross-boundary import scan (`server/` importing
  `../../platform` / `../../client`) returned **zero matches** — the API imports nothing outside
  `server/`.
- **No build step.** Runs source directly: `start` = `node bin/www.js`. Docker image is `COPY . .`
  + `npm ci --omit=dev`.
- Scripts: `test` = `node --import ./test/setup.js --test test/*.test.js`; `lint` = `standard`.
  **No `typecheck`** (plain JS), **no `build`**.
- `/health` endpoint exists (`server/app.js:120`).
- Rich domain surface already present: `routes/` (auth, tenants, publicSites, publicLeads, vault,
  …), `services/` (siteService, leadService, tenantService, mediaService, previewTokenService, …),
  `config/`, `domain/`, `validation/`.
- Dockerfile build context = `server/`; `.dockerignore` excludes `node_modules`, `.env*`, `test`.

### 2.3 Platform (Portal + Renderer) findings

`platform/` is a real npm-workspaces monorepo with **one** `node_modules` and **one** lockfile.
Root `platform/package.json` fans scripts out with `--workspaces --if-present`:

- `build`, `lint`, `typecheck`, `test` → run across all workspaces that define them.

Workspace scripts:

| Workspace | test | build | lint | typecheck |
|---|---|---|---|---|
| `@bakerrang/portal` | `vitest run` | `next build` | `eslint .` | `tsc --noEmit` |
| `@bakerrang/site-renderer` | `node --experimental-strip-types --test test/*.test.ts` | `next build` | `eslint .` | `tsc --noEmit` |
| `@bakerrang/ui` | `vitest run` | — | `eslint .` | `tsc --noEmit` |
| `@bakerrang/site-components` | — | — | `eslint .` | `tsc --noEmit` |
| `@bakerrang/site-schema` | — | — | `eslint .` | `tsc --noEmit` |

Both Next apps use `output: 'standalone'` and `outputFileTracingRoot = platform/` (they trace the
whole workspace, which is why their Docker build context is `platform/`, not the app folder).

### 2.4 Shared build/runtime script (important, non-obvious)

`platform/scripts/config-validation.mjs`:
- Imported **at build time by BOTH** `apps/portal/next.config.ts` and
  `apps/site-renderer/next.config.ts` (`validatePortalBuildConfig` / `validateRendererBuildConfig`).
- **Copied into the renderer runtime image** (`site-renderer/Dockerfile` copies
  `/app/scripts/config-validation.mjs`) and executed as the renderer container's startup preflight
  (`renderer-runtime`).

→ A change to this one file affects **both Portal and Renderer** (build) and the **Renderer runtime**.
It is a shared platform artifact, not app-local.

### 2.5 The dependency graph (verified from `dependencies` + `transpilePackages`)

```
site-schema  ──────────────┐
   ▲            ▲           │
   │            │           ▼
   │        site-components ──► site-renderer  (renderer transpiles: site-components, ui, site-schema)
   │            ▲
   ▼            │
  ui ───────────┴──────────► portal            (portal deps: ui, site-schema; transpiles both)
```

- `@bakerrang/portal` deps: `@bakerrang/ui`, `@bakerrang/site-schema`. **Does NOT depend on
  site-components** (confirmed: not in deps, not in its `transpilePackages`).
- `@bakerrang/site-renderer` deps: `@bakerrang/site-components`, `@bakerrang/site-schema`; also
  transpiles `@bakerrang/ui` (which it gets transitively through site-components).
- `@bakerrang/site-components` deps: `@bakerrang/site-schema`, `@bakerrang/ui`.
- Shared packages are **raw-TS, no build step** — they ship `./src/index.ts` and are transpiled by
  each consuming app. So a package edit only manifests through the **consuming app's** typecheck /
  test / build; there is no independent package artifact to deploy.

**Resulting fan-out:**

| Shared package | Consumed by (deploy targets) | Directly tested by |
|---|---|---|
| `site-schema` | **Portal + Renderer** | (no own tests) → exercised via portal/renderer tests + typecheck |
| `ui` | **Portal + Renderer** (renderer via site-components) | own `vitest` + consumer typecheck |
| `site-components` | **Renderer only** | (no own tests) → exercised via renderer tests + typecheck |

### 2.6 Legacy `client/`

Has its own Dockerfile (Vite build → nginx) and lockfile, Node 20, and is **not** among the three
DEV platform services (`bakerrang-api-dev`, `bakerrang-portal-dev`, `bakerrang-site-renderer-dev`).
**Out of scope** for platform CI/CD. Changes under `client/**` should trigger **no platform deploy**
(optionally a lightweight lint if the user wants, but recommend "ignore" initially — see §32).

### 2.7 Artifact Registry (partial — discovery item)

`deploy-dev.ps1` **derives** each image's AR repository by reading the existing Cloud Run service's
image reference and stripping the tag/digest; it does **not** hardcode the repo name. So the exact
AR repository name(s) are **not knowable from source alone** and are a discovery item (§33/O33).
Known: project `bakerrang-dev`, region `us-west1`, so the host is `us-west1-docker.pkg.dev`.

---

## 3. [O3] Path → CI (validation) impact matrix

"CI impact" = what must be **tested/linted/typechecked/built to validate correctness** on a PR. This
is intentionally **broader** than deploy impact (§7). ✓ = run; — = skip.

| Changed path | API CI | Portal CI | Renderer CI | Rationale |
|---|:--:|:--:|:--:|---|
| `server/**` (code) | ✓ | — | — | Independent install root; no platform coupling |
| `server/Dockerfile` | ✓ | — | — | API image only |
| `server/package-lock.json`, `server/package.json` | ✓ | — | — | API dependency tree only |
| `platform/apps/portal/**` | — | ✓ | — | Portal app only |
| `platform/apps/portal/Dockerfile` | — | ✓ | — | Portal image only |
| `platform/apps/site-renderer/**` | — | — | ✓ | Renderer app only |
| `platform/apps/site-renderer/Dockerfile` | — | — | ✓ | Renderer image only |
| `platform/packages/site-schema/**` | — | ✓ | ✓ | Consumed by both apps |
| `platform/packages/ui/**` | — | ✓ | ✓ | Portal direct; Renderer via site-components |
| `platform/packages/site-components/**` | — | — | ✓ | Renderer only |
| `platform/package-lock.json`, `platform/package.json` | — | ✓ | ✓ | Shared install for both apps |
| `platform/scripts/config-validation.mjs` (+ `.d.mts`) | — | ✓ | ✓ | Imported by both Next configs |
| `platform/tsconfig.base.json`, `platform/eslint.config.mjs` | — | ✓ | ✓ | Shared TS/lint config for both apps |
| `client/**`, `extension/**`, `addon/**` | — | — | — | Not platform services (legacy/aux) |
| `docs/**`, `README.md`, `*.md` | — | — | — | Docs only |
| `scripts/deploy-dev.ps1` | — | — | — | Ops helper; not built/tested by CI |
| `.github/workflows/**` | (self) | (self) | (self) | Validate workflow syntax; see §33 |
| `firestore.indexes.json`, `firebase.json`, `.firebaserc` | — | — | — | Not consumed by image builds (see §37) |
| root `.gitignore`, `AGENTS.md`, `CLAUDE.md` | — | — | — | No build effect |

**Fallback rule:** if change detection cannot classify a changed path (an unrecognized new path),
**fail safe by validating all three services**. Unknown ⇒ test everything. (Deploy stays narrower —
see §4.)

---

## 4. [O4] Path → deployment impact matrix

"Deployment impact" = which **Cloud Run services** must get a **new image** as a runtime result of
the change. Narrower than CI: a config/test-only change is validated but ships nothing.

| Changed path | Deploy API | Deploy Portal | Deploy Renderer | Rationale |
|---|:--:|:--:|:--:|---|
| `server/**`, `server/Dockerfile`, `server/package*.json` | ✓ | — | — | API image contents change |
| `platform/apps/portal/**` (incl. Dockerfile) | — | ✓ | — | Portal image contents change |
| `platform/apps/site-renderer/**` (incl. Dockerfile) | — | — | ✓ | Renderer image contents change |
| `platform/packages/site-schema/**` | — | ✓ | ✓ | Compiled into both bundles |
| `platform/packages/ui/**` | — | ✓ | ✓ | Compiled into both bundles |
| `platform/packages/site-components/**` | — | — | ✓ | Compiled into renderer bundle only |
| `platform/package-lock.json`, `platform/package.json` | — | ✓ | ✓ | Shared install → both images rebuild conservatively |
| `platform/scripts/config-validation.mjs` | — | ✓ | ✓ | In both builds + renderer runtime |
| `platform/tsconfig.base.json`, `platform/eslint.config.mjs` | — | — | — | Build/lint config; **does not change emitted runtime output** → no deploy (validated only) |
| `client/**`, `extension/**`, `docs/**`, `scripts/**`, `*.md` | — | — | — | Nothing deployable |
| `.github/workflows/**` | — | — | — | Workflow change ≠ app change (§33) |

**Deploy fallback rule:** unlike CI, deploy should **not** fan out on "unknown path." An unclassified
change deploys **nothing** and the run surfaces a notice ("no deployable services matched"), so a
mystery path can never silently redeploy production. If something genuinely needs deploying, the
author extends the map (a reviewed change) or uses `workflow_dispatch`.

> Note the deliberate asymmetry: `tsconfig.base.json` / `eslint.config.mjs` are **CI-impacting but
> not deploy-impacting** — they change how code is *validated*, not the bytes that ship. This is the
> §7 distinction made concrete.

---

## 5. [O5] API dependency graph

```
API (bakerrang-*-api)
  └── server/**            (all runtime code + config + domain + routes + services)
  └── server/package*.json (own dependency tree)
  └── server/Dockerfile
  (no imports outside server/; no platform/ or client/ coupling; no build step)
```

**Trigger set (deploy):** `server/**` ∪ `server/Dockerfile` ∪ `server/package-lock.json`.
Nothing in `platform/` or elsewhere can affect the API image.

---

## 6. [O6] Portal dependency graph

```
Portal (@bakerrang/portal → bakerrang-*-portal)
  └── platform/apps/portal/**
  └── platform/packages/ui/**            (direct dep, transpiled)
  └── platform/packages/site-schema/**   (direct dep, transpiled)
  └── platform/scripts/config-validation.mjs   (next.config build-time import)
  └── platform/package-lock.json + root platform/package.json (shared install)
  └── platform/tsconfig.base.json, eslint.config.mjs   (validation only)
  ✗ does NOT depend on site-components
```

**Trigger set (deploy):** portal app, `ui`, `site-schema`, shared platform install/scripts.

---

## 7. [O7] Renderer dependency graph

```
Renderer (@bakerrang/site-renderer → bakerrang-*-site-renderer)
  └── platform/apps/site-renderer/**
  └── platform/packages/site-components/**  (direct dep, transpiled)
  └── platform/packages/site-schema/**      (direct dep, transpiled)
  └── platform/packages/ui/**               (transitive via site-components; also in transpilePackages)
  └── platform/scripts/config-validation.mjs (build-time import AND runtime preflight in image)
  └── platform/package-lock.json + root platform/package.json (shared install)
  └── platform/tsconfig.base.json, eslint.config.mjs   (validation only)
```

**Trigger set (deploy):** renderer app, `site-components`, `ui`, `site-schema`, shared platform
install/scripts. Renderer is the **widest** — every shared package touches it.

---

## 8. [O8] Shared-package consumer analysis

| Package | Portal test | Renderer test | Portal deploy | Renderer deploy | Notes |
|---|:--:|:--:|:--:|:--:|---|
| `site-schema` | ✓ (typecheck + vitest) | ✓ (typecheck + node:test) | ✓ | ✓ | Universal type/schema layer; no own tests → correctness proven through consumers |
| `ui` | ✓ | ✓ | ✓ | ✓ | Has own `vitest`; also validated through both apps' typecheck |
| `site-components` | — | ✓ | — | ✓ | Renderer-only; no own tests → renderer tests/typecheck are its gate |

**Practical CI rule:** because `site-schema` and `site-components` have **no own test scripts**, the
platform-wide `npm test`/`npm run typecheck`/`npm run build` from `platform/` is what actually
exercises them. Do **not** try to test packages in isolation; run the affected **apps'** validation.

---

## 9. [O9] Lockfile / config / Dockerfile impact rules

1. **`server/package-lock.json`** → API CI + API deploy. Never platform.
2. **`platform/package-lock.json`** → Portal **and** Renderer CI + deploy (shared install; a
   transitive bump can affect either app even if the visible edit looks isolated). Conservative and
   correct.
3. **`server/Dockerfile`** → API only. **`platform/apps/portal/Dockerfile`** → Portal only.
   **`platform/apps/site-renderer/Dockerfile`** → Renderer only.
4. **`platform/scripts/config-validation.mjs`** → Portal + Renderer (build) + Renderer runtime.
5. **`platform/tsconfig.base.json` / `platform/eslint.config.mjs`** → Portal + Renderer **CI only**
   (validation), **no deploy** (does not change emitted output).
6. **`firestore.indexes.json`** → **no image build/deploy.** Firestore indexes are managed
   out-of-band (the audit composite index is created via the console one-click link, per project
   history). If index-as-code is ever wanted, that is a separate, explicit step — not part of image
   CI/CD (§52).

---

## 10. [O10] Recommended PR CI design

**Trigger:** `pull_request` targeting `master` **or** `production`. **No deployment on PR — ever.**

**Flow:**
1. **`changes` job** (change detection) computes `api`, `portal`, `renderer` booleans from the merge
   diff (`base...head`). One source of truth for the path map (the §3 matrix).
2. **Per-service validation jobs**, each `if: needs.changes.outputs.<svc> == 'true'`:
   - **API** (`server/`): `npm ci` → `npm run lint` → `npm test`.
   - **Portal** (`platform/`): `npm ci` → `npm run lint` → `npm run typecheck` → `npm test -w
     @bakerrang/portal` (+ `-w @bakerrang/ui`) → `npm run build -w @bakerrang/portal`.
   - **Renderer** (`platform/`): `npm ci` → `npm run lint` → `npm run typecheck` → `npm test -w
     @bakerrang/site-renderer` → `npm run build -w @bakerrang/site-renderer`.
   - Portal and Renderer share `platform/ npm ci`; when both are affected, running the platform-wide
     `npm run lint/typecheck/test/build` once is acceptable and simpler than per-workspace slicing.
3. A trivial **`ci-passed` gate job** (`needs: [all]`, `if: always()`) that fails unless every
   *required-and-run* job succeeded and none failed — this is the **single required status check** in
   branch protection (see §21), so skipped jobs from change detection don't block the merge.

**PR into `production`** runs the **same** validation. Because `production` should only ever receive
`master`'s already-tested content, this is a re-validation gate, not a different suite.

---

## 11. [O11] CI checks by component (smallest correct set)

| Impact category | Required checks | Explicitly excluded |
|---|---|---|
| API code | `standard` lint, `node:test` | typecheck (no TS), Docker build (see §12) |
| Portal | eslint, `tsc --noEmit`, vitest, `next build` | Docker build by default |
| Renderer | eslint, `tsc --noEmit`, node:test, `next build` | Docker build by default |
| `ui` change | portal + renderer full validation (typecheck/test/build) + `ui` vitest | — |
| `site-schema` change | portal + renderer full validation | — |
| `site-components` change | renderer full validation | portal (does not consume it) |

**`next build` is a required PR check** for Portal/Renderer. It is the cheapest reliable way to catch
standalone-output/RSC/type-erasure problems that `tsc` alone misses, and it mirrors what the image
build does. It is worth the minute.

---

## 12. [O12] Build validation vs Docker validation

- **PR default:** run **`npm`/`next build`** for affected services. Do **not** `docker build` on
  every PR (slow; the standalone output is already exercised by `next build`).
- **Add a Docker build check only when the Dockerfile or its inputs change** — i.e., gate a
  `docker build` (no push) job on changes to `**/Dockerfile`, `.dockerignore`, the relevant
  lockfile, or `config-validation.mjs`. That catches `COPY`-path, standalone-layout, and preflight
  regressions precisely when they can occur, without taxing ordinary code PRs.
- **Never push a deployable image from PR CI.** PR Docker builds are `--load`/discard only. Pushable,
  tagged images are produced solely by the post-merge deploy workflows.

---

## 13. [O13] Recommended DEV deployment workflow

**Trigger:** `push` to `master`.

**Flow (per the spec's 8 steps):**
1. **`changes` job** → `api/portal/renderer` booleans from the push diff
   (`github.event.before...github.sha`; fall back to "all" on a forced/unresolvable base).
2. **Gate:** the deploy workflow re-runs the same validation as PR CI for affected services
   (defense in depth; a green PR does not guarantee a green merge commit). Deploy jobs `needs` the
   validation jobs.
3–6. **Per-service deploy job** (matrix over affected services), each calling the **reusable
   `_deploy-cloud-run.yml`** with `{ service, environment: development }`:
   - `google-github-actions/auth` via **WIF** (DEV deployer SA).
   - Build the service image with the correct **build context + build args** (API: context
     `server/`; Portal/Renderer: context `platform/`, with the documented `NEXT_PUBLIC_*` and
     `CUSTOM_DOMAIN_IPV4_ADDRESS` build args — DEV values from GitHub **Environment variables**).
   - Tag immutably (`dev-<shortsha>`; also capture the pushed **digest**) and push to Artifact
     Registry.
   - **`gcloud run services update <service> --image <ref>`** — image-only, exactly like
     `deploy-dev.ps1`. **No `--set-env-vars`/`--set-secrets`** (§27).
7. **Health verification** (§25): API `/health` 200; Portal/Renderer HTTP smoke of the known DEV
   URL returning 2xx/expected. Verify against the **new revision** (revision-tagged URL if feasible)
   before/around traffic, or immediately after, and fail the job on a bad result.
8. **Report**: job summary with service, image digest, revision, commit, run URL (§51).

Services deploy as **independent matrix jobs** with `fail-fast: false` (§53): a Portal failure does
not block an API deploy from the same commit.

---

## 14. [O14] Recommended PROD deployment workflow

**Trigger:** `push` to `production`.

**Design:** **identical structure to DEV**, differing only by **inputs**, not by code:
- Same reusable `_deploy-cloud-run.yml`, called with `{ environment: production }`.
- PROD build args / URLs / project / region / AR repo / deployer SA come from the GitHub
  **`production` Environment** (variables) + the **PROD WIF binding** (§17–19).
- Runs under the GitHub **`production` Environment** so it inherits environment-scoped protection and
  a deployment history (§20).

Reuse is enforced by making the reusable workflow the *only* place that knows how to build+push+update
a Cloud Run service; DEV and PROD workflows are thin callers. This is precisely to prevent the
"two hand-written pipelines that drift" failure the spec warns about.

---

## 15. [O15] Image tag / revision naming strategy

- **Identity = the image digest** (`@sha256:…`). Deploy by digest where practical; the digest is the
  immutable truth.
- **Human-readable tag = `<env>-<short-sha>`**, e.g. `dev-a1b2c3d`, `prod-a1b2c3d`. Short SHA = first
  7–12 chars of the merge commit.
- **Never deploy `latest`.** `latest` may optionally be *also* pushed as a convenience pointer, but
  it is never the deployment identity and never what `gcloud run update` receives.
- **Per-service repository path** encodes the service (`.../<service>:<tag>`), so tags don't need the
  service name.
- **Cloud Run revision suffix**: let Cloud Run auto-name, but stamp the commit + run into a revision
  **label** / description for traceability (§51). Do not hand-craft revision names.
- **`deploy-dev.ps1` alignment (§46):** its default tag is `dev-<timestamp>`. Recommend evolving its
  default to accept/derive `dev-<shortsha>` so manual and automated DEV images share one convention
  (non-blocking; the script already accepts `-Tag`).

---

## 16. [O16] Artifact Registry strategy

**Recommendation: one AR repository per environment, per-service image paths, DEV and PROD in their
own GCP projects.**

```
DEV project  (bakerrang-dev):
  us-west1-docker.pkg.dev/bakerrang-dev/<repo>/api
  us-west1-docker.pkg.dev/bakerrang-dev/<repo>/portal
  us-west1-docker.pkg.dev/bakerrang-dev/<repo>/site-renderer

PROD project (bakerrang-prod, to be created):
  us-west1-docker.pkg.dev/bakerrang-prod/<repo>/api
  ...portal, site-renderer
```

- **Project-level separation** (DEV repo lives in the DEV project, PROD repo in the PROD project) is
  the cleanest blast-radius boundary: the DEV deployer SA has no IAM in the PROD project at all, so
  it *cannot* push or deploy PROD images even by accident. This beats one shared repo with two tag
  prefixes.
- **Per-service image path** (not per-service repo) keeps IAM and cleanup simple while preserving
  clear traceability.
- **Cleanup:** apply an AR **cleanup policy** (keep last N tagged + recent untagged, delete older)
  per repo. Simple, no janitor code.
- **Do not create extra repositories without value** — one repo per project is enough.
- **Discovery (§2.7):** confirm the *existing* DEV repo's exact name so the new convention either
  matches it or is a deliberate, documented rename. The DEV deploy workflow can keep deriving from
  the live service (as `deploy-dev.ps1` does) to avoid guessing.

---

## 17. [O17] GitHub → Google authentication (Workload Identity Federation)

**Use OIDC + WIF. Do NOT store a service-account JSON key in GitHub.** (No technical blocker exists;
WIF is fully supported for Cloud Run + Artifact Registry from GitHub Actions.)

**Conceptual resources (created later, §18/§19):**
- **1 Workload Identity Pool** (e.g. `github-pool`) — could be one per project or one shared; given
  project-level DEV/PROD separation, create the pool **in each project** so the trust and the
  deployer SA live together.
- **1 Workload Identity Provider** per pool, OIDC issuer `https://token.actions.githubusercontent.com`,
  with **attribute mapping** (`google.subject = assertion.sub`, plus `attribute.repository`,
  `attribute.ref`, `attribute.environment`) and an **attribute condition** restricting the
  repository (§19).
- **Deployer service account(s)** (§18), with `roles/iam.workloadIdentityUser` bound **only** to the
  specific principalSet (repo + ref/environment).
- Workflows request `permissions: id-token: write` (§49) and exchange the OIDC token for short-lived
  SA credentials via `google-github-actions/auth`.

---

## 18. [O18] DEV vs PROD deploy service accounts & IAM (least privilege)

Two separate service accounts, in their respective projects:

| SA | Project | Roles | Can deploy |
|---|---|---|---|
| `bakerrang-github-dev-deployer` | `bakerrang-dev` | `roles/run.developer` (update services), `roles/artifactregistry.writer` (push), `roles/iam.serviceAccountUser` **on the DEV runtime SA only** (to set/keep the run identity) | DEV only |
| `bakerrang-github-prod-deployer` | `bakerrang-prod` | Same three roles, scoped to PROD project + PROD runtime SA | PROD only |

- **Separation guarantees isolation:** the DEV deployer has **no bindings in the PROD project**, so a
  compromised or misused DEV path cannot touch PROD, and vice-versa.
- **Do not grant `roles/owner`/`editor`.** `run.developer` + `artifactregistry.writer` +
  `serviceAccountUser` is the minimal set for image-only Cloud Run updates.
- **Image-only deploys need no Secret Manager access** for the deployer (secrets are already attached
  to the service). If a future step has CI manage secret *references*, add `secretmanager.admin` at
  that time — explicitly, not now (§27).
- **Runtime identity ≠ deployer identity.** Each Cloud Run service keeps its own runtime SA; the
  deployer only needs `serviceAccountUser` to act as it.

---

## 19. [O19] GitHub trust restrictions

Trust must be **repository-scoped and ref-scoped**, and PROD tighter than DEV.

- **Provider attribute condition** (both pools): `assertion.repository == '<owner>/bakerrang'` — only
  this repo can mint tokens. Also constrain `repository_owner`.
- **DEV deployer binding** (`workloadIdentityUser`): principalSet limited to
  `attribute.repository == <repo>` **and** `attribute.ref == refs/heads/master` (only the `master`
  branch's runs can assume the DEV deployer).
- **PROD deployer binding:** principalSet limited to `attribute.ref == refs/heads/production`
  **and** (recommended) `attribute.environment == production` — so only a run on the `production`
  branch **operating in the GitHub `production` Environment** can assume the PROD deployer. This makes
  it impossible to deploy PROD from `master`, a feature branch, a fork, or an ad-hoc dispatch that
  isn't in the production environment (§55).
- **Difference summary:** DEV keys on branch=`master`; PROD keys on branch=`production` **plus** the
  GitHub Environment gate.

---

## 20. [O20] GitHub Environment recommendation

**Yes — create GitHub Environments `development` and `production`, even without a second manual
approver.**

- **`production` Environment is valuable regardless of approvals** because: (a) it is the natural home
  for PROD-only **variables** (project id, URLs, AR repo, WIF provider, deployer SA); (b) it can
  **restrict which branches** may run in it (`production` only), which pairs with the WIF
  `attribute.environment` condition (§19) to form the production safety gate; (c) it gives a
  first-class **deployment history/URL** in the GitHub UI.
- **Approvals:** the human approval is the **`master → production` PR review/merge** (§22). A second
  required reviewer after merge is **optional** and initially **off** (single operator). Leave the
  hook in place — flipping on "required reviewers" later is a one-click change if a teammate joins.
- **`development` Environment:** holds DEV variables and deployment history; no protection needed.

---

## 21. [O21] Branch-protection recommendation

Right-sized for a single primary operator; do not over-engineer.

**`master`:**
- Require a PR (no direct pushes).
- Require the **single `ci-passed` status check** (§10) to pass.
- Require branch to be up to date (optional; convenient at this scale).
- Linear history optional.

**`production`:**
- Require a PR (no direct pushes) — enforces "PROD only via promotion."
- Require `ci-passed`.
- Restrict who can push/merge to the operator.
- (Optional, later) required reviewer via the `production` GitHub Environment.

**Do not** add code-owner walls, multi-approver gates, or signed-commit mandates yet.

---

## 22. [O22] Production promotion model

**Model: `master` is DEV truth, `production` is PROD truth; promote via `PR master → production`.**
This is sound and is the recommended model.

- **Fast-forward / no-squash promotion:** promote by merging `master` into `production` **preserving
  history** (merge commit, not squash), so `production` never diverges in content from a known
  `master` state and the diff is always "what's new since last release."
- **Divergence risk & mitigation:** the main risk is `production` accumulating commits (hotfixes)
  that never return to `master`. Mitigate with the hotfix merge-back rule (§23) and by treating
  `production` as **downstream-only** — normal work never targets it except via promotion or a
  declared hotfix.
- **Keep it simple:** no release branches, no tags-as-releases requirement initially (tags optional
  for humans). The branch pair *is* the release model.

---

## 23. [O23] Hotfix model (lightweight)

```
branch hotfix/* from production
  → fix + PR into production (CI runs; merge = approval; PROD auto-deploys)
  → immediately open PR merging production → master (or cherry-pick) to prevent divergence
```

- Branch from `production` (not `master`) so the fix is minimal and based on live PROD.
- The merge-back to `master` is **mandatory and immediate** — this is the one discipline that keeps
  the promotion model honest. Automate a reminder (a scheduled "production ahead of master" check) if
  it's ever forgotten.
- For a single operator this is practical and low-ceremony.

---

## 24. [O24] Rollback model

Two distinct mechanisms, matched to purpose:

1. **Emergency mechanism (fast, no rebuild): Cloud Run revision traffic rollback.**
   `gcloud run services update-traffic <svc> --to-revisions <prev>=100`. Because images are immutable
   and revisions are retained, this is instant and safe. **This is the first response to a bad DEV or
   PROD deploy.** Expose it via `workflow_dispatch` (§56) and document the raw gcloud command.
2. **Source-of-truth correction (durable): Git revert → normal pipeline.** Revert the offending
   commit on the branch; the standard CI/CD rebuilds and redeploys the corrected image. This keeps
   the branch = deployed-state invariant true. Do this **after** the emergency traffic rollback has
   stabilized the service.
3. Redeploying a previous image SHA (`--image <old digest>`) is a valid middle option and is exactly
   what `deploy-dev.ps1` + the runbook already describe for DEV.

**Rule:** traffic rollback stops the bleeding; Git revert makes the branch tell the truth. Never
"fix" a rollback by editing env/secrets (per Step 1 discipline).

---

## 25. [O25] Deployment health-verification model

Keep it fast and deterministic; **no E2E in the deploy job.**

| Service | Verification |
|---|---|
| API | Cloud Run revision **Ready**; `GET /health` → **200** (retry a few times with backoff) |
| Portal | Revision **Ready**; `GET /` (or a lightweight known path) → 2xx and non-error HTML |
| Renderer | Revision **Ready**; `GET` of the shared published/preview URL → expected 2xx; the container's own `config-validation.mjs` preflight already guards startup |

- Prefer probing the **new revision URL** (revision-scoped) before shifting/confirming traffic where
  Cloud Run makes that available; otherwise probe the service URL right after update.
- Timeouts short (seconds), a handful of retries, then fail. No multi-page crawls, no auth flows.

---

## 26. [O26] Concurrency & failure-isolation model

**Concurrency groups:**
- **PR CI:** `group: ci-${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true` —
  supersede stale PR runs.
- **DEV deploy:** `group: deploy-dev-${{ service }}`, `cancel-in-progress: false` (or true per
  service) — never let two `master` deploys race the **same** service; different services proceed in
  parallel.
- **PROD deploy:** `group: deploy-prod`, `cancel-in-progress: false` — **serialize** all production
  deploys; never cancel a half-done PROD deploy.

**Failure isolation (§53):** per-service **matrix** deploy jobs with **`fail-fast: false`**. A Portal
deploy failure must not abort an API deploy from the same multi-service commit. Shared *prerequisite*
failures (e.g. `platform npm ci` broken) legitimately fail both platform services — that's correct,
because both genuinely can't build.

---

## 27. [O27] Runtime env / Secret Manager boundary

**Preserve the Step 1 boundary exactly:**

```
GitHub Actions  → builds + pushes images, runs `gcloud run services update --image` ONLY
Cloud Run       → retains all runtime env vars, secret references, IAM, routing, scaling
Secret Manager  → holds sensitive runtime values; attached to services out-of-band
```

- CI/CD **must not** run `--set-env-vars`/`--set-secrets` (or `--update-*`) on normal deploys. Image
  identity is the only thing a deploy changes. This mirrors `deploy-dev.ps1` and the runbook.
- The deployer SA needs **no Secret Manager role** for image-only deploys.
- If, later, Terraform manages the Cloud Run **service skeleton/config**, env/secret *wiring* becomes
  Terraform's job — still **not** GitHub Actions'. The GitHub side stays image-only either way.

---

## 28. [O28] Build secrets audit

**No secrets belong in any image build.** Verified build-time inputs:

- **API image:** no build args at all (`COPY . .` + `npm ci --omit=dev`). The `.dockerignore`
  excludes `.env*` and `test`. ✅ Nothing sensitive enters the build. (Confirm `server/.env` stays
  ignored — it is.)
- **Portal image:** build args `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_PREVIEW_ORIGIN`,
  `CUSTOM_DOMAIN_IPV4_ADDRESS`, `CUSTOM_DOMAIN_CNAME_TARGET` — **all public**, all embedded in the
  client bundle by design. ✅
- **Renderer image:** build arg `NEXT_PUBLIC_SITE_API_BASE_URL` — **public**. ✅

**Explicitly never inject** `SESSION_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET`, `PREVIEW_TOKEN_SECRET`,
Deepgram/OpenAI/ElevenLabs keys, or GCP credentials into a Docker build. The renderer's runtime
origins (`SITE_API_BASE_URL`, `SITE_PUBLIC_ORIGIN`) are **runtime** env, **not** build args — the
runbook already stresses this; keep it.

**One watch-item:** because `NEXT_PUBLIC_*` are baked at build time and are environment-specific, the
DEV and PROD images are **not** interchangeable — a PROD deploy must rebuild with PROD
`NEXT_PUBLIC_*`. This is a correctness rule, not a security issue: never "promote" a DEV Portal/Renderer
image to PROD; always rebuild from the `production` ref with PROD build args.

---

## 29. [O29] GitHub variables vs secrets plan

WIF removes almost all secrets. Recommended placement:

| Value | Where | Class |
|---|---|---|
| GCP project id (per env) | GitHub **Environment variable** (`development`/`production`) | var |
| Region (`us-west1`) | Repo variable (or Environment) | var |
| Cloud Run service names | Workflow constants / Environment vars | var |
| Artifact Registry location + repo | Environment variable | var |
| `NEXT_PUBLIC_*` build URLs (per env) | **Environment variables** | var (public) |
| `CUSTOM_DOMAIN_IPV4_ADDRESS` / LB IP | Environment variable | var |
| WIF provider resource name | Environment variable | var (not secret, but env-scoped) |
| Deployer SA email (per env) | Environment variable | var |

**Secrets:** ideally **none** for deploy (WIF + no runtime-secret writes). Keep the secret surface at
zero on the deploy path; if any token is ever unavoidable, it goes in the matching GitHub
**Environment secret**, not a repo secret. Environment-scoping is what keeps PROD values out of DEV
runs.

---

## 30. [O30] GitHub Actions workflow structure

**Recommendation: Model C (thin callers + shared reusable workflow) with a centralized
change-detection job** — a refinement of the spec's Model C.

```
.github/workflows/
  ci.yml                     # pull_request → master|production: change-detect + validate (no deploy)
  deploy-dev.yml             # push → master:      change-detect + validate + call reusable(dev)
  deploy-prod.yml            # push → production:  change-detect + validate + call reusable(prod), env: production
  _deploy-cloud-run.yml      # reusable: auth(WIF) + build(context/args) + tag + push + update + verify
  (optional) _changes.yml    # reusable change-detection, or a composite action, shared by all three
```

- **Why not Model A** (three independent deploy workflows): it scatters the path map and the
  build/deploy logic three ways and makes DEV/PROD drift likely — the exact anti-goal.
- **Why not pure Model B** (one mega-workflow): harder to read, and mixing PR-validate and
  push-deploy triggers in one file muddies the "PR never deploys" guarantee.
- **Model C wins** on clarity + shared logic + testability: one reusable workflow encodes *how* to
  ship a Cloud Run service; the three entry workflows encode *when/which/where*. The
  service-specific knowledge (build context, build args) lives in the reusable workflow keyed by
  `service`.

---

## 31. [O31] Native path filters vs centralized change detection

**Recommendation: centralized change detection (a single `changes` job), not native `paths:`
filters.**

- Native `on.push.paths` can gate a whole workflow but **cannot express the fan-out** cleanly
  (`site-schema` → 2 services; `ui` → 2; `site-components` → 1) without **duplicating** overlapping
  path lists across multiple workflows — the documented error-prone case.
- A single change-detection job (e.g. `dorny/paths-filter`, or a small hand-rolled `git diff`
  classifier) holds the §3/§4 map **once**, emits `api/portal/renderer` outputs, and every downstream
  job keys off those. One place to reason about, one place to fix, easy to unit-check by inspection.
- Keep native `on: push: branches` / `pull_request: branches` for **branch** gating (cheap and
  correct); do the **path→service** logic in the job.

---

## 32. [O32] Docs-only / ancillary path behavior

| Path | CI | Deploy |
|---|---|---|
| `docs/**`, `README.md`, `*.md`, `AGENTS.md`, `CLAUDE.md` | none required (optionally markdown lint) | none |
| `scripts/**` (ops helpers like `deploy-dev.ps1`) | none (optionally PSScriptAnalyzer later) | none |
| `.github/workflows/**` | validate on PR (§33) | none directly |
| `**/Dockerfile`, `**/.dockerignore` | affected service's CI + Docker build check (§12) | affected service |
| `server/package-lock.json` | API | API |
| `platform/package-lock.json` | Portal + Renderer | Portal + Renderer |
| root config (`.gitignore`, `firebase.json`, `firestore.indexes.json`, `.firebaserc`) | none | none |
| `client/**`, `extension/**`, `addon/**` | none (legacy/aux; optional isolated lint) | none |

A **docs-only PR should be mergeable with the `ci-passed` gate green having run essentially nothing**
— the gate job must treat "all service jobs skipped" as success.

---

## 33. [O33] Workflow-change behavior

- **On PR:** validate workflow files (YAML lint / actionlint) but **do not deploy** merely because a
  workflow changed.
- **On merge to `master`/`production`:** the **new** workflow definition takes effect for subsequent
  runs (GitHub always uses the workflow at the ref being run). A workflow-only commit that changes no
  service path should, by the §4 deploy matrix, **deploy nothing** — the change-detection map does
  not map `.github/**` to any service.
- **Exception to be explicit about:** if a workflow change *must* be exercised by an actual deploy
  (e.g. you changed the reusable deploy logic), do it via a deliberate `workflow_dispatch` re-deploy
  of a chosen service, not by implicitly redeploying everything.

---

## 34. [O34] Dockerfile-change rules (explicit)

- `server/Dockerfile` → **API** CI (+ Docker build check) + API deploy.
- `platform/apps/portal/Dockerfile` → **Portal** CI (+ Docker build check) + Portal deploy.
- `platform/apps/site-renderer/Dockerfile` → **Renderer** CI (+ Docker build check) + Renderer deploy.
- `platform/.dockerignore` (shared by both platform Dockerfiles) → **Portal + Renderer**.
- `server/.dockerignore` → **API**.

These are encoded directly in the §3/§4 change-detection map.

---

## 35. [O35] Lockfile / dependency change rules

- `server/package-lock.json` (or `server/package.json`) → **API only**. Independent tree.
- `platform/package-lock.json` (or root `platform/package.json`) → **Portal + Renderer** (CI +
  deploy). A single workspace install feeds both apps; a transitive change can alter either bundle
  even when the visible edit targets one workspace. **Conservative = correct here.**
- Per-workspace `package.json` edits (`apps/portal/package.json`, etc.) also update the shared
  lockfile, so in practice a dependency change shows up as a `platform/package-lock.json` diff and
  fans out to both — intended.

---

## 36. [O36] Shared-package build effects (decision table)

Restating §8 as explicit build/deploy decisions:

| Change | Portal test? | Renderer test? | Portal deploy? | Renderer deploy? |
|---|:--:|:--:|:--:|:--:|
| `ui/**` | ✓ | ✓ | ✓ | ✓ |
| `site-components/**` | ✗ | ✓ | ✗ | ✓ |
| `site-schema/**` | ✓ | ✓ | ✓ | ✓ |

(Portal has no dependency on `site-components`, so a `site-components`-only change never touches
Portal — the one asymmetry worth remembering.)

---

## 37. [O37] API ↔ Platform coupling check

**Finding: none at the build level.** Verified:
- No root `package.json`; separate lockfiles; `server/` imports nothing outside `server/`.
- No shared source module is imported by both `server/` and `platform/`.
- The only repo-root shared assets (`firestore.indexes.json`, `firebase.json`, `.firebaserc`) are
  **not** consumed by any image build and are managed out-of-band.
- `scripts/deploy-dev.ps1` orchestrates all three but is not a build input.

So a change under `server/` can never require a Portal/Renderer deploy, and vice-versa. The **only**
multi-service fan-out lives **inside** `platform/` (shared packages + shared platform config/scripts).

---

## 38. [O29-terraform] Terraform recommendation: **YES, but LATER and NARROW (Strategy B)**

- **Now (Steps 2.2–2.4): no Terraform.** Ship PR CI, WIF, and automatic DEV deploy using **gcloud +
  GitHub Actions** against the **existing** DEV infrastructure. Introducing Terraform before CI even
  exists would stall the immediate objective.
- **Later (Step 2.5): introduce Terraform for the *new* PROD project + shared CI/CD identity
  plumbing only.** Building PROD from scratch is exactly the moment IaC pays off (repeatable,
  reviewable, no click-ops drift), and there's nothing to import because PROD doesn't exist yet.
- **Rationale for the split:** Terraform's value is *provisioning long-lived infrastructure*, not
  *deploying application images* — which stays in GitHub Actions. The spec's hypothesis (Terraform =
  infra, Actions = app deploy) is correct and adopted.

---

## 39. [O30–O32 terraform] Terraform scope, DEV-import decision, and state

### [O30] Initial Terraform scope (Step 2.5, PROD-only)
Manage, from empty:
- PROD GCP project baseline (or accept a pre-created project — a discovery item, §42)
- Artifact Registry (PROD repo) + cleanup policy
- Cloud Run **service skeletons** for api/portal/renderer (names, region, runtime SA, ingress,
  scaling) — **not** their secret *values*
- Runtime service accounts + IAM
- Workload Identity Pool + Provider + **prod** deployer SA + `workloadIdentityUser` binding
- Secret Manager **secret resources + IAM** (the containers/placeholders), with **values injected
  out-of-band** (never in state/Git)
- LB / serverless NEGs / managed certs / DNS records for PROD hostnames

**Defer / leave out initially:** importing DEV, and anything that would create churn for no benefit
(e.g. re-homing working DEV resources).

### [O31] DEV Terraform-import: **do NOT import DEV** (Strategy B, not A)
DEV works and is the daily driver. Importing it is a side-project with real risk (an import mistake
can disrupt the working environment) and little upside. Optionally reconcile DEV into Terraform much
later once the PROD module is proven; not part of Step 2.

### [O32] Terraform state strategy (when introduced)
- **Remote state in a dedicated GCS bucket** (versioned, uniform bucket-level access, restricted
  IAM), **never in Git**.
- **Separate state per environment** (separate state file/prefix for PROD; a DEV state only if/when
  DEV is ever adopted).
- GCS backend provides **locking** via object generation/versioning; no separate lock table needed.
- State may contain sensitive values → treat the bucket as sensitive; keep secret *values* out of
  Terraform (reference Secret Manager, don't materialize secrets into state).

---

## 40. [O33/O34 combined] Production discovery checklist + naming/hostname decisions

### [O33] Production infrastructure discovery checklist (do before Step 2.4/2.5)
Do **not** assume historical BakerRang infra becomes the new PROD platform.

- [ ] Does a `bakerrang-prod` (or equivalent) GCP **project** already exist? If so, what currently
      lives in it, and can it be safely used?
- [ ] What is the **existing DEV Artifact Registry repo name** (derive from a live DEV service image)?
- [ ] Which **existing production/legacy resources must NOT be disturbed** (the legacy `client`, any
      current bakerrang.com serving infra, existing DNS)?
- [ ] What **Firestore project** backs PROD? (Step 1 mandates explicit `FIRESTORE_PROJECT_ID`, no
      discovery fallback — PROD needs its own value, e.g. a prod Firestore project.)
- [ ] What **media bucket** (`MEDIA_BUCKET_NAME`) for PROD, with the same public-read/UBLA posture?
- [ ] Which **Cloud Run services** to create (api/portal/renderer) and their runtime SAs?
- [ ] **LB / serverless NEG / managed-cert / DNS** architecture for PROD hostnames (mirror the DEV
      custom-domain setup?).
- [ ] **OAuth**: production redirect URIs / authorized origins for the PROD Portal + API hostnames.
- [ ] **Secret Manager**: which secrets must exist in PROD and who populates the values.
- [ ] Region: confirm `us-west1` for PROD (match DEV) or deliberately choose.

### [O34] Production naming + hostname decisions still required
- **Service naming — recommend explicit `-prod` suffixes** to mirror DEV and avoid ambiguity:
  `bakerrang-api-prod`, `bakerrang-portal-prod`, `bakerrang-site-renderer-prod`. (Prefer explicitness
  over bare names.)
- **Hostname decisions to make (no DNS changes now):**
  - Portal: `portal.bakerrang.com`
  - API: `api.bakerrang.com`
  - Public sites shared origin: `sites.bakerrang.com`
  - Tenant custom domains: the production equivalent of the DEV `custom-*` pattern (LB IP / CNAME
    target values differ from DEV's `8.232.231.135`).
  - **Excluded from this step:** `marketing.bakerrang.com` (future commercial signup — spec §44/§59).

---

## 41. [O35/O36] Local-development compatibility + `deploy-dev.ps1` role

### [O35] Local-development compatibility analysis (NON-NEGOTIABLE — passes)
The proposed design changes **nothing** about local dev:
- CI/CD lives entirely under `.github/` + (later) `infra/terraform/`. **No product code changes.**
- The app never becomes GitHub-aware: no workflow imports into `server/`/`platform/`; all
  GitHub/GCP identity is deployment infrastructure.
- Local flows are unchanged and remain the *only* requirement to build/run:
  - **API:** `cd server; cp .env.example .env; npm install; npm run start`
  - **Portal:** `cd platform; cp apps/portal/.env.local.example …; npm install; npm run dev:portal`
  - **Renderer:** `cd platform; …; npm run dev:sites`
- **CI reuses the same scripts** developers run (`npm run lint/test/typecheck/build`) — no CI-only
  build path. This is a design constraint, verified against §9.
- **After Terraform (Step 2.5):** local dev still needs **no** `terraform apply`, no GitHub Actions,
  no production IAM. Terraform provisions cloud infra only; ADC + `.env` remain the local contract.

### [O36] `deploy-dev.ps1` role after CI/CD
- **Keep it** as the **manual / emergency / offline DEV fallback** (e.g. GitHub outage, or deploying
  an uncommitted local build). Do not delete or invalidate it.
- **Alignment updates (non-blocking):** evolve its default tag toward `dev-<shortsha>` so manual and
  automated images share the §15 convention; keep its image-only, no-env-mutation behavior (it
  already matches the CI/CD boundary). It stays the reference implementation of "image-only DEV
  deploy."

---

## 42. [O37/O38] CI efficiency + permissions/action-pinning

### [O37] CI caching / efficiency
- **npm caching:** `actions/setup-node` with `cache: npm` keyed on each lockfile
  (`server/package-lock.json`, `platform/package-lock.json`). Meaningful, free.
- **Docker layer caching:** the platform Dockerfiles already split deps (`npm ci`) from build — use
  BuildKit + GitHub Actions cache (`cache-from/to: gha`) for the image builds. Modest, worthwhile;
  **do not** stand up a remote build cache (Nx/Turbo/Bazel) — no value at three services.
- **Concurrency cancellation** for superseded PR runs (§26). Change detection already skips
  unaffected services, which is the biggest saving.

### [O38] Workflow permissions + action pinning
- **Least-privilege permissions**, default `contents: read`; add `id-token: write` **only** on jobs
  doing WIF auth; add `deployments: write`/`pull-requests: write` only if using GitHub deployment
  statuses / PR comments. No broad `write` at workflow top level.
- **Action pinning:** prefer official `actions/*` and `google-github-actions/*`. Pin **first-party
  official actions to a major version tag** (e.g. `@v4`); pin **any third-party action to a full
  commit SHA**. Right for this maturity level — no extra supply-chain tooling needed.

---

## 43. [O39] CI/CD documentation plan

- **Create a new `docs/CI-CD.md`** (separate from `DEV-DEPLOYMENT.md`, matching the user's stated
  bias) once implementation lands, covering: branch model, the §3/§4 impact map, PR CI, DEV deploy,
  PROD deploy, WIF/identity, rollback, and the `deploy-dev.ps1` manual fallback.
- **Keep `DEV-DEPLOYMENT.md`** as the manual/runbook reference; add a short pointer from it to
  `CI-CD.md` (and vice-versa). Do not duplicate content — runbook = manual ops, CI-CD.md = automated
  pipeline.
- Document the WIF/GCP resource names and GitHub variable inventory so the identity plumbing is
  reproducible.

---

## [O40] Ranked risks / key design decisions

1. **Wrong fan-out on shared packages** (highest correctness risk). Mitigation: the centralized
   change-detection map (§31) encodes `site-schema/ui → both`, `site-components → renderer` in one
   place; CI "unknown ⇒ test all" fail-safe (§3).
2. **Accidental PROD deploy from the wrong ref.** Mitigation: layered gate — `production` branch
   protection + GitHub `production` Environment branch restriction + WIF `attribute.ref`/`environment`
   condition + a PROD deployer SA with no DEV/other privileges (§18/§19/§55).
3. **DEV/PROD env-baked image confusion** (`NEXT_PUBLIC_*` differ). Mitigation: never promote images;
   always rebuild PROD from the `production` ref with PROD build args (§28). Digest-based identity per
   env repo prevents cross-env reuse.
4. **CI/CD scope creep into runtime config.** Mitigation: hard rule — image-only deploys, no
   `--set-env`/`--set-secrets`; deployer SA lacks Secret Manager roles (§27).
5. **Production branch divergence via hotfixes.** Mitigation: mandatory immediate merge-back to
   `master` + a "production ahead of master" check (§23).
6. **Terraform-import-of-DEV rabbit hole.** Mitigation: Strategy B — never import working DEV; TF only
   for new PROD (§38).
7. **Secret leakage into image builds.** Mitigation: audited — only public `NEXT_PUBLIC_*` are build
   args; `.dockerignore` excludes `.env*` (§28).
8. **Unknown existing AR repo name / PROD project.** Mitigation: discovery checklist (§40) before
   2.4/2.5; DEV workflow can derive AR repo from the live service as the script does.
9. **Deploy job masking a bad revision (green pipeline, broken service).** Mitigation: mandatory
   health verification with failure = red run (§25/§26); traffic rollback runbook (§24).
10. **Legacy `client/` accidentally pulled into platform CI.** Mitigation: explicitly mapped to
    "no platform CI/deploy" (§2.6/§32).

---

## [O41] Proposed Step 2.2–2.x implementation sequence

Refined from the roadmap after these findings (the sequence largely matches the roadmap; the main
adjustment is folding change-detection into 2.2 as the shared foundation everything else consumes):

- **2.2 — PR CI + centralized change detection.** `ci.yml` + the change-detection job/action + the
  `ci-passed` gate. No cloud, no identity. Delivers the dependency-aware validation contract and the
  single source-of-truth path map. *(Do this first — it's the foundation and needs no GCP.)*
- **2.3 — GitHub → GCP Workload Identity (DEV).** DEV WIF pool/provider/deployer SA + trust scoped to
  `master`. No deploy yet; prove auth with a read-only gcloud step.
- **2.4 — Automatic selective DEV deploy from `master`.** `deploy-dev.yml` + `_deploy-cloud-run.yml`
  (reusable), image-only, health-verified, matrix/failure-isolated. `deploy-dev.ps1` remains fallback.
- **2.5 — Terraform + production infrastructure.** Strategy B: TF module for the new PROD project +
  PROD WIF/deployer + AR + Cloud Run skeletons + LB/cert/DNS + Secret Manager resources. Remote GCS
  state. Production discovery checklist completed here.
- **2.6 — Automatic selective PROD deploy from `production`.** `deploy-prod.yml` reusing the same
  reusable workflow with `environment: production`; production safety gate fully wired.
- **2.7 — Release / rollback / verification hardening.** `workflow_dispatch` for redeploy/rollback,
  traffic-rollback runbook, deployment metadata/traceability, `docs/CI-CD.md`.

Then the roadmap's product steps (2.8+) resume, now on a reliable pipeline.

---

## [O42] Human decisions genuinely required before implementation

1. **Confirm branch names** `master` + `production` (repo default is currently `main` per environment
   metadata — decide whether the permanent branch is truly `master` or `main`, and whether to rename).
   *(This is the one naming decision that blocks everything.)*
2. **Confirm the existing DEV Artifact Registry repo name** (derive from a live DEV service).
3. **PROD GCP project:** create new `bakerrang-prod` vs reuse an existing project — and which.
4. **PROD Firestore + media bucket** identities (explicit `FIRESTORE_PROJECT_ID`, `MEDIA_BUCKET_NAME`).
5. **PROD hostnames** (portal/api/sites) and whether to mirror the DEV LB/cert/custom-domain design.
6. **Service naming:** approve `-prod` suffix convention.
7. **Second PROD approver?** Default: no (single operator) — confirm.
8. **Terraform timing:** approve Strategy B (TF at 2.5, no DEV import).
9. **GitHub Environments:** approve creating `development` + `production` Environments.

*(None of these need action now — they are inputs to Steps 2.3+.)*

---

## [O43] Definition of done for Step 2.1

Step 2.1 is complete when **all** of the following exist as documented analysis (this document
satisfies them; no code/infra is produced):

- [x] Verified repository/dependency findings, grounded in actual files (not directory-name guesses).
- [x] Complete **path → CI** matrix and separate **path → deploy** matrix, including lockfiles,
      Dockerfiles, shared platform config/scripts, docs, and legacy/aux paths.
- [x] Explicit **API / Portal / Renderer dependency graphs** and **shared-package consumer** decision
      table, with the non-obvious edges called out (portal ⊄ site-components; `config-validation.mjs`
      shared; separate install roots).
- [x] Recommendations for **PR CI**, **DEV deploy**, **PROD deploy**, and the **workflow structure**
      (Model C + centralized change detection), with the native-filters-vs-change-detection call made.
- [x] **Image tagging**, **Artifact Registry**, **WIF identity**, **DEV/PROD SA & IAM**, **trust
      restrictions**, **GitHub Environments**, **branch protection**, **promotion**, **hotfix**,
      **rollback**, **health verification**, **concurrency/failure isolation**, **runtime/secret
      boundary**, and **variables/secrets** all decided.
- [x] **Terraform** decision (YES/LATER/NARROW, Strategy B) with initial scope, DEV-import stance, and
      state strategy.
- [x] **Production discovery checklist** + naming/hostname decisions enumerated.
- [x] **Local-development compatibility** explicitly verified as unchanged (non-negotiable met), and
      **`deploy-dev.ps1`** retained as fallback.
- [x] **Ranked risks**, the **2.2–2.7 sequence**, and the **human decisions** required before
      implementation.
- [x] Scope discipline honored: **no** workflows, Terraform files, GCP/GitHub mutations, branches, or
      product-code changes were made.
