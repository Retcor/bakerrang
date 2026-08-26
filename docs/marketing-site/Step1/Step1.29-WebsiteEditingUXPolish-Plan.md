# Step 1.29 — Website Editing UX Polish — Implementation Plan

**Status:** PLAN (no code changes). Portal-focused UX / information-architecture / consistency step.
**Precedes:** Step 1.30 — DEV Product Readiness.
**Scope discipline:** No new CMS capabilities, no new section types, no page builder, no inline
public-site editing, no drag/drop, no autosave, no revision history, no analytics, no favicon, no
Theme V2, no Custom CSS expansion. See §25 for the full deferral list.

All findings below were read from the actual code after Steps 1.24–1.28, not inferred from roadmap
text. File references are clickable.

---

## 1. Current Website UX findings (actual interaction model)

### Portal shell (Step 1.24) — keep as-is
- [`AppShell.tsx`](../../platform/apps/portal/app/_shell/AppShell.tsx) is the global chrome: a fixed
  dark charcoal left sidebar on `lg+` (`w-68`, `bg-sidebar`), a top bar + hamburger **drawer** below
  `lg` (focus-trapped, `Esc`/tab-cycling, body-scroll lock), auth gating, `Brand`, and an account
  footer with Sign out. It renders a **"Businesses"** top link plus, when `contextNav` is supplied, a
  **"Business workspace"** group.
- [`BusinessWorkspace.tsx`](../../platform/apps/portal/app/businesses/BusinessWorkspace.tsx) wraps every
  business page. It fetches the business (name + status badge), supplies `contextNav` =
  `Overview / Website / Leads / Domain`, renders a "← All businesses" link and a
  [`PageHeader`](../../platform/apps/portal/app/_shell/PageHeader.tsx) (eyebrow = business name, title,
  description, actions = status `Badge`), then `children`.
- The **Website page** is thin:
  [`[tenantId]/website/page.tsx`](../../platform/apps/portal/app/businesses/[tenantId]/website/page.tsx)
  → `BusinessWorkspace title="Website"` wrapping `<BusinessWebsite autoLoad />`.

### The Website editing workspace — `BusinessWebsite.tsx`
[`BusinessWebsite.tsx`](../../platform/apps/portal/app/businesses/BusinessWebsite.tsx) owns all state:
`view ('initial'|'missing'|'site')`, `site: SiteDefinition|null`, `pending: Operation|null`,
`error`, `editor: EditorMode|null`, `feedback`, `previewFallback`. `autoLoad` triggers `getSite` on
mount.

- **Landing (editor === null):** a `Badge` ("Website: {status}") then three sections of buttons:
  - **Site foundation** grid: Branding, Theme, Business Profile, Business Hours, Social Profiles,
    Manage Sections.
  - **Advanced**: a single dashed `Card` with an "Edit Custom CSS" button.
  - **Homepage content** grid: Hero, About, Services, Gallery, Testimonials, FAQ, Contact.
  - A **sticky-bottom "Publishing" `Card`**: `Preview changes`, `Publish`/`Republish`, and (when
    published) `Unpublish`.
- **Editing (editor !== null):** a long conditional chain (lines ~187–244) **replaces the entire
  landing UI** with the single selected editor. There is **no persistent navigation** while editing;
  the editor takes over the pane. Each editor has its own `Cancel` (→ `setEditor(null)`, back to the
  grid) and its own `Save`.
- **On save:** `handleEditorSaved(definition)` does `setSite`, `setEditor(null)` (returns to grid),
  and sets a centralized `feedback`: published → *"Saved to the working site. Republish to change the
  public site."*; else *"Changes saved."*
- **Preview** is well-built and must be reused verbatim: `window.open('about:blank','_blank')`
  first (popup-safe), null the opener, mint a token via `createSitePreviewToken`, set
  `location.href` to [`sitePreviewUrl`](../../platform/apps/portal/lib/sitePreview.ts); on blocked
  popups it exposes a clickable fallback link; a fresh token is minted per click.

### The editors (13) — uniform contract, inconsistent chrome
All live in `app/businesses/*Editor.tsx` and share the prop shape
`{ tenantId, site, onCancel, onSaved }`. Each is a self-contained `<form>` with **local `useState`
seeded from `site`**, its own validation, its own error slot, its own Save/Cancel row.

