# Step 3.3a — Multi-Page Foundation, Backend & Renderer

Implement ONLY Step 3.3a.

Do NOT implement the Portal Pages Manager yet.
That is Step 3.3b after audit.

Step 3 remains intentionally on the existing Step3 branch / PR.

Current expected baseline from Claude's planning audit:

Branch:
Step3

HEAD:
0dd323d

Step 3.0 / 3.1 / 3.2:
committed

Server:
337 passed

Renderer:
62 passed

UI:
9 passed

Portal:
current committed baseline green

Typecheck/lint:
clean

Verify actual current state before implementation.

Do NOT reset/discard the existing Step 3.3 planning/spec document.

Do NOT deploy.
Do NOT mutate Firestore/GCP.
Do NOT perform a manual data transition.
Do NOT modify infrastructure.
Do NOT add dependencies.

---

# 1. Core architecture

Implement multi-page working storage using:

tenants/{tenantId}/site/config

with canonical:

pageOrder: [
'home',
'<uuid>',
'<uuid>'
]

and page documents:

tenants/{tenantId}/site/config/pages/home

tenants/{tenantId}/site/config/pages/{pageId}

Published remains ONE coherent snapshot:

tenants/{tenantId}/site/config/published/current

{
siteDefinition: {
...globalSiteData,
pages: [...]
},
...
}

Do NOT create per-page published documents.

Do NOT create a generation-pointer architecture.

---

# 2. Backward compatibility for existing Home-only sites

Existing marketing sites currently have:

site/config/pages/home

but may have no:

config.pageOrder

Treat:

missing pageOrder

as:

['home']

This is the only compatibility behavior required.

Do NOT create a migration job.

Do NOT scan/mutate all tenant documents.

No Firestore writes merely from reading an old site.

Persist pageOrder naturally when a page-membership operation requires config
mutation.

Published snapshots already containing:

pages: [home]

remain valid.

---

# 3. Page identity

Home:

id:
'home'

document id:
'home'

route:
'/'

Home identity MUST NOT depend primarily on:

slug === '/'

Update helpers such as `findHomePage` to prefer:

page.id === 'home'

and enforce the Home invariant.

Non-Home pages:

id:
server-generated randomUUID()

document id:
same UUID

slug:
mutable URL field

Never use slug as page identity.

Never use title as page identity.

---

# 4. Page schema

Canonical SitePage remains conceptually:

{
id: string
slug: string
title: string
sections: SiteSection[]
}

Do NOT add:

hidden
navigationLabel
seoTitle
seoDescription
navigation metadata
per-page Theme
per-page Branding

Page visibility belongs later.

Navigation belongs 3.4.

SEO belongs 3.5.

---

# 5. Page ordering / membership

`config.pageOrder` is authoritative for:

- which working Page documents belong to the site
- Portal organization order
- publish ordering

It is NOT the future navigation model.

Home:

must exist
must be pageOrder[0]
cannot move

Missing pageOrder:
normalize logically to ['home']

When reading:

- page doc not in pageOrder → ignore/orphan
- pageOrder id with missing page doc → integrity error, not silent omission

Do not silently create missing Page docs.

---

# 6. Page count limit

Enforce:

MAX_PAGES = 25

server-side during Create Page.

This includes Home.

This is a real product/storage safety limit, not merely Portal UX.

Return a useful validation error.

No low section-count limit is added.

---

# 7. Published snapshot size guard

Published/current is subject to Firestore's document-size limit.

Before writing the new published snapshot:

perform a conservative application-level size guard on the serialized snapshot.

Do NOT try to reproduce Firestore's exact wire encoding.

Choose a defensible safety threshold below 1 MiB and centralize it as a named
constant.

The goal is to fail with a clear application validation error rather than a raw
Firestore document-too-large failure.

Report:

- chosen threshold
- rationale
- what object is measured

Do not add a dependency for this.

---

# 8. Slug rules

Non-Home slug canonical format:

- lowercase
- ASCII
- characters: a-z 0-9 -
- no leading hyphen
- no trailing hyphen
- no consecutive hyphens
- 1..60 chars

Portal generation comes later in 3.3b.

Server should VALIDATE canonical input.

Do not silently rewrite arbitrary strings server-side.

Provide a small reusable helper such as:

validatePageSlug

and, if useful for tests/future Portal parity:

slugifyPageTitle

