# Step 1.24 — Portal Visual Foundation — Implementation Plan

**Status: READY FOR IMPLEMENTATION (pending the human decisions in §8).**
**Companion to:** [Step 1.24 Spec](Step1.24-PortalVisualFoundation-Spec.md) · [Roadmap 1.24–1.30](Step1.24to1.30-RoadMap.md)

This is a **plan only** — no code is changed by this document. It plans a staged, incremental
transformation of the existing functional Portal into the visual foundation of a polished SaaS
product, preserving every existing behavior (auth, business management, site editing, publishing,
leads, media, custom domains). It explicitly does **not** touch the public site renderer, tenant
theme controls, or any backend API.

---

## 1. Current-state findings (from the code)

### 1.1 Workspace / tooling
- Root: `platform/` npm workspaces (`apps/*`, `packages/*`), Node ≥24, Tailwind **v4** (CSS-first,
  `@tailwindcss/postcss`), ESLint 9 (`eslint-config-next` core-web-vitals + typescript), TS 6.
- Portal app `@bakerrang/portal`: Next **16.3.0** App Router + React **19.2.8**, `next dev -p 3001`,
  `output: 'standalone'`, `transpilePackages: ['@bakerrang/site-schema', '@bakerrang/ui']`.
- Verification scripts today: `typecheck` (tsc --noEmit), `lint` (eslint), `build` (next build) per
  workspace. **There is no frontend test runner anywhere in `platform/`** (`*.test.*` glob is empty).
  Backend `node:test` suites live in the separate `server/` tree and do not cover the portal.

### 1.2 The shared-token constraint (most important finding)
- Design tokens live in **one shared file**: `platform/packages/ui/src/styles/tokens.css`, a Tailwind
  v4 `@theme` block with only **8 tokens**: `--color-bg #f8fafc`, `--color-surface #ffffff`,
  `--color-border #d9e0e8`, `--color-fg #172033`, `--color-fg-muted #617087`,
  `--color-accent #425b76` (a slate blue-gray — **not** BakerRang yellow), `--color-accent-fg #fff`,
  `--radius-md 0.5rem`. No typography scale, spacing scale, shadow tokens, semantic status colors,
  or any dark-surface tokens. The palette is entirely light and generic.
- **This file is imported by BOTH apps.** `apps/portal/app/globals.css` and
  `apps/site-renderer/app/globals.css` each do `@import "@bakerrang/ui/tokens.css";`.
- The renderer's *public-site content* is insulated: `packages/site-components/src/site-theme.css`
  defines a `.site-shell` scope that **re-declares** `--color-bg/-surface/-border/-fg/-fg-muted/-accent`
  locally (from its own `--site-*` palette). **But** the renderer's `<body>` background/text and its
  bare loading / `notFound` / error chrome (outside `.site-shell`) read the *raw shared* tokens
  (`var(--color-bg)`, `var(--color-fg)` — confirmed 1 use each in `apps/site-renderer/app`).
- **Consequence:** repurposing the shared `--color-*` *values* to the BakerRang identity (yellow
  accent, charcoal, etc.) would visibly change the renderer's body/chrome — prohibited by the spec
  ("Do not redesign the public site renderer"). The portal identity must therefore be layered in a
  **portal-scoped** token file the renderer never imports (see §2).

### 1.3 UI package = 3 primitives only
`packages/ui/src` exports exactly **`Button`, `Input`, `Container`** (+ `tokens.css`).
- `Button`: always renders `bg-accent text-accent-fg` (slate). **There is no variant system.** Every
  "secondary" button in the app is produced by passing a `className` that *overrides* the accent with
  `border border-border bg-surface … text-fg` — this override pattern is **repeated ~40 times** across
  the editors, and every dense action button additionally overrides the size to `min-h-9 px-3 py-1.5
  text-xs`. Fragile and unmaintainable.
- `Input`: reasonable (min-h-11, border, focus ring). Used widely.
- `Container`: `mx-auto max-w-6xl px-5 sm:px-8`.
- **Not-in-the-package but duplicated inline everywhere:** `<textarea>` (the same ~120-char class
  string appears verbatim in Hero/Services/Contact/LeadNotes/Profile), native `<select>` (Contact,
  Leads), cards (`rounded-md border border-border bg-surface p-…`), status pills/badges
  (`rounded-md border … text-xs font-semibold text-fg-muted`), `role="status"` loading text,
  `role="alert"` error text, empty states, file inputs, and image-grid tiles.

