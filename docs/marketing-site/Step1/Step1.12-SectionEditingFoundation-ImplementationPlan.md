Implement Step 1.12 — Section Editing Foundation.

Claude Code inspected the actual repository and produced an approved
behavior-preserving implementation plan.

Follow Claude's repository findings and implementation plan, with the
corrections below taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Consolidate the working-copy editing mechanics now proven by:

- Hero PATCH editing
- Services full-state PUT editing

while preserving ALL existing behavior.

This is a refactor/foundation milestone.

No new website feature is being introduced.

================================================================
1. ZERO EXTERNAL CONTRACT CHANGES
   ================================================================

Do NOT change Firestore paths.

Do NOT change persisted document shapes.

Do NOT change snapshot shape.

Do NOT change HTTP routes.

Preserve:

PATCH /tenants/:tenantId/site/pages/home/sections/hero

PUT /tenants/:tenantId/site/pages/home/sections/services

Preserve request and response contracts exactly.

Authorization/middleware remain unchanged.

================================================================
2. PRESERVE EDITING SEMANTICS EXACTLY
   ================================================================

Hero remains PATCH semantics:

subtitle omitted
-> preserve

subtitle blank
-> remove

subtitle supplied nonblank
-> trim + replace

Services remains full-state PUT semantics:

item omitted
-> remove item

request order
-> resulting order

description omitted
-> absent

description blank
-> absent

existing ID
-> retain identity

new item without ID
-> generate server ID

unknown supplied ID
-> reject

duplicate supplied ID
-> reject

Do not unify these semantics.

================================================================
3. EXTRACT SHARED WORKING-HOME ENVELOPE
   ================================================================

Inside:

server/services/siteService.js

add a NON-EXPORTED helper conceptually:

mutateWorkingHome(tenantId, transformSections)

Keep it private in siteService.js.

The helper should own:

- refsFor(tenantId)
- Date.now()
- Firestore transaction
- config read
- Home read
- missing config error
- missing Home error
- working Home write
- config.updatedAt merge
- shared timestamp
- sanitized working SiteDefinition response

Conceptual shape:

const mutateWorkingHome = async (tenantId, transformSections) => {
const refs = refsFor(tenantId)
const now = Date.now()
let definition

await firestore.runTransaction(async (transaction) => {
const [configSnapshot, homeSnapshot] = await Promise.all([
transaction.get(refs.config),
transaction.get(refs.home)
])

    if (!configSnapshot.exists) {
      throw httpError(404, 'Site not initialized')
    }

    if (!homeSnapshot.exists) {
      throw httpError(500, 'Site home page missing')
    }

    const config = configSnapshot.data()
    const home = homeSnapshot.data()

    const sections = Array.isArray(home.sections)
      ? home.sections
      : []

    const nextSections = transformSections(sections)

    const nextHome = {
      ...home,
      sections: nextSections,
      updatedAt: now
    }

    transaction.set(refs.home, nextHome)

    transaction.set(
      refs.config,
      { updatedAt: now },
      { merge: true }
    )

    definition = toSiteDefinition(
      { ...config, updatedAt: now },
      nextHome
    )
})

return definition
}

Adapt to actual coding style as appropriate.

================================================================
4. READS-BEFORE-WRITES — IMPORTANT
   ================================================================

Do NOT claim FakeDb tests prove this invariant.

FakeDb buffering can hide a read-after-write bug that real Firestore rejects.

Guarantee the invariant through code structure:

ALL transaction.get operations
↓
complete
↓
validation/transformation
↓
FIRST transaction.set
↓
remaining writes

There must be no transaction.get after any transaction.set.

The transform callback receives no transaction object.

Do not add meaningless tests claiming FakeDb enforces this.

================================================================
5. TRANSFORM CALLBACK CONTRACT
   ================================================================

transformSections should be a synchronous content transformation.

Input:

current sections array

Output:

next sections array

It should NOT receive:

transaction
Firestore refs
config
published snapshot
timestamp

Validated Hero/Services input can be captured through closure.

Keep this contract narrow.

Do NOT turn it into a generic command/context object.

================================================================
6. PUBLICATION SAFETY — CORRECT WORDING / DESIGN
   ================================================================

The helper must reference only:

refs.config
refs.home

It must NOT reference:

refs.published

Its config write must remain exactly equivalent to:

{ updatedAt: now }

with merge enabled.

Therefore it must not alter:

status
createdAt
createdByUserId
lastPublishedAt
lastPublishedByUserId
lastUnpublishedAt
lastUnpublishedByUserId

IMPORTANT:

Do not describe this as publication mutation being literally "physically
impossible."

Because callbacks live in the same JavaScript module, module-scoped symbols
technically remain lexically accessible.