but server CRUD should not silently surprise the caller.

---

# 9. Reserved slugs — IMPORTANT

Because the special `/contact` route will be REMOVED:

`contact` MUST BE A VALID NORMAL PAGE SLUG.

Do NOT reserve `contact`.

Determine actual syntactically-valid root route collisions from the current
Next.js app.

At minimum likely reserve:

preview
site

Reserve `api` only if it is actually a meaningful collision / protected
namespace.

Do not add entries such as:

favicon.ico
robots.txt
sitemap.xml
_next
.well-known

to a slug-reserved list merely for ceremony when the canonical slug regex already
makes those values impossible.

Tests should cover the ACTUAL reserved set.

---

# 10. Slug uniqueness

Slug uniqueness is per tenant/site.

Server-authoritative.

Case-insensitive effectively follows from canonical lowercase requirement.

For Create Page and Change Slug:

inside the transaction:

- read config/pageOrder
- read the relevant existing page docs required to verify uniqueness
- reject duplicate slug

Do not rely on Portal/client checks.

Home `/` cannot collide.

No auto `-2` behavior.

Duplicate slug returns a clear validation/conflict response.

---

# 11. Page CRUD service

Implement backend support for:

Create Page
Update Page settings
Move Page
Delete Page

Conceptual contracts:

POST /tenants/:tenantId/site/pages
{
title,
slug
}

→

201 {
site,
pageId
}

The exact created pageId MUST be returned.

Never infer it client-side.

PATCH /tenants/:tenantId/site/pages/:pageId
{
title?,
slug?
}

→ {
site
}

POST /tenants/:tenantId/site/pages/:pageId/move
{
direction: 'up' | 'down'
}

→ {
site
}

DELETE /tenants/:tenantId/site/pages/:pageId

→ {
site
}

Follow existing route naming/conventions if they differ slightly.

All mutations:

- tenant scoped
- existing site-edit authentication
- CSRF
- transactional
- server response authoritative

No optimistic identity inference.

---

# 12. Home restrictions

Server MUST enforce:

Home cannot be deleted.

Home cannot move.

Home slug cannot change from `/`.

Home remains index 0.

Home title:

FIXED as:

Home

for Step 3.3.

Do not expose/update Home title through page settings.

If PATCH tries to rename Home, reject or ignore according to existing API
validation convention; prefer clear rejection.

3.4/3.5 can revisit labels/metadata.

---

# 13. Creating a Page

Create Page:

- server UUID page id
- title supplied
- canonical unique slug supplied
- zero sections
- inserted after current last page in pageOrder
- createdAt/updatedAt according to existing conventions

Do NOT fabricate an About section.

Do NOT create a Hero.

Non-Home pages may validly have:

sections: []

---

# 14. Empty Page behavior

Allow a non-Home page with zero sections.

It may also be published.

Renderer should produce the normal themed SiteShell/page wrapper with no content,
not crash.

Do not add a page-level publish validation system.

---

# 15. Delete Page semantics

Only non-Home pages may be deleted.

Delete transaction:

- verify page belongs to config.pageOrder
- delete Page document
- remove pageId from pageOrder

Do NOT delete media.

Do NOT modify published/current.

Before Publish:

old published page remains live.

After Publish:

deleted page disappears from published snapshot and route returns 404.

---

# 16. Page move semantics

Home remains pinned at index 0.

Non-Home Page:

Move Up
Move Down

operate on pageOrder.

Do not make page order equal a navigation contract.

No drag/drop.

No page duplication.

---

# 17. Page duplication explicitly deferred

Do NOT implement:

duplicatePage

No duplicate endpoint.

No Portal support.

Future work.

---

# 18. Page visibility explicitly deferred

Do NOT add:

hidden
published
visible

to individual pages.

Working/published already provides draft semantics.

Removal is:

delete working
→ publish

No extra page visibility state.

---

# 19. Cross-page section movement deferred

Do NOT add:

moveSectionToPage
copySectionToPage

Section commands operate within one page only.

---

# 20. Generalize Home section mutation

Current Home-only seam:

mutateWorkingHome

should become a generic:

mutateWorkingPage(
tenantId,
pageId,
...
)

or equivalent clean architecture.

Do NOT retain two complete parallel implementations.

Generalize:

addSection
removeSection
moveSection
duplicateSection
setSectionVisibility
updateSectionContent

