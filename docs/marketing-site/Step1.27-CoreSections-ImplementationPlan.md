# Step 1.27 — About / FAQ / Business Hours / Social Links — Implementation Plan

**Status: READY FOR IMPLEMENTATION**

Codex-ready plan to add four content capabilities as natural extensions of the existing
architecture. Two become **composable Home sections** (About, FAQ); two become **canonical
`BusinessProfile` data** (Business Hours, Social Links) with restrained presentation that
*references* the canonical data rather than duplicating it. Everything rides the existing
WORKING→Preview→Publish model, the read-time media/normalization pipeline, the Step 1.26
Theme tokens, and the existing LocalBusiness JSON-LD. No migration, no rich text, no new
Preview mechanism. Delivered in five reviewable slices (1.27a–e).

---

## 1. Current-state findings

- **Home sections are the single composition authority.** `siteService.js`
  `CANONICAL_SECTION_IDS = {hero, services, gallery, testimonials, contact}`; each canonical
  section is **single-instance** and enforces `id === type` in `mapCanonicalSections`
  (`siteService.js:379`). `validateCompositionInput`/`composeHomeSections` drive ordering and
  removal; the Portal `SectionCompositionEditor` reorders/removes by rewriting `sectionIds`.
  Adding a new section type = widen this set + the editor's label map. **This already gives us
  max-1 multiplicity for free.**
- **Section mutation pattern** (`upsertHomeServices/Gallery/Testimonials`): validate → pure
  `mutateWorkingHome(tenantId, sections ⇒ sections)` transform; server-generated item ids via
  `randomUUID`; reserved-identity corruption scans; insert "before Contact / else append" (or
  "after Hero" for services). New sections reuse this verbatim.
- **Media is provider-neutral, hydrated at read time.** `hydrateSiteMedia` (`mediaService.js:189`)
  resolves logo (`branding.logoMediaId`), social image (`businessProfile.socialImageMediaId`),
  and gallery items by `mediaId` → injects `src/width/height`. **Media docs carry no alt text**
  (only `originalFilename`); Gallery stores its own `altText`. So any imaged section must store
  its own alt. `requireTenantMedia` pre-validates existence outside the transaction (safe:
  media is immutable/non-deletable).
- **BusinessProfile** (`server/domain/businessProfile.js`) = `description, phone, email,
  address, serviceAreas, socialImageMediaId`. `validateBusinessProfile` only includes
  **present** keys; `updateBusinessProfile` (`siteService.js`) **replaces** `config.businessProfile`
  wholesale (`transaction.set(config, nextConfig)`), so any profile write must send the
  **complete** profile or it wipes omitted fields. The `PUT /tenants/:id/site/profile` route is
  PLATFORM_ADMIN. This is the natural home for canonical Hours + Social.
- **SEO / JSON-LD** (`site-renderer/lib/seo.ts` `localBusinessData`) already derives
  LocalBusiness from `businessProfile` (name, phone, email, address, serviceAreas, logo, image),
  gated on having at least one of phone/email/address/serviceAreas. Extending it with
  `openingHoursSpecification` (from hours) and `sameAs` (from social) is a clean, canonical-only
  addition. Preview already emits noindex/no-canonical (Step 1.25) — unaffected.
- **Renderer shell**: `SiteShell` builds `SiteHeader` + children + `SiteFooter`; `SiteFooter`
  currently shows siteName + nav only — the natural, restrained home for social icons. Theme
  tokens (`--site-*`, `.site-radius-*`, `.site-section`, `SiteContainer/SiteSection/
  SectionHeading`) are the required styling surface (Step 1.26).
- **Backwards-compat lever**: `businessProfileResponse`/`normalizeSiteTheme` show the read-time
  defaulting idiom; all new fields are optional and absence-safe.

---

## 2. Canonical storage recommendation

| Capability | Canonical home | Rationale |
|---|---|---|
| **About** | **Home section** `about` (new) | Pure homepage narrative/presentation; not a reusable business fact. Composable, orderable, single-instance. |
| **FAQ** | **Home section** `faq` (new) | Structured homepage content with ordered children; mirrors Services/Testimonials. |
| **Business Hours** | **`BusinessProfile.businessHours`** (canonical) + **optional** `businessHours` Home section that *renders* the canonical data | Hours are a reusable business fact (JSON-LD, future header/footer/maps). One source of truth; the section holds only `heading/intro` and consumes profile hours at render. |
| **Social Links** | **`BusinessProfile.socialLinks`** (canonical), rendered in the **Footer** | Reusable identity (`sameAs`, future header/contact). No dedicated homepage section in V1. |