Inconsistencies found:
- **Save labels differ:** `Save Changes` (Hero, Services, Gallery, Testimonials, Contact), `Save FAQ`,
  `Save About`, `Save Branding`, `Save Theme`, `Save Business Profile`, `Save Business Hours`,
  `Save Social Profiles`, `Save Layout`, `Save Custom CSS`.
- **Error styling differs:** most use `<StatusMessage tone="error">`; **Business Hours** and
  **Manage Sections** use a bare `<p className="… text-fg" role="alert">` — i.e. **not** the danger
  color, visually weaker than the others.
- **Editor titles are inconsistent:** Theme, Business Hours, Manage Sections, and Custom CSS render an
  `<h2>` + description; **Hero, About, Services, Gallery, Testimonials, FAQ, Contact do NOT** — they
  jump straight to fields. Because the landing button previously supplied the context, several editors
  give **no on-screen indication of what you are editing** once they take over the pane.
- **Field markup differs:** the shared [`Field`](../../platform/packages/ui/src/Field.tsx) primitive
  (label + optional + help/error + aria wiring) exists but is used inconsistently; FAQ/Hours use raw
  `<label>` + `Input`.
- **No max width:** every editor form is `w-full …` inside the `max-w-7xl` main column, so forms
  **stretch to ~80rem on large monitors** (Custom CSS included).
- **Dirty tracking is absent except in Custom CSS** (which has a `dirty`/`clearedLocally` model).
  `Cancel`, switching editors, and Portal navigation all **discard unsaved edits silently**.

### Available UI primitives
[`@bakerrang/ui`](../../platform/packages/ui/src/index.ts) exports: `Button` (primary/secondary/
ghost/danger; sm/md/lg), `Badge`, `Card`, `ConfirmDialog`, `Container`, `Dialog` (focus-trapped
modal), `EmptyState`, `FileInput`, `Field`, `Input`, `Select`, `StatusMessage`, `Textarea`.
**There is no Tabs, Breadcrumb, or nav-rail primitive** — those would be portal-local.

