# Step 3.0 — Site Editor V2 / Section Architecture (Planning Spec)

**Status:** Planning / read-only audit complete. No code, Firestore, GCP, or Git changes were made.
**Baseline health (this branch):** server `node:test` **332/332 pass**; platform tests pass
(site-renderer 59, ui 9, portal suites green); `npm run typecheck` clean across all 5 workspaces.
**Verdict:** Step 3.0 is **READY TO IMPLEMENT** after the operator confirms four small decisions
(§Blockers). The architecture cleanly supports the full instance-based model.

This spec is the durable-architecture recommendation for Phase 3. It intentionally recommends a
**breaking change to the marketing-site section schema** (opaque section ids + explicit `hidden`),
which is acceptable now because all existing marketing-site sites are disposable test data.

---

## 1. Current Home editor architecture

**Entry point.** `platform/apps/portal/app/businesses/BusinessWebsite.tsx` is the whole website
editor. Route `app/businesses/[tenantId]/website/page.tsx` renders it with `autoLoad`. It:

- loads the working site once via `getSite` → `GET /tenants/:id/site` (`lib/site.ts`), holds it in
  a single `site: SiteDefinition` state object;
- renders a **left nav of editor panes** (`WebsiteEditorNavigation` + registry
  `websiteEditors.ts`) and one active pane in the main column (`ActiveWebsiteEditor` switch);
- panes are **one editor per section type** plus site-setup panes: `hero, about, services,
  gallery, testimonials, faq, contact` (Homepage group) + `branding, theme, businessProfile,
  businessHours, socialProfiles, customCss`, plus a **`sections` pane = "Manage Sections"**
  (`SectionCompositionEditor.tsx`) and an **Overview** default pane.

**How section editors are rendered.** Each editor (e.g. `HeroEditor.tsx`, `GalleryEditor.tsx`)
receives the full `site`, **finds its own section by type guard** (`home.sections.find(isHeroSection)`),
seeds local form state, and on save calls its `lib/site.ts` function (`updateHomeHero`,
`upsertHomeGallery`, …). The server returns the **entire updated `SiteDefinition`**; the parent
replaces `site` in state (`handleEditorSaved`). There is no partial refetch.

**How current order is represented.** Order = **array position in `home.sections[]`**. The only
order/removal UI is the `sections` pane: it lists rows from `findHomePage(site).sections`, offers
**Move Up / Move Down / Remove** (Hero is pinned "Fixed" and cannot move or be removed), and saves
the resulting id list via `composeHomeSections` → `PUT …/site/pages/home/composition`.

**Is every section always present? Optional sections?** No — sections are optional and created
on demand. Only **Hero** is guaranteed (seeded at `initializeSite`). Every other section is
**absent until its editor first saves** (the `upsertHome*` helpers insert on first write). So the
composition already varies per tenant. There is **no hide/show** — a section is either present or
absent, and removing it is the only way to hide it.

**How mutations are submitted.** Per-type REST calls (see §11). Each returns the full definition.

**How editor state refreshes.** Optimistically from each mutation's response; no polling, no
websocket. Switching panes preserves `site` in memory. A dirty-guard (`BusinessNavigationGuard` +
`beforeunload`) blocks pane switches with unsaved edits.

**How preview works.** `Preview changes` → `createSitePreviewToken` (`POST …/site/preview-token`)
→ opens the **site-renderer** `/preview/[tenantId]` route in a new tab. The renderer's preview
API path reads **working** state (`lib/api.ts` bearer-token preview fetch). Preview is a
fresh full-page render per click — no live iframe, no in-portal preview.

**Loading / error patterns.** `pending: Operation | null` gates buttons; `StatusMessage`
tones for error/feedback; editors surface 400 messages verbatim, mask 5xx.

**What prevents it from being a section manager today.** It is a **collection of independent
type-keyed forms**. The composition pane can only reorder/remove the eight fixed singletons; it
**cannot add, duplicate, or hide**, and it cannot express two sections of the same type because the
entire stack (schema, service, renderer) treats **section type as identity** (§3).

---

## 2. Current section schema (as actually implemented)

**Working storage (Firestore):**
- `tenants/{tenantId}/site/config` — doc: `{ status: 'DRAFT'|'PUBLISHED', branding, theme,
  businessProfile?, customCss?, createdAt, updatedAt, lastPublishedAt?, … }`
- `tenants/{tenantId}/site/pages/home` — doc: `{ id:'home', slug:'/', title:'Home',
  sections: SiteSection[], createdAt, updatedAt }`

**Published snapshot:**
- `tenants/{tenantId}/site/config/published/current` — doc:
  `{ siteDefinition: {…status:'PUBLISHED', sections verbatim…}, publishedAt, publishedByUserId }`

**Section object shape** (`platform/packages/site-schema/src/index.ts`):
```ts
type SiteSection = { id, type, content }   // NO hidden/visible field
```
Section discriminant is **`type`**. The eight real types:

`hero · about · services · gallery · testimonials · faq · businessHours · contact`

**IDs.** Every section carries an `id`, but **`id` is currently equal to `type`**. Worse, three
types hard-code the id **in the TypeScript type** itself: `AboutSection.id: 'about'`,
`FaqSection.id: 'faq'`, `BusinessHoursSection.id: 'businessHours'`. The others are typed `id: string`
but are always written as the type string by the service. Item-level ids inside content
(`ServiceItem.id`, `GalleryItem.id`, `TestimonialItem.id`, `FaqItem.id`) **are** real
server-generated `randomUUID`s — only the **section** id is type-derived.

**Ordering.** Array position in `home.sections`. Insertion order is **hard-coded by type**
(about after hero; services after about/hero; gallery/testimonials/faq before contact; businessHours
before contact; contact appended last).

**Visibility.** None. Present = shown, absent = gone.

**Uniqueness assumptions.** Exactly one instance per type, enforced in **four** places (§3).