This keeps structured business facts out of section payloads (no dual sources of truth) while
letting operators still control *where* hours appear via composition.

---

## 3. Recommended schema changes (`packages/site-schema/src/index.ts`)

```ts
// --- About (Home section) ---
export interface AboutContent {
  eyebrow?: string
  heading: string
  body: string                 // plain multiline text; rendered with white-space: pre-line
  imageMediaId?: string
  imageAlt?: string
  // read-time hydration only:
  imageSrc?: string; imageWidth?: number; imageHeight?: number
}
export interface AboutSection { id: 'about'; type: 'about'; content: AboutContent }

// --- FAQ (Home section) ---
export interface FaqItem { id: string; question: string; answer: string }
export interface FaqContent { heading: string; intro?: string; items: FaqItem[] }
export interface FaqSection { id: 'faq'; type: 'faq'; content: FaqContent }

// --- Business Hours (Home section = presentation only) ---
export interface BusinessHoursContent { heading?: string; intro?: string }
export interface BusinessHoursSection { id: 'businessHours'; type: 'businessHours'; content: BusinessHoursContent }

export type SiteSection =
  | HeroSection | AboutSection | ServicesSection | GallerySection
  | TestimonialsSection | FaqSection | BusinessHoursSection | ContactSection

export const isAboutSection = (s: SiteSection): s is AboutSection => s.id === 'about' && s.type === 'about'
export const isFaqSection = (s: SiteSection): s is FaqSection => s.id === 'faq' && s.type === 'faq'
export const isBusinessHoursSection = (s: SiteSection): s is BusinessHoursSection => s.id === 'businessHours' && s.type === 'businessHours'

// --- Canonical BusinessProfile additions ---
export type WeekdayKey = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'
export type DayHours = { closed: true } | { open: string; close: string } // 'HH:MM' 24h
export type BusinessHours = Partial<Record<WeekdayKey, DayHours>>

export type SocialPlatform = 'facebook'|'instagram'|'linkedin'|'youtube'|'tiktok'|'x'
export interface SocialLink { platform: SocialPlatform; url: string }

export interface BusinessProfile {
  description?: string; phone?: string; email?: string
  address?: PostalAddress; serviceAreas?: string[]
  socialImageMediaId?: string; /* + hydrated social* */
  businessHours?: BusinessHours          // NEW
  socialLinks?: SocialLink[]             // NEW
}
```

Notes: `id`/`type` are literal-narrowed like existing sections; the guards reuse the existing
pattern (no `.find` narrowing breakage since callers already use type guards).

---

## 4. BusinessProfile evolution

- Add `businessHours` + `socialLinks` to `validateBusinessProfile` and `businessProfileResponse`
  (`server/domain/businessProfile.js`), both **optional and present-key-gated** (identical idiom
  to `serviceAreas`/`socialImageMediaId`).
- `hasBusinessProfile` already returns true if any key present — unchanged.
- **No new profile endpoint.** Reuse `PUT /tenants/:id/site/profile`. Because that route replaces
  the whole profile, every profile editor (Details, Hours, Social) must send the **complete merged
  profile** (seed from the already-loaded `site.businessProfile`, override its slice). This is how
  the current editor already behaves; the new Hours/Social editors follow suit. (Decision §20.1: one
  combined editor vs. separate cards — both hit the same endpoint.)

---

## 5. Home section changes (`siteService.js`)

- Widen `CANONICAL_SECTION_IDS` to add `about`, `faq`, `businessHours` (per slice).
- `validateCompositionInput` / `mapCanonicalSections` automatically handle the new ids (they key
  off the set + `id===type` uniqueness) → **single-instance enforced server-side**, Hero-first
  invariant preserved.
- New upserts via `mutateWorkingHome`:
  - `upsertHomeAbout` — validate, `requireTenantMedia` if `imageMediaId`, single-instance scan,
    insert **after Hero / before Services** (or after Hero if no Services) → About reads as an
    intro block; else replace in place.
  - `upsertHomeFaq` — validate, single-instance scan, server `randomUUID` item ids (unknown/dup
    id → 400), insert **before Contact / else append**.
  - `upsertHomeBusinessHours` — validate `{heading?, intro?}` only, single-instance scan, insert
    **before Contact / else append**. Stores **no hours** (rendered from profile).