### Publication-state signal — the key backend gap
`SiteDefinition` exposes **only** `status: 'DRAFT' | 'PUBLISHED'`
([site-schema index.ts:247](../../platform/packages/site-schema/src/index.ts)). It does **not** expose
any timestamp or working-vs-published delta. Server-side the authoritative data **exists**:
[`siteService.js`](../../platform/../server/services/siteService.js) stores `config.updatedAt` and
`home.updatedAt` on every working edit, and `publishSite` writes `config.lastPublishedAt`
(and the snapshot's `publishedAt`). But `toSiteDefinition`/`finalizeSiteDefinitionRead` **surface none
of it**. So today the Portal literally cannot tell "working differs from published." (See §9/§13.)

### Custom domain
[`CustomDomainEditor`](../../platform/apps/portal/app/businesses/CustomDomainEditor.tsx) lives on its
own `Domain` page; the Website workspace never shows the live public URL.

---

## 2. Biggest usability problems, ranked

1. **No "where am I."** Selecting an editor swaps the whole workspace; several editors have no title,
   so the operator loses context and there is no active-state navigation to move between editors.
2. **No published-vs-working truth.** The status Badge only says DRAFT/PUBLISHED; an operator with a
   published site cannot tell that saved working edits are not yet live. (Backend gap — §13.)
3. **Silent loss of unsaved edits** on Cancel / editor-switch / Portal navigation / refresh.
4. **Preview & Publish are unreachable while editing.** They live only on the landing card, so to
   publish after editing you must Cancel out first.
5. **Inconsistent editor chrome** (save labels, error color, titles, widths) — reads as a bag of
   separate forms, not one product.
6. **The landing is a wall of buttons** with no status/summary/overview.
7. **Long editors** (FAQ, Services, Gallery, Testimonials, Business Hours, Custom CSS) force scrolling
   to reach Save; no persistent save affordance.
8. **Editor selection is pure local state** → refresh/back loses your place; nothing is bookmarkable.

---

## 3. Recommended Website information architecture

Keep the **Portal shell contextNav unchanged** (`Overview / Website / Leads / Domain`). Inside the
**Website page**, organize the capabilities as a persistent, visually-subordinate editor menu +
active pane + overview:

```
Website  ── workspace header: [status pill]  [Preview]  [Publish/Republish]  (sticky)
│
├─ Overview            (default when no editor selected)
│
├─ Site setup
│   Branding
│   Theme
│   Business Profile
│   Business Hours
│   Social Profiles
│
├─ Homepage
│   Hero
│   About
│   Services
│   Gallery
│   Testimonials
│   FAQ
│   Contact
│   Manage Sections     (order + homepage presence)
│
└─ Advanced
    Custom CSS
```

Rationale grounded in the code: Business Hours, Social Profiles, Branding, Theme, Business Profile all
write to `config`/`businessProfile` (identity/setup), while Hero/About/Services/Gallery/Testimonials/
FAQ/Contact write to `home.sections` (composition). **Social Profiles must stay in "Site setup," never
as a Homepage/Manage-Sections entry** (it is Footer/identity, not in `home.sections`). Manage Sections
belongs under Homepage because it governs `home.sections` order + presence.

---

## 4. Desktop workspace design (`≥ lg`)

Introduce a two-column workspace **inside the Website page content** (this is a child of the Portal
shell, deliberately lighter than the dark global sidebar — a light `Card`/panel, not a second rail):

```
┌───────────────────────────────────────────────────────────────────────┐
│  Website                       ● Changes not published   [Preview] [Republish]  │  ← sticky header
├──────────────────┬────────────────────────────────────────────────────┤
│  Site setup      │  Website › Homepage › FAQ                           │  ← breadcrumb in pane
│   Branding       │  FAQ                                                 │
│   Theme          │  Answer common questions on the homepage.           │
│   …              │                                                     │
│  Homepage        │  [ editor fields … ]                                │
│   Hero ●active   │                                                     │
│   …              │  ─────────────────────────────────────────────     │
│  Advanced        │  [Cancel]                                [Save]     │  ← sticky within pane
│   Custom CSS     │                                                     │
└──────────────────┴────────────────────────────────────────────────────┘
```

- Grid: `lg:grid-cols-[16rem_minmax(0,1fr)]` **within** the existing `max-w-7xl` main column.
- Left menu: grouped list, `aria-current="page"`/active styling reusing the shell's active token
  (`bg-brand text-brand-ink` vs `hover:bg-surface-muted`), `min-h-11` targets.
- Right pane: the active editor wrapped by a shared `WebsiteEditorShell` (§11) that supplies the
  breadcrumb, title, description, unified error slot, and the sticky action row; **or** the Overview
  when nothing is selected.
- Workspace header is sticky (`top-0`/near the shell header), always exposing status + Preview +
  Publish (§8, §16).

**This is a material improvement over the current card grid** because it keeps navigation, context,
and the publish workflow visible while editing — the current model hides all three the moment you open
an editor. Avoid extra nested chrome: one menu panel, one pane, one header — no cards-inside-cards.

---

## 5. Tablet / mobile workspace design

**Do not shrink the desktop rail.** Use an explicit responsive pattern.

- **Tablet (~768px):** single column. The editor menu collapses into a **"Currently editing: [X ▾]"**
  control at the top of the pane (a labelled disclosure/menu button). The workspace header actions
  (Preview / Publish) wrap under the status pill. Editor content is single-column.
- **Mobile (375px):** the same "Currently editing: [X ▾]" button opens a **drawer/menu** listing the
  grouped editors — reuse the `Dialog` focus-trap pattern already proven in `AppShell`'s drawer (do
  not build a new modal engine). Preview/Publish live in a compact header row (icon+label, `min-h-11`),
  not a giant sticky footer. No permanent second sidebar.

Requirements satisfied: easy switching, current editor obvious, Preview/Publish reachable, no
horizontal scroll, no tiny targets, no screen-eating second sidebar.

---

## 6. Editor navigation recommendation