**Renderer assumptions.** `SectionRenderer` dispatches on `type` (good, extensible switch) and
returns `null` for unknown types. `PublicHome` maps sections in array order and uses
`key={section.id}` and computes `hasContact` via `isContactSection`. Each **component hard-codes its
DOM anchor id** (`<SiteSection id="about">`), and nav anchors are `#${section.id}` — this only works
because `section.id === type === the hard-coded DOM id`.

**Editor assumptions.** Each editor finds its instance by **type guard**, not by id.

**Corruption handling.** `mapCanonicalSections` (read/validate) throws `500 'Home sections invalid'`
if any section is missing id/type, not in the canonical set, `id !== type`, or duplicated, or if hero
isn't present-and-first. Each `upsertHome*` re-scans for its type and throws 500 if it finds more
than one, or one whose id/type disagree ("reserved-identity corruption scan"). Item arrays get their
own stored-id corruption scans.

**Can it support `hero · services · gallery · gallery · contact`?** **No.** Two galleries are
structurally impossible: both would need `id: 'gallery'`, which every layer rejects
(`byId.has(section.id)` dedupe, the per-type >1 scans, and `key={section.id}` collisions).

---

## 3. Every type-as-identity assumption (classified)

`TYPE DISPATCH` (switch on `type` to pick a renderer/validator) is fine and stays.
`TYPE AS IDENTITY` (using the type string to *find/target/uniquely-key* a section) must go.

| # | Location | Pattern | Class | 3.0 action |
|---|---|---|---|---|
| 1 | `site-schema/index.ts` | `AboutSection.id:'about'`, `FaqSection.id:'faq'`, `BusinessHoursSection.id:'businessHours'` literal ids | identity | Change to `id: string` |
| 2 | `site-schema/index.ts` | `isHeroSection` … `isBusinessHoursSection` check `id==='x' && type==='x'` | identity (guards) | Re-base guards on `type` only |
| 3 | `siteService.js` | `CANONICAL_SECTION_IDS` (ids must be one of 8 strings) | identity | Replace with `SECTION_TYPES` set |
| 4 | `siteService.js` | `mapCanonicalSections` requires `id===type` + uniqueness by id | identity | Replace with instance validator (uuid ids, unique, singleton rules) |
| 5 | `siteService.js` | every `upsertHome*` filters `section.id==='x' \|\| section.type==='x'` + `>1 → 500` | identity | Target by **sectionId**; singleton rule enforced centrally |
| 6 | `siteService.js` | hard-coded insert positions by neighbor type (`findIndex(...==='contact')`, etc.) | identity | Replaced by explicit `afterSectionId` on add / targeted move |
| 7 | `siteService.js` | `validateCompositionInput` / `composeHomeSections` keyed on canonical ids, "hero first" | identity | Replace with targeted move/remove (§10) |
| 8 | `siteService.js` | `siteSectionResponse` read-sanitizer branches on `id==='faq'` etc. | **dispatch** (by type) | Keep, key on `type` only |
| 9 | `mediaService.js` | `collectSiteMediaIds`, `collectMediaLocations`, `hydrateSiteMedia` gate on `id==='gallery'/'about' && type===…` | dispatch, but id-coupled | Key on `type` only; iterate **all** matches |
| 10 | `site-renderer/PublicHome.tsx` | `key={section.id}`; `some(isContactSection)` | mixed | key on uuid `id` (now unique); contact via `type` |
| 11 | `site-renderer/SectionRenderer.tsx` | `switch(section.type)` | **dispatch** | Keep; also pass instance `id` as anchor |
| 12 | `site-components/*.tsx` | each hard-codes `<SiteSection id="about">` | identity (DOM anchor) | Accept `anchorId` prop = instance id; keep `data-br-section={type}` as CSS hook |
| 13 | `site-components/SiteShell.tsx` | nav from `labels[section.type]`, `#${section.id}`, contact special-case | mixed | key anchors on instance id; "primary contact" = first visible contact; skip hidden |
| 14 | `site-renderer .../contact/page.tsx` (site + preview) | `find(isContactSection)` for the lead page | identity | first `type==='contact'` leadForm section |
| 15 | portal editors (`HeroEditor` … `ContactEditor`) | `sections.find(isXSection)` to seed | identity | Seed from the **sectionId** the manager passes |
| 16 | portal `SectionCompositionEditor`, `BusinessWebsite` overview | `sectionLabels[section.type]`, `homepageSectionLabels[section.id]` | dispatch (labels) | Keep labels by type; ids no longer meaningful as labels |

Occurrences #8, #11 are legitimate **type dispatch** and stay (re-keyed off `type`). Everything else
is identity coupling to remove.

---

## 4. Recommended long-term section-instance model

```ts
export type SectionType =
  | 'hero' | 'about' | 'services' | 'gallery'
  | 'testimonials' | 'faq' | 'businessHours' | 'contact'

export interface SiteSection {
  id: string           // opaque, server-generated, stable for the instance's life
  type: SectionType    // dispatch discriminant only — NEVER identity
  hidden?: boolean      // absent/false = shown; true = retained but not rendered
  content: SectionContent  // the existing per-type content unions, unchanged
}
```

- Keep the existing `content` unions verbatim (HeroContent, GalleryContent, …). Only the section
  **envelope** changes.
- Drop the literal-typed ids on About/Faq/BusinessHours; all become `id: string`.
- Keep `SitePage = { id, slug, title, sections: SiteSection[] }` and `SiteDefinition` unchanged
  except that `pages` now really can hold repeated types.
- **Do not add** section-level versioning, timestamps, or author metadata now. The page doc already
  carries `updatedAt`; published revision history (3.7) will snapshot the whole composition as-is, so
  per-section version fields are premature (§26). `hidden` is the only new field, and it earns its
  place immediately.
