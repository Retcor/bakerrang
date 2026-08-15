STEP 1.12 — SECTION EDITING FOUNDATION

OBJECTIVE

Consolidate the working-copy editing mechanics proven by Hero and Services
without changing CMS behavior, persistence contracts, public APIs, or
publication semantics.

This is primarily a refactor/foundation milestone.

============================================================
1. ZERO DATA MODEL CHANGES
   ============================================================

Do NOT change Firestore persistence.

Working content remains:

tenants/{tenantId}/site/config
tenants/{tenantId}/site/config/pages/home

Published content remains:

tenants/{tenantId}/site/config/published/current

No migration.

No new documents.

No new collections.

============================================================
2. ZERO ROUTE CONTRACT CHANGES
   ============================================================

Preserve exactly:

PATCH /tenants/:tenantId/site/pages/home/sections/hero

PUT /tenants/:tenantId/site/pages/home/sections/services

Do NOT introduce:

/sections/:sectionId

Do NOT change request/response contracts.

============================================================
3. ZERO EDITING SEMANTIC CHANGES
   ============================================================

Hero remains PATCH semantics.

Services remains full-state PUT semantics.

Hero subtitle:

omitted -> preserve
blank -> remove

Services description:

omitted -> absent
blank -> absent

Services item omission:

remove item

Services request order:

display order

Do not unify these behaviors.

============================================================
4. SHARED WORKING-HOME MUTATION MECHANICS
   ============================================================

Inspect Hero and Services implementations for duplicated transactional
persistence.

Prefer extracting a small internal abstraction conceptually equivalent to:

mutateWorkingHome(tenantId, mutator)

Responsibilities of the shared helper:

- obtain config/Home refs
- run Firestore transaction
- read config
- read Home
- perform all reads before writes
- throw existing missing-site error
- throw existing missing-Home error
- invoke section-specific working-Home mutator
- preserve existing Home fields
- set home.updatedAt
- merge config.updatedAt
- use one shared timestamp
- preserve config.status
- preserve publication audit metadata
- return sanitized WORKING SiteDefinition

The helper must NEVER touch published/current.

============================================================
5. MUTATOR CONTRACT
   ============================================================

The section-specific callback should preferably operate on Home content only.

Conceptually:

mutateWorkingHome(tenantId, (home) => {
return {
...home,
sections: changedSections
}
})

The callback should NOT need direct write access to Firestore.

The callback should NOT need publication data.

The callback should NOT mutate config lifecycle state.

Keep the contract small.

Do not build a generic section-command framework.

============================================================
6. HERO SERVICE AFTER REFACTOR
   ============================================================

updateHomeHero remains a distinct operation.

It retains:

Hero validation
PATCH semantics
Hero lookup/invariant logic
content preservation
subtitle semantics

It should delegate only common working-copy persistence mechanics.

No behavioral changes.

============================================================
7. SERVICES SERVICE AFTER REFACTOR
   ============================================================

upsertHomeServices remains a distinct operation.

It retains:

Services validation
PUT semantics
server-generated IDs
existing-item matching
unknown-ID rejection
duplicate-ID rejection
item removal
request ordering
Services section invariant handling
metadata preservation

It should delegate only common working-copy persistence mechanics.

No behavioral changes.

============================================================
8. SECTION IDENTITY HELPERS
   ============================================================

Inspect current duplicated section lookup/invariant code.

Extract only helpers that genuinely improve clarity.

Potential examples:

requireHeroSection(...)
find/validate unique Services section

Do NOT force Hero and Services into one universal invariant function if their
rules are materially different.

Services currently has stronger reserved-identity corruption detection than
Hero; preserve those semantics.

============================================================
9. TYPESCRIPT SECTION TYPE GUARDS
   ============================================================

Inspect:

@bakerrang/site-schema

HeroEditor
ServicesEditor
BusinessWebsite
SectionRenderer

Determine whether shared runtime type guards are appropriate.

Preferred contract if package architecture supports runtime exports:

isHeroSection(section): section is HeroSection

isServicesSection(section): section is ServicesSection

These should check the canonical identity:

Hero:
id === 'hero'
type === 'hero'

Services:
id === 'services'
type === 'services'

Use them where they reduce repeated predicates.

Do not use unsafe casts.

============================================================
10. TYPE GUARD SCOPE
    ============================================================

Do NOT create:

generic isSection<T>()
generic string-to-section casting
dynamic type registries

unless the existing repository demonstrates a concrete need.

Two explicit guards are sufficient.

============================================================
11. HOME PAGE LOOKUP
    ============================================================

Inspect repeated portal logic:

site.pages.find(page => page.slug === '/')

If a small helper such as:

findHomePage(site)

would clearly remove duplication and improve consistency, propose it.

Do not create a large site-query utility library for one expression.

============================================================
12. BACKEND ERROR CONTRACTS
    ============================================================

Preserve existing user-visible API errors.

Refactoring must not unexpectedly change:

404 Site not initialized

500 Site home page missing

Hero validation errors

Services validation errors

Services invariant errors

Unknown item ID errors

etc.

This is a behavior-preserving refactor.

============================================================
13. TIMESTAMP CONTRACT
    ============================================================

Hero and Services saves must still result in:

home.updatedAt === config.updatedAt

for that save.

createdAt values remain unchanged.

Publication timestamps remain unchanged.

============================================================
14. LIFECYCLE CONTRACT
    ============================================================

Editing must continue leaving:

DRAFT -> DRAFT
PUBLISHED -> PUBLISHED

Do not implement:

dirty flags
revision numbers
working revision
published revision

============================================================
15. PUBLICATION BOUNDARY
    ============================================================

The shared mutation helper must have NO reference to:

published/current

Only:

publishSite
unpublishSite
getPublicSite

retain publication responsibilities as currently designed.

A normal content editor must not be capable of modifying the snapshot through
the shared working-copy helper.

============================================================
16. PORTAL BEHAVIOR
    ============================================================

Do not redesign the portal in Step 1.12.

Preserve:

Manage Website

Edit Hero
Add/Edit Services

Publish
Republish
Unpublish

editor modes

saved-vs-live feedback

No visual redesign.

No generic editor.

============================================================
17. SHARED EDITOR UI
    ============================================================

Do NOT extract generic form components merely because HeroEditor and
ServicesEditor both have:

labels
textarea
Save
Cancel

Only extract something if actual code duplication is substantial and the
abstraction remains obviously generic.

Prefer leaving editor-specific UI alone in this milestone.

============================================================
18. RENDERER
    ============================================================

Expected behavioral changes:

NONE

Hero and Services must render exactly as they did in Step 1.11.

Do not redesign components.

Do not alter styling.

============================================================
19. EXISTING TESTS ARE THE PRIMARY REGRESSION CONTRACT
    ============================================================

All Step 1.10 and Step 1.11 behavior tests must remain green.

Especially:

Hero snapshot isolation

Hero subtitle PATCH semantics

Services server-generated IDs

Services ID retention

Services full-state descriptions

Services item removal/order

Services corruption handling

Services snapshot isolation

Publication lifecycle

============================================================
20. ADD TARGETED FOUNDATION TESTS ONLY IF NEEDED
    ============================================================

If the shared working-home helper is exported/testable internally, test:

- missing site
- missing Home
- same timestamp written to Home/config
- config status preserved
- config publication metadata preserved
- published/current untouched

However, do not duplicate dozens of existing Hero/Services tests just to test
the helper separately.

Integration through existing service tests may be sufficient.

============================================================
21. NO TEST COUNT TARGET
    ============================================================

Do not add meaningless tests merely to increase the count.

The purpose is behavioral confidence during refactoring.

============================================================
22. MANUAL DEV SMOKE TEST
    ============================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev
ALLOW_DRAFT_PUBLIC_SITES=false

Use a PUBLISHED site.

After refactor:

1. Edit Hero and Save.
2. Edit Services and Save.
3. Verify portal behavior remains normal.
4. Normal renderer must still show old published values.
5. Enable DEV preview.
6. Renderer must show both working edits.
7. Disable preview.
8. Old published values return.
9. Republish.
10. Both edits become public.

This is sufficient live verification for the refactor.

============================================================
23. OUT OF SCOPE
    ============================================================

Do not implement:

new section types
generic section route
generic editor registry
dynamic forms
section creation framework
section drag/drop
page ordering
service drag/drop
CTA
Gallery
media
Testimonials
Contact section
persistent dirty state
revision tracking
optimistic concurrency
custom domains
SEO
analytics
visual redesign

============================================================
DEFINITION OF DONE
============================================================

Step 1.12 is complete when:

1. Existing Firestore structure is unchanged.
2. Existing HTTP contracts are unchanged.
3. Hero behavior is unchanged.
4. Services behavior is unchanged.
5. Common working-copy transaction mechanics are consolidated where justified.
6. Publication responsibilities remain isolated.
7. Repeated TypeScript section narrowing is consolidated where justified.
8. No premature generic CMS framework appears.
9. Existing backend tests pass.
10. Platform typecheck/lint/build pass.
11. Live Hero + Services editing smoke test passes.