- **Default insertion, never auto-add.** New sections appear only when the operator adds them;
  existing sites are untouched (`initializeSite` still seeds Hero only).

---

## 6. About V1 design

- Fields: `eyebrow?` (≤60), `heading` (1..120, required), `body` (1..2000, required),
  `imageMediaId?`, `imageAlt?` (required iff image present, ≤250 — mirrors Gallery altText).
- **Body = plain multiline string**, rendered with `whitespace-pre-line` (blank line = paragraph
  break). No Markdown/HTML — smallest professional model (Decision §20.2: single string vs
  `paragraphs: string[]`; recommend single string).
- Media: reuse the provider-neutral flow. Extend `hydrateSiteMedia` to also collect the About
  section's `imageMediaId` and inject `imageSrc/imageWidth/imageHeight`; on unresolved media the
  hydrator drops the image fields (renders text-only, no broken layout).
- No image → text renders full-width intentionally (layout handles both, §21).

## 7. FAQ V1 design

- Fields: `heading` (1..120, required), `intro?` (≤300), `items` (1..20). Each item:
  `question` (1..200), `answer` (1..1000). No HTML.
- Ordered array = display order; server-generated `id` per item (`randomUUID`); item matching on
  supplied id for edits (unknown/dup → 400) — exact Services/Testimonials contract.
- **Public UX: native `<details>/<summary>` disclosure** — zero JS, semantic, keyboard-accessible,
  theme-radius-aware, no dependency. **All collapsed** by default (predictable). (Decision §20.3:
  `<details>` vs button+`aria-expanded` React state — recommend `<details>`.)
- **FAQPage JSON-LD: DO NOT emit in V1.** Google restricted FAQ rich results (2023) to
  authoritative gov/health domains; for local-business sites it yields no rich result while adding
  structured-data surface and mismatch-warning risk. Recommend skipping; revisit only if a concrete
  SEO need appears. (Deliberate answer to §10/§4.)

## 8. Business Hours V1 design

- Canonical `BusinessProfile.businessHours: Partial<Record<Weekday, DayHours>>`; each present day is
  `{closed:true}` or `{open:'HH:MM', close:'HH:MM'}` (24h internal). Absent day = unspecified (not
  rendered).
- **Single interval per day** (no split hours in V1 — keeps the editor a 7-row grid; schema can
  later widen a day to `periods: [{open,close}]` without breaking `{closed}`). (Decision §20.4.)
- Validation: keys ∈ the 7 weekdays; `HH:MM` regex `^([01]\d|2[0-3]):[0-5]\d$`; `close > open`
  (string compare works for zero-padded 24h). Malformed day → 400 (strict write); response
  sanitizer drops malformed days.
- **No timezone modeled.** Hours are display-only structured data. **No "Open now" / today-highlight**
  (would be wrong without the business timezone). JSON-LD `openingHoursSpecification` uses local
  `opens/closes` (schema.org permits time-only). (Answer to §5/§23.)
- Presentation: optional `businessHours` Home section (heading/intro) renders the canonical hours;
  the `BusinessHours` component receives `hours` as a prop (from `site.businessProfile.businessHours`).

## 9. Social Links V1 design

- Canonical `BusinessProfile.socialLinks: SocialLink[]`, **typed entries** `{platform, url}` (more
  extensible than fixed `facebook?/instagram?` fields; dedupe/order are explicit).
- Platform enum V1: `facebook, instagram, linkedin, youtube, tiktok, x`. No arbitrary/"generic"
  links in V1 (keeps icons + `sameAs` clean).
- Validation: `platform` ∈ enum; **dedupe by platform** (one entry each, later wins or 400 —
  recommend 400 on duplicate for clarity); `url` via `new URL`, **HTTPS only** (reject
  `http`/`javascript:`/`data:`/mailto), length ≤ 300; array order = render order; max = enum size.
- Presentation: **Footer only** in V1 (restrained). Inline SVG icons (6 small paths, no
  dependency), `aria-label` per platform, `target=_blank rel=noopener noreferrer`. Absent/empty →
  renders nothing. (Decision §20.5: Footer-only vs also Contact — recommend Footer-only.)

---

## 10. SEO / structured-data changes (`site-renderer/lib/seo.ts`)

