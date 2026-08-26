# Phase 1 — Architecture Validation

> **Purpose:** Validate the proposed multi-tenant local-business platform architecture against the
> **actual** existing repository — surface genuine conflicts, hidden coupling, and constraints, and
> recommend only small, explicit adjustments. Builds on
> [Phase 0 — Architecture Review](Step0-ArchitectureReview.md).
>
> **Scope:** Validation only — no code was modified and no implementation plan is proposed here.
>
> **⚠️ Runtime correction (supersedes Phase 0):** the existing BakerRang apps are deployed on
> **Google Cloud Run**, not GKE/Kubernetes. GKE was abandoned to reduce cost. Treat Cloud Run as the
> current and intended runtime. (Phase 0 and CLAUDE.md still say GKE in places — stale; correct on next pass.)
>
> _Date: 2026-08-12 · Status: baseline / living reference_

---

## Proposed architecture under review (summary)

- **Keep `client/` and `server/` as-is** — client stays fundamentally separate; extend the Express
  API rather than replace it.
- **New `platform/` workspace:** `apps/portal` (Next.js + TS authenticated dashboard),
  `apps/site-renderer` (Next.js + TS public multi-tenant marketing renderer); `packages/ui`,
  `packages/site-components`, `packages/site-schema`.
- **Path-based Firestore tenancy:** global `users/{userId}`, `tenants/{tenantId}`; tenant-owned
  `tenants/{tenantId}/{members|services|projects|media|leads}/…`; site config under the tenant.
  Existing personal BakerRang data stays user-scoped and is **not** migrated under tenants.
- **Roles:** global `PLATFORM_ADMIN`; tenant roles `OWNER`/`ADMIN`/`STAFF`. Tenant authz checked
  against **persistent membership data**, not the serialized login session.
- **Public sites:** one shared `site-renderer` for all businesses (not one deploy per tenant);
  eventually `domains/{normalizedHostname} → {tenantId, status, primary}` resolves the site. Custom
  domain infra is out of the first implementation.
- **Auth:** continue existing Google OAuth/session for V1; dashboard users authenticate; public
  visitors and submitted leads need no accounts.
- **Deployment:** four eventual Cloud Run services — existing client, existing API, new portal, new
  site-renderer.

---

## 1. Architecture Conflicts

**No hard blockers.** The genuine constraints are concentrated in auth plumbing, not the data model.

**A. Session cookie `SameSite=lax` constrains where the portal can live (genuine constraint).**
`server/app.js` sets the session cookie `sameSite:'lax'`, and the client authenticates cross-origin
(`api.bakerrang.com` vs. the client domain) with `credentials:'include'`. This works today only
because `lax` still sends cookies on cross-origin requests that are **same-site** (same registrable
domain, e.g. `app.bakerrang.com` → `api.bakerrang.com`). **"Continue using the existing session
infrastructure for V1" therefore requires the portal to be served under the same registrable domain
as the API (`*.bakerrang.com`).** A portal on an unrelated domain won't send the session cookie on
XHR and auth breaks silently — you'd be forced to switch the cookie to `SameSite=None; Secure`. This
is a placement constraint, not a design conflict.

**B. OAuth post-login redirect is hardcoded to a single origin.**
`server/routes/auth.js` does `res.redirect(process.env.CLIENT_DOMAIN)` and the Google callback URL is
a single fixed `SERVER_DOMAIN/auth/google/callback` (`server/app.js`). A portal on a different
subdomain that logs in via the same OAuth flow is bounced back to the **existing client**, not the
portal. Needs a small allowlisted "return-to" mechanism.

**C. `req.user` is a login-time snapshot, never refreshed.**
`deserializeUser` returns the stored object verbatim (`server/app.js`); it does not re-read
`users/{id}`. This is exactly why the proposal's "don't trust roles from the session" rule is
correct — see §3. Alignment point, not a conflict, but load-bearing.

**Not conflicts:** keeping personal features user-scoped, path-based tenancy, one shared
site-renderer, and the "extend not replace" backend stance all sit cleanly on the current structure.

---

## 2. Backend Impact

All additive. Touched vs. added:

| Concern | Existing files affected | Nature |
|---|---|---|
| Tenant entity + membership | *New* `server/services/tenantService.js`, *new* `server/routes/tenants.js`; register in `server/app.js` | Add a router mount + service; mirrors the existing route→service→Firestore layering |
| Platform-admin authz | `server/services/authService.js` (`checkAndStoreUser`, where the `users` doc is written) + a new `requirePlatformAdmin` guard | Read `PLATFORM_ADMIN` fresh from the `users` doc |
| Tenant authz middleware | *New* guard (`requireTenantRole`), modeled on `requireShareForFolder` / `requireShare` in `server/services/vaultService.js` | The vault's cross-user authz is the existing template — reuse the pattern |
| CORS allowlist | `server/app.js` (`allowedOrigins`) | Add the portal origin (and site-renderer origin if it calls the API from the browser) |
| Rate limiting | `server/middleware/security.js` | Add a `tenantLimiter` alongside existing limiters (one line) |
| CSRF | none | Automatic — new mutating `/tenants` routes inherit CSRF via `server/app.js`; the client `request()` helper already attaches the token |

The `vault_shares` + `requireShare` machinery is the single most valuable precedent: it already does
"authorize user A against resources owned by B, with an edit/view permission, enforced server-side
from Firestore." Tenant membership is the same shape with `OWNER/ADMIN/STAFF` instead of `edit/view`.

---

## 3. Auth Impact

**Current lifecycle:** `helmet → cors → session (Firestore store) → passport.session() → csrf →
rate-limit → isAuthenticated → handler`. `serializeUser`/`deserializeUser` are pass-throughs
(`server/app.js`) — the **entire Google profile is stored server-side in the session and returned
verbatim** as `req.user` for the cookie's 1-week life; no re-fetch.

**Cleanest integration points:**
- **Platform role check:** a `requirePlatformAdmin` middleware running *after* `isAuthenticated` that
  reads `users/{req.user.id}` (or a dedicated `platform_admins` doc) **fresh from Firestore** per
  request. Do not add the role to the Passport user object.
- **Tenant membership check:** a `requireTenantRole(tenantId, [roles])` middleware, again *after*
  `isAuthenticated`, reading `tenants/{tenantId}/members/{req.user.id}` fresh. `tenantId` comes from
  the route param, never the body. Mirrors `requireShareForFolder` exactly.

**Security concern from the serialization strategy (important):** the session is a 1-week snapshot
that is never refreshed, so **any role or membership cached in it stays valid up to a week after
revocation.** The proposal already says "check against persistent membership data, not the serialized
session" — treat that as a hard, non-negotiable rule: role/membership reads must hit Firestore per
request (or a short-TTL cache), never `req.user`. This is the correct call and the reason it matters.

Secondary: reusing the existing OAuth/session across a new origin surfaces the cookie/redirect issues
in §1 (A) and (B).

---

## 4. Firestore Validation

Path-based tenancy is **appropriate** and does not conflict with current usage.

- **Naming:** no collisions. New top-level `tenants`/`domains` and subcollections
  `members/services/projects/media/leads` don't exist today. (Existing top-level: `users`, `vaults`,
  `budget`, `licenses`, `storybooks`, `voices`, `sessions`, `resume_chunks`, `wow_game_data`,
  `wow_character_chunks`, `vault_shares`.)
- **`users` overlap is a feature, not a conflict:** the proposed global `users/{userId}` **is** the
  existing `users/{googleId}` collection (`server/services/authService.js`, doc ID = Google profile
  id). **Reuse it** — don't stand up a parallel user store — and hang `PLATFORM_ADMIN` off it (or a
  sibling collection). Membership docs key on that same Google id.
- **Query/index implications:** every existing query is a **single-collection**
  `where('userId','==',…)` (storybook, textToSpeech, vault, wowRag services). There are **no
  `collectionGroup` queries anywhere** today, and the only composite indexes are vector indexes
  (`firestore.indexes.json`). Intra-tenant reads (`tenants/{id}/leads`, etc.) need only automatic
  single-field indexes — **nothing new** unless combining `where`+`orderBy`.
- **One thing to decide (not a blocker):** two access patterns will want **`collectionGroup`
  indexes** when reached: (a) "which tenants does this user belong to?" over `members`, and (b) any
  platform-admin cross-tenant view (all leads, etc.). Path-based `members` makes "list my tenants" a
  collectionGroup query — so either store a reverse pointer on the user doc *or* plan a `members`
  collectionGroup index. Conscious choice; no redesign needed now.

No technical reason to abandon path-based tenancy.

---

## 5. Frontend Workspace Validation

**No conflict.** The repo has **no root `package.json`** and three independent npm projects
(`client`, `server`, `extension`), each with its own `node_modules` and StandardJS lint. A
self-contained `platform/` workspace beside them is fully isolated.