The architectural guarantee is:

- publication handles are NOT part of the mutator API
- the helper itself never touches published/current
- content transforms are intentionally written as pure array transforms
- publication/lifecycle responsibilities remain isolated to dedicated
  functions

This strongly reduces accidental coupling.

Do not attempt to add artificial runtime sandboxing.

================================================================
7. HERO LOOKUP HELPER
   ================================================================

Extract the genuinely duplicated backend helper:

requireHeroIndex(sections)

Canonical identity:

id === 'hero'
&&
type === 'hero'

If absent:

500 Home hero section missing

Use it in:

updateHomeHero

and the Services initial-insertion path.

Do not create a generic section locator.

================================================================
8. HERO REFACTOR
   ================================================================

Keep:

updateHomeHero(tenantId, input)

exactly.

Keep current validation unchanged.

After validation:

return mutateWorkingHome(tenantId, (sections) => {
// existing Hero transformation
})

Preserve:

Hero canonical lookup
PATCH subtitle semantics
ctaLabel preservation
unknown content preservation
section metadata
section array position
siblings

No behavior changes.

================================================================
9. SERVICES REFACTOR
   ================================================================

Keep:

upsertHomeServices(tenantId, input)

exactly.

Keep current validation unchanged.

After validation:

return mutateWorkingHome(tenantId, (sections) => {
// existing Services transformation
})

Preserve VERBATIM in behavior:

reserved identity corruption detection

server-generated IDs

stored item lookup

unknown ID rejection

duplicate ID behavior

full-state removal

request ordering

description semantics

item metadata preservation

section/content metadata preservation

insert-after-Hero behavior

existing-position preservation

Do NOT simplify the Services invariant scan.

================================================================
10. LIFECYCLE OPERATIONS
    ================================================================

Do NOT refactor into mutateWorkingHome:

publishSite
unpublishSite

They intentionally write lifecycle/publication fields.

Do not change their behavior.

Do not change:

getSite
getPublicSite
initializeSite

unless a mechanical import/type change is genuinely required.

================================================================
11. SHARED TYPESCRIPT TYPE GUARDS
    ================================================================

Claude verified @bakerrang/site-schema safely supports runtime exports.

Add:

isHeroSection(section): section is HeroSection

Canonical check:

section.id === 'hero'
&&
section.type === 'hero'

Add:

isServicesSection(section): section is ServicesSection

Canonical check:

section.id === 'services'
&&
section.type === 'services'

No unsafe casts.

Do NOT introduce:

generic isSection<T>
type registry
string-to-section casting
dynamic section lookup framework

================================================================
12. HOME PAGE ACCESSOR — NAMING OVERRIDE
    ================================================================

Add to @bakerrang/site-schema:

findHomePage(site): SitePage | undefined

NOT:

getHomePage

Implementation conceptually:

export const findHomePage = (
site: SiteDefinition
): SitePage | undefined =>
site.pages.find((page) => page.slug === '/')

The name "find" intentionally communicates that absence is valid.

================================================================
13. ADOPT SHARED HELPERS
    ================================================================

Use:

findHomePage

and the appropriate section type guards in:

HeroEditor.tsx
ServicesEditor.tsx
BusinessWebsite.tsx

Also adopt:

findHomePage

in:

site-renderer/app/site/[tenantId]/page.tsx

Preserve:

if (!home) notFound()

behavior exactly.

Do NOT change SectionRenderer's discriminated-union switch.

Its switch is already the appropriate narrowing mechanism.

================================================================
14. PORTAL BEHAVIOR
    ================================================================

No UX changes.

Preserve exactly:

Manage Website

Edit Hero
Add/Edit Services

Publish
Republish
Unpublish

editor modes

save/cancel behavior

working-vs-live feedback

No generic editor registry.

No UI redesign.

================================================================
15. DATA COMPATIBILITY
    ================================================================

Persisted writes after refactor must remain equivalent to Step 1.11:

Home:

{
...existingHome,
sections: nextSections,
updatedAt: now
}

Config:

merge {
updatedAt: sameNow
}

No migration.

No new Firestore docs.

No new collections.

No new fields.

================================================================
16. TIMESTAMP CONTRACT
    ================================================================

Every Hero or Services save must still satisfy:

home.updatedAt === config.updatedAt

Use one Date.now() value owned by mutateWorkingHome.

Do not alter createdAt.

Do not alter publication audit timestamps.

================================================================
17. TEST STRATEGY
    ================================================================

Existing behavioral tests are the primary regression contract.

Must remain green:

Hero validation
Hero PATCH semantics
Hero metadata preservation
Hero timestamps
Hero status preservation
Hero snapshot isolation

