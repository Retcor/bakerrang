# Phase 0 — Architecture Review

> **Purpose:** Technical inventory of the existing BakerRang system, produced to assess reuse
> potential before extending it into a reusable **multi-tenant platform for local businesses**
> (public marketing sites, reusable components, branding/themes, CMS, media management,
> services/service areas, lead capture, lightweight CRM, business dashboards, platform admin,
> custom domains, analytics/attribution, and future Google/Instagram/marketing integrations).
>
> **Scope:** Discovery only — no code was modified and no implementation plan is proposed here.
> This is the baseline other planning docs in `docs/marketing-site/` build on.
>
> _Date: 2026-08-12 · Status: baseline / living reference_

---

## 1. Repository Structure

A **monorepo-by-folder** (no workspace tooling — each app has its own `package.json` and
`node_modules`; there is no root `package.json`). Three deployable apps plus supporting folders.

```
bakerrang/
├── client/                 # React 18 + Vite SPA (frontend)
│   ├── src/
│   │   ├── App.jsx         # Routes + SERVER_PREFIX constant
│   │   ├── components/     # ~40 components (pages live here too, no /pages dir)
│   │   │   ├── WoW/         # feature sub-tree
│   │   │   └── icons/
│   │   ├── providers/      # AppProvider, AuthProvider, ThemeProvider, VaultProvider
│   │   ├── utils/          # request() API client, crypto.js, kdbx.js, vaultSettings.js
│   │   ├── constants/  styles.js  index.css
│   ├── nginx/nginx.conf    # SPA serve + history fallback
│   ├── Dockerfile          # multi-stage: vite build → nginx:alpine
│   └── vite.config.js
├── server/                 # Express (ESM) API
│   ├── app.js              # middleware chain + route mounting
│   ├── bin/www.js          # HTTP bootstrap (port 8080)
│   ├── routes/             # 10 routers (auth, vault, budget, wow, storybook, …)
│   ├── services/           # 11 services (business logic + Firestore access)
│   ├── middleware/security.js  # CSRF, rate limiters
│   ├── client/             # firestoreClient.js, firestoreSessionStore.js
│   ├── scripts/            # one-off ingestion/backfill scripts
│   ├── data/               # markdown knowledge (resume, wow tiers)
│   ├── multer.js           # in-memory upload config
│   └── Dockerfile          # single-stage node:20-alpine
├── extension/              # Chrome MV3 vault-autofill extension (Vite + crxjs)
├── addon/                  # WoW game addon (Lua export tool) — unrelated to web platform
├── firebase.json / .firebaserc / firestore.indexes.json  # Firestore index deploy only
├── CLAUDE.md / AGENTS.md   # extensive session notes (identical content)
└── README.md
```

**Build tools:** Vite 4 (client + extension), no bundler on the server (plain ESM Node).
**Linter:** StandardJS on both. **No TypeScript** (only `@types/react` for editor hints).
No test framework anywhere.

**Stray artifacts:** a `nul` file and `.playwright-mcp/` scratch output are present but irrelevant.

---

## 2. Backend Architecture

| Aspect | Finding |
|---|---|
| **Language** | JavaScript (ESM, `"type":"module"`), Node 20 |
| **Framework** | Express `~4.16` (generated via express-generator skeleton — see `bin/www.js`) |
| **API style** | REST-ish, resource routers mounted by prefix; JSON bodies (10 MB limit) |
| **Routing** | One `express.Router()` per feature file in `routes/`, mounted in `app.js` |
| **Service layer** | Yes — `routes/*` are thin; `services/*` hold logic + all Firestore calls |
| **Data access** | Firestore SDK used **directly** in services. No ORM, no repository abstraction |
| **Dependency injection** | None. Modules import a shared `db` singleton (`firestoreClient.js`) |
| **Validation** | Ad-hoc. Only `vaultService.js` has real input assertions (`assert`, `isCipher` size caps). Other services trust `req.body` |
| **Error handling** | Two patterns: (a) `try/catch` → `console.error` → `500` per handler (budget, etc.); (b) vault's `handle()` wrapper mapping `error.status` → HTTP code. No central error middleware |
| **Config** | `dotenv` + `process.env`, read inline at point of use. No config module/schema. `SESSION_SECRET` is the only fail-fast check |