- Extend `localBusinessData` (canonical, from `businessProfile` only):
  - `openingHoursSpecification`: array of `{ '@type':'OpeningHoursSpecification', dayOfWeek:
    'https://schema.org/Monday'..., opens:'09:00', closes:'17:00' }` for open days; **closed and
    malformed days omitted**; whole key omitted if no valid days.
  - `sameAs`: array of social `url`s; omitted if empty.
- Gate unchanged (still needs core identity to emit the block); hours/social only *augment* it.
- **No FAQPage JSON-LD** (§7). About does **not** alter structured identity.
- Preview stays noindex/no-canonical; public/custom-domain canonical behavior unchanged. Structured
  data derives from canonical data, so Preview (working) vs public (published) reflect their
  respective snapshots automatically.

---

## 11. Renderer / component architecture (`packages/site-components`)

- New components (all Theme-native — `SiteSection`/`SiteContainer`/`SectionHeading`, `--site-*`
  tokens, `.site-radius-*`, no arbitrary colors, no per-section backgrounds):
  - `About` — responsive two-column (image + text) collapsing to stacked on mobile; text-only when
    no image; `<img>` from hydrated `imageSrc` (no Next/Image, matching Gallery), `alt={imageAlt}`.
  - `Faq` — `SectionHeading` + optional intro + list of `<details><summary>` items; summary uses a
    semantic button-like affordance; `.site-radius-panel` on items.
  - `BusinessHours` — `<table>`/definition list of day → hours; "Closed" state; times formatted for
    display (12h `9:00 AM` via a small pure formatter, from 24h stored). Renders null if no hours.
  - `SocialLinks` — inline-SVG icon row for the Footer; null on empty.
- `SectionRenderer` gains `about`/`faq`/`businessHours` cases. `businessHours` needs profile hours:
  thread `businessHours` from `PublicHome` (which has `site`) → `SectionRenderer` (new optional
  prop), like `heroContactHref` today. `SiteShell`/`SiteFooter` gains `socialLinks` from
  `site.businessProfile?.socialLinks`.
- Renderer stays Firestore-free; consumes sanitized API `SiteDefinition` only.

---

## 12. Portal editor UX (`platform/apps/portal`)

Website workspace grouping (extends the Step 1.24/1.26 layout):

```text
Site Foundation:  Branding · Theme · Business Profile · Business Hours · Social Profiles · Manage Sections
Homepage Content: Hero · About · Services · Gallery · Testimonials · FAQ · Contact
Publishing:       Preview changes · Publish/Republish
```

- **About editor** (`AboutEditor.tsx`): eyebrow, heading, body (`Textarea`), optional image via the
  existing media upload/select pattern (copied from Branding/Profile editors), `imageAlt` input
  shown when an image is selected. Shared `@bakerrang/ui` primitives.
- **FAQ editor** (`FaqEditor.tsx`): heading, intro, item rows (question `Input` + answer `Textarea`)
  with **compact icon controls** for Move Up/Down/Remove (reuse the Step 1.26 `SectionComposition`
  icon-button pattern — `w-11 px-0 sm:w-auto`, `aria-label`s, disabled first/last), no drag-drop,
  mobile-safe touch targets. Temp React keys never persisted/sent.
- **Business Hours editor** (`BusinessHoursEditor.tsx`): 7-row weekly grid — per day an Open/Closed
  toggle + two time selects (`<select>` of 15/30-min increments, or `type=time`), disabled when
  Closed. Optional **"Copy Monday to weekdays"** helper (small, one button). Sends the **full merged
  BusinessProfile**. Mobile: rows stack (day label above the open/close controls).
- **Social Profiles editor** (`SocialProfilesEditor.tsx`): add-a-platform picker (only platforms not
  yet configured, preventing duplicates) + per-row `[platform label] [url Input] [Remove]`; clear
  per-row validation messages. Sends the **full merged BusinessProfile**.
- **Business Hours + Social live under "Business Profile"** conceptually but as **separate editor
  cards** (each seeds from and re-sends the whole profile) to keep each form focused and mobile-
  friendly. Register `'about' | 'faq' | 'businessHours' | 'social'` in `BusinessWebsite`'s
  `EditorMode` + buttons, mirroring existing editors.

---

## 13. API / service changes

**New section endpoints** (`routes/tenants.js`, PLATFORM_ADMIN, existing router/CSRF/limiter):
- `PUT /:tenantId/site/pages/home/sections/about`   → `siteService.upsertHomeAbout`
- `PUT /:tenantId/site/pages/home/sections/faq`      → `siteService.upsertHomeFaq`
- `PUT /:tenantId/site/pages/home/sections/businessHours` → `siteService.upsertHomeBusinessHours`

