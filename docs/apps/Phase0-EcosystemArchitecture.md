# BakerRang App Ecosystem — Frontend Architecture & UI Redesign (Phase 0 Plan)

> **Status: APPROVED / LOCKED for Milestone 1** — **Revision 4** (incorporates ChatGPT review
> rounds 1–2 and the round-3 product/design revision). The consumer-ecosystem architecture is
> locked; §§1–13 are the implementation contract for Milestone 1. Changes hereafter require an
> explicit re-review.
> **Author role:** Planner / Product & Design Architect.
> **Audience:** ChatGPT (orchestrator/reviewer) → Codex (implementor, after design approval).
> **Rule for this document:** no application/production implementation code.
>
> **Revision 4 changes (this pass):** **Supermarket removed from the ecosystem** (obsolete product
> — deleted, not migrated: gone from the target architecture, tree, package list, domain table, and
> migration sequence; new **§11.S Supermarket decommission** adds the full code/Account/backend/data
> inventory and the earliest-safe deletion points). Target is now **6 tools + Account** (8 deployable
> apps incl. Launcher). Launcher comp revised per human direction: masthead "Variety of Tools."
> (gold) / "One Workshop." (ink) with the Reserved-Gold rule widened to allow one intentional
> brand-emphasis moment; the **real `bakerrang-logo.png`** used in header + footer; Sign/Budget
> emblems improved; footer simplified to logo + copyright. **WoW logo asset does not exist in the
> repo — flagged as an open item (placeholder crest for now).**
>
> **Revision 3 changes (this pass — 4 locked-in corrections):** (1) global-theme **write**
> semantics resolved — the shared `web-theme` package owns persistence (any authenticated app
> persists the enum to a new `/account/preferences` endpoint, added to Milestone 1); backend wins
> on load **only when a preference is explicitly stored**; (2) localhost cookie behavior corrected
> (omit `Domain` + `Secure` on http localhost; host-scoped sharing across ports); (3) consumer
> **app** package names fixed to `@bakerrang/web-<name>` and all Docker `COPY` paths corrected to
> the `web/` build context; (4) PWA build config stays in `apps/launcher/vite.config.js` — **not**
> in `web-app-shell`. Also: staging hostname resolved to **`launch.bakerrang.com`**; the stale
> "Vite + build-time prerender" sentence removed (plain static SPA is the locked decision).
>
> **Revision 2 (prior):** shared `.bakerrang.com` theme cookie; consumer Impeccable world rooted
> at `web/`; minimal Phase-A UI; `@bakerrang/web-*` namespacing; conservative PWA caching; one
> parameterized `web/Dockerfile` + Linux relock; prerender deferred; staging-first.

---

## 0. Scope and a critical disambiguation

This repository already contains **two independent product lines**, and this plan concerns
only the first:

1. **The BakerRang consumer ecosystem** — `client/`. A single monolithic Vite/React SPA
   served at the apex **`bakerrang.com`**. It contains Home (launcher), Story Book, Polyglot
   (+ Polyglot Instant), Budget, Sign Language, WoW Advisor, Passwords (the zero-knowledge vault),
   and Account. **This is the thing to split and redesign.** *(It also still contains **Supermarket**,
   which is now **obsolete** and will be **deleted, not migrated** — see the decommission plan in
   §11. The target ecosystem is **6 tools + Account**.)*
2. **The BakerRang website platform** — `platform/`. A separate Next.js 16 / React 19 / TS
   npm-workspace (a B2B multi-tenant marketing-site builder): `apps/portal`
   (`portal.bakerrang.com`) + `apps/site-renderer` (`sites.bakerrang.com`) + shared
   `packages/{ui,site-components,site-schema,site-runtime}`. It has its own Impeccable design
   world (`DESIGN.md`, "The Business Workshop") and its own maturity. **It is out of scope to
   rewrite** — but it is our *proven reference implementation* for everything this plan
   proposes (workspace layout, shared packages, per-service Cloud Run deploys, change
   classification, per-app Dockerfiles, OAuth-target auth). We will copy its patterns, not its
   stack.

Both lines already share one backend: **`api.bakerrang.com`** (`server/`). That does not
change.

**Why this disambiguation matters:** the target subdomains the prompt lists
(`storybook.`, `polyglot.`, `account.`) are *new* consumer subdomains that will live beside
the existing `portal.`/`sites.` platform subdomains under the same registrable domain and the
same session. The consumer split must not disturb the platform.

---

## 1. Current-state assessment

### 1.1 Consumer frontend (`client/`) — the migration target

- **Stack:** Vite 4, React 18, `react-router-dom` v6, Tailwind 3, StandardJS lint, plain JS
  (no TS). One app, one build, one deploy.
- **Routing** ([client/src/App.jsx](../../client/src/App.jsx)): every product is a route under
  a single `<MainContent>` shell — `/storybook`, `/polyglot`, `/polyglot/instant`,
  `/supermarket` *(obsolete — being retired)*, `/account`, `/budget`, `/sign-language`, `/wow`,
  `/passwords`, plus `/` (Home) and `/login`. After Supermarket's removal the **target product
  boundaries are 6 tools + Account** (Story Book, Polyglot [Instant is a mode], Sign Language,
  Budget, WoW Advisor, Passwords) plus the Launcher — **8 deployable apps**, not the two named in
  the prompt.
- **Shell** ([client/src/components/MainContent.jsx](../../client/src/components/MainContent.jsx)):
  a top nav with logo, a 9-dot "waffle" **app launcher** ([AppGrid.jsx](../../client/src/components/AppGrid.jsx)),
  and a profile menu (Account / theme toggle / logout). This is already a Google-style app
  switcher — a strong conceptual seed for the ecosystem model.
- **Auth** ([client/src/providers/AuthProvider.jsx](../../client/src/providers/AuthProvider.jsx)):
  polls `GET /auth/check` every 30s; redirects to `/login` when anonymous. Session lives at the
  API.
- **API client** ([client/src/utils/index.js](../../client/src/utils/index.js)): a single
  `request()` helper — `credentials:'include'`, CSRF double-submit token fetched from
  `/auth/csrf` and attached as `x-csrf-token` on mutations with one 403 retry. `SERVER_PREFIX`
  is `import.meta.env.VITE_API_BASE_URL || 'https://api.bakerrang.com'` (hard-coded default).
- **Theme** ([client/src/providers/ThemeProvider.jsx](../../client/src/providers/ThemeProvider.jsx)):
  `localStorage` key `bakerrang-theme`, default **light**, toggles `.dark` on `<html>`.
  **Three weaknesses:** (a) no `prefers-color-scheme` support; (b) the class is applied in a
  `useEffect` *after* first paint → **theme flash (FOUC)**; (c) no cross-device / server
  persistence. The palette itself is well-documented (gold `#FFD500` + neutral charcoal, CSS
  variables in `index.css`, mirrored in `tailwind.config.cjs`).
- **Design reality:** the documented brand is disciplined, but the *screens* lean on the exact
  "generic AI SaaS" vocabulary the prompt wants gone — glassmorphism everywhere
  (`glass-card-*`, `glass-nav-*`), hero-section-with-icon-title-subtitle-stat-grid on nearly
  every page, big rounded cards, pills. The **brand tokens are worth keeping; the applied
  visual language is the thing to redesign.**
- **PWA:** a single generic manifest ([client/public/site.webmanifest](../../client/public/site.webmanifest))
  — `name:"BakerRang"`, two icons, `display:standalone`. **No service worker, no
  `vite-plugin-pwa`** (confirmed). Installing today yields one generic "BakerRang" app, not a
  per-product app.
- **Backend coupling** ([server/app.js](../../server/app.js)): each product already maps to its
  own router (`/storybook`, `/text/to/speech`, `/supermarket`, `/budget`, `/sign-language`,
  `/wow`, `/vault`, …) behind `isAuthenticated`. **Product frontends are already
  cleanly separable at the API layer** — no backend restructuring is required to split the
  frontend.

### 1.2 Backend & auth (`server/`) — reuse as-is

- **Session:** `express-session` + Firestore store, cookie `secure:'auto'`, `httpOnly`,
  **`sameSite:'lax'`**, `maxAge` 1 week, **no `domain` attribute set** → the cookie is
  *host-only on `api.bakerrang.com`*.
- **The load-bearing auth fact:** because every consumer subdomain
  (`bakerrang.com`, `storybook.bakerrang.com`, …) shares the registrable domain
  `bakerrang.com`, a `fetch(..., {credentials:'include'})` from any of them to
  `api.bakerrang.com` is **same-site**, so `SameSite=Lax` sends the session cookie. **Shared
  cross-subdomain auth already works with zero cookie changes.** (The platform's own Step 1.5
  plan reached the same conclusion for `portal.`.)