**Request lifecycle (typical authenticated call):**
1. `helmet` sets security headers → `cors` (allowlist `CLIENT_DOMAIN`/`CHATBOT_ORIGIN`, `credentials:true`).
2. `morgan` logs → `express.json` parses body → `cookieParser`.
3. `express-session` loads the session from the **Firestore session store** via the `connect.sid` cookie.
4. `passport.session()` deserializes `req.user` (the full Google profile object — stored in-session, not re-fetched).
5. `csrfProtection` — skipped for GET/`/chatbot`/unauthenticated; else double-submit token check.
6. Per-mount rate limiter (`authLimiter`/`vaultLimiter`/`chatbotLimiter`).
7. `isAuthenticated` guard → `401` if `req.isAuthenticated()` is false.
8. Route handler → service → Firestore. **User scoping is manual everywhere:** `req.user.id` is
   passed into the service and used as the document key or `where('userId','==',…)`.

---

## 3. Database

| Aspect | Finding |
|---|---|
| **Technology** | **Google Cloud Firestore** (native mode), project `avian-cable-379805`. NoSQL document store |
| **Access framework** | `@google-cloud/firestore` SDK directly; auth via Application Default Credentials (`gcloud auth application-default login`) |
| **Migrations** | **None.** Schema is implicit. `firestore.indexes.json` + `firebase deploy --only firestore:indexes` manage **only composite/vector indexes**, not data shape |
| **ID strategy** | Two conventions: **user-keyed docs** (doc ID = Google profile `id`) for per-user singletons; **`crypto.randomUUID()`** for collection items (vault items/folders/audit/shares) |
| **Audit fields** | Inconsistent. Vault has full audit (`createdAt`, `actorId`, `actorEmail`, snapshots in a dedicated `audit` subcollection). Other collections have none |
| **Soft-delete** | None — deletes are hard deletes (vault "delete" keeps a ciphertext snapshot in the audit log, which is the closest thing) |

**Collections observed:**
- `users` — `{id, displayName, email, emailLower, photo}` (doc ID = Google id)
- `vaults/{userId}` + subcollections `items`, `folders`, `audit`; top-level `vault_shares`
- `budget/{userId}`, `licenses/{userId}`, `storybooks`, `voices`
- `sessions` (session store), `resume_chunks` (RAG vectors), `wow_game_data`, `wow_character_chunks` (vector search)

**Ownership/account concept (important for tenancy):** The **only** ownership primitive is
`userId` = the Google profile ID, applied two ways:
- **Structural:** everything under `vaults/{userId}/…` (no query filter needed — access is by path).
- **Field-based:** `where('userId','==', id)` (see `userCanAccess()` helper).

There is **no Organization, Team, Account, or Tenant entity.** The vault's `vault_shares`
collection (`{ownerId, recipientUserId, permission}`) is the closest existing model of
*cross-user resource access* and is the single most relevant precedent for multi-tenant sharing.

---

## 4. Authentication & Authorization

| Aspect | Finding |
|---|---|
| **Mechanism** | **Google OAuth 2.0 only** (`passport-google-oauth20`). No email/password, no other IdP |
| **User model** | Ephemeral Passport user = Google profile (`id, displayName, email, photo`), mirrored into `users/{id}` on every login via `checkAndStoreUser` |
| **Login flow** | `/auth/google` → Google consent → `/auth/google/callback` → upsert user → redirect to `CLIENT_DOMAIN`. Frontend polls `/auth/check` every 30 s |
| **Session strategy** | **Server-side sessions** (not JWT). `express-session` + persistent Firestore store; `connect.sid` cookie (`httpOnly`, `sameSite:lax`, `secure:auto`, 1-week `maxAge`). Whole user object serialized into session |
| **CSRF** | Double-submit token (`csrf-csrf`), enforced on authenticated mutations; client auto-attaches `x-csrf-token` and retries once on 403 |
| **Roles** | **None.** No role/claim/RBAC anywhere in the codebase |
| **Permissions** | The **only** permission concept is vault sharing's `'edit'` / `'view'`, enforced server-side by `requireShare`/`requireShareForFolder` walking `parentId` |
| **Authz enforcement** | Manual per-handler. `isAuthenticated` gates routes; data scoping is by `req.user.id` in each service. **No middleware-level ownership/tenant guard** |

