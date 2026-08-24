# Step 1.30 — DEV Product Readiness — Implementation Plan

**Status:** PLAN (no code changes). Final readiness review before production-focused work.
**Goal:** find the smallest set of work that makes the existing DEV product coherent, reliable, safe,
and usable end-to-end — **not** to add features. Cloud Run only (no Kubernetes, no prod deploy).

Findings below come from inspecting the actual repo after Steps 1.1–1.29. Where live infrastructure
cannot be proven by static inspection, the item is marked **MANUAL** (§40).

---

## 1. Executive readiness verdict

**Nearly ready — one config-safety item to verify/harden, a small set of DEV-completeness fixes, then
a documented smoke pass.** The product is architecturally sound and the primary operator workflow is
implemented end-to-end (auth → business → website → preview → publish → domain → leads). Route
authorization, tenant isolation, CSRF, rate limiting, and the working/preview/published invariants are
consistently applied across the cumulative feature set. The one item that must not be waved through is
the **DEV Firestore project-selection fallback** (§B1): it is safe *if* DEV is configured correctly and
dangerous *if* it is not, so it needs explicit verification + hardening. Everything else is completeness
polish, empty/error-state confirmation, and a deployment/config runbook. No architectural change is
required.

## 2. Product areas inspected

Auth/session bootstrap (`server/app.js`, `routes/auth.js`, portal `AuthProvider`); businesses
(`BusinessManager`/`BusinessList`/`BusinessWorkspace`); website workspace + all 14 editors + shell/nav
(1.29a/b/c); publication state (`siteService.toSiteDefinition`/`publishSite`); leads
(`publicLeads.js`, `leadService`, portal `BusinessLeads`/`LeadNotes`); domains (`tenants.js` domain
routes, `siteDomainService`, `CustomDomainEditor`); public renderer (`site/[tenantId]`, `contact`,
`preview`, `robots.txt`, `sitemap.xml`, `seo.ts`, `siteUrl.ts`, `SiteShell`); config
(`firestoreConfig`, `mediaConfig`, `origins`, `publicSite`, `oauthTargets`, `googleOAuth`); security
(`middleware/security.js`, `tenantAuth.js`); deployment (`server/Dockerfile`, `platform/apps/*/Dockerfile`,
`.env*.example`); docs (`README.md`, `docs/marketing-site/`).

## 3. End-to-end operator journey findings