to accept Page ID.

Generic section route path should be based on:

/site/pages/:pageId/...

not hard-coded `home`.

Home uses:

pageId = 'home'

through the same generic path.

---

# 21. Preserve working-status semantics carefully

Audit how current:

status
hasUnpublishedChanges
updatedAt
lastPublishedAt

are computed.

Do NOT casually remove existing config writes merely to reduce transaction
contention.

Correctness and existing Portal state semantics come first.

If every Page section mutation still needs to update config/status, that modest
contention is acceptable for BakerRang's operator scale.

If the current model can safely avoid touching config on every Page content edit
without changing semantics, report and use the simpler correct approach.

Do not redesign dirty/publish status architecture in 3.3a.

---

# 22. Hero placement rule

Hero remains HOME ONLY.

Composition validation becomes page-aware.

Home:

- exactly one Hero
- Hero index 0
- visible
- cannot remove
- cannot move
- cannot duplicate
- cannot hide

Non-Home:

- Hero is forbidden
- zero sections valid

Server must enforce this.

Do not rely only on the future Portal UI.

---

# 23. Contact / Business Hours multiplicity

Existing singleton behavior becomes PAGE-SCOPED.

Contact:

at most one per Page

Business Hours:

at most one per Page

Hero:

at most/exactly one per Page through Home-specific rule,
and forbidden on all non-Home Pages

It is valid to have:

Home Contact
+
Contact-page Contact

It is valid to have Business Hours on more than one Page.

Business Hours remains a projection of global business-profile hours.

No duplicate hours storage.

---

# 24. Retire the special `/contact` page — IMPORTANT

Current special `/contact` behavior must be removed.

Delete/retire the hard-coded renderer route variants corresponding to:

custom-domain /contact
shared-host /site/:tenantId/contact
preview special contact route

There must no longer be a special Contact PAGE concept.

`contact` remains a SECTION type.

A normal generic Page may use slug:

contact

and contain:

contact section

This becomes the normal Contact Page.

---

# 25. Lead-form behavior after special route removal

Today lead eligibility is reportedly tied to:

published Home contains one contact section with action.type === 'leadForm'

Generalize eligibility to:

ANY published Page contains a Contact section whose:

action.type === 'leadForm'

Keep the existing lead POST endpoint.

Do NOT add page attribution fields to leads in 3.3.

Keep:

source: WEBSITE

No new lead endpoint.

---

# 26. Contact section rendering

Because the special lead-form page is removed:

a Contact section configured with:

action.type === 'leadForm'

must work when rendered INLINE through the normal generic Page renderer.

Audit current Contact rendering.

If today Home's Contact section renders only a CTA linking to `/contact`,
generalize it so the lead-form action renders the actual form in the section
itself.

This may intentionally change current test-site Home behavior.

No real customer marketing sites exist.

Do not keep a hidden `/contact` dependency.

Email/phone/url Contact actions retain their existing safe behavior.

Add direct tests for all four ContactAction variants after this refactor.

---

# 27. Link/CTA behavior

Existing CTA/About:

LinkAction

behavior remains unchanged.

No special `/contact` URL generation should remain in SiteShell or Contact
rendering.

Search production source for hard-coded:

'/contact'
"/contact"

and classify/remove marketing-site special-route dependencies.

Do not remove unrelated strings blindly.

---

# 28. Read working SiteDefinition

Generalize working site assembly:

config
+
pageOrder
+
every Page document named by pageOrder

→

SiteDefinition.pages

ordered according to pageOrder.

Missing pageOrder:

['home']

Page IDs listed but missing:

integrity error

Unlisted orphan Page document:

ignored

Do not list the Firestore subcollection dynamically as membership authority.

pageOrder is authoritative.

---

# 29. Publish all Pages atomically

Publish remains one site-wide operation.

Inside ONE Firestore transaction:

- read config/pageOrder
- read every working Page document in pageOrder
- validate composition/integrity
- assemble one coherent SiteDefinition
- enforce snapshot-size safety limit
- write published/current

A concurrent write to ANY Page read by Publish must cause transaction retry.

The final published snapshot must never contain mixed versions from two
different working states.

No per-page Publish.

---

# 30. Published snapshot deletion behavior

Publishing after a working Page deletion must replace the snapshot such that the
deleted Page is absent.