**Reusable for tenant users:** Google OAuth + Firestore session store + the `users` collection
are solid, reusable foundations. The `vault_shares` + `requireShare` pattern is a working example
of *authorizing one user against another user's resources* — directly analogous to "authorize a
user against a tenant's resources." What is entirely **missing** is any notion of *roles within an
account* (owner/admin/staff), which a business dashboard + platform admin will require.

_(Secondary note: Blizzard OAuth client credentials exist in `wowService.js` — a machine-to-machine
token for a third-party API, not user auth.)_

---

## 5. Frontend

| Aspect | Finding |
|---|---|
| **Framework** | React 18 + Vite 4, plain JSX (no TS) |
| **Routing** | `react-router-dom` v6. Flat route table in `App.jsx`; one layout route (`MainContent`) wraps all authenticated pages, `/login` outside it |
| **State management** | React Context only — `AppProvider`, `AuthProvider`, `ThemeProvider`, `VaultProvider`. No Redux/Zustand/query lib |
| **API client** | A single `request()` helper in `utils/index.js` (fetch wrapper: credentials, CSRF header + retry). **`SERVER_PREFIX` is a hardcoded constant in `App.jsx`** (prod value `https://api.bakerrang.com`; sometimes flipped to `http://localhost:8080` locally). Not env-driven |
| **Auth (client)** | `AuthProvider` polls `/auth/check`; redirects to `/login` when unauthenticated. No route guards beyond that redirect |
| **Styling** | **Tailwind CSS 3** + a bespoke **glassmorphism design language** driven by CSS variables in `index.css` (`--brand-gold`, theme surfaces). Dark/light via `ThemeProvider` + localStorage. `@material-tailwind/react` is a listed dep but noted as being phased out |
| **Shared components** | A meaningful in-app library exists: `ConfirmModal`, `FolderSelect` (custom themed dropdown), `InputWrapper`, `Dropdown`, `IconButton`, `MainContent` shell, modals. All **feature-coupled and app-local** |
| **Design system** | Informal but real — documented conventions (palette CSS vars, glass classes, `useTheme()` pattern, text-on-accent rules) in CLAUDE.md. Not extracted or versioned |

**Reusable component package?** **No.** There is no published/extractable UI package — components
live in `client/src/components` mixed with page-level components (there is no `pages/` directory;
pages *are* components). The theme system and CSS-variable palette are the most portable assets.
Everything is single-tenant, single-brand (BakerRang gold/charcoal) today.

---

## 6. Infrastructure

| Concern | Finding |
|---|---|
| **Docker** | Yes — `client/Dockerfile` (multi-stage → nginx, port 8080) and `server/Dockerfile` (node:20-alpine, `npm start`, port 8080) |
| **Google Cloud** | Firestore (`avian-cable-379805`); OAuth via Google; ADC for credentials. Deploy target is **GKE** (README: `us-docker.pkg.dev/<kubernetes-project-id>/…`; CLAUDE.md states "runs on GKE, multi-pod, no message bus") |
| **Cloud Run** | **Not used** — deployment is GKE/Kubernetes, not Cloud Run |
| **CI/CD** | **None.** No `.github/`, no `cloudbuild.yaml`, no pipeline. Deploy is **manual**: `docker build` → `docker push` to Artifact Registry → (implicitly) update k8s. No k8s manifests are in the repo either |
| **Env config** | `.env` (gitignored) + `.env.example`. Keys: OpenAI, ElevenLabs, Deepgram, Blizzard, Google OAuth, `CLIENT_DOMAIN`/`SERVER_DOMAIN`/`CHATBOT_ORIGIN`, `SESSION_SECRET`, `CSRF_SECRET`, `NODE_ENV` |
| **Secrets** | Plain env vars (no Secret Manager). ⚠️ CLAUDE.md flags that the committed `.env` was exposed in git history and keys still need rotation |
| **Domains** | `api.bakerrang.com` (API) and a separate client domain. Hardcoded client-side in `SERVER_PREFIX`. No multi-domain / custom-domain routing |
| **Storage (files/media)** | **No object storage.** No `@google-cloud/storage`. `multer` uses **in-memory** storage only — uploads (voice samples) are streamed straight to third-party APIs, never persisted. This is a **gap** for a photo/media-management platform |
| **Email** | **None server-side.** `@emailjs/browser` is a client dependency but **not imported anywhere**. No transactional email capability |
| **Logging** | `morgan('dev')` request logs + `console.error`. No structured/centralized logging (no winston/pino) |
| **Monitoring** | Only a `/health` endpoint. No metrics, tracing, or APM |