Adopt a **persistent grouped editor menu subordinate to the Portal shell** (desktop rail column;
tablet/mobile "Currently editing ▾" + drawer). Replace the current landing **card grid** with this
menu + an Overview default (see §7, §10). Do **not** add a second dark Portal-level sidebar; the
website menu is a light in-page surface. The global shell's `Overview/Website/Leads/Domain` contextNav
stays the primary navigation; the website menu is clearly one level deeper.

---

## 7. Overview / landing-state recommendation

When the Website opens with no editor selected, show a small **Overview** built **only from data the
Portal already has** (plus one cheap existing fetch):

- **Status**: Draft / Published / **Changes not published** (the last requires the §13 signal).
- **Public URL / primary domain**: from `getSiteDomain` (an existing endpoint,
  [`lib/site.ts`](../../platform/apps/portal/lib/site.ts)) — show the ACTIVE hostname + link to the
  Domain page (read-only context, no domain redesign — §39). One small fetch, not per-editor.
- **Homepage summary**: which sections are present + count, derived trivially from `home.sections`.
- **Last published**: `lastPublishedAt` if the §13 addition is adopted (else omit).
- **Actions**: Preview, Publish/Republish, and "jump to editor" links.

No analytics, no traffic, no lead stats, no fabricated data. If the §13 backend signal is declined,
the Overview simply shows Draft/Published without the "changes not published" line.

---

## 8. Editing / Preview / Publish workflow recommendation

- Move **Preview** and **Publish/Republish** into the **persistent workspace header**, reachable from
  any editor and from the Overview. **Reuse the exact existing preview flow** (open-blank → mint →
  set location → fallback link); do not create a second preview implementation (§38, §43).