**Recommendation — yes to npm workspaces, but root them at `platform/`, not the repo root.** Create
`platform/package.json` with `workspaces: ["apps/*", "packages/*"]`. **Do not add a repo-root
`package.json`** — that would retroactively pull `client`/`server`/`extension` into workspace
resolution and change their tooling assumptions (hoisting, lockfile) for no benefit. Keeping the
boundary at `platform/` lets the TypeScript/Next/ESLint toolchain live entirely apart from the
existing StandardJS/JS apps, matching how the repo already treats its three projects as independent.

No restructuring of `client`/`server` is required.

---

## 6. Cloud Run Impact

- **Existing API: already compatible.** `server/bin/www.js` uses `process.env.PORT || 8080` — exactly
  what Cloud Run injects. Firestore uses ADC (`server/client/firestoreClient.js`), supplied by the
  Cloud Run service account. Only additive change to run: the CORS entry (§2).
- **Existing client: works, with a caveat.** nginx hardcodes `listen 8080` (`client/nginx/nginx.conf`)
  and `EXPOSE 8080`. Fine while Cloud Run's `PORT` stays 8080 (the default); it does **not** read
  `$PORT`, so it's brittle if the port is ever overridden — minor, pre-existing.
- **Two new services need Dockerfiles.** `portal` and `site-renderer` are Next.js — `next start`
  honors `PORT`, so they're Cloud-Run-native; each needs its own Dockerfile (Next `standalone` output
  recommended for image size). Each also needs a Cloud Run service account with Firestore access **if**
  it reads Firestore server-side.
- **Decision to surface (not design):** does `site-renderer` read tenant/site config **directly from
  Firestore via ADC** (SSR, no user) or **through the Express API** (needs new public, unauthenticated
  endpoints)? Public sites carry no session, so this determines whether the API grows a public surface
  or the renderer gets its own Firestore access. Decide before that app is built; not part of the
  first change.
- Note: `projectId` is hardcoded (`'avian-cable-379805'`) rather than env-driven — harmless within one
  GCP project, just be aware if new services ever point elsewhere.

---

## 7. First Implementation Boundary (smallest safe change)

Backend-only, purely additive, no existing route touched except two config lines. **Excludes** CMS,
websites/site-renderer, media, leads, analytics, domains, and marketing integrations by design.

1. **Data shape:** `tenants/{tenantId}` and `tenants/{tenantId}/members/{userId}` (member doc =
   `{ role: OWNER|ADMIN|STAFF, ... }`), plus `PLATFORM_ADMIN` as a field on the existing
   `users/{userId}` doc. No `services/projects/media/leads/domains` yet.
2. **`server/services/tenantService.js`** — create tenant (creator auto-inserted as `OWNER`), list my
   memberships, get tenant, add/list/remove member. Follows the existing route→service→Firestore idiom.
3. **Authorization primitives** — `requirePlatformAdmin` and `requireTenantRole(tenantId, roles)`
   middleware that read **fresh from Firestore** (modeled on `requireShareForFolder`). The load-bearing
   piece; get it right and everything layers on cleanly.
4. **`server/routes/tenants.js`** mounted `/tenants` behind `isAuthenticated` + a new `tenantLimiter`;
   CSRF applies automatically.
5. **Two config lines:** add the portal origin to `allowedOrigins` (`server/app.js`), and make the
   OAuth post-login redirect return-to-aware (`server/routes/auth.js`) so the portal can complete login.

The `platform/` frontend workspace can be scaffolded empty in parallel, but the *foundation* that must
be correct first is the tenant/membership/authorization backend above.

---

## 8. Final Verdict

### APPROVE WITH CHANGES

The architecture is sound and fits the repo. Required changes are minimal and mostly auth-plumbing:

1. **Roles/membership must be read fresh from Firestore per request — never from `req.user`/the
   session.** The session is a 1-week, never-refreshed snapshot; caching authz in it means up-to-a-week
   stale permissions. (Proposal already states this; elevated to a hard rule because the serialization
   strategy makes it essential.)
2. **Keep the portal (and any browser-authenticated surface) under the same registrable domain as the
   API (`*.bakerrang.com`) for V1** — otherwise `SameSite=lax` blocks the session cookie and forces
   `SameSite=None; Secure`.
3. **Make the OAuth post-login redirect return-to-aware** (currently hardcoded to `CLIENT_DOMAIN`) so
   portal login lands back on the portal, and **add the portal origin to the CORS allowlist**.
4. **Reuse the existing `users` collection as the global `users/{userId}`** and hang `PLATFORM_ADMIN`
   there — do not create a parallel user store.
5. **Root npm workspaces at `platform/`, not the repo root.**
6. **Decide site-renderer's Firestore access path** (direct ADC vs. new public API endpoints) before
   that app is built — not required for the first change.

None of these alter the proposed tenancy model, role model, or app topology.