### 1.4 Information architecture: a single page, everything inline in list rows
This is the core structural obstacle to a "SaaS shell with sidebar."
- The **entire portal is one route**: `app/page.tsx`. There is **no routing, no sidebar, no shell**.
- `page.tsx` renders a login/sign-out card and, when authenticated, `BusinessManager` →
  `BusinessList`. Each business is a `<li>` in one `<ul>`.
- **All functionality is crammed into the right-aligned column of each list row**
  (`flex … sm:items-center sm:justify-between`, controls in a `sm:items-end` stack). Inside that
  narrow column, `BusinessWebsite` renders a **~11-button cluster** (Branding, Profile, Domain,
  Manage Sections, Hero, Services, Gallery, Testimonials, Contact, Publish, Unpublish) and, on click,
  swaps in a full editor form (`max-w-lg/xl/3xl`). `BusinessLeads` renders a full leads
  **inbox + detail + status workflow + notes** (`max-w-xl`) in the same column.
- Net effect: a full leads inbox and multi-section website editor live inside a list-row cell. This is
  exactly what will "simply overflow" on mobile, and it makes any sidebar decorative. **The visual
  foundation cannot be delivered by styling alone; it needs a light routing/layout spine so the
  sidebar has real destinations and each area gets full workspace width** (see §3, §8-Decision-2).

### 1.5 Screen/route inventory (what exists to migrate)
All below are components under `apps/portal/app/`, currently rendered inline (no URLs):
| Area | Components | Notes |
|---|---|---|
| Auth/login | `page.tsx`, `providers/AuthProvider.tsx`, `lib/auth.ts` | Google OAuth via full navigation; `/auth/check`, logout GET. **No change to auth behavior.** |
| Businesses list + create | `businesses/BusinessManager.tsx`, `BusinessList.tsx`, `CreateBusinessForm.tsx` | list, forbidden/error/empty states, create form |
| Website management | `BusinessWebsite.tsx` (299 lines, the hub) + editors: `BrandingEditor`, `BusinessProfileEditor`, `HeroEditor`, `ServicesEditor`, `GalleryEditor`, `TestimonialsEditor`, `ContactEditor`, `SectionCompositionEditor` | Manage/Initialize/Publish/Unpublish; per-section editors; status badges |
| Custom domain | `CustomDomainEditor.tsx` | DNS TXT record display, verify/activate/disable/remove lifecycle; **uses `window.confirm`** for remove |
| Leads | `BusinessLeads.tsx` (inbox+detail+status), `LeadNotes.tsx` | native `<select>` status, optimistic concurrency (409), notes |
| Media | embedded inside Gallery/Branding/Profile editors | upload + recent-images grid; no standalone screen |
| Shared client libs | `lib/{api,auth,businesses,leads,media,site}.ts` | fetch/CSRF/ApiError — **reuse verbatim, no changes** |

### 1.6 Accessibility / interaction baseline (as-is)
- Reasonable: `<button>` elements, `role="status"`/`role="alert"` on state text, most inputs have
  `<label htmlFor>`, `aria-describedby`/`aria-invalid` on the create form, focus-visible outlines on
  Button/Input.
- Gaps: `window.confirm` (native, not stylable, breaks the SaaS feel) in the domain remove flow;
  dense action buttons drop to `min-h-9` (36px — under the 44px touch target); no focus management for
  any modal/drawer (none exist yet); navigation is nonexistent; the brand yellow, if used as text on
  the light workspace, will fail WCAG contrast (must be enforced as a rule).

### 1.7 Brand assets
- **The portal has no `public/` directory and no logo.** A BakerRang logo PNG exists in the *other*
  app (`client/src/assets/bakerrang-logo.png`, a blocky yellow/charcoal "B" monogram) plus favicons in
  `client/public/`. The portal needs a full logo (wordmark) and an icon-only variant placed in
  `apps/portal/public/` (or the ui package). See §8-Decision-4.

---

## 2. Proposed design-system architecture