The journey is complete and mostly coherent. Positives: 1.29 made the website workspace cohesive
(Overview default, grouped nav, persistent Preview/Publish, unsaved-change guard, status pill). Gaps to
confirm/close:
- **Portal is effectively PLATFORM_ADMIN-only.** `GET /tenants` (the business list, the entry point) is
  `platformAdmin`; a non-platform-admin tenant OWNER/ADMIN/STAFF has no portal path to reach a business
  even though the site/leads read routes accept `tenantRole`. For DEV this is fine (the operator *is*
  the platform admin) — but it should be stated as an intentional DEV boundary, and a non-admin hitting
  the portal must land on a clear access-denied state (verify `BusinessManager`'s 403 handling). A
  member-facing portal is a **DEFER** feature, not a DEV blocker.
- **New-business → published** path relies on the Website "missing/initialize" state and the Overview;
  confirm empty-state guidance reads clearly (see §4).

## 4. New-business / empty-state findings

- **Website:** handled well — `BusinessWebsite` has an `initial`/`missing`/`site` model with an
  "Initialize this website" card, and 1.29a's Overview shows status + homepage summary + Preview/Publish.
  Good.
- **Leads empty state / Domain empty state:** need a **MANUAL** confirmation that a brand-new business
  shows a helpful empty state (not a blank panel or raw "no results") in the Leads inbox and Domain page.
  If either is blank/ambiguous, add one-line empty-state guidance (XS). Do **not** add onboarding
  wizards.
- **Business Overview page** (`[tenantId]/page.tsx`) already routes to Website/Leads/Domain cards — good
  wayfinding for a new business.

## 5. Auth findings

Solid. `SESSION_SECRET` fail-fast at startup; `PREVIEW_TOKEN_SECRET` fail-fast in production; Firestore
session store; `secure:'auto'`, `httpOnly`, `sameSite:'lax'`, 1-week cookie; `trust proxy:1` for Cloud
Run TLS. OAuth secrets stay server-side. Portal `AuthProvider` gates on `/auth/check`; logout is a
CSRF-free GET. **MANUAL:** session-expiration behavior after 7 days and the anonymous/return-to redirect
should be spot-checked in DEV (static inspection can't prove cookie expiry UX).

## 6. Business-management findings

List + create + workspace + status badge all present. No dead ends found. Confirm the create-business
error path surfaces a usable message (MANUAL/light). No blocker.

## 7. Website findings

Comprehensive and coherent after 1.29. All editors reachable via grouped nav; Preview/Publish persistent;
unsaved-change + navigation guards; post-save canonical re-seed; publication status pill
(Draft / Changes not published / Published). Custom CSS raw/scoped separation intact. No blocker. Any
remaining item is 1.29c polish (already planned) — do not reopen here.

## 8. Leads findings

Full path implemented: public form → `POST /public/sites/:tenantId/leads` (anonymous, own limiter,
16KB cap, honeypot, 413 handling, `201`) → `tenants/{id}/leads` → authed inbox/detail/status/notes
(`tenantRole`, `noStore`). Eligibility = PUBLISHED snapshot contains a `leadForm` action; preview never
creates real leads (verified in prior steps). **MANUAL:** confirm the inbox distinguishes
empty / no-results / error, and that a status/notes update refreshes the row without a full refetch
regression. No blocker.

## 9. Domain findings

Routes complete and uniformly `platformAdmin + noStore` (register/verify/activate/disable/remove). The
portal exposes DNS targets via `CUSTOM_DOMAIN_IPV4_ADDRESS`/`CUSTOM_DOMAIN_CNAME_TARGET`. **MANUAL** (not
statically provable): actual DNS verification, TLS issuance on the shared load balancer, and
custom-domain routing to the renderer. Confirm the operator can recover from a stale/failed verification
(re-verify path). Architecture unchanged. Real TLS/DNS is DEV-infra verification, not code work.

## 10. Public-renderer findings

Single renderer for all tenants; `renderer → sanitized API → Firestore` (no renderer Firestore access);
shared-origin gate (`requestMatchesSharedOrigin`), `notFound()` on missing/unpublished, permanent
redirect to the active custom domain when published. Home/Contact, `SiteShell` scoped Custom CSS,
media hydration, theme — all in place. **Known artifact:** `/favicon.ico → 404` (§22). **MANUAL:**
mobile layout + console/network cleanliness on a real published site.

## 11. SEO / metadata findings

`generateMetadata` builds title/description/OG/canonical via `homeMetadata`; robots + sitemap routes exist
and fail closed unless `SITE_PUBLIC_INDEXING_ENABLED==='true'` **and** a valid `SITE_PUBLIC_ORIGIN`;
LocalBusiness JSON-LD + sameAs were audited earlier. No contradictory metadata found from the cumulative
About/Hours/Social/Domain features. Baseline is adequate; only genuine gap is the absent favicon `icons`
entry (deferred). No blocker.

## 12. Media findings

Upload → GCS (public-read, immutable, uuid names), Firestore metadata, magic-byte + MIME + 10MB checks,
`platformAdmin`. Public read-time hydration is batched and provider-neutral. `MEDIA_BUCKET_NAME` is
required (throws) but **at first use, not startup** — a missing bucket surfaces as a runtime 500 rather
than a boot failure (minor; see §17). Orphaned-object GC is a future concern, not DEV correctness. No
blocker.

## 13. Security / tenant-isolation findings

Route-level authorization is consistent across the whole cumulative surface (see the tenants router
inventory: every mutation `platformAdmin`; site/leads reads `tenantRole(allTenantRoles)`; members
GET `tenantManagerRoles`). `tenantAuth` reads roles/membership fresh from Firestore (never the session
snapshot) and PLATFORM_ADMIN bypasses tenant checks. Ownership is structural
(`tenants/{id}/…`), so client-supplied ids can't cross tenants. Public lead route is correctly anonymous
+ limited + eligibility-gated. CSRF is enforced on authenticated mutations and skipped for unauthenticated
`/public` and `/chatbot`. **No tenant-isolation or secret-exposure BLOCKER found.** Secrets are not in
`NEXT_PUBLIC_*`; `SiteDefinition` carries no server secrets; preview/verification tokens aren't logged.

## 14. Working / Preview / Published invariant findings

Intact and regression-tested through 1.29b: WORKING editable; Preview = WORKING (token-gated, no real
leads); PUBLISHED = immutable snapshot until Republish; custom domain serves PUBLISHED only; lead
eligibility keys off the published snapshot; Custom CSS raw canonical + transient scoped; media
provider-neutral ids + read-time hydration; `hasUnpublishedChanges` derived-read (never persisted). No
regression.

## 15. Error / loading-state findings

Portal editors route failures through the shared shell danger `StatusMessage`; Website has
loading/missing/error branches; Preview/Publish/domain have explicit error copy; leads/domain fetches
isolate failures. **MANUAL sweep** recommended for: business-list load error, leads inbox/detail error,
media upload error, and any panel that could render blank on failure. Only add fixes where a screen is
genuinely blank/raw/stuck — do not manufacture work.

## 16. Responsive / accessibility findings

1.29a/b/c cover the Website workspace responsive + a11y (nav `aria-current`, focus-trapped dialogs,
labels, 44px targets, icon-button names). **MANUAL** cross-product check still needed at 375/768/desktop
for: business list, business workspace nav, Leads inbox/detail, Domain, and the public site. Flag only
true blockers (overflow, inaccessible modal, hidden critical content).

## 17. DEV infrastructure / configuration findings

- **Firestore project selection (§B1 — the key item):** `resolveFirestoreProject` returns
  `FIRESTORE_PROJECT_ID` if set; otherwise, **if `NODE_ENV==='production'` it silently returns the
  PRODUCTION project `avian-cable-379805`**; otherwise it throws. Cloud Run services are commonly run
  with `NODE_ENV=production` (the server's secure-cookie/CSRF hardening keys off it). **If the DEV Cloud
  Run API is deployed with `NODE_ENV=production` and `FIRESTORE_PROJECT_ID` unset, DEV would read/write
  PRODUCTION Firestore.** This is the one potential data-safety BLOCKER and must be verified + hardened.
- **Env fail-fast is partial:** `SESSION_SECRET`/`PREVIEW_TOKEN_SECRET` fail fast; `MEDIA_BUCKET_NAME`,
  renderer `SITE_API_BASE_URL`, and `SITE_PUBLIC_ORIGIN` fail lazily (first request) rather than at
  startup. A DEV misconfig surfaces as a runtime 500/500-ish rather than a clear boot failure.
- **Build-time vs runtime env:** `NEXT_PUBLIC_*` (portal `NEXT_PUBLIC_API_BASE_URL`,
  `NEXT_PUBLIC_SITE_PREVIEW_ORIGIN`; renderer `NEXT_PUBLIC_SITE_API_BASE_URL`) are **embedded at Docker
  build time**; server-side runtime vars (`SITE_API_BASE_URL`, `SITE_PUBLIC_ORIGIN`,
  `CUSTOM_DOMAIN_*`, all server secrets) are read at runtime. This distinction is undocumented and is a
  classic deploy footgun.
- Rate limiters are in-memory (`express-rate-limit`) → per-instance on Cloud Run; adequate for DEV abuse
  mitigation, not production-scale (§30 DEFER).
- Health endpoints: server has `/health` + `/`. Next apps rely on default Cloud Run TCP probes (fine).

## 18. Deployment-repeatability findings

Dockerfiles exist for `server`, `platform/apps/portal`, `platform/apps/site-renderer`. **There is no
deploy script, `cloudbuild`, or DEV deployment runbook** — the Cloud Run wiring (which service gets which
env/secret/build-arg, service accounts, Artifact Registry, the shared LB for custom domains) is tribal
knowledge. This is the highest-value **FIX NOW** for maintainability: a concise `docs/DEV-DEPLOYMENT.md`
(and optionally a thin deploy script) would make DEV reproducible. No Terraform/IaC required.

## 19. Documentation findings

`README.md` documents only the **legacy** learning-playground (client Vite app, chatbot, WoW) + local
Firestore/GCS setup. It says nothing about the `platform/` apps (portal, site-renderer), how to run
them, configure DEV, run their tests, or deploy. `docs/marketing-site/` holds implementation plans, not
an operator/developer runbook. **FIX NOW:** a short platform section in the README (or a dedicated doc)
covering the three apps, local run, env, tests, and DEV deploy.

## 20. Test-coverage findings

Strong deterministic coverage exists: backend `node:test` (260), portal vitest (56), renderer (44),
shared UI (9), plus focused siteService. Invariants proven include publication-state lifecycle, tenant
isolation, snapshot isolation, Custom CSS policy/scoping, dirty-state, guards, and post-save re-seed.
Meaningful gaps to consider (small): a config-resolver test asserting the **DEV fail-fast / prod-fallback
boundary** of `resolveFirestoreProject` (guards §B1), and (if §B1 hardening lands) a test for the new
guard. Do not chase coverage %.

## 21. Playwright recommendation

**Defer a browser E2E suite for 1.30; keep the manual smoke checklist (§31).** Reasoning grounded in the
repo: the entire portal sits behind **Google OAuth + PLATFORM_ADMIN**, and there is no test-auth/session
bypass, so deterministic authenticated browser automation would require building a test-mode auth path
first — more than a readiness slice should take. The only low-friction browser flow (public site + lead
form) still needs a seeded published DEV tenant. Revisit Playwright once a test-auth mode exists (a
worthwhile future investment, not a DEV blocker). **Human decision** (§32).

## 22. Favicon recommendation

**Classify `/favicon.ico → 404` as non-blocking DEV noise; DEFER the tenant-configurable favicon to a
dedicated feature step.** The desired end-state (per-published-site favicon backed by media, with
working/published lifecycle, Preview, shared + custom domain, `Metadata.icons` in the renderer, and
backward-compat when absent) is an **M-sized feature**, not readiness — building it now would violate
the "no major feature" purpose of 1.30. Optional XS interim if console cleanliness matters: a trivial
renderer handler returning `204`/empty for `/favicon.ico` to silence the 404. Recommendation: **DEFER
the real feature; optionally silence the 404; document it as known.** (Human decision §32.)

## 23. Observability / diagnostics findings

Adequate for DEV: `/health`, `morgan` request logging, server 500s `console.error`'d while clients get
generic messages (good — no lead contents/tokens leaked). No correlation IDs (fine for DEV). No change
required beyond ensuring the deployment doc points at Cloud Run logs. No monitoring platform in scope.

## 24. Production-only items explicitly deferred

IaC/Terraform; multi-region; distributed/shared rate limiting; advanced monitoring/telemetry;
backup/restore runbooks; production OAuth consent + domain/LB automation; secret rotation; billing;
SLAs; load testing; CDN tuning; formal security review/pentest; formal WCAG certification.

## 25. Future product features explicitly deferred

Tenant-configurable favicon (see §22); additional pages; visual page builder; revision history/rollback;
analytics; email lead notifications; CRM integrations; autosave; collaboration; Theme V2; advanced media
management/DAM; member-facing (non-platform-admin) portal access.

## 26. Ranked findings

| # | Priority | Class | Area | Finding | Why it matters | Recommended action | Scope |
|---|---|---|---|---|---|---|---|
| B1 | P0 | **BLOCKER**¹ | Config / Firestore | DEV could read/write PROD Firestore if `NODE_ENV=production` and `FIRESTORE_PROJECT_ID` unset (silent prod fallback) | Data-integrity/safety across environments | **MANUAL-verify** DEV Cloud Run sets `FIRESTORE_PROJECT_ID=bakerrang-dev`; **harden** `resolveFirestoreProject` (e.g. require explicit id when a DEV marker is present, or always require it and pin prod via its own explicit value) + startup log naming the project; add resolver test | S |
| F1 | P1 | FIX NOW | Deployment | No DEV deployment/config runbook or script; Cloud Run env/secret/build-arg wiring is tribal | Reproducibility/maintainability of DEV | Add `docs/DEV-DEPLOYMENT.md` (services, env matrix incl. build-time vs runtime `NEXT_PUBLIC_*`, secrets, deploy commands); optional thin deploy script | M |
| F2 | P1 | FIX NOW | Docs | README covers only legacy app; nothing on `platform/` apps | Onboarding a developer | Add a platform section: what each app is, run, env, tests, deploy pointer | S |
| F3 | P1 | FIX NOW | Config validation | `MEDIA_BUCKET_NAME`, renderer `SITE_API_BASE_URL`/`SITE_PUBLIC_ORIGIN` fail lazily, not at startup | Clear boot failure beats confusing runtime 500 | Add startup validation (fail-fast) for required DEV vars per service; keep messages actionable | S |
| F4 | P2 | FIX NOW | Empty/error states | Confirm Leads + Domain new-business empty states and key error panels aren't blank/raw | Product completeness/trust | MANUAL sweep; add one-line empty-state/error copy only where genuinely missing | XS–S |
| F5 | P2 | FIX NOW | Access boundary | Non-platform-admin hitting the portal must see a clear access-denied state | Avoid confusing dead end | Verify `BusinessManager` 403 handling; add copy if blank | XS |
| D1 | P3 | DEFER | Renderer | `/favicon.ico → 404`; tenant-configurable favicon | Minor console noise; real feature is M-sized | Document as known; optional 204 handler; schedule feature step | XS (interim) |
| D2 | — | DEFER | Rate limiting | In-memory limiter per Cloud Run instance | Production-scale only | Note; revisit with shared store at prod | — |
| D3 | — | DEFER | Testing | Browser E2E (Playwright) | Needs test-auth mode | Keep manual smoke; revisit later | — |
| D4 | — | DEFER | Product | Member-facing portal for tenant roles | Not needed for DEV (operator = platform admin) | Future step | — |

¹ B1 is a **BLOCKER conditional on the live DEV configuration**; if manual verification confirms
`FIRESTORE_PROJECT_ID=bakerrang-dev` is already set on the DEV API, the residual work (hardening + test +
doc) is FIX NOW. Treat verification as the gate.

## 27. Smallest recommended Step 1.30 scope

1. **B1** — verify DEV Firestore config; harden the resolver + add startup log + resolver test.
2. **F3** — startup fail-fast for the remaining required DEV env vars (per service).
3. **F1 + F2** — DEV deployment runbook + README platform section (the tribal-knowledge killers).
4. **F4 + F5** — targeted empty/error-state and access-denied confirmations, adding copy only where a
   screen is genuinely blank/raw.
5. Document favicon (D1) as known-deferred; optionally silence the 404.
6. Run the full gate set + the manual smoke suite (§31).

Everything else is DEFER. No new feature, no architecture change.

## 28. Recommended implementation slices

Small enough that **one contained pass** is defensible, but a light 2-slice split reviews cleanly:
- **1.30a — Config safety & validation:** B1 (resolver hardening + test + startup log) and F3
  (per-service env fail-fast). Highest risk, code + tests, independently verifiable.
- **1.30b — Completeness & docs:** F1 (deploy runbook), F2 (README), F4/F5 (empty/error/access states),
  favicon documentation, then the manual smoke pass.

Do not create a third slice unless the empty/error sweep uncovers a real defect.

## 29. Exact files likely affected

- `server/config/firestoreConfig.js` (harden resolver), `server/client/firestoreClient.js` (startup
  log/validation), `server/test/*` (resolver boundary test).
- Small startup-validation module or additions in `server/app.js`; renderer/portal may add a tiny
  runtime env-check in their server entry (or documented at deploy time).
- `README.md` (+ new `docs/DEV-DEPLOYMENT.md`, optional `scripts/deploy-dev.*`).
- Portal empty/error copy: `BusinessLeads.tsx` / leads page, `CustomDomainEditor.tsx`,
  `BusinessManager.tsx` (only where a genuine gap is found).
- Optional renderer `app/favicon.ico/route.ts` (204) if silencing the 404.
- **No** changes to core site/publish/tenant/customCss/renderer architecture.

## 30. Testing strategy

- Add: `resolveFirestoreProject` boundary test (explicit id wins; non-prod missing → throws; prod
  missing → documented fallback or, post-hardening, the new behavior); env fail-fast unit tests where
  added.
- Keep all existing suites green; add empty/error-state assertions only for components actually changed.
- Gates (§43): Backend tests, Portal tests, Renderer tests, Shared UI tests, platform typecheck, platform
  lint, Portal build, Renderer build, touched-server StandardJS, `git diff --check`, **manual DEV smoke**.

## 31. 15–30 minute final DEV smoke checklist

**Auth:** sign in with Google; refresh keeps session; sign out returns to login; anonymous hitting a deep
link redirects to login then back.
**Business:** business list loads; create a business; open its workspace; status badge shows.
**Website:** open Website (Overview default); initialize if missing; edit Hero + one section; Save shows
"Changes saved"/"Unsaved changes" status correctly; switch editors with unsaved changes → discard guard;
Custom CSS save.
**Preview:** Preview opens the working site in a new tab (and the blocked-popup fallback link works);
Preview blocked while an editor is dirty.
**Publish:** Publish → status becomes Published; edit again → "Changes not published"; Republish clears it;
Unpublish from Overview.
**Domain:** register a hostname; DNS instructions show; (MANUAL) verify/activate if DNS is set; active
domain appears on Overview and links to Domain page.
**Public site:** open the published site (shared origin); Home + Contact render; nav/social/footer/media
present; mobile layout at 375px; open devtools — no unexpected 404/500/CORS/hydration errors (the
`/favicon.ico` 404 is known/acceptable).
**Lead submission:** submit the public lead form → success; confirm Preview does **not** create a lead.
**Leads:** lead appears in the inbox; open detail; change status; add a note; row reflects the update.
**Responsive basics:** business list, workspace nav, Leads, Domain usable at 375/768/desktop (no overflow,
no inaccessible modal).
**Config sanity:** confirm the DEV API logs the **bakerrang-dev** Firestore project at startup (B1).

## 32. Human decisions genuinely required

1. **B1 hardening approach.** Current: silent prod fallback when `NODE_ENV=production` + id unset.
   Options: (a) leave fallback, rely on DEV always setting `FIRESTORE_PROJECT_ID` + doc + startup log;
   (b) require `FIRESTORE_PROJECT_ID` **always** and pin prod via its own explicit value (removes the
   footgun; touches prod config). *Recommend (b)* — small, removes the only cross-env data risk;
   consequence of deferring: DEV misconfig can silently hit prod data.
2. **Favicon.** Now vs later. *Recommend later* (dedicated feature step); optionally silence the 404 now.
   Consequence of deferring: a harmless console 404 and no per-tenant favicon.
3. **Playwright.** Now vs later. *Recommend later* (needs test-auth mode). Consequence: regression safety
   stays with the manual smoke + unit/component suites.
4. **Deploy runbook location.** In-repo `docs/DEV-DEPLOYMENT.md` vs external. *Recommend in-repo* — kills
   tribal knowledge and versions with the code.

## 33. Definition of done for Step 1.30

- DEV Firestore isolation verified and hardened; startup names the DEV project; resolver test added.
- Required DEV env vars fail fast at startup per service, with actionable messages.
- A developer can, from the repo alone, understand and run/deploy the three apps in DEV
  (README platform section + `docs/DEV-DEPLOYMENT.md`).
- New-business empty states and key error/access-denied states are understandable (no blank/raw panels).
- Tenant/security boundaries and the working/preview/published invariants remain intact (all suites green).
- Favicon and other deferrals are explicitly documented as known/deferred.
- All verification gates pass and the 15–30 min manual DEV smoke passes.
- Statement achievable: *"The BakerRang DEV product is coherent end-to-end; an operator can authenticate,
  create/select a business, configure and Preview and Publish a site, attach a custom domain, and
  receive/manage leads; major empty/error states are understandable; tenant/security boundaries hold; DEV
  deployment is reproducible; no known blocker remains."*

---

### Architecture invariants preserved (§41)
Single renderer for all tenants; renderer → sanitized API → Firestore (no renderer Firestore access);
working/published snapshot isolation; `Home.sections` as homepage composition/nav authority;
`BusinessProfile` as structured identity; Theme = normal styling; Custom CSS = bounded escape hatch;
operator-managed custom domain V1; Cloud Run deployment; explicitly isolated DEV Firestore project.
The only proposed change that touches an invariant is the **B1 resolver hardening** — called out as a
deliberate configuration decision (§32), not a casual change. **No production deployment, DNS, or data
changes are part of 1.30 (§42).**