**Canonical Hours/Social**: **no new endpoints** — extend `validateBusinessProfile` +
`businessProfileResponse`; reuse `PUT /:tenantId/site/profile`.

**Media**: extend `hydrateSiteMedia` for the About image. `composeHomeSections`, publish/unpublish,
preview, and lead APIs are **unchanged** (new sections pass through verbatim; publish snapshots them
via the existing `toSiteDefinition` path).

Portal `lib/site.ts`: add `upsertHomeAbout/Faq/BusinessHours` + extend `BusinessProfileInput` with
`businessHours`/`socialLinks`.

---

## 14. Validation and limits (server authoritative)

| Field | Limit |
|---|---|
| About eyebrow / heading / body | ≤60 / 1..120 / 1..2000; no HTML |
| About imageAlt | required iff image; ≤250 |
| FAQ heading / intro | 1..120 / ≤300 |
| FAQ items | 1..20; question 1..200; answer 1..1000 |
| Hours days | keys ∈ 7 weekdays; `HH:MM` 24h; `close > open`; `{closed:true}` allowed |
| Business-hours section | heading ≤120, intro ≤300 (both optional) |
| Social | platform ∈ enum; dedupe (dup → 400); `url` HTTPS-only via `new URL`, ≤300; max = enum size |

Unknown input fields dropped (not persisted). Portal mirrors for UX; server is the authority.

---

## 15. Backwards-compatibility strategy

- All fields optional/additive → **no Firestore migration**. Old configs/snapshots: no About/FAQ
  sections, no hours, no social → nothing renders; JSON-LD omits `openingHoursSpecification`/`sameAs`.
- `businessProfileResponse` sanitizes new fields (drops malformed) exactly like existing fields, so
  pre-1.27 published snapshots normalize safely.
- `initializeSite` still seeds Hero only; existing sites look unchanged until the operator adds/
  configures a feature.
- Section-composition invariants (Hero-first, id===type) unchanged.

## 16. Working / Published / Preview behavior

- All new content is written to **working** (`config.businessProfile` for Hours/Social;
  `home.sections` for About/FAQ/Hours-section) and snapshotted only on Publish via the existing
  `toSiteDefinition` path → **isolation preserved** (edit B, public stays A until Republish).
- **Preview (Step 1.25) works with zero changes** — it renders the working `SiteDefinition`, which
  now carries the new sections + profile fields. Hours/social reach Preview through the same working
  read; reach published via the snapshot. No new Preview code.

## 17. Exact files likely created / modified

**Created**
- `server/domain/businessHours.js` (validate/normalize hours), `server/domain/socialLinks.js`
  (validate/normalize social) — or fold into `businessProfile.js` if small.
- `platform/packages/site-components/src/{About,Faq,BusinessHours,SocialLinks}.tsx` + `hours.ts`
  (pure 24h→display formatter, weekday order).
- `platform/apps/portal/app/businesses/{AboutEditor,FaqEditor,BusinessHoursEditor,SocialProfilesEditor}.tsx`
- Server tests: `server/test/aboutSection.test.js`, `faqSection.test.js`, `businessHours.test.js`,
  `socialLinks.test.js` (or extend `siteService.test.js`).
- Renderer/Portal tests (see §18).

**Modified**
- `platform/packages/site-schema/src/index.ts` (types + guards + union + BusinessProfile fields)
- `server/services/siteService.js` (`CANONICAL_SECTION_IDS`, `upsertHomeAbout/Faq/BusinessHours`)
- `server/domain/businessProfile.js` (hours + social in validate/response)
- `server/services/mediaService.js` (`hydrateSiteMedia` About image)
- `server/routes/tenants.js` (3 section routes)
- `platform/packages/site-components/src/{SectionRenderer? (renderer app), SiteShell, SiteFooter, index.ts}`
- `platform/apps/site-renderer/components/{SectionRenderer,PublicHome}.tsx` (about/faq/hours cases + thread hours)
- `platform/apps/site-renderer/lib/seo.ts` (`openingHoursSpecification`, `sameAs`)
- `platform/apps/portal/app/businesses/{BusinessWebsite,SectionCompositionEditor}.tsx` (editor modes + labels)
- `platform/apps/portal/lib/site.ts` (new upserts + profile input)