### 2.1 Guiding rules
1. **Renderer isolation (non-negotiable):** never change the *values* in the shared token file that
   the renderer reads. Split tokens into a frozen renderer-neutral base and a portal-only identity
   layer. Verify the renderer build stays byte/visual-identical.
2. **Semantic tokens, not raw hex, in components.** The `#FEC51C / #292B2F / #1C1F29` values from the
   spec become the *definitions* of semantic tokens (`--color-brand`, `--color-sidebar`, …); markup
   references the semantic names only.
3. **Light workspace, dark sidebar.** Two surface families in one file: a light "workspace" family and
   a dark "sidebar" family. No full portal dark-mode in this step.
4. **Yellow is a fill/accent, never body text on light.** Enforced by giving yellow an "ink" foreground
   partner and never exposing a "yellow text on light" utility (mirrors the main app's documented
   `--brand-gold-deep` lesson).
5. **Tailwind v4 only, no component framework.** New tokens via `@theme`; primitives are thin React +
   Tailwind. Later `@theme` blocks override earlier ones, so the portal layer cleanly overrides the base
   for the portal only.

### 2.2 Token files (recommended home: keep in `packages/ui`, split the file)
Rationale: the ui package's Button/Input/Container are, in practice, **already portal-only** (the
renderer and site-components import *none* of them — only `tokens.css`). So the ui package is de-facto
the portal primitive library; we just have to stop the shared token file from carrying portal identity.

- **`packages/ui/src/styles/tokens.css`** → keep the *filename and current values frozen* (renderer
  keeps importing this unchanged). Optionally rename its role in comments to "base / renderer-neutral."
- **NEW `packages/ui/src/styles/tokens-portal.css`** — the BakerRang portal identity, exported via the
  package `exports` map as `./tokens-portal.css`. Imported **only** by `apps/portal/app/globals.css`
  (after the base import). Contents (illustrative, exact values finalized in impl):
  - **Brand:** `--color-brand: #FEC51C`, `--color-brand-hover`, `--color-brand-active`,
    `--color-brand-ink: #1C1F29` (charcoal text placed *on* yellow), `--color-brand-subtle` (a pale
    yellow wash for selected/active backgrounds — used sparingly).
  - **Sidebar (dark charcoal family):** `--color-sidebar: #292B2F`, `--color-sidebar-deep: #1C1F29`,
    `--color-sidebar-fg`, `--color-sidebar-muted`, `--color-sidebar-active` (brand-tinted),
    `--color-sidebar-border`.
  - **Workspace (light family) — override the base names for the portal:** `--color-bg` (light gray
    workspace), `--color-surface #fff`, `--color-surface-muted`, `--color-border`,
    `--color-border-strong`, `--color-fg`, `--color-fg-muted`, `--color-fg-subtle`.
  - **Primary/accent → brand:** override `--color-accent`→brand and `--color-accent-fg`→brand-ink so
    existing `bg-accent`/focus references become BakerRang yellow *in the portal only*.
  - **Semantic status:** `--color-success/-fg/-subtle`, `--color-warning/…`, `--color-danger/…`,
    `--color-info/…` (drive Badge tones + form errors; danger replaces ad-hoc `text-red-700`).
  - **Focus ring:** `--color-focus` (see §8-Decision-5 — brand yellow vs a dedicated high-contrast ring)
    + a shared `outline` convention used by all primitives.
  - **Radii:** `--radius-sm/-md/-lg/-xl` — moderate rounding that "subtly reflects the logo" (the mark
    is blocky, so keep radii restrained, not pill-shaped).
  - **Shadows:** `--shadow-xs/-sm/-md` — restrained, low-alpha (SaaS, not flashy).
  - **Typography:** font family token; body/heading sizes primarily via Tailwind's built-in type scale
    (`text-sm/base/lg/xl/2xl/3xl`), with weight/tracking conventions documented, not new tokens.
- **Breakpoint strategy:** Tailwind defaults (sm 640 / md 768 / **lg 1024** / xl 1280). The **shell
  boundary is `lg`**: persistent sidebar ≥`lg`; compact header + drawer `<lg`. (See §8-Decision-8 for
  an optional `md`–`lg` icon-only rail.)