- Keep the **plain-language lifecycle** consistent everywhere: *Edit → Save → working updated →
  Preview → Republish → public updated.* The existing post-save copy ("Saved to the working site.
  Republish to change the public site.") is good; make it the single canonical phrasing.
- **Unpublish** stays available on the Overview/header when published; it is non-destructive to content
  (keeps the snapshot) and can remain a simple action, but its copy should clarify it only hides the
  public site.

---

## 9. Saved vs published status recommendation

Adopt a single, consistent status vocabulary (avoid "WORKING/PUBLISHED snapshot" in normal UI):

| State | Meaning | Shown as |
|---|---|---|
| **Draft** | Never published | neutral/warning pill |
| **Published** | Live and up to date | success pill |
| **Changes not published** | Published, but working edits are newer | attention pill |
| **Saving… / Publishing…** | in-flight | button loading state |
| **Saved / Published successfully** | transient confirmation | `StatusMessage` (auto/inline) |

"Changes not published" depends on the §13 signal. Without it, collapse to Draft/Published only (do
**not** fake it with unreliable client comparisons).

---

## 10. Editor entry cards vs navigation

Replace the landing card grid with the **persistent menu + Overview**. Do not keep both a full card
grid **and** a menu showing the same choices. The Overview may show a *few* high-value shortcuts
(Preview, Publish, "edit Hero", domain) — not a duplicate of the full menu.

---

## 11. Editor shell / form consistency recommendation

Introduce **one** portal-local primitive, `WebsiteEditorShell` (in `app/businesses/`), that every
editor's form body plugs into. This is the lever that fixes §14, §15, §23, §24, §25, §29 together —
recommended precisely because it *materially* removes duplication, not for DRY ceremony.

Proposed contract:

```tsx
<WebsiteEditorShell
  breadcrumb={['Website', 'Homepage', 'FAQ']}   // or ['Website','Site setup','Theme']
  title="FAQ"
  description="Answer common questions on the homepage."
  error={error}                 // rendered once, always <StatusMessage tone="error">
  dirty={dirty}                 // drives the unsaved-change guard (§15)
  saving={saving}
  canSave={valid}
  onCancel={onCancel}           // shell intercepts with a discard-confirm when dirty
  onSubmit={handleSubmit}
  secondaryActions={…}          // e.g. Business Hours "Remove business hours"
  maxWidth="form" | "wide"      // form editors ~44rem; Custom CSS/Manage Sections wider
>
  {/* fields only */}
</WebsiteEditorShell>
```

- **Unified Save label**: standardize to **"Save"** (with "Saving…") — context is the title/breadcrumb.
  (Human decision §24; alternative = keep contextual labels but make them consistent.)
- **Single error slot**, always danger-toned — fixes the Business Hours / Manage Sections weak-error
  inconsistency.
- **Standard action row**, sticky at the bottom of long panes (§25); one Save location, no top+bottom
  duplication.
- **Standard widths** via `maxWidth`.
- **Dirty guard** centralized here (§15) — one implementation, not thirteen.

Adopt `Field` for labels/help/errors where editors currently hand-roll them, for consistent spacing,
required/optional indicators, and aria wiring (§24). Keep using existing `@bakerrang/ui`; do not build
a new form system.

---

## 12. Unsaved-change strategy (§15)

Currently editors can lose edits on Cancel/switch/nav with no warning. Recommended, minimal, reusable:

- Each editor computes a cheap **`dirty`** boolean (serialize current input vs the initial seed and
  compare; Custom CSS already does this). It passes `dirty` to `WebsiteEditorShell`.
- The **workspace** (or shell) intercepts editor switching and Cancel: if `dirty`, show a
  `ConfirmDialog` — *"Discard unsaved changes?"* — before leaving. One dialog, driven by the shared
  `dirty` value; no bespoke per-editor guards.
- **In-app Portal navigation** (clicking Website→Leads while dirty): guard via the workspace when the
  active editor is dirty (intercept the nav intent). This is the higher-value guard.
- **`beforeunload`** (refresh/close tab): a single `window.beforeunload` listener registered only while
  an editor is dirty — cheap and standard. Low priority; acceptable to defer to 1.30 if it complicates
  the slice.

---

## 13. Global saved-vs-published state — the one backend decision (§13, §44)

**What the Portal can know today:** only `status` (DRAFT/PUBLISHED). It **cannot** reliably compute
"changes not published" — the necessary timestamps are not returned.

**What the server already stores** (authoritative, no new architecture):
`config.updatedAt`, `home.updatedAt` (bumped on every working edit), and `config.lastPublishedAt`
(set by `publishSite`). See [`siteService.js` publishSite](../../platform/../server/services/siteService.js).

**Recommendation (the single justified backend touch under §44):** expose the already-authoritative
signal on the site read. Two shapes — pick one in §24 decisions:
- **(B1) Timestamps:** add `lastPublishedAt?: number` and `updatedAt?: number` to the read response
  and `SiteDefinition`; Portal derives "changes not published" = `status==='PUBLISHED' &&
  max(updatedAt, home.updatedAt) > (lastPublishedAt ?? 0)`.
- **(B2) Boolean (recommended):** compute `hasUnpublishedChanges: boolean` (and keep `lastPublishedAt`
  for display) server-side in `toSiteDefinition`/`finalizeSiteDefinitionRead`, so the Portal renders it
  directly with no client math.

Either is small (one derived field, no migration, no new collection). **If declined**, keep
Draft/Published only and drop the "Changes not published" pill — do **not** invent client-side diffing.
This is explicitly the kind of "expose already-existing authoritative state for UX" that §44 permits.

---

## 14. Local unsaved state consistency (§14)

Editors already seed local state from `site` — keep that. Standardize via `WebsiteEditorShell`:
uniform Save label, uniform error slot, uniform `dirty` computation. Do **not** refactor field logic
where differences are justified (e.g. Business Hours' per-day model, Gallery's upload flow); only the
**chrome** is unified.

---

## 15. Manage Sections UX recommendation (§18, §19)

- Keep **Move Up / Move Down** (no drag/drop — §27). Standardize the control styling to the
  `SectionCompositionEditor` pattern (icon-only `w-11` on mobile, icon+label on desktop, correct
  disabled states) and reuse it in the item editors' reorder controls.
- Clarify copy: sections listed here are **shown on the homepage**; **order controls both homepage and
  navigation order**; **removing a section removes its homepage content from the working site but does
  not delete canonical business data** (Business Hours schedule, Social Profiles, Business Profile).
- In the **individual homepage editors**, add a light one-line indicator — *"Shown on the homepage"* —
  since saving an editor already upserts the section into `home.sections`. Do **not** embed full Manage
  Sections controls in every editor; `home.sections` stays the single authority (§19, §45).

---

## 16. Business Hours / Social / Custom CSS positioning (§20–§22)

- **Business Hours** (Site setup): the editor already separates the **canonical weekly schedule** from
  the **optional homepage Hours section** (a "Show on homepage" toggle) and confirms removal with a
  `ConfirmDialog` whose copy already states it removes the canonical schedule + homepage section. Keep
  the architecture; refine copy so the two concepts read clearly without explaining internals.
- **Social Profiles** (Site setup): identity/Footer, **never** a Homepage/Manage-Sections entry. Keep
  it out of `home.sections`.
- **Custom CSS** (Advanced): keep the advanced framing; keep the stable-selector reference and
  resource-policy warning **collapsible** (`<details>`, already implemented) so the default view stays
  clean. Do not change the security model; no syntax-highlighting dependency (§22, §47).

---

## 17. Long-editor & save-action strategy (§25, §26)

- **One Save location**, in the shell's action row, **sticky at the bottom of the pane** for long
  editors (FAQ, Services, Gallery, Testimonials, Business Hours, Custom CSS). No top+bottom duplication.
- Reduce vertical whitespace and nested padding in repeating item rows (tighten the `fieldset … p-4`
  blocks); give each item a clear compact header (e.g. "Question 3 / Service 2").
- **Optional** (defer if it grows the slice): collapsible item rows for very long lists. Do **not**
  turn this into inline visual editing.

---

## 18. URL / deep-linking recommendation (§36, §37)

Editor selection is currently pure component state, so refresh/back lose your place and nothing is
bookmarkable. **Recommend** backing selection with a query param, e.g.
`/businesses/:id/website?editor=faq`, via Next `useSearchParams` + `router` (client). Benefits:
refresh keeps the pane, Back returns to the previous editor/Overview naturally (use `push` for
switches), and operators can share internal links. Cost is modest and it removes the "Back is
surprising" problem (§37). It interacts with the unsaved-guard (intercept the param change when dirty).
**Decision in §24** — acceptable to ship in 1.29a; if the human prefers minimal, keep local state and
accept non-bookmarkable selection.

---

## 19. Exact files likely modified / created

**Created (portal):**
- `app/businesses/WebsiteWorkspace.tsx` (or refactor within `BusinessWebsite.tsx`) — two-column
  layout, sticky workspace header (status + Preview + Publish), editor menu, Overview host, URL-param
  selection, unsaved-change guard.
- `app/businesses/WebsiteEditorMenu.tsx` — grouped desktop rail + tablet/mobile "Currently editing ▾"
  + drawer (reusing the `Dialog`/drawer pattern).
- `app/businesses/WebsiteOverview.tsx` — status, public URL, section summary, actions.
- `app/businesses/WebsiteEditorShell.tsx` — shared editor chrome (breadcrumb/title/description/error/
  action row/width/dirty-guard hook).
- Possibly `lib/useUnsavedGuard.ts` (small hook) and `lib/websiteEditors.ts` (menu group config +
  labels/breadcrumbs, one source of truth).
- Test files under `app/businesses/test/` (see §21).

**Modified (portal):**
- [`BusinessWebsite.tsx`](../../platform/apps/portal/app/businesses/BusinessWebsite.tsx) — becomes the
  workspace host (or is superseded by `WebsiteWorkspace.tsx`); landing card grid removed.
- All 13 editors (`Branding/Theme/BusinessProfile/BusinessHours/SocialProfiles/CustomCss/Hero/About/
  Services/Gallery/Testimonials/Faq/Contact` + `SectionCompositionEditor`) — wrap body in
  `WebsiteEditorShell`, unify Save label + error slot, compute `dirty`, adopt `Field` where hand-rolled.
- [`SectionCompositionEditor.tsx`](../../platform/apps/portal/app/businesses/SectionCompositionEditor.tsx)
  — copy clarifications (§15); fix weak-error styling.
- [`lib/site.ts`](../../platform/apps/portal/lib/site.ts) — add the publication-status field(s) to the
  `SiteDefinition` consumption if §13 adopted; possibly an Overview domain fetch helper (already exists:
  `getSiteDomain`).
- Existing tests referencing the landing grid (`BusinessWebsitePreview.test.tsx`,
  `BusinessPolish.test.tsx`) — updated to the new structure.

**Modified (shared packages) — only if §13 adopted:**
- [`site-schema/src/index.ts`](../../platform/packages/site-schema/src/index.ts) — add
  `hasUnpublishedChanges?: boolean` and/or `lastPublishedAt?: number` to `SiteDefinition`.

**Modified (server) — only if §13 adopted:**
- `server/services/siteService.js` — surface the derived flag/timestamps in `toSiteDefinition` /
  `finalizeSiteDefinitionRead` (no new route needed; rides the existing `GET /tenants/:id/site`).
- `server/test/siteService.test.js` / `tenantRoutes.test.js` — cover the new field.

---

## 20. Backend / renderer changes, if any and why

- **Renderer:** **none.** This is Portal-only; no public-site component changes, no preview overlay,
  no embedded editor (§43).
- **Backend:** **none unless §13 is adopted.** The only candidate is surfacing the already-stored
  publication freshness (`hasUnpublishedChanges` / `lastPublishedAt`) on the existing site read — a
  single derived field, no new endpoint, collection, or migration. Everything else (state,
  navigation, guards, layout) is client-side using the already-loaded `SiteDefinition`. No new backend
  state is introduced for frontend navigation (§35, §44).

---

## 21. Testing plan (deterministic component tests; no screenshots — matches repo convention)

Portal (`vitest` + Testing Library, mirroring
[`BusinessWebsitePreview.test.tsx`](../../platform/apps/portal/app/businesses/test/BusinessWebsitePreview.test.tsx)
which mocks `lib/site` and `AppShell`):
- **Workspace navigation:** menu lists all editors grouped; clicking an item opens the right editor;
  active item gets `aria-current="page"`.
- **Overview default:** opening Website with no `?editor` shows the Overview (status, public URL,
  section summary, Preview/Publish), not a card wall.
- **Editor switching** uses the already-loaded `site` (no extra `getSite` call).
- **Unsaved-change guard:** editing a field then switching/cancelling shows the discard confirm; confirm
  discards, dismiss stays.
- **Preview** action still opens-blank→mints→sets location, and the blocked-popup fallback link — reuse
  the existing assertions.
- **Publish/Republish** action label reflects status; loading + success states.
- **Status pill:** Draft / Published / (if §13) Changes not published from the definition field.
- **Saved-state propagation:** `onSaved` updates shared site + status + returns to pane/overview.
- **Manage Sections** entry present under Homepage; **Custom CSS** under Advanced.
- **Editor shell:** renders breadcrumb + title + single danger error slot + one Save button; sticky
  action row present.
- **Responsive/menu:** the "Currently editing ▾" control + drawer render below `lg` (jsdom class
  assertions in the existing style).
- **Accessibility semantics:** menu is a `nav` with `aria-current`; drawer is a focus-trapped
  `role="dialog"`; form controls have labels.

Server (only if §13 adopted): `node:test` + FakeDb — `hasUnpublishedChanges` is false right after
publish, true after a subsequent working edit, and irrelevant (or false) while DRAFT.

Do not add a new FE test framework or screenshot tests.

---

## 22. Manual DEV verification plan

Run at **desktop**, **768px**, **375px**:
1. Website entry shows the **Overview** (status, public URL if a domain is active, section summary).
2. Switch between several editors via the menu / "Currently editing ▾"; active item is obvious; URL
   updates if §18 adopted; refresh keeps the pane.
3. **Save** an editor → success feedback; returns to pane/overview; status pill updates.
4. **Failed Save** (e.g. invalid input / forced 400) → error retained, edits preserved.
5. **Preview** from inside an editor and from the Overview → opens the working site; blocked-popup
   fallback link works.
6. **Republish** → status becomes Published / "Changes not published" clears (if §13).
7. **Long editor** (FAQ/Services/Custom CSS): Save reachable via sticky action; no page-level
   horizontal scroll.
8. **Manage Sections**: reorder + remove; confirm copy makes clear canonical data isn't deleted.
9. **Custom CSS** sits under Advanced; reference/warning collapsible.
10. **Unsaved guard**: edit → attempt to switch editor / navigate away → discard confirm appears.
11. **Mobile editor navigation**: drawer/menu opens, is focus-trapped, closes on select; Preview/Publish
    reachable.
12. **No horizontal overflow** anywhere; **global Portal sidebar/drawer still works** and is clearly the
    parent of the website menu.

---

## 23. Recommended implementation slices

Three reviewable, independently live-testable slices (plus a tiny optional backend pre-step):

- **1.29a — Workspace shell & navigation.** Two-column desktop layout, sticky workspace header
  (status + Preview + Publish, reusing the existing preview/publish flows), grouped editor menu,
  Overview default, and URL-param selection (§18). Landing card grid removed. *(If §13 adopted, do the
  small backend/schema signal here so the status pill is real from the start.)*
- **1.29b — Editor shell & consistency.** `WebsiteEditorShell` + adopt across all 13 editors: unified
  Save label, single danger error slot, breadcrumb/title/description, standard widths, sticky save,
  `Field` adoption; unsaved-change guard; Manage Sections + Business Hours copy.
- **1.29c — Responsive, accessibility & long-editor polish.** Tablet/mobile "Currently editing ▾" +
  drawer, a11y pass (aria-current, focus, headings), long-editor spacing/sticky refinements, Overview
  domain context, final visual polish.

Slice only this far; do not fragment further.

---

## 24. Human decisions genuinely required

1. **Published-vs-working signal (§13).**
   - *Current:* only `status` is exposed; "changes not published" is not knowable.
   - *Options:* **(A)** status-only, no backend change; **(B1)** expose `updatedAt`+`lastPublishedAt`;
     **(B2, recommended)** expose a derived `hasUnpublishedChanges` boolean (+`lastPublishedAt`).
   - *Recommend:* **B2** — small, authoritative, no migration; unlocks the most valuable status clarity.
2. **Persistent editor subnav + Overview vs keep the card grid (§6, §10).**
   - *Current:* card grid that is fully replaced by the chosen editor.
   - *Options:* persistent menu + Overview (recommended); keep grid but add titles/context only.
   - *Recommend:* **persistent menu + Overview.**
3. **URL-backed editor selection vs local state (§18).**
   - *Current:* pure local state; refresh/back lose the pane; not bookmarkable.
   - *Options:* `?editor=` query param (recommended); keep local state.
   - *Recommend:* **query param.**
4. **Unsaved-change guard (§12, §15).**
   - *Current:* edits silently lost on Cancel/switch/nav.
   - *Options:* shell-centralized in-app guard (recommended, optionally + `beforeunload`); no guard.
   - *Recommend:* **shell-centralized guard**; `beforeunload` optional / deferrable.
5. **Save-button label (§11, §14).**
   - *Current:* 10 different labels.
   - *Options:* uniform **"Save"** (recommended); consistent-but-contextual labels.
   - *Recommend:* **uniform "Save."**

(These are the only product-level choices; everything else is implementation detail.)

---

## 25. Items explicitly deferred to Step 1.30 (DEV Product Readiness)

- **Favicon** (`/favicon.ico` → 404) — tenant-configurable published favicon stays deferred (§46, §47);
  if it belongs anywhere it is 1.30 product-readiness, not 1.29.
- Product-wide **missing/empty/error-state** sweep beyond the Website workspace.
- **Deployment / readiness checks**, operational configuration, environment validation.
- Final **cross-feature QA** across Leads / Domain / Auth alongside Website.
- Any deferred **small launch blockers** surfaced during 1.29 that are not editing-UX.
- Optional niceties if they threaten 1.29 slice size: `beforeunload` guard, collapsible long-list item
  editors.

---

### Architecture invariants preserved (§45)
`home.sections` remains the sole homepage composition/order/nav authority; `BusinessProfile` remains
canonical identity/Hours/Social; `Theme` is standard visual config; Custom CSS is the advanced escape
hatch; WORKING is editable, Preview renders WORKING, PUBLISHED is the public snapshot. This step adds
**no competing source of truth** — it only reorganizes navigation, standardizes chrome, and (optionally)
surfaces one already-authoritative status field.