- **OAuth return-to** ([server/config/oauthTargets.js](../../server/config/oauthTargets.js) +
  [server/routes/auth.js](../../server/routes/auth.js)): a **symbolic target registry** already
  exists. `GET /auth/google?target=client|portal` stores a validated symbolic target in the
  session and the callback redirects to the matching `*_DOMAIN` env URL. Adding a new consumer
  app = adding one registry entry + one env var. Invalid targets 400; misconfig 500; it never
  redirects to a raw query URL (safe open-redirect posture).
- **CORS** ([server/config/origins.js](../../server/config/origins.js)): allowlist built from
  `CLIENT_DOMAIN`, `PORTAL_DOMAIN`, `SITE_RENDERER_DOMAIN`, `CHATBOT_ORIGIN` (+ dynamic
  custom-domain path for public lead POSTs). Adding a subdomain = add its env var to the
  allowlist builder.
- **CSRF:** double-submit (`csrf-csrf`), enforced on authenticated mutations, GET/HEAD/OPTIONS
  and `/public/*`, `/chatbot` skipped. Every app reuses the same `/auth/csrf` handshake.
- **Logout:** `GET`/`POST /auth/logout` clears the single server session. Because the session is
  central, logout is ecosystem-wide on next `/auth/check`.

### 1.3 Deployment & CI — already the target shape

This is the biggest asset. The repo is **already a multi-service, independently-deployable,
change-classified Cloud Run monorepo** (docs/CI-CD.md, `.github/workflows/*`,
`scripts/ci/classify-changes.mjs`):

- **Four Cloud Run services today:** `api`, `portal`, `renderer`, `client`. Live via **Cloud
  Run domain mappings** (Compute LB disabled in MAIN):
  `bakerrang.com`→client, `api.`→api, `portal.`→portal, `sites.`→renderer.
- **`scripts/ci/classify-changes.mjs`** is the *single authoritative dependency graph*
  (path→{ci,deploy}). It **fails closed on unknown paths**. Shared-package edits already
  fan-out to dependents (e.g. `platform/packages/ui/**` → portal **and** renderer).
- **PR CI** validates only affected services; **push to `main`** selectively builds/deploys
  affected services with immutable `git-<sha>` write-once images, a stale-deploy guard,
  digest-pinned Cloud Run updates, runtime-SA-unchanged assertions, and per-service smoke tests.
- **Per-app Dockerfiles:** the consumer `client` is a **static Vite build served by nginx**
  ([client/Dockerfile](../../client/Dockerfile) + [nginx.conf](../../client/nginx/nginx.conf),
  SPA `try_files … /index.html`, port 8080). The platform apps have their own Next Dockerfiles.

**Implication:** we do not invent deployment infrastructure. We *extend the existing
classifier and workflows* with new consumer services — the exact operation the repo was built
to absorb.

### 1.4 Impeccable assets (tooling model resolved)

Inspected `.impeccable/` and the installed skill (`.claude/skills/impeccable/SKILL.md` +
references). Findings that determine how a second world is created (§7.4):

- **Impeccable is one-world-per-project-root, resolved by cwd.** `impeccable context` (run once
  per session, cwd = "the user's project") loads **that root's `PRODUCT.md` + `DESIGN.md`**, the
  `.impeccable/design.json` sidecar, `.impeccable/config.json` (`buildPath: comp|code`), and the
  per-surface brief. `document` writes `DESIGN.md` **at the project root**. There is **no
  built-in multi-world selector** — *the world is selected by which root you run from.*
- **The existing world is rooted at the repo root**, not at `platform/`: root `DESIGN.md`
  ("Business Workshop") + `PRODUCT.md` + `.impeccable/design.json` describe the **platform**, and
  `.impeccable/mocks/*.html` are platform comps (website-editor, site-tools-rail, inspectors).
  `buildPath` is `comp`; comps live in `.impeccable/mocks/`, critique in `.impeccable/critique/`.
- **Consequence:** the consumer ecosystem gets its own world simply by making **`web/` a second
  Impeccable project root** (its own `web/PRODUCT.md`, `web/DESIGN.md`, `web/.impeccable/`), run
  with cwd = `web/`. This is tool-native, not an invented convention, and cannot overwrite the
  platform's repo-root world. Fully specified in §7.4.

### 1.5 Reuse scorecard