- **Alternative home (Decision-1):** a new `@bakerrang/portal-ui` package instead of extending
  `packages/ui`. Cleaner hard wall, more churn. Recommendation: extend `packages/ui` with the split;
  it satisfies the spec's stated "prefer primitives in `packages/ui`" and the renderer never sees the
  portal layer anyway.

### 2.3 Surface hierarchy
`workspace bg` (lightest gray) → `surface` (white cards/panels) → `surface-muted` (nested wells, e.g.
the current `bg-bg` inside cards) → thin `border` between them; `border-strong` for emphasis; shadows
reserved for elevated things (dialogs, drawer, sticky action bar). Dark sidebar is its own family.

---

## 3. Proposed responsive application-shell architecture

### 3.1 Recommended IA change (minimal routing spine) — see §8-Decision-2
Deliver a real shell by giving it real destinations, **reusing every existing editor component
verbatim** (this is re-hosting + restyling, not a logic rewrite):

```
app/
  layout.tsx                      # html/body/providers only (unchanged responsibility)
  (portal)/                       # authenticated route group → renders <AppShell>
    layout.tsx                    # auth gate + AppShell (sidebar/header/drawer/container)
    page.tsx                      # Businesses (list + create)  [was BusinessManager]
    businesses/[tenantId]/
      layout.tsx                  # per-business workspace header + sub-nav (Website / Leads)
      page.tsx                    # business overview / website management hub
      website/…                   # section editors (reuse existing editor components)
      leads/…                     # leads inbox + detail (reuse BusinessLeads/LeadNotes)
      domain/…                    # custom domain (reuse CustomDomainEditor + new Dialog)
  login/ (or unauth branch)       # login card in shell-less layout
```

- Sidebar nav (top level): **Businesses** (only PLATFORM_ADMIN-relevant destination today). Per-business
  areas (Website / Leads / Domain) appear as a **contextual sub-nav** once a business is selected —
  this is the "tenant/business context where appropriate" the spec asks for.
- Editors move out of the list-row column into full-width routed panels. The 11-button cluster becomes
  a structured section list within the Website area with a **sticky Publish/primary action bar**.
- **Fallback (Decision-2 = shell-only):** if the human wants to defer IA to roadmap 1.29, wrap the
  *current* single page in `<AppShell>` and restyle in place. This is lower risk but leaves the
  cram-everything-in-a-row UX and a largely decorative sidebar, and only partially satisfies the mobile
  mandate. **Recommendation: the routed spine**, because the spec forbids "desktop shell with pieces
  hidden at breakpoints," which the single-page model cannot honestly avoid.

### 3.2 Shell components (live in the portal app, not the ui package — they are app structure)
- `AppShell` — CSS grid: `[sidebar | main]` at ≥lg; `[header / main]` below.
- `Sidebar` (≥lg) — dark charcoal; `Brand` (logo + "BakerRang" wordmark) at top; `NavItem`s (icon +
  label, active state = brand-tinted, aria-current); `AccountMenu` (user email + Sign out) pinned bottom.
- `TopBar` (<lg) — compact: hamburger + icon-only brand + account button.
- `MobileDrawer` — off-canvas sheet with the same nav; focus-trapped, Esc to close, restores focus,
  closes on route change / backdrop click; `role="dialog" aria-modal`.
- `ContentContainer` — comfortable workspace width (reuse `Container` max-w-6xl) with responsive padding.
- `PageHeader` — title + optional description + right-aligned actions; consistent across screens.
- `Brand` — renders full lockup or icon-only depending on `variant` (sidebar vs collapsed/mobile).

### 3.3 Branding behavior
Desktop sidebar → logo + wordmark. Mobile top bar / any collapsed rail → icon-only mark. Never sacrifice
workspace to keep the wordmark. Asset handling in §8-Decision-4.

---

## 4. Exact files likely created or modified

### 4.1 Created — design tokens & primitives (`packages/ui/src/`)
- `styles/tokens-portal.css` — **NEW** BakerRang portal token layer (§2.2).
- `Button.tsx` — **REWORK** (variant/size props; not net-new but a significant change).
- `Textarea.tsx` — **NEW** (dedupe ~5 inline textareas).
- `Select.tsx` — **NEW** styled native-`<select>` wrapper (Contact action type, Leads status). Native
  is kept for accessibility; portal is light-only so the main app's dark-select problem doesn't apply.