No stale published Page documents exist because published state is embedded.

Test:

publish Home+A+B
delete B working
live still has B
publish
snapshot has Home+A
B route → 404

---

# 31. Media scanner — LOAD-BEARING

Existing page-array media functions reportedly already iterate all
`definition.pages`.

Confirm this independently.

Functions such as:

collectSiteMediaIds
collectMediaLocations
hydrateSiteMedia

should remain page-generic.

Do NOT build:

scanHome()
scanOtherPages()

The main working-state seam to generalize is reportedly:

readWorkingAndPublishedDefinitions

or equivalent.

Update it so working SiteDefinition includes EVERY Page from pageOrder.

---

# 32. Media deletion transaction — CRITICAL

Deletion must remain race-safe.

Inside the media usage/deletion transaction:

- read config/pageOrder
- read every working Page document named by pageOrder
- read published/current
- construct working/published SiteDefinitions
- scan every Page/section, including hidden sections

This read set is REQUIRED.

Why:

if concurrent Page B update starts referencing media while deletion is underway,
Page B is in deletion transaction's read set.

Its version changes.

Firestore conflict/retry occurs.

Deletion then sees the new reference and refuses.

Do NOT implement a pre-transaction page scan.

Do NOT read only the page that "probably" owns the media.

Do NOT weaken the pending-deletion architecture.

---

# 33. Concurrent page creation and media deletion

Page creation mutates:

config.pageOrder

The deletion transaction reads config/pageOrder.

Therefore concurrent creation must also conflict/retry appropriately.

Add a focused deterministic race test if useful.

---

# 34. Media tests across Pages

Directly test:

working Home media protects
working Page A media protects
working Page B media protects
hidden section on Page B protects
published Page B protects
same media on Page A + B protects
deleting Page A working does not free media if Page B still references it
deleting Page A working still leaves published Page A reference protected until
next Publish
after Publish removes all refs, deletion may proceed
concurrent Page B write vs media deletion retries safely

Use existing FakeDb transaction interleave machinery.

Do not substitute mocked sequential tests.

---

# 35. Public API strategy

Keep current whole-site public API.

Do NOT add per-slug backend endpoint in 3.3a.

Published response includes:

pages: [...]

Renderer selects the requested Page locally.

At max 25 Pages this is acceptable and keeps:

- caching simple
- Preview simple
- SiteShell global data coherent

Renderer remains Firestore-free.

---

# 36. Working Preview API

Keep the existing preview-token protected whole-working-site API.

No direct Firestore use.

Preview page selection happens in Renderer from:

working SiteDefinition.pages

using PAGE ID.

Public routes use slug.

---

# 37. Preview route identity — IMPORTANT

Do NOT make Preview's identity depend on slug.

Use immutable:

pageId

Conceptually:

/preview/:tenantId/page/:pageId

or the equivalent that fits the current Next app hierarchy.

Existing Home Preview may remain:

/preview/:tenantId

if maintaining it is materially simpler, but generic Page Preview must use
pageId.

Preferred clean direction:

Home can also resolve through pageId='home'.

Unknown pageId → notFound.

A working slug change must not break Preview identity.

---

# 38. Public renderer routes

Public:

Home:
/

Non-Home:
/:slug

Shared-host equivalent:

/site/:tenantId
/site/:tenantId/:slug

Custom domain:

/
/:slug

Unknown published slug:

404

Do NOT fallback to Home.

Do NOT expose working-only Page existence from public routes.

---

# 39. Reserved route collision

Because `contact` is now generic, it is allowed.

Determine the exact syntactically-valid root route conflicts in the actual
Next.js route tree.

At minimum likely:

preview
site

Possibly:

api

if actually relevant.

Do not reserve invalid-slug strings simply because they correspond to files such
as:

favicon.ico
robots.txt
sitemap.xml
_next
.well-known

Report final exact reserved set and why each is necessary.

---

# 40. Public page resolution

Introduce a clean helper such as:

findPageBySlug(site, slug)

and:

findPageById(site, pageId)

Home:

find by id === 'home'

Public non-Home resolution:

canonical slug

Avoid repeatedly hand-writing:

site.pages.find(...)

through every route.

---

# 41. Generic PublicPage renderer

Generalize existing public rendering so any SitePage can render through one
component.

Conceptually:

<PublicPage
site={site}
page={page}
/>

It should render:

SiteShell
page.sections
global Theme
global Branding/Profile
Custom CSS

Do NOT create one component per page title/slug.

Home may remain a thin wrapper if useful, but no duplicate rendering stack.

---

# 42. SiteShell navigation boundary — IMPORTANT

DO NOT implement multi-page public navigation in 3.3.

Step 3.4 owns Header / Navigation / Footer.

Do not automatically list every Page in the SiteShell header.

Instead:

- preserve/generalize the EXISTING section-level auto-navigation behavior only
  where it remains coherent
- it must reference the ACTIVE PAGE's sections, not always Home's sections
- no link from Home → About/Services/etc is automatically invented by 3.3

For a non-Home Page, section-level anchor links may target that Page's sections
if the current SiteShell architecture naturally supports that.

Direct public URLs and Portal Preview are sufficient for 3.3 manual testing.

3.4 will introduce the real page navigation model.

---

# 43. Remove special Contact nav handling

Current SiteShell reportedly sends leadForm Contact to:

/contact

Remove that special behavior.

A Contact section is now part of the active Page.

Section-level navigation should target its normal section anchor when relevant.

No hard-coded contact route.

---

# 44. Sitemap regression fix

Current sitemap only emits Home.

Multi-page routing would make that incorrect.

Update existing sitemap generation to enumerate every PUBLISHED Page:

Home:
/

Non-Home:
/<slug>

Use existing canonical/custom-domain infrastructure.

Do NOT add SEO editing.

Do NOT generate working pages.

This is maintaining existing sitemap correctness under the new architecture.

---

# 45. Metadata regression fix

Current metadata reportedly has:

homeMetadata
contactMetadata

Generalize minimally so any published Page gets appropriate basic metadata.

Page title may be used for the browser/page title.

Do NOT add:

SEO title editor
description editor
social image editor

Those remain Step 3.5.

Remove special Contact metadata that exists solely for the retired route.

---

# 46. Custom CSS Page hook

Add a stable immutable page-level hook.

Preferred:

data-br-page="<pageId>"

on the Page-level/SiteShell wrapper.

Do NOT make mutable slug the only styling identity.

Do NOT add a mutable:

data-br-page-slug

unless there is a concrete need.

Document:

[data-br-page="<page-id>"]

in:

Step3.1-AdvancedStyling.md

Preserve all existing Theme cascade guidance.

---

# 47. Theme / Branding / Profile

Remain GLOBAL.

No per-page Theme.

No per-page logo/favicon.

No per-page business profile.

No per-page social profile.

No Theme schema change.

---

# 48. Published snapshot size test/guard

Add tests for:

- snapshot below app safety threshold publishes
- snapshot over app safety threshold rejects cleanly
- published/current remains unchanged on rejection

Do not rely solely on Firestore throwing.

---

# 49. Page CRUD tests

Server:

Create:
- exact UUID returned
- pageOrder updated
- zero sections
- limit 25
- duplicate slug rejected
- noncanonical slug rejected
- reserved slug rejected
- `contact` ACCEPTED

Update:
- title
- slug
- title change does NOT mutate slug
- slug uniqueness
- Home title change rejected
- Home slug change rejected

Move:
- normal Page up/down
- Home pinned
- boundaries safe

Delete:
- normal Page
- Home rejected
- published unchanged before Publish

Tenant isolation.

Unknown page id handling.

---

# 50. Section composition tests

Non-Home Page:

- zero sections valid
- Hero rejected
- add section
- update
- move
- duplicate
- hide/show
- remove

Contact:
at most one PER PAGE

BusinessHours:
at most one PER PAGE

Two different Pages may each contain:

Contact
BusinessHours

Home Hero invariant remains unchanged.

---

# 51. Publish tests

Test:

Home + Page A + Page B

are all captured in one Publish.

Test concurrent Page modification during Publish causes retry/coherent snapshot.

Test slug working/public matrix:

published:
/services

working change:
/our-services

before publish:
/services → live
/our-services → not live

after publish:
/services → 404
/our-services → live

No redirects.

---

# 52. Lead tests

After special Contact removal test:

Home leadForm Contact:
lead allowed

Normal `/contact` Page leadForm Contact:
lead allowed

Another Page leadForm Contact:
lead allowed

No published leadForm Contact anywhere:
lead rejected according to existing behavior