- **Home-specific vs multi-page:** keep single-page **storage** (the `home` doc) but make every
  operation signature `(tenantId, pageId, sectionId, …)` with `pageId` fixed to `'home'` for now.
  That makes 3.3 multi-page a **storage/routing** change, not an API/redesign — without building page
  storage prematurely (§12).

Guards become pure type dispatch:
```ts
export const isGallerySection = (s: SiteSection): s is GallerySection => s.type === 'gallery'
// …one per type, all keyed on type only
```

---

## 5. Section identity strategy

**Today:** section instances do **not** have durable identity — the id is the type string, generated
implicitly by writing the type. Item-level ids are real uuids; section-level ids are not.

**Recommendation: opaque, server-generated, immutable section ids.**

- **Format:** `randomUUID()` (`node:crypto`), matching the existing item-id convention — no new deps,
  no format ambiguity. Treated as opaque; never parsed.
- **Owner:** the **server** generates the id at `addSection` / `duplicateSection` / `initializeSite`.
  The client **never supplies** a new section id. Content-edit and move/hide/remove/duplicate calls
  **reference** an existing id in the URL path.
- **Validation:** on write, ids must be non-empty strings, **unique within the page**, and must
  already exist for target-by-id operations (unknown id → 400). A supplied id that collides with a
  reserved word is impossible because clients can't supply ids for new sections.
- **Reuse:** never. Deleting a section retires its id; duplicate mints a fresh one. (Same immutability
  discipline as media ids, which is what keeps the media-deletion race closed.)
- **Consumers that now rely on it:** React keys (`key={section.id}` — now genuinely unique), DOM
  anchors / nav (`#<id>`), server mutation targeting, reorder, delete, visibility, editor instance
  seeding, and future templates/revisions/multi-page — all become id-addressed instead of
  type-addressed.

This is the single load-bearing decision of Step 3.0; everything else composes on top of it.

---

## 6. Section multiplicity / singleton rules

Recommendation: **structurally allow multiples of everything** (opaque ids make it free), then
enforce singletons for three types as a **validation rule** (not a structural limit), so relaxing any
of them later is a one-line validation change.

| Section type | Current assumption | Recommended multiplicity | Reason |
|---|---|---|---|
| **hero** | singleton, required, first | **Singleton, required, must be first** | Page masthead / single H1 / above-the-fold; the hero CTA→contact anchor and SEO assume one. Two mastheads is never correct. |
| **contact** | singleton | **Singleton (for 3.0)** | The hero CTA target, the `/contact` lead-form page, and the nav "Contact" link all resolve "the" contact. Allowing multiples needs a "primary contact" concept — defer to when it's wanted. |
| **businessHours** | singleton | **Singleton** | It is a *projection* of the single `businessProfile.businessHours`; two would render identical hours. Its presence is also governed by the Business Hours editor's homepage toggle (§8). |
| **about** | singleton | **Multiple allowed** | Generic heading+body(+image) content block; "About" + "Our story" is reasonable. No global coupling. |
| **services** | singleton | **Multiple allowed** | "Services" + "Packages" is reasonable. |
| **gallery** | singleton | **Multiple allowed** | The motivating example; "Recent work" + "Before/After" is reasonable. |
| **testimonials** | singleton | **Multiple allowed** | Grouped testimonials (by service/location) is reasonable. |
| **faq** | singleton | **Multiple allowed** | "General FAQ" + "Shipping FAQ" is reasonable. |

The renderer, media hydration, and validation must therefore **not** assume singletons for the five
"multiple" types. Singleton enforcement lives in one place (composition validator, §20).

---

## 7. Add Section

- **Addable types:** all eight. **Singleton-exhausted** types (hero always; contact/businessHours if
  already present) are **omitted from the Add chooser** and rejected server-side (409/400).
- **Default content owner:** a **shared, domain-appropriate module** — new
  `server/domain/sectionDefaults.js` — so Portal and server never duplicate defaults. The server
  applies defaults on add (it already owns id generation and must validate the result anyway). Portal
  does not ship its own default copies.
- **Defaults** must pass each type's existing validator with zero further input where possible:
    - hero: title = tenant/site name (as `initializeSite` does today)
    - about: heading + a short placeholder body
    - services / gallery / testimonials / faq: title/heading + **one empty-ish seed item** OR an empty
      list where the validator permits — note current validators **require ≥1 item**; Add should seed a
      single minimal valid item (e.g. one service named "Service") so the first save is valid, matching
      how the current per-type editors seed a first row.
    - contact: neutral title/buttonLabel + `action:{type:'leadForm'}` (no fabricated email/phone).
    - businessHours: created via its existing toggle path (§8) — Add of businessHours in the manager
      should route to enabling the homepage toggle rather than minting an orphan projection.
- **Insertion point:** **append at end** by default, with an optional `afterSectionId` so the manager
  can insert relative to a card. (Contact/businessHours keep their natural tail placement.)
- **Persistence:** Add **persists immediately** to working state (one transaction) and returns the
  full definition, consistent with every existing editor. No client-only "unsaved new section".
- **After add:** the manager **selects the new section for editing** (opens the type's editor pane
  seeded by the new id), matching the "add → edit" flow.

---

## 8. Remove Section

- **Scope:** working only. Published snapshot is untouched until the next publish.
- **Effect:** removes the section object (reference + content) from `home.sections`. **Never** deletes
  media objects — mediaIds are values inside content; dropping the section just drops references, and
  media survives in the media library (and stays protected while still referenced elsewhere).
- **Confirmation:** deliberate confirm dialog (reuse `ConfirmDialog`). No undo system in 3.0
  (confirmation is cheaper and sufficient; the deleted content is not recoverable in-portal, which is
  acceptable pre-customer — a future revision-history feature (3.7) covers restore).