- `Field.tsx` — **NEW** label + help + error wrapper (wires `htmlFor`, `aria-describedby`, `aria-invalid`).
- `Card.tsx` — **NEW** panel primitive (optional header/footer) replacing the repeated card class.
- `Badge.tsx` — **NEW** status pill with `tone` (neutral/success/warning/danger/info); always includes
  its text label (never color-alone).
- `Dialog.tsx` + `ConfirmDialog.tsx` — **NEW** accessible modal (focus trap, Esc, `role=dialog`,
  `aria-modal`, backdrop); replaces `window.confirm`.
- `Spinner.tsx` + `StatusMessage.tsx` (or `LoadingState`/`ErrorText`) — **NEW** standardized
  `role=status`/`role=alert` presentation.
- `EmptyState.tsx` — **NEW** (icon + title + hint + optional action).
- `PageHeader.tsx` — **NEW** (may live in ui or portal; recommend ui for reuse).
- `index.ts` — **MODIFIED** to export the above.
- `package.json` — **MODIFIED** `exports` to add `./tokens-portal.css`.
- `styles/tokens.css` — **UNCHANGED values** (comment only, marking it renderer-neutral base).

### 4.2 Created — portal shell (`apps/portal/app/`)
- `(portal)/layout.tsx`, `(portal)/page.tsx`, `(portal)/businesses/[tenantId]/…` (if Decision-2 =
  routed) — **NEW** route group + layouts.