Working-only leadForm Contact:
must NOT make public lead endpoint eligible

Contact email/phone/url behavior remains valid.

---

# 53. Renderer tests

Test:

custom-domain Home
custom-domain generic slug
shared-host Home
shared-host generic slug
Preview by pageId

Unknown public slug:
404

Unknown Preview pageId:
404

No working page leaks publicly.

Generic page:

Theme
Custom CSS
sections
media

all render.

Retired special `/contact` routes no longer have special behavior.

A normal generic Page with slug `contact` MUST render.

---

# 54. No runtime client JS requirement

Generic Pages should remain SSR/static-renderable according to current renderer
patterns.

Do NOT add client runtime routing.

No SPA page router.

No dependency.

---

# 55. Security

Page mutations retain:

requirePlatformAdmin
tenant scoping
CSRF

Slug validation prevents:

..
slashes
encoded path components
arbitrary routes

Public slug resolution operates only inside the already-resolved tenant site.

Preview remains token protected.

Public only consumes published state.

No new HTML/CSS injection surface.

---

# 56. Classifier expectation

Expected Step 3.3a/full Step3 branch impact:

api=true
renderer=true

Shared schema may also trigger:

portal=true

even though Portal functionality is intentionally deferred to 3.3b.

Client:
false

Unknown:
[]

Report actual result.

Do NOT weaken classifier rules.

---

# 57. Full verification

Run:

Server:
- full tests
- lint

Platform:
- Portal tests
- Renderer tests
- UI tests
- typecheck
- lint

CI:
- classifier/workflow tests
- changed-path classifier

Quality:
- git diff --check
- credential/secret scan

No deploy.
No Firestore/GCP mutation.

---

# 58. Final report

Return:

1. actual baseline
2. files created
3. files modified/deleted
4. exact working Firestore model
5. pageOrder/backward compatibility
6. Page identity
7. Page schema
8. Page limit
9. published-snapshot size limit
10. final slug rules
11. final reserved slug set
12. confirmation `contact` slug allowed
13. Page CRUD
14. Home restrictions
15. mutateWorkingPage generalization
16. Hero placement
17. Contact/BusinessHours per-page semantics
18. special /contact retirement
19. inline leadForm Contact behavior
20. lead eligibility
21. working SiteDefinition assembly
22. Publish atomicity
23. media scanner generalization
24. media deletion race behavior
25. multi-page media tests
26. public API
27. public routes
28. Preview route by pageId
29. generic PublicPage
30. SiteShell navigation boundary
31. sitemap changes
32. metadata changes
33. Custom CSS page hook
34. Theme/Branding result
35. data-transition result
36. Page CRUD test results
37. composition test results
38. Publish/concurrency tests
39. lead tests
40. renderer route tests
41. media/race tests
42. server totals
43. Portal/Renderer/UI totals
44. skipped counts
45. typecheck/lint
46. classifier/workflow result
47. git diff --check
48. secret scan
49. confirmation no cloud/data/deploy mutation
50. blockers
51. whether Step 3.3a is ready for post-implementation audit

Explicitly answer:

Are Page IDs independent of slugs?

Does Home remain id `home`?

Is Home the only Page allowed to contain Hero?

Are Contact and Business Hours singleton per Page?

Can two Pages each contain their own Contact section?

Can a normal Page use slug `contact`?

Does any hard-coded special `/contact` renderer behavior remain?

Can a Contact leadForm render inline on a generic Page?

Is public lead eligibility based on ANY published Page?

Are working Pages separate documents?

Is pageOrder authoritative?

Is missing pageOrder naturally treated as ['home']?

Are published Pages stored in one coherent snapshot?

Is there a 25-page server cap?

Is there an application-level published-snapshot size guard?

Does Publish read every working Page transactionally?

Does media deletion read every working Page transactionally?

Does a concurrent Page media-reference write force media-deletion retry?

Does changing a working slug affect live before Publish?

Are old slugs redirected?
Expected: NO.

Does Preview use pageId identity?

Did 3.3a add cross-page navigation?
Expected: NO.

Did 3.3a add page duplication?
Expected: NO.

Did 3.3a add page visibility?
Expected: NO.

Did 3.3a add cross-page section move/copy?
Expected: NO.

Were any new Theme fields added?
Expected: NO.

Were any dependencies added?
Expected: NO.

Was any manual data transition performed?
Expected: NO.