Services validation
Services full-state PUT semantics
Services generated IDs
Services ID retention
Services unknown/duplicate ID rejection
Services removal/order
Services description semantics
Services corruption invariant
Services timestamps
Services status preservation
Services snapshot isolation

Publish lifecycle
Preview behavior

Do NOT duplicate the suites solely because a helper was extracted.

================================================================
18. TARGETED AUDIT-FIELD ASSERTION
    ================================================================

Inspect whether current tests explicitly prove that content editing preserves:

lastPublishedAt
lastPublishedByUserId

and other publication metadata.

If equivalent coverage already exists:

do nothing.

If there is a genuine gap, add ONE targeted assertion/test around an edit after
publication proving publication audit metadata remains unchanged.

Do not add tests just to increase count.

================================================================
19. TYPESCRIPT / FRONTEND TESTING
    ================================================================

No frontend test framework.

Type guards/accessor are simple and should be gated through:

typecheck
lint
build

Do not introduce a test framework for these helpers.

================================================================
20. FILES EXPECTED TO CHANGE
    ================================================================

Expected:

server/services/siteService.js

platform/packages/site-schema/src/index.ts

platform/apps/portal/app/businesses/HeroEditor.tsx

platform/apps/portal/app/businesses/ServicesEditor.tsx

platform/apps/portal/app/businesses/BusinessWebsite.tsx

platform/apps/site-renderer/app/site/[tenantId]/page.tsx

Possibly:

server/test/siteService.test.js

ONLY if the publication audit metadata assertion is genuinely missing.

================================================================
21. FILES EXPECTED UNCHANGED
    ================================================================

server/routes/tenants.js

server/app.js

server public-site router/config

portal/lib/site.ts
portal/lib/api.ts

SectionRenderer.tsx

Hero.tsx
Services.tsx

UI package

Firestore paths/configuration

Do not change these without a concrete compilation requirement.

================================================================
22. ROUTE/API COMPATIBILITY
    ================================================================

Explicitly verify:

PATCH Hero route unchanged

PUT Services route unchanged

PLATFORM_ADMIN authorization unchanged

CSRF unchanged

tenant limiter unchanged

request bodies unchanged

response SiteDefinition unchanged

No API client changes.

================================================================
23. FIRESTORE/PUBLICATION COMPATIBILITY
    ================================================================

Explicitly verify:

working Home shape unchanged

config shape unchanged except normal updatedAt

published/current shape unchanged

content editing never touches published/current

normal public reads still use published snapshot

DEV preview still uses working copy

Republish still snapshots the changed sections

================================================================
24. VERIFY
    ================================================================

Backend:

cd server
npm test

Run StandardJS/syntax verification on changed backend files according to the
existing repo conventions.

Do not fix unrelated lint debt.

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

Everything must remain green.

================================================================
25. MANUAL DEV SMOKE TEST
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev
ALLOW_DRAFT_PUBLIC_SITES=false

Use a PUBLISHED site.

1. Manage Website.
2. Edit Hero.
3. Save.
4. Edit Services.
5. Save.

Expected:
portal behavior identical to Step 1.11.

6. Normal renderer:

old published Hero
old published Services

7. Set:

ALLOW_DRAFT_PUBLIC_SITES=true

Restart API.

8. Renderer:

new working Hero
new working Services

9. Restore:

ALLOW_DRAFT_PUBLIC_SITES=false

Restart API.

10. Renderer:

old published content

11. Republish.

12. Renderer:

both new edits now public.

13. Confirm only bakerrang-dev changed.

No broader manual E2E is required for this refactor.

================================================================
26. OUT OF SCOPE
    ================================================================

Do not implement:

new section type

generic section route

generic section API

validator registry

editor registry

dynamic forms

section creation framework

ordering model

drag/drop

CTA

Gallery

media

Testimonials

Contact

dirty-state persistence

revisions

optimistic concurrency

domains

SEO

analytics

visual redesign

================================================================
27. FINAL REPORT
    ================================================================

Report:

1. Files modified.
2. mutateWorkingHome exact implementation.
3. requireHeroIndex implementation.
4. Hero behavior-preservation confirmation.
5. Services behavior-preservation confirmation.
6. Publication-boundary confirmation.
7. Explicit note that reads-before-writes is guaranteed by structure, not
   FakeDb testing.
8. Shared type guards added.
9. findHomePage added and adopted.
10. Route/API compatibility.
11. Firestore/data compatibility.
12. Any targeted test added and why.
13. Backend test results.
14. Platform typecheck/lint/build.
15. Manual DEV smoke test if performed.
16. Deviations and why.
17. Any insight relevant to the next content milestone.

Do not implement beyond Step 1.12.