- Shell components: `_shell/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `MobileDrawer.tsx`,
  `NavItem.tsx`, `Brand.tsx`, `AccountMenu.tsx` — **NEW**.
- `public/bakerrang-logo.svg|png` + `public/bakerrang-icon.svg|png` — **NEW** assets (Decision-4).

### 4.3 Modified — existing portal files (styling / re-hosting only, no logic/API change)
- `app/globals.css` — add `@import "@bakerrang/ui/tokens-portal.css"`; set body font per Decision-6.
- `app/layout.tsx` — metadata/title ("BakerRang"), font wiring; keep providers.
- `app/page.tsx` — becomes login card (shell-less) + delegates authed view to the route group / shell.
- `businesses/BusinessManager.tsx`, `BusinessList.tsx`, `CreateBusinessForm.tsx` — restyle via new
  primitives; BusinessList row loses the crammed inline functionality (moves to workspace).
- `businesses/BusinessWebsite.tsx` — restructure the 11-button hub into a sectioned Website area +
  sticky action bar; **same operations** (Manage/Initialize/Publish/Unpublish), reuse editors.
- `businesses/{Hero,Services,Contact,Gallery,Testimonials,SectionComposition,Branding,BusinessProfile}Editor.tsx`
  — swap inline textarea/select/card/button classes for primitives; logic untouched.
- `businesses/CustomDomainEditor.tsx` — swap `window.confirm` for `ConfirmDialog`; make DNS record
  block responsive (stacked labels, `overflow-x-auto` for the mono token, add copy buttons).
- `businesses/BusinessLeads.tsx`, `LeadNotes.tsx` — restyle inbox/detail as cards; status `<select>`
  → `Select`; full-width single-column detail on mobile; reuse concurrency logic.
- `lib/*` — **UNCHANGED**.

### 4.4 Modified — config
- `apps/portal/next.config.ts` — unchanged transpile list already includes `@bakerrang/ui`.
- Root `package.json`/workspace — add a `test` script only if Decision-3 adds Vitest.

**No changes** to `apps/site-renderer/*`, `packages/site-components/*`, `packages/site-schema/*`, or
any `server/` code.

---

## 5. Staged implementation sequence

Each stage is independently buildable and leaves the app working; typecheck+lint+build+manual after each.

- **Stage A — Token foundation (1.24.1).** Split tokens; add `tokens-portal.css`; wire portal
  `globals.css`; confirm **renderer build + visuals unchanged**. No visible portal change yet beyond
  colors resolving to the new palette. *Gate: renderer diff = none.*
- **Stage B — Core primitives (1.24.2).** Build Button(variants)/Textarea/Select/Field/Card/Badge/
  Dialog/Spinner/StatusMessage/EmptyState/PageHeader in `packages/ui`; export. (Optional Vitest unit
  tests here — Decision-3.) No app wiring yet.
- **Stage C — Application shell (1.24.3).** AppShell + Sidebar/TopBar/MobileDrawer/Brand/AccountMenu;
  add the route group/auth-gate (or shell-wrap the single page if Decision-2 = shell-only); move
  account/sign-out into the shell. Login screen restyled.
- **Stage D — Screen migration (1.24.4), in this order:**
  1. Businesses list + Create (proves the primitives end-to-end).
  2. Business workspace container + Website hub (section list + sticky actions; publish/unpublish).
  3. Section editors (Hero → Services → Contact → Gallery → Testimonials → Composition → Branding →
     Profile) — mechanical primitive swaps.
  4. Custom Domain (Dialog + responsive DNS block).
  5. Leads inbox → detail → status → notes.
- **Stage E — Responsive/mobile pass (1.24.5).** Sweep at 375px: drawer nav, single-column forms,
  card-list leads/domain, touch targets, no horizontal overflow. Fix the specific spots in §5-table below.
- **Stage F — A11y & interaction baseline (1.24.6).** Focus-ring consistency (light + dark sidebar),
  dialog/drawer focus management, contrast audit (yellow rule), touch sizing, aria-current nav.
- **Stage G — Verification (1.24.7).** Full matrix in §7.

**Responsive fixes matrix (Stage E):**
| Spot | Problem today | Pattern |
|---|---|---|
| Business functionality in list-row column | full editor/inbox inside a `max-w-xl` right-aligned cell → overflow | move to full-width workspace (routed) |
| Website 11-button cluster | ragged `flex-wrap` pile on mobile | grouped section list + sticky primary action bar |
| Leads detail `<dl>` + inline select/Save | select+button `ml-2` overflow narrow | single column, full-width `Select`, button below |
| Leads inbox | constrained to `max-w-xl` | full workspace width; keep card rows (not a table) |
| Domain DNS TXT record | long mono token, cramped, `window.confirm` | stacked labels, `overflow-x-auto` token + copy button, `ConfirmDialog` |
| Media grids (Gallery/Branding/Profile) | ok but small tap targets | ≥44px buttons, keep responsive grid, stacked selected-row |
| Dense action buttons `min-h-9` (36px) | under touch target | Button `sm` ≥40–44px on touch; keep desktop density |
| Native `<select>` | unstyled, small | `Select` primitive, ≥44px on touch |
| Navigation | none | sidebar (≥lg) + drawer (<lg) |

---

## 6. Risks / regressions to watch

1. **Shared-token bleed into the renderer (highest).** Any portal identity landing in the base
   `tokens.css` changes the renderer body/chrome. *Mitigation:* base/portal split; renderer imports
   only base; Stage-A gate is "renderer build + visual unchanged." Add a screenshot/manual check of the
   renderer's `/`, a rendered site, and its 404.
2. **Scope creep into a rewrite.** The routing spine must stay a *re-hosting* of existing editors.
   *Mitigation:* reuse editor components verbatim; no changes to `lib/*` or state logic; diff-review
   that editors are moved, not rewritten.
3. **Button variant refactor is broad (~40 call sites).** *Mitigation:* land the package change first,
   then sweep call sites; typecheck/lint catch stragglers; the old override className still works during
   transition (additive).
4. **`window.confirm` → Dialog** changes async timing of the domain remove flow. *Mitigation:* keep the
   same "confirm → run remove" sequence; manual-test remove + cancel.
5. **Brand asset availability** blocks the shell's finished look. *Mitigation:* Decision-4; can proceed
   with the reused `client` asset as a placeholder if the final logo is pending.
6. **Yellow contrast.** Yellow as text/small UI on light fails WCAG. *Mitigation:* no yellow-text
   utility; yellow only as fills (with ink text) and as sidebar/active accents; audit in Stage F.
7. **Native `<select>` theming** limits; acceptable for light-only portal — do not port the main app's
   custom FolderSelect (unneeded complexity here).
8. **Tailwind v4 `@theme` override ordering** — portal token import must come *after* the base; verify
   utilities for new tokens generate (the portal `globals.css` already `@source`s `packages/ui/src`).
9. **Auto-regenerated `AGENTS.md`/`CLAUDE.md`** in the portal are written by `next dev`; don't fight
   them, commit alongside.

---

## 7. Testing & verification plan

### 7.1 Deterministic tests (see §8-Decision-3)
- **Recommended minimal option:** add **Vitest + React Testing Library + jsdom** scoped to
  `packages/ui` primitives only (no network, deterministic): Button variant→class/`aria`
  mapping; Badge tone→token mapping; Field wires `aria-describedby`/`aria-invalid`/`htmlFor`;
  Dialog/Drawer open/close, Esc, focus-trap + focus-restore; Select label association. This is the
  only place the spec's "deterministic tests" ask can be honored without a large framework, and it
  guards the reusable core.
- **If declined:** rely on `typecheck` + `lint` + `build` + manual (documented below). No test debt is
  hidden — the primitives are simple enough that type + lint + manual cover them, at the cost of no
  regression net.

### 7.2 Static / build (must pass, run at `platform/`)
- `npm run typecheck`, `npm run lint`, `npm run build` (workspaces). **Renderer build must stay green**
  and produce unchanged output (token-isolation proof).

### 7.3 Manual — desktop
Login → businesses list → create business → open business → Website hub → each section editor save
(Hero/Services/Contact/Gallery/Testimonials/Composition/Branding/Profile) → Publish → Republish →
Unpublish → Custom Domain add/verify/activate/disable/remove (Dialog) → Leads inbox → detail → change
status (incl. 409 refresh path) → add note. Confirm every existing behavior intact.

### 7.4 Manual — mobile width (≤375px and 768px)
Drawer opens/closes with focus management; no horizontal page overflow anywhere; forms single-column;
leads + domain readable as cards; touch targets ≥44px; sticky primary actions reachable; no
hover-only affordance.

### 7.5 Regression checklist
No API/URL/method changes (grep `lib/*` unchanged); CSRF/auth flow unchanged; renderer visuals
unchanged (spot-check `/`, a live site, 404); all section editors round-trip identical payloads.

---

## 8. Decisions that require human input

1. **Design-system home.** (a) *Recommended:* extend `packages/ui` with a base/portal token split +
   portal primitives; (b) new `@bakerrang/portal-ui` package for a harder wall. Trade-off: churn vs.
   isolation. Recommendation: (a).
2. **Routing depth (shapes the whole plan).** (a) *Recommended:* introduce a minimal routed
   per-business workspace (Businesses → business → Website/Leads/Domain), reusing editors; (b)
   shell-only over the current single page, deferring IA to roadmap 1.29. The mobile mandate ("not a
   desktop shell with pieces hidden at breakpoints") argues strongly for (a).
3. **Frontend test runner.** Add a minimal Vitest+RTL setup for `packages/ui` primitives (adds
   devDeps), or keep verification to typecheck/lint/build + manual? Recommendation: minimal Vitest for
   primitives only.
4. **Logo assets.** Will you provide final portal logo files (full lockup + icon-only), or should we
   reuse `client/src/assets/bakerrang-logo.png` and derive an icon-only mark as a placeholder? Where do
   they live — `apps/portal/public/` or the ui package?
5. **Focus-ring color.** Brand yellow ring (on-brand, but lower contrast on white) vs. a dedicated
   high-contrast focus color. Recommendation: dedicated accessible ring; reserve yellow for fills/active.
6. **Font.** Adopt **Inter** (self-hosted via `next/font`, matches the renderer's stack) or keep a
   system sans stack? The portal body is currently `Arial`. Recommendation: Inter via `next/font`.
7. **Exact palette values / no full dark mode.** Confirm the working hex set (`#FEC51C`, `#292B2F`,
   `#1C1F29` as starting points) and confirm the portal is **light workspace + dark sidebar only** (no
   full portal dark theme in this step).
8. **Tablet behavior.** Include an icon-only collapsed sidebar *rail* between `md` and `lg` now, or
   keep it binary (sidebar ≥lg / drawer <lg) and defer the rail? Recommendation: binary now; rail later.

---

### Verdict
**READY FOR IMPLEMENTATION** once §8 Decisions 1–2 (and ideally 3–6) are settled. The plan is
incremental (token split → primitives → shell → screen-by-screen migration), preserves all existing
functionality and APIs, and is architected so the public site renderer is provably untouched.