## 18. Testing plan

**Server (node:test + FakeDb):** About validation + media-existence pre-check + hydration
(image resolves / unresolved drops fields); FAQ validation, id round-trip, ordering, max-1
multiplicity, unknown/dup id → 400; Hours normalization (closed vs open/close, `close>open`,
bad time → 400, malformed day dropped in response); Social platform/URL validation, HTTPS-only,
`javascript:` rejected, duplicate-platform → 400; BusinessProfile still accepts existing fields;
**snapshot isolation** for each (publish A → edit B → getSite=B, public=A, snapshot bytes unchanged
→ republish → public=B); old snapshot without new fields normalizes; `localBusinessData` emits
`openingHoursSpecification`/`sameAs` only from canonical data and omits when absent/malformed.

**Renderer (node:test):** About with/without image; FAQ `<details>` semantics + all-collapsed; Hours
render incl. Closed days + display formatting; SocialLinks render + empty→null + external-link attrs;
Theme token usage; Preview reads working / public reads published; JSON-LD reflects hours/social.

**Portal (vitest):** each editor renders current/empty values, saves, shows validation errors; FAQ
add/edit/remove/reorder with disabled first/last; Hours toggle + copy-weekdays; Social dedupe +
per-row error; profile editors re-send the full merged profile (no field wipe); Preview action still
present.

**Regression:** Hero/Services/Gallery/Testimonials/Contact/Leads/Branding/Theme/custom-domains/
Preview/publish-unpublish semantics unchanged (existing suites are the contract).

## 19. Incremental implementation sequence (1.27 substeps)

1. **1.27a — About**: schema + `upsertHomeAbout` + route + `hydrateSiteMedia` image + `About`
   component + `SectionRenderer`/composition wiring + `AboutEditor` + tests.
2. **1.27b — FAQ**: schema + `upsertHomeFaq` + route + `Faq` (`<details>`) + editor + tests.
3. **1.27c — Business Hours**: `BusinessProfile.businessHours` (validate/response) + optional
   `businessHours` section + `BusinessHours` component (+ thread profile hours) +
   `openingHoursSpecification` JSON-LD + `BusinessHoursEditor` + tests.
4. **1.27d — Social Links**: `BusinessProfile.socialLinks` + Footer `SocialLinks` + `sameAs` JSON-LD
   + `SocialProfilesEditor` + tests.
5. **1.27e — cross-feature verification**: composition editor covers all new sections; SEO/structured-
   data end-to-end; full regression + manual DEV pass (§ manual plan below).

Each slice leaves tests green, `SiteDefinition` valid, Preview working, and published behavior stable.
Canonical BusinessProfile changes land **within** 1.27c/1.27d (before/with their sections), so no
separate schema-only slice is needed.

**Manual DEV** (`ALLOW_DRAFT_PUBLIC_SITES=false`, desktop+mobile): per feature — add/edit/reorder/
remove, Preview shows working, shared+custom-dev stay old until Republish, then update; FAQ keyboard/
accordion; Hours open/closed formatting; Social external links + Footer light/dark; verify JSON-LD via
Rich Results test on the shared route.

## 20. Human decisions genuinely required

1. **Hours/Social editor placement** — separate editor cards (recommended, focused + mobile-friendly)
   vs one expanded Business Profile form. Both use the same `PUT /site/profile`.
2. **About body** — single multiline string + `pre-line` (recommended) vs structured `paragraphs[]`.
3. **FAQ disclosure** — native `<details>` (recommended) vs React `aria-expanded` buttons.
4. **Split hours** — single interval per day in V1 (recommended) vs allow two periods.
5. **Business Hours as a composable section** — Option C-minimal (canonical profile + optional
   presentation section, recommended) vs Option A (Contact auto-displays, no section).
6. **Social scope** — Footer-only (recommended) vs also Contact; typed-enum platforms (recommended)
   vs allowing a generic labeled link.
7. **FAQ JSON-LD** — omit in V1 (recommended, low SEO value + risk) vs emit `FAQPage`.

---

### Verdict: READY FOR IMPLEMENTATION

About and FAQ extend the proven Home-section machinery; Business Hours and Social Links become
canonical `BusinessProfile` data with restrained, reference-only presentation — one source of truth,
no duplication, no migration, no new Preview/publish code, Theme-native rendering, and five small
reviewable slices that each keep the suite green.