- **Mandatory sections:** **Hero cannot be removed** (server rejects; UI shows it as pinned).
- **Can all others be removed?** Yes, including down to Hero-only.
- **Empty composition?** Not allowed — a page must retain **at least Hero**. The renderer already
  tolerates a hero-only page; we keep hero-required rather than support a truly empty page.
- **businessHours removal** = the existing "homepage hours off" semantics: it drops the homepage
  section but **retains** `businessProfile.businessHours`. Preserve this coupling (the manager's
  Delete on a businessHours card calls the same path that clears only the homepage projection).
- **Singleton-required deletes** are simply about hero (blocked). Contact/businessHours are singleton
  but freely removable.

---

## 9. Hide / Show

**Recommendation: `hidden: boolean` (default/absent = visible).** Chosen over `visible: boolean`
because:

- The default state (absent field) reads as **shown**, which matches every existing stored section
  and the intuitive "sections are visible unless you hide them"; a `visible` field would make a
  missing field ambiguously mean hidden.
- Hiding is the exceptional, explicit act; encoding the exception (`hidden:true`) keeps documents
  minimal (we omit `hidden` when false, mirroring how the codebase already omits empty optionals).

Semantics (all verified achievable against current code):

- A hidden section **remains in `home.sections`** in place and order.
- A hidden section **remains fully editable** in the portal (its card and editor stay available).
- The **renderer omits hidden sections** (`PublicHome` filters `!section.hidden` before mapping; nav
  in `SiteShell` likewise skips hidden).
- **Publish snapshots the hidden flag as-is** — `toSiteDefinition`/publish copy sections verbatim, so
  a hidden section is published hidden and stays out of live render until shown + republished.
- **Preview reflects hidden** because preview renders working state through the same renderer.
- The **editor still shows hidden sections clearly** (card carries a "Hidden" badge; Show toggles it).
- **Media:** hidden content still holds its mediaIds, so hidden sections **still protect their media
  from deletion** (§13). This is the decisive reason hide must retain content in the array rather than
  "remove + stash".

---

## 10. Reordering

**Move Up / Move Down first** (explicit, accessible, no DnD dependency — matches the scope guidance).

Requirements met by the design below: working-order-only change; exact section objects preserved;
first/last boundaries disable the relevant control; works across hidden sections (hidden sections
occupy order slots and move like any other); works with duplicate types; publish emits resulting
order.

**A (persist whole reordered array) vs B (targeted move by id):** choose **B — targeted move**.