---

## 7. Existing Reusable Capabilities

| Capability | Exists? | Reusable? | Notes |
|---|---|---|---|
| Authentication | ✅ Yes | ✅ Yes | Google OAuth via Passport; solid, but single-IdP |
| Users | ✅ Yes | ✅ Yes | `users/{googleId}` upserted on login; has `emailLower` for lookup |
| Roles | ❌ No | — | No RBAC of any kind; must be built |
| Database | ✅ Yes | ✅ Yes (with caveats) | Firestore; no ORM/migrations; schema implicit |
| File storage | ⚠️ Partial | ❌ No | Only in-memory multer; no persistent object store — must add GCS |
| Email | ❌ No | ❌ No | Unused client dep only; no server email |
| API infrastructure | ✅ Yes | ✅ Yes | Express + service layer + security middleware is a clean base |
| Frontend framework | ✅ Yes | ✅ Yes | React + Vite + Tailwind + theme system |
| Shared UI components | ⚠️ Partial | ⚠️ With work | Real components exist but feature-coupled, not packaged |
| Logging | ⚠️ Minimal | ⚠️ | morgan + console only |
| Configuration | ⚠️ Minimal | ⚠️ | Inline `process.env`; no schema/validation; hardcoded client `SERVER_PREFIX` |
| Cloud deployment | ⚠️ Partial | ⚠️ | Dockerfiles yes; no CI/CD, no k8s manifests in repo, manual push |
| Background jobs | ❌ No | ❌ No | No queue/cron/worker. One-off scripts in `server/scripts` run by hand |
| Analytics | ❌ No | ❌ No | None (no GA, no event pipeline, no attribution) |

---

## 8. Multi-Tenant Readiness

| Area | Classification | Why |
|---|---|---|
| **Authentication (Google login)** | Ready | Works as-is; a tenant user is just a Google user |
| **User store** | Minor modification | Add tenant membership; `users` collection is a clean base |
| **Session/CSRF/rate-limit infra** | Ready | Tenant-agnostic; reusable unchanged |
| **Firestore data model** | Significant modification | No tenant dimension anywhere; every collection is user-keyed. Needs a tenant/org entity + scoping strategy (path prefix vs. `tenantId` field) |
| **Authorization** | Significant modification | Only per-user scoping exists; no roles, no tenant-scoped guards. `vault_shares`/`requireShare` is the only reusable precedent |
| **Frontend routing/shell** | Significant modification | Single flat route table, single brand, hardcoded API URL. Needs tenant context, per-tenant theming, public marketing routes |
| **Theming/branding** | Minor–Significant | CSS-variable palette is a good base for per-tenant themes, but currently one global brand |
| **Shared UI components** | Minor modification | Exist but need extraction/parameterization for reuse across tenant sites |
| **File/media management** | Significant modification | No persistent storage at all — greenfield |
| **Email / lead capture / CRM** | Significant modification (greenfield) | No email, no lead/contact entities, no CRM primitives |
| **Custom domains** | Significant modification | Single hardcoded domain; no domain-routing/tenant-resolution layer |
| **Analytics / attribution** | Significant modification (greenfield) | None exists |
| **Deployment/CI-CD** | Significant modification | Manual build/push, no pipeline, no IaC/manifests in repo |
| **Public/marketing sites** | Significant modification (greenfield) | App is entirely auth-gated; no public/SSR/marketing surface |
| **Firestore cost/scaling under multi-tenancy** | Unknown | Depends on tenant volume + query patterns; not yet exercised |

---

## 9. Architecture Risks

1. **No tenant dimension in the data model.** Ownership is `userId`-only, applied inconsistently
   (path-based *and* field-based). Retrofitting tenancy touches every collection and every service.
   This is the central architectural risk.
2. **No roles/RBAC.** Business dashboards, staff accounts, and platform admin all need role-based
   authz that doesn't exist. The `vault_shares` permission model is a small precedent.
3. **Manual, undocumented-in-repo deployment.** No CI/CD, no k8s manifests, no IaC. Multi-tenant +
   custom domains raise operational complexity sharply against a manual pipeline.
4. **Hardcoded configuration.** Client `SERVER_PREFIX` is a source constant; server config is
   scattered inline `process.env`. Multi-environment/multi-tenant needs centralized, validated config.