| Asset | Verdict |
|---|---|
| Backend + per-product API routers | **Reuse unchanged.** |
| Session/cookie/OAuth-target/CSRF/CORS model | **Reuse; extend registries/allowlist only.** |
| Cloud Run + classifier + reusable deploy workflow | **Reuse; add service rules + jobs.** |
| Vite+nginx static per-app Docker pattern | **Reuse as the per-app template.** |
| `platform/` workspace shape (apps/* + packages/*) | **Copy the shape, not the stack.** |
| Brand tokens (gold/charcoal, CSS vars) | **Keep; promote to a shared tokens package.** |
| `client/` crypto (vault), speech, kdbx, WoW logic | **Lift into the relevant product app intact.** |
| `client/` glassmorphism screen layouts | **Retire via Impeccable redesign.** |
| Single generic PWA manifest, no SW | **Replace with per-app manifest + SW.** |

---

## 2. Target architecture

**Principle: evolution, not rewrite.** The consumer apps stay **Vite + React 18 + Tailwind 3**
(their existing stack, their existing crypto/speech/kdbx code). We introduce a **second npm
workspace** — `web/` — sibling to `platform/`, so the two product lines keep their own React
and Tailwind majors and never entangle. Each consumer product becomes a **Vite SPA built to
static assets and served by nginx on its own Cloud Run service** — byte-for-byte the pattern
the current `client` already ships.

We do **not** collapse consumer apps into Next.js. They are authenticated client-side tools
with no SSR need; Next would be a gratuitous rewrite. (The launcher's SEO question is resolved in
decision 2 / §7.2: **a plain static Vite SPA with no prerender/SSG for Milestone 1**; prerender is
a documented future option, not built now.)

### 2.1 Proposed directory tree

```
bakerrang/
├─ server/                         # unchanged shared API (api.bakerrang.com)
├─ platform/                       # unchanged B2B platform workspace (portal/renderer)
├─ client/                         # KEPT during migration as the legacy combined shell,
│                                  #   retired at the end (strangler-fig). Deleted last.
├─ web/                            # NEW consumer npm workspace (Vite/React18/Tailwind3)
│  │                               #   ALSO a second Impeccable project root (see §7.4)
│  ├─ package.json                 # { workspaces: ["apps/*", "packages/*"] } + relock script
│  ├─ package-lock.json            # the ONE consumer lockfile (root install; §10.2)
│  ├─ .nvmrc                       # 20 (matches existing client CI; platform stays 24)
│  ├─ .gitignore
│  ├─ .dockerignore                # excludes node_modules/dist (§10.1)
│  ├─ Dockerfile                   # ONE parameterized image, ARG APP=<name> (§10.1)
│  ├─ nginx/nginx.conf             # shared SPA fallback config (copied into runner stage)
│  ├─ PRODUCT.md                   # consumer product context (Impeccable, §7.4)
│  ├─ DESIGN.md                    # consumer design world (Impeccable, §7.4)
│  ├─ .impeccable/                 # consumer world: config.json, design.json, mocks/, critique/
│  ├─ apps/
│  │  ├─ launcher/                 # bakerrang.com  — front door / app launcher + login
│  │  ├─ storybook/                # storybook.bakerrang.com
│  │  ├─ polyglot/                 # polyglot.bakerrang.com (Polyglot + Instant)
│  │  ├─ account/                  # account.bakerrang.com (profile/security/prefs)
│  │  ├─ passwords/                # passwords.bakerrang.com (vault; later phase)
│  │  ├─ budget/                   # budget.bakerrang.com (later)
│  │  ├─ sign/                     # sign.bakerrang.com (later)
│  │  └─ wow/                      # wow.bakerrang.com (later)
│  │                               # (NO supermarket/ — that product is retired; see §11.G+)
│  │     each app is package @bakerrang/web-<name> (launcher→@bakerrang/web-launcher, …);
│  │     each app/: index.html, vite.config.js (owns its PWA config — §5), public/
│  │                 (manifest+icons), src/, package.json  (NO per-app Dockerfile — §10.1)
│  └─ packages/                    # namespaced @bakerrang/web-* (NOT platform's @bakerrang/*)
│     ├─ web-tokens/               # @bakerrang/web-tokens — CSS-variable design tokens +
│     │                            #   Tailwind preset (the "same family" layer)
│     ├─ web-theme/                # @bakerrang/web-theme — ThemeProvider, no-flash boot,
│     │                            #   cookie+system+account resolution (§9)
│     ├─ web-auth/                 # @bakerrang/web-auth — AuthProvider, useAuth, login/logout
│     │                            #   helpers (OAuth target per app), session polling
│     ├─ web-api-client/           # @bakerrang/web-api-client — request(), CSRF handshake,
│     │                            #   API base resolution, typed per-domain wrappers
│     ├─ web-ui/                   # @bakerrang/web-ui — low-level primitives ONLY,
│     │                            #   seeded minimally (Launcher-required set; §11 Phase A)
│     └─ web-app-shell/            # @bakerrang/web-app-shell — thin shared chrome: app
│                                  #   switcher, account menu, brand header (composition)
├─ scripts/ci/classify-changes.mjs # EXTENDED: web/apps/* + web/packages/* + web-root rules
```

> **Package-naming convention (resolved).** Every consumer package — **apps and shared packages
> alike** — is `@bakerrang/web-*`:
> - **Apps:** `@bakerrang/web-launcher`, `@bakerrang/web-storybook`, `@bakerrang/web-polyglot`,
>   `@bakerrang/web-account`, `@bakerrang/web-passwords`, `@bakerrang/web-budget`,
>   `@bakerrang/web-sign`, `@bakerrang/web-wow`. *(No `@bakerrang/web-supermarket` — Supermarket
>   is a retired product; see §11.G+.)*
> - **Shared:** `@bakerrang/web-tokens`, `@bakerrang/web-theme`, `@bakerrang/web-auth`,
>   `@bakerrang/web-api-client`, `@bakerrang/web-ui`, `@bakerrang/web-app-shell`.
>
> The platform keeps its existing `@bakerrang/{ui,site-*}`. No two packages in the repo share an
> identity, so developers, agents, IDE search, and dependency tooling are never ambiguous, and the
> parameterized Docker build resolves an app deterministically as `@bakerrang/web-$APP` (§10.1). A
> `@bakerrang/web-ui` import is unmistakably consumer; a `@bakerrang/ui` import is unmistakably
> platform. Cross-importing between the two workspaces is prohibited (documented in each workspace
> root).

### 2.2 Package responsibilities & the coupling guardrail

- **`web-tokens`** — the *only* mandatory dependency for cross-app family resemblance. Pure
  values (color for light+dark, type scale, spacing, radius, elevation, motion, focus ring) as
  CSS variables + a Tailwind preset. No components, no React.
- **`web-theme`** — theme state machine + the anti-FOUC boot script + persistence strategy (§9).
- **`web-auth`** / **`web-api-client`** — the session/CSRF/OAuth-target plumbing lifted from
  `client/src/utils` and `AuthProvider`, generalized so each app passes its own OAuth target
  and API base.
- **`web-ui`** — genuinely generic, unopinionated primitives, **seeded minimally**. **Graduation
  rule (applied from day one):** a component enters `web-ui` only when **≥2 apps need it and
  would render it identically**. At Phase A it contains **only** the primitives the approved
  Launcher comp and shared chrome actually require — nothing is moved in just because it exists
  in `client/` today (see §11 Phase A). Product layouts, hero patterns, and domain widgets never
  enter `web-ui`.
- **`web-app-shell`** — optional, *thin*. Provides the shared app switcher + account/profile
  menu + brand header so navigation *conventions* are consistent, but each app owns its own body
  layout. It composes `web-ui` + `web-tokens`; it does not dictate page structure.

This is the explicit answer to "don't build a giant shared component library that couples every
app": **share tokens + infra + a deliberately small atom set; never share screens, and let
atoms graduate only on proven reuse.**

---

## 3. Domain / application model

| App | Subdomain | Cloud Run service | Deploy trigger (classifier path) | Notes |
|---|---|---|---|---|
| Launcher / front door | `bakerrang.com` (apex) | `web-launcher` | `web/apps/launcher/**` | Public marketing + app grid + login entry. Apex cutover is the **last** migration step. |
| Story Book | `storybook.bakerrang.com` | `web-storybook` | `web/apps/storybook/**` | First product extracted. |
| Polyglot | `polyglot.bakerrang.com` | `web-polyglot` | `web/apps/polyglot/**` | Includes Instant at `/instant`. |
| Account | `account.bakerrang.com` | `web-account` | `web/apps/account/**` | Shared account concerns (§8). |
| Passwords | `passwords.bakerrang.com` | `web-passwords` | `web/apps/passwords/**` | Heavy/self-contained; later phase. |
| Budget / Sign / WoW | `<name>.bakerrang.com` | `web-<name>` | `web/apps/<name>/**` | Same template, incremental. |
| ~~Supermarket~~ | — | — | — | **Retired product — not built, not migrated, no subdomain.** Decommissioned during migration (§11.G+). |
| Shared packages | — | (none) | `web/packages/**` → fan-out to **all** `web` apps | Mirrors platform's package fan-out. |

- **Deployment unit = one Cloud Run service per app**, each an nginx-static image, each with a
  Cloud Run **domain mapping** to its subdomain (same mechanism as today's four services).
- **Future products** get a subdomain by: scaffolding `web/apps/<name>/`, adding one classifier
  rule, one deploy job, one Cloud Run service + domain mapping, one CORS env var, one OAuth
  target. No shared-app growth.
- **The API stays at `api.bakerrang.com`** and remains the single backend for every app.

---

## 4. Authentication model (cross-subdomain SSO)

**Do not replace the auth architecture. It already supports this.**

### 4.1 How it works after the split

1. Session remains **central and host-only on `api.bakerrang.com`** (`SameSite=Lax`,
   `HttpOnly`, `Secure` in prod). **No `domain` attribute, no cookie broadening.**
2. Every `web` app calls the API via the shared `api-client` with `credentials:'include'`.
   Because all apps are subdomains of `bakerrang.com`, these are **same-site** requests, so the
   session cookie is sent. A user logged in anywhere is logged in everywhere — **already true,
   preserved**.
3. **Login** from app *X*: full-page navigation to
   `${API}/auth/google?target=<x>`. The API validates the symbolic target, runs Google OAuth,
   and the callback redirects back to `X`'s configured `*_DOMAIN`. The return redirect is a
   top-level GET → `SameSite=Lax` permits the freshly-set session cookie. Implementation =
   **extend `oauthTargets.js` `TARGET_ENV_KEYS`** with `storybook`, `polyglot`, `account`, …
   and add the matching `*_DOMAIN` env vars.
4. **Auth state** in each app: `@bakerrang/auth` `AuthProvider` hits `GET /auth/check`
   (LOADING → ANONYMOUS/AUTHENTICATED). Reuse the existing polling but lengthen the interval and
   pause on hidden tab (the vault provider already demonstrates this pattern).
5. **Logout:** `POST /auth/logout` (CSRF-protected) clears the single session; every app
   observes it on next `/auth/check`. (Keep the GET alias only until the legacy `client` is
   retired.)
6. **CSRF:** unchanged double-submit; each app performs the `/auth/csrf` handshake through
   `api-client`.
7. **CORS:** add each subdomain's env var to `buildAllowedOrigins`.

### 4.2 Centralized vs. decentralized login — decision

**Recommendation: decentralized login trigger (each app starts OAuth with its own return
target), no forced redirect to Account.** The `?target=` machinery already makes this safe and
one-hop. A central login page at `account.bakerrang.com` would add a redirect bounce and a
single point of failure for no security gain, since the session is already central at the API.
`account.` remains the place to *manage* identity, not a gate to pass through. (Revisit only if
we later add non-Google identity providers where a unified login surface reduces duplication.)

### 4.3 Security posture (explicit)

- **SameSite:** keep **Lax**, not None. Cross-*site* is never required (everything is
  same-site under `bakerrang.com`), so we avoid the weaker `None` posture. The platform's
  custom tenant domains already use a separate preview-token mechanism, untouched here.
- **Secure/HttpOnly:** unchanged (`auto`/on in prod, HttpOnly always).
- **Adding a subdomain** is a reviewed, enumerated operation: OAuth target + CORS origin + env,
  all fail-closed. No wildcard cookie domain, no wildcard CORS.
- **Open-redirect:** preserved — symbolic targets only; never redirect to a raw query URL.

---

## 5. PWA / install model (independently installable products)

**Goal:** installing Story Book yields a *Story Book* app, not "BakerRang that opens Story Book."
Separate origins make this natural — **a PWA's install identity is its origin + manifest**, and
each product now has its own subdomain origin.

Per app, in `web/apps/<name>/`:

- **`vite-plugin-pwa`** (Workbox) configured **inside each app's own `vite.config.js`**. PWA/
  Workbox/Vite config is **build tooling and does NOT live in `web-app-shell`** (a runtime
  React/chrome package — keeping build config out of it avoids coupling tooling to UI). For
  Milestone 1 the Launcher's PWA config lives entirely in `apps/launcher/vite.config.js`; **no
  shared PWA-config abstraction is created yet.** When Story Book becomes the second installable
  app, compare its `vite.config.js` PWA block to the Launcher's; **only if meaningful identical
  build infrastructure exists** does it graduate into a dedicated build package such as
  `@bakerrang/web-pwa-config` — never into `web-app-shell`.
- **Own `manifest.webmanifest`:** distinct `name`, `short_name`, `id`, `start_url` (`/`),
  `scope` (`/`), `theme_color`/`background_color` (shared brand values or a product accent),
  `display:standalone`, and **its own maskable icon set** (Story Book iconography ≠ Polyglot
  iconography — see §7).
- **Install identity (the guaranteed goal):** because origins differ, the OS treats each as a
  distinct installed app with its own name, icon, window, and title. No manifest-`id` collisions.

### 5.1 Conservative default caching policy (Milestone-1 default for every app)

The service worker is **shell-only** by default:

- **Precache only the static application-shell assets** required to install and cold-launch
  offline: the built HTML/CSS/JS bundle, fonts, and icons produced by the Vite build (Workbox
  precache manifest of hashed build outputs). Nothing user-specific.
- **API calls stay network-driven — never runtime-cached by default.** No default runtime
  caching of authenticated API responses, generated user content, Story Book output/audio, vault
  content, or any private/sensitive data. If offline yields no cached data, the app shows a
  normal offline/empty state, not stale private data.
- **A product may later add product-specific runtime caching deliberately**, as an explicit,
  reviewed design decision for that app only — never inherited by default.
- **Passwords (vault) gets an especially restrictive policy:** shell-only precache, **no runtime
  caching whatsoever**, and no offline decryption path in V1. Its zero-knowledge guarantees take
  priority over offline convenience.

This keeps the *architecture* (separate origin / manifest / SW per app) while ensuring the
*default behavior* cannot leak private data into a cache.

### 5.2 Cross-app navigation (corrected)

The app switcher (in `web-app-shell`) links to other products by their subdomain URL. **Whether
following such a link opens the *installed* destination PWA or simply navigates in the browser is
browser/OS-dependent and is not guaranteed.** We do not rely on that behavior. What is
guaranteed and sufficient for the goal is: **each product has an independent install identity and
an independent deployment.** Links between apps are ordinary cross-subdomain navigations; the
shared session (§4) keeps the user authenticated wherever they land.

**Decision — subdomain origins vs. path scopes:** keep each product on its **own subdomain
origin** (not path-scoped under one origin). Path-scoping (`bakerrang.com/storybook`) would force
one shared service worker and one manifest and re-couple everything we are separating. Subdomains
give clean install identities and independent deploys. (Recommended; see §11.)

---

## 6. Shared design-system architecture

Three explicit tiers (this is the contract Codex must respect):

### Tier 1 — Global BakerRang foundations (shared, in `@bakerrang/web-tokens`)
The layer that makes everything unmistakably one company:
- **Color:** gold `#FFD500` (+ `-hover`/`-deep` for on-light legibility) and neutral charcoal,
  as CSS variables for **both** light and dark, with WCAG-AA contrast pairs pre-solved
  (esp. the documented "dark text on gold, never white" rule).
- **Typography:** one type system (family, scale, weights, leading) — hierarchy by
  weight/scale/space before color.
- **Spacing, radius, elevation, motion, focus ring**: shared scales; restrained elevation (no
  decorative glass).
- **Brand marks:** the pixel-"B" logo + wordmark usage.
These are values, not components — cheap to share, hard to misuse, and the reason the family
coheres.

### Tier 2 — Reusable primitives & infra (shared, low-level)
- **`@bakerrang/web-ui`:** a **deliberately small** atom set. The eventual candidate list
  (Button, Input, Select carrying the hard-won `FolderSelect` learnings — themed custom
  dropdowns, never native `<select>` for dark mode — Modal/Dialog, Menu, Switch, Toast, Field,
  IconButton) is a *backlog, not a Phase-A scope*. Atoms enter only on proven ≥2-app reuse; the
  Launcher seeds the first few (§11 Phase A).
- **`@bakerrang/web-theme` / `web-auth` / `web-api-client` / `web-app-shell`:** cross-cutting
  behavior.
- Governed by the **graduation rule** (§2.2).

### Tier 3 — Product-specific components & visual language (NOT shared, per app)
Each product owns its screens, layouts, motion personality, illustration, and domain widgets.
Story Book's spread/reader, Polyglot's translation workspace + mic, Account's settings forms,
the Launcher's product presentation — these live in their app and are *encouraged to diverge*.

**Boundary rule for Codex:** if a thing expresses a product's personality or page structure, it
is Tier 3 and stays in the app. Only atoms, tokens, and infra cross the package boundary.

---

## 7. Impeccable UI direction

We will stand up a **consumer design world** via the Impeccable methodology (sibling to the
platform's `DESIGN.md`), then run Impeccable per surface to produce **approved comps before
Codex builds each app**. The direction below is the contract those comps must satisfy.

### 7.1 The shared spine (what makes them a family)
Gold-and-charcoal identity; the same type system; the same focus ring, spacing rhythm, and
motion character; the same app switcher and account menu; the same restrained elevation. A user
moving between apps should feel continuity in *chrome and craft*, not in *page templates*.

### 7.2 Per-surface direction

- **Launcher (`bakerrang.com`) — "the front door, not a dashboard."** A confident brand
  statement + an honest, tactile **product shelf**: each product represented by a real,
  distinct visual token (its own icon/illustration and one-line truth), not identical widget
  cards. Editorial layout with intentional asymmetry, generous but *purposeful* space, one
  primary action (open an app / sign in). No stat-grid, no "AI-powered" superlatives, no
  interchangeable cards.
- **Story Book — "a warm reading/authoring room."** Book/paper metaphor: spreads, page turns,
  serif display for story text vs. the sans UI chrome, a reader-first canvas where controls
  recede. Motion = page/turn transitions. Illustration-forward. Feels like a storytelling tool,
  not a form.
- **Polyglot — "a fast, spoken instrument."** Dense, immediate, keyboard- and voice-first. The
  mic and the two language panes are the whole screen; latency and feedback are the design.
  Monospace/tabular touches for transcripts; a single decisive accent. Instant mode is even more
  reductive — one big affordance. Feels like a live tool, not a marketing page.
- **Account — "a calm system-settings surface."** Quiet, legible, form-craft-first: clear
  sections (Profile / Security / Preferences), real labels, sane density, obvious save states.
  Deliberately the *least* decorated app — trust through restraint.

### 7.3 Anti-"generic AI SaaS" techniques (mandated)
- Retire glassmorphism, ambient gradients, and blur-as-decoration (structure via tonal
  separation + fine borders + minimal shadow — the platform `DESIGN.md` already codifies this;
  we adopt it for consumer).
- No universal hero (icon + big vague headline + subtitle + stat grid). Each app opens in its
  own idiom.
- Vary **layout, density, and rhythm** by product — a translation instrument and a reading room
  must not share a grid.
- Typography does the hierarchy work before color; no rounded-rectangle-everything, no
  pill-everything, no card-inside-card.
- Copy is concrete and product-true; no manufactured marketing superlatives.
- Iconography/illustration is a **per-product strategy**, not one icon set sprinkled everywhere.
- Motion is meaningful (state, continuity) not ambient.

**Process note:** each product-extraction phase includes an *Impeccable comp + finish-review*
gate. Codex implements against an approved comp, not against prose.

### 7.4 Consumer Impeccable design world — exact setup (resolved)

Grounded in the tooling model in §1.4. The consumer ecosystem becomes a **second Impeccable
project root at `web/`**, wholly separate from the platform's repo-root world.

**Exact files/directories (all under `web/`):**

| Path | Role |
|---|---|
| `web/PRODUCT.md` | Consumer product context (audience, purpose, principles). Distinct from the repo-root platform `PRODUCT.md`. Created by `impeccable init` run from `web/`. |
| `web/DESIGN.md` | The **consumer design world** doc (its own north star — *not* "The Business Workshop"), with the token frontmatter Impeccable reads. Created by `impeccable document --seed` run from `web/`. |
| `web/.impeccable/config.json` | Consumer detector config + `buildPath: "comp"`. |
| `web/.impeccable/design.json` | Machine sidecar for `web/DESIGN.md` (written with it). |
| `web/.impeccable/mocks/` | Consumer **comps** live here (e.g. `launcher-comp.html`). |
| `web/.impeccable/critique/` | Consumer critique reports. |

**How the two worlds are selected (no invented convention):** Impeccable resolves its world from
**cwd** at the `impeccable context` step. Agents run:

- **Platform design work:** `impeccable context` with **cwd = repo root** → loads repo-root
  `PRODUCT.md`/`DESIGN.md` (Business Workshop). *(unchanged)*
- **Consumer design work:** `impeccable context` with **cwd = `web/`** → loads
  `web/PRODUCT.md`/`web/DESIGN.md` (consumer world). `document`/comps/critique then read and
  write under `web/`.

Because selection is by root, the consumer world **cannot overwrite or be confused with** the
platform world; each `document` run writes to its own root's `DESIGN.md`.

**Agent instruction (to be recorded in `web/AGENTS.md` + `web/CLAUDE.md` during the design
step):** "This directory is the BakerRang **consumer** Impeccable project root. Run
`impeccable context` from `web/`. The consumer design world is `web/DESIGN.md`; comps live in
`web/.impeccable/mocks/`. Never edit the repo-root `DESIGN.md` (that is the platform world) for
consumer work, and never cross-import `@bakerrang/*` platform packages."

**One item to verify empirically during the design step (not an architecture risk):** confirm
the Impeccable **design hook** resolves the *nearest* `.impeccable/` when editing files under
`web/` (so consumer edits are checked against the consumer world, not the platform one). Validate
by running `impeccable doctor` from `web/`; if the hook is global-root-only, scope it via
`web/.impeccable/config.json` or the documented hook config. This is a small setup check, not a
blocker.

**This whole subsection is a required pre-Codex step (see the "Pre-Phase-A design step" in §11).**

---

## 8. Account application

`account.bakerrang.com` owns **cross-cutting identity and global preferences**; product-specific
settings stay in their product.

- **Belongs in Account:** profile (name/email/photo from Google), security/session (active
  session, logout-everywhere), **global theme preference** (the canonical server-stored value,
  §9), account-level settings, and a home for future subscription/billing if it ever exists.
- **Stays in products:** anything product-scoped — e.g. Passwords' auto-lock/inline-autofill
  vault settings (already a server-synced `settings` map on the vault doc), Polyglot's default
  languages, Story Book's narration voice. Account may *link* to these; it does not absorb them.
- **Backend:** reuses existing user records; a small `GET/PUT /account/preferences` (or reuse of
  the existing settings pattern) backs the canonical theme + global prefs. Fresh reads from
  Firestore, never the session snapshot (the platform's Step 1.2 rule).

---

## 9. Theme architecture (light/dark/system, cross-subdomain, no first-paint flash)

**Problem with the Revision-1 model (localStorage-first):** `localStorage` is **origin-scoped**.
`bakerrang.com`, `storybook.bakerrang.com`, and `account.bakerrang.com` do **not** share it, so a
choice made in Account cannot be read synchronously by Story Book's pre-paint boot script — Story
Book would paint its own stale/default value first, then correct after a backend fetch. That is
exactly the wrong-theme flash we must avoid.

**Revised model: a small, non-sensitive, domain-shared theme cookie is the synchronous
cross-subdomain source of truth for first paint; the account backend is the canonical
cross-device value; system is the default.** This is deliberately a *different* cookie from the
auth cookie.

### 9.1 The shared theme cookie (specification)

| Property | Value | Why |
|---|---|---|
| **Name** | `br_theme` | Short, namespaced, obviously non-auth. |
| **Value** | exactly `light` \| `dark` \| `system` | Non-sensitive preference only; no identifiers, no session data. |
| **Domain** | `.bakerrang.com` | Sent to **every** BakerRang subdomain, so any app's boot script reads it synchronously. |
| **Path** | `/` | All routes. |
| **SameSite** | `Lax` | Present on top-level navigations between subdomains; no cross-*site* need. |
| **Secure** | on in production (HTTPS); omitted only on `http://localhost` dev | Same posture as the app cookies. |
| **HttpOnly** | **NO** — must be **readable by JS** | The pre-React boot script and `ThemeProvider` read/write it client-side. Safe because the value is a non-secret enum. |
| **Max-Age** | ~1 year | Durable preference. |
| **Written by** | client JS (`@bakerrang/web-theme`) on any toggle, on any subdomain | No backend round-trip needed to propagate across subdomains. |

**Local development (explicit).** Cookies are **host-scoped, not port-scoped**, so a single
localhost cookie is shared by every consumer app running on different localhost ports
(3000/3010/3020/…). In dev, `@bakerrang/web-theme` writes `br_theme` with:
- **`Domain` OMITTED entirely** (a `Domain=.bakerrang.com` cookie would be rejected on `localhost`);
- **`Secure` omitted** when served over `http://localhost`;
- **`Path=/` and `SameSite=Lax` retained** (same as prod).

So the dev cookie is a host-only `localhost` cookie shared across ports; the prod cookie is a
`.bakerrang.com` cookie shared across subdomains. `web-theme` chooses which form to write from the
runtime origin (localhost/http → dev form; https → prod form).

**Explicit contrast with auth:** the **authentication/session cookie stays host-only on
`api.bakerrang.com`, `HttpOnly`, unchanged.** `br_theme` is a separate, non-sensitive, JS-readable
cookie scoped to `.bakerrang.com` (prod) / host-only (dev). Broadening *this* cookie is acceptable
precisely because it carries only a theme enum; we never broaden the auth cookie.

### 9.2 Synchronous no-flash boot (every app)

A tiny **blocking inline script** in each app's `index.html`, before the bundle, resolves theme
*before first paint* with a strictly synchronous, origin-independent chain:

1. Read `br_theme` from `document.cookie`.
2. If absent → treat as `system`.
3. If value is `system` (explicit or defaulted) → use `matchMedia('(prefers-color-scheme: dark)')`.
4. Set `<html data-theme="light|dark">` (and the `.dark` class) accordingly.

Because the cookie is domain-shared, **step 1 already reflects a choice made on any other
subdomain**, so there is no wrong-theme paint anywhere in the ecosystem — including on the public
launcher and before any backend call.

### 9.3 Write semantics, persistence ownership, and reconciliation (resolved)

The Revision-2 conflict — "any app writes the cookie" vs. "Account owns the backend write" vs.
"backend wins on load" — is resolved by making **`@bakerrang/web-theme` own the entire persistence
behavior** so every consumer app behaves identically, and by making the backend win **only when it
holds an explicitly stored preference**.

**User-initiated theme change — anonymous user:**
1. write `br_theme`; 2. update the resolved theme immediately. **No backend call** (no account).

**User-initiated theme change — authenticated user (from ANY consumer app: Launcher, Story Book,
Polyglot, Account, …):**
1. write `br_theme` immediately;
2. update the resolved theme immediately;
3. **persist the selected enum to the account-preferences backend** (`PUT /account/preferences`).

Account owns the *preference-management UX/settings surface*, but it is **not the only app allowed
to persist** the global preference — the shared `web-theme` package performs steps 1–3 everywhere,
so a change made in Story Book is durably saved and cannot later be reverted by a stale backend
value.

**Initial reconciliation on load (authenticated):**
1. Boot paints synchronously from `br_theme` / system (instant, no flash).
2. `web-theme` fetches `GET /account/preferences`.
3. If the backend holds an **explicitly stored** theme and it differs from `br_theme`, **backend
   wins**: update state, repaint, and rewrite `br_theme` to match (durable cross-device intent).
4. If the backend has **no stored theme yet**, do **nothing** — never overwrite an existing
   explicit cookie with a synthetic/default value. (Optionally, `web-theme` may seed the backend
   from the current explicit cookie on first authenticated load, but it must never downgrade an
   explicit choice to a default.)

**`system` semantics:** `system` is stored verbatim in both the cookie and the backend (never
pre-resolved), so each device/app re-evaluates the OS preference at boot; picking "system" on one
subdomain yields correct per-device system behavior everywhere.

### 9.4 Account-preferences persistence contract (in Milestone 1)

There is **no** account-preferences endpoint today (verified: `server/` has only the vault's own
`settings` and a `users/{userId}` doc written by `authService.checkAndStoreUser` as a **merge**).
Because the shared theme architecture depends on persistence from day one, a **small preference
endpoint is part of Milestone 1** (not deferred to the Account app):

- **`GET /account/preferences`** (`isAuthenticated`) → `200 { theme?: 'light'|'dark'|'system' }`.
  `theme` is **present only when explicitly stored**; omitted otherwise (so the client can honor
  reconciliation rule 4).
- **`PUT /account/preferences`** (`isAuthenticated` + CSRF) → body `{ theme: 'light'|'dark'|'system' }`,
  server-validated against the enum (reject others 400); **merge-writes** to
  `users/{userId}.preferences.theme` (mirroring `checkAndStoreUser`'s merge so no other user field
  — `platformRole`, profile — is ever erased); returns the stored `{ theme }`.
- New `server/routes/account.js` mounted `app.use('/account', isAuthenticated, accountRouter)`;
  reads fresh from Firestore (never the session snapshot); `node:test` coverage like existing
  routers. This is the *only* backend change in Milestone 1, and it is small and additive.
- The **Account app's** richer preference UX arrives in Phase E and reuses this same endpoint —
  the contract does not change when Account ships.

### 9.5 Contrast pre-solved

`@bakerrang/web-tokens` ships both palettes at AA minimum, so no app can ship an illegible pairing.

### 9.4 Is `localStorage` still needed?

**No — `localStorage` is dropped for theme.** The domain-shared cookie supplies synchronous
cross-subdomain first paint (which `localStorage` cannot), and the account backend supplies
cross-device durability. `localStorage` would add a third, origin-siloed copy that can only
disagree with the cookie. (An app may still use `localStorage` for unrelated per-viewer UI
conveniences; it just isn't part of the theme mechanism.)

**Tradeoff note:** the one concession is a JS-readable cookie. It is bounded to a three-value
enum with no security relevance, which is the standard, safe technique for exactly this
cross-subdomain-first-paint problem in static SPAs — and it is strictly separate from the auth
cookie.

---

## 10. Deployment / CI architecture

**Extend the existing machine; invent nothing.**

- **Classifier** (`scripts/ci/classify-changes.mjs`): add rules
  `web/apps/<name>/** → ci/deploy [web-<name>]` and `web/packages/** → fan-out to all web apps`
  (plus `web/package.json`, `web/package-lock.json`, shared config → fan-out), exactly like the
  platform's package rules. It **fails closed on unknown paths**, so every new path is a
  deliberate, reviewed classifier edit. Update its `*.test.mjs` alongside (the repo already tests
  the classifier and deployment policy in CI).
- **PR CI (`ci.yml`):** add a `web` matrix job — `npm ci` (own lockfile, Node 20 like `client`),
  `lint`, `build` per affected app, and `docker build` for affected apps' images. Mirror the
  `client-ci`/`platform-ci` structure; keep `ci-passed` as the aggregate gate.
- **Deploy (`deploy.yml` + `_deploy-cloud-run.yml`):** add a `validate-web` + per-app
  `deploy-web-<name>` caller for each new service, reusing the existing reusable workflow
  (immutable `git-<sha>` images, stale-deploy guard, digest-pinned update, runtime-SA-unchanged
  assertion, per-service smoke). Add each service to the `live-deploy-passed` aggregate and to
  the `workflow_dispatch` service choice list.
- **Smoke test:** each web app asserts HTTP 200 + SPA shell (`<div id="root"`), identical to the
  current client smoke.
- **Env & domains:** each service gets `VITE_API_BASE_URL` and `VITE_OAUTH_TARGET` (build-time)
  and its Cloud Run **domain mapping**; the API gets the new `*_DOMAIN` (CORS + OAuth target) and
  DNS records. These are **operational prerequisites via runbook**, not CI mutations (the repo
  already separates image deploys from env/DNS — docs/CI-CD.md).
- **DEV:** there is no cloud DEV; local dev uses ADC + localhost origins (unchanged). New apps
  get localhost ports (launcher 3000, storybook 3010, polyglot 3020, account 3030, …) and can
  point at the deployed API or a local API via `VITE_API_BASE_URL`.
- **Dependency-trigger correctness:** a `web/packages/web-tokens` change (or a change to the
  shared `web/Dockerfile`/`web/nginx/`/`web/package-lock.json`) rebuilds/redeploys **all** web
  apps (fan-out), while a `web/apps/polyglot` change deploys only Polyglot — exactly the behavior
  the prompt asks for, using the mechanism already proven for `platform/packages/*`.

### 10.1 Web-workspace Docker model (resolved: one parameterized Dockerfile)

The consumer apps are homogeneous (Vite build → static `dist` → nginx), so we use **one
parameterized Dockerfile at `web/Dockerfile`** rather than N near-identical per-app files. This
follows the platform's workspace-root build model (root `npm ci`, then build one workspace) but
avoids the platform's per-app Dockerfile duplication, which the platform only needs because its
runner stages differ (Next standalone) — ours don't.

- **Build context = `web/`** (`docker build … web`, like `docker build … platform`). The API image
  still builds from `server/`, platform from `platform/`; nothing about existing services changes.
- **All `COPY` sources are relative to the `web/` build context** (no `web/` prefix — a common
  mistake). `web/Dockerfile` (multi-stage), keyed by `ARG APP` (the *short* app name, e.g.
  `launcher`), with a `WORKDIR /app`:
  1. *deps stage:* `COPY package.json package-lock.json ./` + each `apps/*/package.json` and
     `packages/*/package.json` (mirroring the platform Dockerfile), then **`RUN npm ci`** at the
     workspace root — one install, all workspace deps resolved.
  2. *build stage:* `COPY . .`; `ARG APP`, `ARG VITE_API_BASE_URL`, `ARG VITE_OAUTH_TARGET`
     (required-arg guards like the platform Dockerfile); **`RUN npm run build -w @bakerrang/web-$APP`**
     (so `APP=launcher` → builds `@bakerrang/web-launcher`). Vite consumes the `VITE_*` args at
     build time; the app imports `@bakerrang/web-*` packages because they resolve inside the same
     installed workspace.
  3. *runner stage:* `nginx:stable-alpine`; **`COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf`**
     (shared SPA fallback, source relative to the `web/` context — **not** `web/nginx/...`);
     **`COPY --from=build /app/apps/$APP/dist /usr/share/nginx/html`**; `EXPOSE 8080`.
- **Path-contract note for Codex:** because the context root is `web/`, every Dockerfile `COPY`
  source is written as if standing inside `web/` (`nginx/nginx.conf`, `apps/$APP/...`,
  `package-lock.json`), never `web/nginx/...`. Reviewers should scan for stray `web/` prefixes.
- **Independent build/deploy preserved:** each Cloud Run service is a distinct logical service
  `web-<name>`; the reusable deploy workflow builds it with `--build-arg APP=<name>` (+ its
  `VITE_*` args). An `apps/polyglot` change classifies to `web-polyglot` only → only that image
  builds and deploys. A change to the **shared** `web/Dockerfile` or `web/nginx/` classifies to
  **all** web apps (correct fan-out, same as a shared package).
- **Why not one-app-per-Dockerfile:** identical runner stages ⇒ duplication with no isolation
  benefit; the parameterized file is DRY and the classifier already gives per-app deploy
  isolation. **Decision: one parameterized `web/Dockerfile`.**

### 10.2 Deterministic dependency workflow for `web/` (resolved)

The repo has an established Windows-vs-Linux lockfile hazard for npm workspaces/native deps;
`platform/` already ships a **docker-based `relock`** (regenerates the lockfile inside a Linux
Node container so it matches CI/Cloud Run). `web/` adopts the same discipline from day one:

- **One lockfile:** `web/package-lock.json`, produced by installing **at the `web/` root**. Never
  a per-app lockfile.
- **Install from lockfile (humans, agents, CI, Docker):** `npm ci` run in `web/` (Node 20 per
  `web/.nvmrc`). Deterministic, no lockfile mutation. This is the default everyone uses.
- **Intentionally change a dependency:** edit the relevant `apps/*/package.json` or
  `packages/*/package.json`, then run **`npm run relock`** (a `web/`-scoped, docker-based
  Linux relock mirroring `platform/`'s script, pinned to Node 20), and **commit the regenerated
  `web/package-lock.json`**. Do **not** hand-edit the lockfile and do **not** rely on a Windows
  `npm install` to produce the committed lockfile.
- **Never** run `npm install` casually on Windows to "fix" the lockfile — that reintroduces the
  platform-drift the relock script exists to prevent.

These rules go in `web/README.md` + `web/AGENTS.md`/`web/CLAUDE.md` so humans and agents follow
the same path.

---

## 11. Migration plan (incremental, strangler-fig)

**Principle:** never disappear for weeks. The legacy `client/` at `bakerrang.com` keeps serving
every product until each one is replaced. The apex flips **last**.

Each phase below lists: **scope · files/areas · decisions already resolved · acceptance ·
automated tests · manual verification.** Each product-extraction phase also carries an
**Impeccable comp gate** (approved comp before build; finish-review after).

### Pre-Phase-A — Consumer design world + approved Launcher comp (required precondition)
*A small design/preparation step, **before any Phase-A code**, with no application code.*
- **Scope:** stand up the consumer Impeccable project root at `web/` and produce the approved
  Launcher comp — the required precondition for Codex.
- **Steps (exactly, per §7.4):** create the `web/` directory shell (no app code); run
  `impeccable init` (cwd `web/`) → `web/PRODUCT.md`; run `impeccable document --seed` (cwd `web/`)
  → `web/DESIGN.md` + `web/.impeccable/design.json` (a consumer world, **not** "Business
  Workshop"); set `web/.impeccable/config.json` `buildPath: comp`; produce the **Launcher comp**
  in `web/.impeccable/mocks/launcher-comp.html` via Impeccable new-work/`shape`, then
  finish-review it. Write `web/AGENTS.md`/`web/CLAUDE.md` with the world-selection + no-cross-import
  rules. Verify hook scoping with `impeccable doctor` from `web/`.
- **Decisions resolved:** consumer world is rooted at `web/` (§7.4); front-door design direction
  (§7.2); anti-AI techniques (§7.3).
- **Acceptance:** `impeccable context` from `web/` loads the consumer world (not the platform's);
  repo-root `DESIGN.md` is untouched; the Launcher comp passes finish-review.
- **Automated tests:** none (design assets).
- **Manual:** human approves the Launcher comp; confirm the platform world still resolves from the
  repo root.

### Phase A — Consumer workspace foundation + shared packages (minimal)
- **Scope:** create the `web/` **npm workspace** and the infra packages, plus a **deliberately
  minimal** `web-ui`. No user-facing app yet; **no deploy**.
- **What is extracted now (conservative):**
  - `web-tokens` — the brand tokens/palette + Tailwind preset (from `index.css` /
    `tailwind.config.cjs`), authored to match the approved consumer `DESIGN.md`.
  - `web-theme` — the new cookie+system+account theme mechanism (§9). *New code, not a lift* (the
    old `ThemeProvider` is localStorage-only and is not reused wholesale).
  - `web-auth` + `web-api-client` — generalized from `client/src/utils/index.js` and
    `AuthProvider.jsx` (request/CSRF/OAuth-target/session-poll).
  - `web-ui` — **only the primitives the approved Launcher comp + shared chrome actually use**
    (expected: Button, and whatever minimal atoms the comp needs — Link/Icon wrappers, maybe one
    field if login requires it). **Nothing else.**
  - `web-app-shell` — the shared chrome the Launcher needs (brand header, app switcher, account
    menu shell), composing `web-ui` + `web-tokens`.
- **Explicitly NOT done in Phase A (graduation rule applied):** do **not** move `FolderSelect`,
  the modal family, or any other existing `client/` component into `web-ui` just because it
  exists. Those graduate later, only when a *second* app proves identical reuse (Passwords will
  likely graduate `FolderSelect`/modals; Story Book/Polyglot will surface their own candidates).
- **Files/areas:** new `web/**`; classifier + `ci.yml` gain a `web`-CI-only path (no deploy rules
  yet); reference (not bulk-move) logic from `client/src/utils/index.js`,
  `providers/{Auth}Provider.jsx`, `index.css`/`tailwind.config.cjs`.
- **Decisions resolved:** Vite/React18/Tailwind3; `@bakerrang/web-*` naming; three-tier boundary
  (§6); graduation rule applied minimally; cookie/system/account theme model (§9); Docker/relock
  model (§10.1–10.2).
- **Acceptance:** `web` installs via root `npm ci`, builds, lints, and unit-tests green in
  isolation; packages consume each other; `web-ui` contains only Launcher-required atoms;
  classifier still fails closed.
- **Automated tests:** unit tests for `web-api-client` (CSRF retry), `web-theme`
  (cookie/system/account reconciliation + no-flash resolution), `web-auth` (state machine);
  classifier test updated and green.
- **Manual:** eyeball the seeded atoms in both themes in a scratch harness; confirm no wrong-theme
  flash with a pre-set `br_theme` cookie.

### Phase B — Launcher app on a **staging subdomain** (pipeline proof)
- **Scope:** scaffold `web/apps/launcher` against the **approved Launcher comp**, consume the
  shared packages, add its PWA (own manifest + **shell-only** SW per §5.1), wire a **new Cloud Run
  service + a non-apex staging subdomain** (e.g. `launch.bakerrang.com`). **Apex untouched.** Built
  as a **plain static Vite SPA — no prerender/SSG** (§ decision 2 / §7.2).
- **Files/areas:** `web/apps/launcher/**`; **new `server/routes/account.js` +
  `GET`/`PUT /account/preferences` mounted in `server/app.js` (§9.4) with `node:test` coverage**
  (the one additive backend change); classifier + workflows gain `web-launcher`; new
  service/domain mapping/env/OAuth target `launcher`; CORS env; build via the shared
  `web/Dockerfile` with `--build-arg APP=launcher`.
- **Decisions resolved:** subdomain-per-app PWA identity; conservative shell-only caching;
  decentralized login; plain-SPA (no prerender); front-door design direction (§7.2); Impeccable
  comp approved first.
- **Acceptance:** staging subdomain serves the launcher (correct `<title>`/meta/manifest,
  semantic markup, publicly accessible); sign-in via `?target=launcher` returns correctly;
  installable as its own PWA with its own name/icon; light/dark/system correct with **no flash**
  (including a choice made on another subdomain via `br_theme`).
- **Automated tests:** app build + smoke (SPA shell); classifier/deploy-policy tests updated.
- **Manual (the Milestone-1 proof checklist):** install PWA on phone (name/icon correct); OAuth
  round-trip; `br_theme` cross-subdomain no-flash; cross-subdomain credentialed session
  (already-logged-in user lands authenticated); CORS; selective deploy (a launcher-only change
  deploys only `web-launcher`); the SW precaches shell only and does **not** cache API responses.

### Phase C — Extract **Story Book** → `storybook.bakerrang.com`
- **Scope:** move Story Book UI into `web/apps/storybook` (reuse `server` `/storybook`,
  `/text/to/speech`); redesign to the "reading room" direction; per-app PWA; new service +
  subdomain. Legacy `/storybook` route in `client/` stays live until cutover, then **redirects**.
- **Decisions resolved:** product-specific visual language stays in-app; Impeccable comp gate.
- **Acceptance:** feature parity with the legacy page; independently deployable; installable.
- **Automated tests:** app build + smoke; any lifted logic keeps its tests.
- **Manual:** full Story Book flow (generate, narrate, paginate); PWA install; auth; both themes;
  legacy redirect works.

### Phase D — Extract **Polyglot** (+ Instant) → `polyglot.bakerrang.com`
- Same template as C, "spoken instrument" direction; reuse speech/transcribe endpoints; Instant
  at `/instant`. Legacy routes redirect after cutover.

### Phase E — Stand up **Account** → `account.bakerrang.com`
- **Scope:** Account app owns profile/security/global prefs + canonical theme write
  (`GET/PUT /account/preferences` or reuse of the settings pattern); other apps link to it.
- **Acceptance:** theme set in Account propagates to other apps on next load; product settings
  remain in their products.

### Phase F — Apex cutover: `bakerrang.com` → `web-launcher`
- **Scope:** repoint the apex Cloud Run domain mapping from legacy `client` to `web-launcher`;
  legacy `client` becomes a thin **redirector** to the new subdomains for any remaining deep
  links. This is the load-bearing, reviewed operator step (mirrors the platform's "apex last"
  cutover discipline).
- **Acceptance:** `bakerrang.com` serves the new launcher; deep links redirect; auth intact.
- **Manual:** verify-live-style host checks on apex + every shipped subdomain.

### Phase G — Extract remaining products & retire `client/`
- **Scope:** Passwords (its own hardened PWA — minimal caching, its crypto/kdbx code lifted
  intact), then Budget, Sign, WoW, each via the template. **Supermarket is NOT extracted** — it is
  decommissioned (§11.S). When the last real product is live and redirects are in place,
  **delete `client/`** and its classifier/workflow entries.
- **Acceptance:** no product depends on `client/`; classifier no longer references it; all apps
  independently deployable and installable; **no Supermarket code remains** anywhere (frontend or
  backend) except any backend data explicitly retained for a stated reason (none currently).

### §11.S — Supermarket decommission (product deletion, not migration)

Supermarket is obsolete (built for a game/use case no longer relevant). It is **deleted, not
carried forward**. Do **not** invest any work migrating its functionality into the new Account app
or a new product app.

**Inventory (what exists today — for the deletion checklist):**
- *Frontend (`client/`):* `components/SuperMarket.jsx`, `components/ProductCounter.jsx`,
  `components/ProductLicense.jsx`; the `productLicenses` data in `constants/index.js`; the entire
  `assets/products/**` image tree (license21–47, hundreds of PNGs); the `/supermarket` route +
  `SuperMarket` export in `App.jsx`/`components/index.js`; the Supermarket tile in `AppGrid.jsx`.
- *Account coupling (load-bearing):* `components/Account.jsx` contains a **"SuperMarket Licenses"**
  section (imports `productLicenses` + `ProductLicense`; `licenses` state; `getLicenses`/
  `saveLicenses` calling `GET`/`POST /supermarket/licenses`). **This must NOT be ported to the new
  Account app.**
- *Backend (`server/`):* `routes/superMarket.js` (`GET`/`POST /supermarket/licenses`),
  `services/superMarketService.js` (Firestore `licenses/{userId}`), and the `app.js` mount
  `app.use('/supermarket', …)`.
- *Data-model / storage:* Firestore **`licenses/{userId}`** collection — obsolete game data; no
  other product reads it.
- *Shared/nav/CI:* covered by the existing `client/**` classifier rule; no separate rule, no
  platform coupling.

**When (earliest safe point, to avoid carrying obsolete work forward):**
1. **Phase E (Account app):** build the new Account **without** the SuperMarket Licenses section —
   the coupling dies here by simply not being ported. This is the earliest safe point and the whole
   reason to name it now.
2. **Phase G (client/ retirement):** delete all remaining Supermarket **frontend** with `client/`.
3. **Backend removal:** once no live surface calls `/supermarket/licenses` (i.e. after the legacy
   `client/` Account is retired at Phase F/G), delete `routes/superMarket.js`,
   `services/superMarketService.js`, and the `app.js` mount, in the same window as `client/`
   retirement.
4. **Data:** drop the Firestore `licenses/{userId}` collection as an operator step at decommission
   (no retention reason identified). If a genuine retention/compat reason emerges, that is the only
   thing that may survive — nothing else.

**End state:** when `client/` is retired, **no Supermarket product code remains** in the repo.

**Temporary compatibility layers:** (1) legacy `client/` deep-link redirects during C–G (a
`/supermarket` deep link 404s/redirects to the launcher — the product is gone); (2) the existing
`client` GET-logout alias kept until `client/` retirement; (3) `web-launcher` on a staging
subdomain until Phase F.

---

## 12. Risks & decisions (recommendations)

1. **Consumer stack: keep Vite/React18/Tailwind3 vs. adopt platform's Next/React19/Tailwind4.**
   → **Keep the consumer stack** in a separate `web/` workspace. Unifying majors is a large
   rewrite with no user benefit and risks the vault/crypto/speech code. *Boring wins.*
2. **Launcher rendering: plain Vite SPA vs. prerender/SSG (front-door SEO).** *(revised)*
   → **Plain static Vite SPA for Milestone 1 — no prerender/SSG.** There is no demonstrated SEO
   requirement today that justifies the added build complexity. The front door will ship correct
   `<title>`, meta tags, `manifest`, semantic markup, and public accessibility, which is
   sufficient for a small marketing surface. **Document prerender/SSG (or moving the launcher to
   Next SSG) as a future option** to activate only if a concrete marketing/search requirement
   appears (e.g. ranking for specific terms, rich link previews at scale). No concrete requirement
   is on the table, so we do not pre-pay it.
3. **PWA scoping: subdomain-per-app vs. path-scoped under one origin.**
   → **Subdomain-per-app.** Path-scoping re-couples SW/manifest and kills independent install
   identity — the whole point of the project.
4. **PWA caching aggressiveness.** *(revised in)* → **Conservative shell-only by default**
   (§5.1). No default runtime caching of API/private data; per-product caching is an explicit
   later decision; Passwords is especially restrictive (no runtime caching). Cross-PWA link
   behavior is not relied upon (§5.2).
5. **Login: decentralized per-app vs. centralized at Account.**
   → **Decentralized** via the existing `?target=` machinery (one hop, session already central).
   Revisit only for multi-IdP.
6. **Theme persistence + write semantics.** *(revised, R3)*
   → **Domain-shared non-sensitive `br_theme` cookie** (`.bakerrang.com` prod / host-only on
   localhost, JS-readable, enum-only) for synchronous cross-subdomain no-flash first paint, **+
   account backend** (new `/account/preferences`, §9.4) as canonical cross-device value, **+
   system** default (§9). The shared `web-theme` package **owns persistence**: any *authenticated*
   app persists the enum on a user change; on load the **backend wins only if a preference is
   explicitly stored** (never overwrite an explicit cookie with a default). `localStorage` is
   dropped for theme. The auth cookie stays host-only/HttpOnly on the API — unchanged and separate.
7. **Number of apps at launch.** 8 deployable apps (Launcher + 6 tools + Account) is still a lot of
   surface. → **Sequence by value/risk:** Launcher → Story Book → Polyglot → Account first;
   Passwords/Budget/Sign/WoW after the pipeline is proven. **Supermarket is not in the sequence — it
   is decommissioned (§11.S), not extracted.** Don't big-bang.
8. **Passwords (vault) as its own origin.** → **Yes, but late.** Its zero-knowledge crypto needs
   dedicated attention and the **most restrictive** SW policy (shell-only, no runtime caching, no
   offline decryption in V1); isolate it on its own origin, migrate its code verbatim, redesign
   chrome only.
9. **Web-workspace Docker/relock model.** *(resolved, §10.1–10.2)* → **One parameterized
   `web/Dockerfile` (`ARG APP`)** with root `npm ci`; **one `web/package-lock.json`**; install via
   `npm ci`; change deps via a docker-based Linux **`relock`** (mirroring `platform/`); never
   hand-edit or Windows-`npm install` the lockfile.
10. **Operator prerequisites (DNS, Cloud Run domain mappings, env/secrets, OAuth redirect URIs,
    CORS).** Each new subdomain needs: DNS record, Cloud Run domain mapping, `*_DOMAIN` env on
    API, OAuth target entry. The Google OAuth **authorized redirect URI** already points at the
    API callback (so **no new redirect URI per app** — a nice property of the `?target=` model).
    → Capture as a per-app **runbook checklist** (like the platform's onboarding runbooks); these
    are operator steps, **not** CI mutations.
11. **Package naming across two workspaces.** *(resolved)* → Consumer packages are
    **`@bakerrang/web-*`**; platform keeps `@bakerrang/{ui,site-*}`. **No duplicate identities in
    the repo.** Cross-importing between the two workspaces is prohibited and documented in each
    workspace root. This supersedes Revision 1's "acceptable collision" stance.

### 12.1 Remaining decisions
- **Staging subdomain name — RESOLVED by the orchestrator: `launch.bakerrang.com`.** This is the
  Milestone-1 staging hostname; no further decision needed.
- **Impeccable design-hook scoping under `web/`** — confirm empirically during Pre-Phase-A that
  the hook checks consumer edits against the consumer world (§7.4). A setup check, not an
  architecture risk.
- **Retiring `client/`'s legacy per-product routes** — the exact redirect map from old
  `bakerrang.com/<route>` deep links to new subdomains (finalized at Phase F, not now).
- Everything else in §§1–11 is resolved and **locked** for Milestone-1 implementation.

---

## 13. Recommended first implementation milestone

**Pre-Codex precondition (design step, not code):** the consumer Impeccable world at `web/`
(`web/PRODUCT.md`, `web/DESIGN.md`, `web/.impeccable/**`) **and a human-approved, finish-reviewed
Launcher comp** at `web/.impeccable/mocks/launcher-comp.html` (Pre-Phase-A in §11, mechanics in
§7.4). Codex does not start Milestone 1 until this exists.

**Milestone 1 = Phase A + Phase B: "Foundation + Launcher on a staging subdomain."**

Deliver the `web/` npm workspace with the infra packages (`web-tokens`, `web-theme`, `web-auth`,
`web-api-client`, `web-app-shell`) and a **minimal** `web-ui` (only Launcher-required atoms), then
stand up the **Launcher** — a **plain static Vite SPA** — as the first real app on the **non-apex
staging subdomain `launch.bakerrang.com`** with its own PWA (shell-only SW) and its own Cloud Run
service via the extended classifier/workflows and the parameterized `web/Dockerfile`.
**`bakerrang.com` and every existing product stay untouched.**

**Milestone-1 boundary — explicitly IN:** `web/` workspace + root `npm ci`/relock; the five infra
packages + minimal `web-ui`; the Launcher app built to the approved comp; per-app PWA identity +
shell-only caching; the full `br_theme` cookie + system model **including the `web-theme`
persistence path and the new `GET`/`PUT /account/preferences` endpoint** (§9.3–9.4) with no-flash
boot and explicit-preference-wins reconciliation; OAuth `target=launcher`; CORS entry; new
`web-launcher` Cloud Run service + `launch.bakerrang.com`; classifier + CI/deploy extension;
selective-deploy proof.

**Explicitly OUT of Milestone 1:** any apex (`bakerrang.com`) change; extracting Story Book,
Polyglot, Account, or any other product; moving `FolderSelect`/modals/other components into
`web-ui`; prerender/SSG; product-specific runtime caching; **the Account app's preference-management
UX/settings surface** (the shared `web-theme` package still *persists* a signed-in user's theme via
`/account/preferences` from the Launcher — only the richer Account settings screen is deferred to
Phase E; the persistence endpoint and contract ship now).

> **Milestone-1 boundary change from the R3 theme correction:** the persistence contract
> (`/account/preferences` endpoint + `web-theme` writing on authenticated change) is now **inside
> Milestone 1**. Previously the Launcher was described as read-only for the account value; it now
> also persists on user change, because the shared theme architecture depends on it from day one.
> This adds exactly one small, additive backend router; no other boundary change.

**Why this first:** it exercises *every* load-bearing part of the plan — the workspace, the
three-tier design boundary, the domain-cookie no-flash theme model, cross-subdomain auth via
`?target=`, a per-app PWA install identity, and an independent classifier-driven Cloud Run
deploy — on the **lowest-risk surface** (a brand-new subdomain, apex and existing products
untouched). Once green, extracting Story Book, Polyglot, and Account is repetition of a proven
template rather than discovery.

---

*End of Phase 0 plan (Revision 3 — APPROVED / LOCKED for Milestone 1). No application/production
code has been written. The Pre-Phase-A consumer Impeccable design step proceeds next; Codex
implementation of Milestone 1 waits on design approval.*