- The current `composeHomeSections` is pattern A: the client sends a full id list and the server
  rebuilds order from it. With multiple tabs, A **silently drops** a section another tab just added
  (the stale client list doesn't include it) and can resurrect one another tab removed. That is the
  "stale full-array replacement / lost update" the scope warns against.
- **B**: `moveSection(tenantId, 'home', sectionId, 'up'|'down')` runs a transaction that **reads the
  current order**, finds `sectionId`, swaps it with its neighbor **in the current array**, writes.
  Concurrent adds/removes/moves are preserved because each move reconciles against the latest state;
  Firestore's optimistic concurrency retries a move that raced a conflicting write.
- Hero stays pinned first: a move that would place a section above hero, or move hero, is rejected.

**Recommendation:** implement targeted `moveSection`; **retire `composeHomeSections`** as the reorder
path (the manager stops sending full id arrays). If a bulk reorder is ever wanted (e.g. DnD later), it
should be a set-reconciling command that reads fresh order and applies a permutation of *exactly the
current id set* (reject if the id set diverges), never a blind array replace.

---

## 11. Backend mutation architecture

`mutateWorkingHome(tenantId, transformSections, mediaRequirement?)` is already an
**instance-agnostic** transactional core: it validates media in-transaction, reads `config`+`home`,
applies a pure `sections ⇒ sections` transform, writes `home`+`config.updatedAt`, and returns the
finalized definition. **Keep it and build every composition command on it** — a content mutator that
never receives a Firestore/published handle structurally cannot touch `published/current`.

Add a small set of **instance-based composition commands** (not one "replace sections[]" endpoint,
not five near-duplicate endpoints — a shared helper + thin wrappers):

- `addSection(tenantId, pageId, type, { afterSectionId? })` — default content from
  `sectionDefaults.js`, server-minted uuid, singleton check, media validation if defaults carry media
  (none do today).
- `removeSection(tenantId, pageId, sectionId)` — hero-guard; drops the object.
- `moveSection(tenantId, pageId, sectionId, direction)` — targeted swap; hero-pin.
- `duplicateSection(tenantId, pageId, sectionId)` — deep-copy content, new uuid + new item uuids,
  insert after source, singleton-block, media re-validation (§13).
- `setSectionVisibility(tenantId, pageId, sectionId, hidden)`.
- **Content editing** stays per-type but **targets `sectionId`**: fold the current
  `updateHomeHero`/`upsertHome*` into `updateSectionContent(tenantId, pageId, sectionId, input)` that
  reads the target section, dispatches validation on its stored `type`, and replaces content in place.

**Routes** (matching the existing `/tenants/:tenantId/site/pages/home/…` convention; all
`requirePlatformAdmin`, global CSRF applies to mutations):
```
POST   /tenants/:id/site/pages/home/sections                     { type, afterSectionId? }
POST   /tenants/:id/site/pages/home/sections/:sectionId/duplicate
DELETE /tenants/:id/site/pages/home/sections/:sectionId
POST   /tenants/:id/site/pages/home/sections/:sectionId/move      { direction }
PATCH  /tenants/:id/site/pages/home/sections/:sectionId/visibility { hidden }
PUT    /tenants/:id/site/pages/home/sections/:sectionId           { …type-specific content }
```
The last one **replaces** the eight per-type content routes (`…/sections/hero`, `/services`, …),
which are type-as-identity. `…/site/pages/home/composition` is retired.

All commands: tenant-scoped, `requirePlatformAdmin`, working-only, published untouched,
transactional through `mutateWorkingHome`, reject malformed/unknown ids and types, and preserve order
integrity (hero first).

---

## 12. Generic future-page compatibility

- Every command already takes `pageId` (fixed `'home'`) so signatures read
  `moveSection(pageId, sectionId, direction)`, not `moveHomeGalleryUp()`.
- **Do not** build page storage now. The `home` doc stays the single page; `pageId` is validated to
  equal `'home'`. 3.3 later swaps the storage/routing behind the same command surface.
- Keep the schema's `pages: SitePage[]` array (already multi-page-shaped) and `findHomePage(slug==='/')`.

---

## 13. Media-deletion interaction — LOAD-BEARING

The race-safety invariant (from `mediaService.deleteUnusedMedia`): the delete runs a transaction that
reads the media doc **and** `config`+`home`+`published`, refuses if the media is referenced anywhere
(working or published), else marks it `deletion.state:'PENDING'` before any object delete. Every
reference-**adding** writer reads `home` inside its transaction and validates candidate mediaIds via
`requireTenantMediaInTransaction` (which rejects `PENDING`/missing media). Firestore optimistic
concurrency makes the two serialize.

**Rules every Step 3.0 write must obey:**

1. **All composition writes go through `mutateWorkingHome`** (transactional `home` read+write). This
   is what makes a concurrent media-delete transaction conflict with a concurrent reference change.
   **Never introduce a non-transactional `home` write** for reorder/hide/etc.
2. **Media validation (`requireTenantMediaInTransaction`) is required only when a write *introduces or
   re-introduces* mediaIds:**
    - **duplicate** of a gallery/about → pass the duplicated mediaIds as the `mediaRequirement`
      (they already exist as references, but validate to reject any that went `PENDING`, and to keep
      the copy honest).
    - **add** section with media in defaults → validate (no default carries media today, so usually a
      no-op).
    - **content edit** → already validated by the per-type upsert; keep that when folding into
      `updateSectionContent`.
    - **remove / move / hide / show** → **no new references**; **no** media validation, but they still
      go through `mutateWorkingHome` (rule 1).
3. **Hidden sections still count as references.** `collectMediaLocations`/`collectSiteMediaIds` scan
   all sections by content, **independent of `hidden`** — do **not** add a `hidden` filter there. A
   hidden gallery keeps protecting its images (they could be shown again). **State: YES — hidden
   content protects media. Verified against `findMediaUsage`.**
4. The media scanners/hydrator must switch from `id==='gallery'/'about'` to **`type`-based**, iterating
   **all** matching sections (multiple galleries), or a second gallery's images would be silently
   unprotected/​unhydrated. This is a required §18 change and a §13 correctness item.
5. No path may delete media as a side effect of a composition change. Remove/duplicate never call
   object deletion.

Net: the save-vs-delete race is preserved because the transactional `home` read/write and the in-tx
media validation are retained on every new command; nothing bypasses them.

---

## 14. Working / published behavior matrix

All composition commands write **working** only; publish snapshots the working composition verbatim.

| Operation | Working changes now? | Published changes now? | Preview reflects? | Live renderer before publish? | Publish behavior |
|---|---|---|---|---|---|
| add | Yes | No | Yes | No | New section appears live after publish |
| remove | Yes | No | Yes | No | Section gone from live after publish |
| duplicate | Yes | No | Yes | No | Copy appears live after publish |
| hide | Yes | No | Yes (omitted) | No (still shown) | Section omitted from live after publish |
| show | Yes | No | Yes (appears) | No (still hidden) | Section shown live after publish |
| move | Yes | No | Yes (reordered) | No | New order live after publish |

Verified: `mutateWorkingHome` writes `home`+`config.updatedAt` only; `publishSite` copies
`toSiteDefinition(config, home)` (verbatim sections incl. `hidden`) into `published/current`;
`getPublishedSiteDefinition` (live) reads the snapshot; preview reads working via the preview token.
`hasUnpublishedChanges` already flips because `home.updatedAt > lastPublishedAt`.

---

## 15. Portal UX design

Make the **Section Manager the primary Homepage surface** (absorb today's "Manage Sections" pane and
the Overview "Homepage" card). Ordered cards + an Add control:

```
Homepage sections
────────────────────────────────────────────
[ Hero ]          Main headline & CTA        Visible   [Edit]  (pinned)
[ Gallery ]       6 images                    Visible   [Edit] [⋮]
[ Gallery ]       3 images                    Hidden    [Edit] [⋮]
[ Services ]      4 services                  Visible   [Edit] [⋮]
[ Contact ]       Lead form                    Visible   [Edit] [⋮]
                              + Add Section
```

Per card: **type label**, a **human summary** (derived from content — "6 images", "4 services",
"Main headline & CTA"), a **Visible/Hidden** badge, an **Edit** button, and the rest of the actions.

**Action placement (mobile-first):**
- **Move Up / Move Down** as two always-visible icon buttons (accessible, no DnD), disabled at
  boundaries; hero's are absent (pinned).
- **Edit** always visible.
- **Duplicate / Hide-Show / Delete** in a **kebab (⋮) menu** to keep the card compact on mobile.
  (Hybrid: inline reorder+edit, kebab for the rest.)
- **+ Add Section** at the bottom → a type chooser listing only addable types (singleton-exhausted
  types omitted), then append/insert → persist → open the new section's editor.

Do not overdesign: no drag handles, no live inline preview, no per-card thumbnails in 3.0.

---

## 16. Editing behavior (instance targeting)

**Reuse the existing per-type editor forms** (option **E** — smallest change that substantially
improves UX). "Edit" on a card opens that type's editor pane, **seeded by the section's `id`**.

Concretely: `HeroEditor/GalleryEditor/…` currently `find(isXSection)` — change each to receive a
`sectionId` (or the resolved section) from the manager and seed from that instance, then save via
`PUT …/sections/:sectionId`. The editors' internal form UIs are otherwise unchanged.

Every editor that currently identifies its section by type (all eight, listed in §3 #15) must switch
to id-targeting; this is mandatory once duplicate types exist. Do **not** rewrite the editor forms —
only their instance-selection and save-target change.

`ActiveWebsiteEditor` in `BusinessWebsite.tsx` (the pane switch) and the `websiteEditors` registry
stay, but the Homepage panes become **manager-driven**: the manager owns the section list and hands a
specific `sectionId` to the chosen editor, instead of the nav offering one pane per fixed type.

---

## 17. Preview behavior

- Preview **already reads working state** through the preview token → renderer `/preview/[tenantId]`.
- Section **order** is reflected (renderer maps `home.sections` in order).
- **Hide/show** reflects automatically once the renderer filters `!hidden`.
- **Duplicate / multiple same-type** reflects automatically once ids are unique keys and media
  hydration/anchors are type-based (§18).
- **Refresh:** preview is a fresh render per click (new tab); the operator re-previews after edits —
  unchanged. Do **not** build a live in-portal iframe/WYSIWYG in 3.0. No portal preview component
  exists to cheaply leverage, so recommend nothing new here.

---

## 18. Renderer changes

Required for stable ids, arbitrary order, multiple same-type, hidden, and optional/empty-but-hero:

- **`PublicHome.tsx`**: filter `home.sections.filter(s => !s.hidden)` before mapping; keep
  `key={section.id}` (now unique); compute `hasContact`/`heroContactHref` from the **first visible
  `type==='contact'`** section and anchor to **its instance id**.
- **`SectionRenderer.tsx`**: keep the `switch(section.type)` dispatch; **pass `section.id` down** as
  the anchor id to each component.
- **`site-components/*` + `SitePrimitives.SiteSection`**: components accept an `anchorId` (instance id)
  and render `<SiteSection id={anchorId} data-br-section={type} data-br-section-id={anchorId}>`. Keep
  `data-br-section={type}` as the **stable public Custom CSS hook** (operators target
  `[data-br-section="gallery"]`; that must remain type-keyed even with two galleries). The DOM `id`
  (anchor) becomes the instance id.
- **`SiteShell.tsx` nav**: skip hidden; label by `type` (two galleries → two "Gallery" links — acceptable,
  or de-duplicate/append an index if desired); anchor `#${section.id}`; "Contact" nav/CTA resolves to
  the first visible contact section (its id / the `/contact` page for leadForm).
- **`.../contact/page.tsx`** (site + preview): find the first `type==='contact'` leadForm section
  instead of `isContactSection`.
- **`mediaService` scanners + hydrator** (renderer-adjacent, server): type-based, iterate all
  matches (§13.4).
- **`siteSectionResponse`** (read sanitizer): keep per-type branches, key on `type` only.

Renderer keeps its invariants: **no direct Firestore access** (reads the sanitized public/preview
API), media as ids hydrated to URLs at read (§30).

---

## 19. Existing type-based lookups — disposition

Covered in the §3 table. Summary: **keep** as type **dispatch** — `SectionRenderer` switch,
`siteSectionResponse` branches, media scanners/hydrator (re-keyed to `type`, iterating all matches),
UI label maps. **Replace** as type **identity** — schema literal ids, `isXSection` guards' id check,
`CANONICAL_SECTION_IDS`, `mapCanonicalSections`, per-type `upsert` singleton scans, hard-coded insert
positions, `composeHomeSections`, `find(isXSection)` in editors and the contact page, and the
components' hard-coded DOM anchor ids.

---

## 20. Schema validation rules (new model)

A single **composition validator** (server, replacing `mapCanonicalSections` + the per-type scans) on
every write, plus per-type content validation (reuse the existing `validate*Input`):

- **Section id:** required non-empty string; **unique within the page**; must exist for
  target-by-id ops (unknown → 400). Clients never supply ids for new sections.
- **Section type:** must be one of the 8 known types (unknown → 400). Type dispatch selects the
  content validator.
- **Content:** must pass the type's validator (existing rules preserved verbatim, incl. item bounds
  and the reserved-identity/​stored-id corruption scans, now keyed by section id).
- **Singleton rule:** ≤1 of `hero`/`contact`/`businessHours`; **exactly one hero, and it must be at
  index 0** (400 on violation for client writes; 500 on stored corruption).
- **hidden:** if present, must be boolean (else 400).
- **Empty sections:** rejected — at least Hero must remain.
- **Max sections:** a generous bound (recommend **30**) to cap abuse without constraining real use —
  not the old hard 8. No per-type max beyond the singletons.
- **Duplicate media within one section** keeps its existing per-type rejection (e.g. gallery dup
  image → 400); duplicate mediaIds **across** sections are allowed (a photo may appear in two
  galleries) and are fine for deletion protection.
- **Corrupt order / stored corruption** → `500 'Home sections invalid'` (never silently repaired).

Because test data is disposable, the validator does **not** accept legacy `id===type` shapes; the
reset (§21) brings stored docs to the new shape first.

---

## 21. Data reset / transition plan

**Only marketing-site site documents change shape.** Exact Firestore paths affected, per test tenant:

- `tenants/{tenantId}/site/config` — unchanged shape (no section data lives here); **keep**.
- `tenants/{tenantId}/site/pages/home` — `sections[]` items gain opaque uuid ids (About/Faq/
  BusinessHours currently `id==='about'/'faq'/'businessHours'`) and lose the `id===type` invariant;
  optional `hidden`. **Needs transition.**
- `tenants/{tenantId}/site/config/published/current` — embeds a verbatim old-shape `sections[]`
  inside `siteDefinition`. **Needs transition** (or clear + republish).

**Preserve untouched:** `tenants/{tenantId}/media/**` (mediaIds are values referenced by content and
do **not** change — media survives), `tenants/{tenantId}/leads/**`, the tenant doc and
`members/**`, `vault_shares`, and **every** non-marketing collection (vault, budget, wow, etc.).
**Never** a broad Firestore clear or DB recreate.

**Recommended transition (simplest first):**

1. **Manual re-init of the few test sites** (preferred). For each test tenant: delete
   `site/pages/home`, `site/config`, and `site/config/published/current`, then re-run
   `initializeSite` and re-enter content through the new editor. Cleanest; zero migration code;
   media/leads retained.
2. If manual is tedious: a **tiny, narrowly-scoped reset/reseed script** that, **for an explicit list
   of test tenant ids only**, rewrites `home.sections` (assign `randomUUID` where `id` is a type
   string; default `hidden` omitted) and either re-publishes or deletes `published/current` so the
   next publish regenerates it. Scope strictly to `tenants/{tid}/site/**`.
3. A one-time migration is unnecessary given (1)/(2) and disposable data.

Because published snapshots are trivially regenerated by clicking **Publish**, prefer to **delete
`published/current` and republish** rather than migrate its embedded sections.

**No reset executes during planning or implementation** — the operator runs it deliberately, once,
before/with the 3.0a cutover. Provide the tenant id list at that time.

---

## 22. Authorization

Unchanged. All site mutations are `requirePlatformAdmin` today (`routes/tenants.js`); reads are
`requireTenantRole(['OWNER','ADMIN','STAFF'])`. Every new composition command is
**`requirePlatformAdmin`** and inherits the existing `isAuthenticated` + global CSRF. No role
redesign in 3.0.

---

## 23. Concurrency model

Every command is a **single Firestore transaction that reads the current composition and applies one
instance-targeted command to the latest state**, so:

- **A. Tab1 moves A, Tab2 deletes B** → independent; both transactions read fresh `home`; the second
  to commit retries on the latest and applies cleanly. No lost update.
- **B. Tab1 duplicates gallery, Tab2 edits that gallery** → serialize; whichever commits second reads
  the other's result. Duplicate copies whatever content is current; edit lands on the original id.
  (A stale full-array replace would have clobbered one — targeted ops don't.)
- **C. Media delete during duplicate/edit** → the delete tx reads `home`+`published`; the edit/dup tx
  reads `home` + validates media. Firestore conflicts serialize them: either the reference exists when
  delete checks (delete refused) or the media is `PENDING` when the edit validates (edit refused).
  Preserved exactly as today.
- **D. Two reorders race** → both read fresh order; the loser retries and swaps against the winner's
  result. Deterministic, no lost move.

The one thing to **avoid** is reintroducing a client-supplied full-array replace (the retired
`composeHomeSections`), which can silently overwrite a concurrent add/remove. Expected behavior:
Firestore contention → automatic transaction retry; on genuine conflict the client sees the returned
fresh definition and re-renders.

---

## 24. Deterministic test plan

**Backend / service (`node:test` + FakeDb, no emulator — extend existing `siteService.test.js` etc.):**
add section (each type, defaults valid); remove section; hero-remove blocked; move up/down; first/last
boundary no-ops; hide/show; duplicate (new section id + new item ids, original unchanged, inserted
after source); singleton enforcement (add/duplicate hero/contact/businessHours blocked); stable ids
survive edit/move/hide; duplicate-id rejection; unknown/invalid section id → 400; unknown type → 400;
tenant isolation; **published unchanged after each working op**; arbitrary order round-trips; **two
galleries** coexist and both render/validate; media references preserved across remove/move/hide;
**hidden gallery still blocks its media deletion**; **race: media delete vs duplicate/edit** (extend
`mediaDeletionRace.test.js`); concurrent-mutation reconciliation (two moves, move+delete). Also: the
snapshot-isolation pattern already used (publish A → mutate B → getSite=B, public=A, snapshot bytes
unchanged → republish → public=B) applied to add/remove/move/hide/duplicate.

**Portal (vitest/RTL — extend `app/businesses/test/*`):** list renders in order; multiple same-type
cards; add flow (chooser omits exhausted singletons, opens editor after add); delete confirmation;
hide/show badge + toggle; move controls + disabled boundaries; duplicate; **Edit opens the correct
instance** (two galleries → editing card 2 targets id 2); loading/error states; double-submit
protection; kebab keyboard/mobile behavior.

**Renderer (`node:test` — extend `site-renderer/test/*`):** order preserved; two same-type sections
render; hidden omitted; visible rendered; **React keys use instance ids**; anchors use instance ids
while `data-br-section` stays type-keyed; contact resolution picks first visible contact; no singleton
assumption.

**Schema:** id required + unique; hidden boolean; type/content validation; singleton + hero-first.

---

## 25. Accessibility

- Move Up/Move Down are real `<button>`s with accessible names (`aria-label="Move Gallery up"`), the
  primary reason to prefer them over DnD; **no drag-only interaction** exists.
- Kebab menu is keyboard-operable (roving focus / menu semantics via the existing `@bakerrang/ui`
  primitives), and every action reachable without a pointer.
- Visible/Hidden state is conveyed **textually** (a "Hidden" badge + button label "Show"/"Hide"), not
  by color alone.
- Boundary controls are `disabled` with clear semantics (first section's "up", last's "down").
- Delete uses the accessible `ConfirmDialog`; focus returns to a sensible anchor (the card or Add
  control) after menu/dialog close.
- Reuse the existing dirty-guard and `aria-live` status regions in `BusinessWebsite`.

---

## 26. Future-proofing conclusions

- **Opaque section ids** are the primitive templates (3.6) and revision history (3.7) need — they let
  a snapshot/template reference and reconstruct sections without type collisions.
- **`pageId` in every signature** keeps multi-page (3.3) a storage change, not an API redesign, while
  building no page storage now.
- **Type dispatch stays extensible** (switch + registry) for the expanded section library (3.2): a new
  type = a new content union + a `SectionRenderer` case + a default + a validator, with no identity
  coupling to unpick.
- **`hidden`** composes naturally with templates (a template can ship hidden sections) and revisions
  (snapshot copies the flag).
- **Duplication copies content, never media objects** — mediaIds are shared references, so galleries
  can share a photo and revision snapshots stay lightweight.
- The editor is **manager-driven, not a hard-coded pane list**, so new types appear without editing a
  fixed nav.
- Nothing here introduces a generic external page-builder framework (§30).

---

## 27. Recommended Step 3.0 scope

**Include all of:** stable opaque section ids; instance-based mutations; multiple instances (for the
five non-singleton types); add; remove; reorder (Move Up/Down); duplicate; hide/show; the composition
editor shell; renderer support; and the narrowly-scoped test-data reset. The architecture supports
doing this coherently, and the disposable test data removes the only reason to defer the breaking
schema change. **Do not include** theme/font editing, new section types, multi-page, nav/header/footer,
SEO, templates, revision history, or drag-and-drop (all out of scope per the brief).

---

## 28. Implementation slices

Two slices; a third only if reality demands it.

**3.0a — Section Architecture Foundation** (backend + schema + renderer; no new portal manager UI yet)
- Schema: opaque `id: string` on all sections, drop literal ids, add `hidden?`, retype guards to
  type-only, add `getHomePage`-style helpers as needed.
- Server: generalize/keep `mutateWorkingHome`; add `addSection/removeSection/moveSection/
  duplicateSection/setSectionVisibility` + `updateSectionContent(sectionId)`; new composition validator
    + `server/domain/sectionDefaults.js`; retire `composeHomeSections`/per-type content routes; new
      instance routes (§11); media scanners/hydrator/`siteSectionResponse` re-keyed to `type`.
- Renderer: `hidden` filter, instance-id anchors, type-based media + contact resolution, keep
  `data-br-section` type hook.
- Keep the existing portal editors working by switching them to id-targeting (minimal), so the app
  stays usable between slices.
- Test-data reset plan finalized (executed by operator at cutover).
- Full backend/renderer/schema test coverage (§24).

**3.0b — Portal Section Manager** (the UX)
- Composition list as the Homepage surface: cards with type label + summary + visible/hidden badge;
  Add (type chooser) / Remove (confirm) / Move Up-Down / Duplicate / Hide-Show / Edit-by-instance;
  responsive + accessible (§15, §25). Portal tests (§24).

**3.0c — Integration / polish** (only if needed): remaining editor conversions, preview/UX cleanup,
operator-run reset acceptance. Likely foldable into 3.0a/3.0b.

---

## 29. Files likely to change

**Schema:** `platform/packages/site-schema/src/index.ts`.
**Server:** `server/services/siteService.js`, `server/services/mediaService.js`,
`server/routes/tenants.js`, new `server/domain/sectionDefaults.js`; tests
`server/test/siteService.test.js`, `aboutService/faqService/galleryService/testimonialsService/
businessHoursService.test.js`, `mediaDeletionRace.test.js`, `tenantRoutes` auth test.
**Renderer:** `platform/apps/site-renderer/components/PublicHome.tsx`, `SectionRenderer.tsx`,
`app/site/[tenantId]/contact/page.tsx`, `app/preview/[tenantId]/contact/page.tsx`; renderer tests.
**Site components:** `platform/packages/site-components/src/SitePrimitives.tsx`, `SiteShell.tsx`,
and each section component (`Hero/About/Services/Gallery/Testimonials/Faq/BusinessHours/Contact.tsx`)
for the `anchorId` prop.
**Portal:** `app/businesses/SectionCompositionEditor.tsx` (becomes the manager) + a new manager
component, `BusinessWebsite.tsx`, `websiteEditors.ts`, `WebsiteEditorNavigation.tsx`, each
`*Editor.tsx` (id-targeting), `lib/site.ts` (new command clients, retire composition client);
portal tests.

---

## 30. Architecture-regression check

Preserved by this plan: renderer never touches Firestore (reads sanitized public/preview API);
media stored as ids, URLs hydrated at read; tenant scoping on every command; working/published
separation (commands write working only, publish snapshots verbatim); transaction-safe media writes
(every command through `mutateWorkingHome`, in-tx media validation on reference-adding writes); no new
CORS/auth exceptions (all `requirePlatformAdmin` + existing CSRF); no new infra coupling; **no generic
external CMS/page-builder dependency** — this stays BakerRang's own domain model and editor, and the
one new runtime primitive is `randomUUID` (already in use).

---

## 31. Baseline, blockers, readiness

**Baseline (this branch, local, read-only):**
- `server`: `node --test` → **332 pass / 0 fail**.
- `platform`: `npm test` → site-renderer **59 pass**, ui **9 pass**, portal suites green, no failures.
- `platform`: `npm run typecheck` → **clean** across portal, site-renderer, site-components,
  site-schema, ui.
- No deploys, no cloud reads/writes performed.

**Blockers:** none technical. Four decisions the operator should confirm before 3.0a:
1. **Singleton policy** — accept the recommended set (singleton: hero/contact/businessHours; multiple:
   about/services/gallery/testimonials/faq)? Or allow multiple contact/businessHours too?
2. **Retire `composeHomeSections`** (full-array reorder) in favor of targeted `moveSection` — confirm.
3. **Test-data transition** — manual re-init of the test tenants (preferred) vs a scoped reset script;
   and the explicit list of marketing-site test tenant ids to reset.
4. **Section id format** — `randomUUID` opaque ids (recommended) — confirm no external constraint.

**Readiness:** **Yes — ready to implement.** The codebase already has the right transactional seam
(`mutateWorkingHome`), a type-dispatch renderer, and real item-level uuids; Step 3.0 mainly removes
type-as-identity and adds `hidden` + instance commands on top of proven machinery. Proceed with 3.0a
once the four decisions are confirmed.