5. **No object storage.** Photo/media management — a core platform requirement — has zero foundation.
6. **No email/notification capability.** Lead capture and CRM are meaningless without outbound email.
7. **No automated tests.** Zero test coverage across three apps makes large refactors (like adding
   tenancy) risky to verify.
8. **Firestore-specific constraints.** No migrations (schema changes coordinated by hand); composite
   indexes must be hand-created (already a documented friction point for vault audit queries); NoSQL
   modeling for relational-ish CRM/attribution data will need care.
9. **Secrets hygiene debt.** Committed `.env` in git history with keys still pending rotation.
10. **Pages and shared components are intermixed**, and the whole app is auth-gated — there's no
    public rendering path, which a marketing-site platform fundamentally requires.

_None of these mandate a rewrite._ The Express service layer, Google auth, session infra, Firestore
client, and the React/Tailwind/theme frontend are sound and worth building on. The work is
**additive** (tenant model, roles, storage, email, public surface, CI/CD), not corrective.

---

## 10. Summary

### Existing architecture
A **single-tenant, single-brand full-stack web app**: a React 18 + Vite + Tailwind SPA (served by
nginx) talking to a stateless Express (ESM) REST API, backed by **Google Cloud Firestore**. Auth is
**Google OAuth only** with server-side sessions persisted in Firestore. Business logic sits in a
clean routes → services → Firestore layering with helmet/CORS/CSRF/rate-limiting already in place.
It runs on **GKE** via hand-built Docker images (no CI/CD). Its most sophisticated subsystem — the
zero-knowledge password vault with folder sharing and an audit log — is also the codebase's only
working model of cross-user authorization.

### Strong reuse candidates
- Google OAuth + Passport + **Firestore session store** (auth foundation).
- The **Express route→service→Firestore** structure and `security.js` middleware (CSRF, rate limits, helmet).
- The `users` collection + upsert-on-login flow.
- The **React/Vite/Tailwind frontend shell**, `ThemeProvider`, CSS-variable palette, and the `request()` API client.
- The **`vault_shares` + `requireShare`** pattern as a proven template for tenant-scoped access control.
- Dockerfiles for both apps.

### Areas requiring architectural decisions
- **Tenant model & data scoping:** dedicated `Tenant`/`Organization` entity; path-prefix vs.
  `tenantId`-field scoping in Firestore; how existing user-keyed collections relate to tenants.
- **RBAC:** role taxonomy (platform admin / business owner / staff / lead), and where it's enforced
  (middleware vs. per-service).
- **Tenant resolution & custom domains:** subdomain/custom-domain → tenant mapping, and public vs.
  authenticated surfaces (marketing sites are unauthenticated).
- **Media storage:** introduce GCS (or equivalent) — none exists.
- **Email/notifications, lead capture, CRM, analytics/attribution:** all greenfield — build vs. integrate.
- **Config & deployment:** env-driven client config, centralized server config, and a real CI/CD + IaC story.
- **Firestore vs. relational** for the CRM/attribution/analytics workloads (more relational than the
  current key-value patterns).

### Questions for the platform architect
_(Only items the repository cannot answer.)_
1. Should tenancy be **path-based** (`tenants/{tenantId}/…`) or **field-based** (`tenantId` on every
   doc), and is **Firestore** the intended store for relational-heavy CRM/analytics — or should a
   relational DB be introduced alongside it?
2. Is **Google OAuth the only identity method** acceptable for business tenant users and their
   end-customer leads, or must email/password / other IdPs / passwordless be supported?
3. Are the **public marketing sites** expected to be **SSR/SEO-optimized** (implying Next.js or
   similar) or is a client-rendered SPA acceptable?
4. What is the intended **runtime** going forward — stay on **GKE**, or move to Cloud Run/serverless
   (affects custom-domain routing, per-tenant isolation, and cost model)?
5. What are the expected **tenant scale and isolation requirements** (tens vs. thousands of
   businesses; shared-collection soft multi-tenancy vs. per-tenant hard isolation / compliance needs)?
6. Which **marketing integrations** (Google Business, Instagram, ad platforms) are near-term vs.
   "future," so we can judge what the lead-attribution data model must accommodate now?
7. Is the intent to **evolve this repo in place** into the platform, or to **extract the reusable
   pieces** into a new multi-tenant codebase and treat BakerRang's current features as one tenant/app?
