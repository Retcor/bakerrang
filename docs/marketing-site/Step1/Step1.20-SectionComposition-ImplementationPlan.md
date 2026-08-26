Implement Step 1.20 — Section Composition, Ordering & Removal.

Claude Code inspected the shipped repository and produced an approved plan.

Follow Claude's plan, with the corrections below taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Add Home-page composition management for PLATFORM_ADMIN.

Users can:

- view currently-present sections
- reorder optional sections
- remove optional sections locally
- Save Layout
- Cancel

Home.sections remains the SINGLE source of truth for:

- section existence
- section order
- render order

No second ordering model.

================================================================
1. PRODUCT MODEL
   ================================================================

Hero:

required
exactly one
fixed at index 0
non-removable
non-reorderable

Optional, removable, reorderable anywhere AFTER Hero:

Services
Gallery
Testimonials
Contact

Contact is no longer special in composition ordering.

It may be moved anywhere after Hero.

Its existing FIRST-CREATION insertion behavior remains unchanged.

================================================================
2. CANONICAL SECTION SET
   ================================================================

Composition recognizes exactly:

hero
services
gallery
testimonials
contact

Add a module-private canonical set in siteService:

const CANONICAL_SECTION_IDS = new Set([
'hero',
'services',
'gallery',
'testimonials',
'contact'
])

This is composition validation infrastructure only.

Do NOT refactor every existing section endpoint to use it.

When a future canonical section is introduced, this set must be updated in
the same change.

================================================================
3. SOURCE OF TRUTH
   ================================================================

Home.sections array is the only ordering/composition model.

Do NOT add:

sectionOrder
layout document
position field
sort index
hidden flags
parallel id arrays

The actual persisted array order is the render order.

================================================================
4. ENDPOINT
   ================================================================

Add:

PUT /tenants/:tenantId/site/pages/home/composition

Authorization:

requirePlatformAdmin

No public mutation route.

No DELETE route.

Request:

{
"sectionIds": [
"hero",
"gallery",
"testimonials",
"contact"
]
}

Response:

updated hydrated working SiteDefinition

consistent with existing CMS mutations.

================================================================
5. COMPOSITION SEMANTICS
   ================================================================

The request is the COMPLETE desired composition of CURRENTLY-EXISTING
authoritative sections.

It may:

- reorder existing sections
- remove optional existing sections through omission

It may NOT:

- create a missing section
- modify section content
- fabricate section identities
- edit item ids
- modify Media
- modify Leads
- modify published/current

Existing section editors remain solely responsible for creation/content.

================================================================
6. REQUEST VALIDATION
   ================================================================

Validate body.sectionIds.

Required:

array

Each entry:

string
non-empty
canonical section id

Reject:

missing
non-array
non-string
empty/whitespace
duplicate ids
noncanonical ids

Do NOT trim/coerce IDs into valid identities.

For example:

" hero "

should not become:

"hero"

It should fail.

Maximum length:

CANONICAL_SECTION_IDS.size

NOT an arbitrary 50.

Anything larger:

400

Unknown/noncanonical requested id:

400 Unknown section id

================================================================
7. HERO REQUEST INVARIANT
   ================================================================

Request must include:

hero exactly once

and:

hero must be sectionIds[0]

Invalid:

[]

["services"]

["services", "hero"]

["hero", "hero"]

All:

400

Do not silently insert/reorder Hero for the client.

================================================================
8. STORED WHOLE-ARRAY VALIDATOR
   ================================================================

Add a module-private composition-level stored-section validator such as:

mapCanonicalSections(sections)

It validates the ENTIRE stored array before composition.

Every stored section must have:

known canonical id
known canonical type
id === type

No duplicate id.

No duplicate canonical identity/type.

Exactly one Hero.

Unknown/future stored section:

500 Home sections invalid

Mismatched reserved identity:

500 Home sections invalid

Duplicate identity:

500 Home sections invalid

Missing Hero:

500 Home sections invalid

No repair.

================================================================
9. STORED HERO POSITION — REQUIRED CORRECTION
   ================================================================

Hero is now formally fixed at index 0.

Therefore the STORED Home must also already satisfy:

sections[0]?.id === 'hero'
sections[0]?.type === 'hero'

If Hero exists elsewhere but is NOT index 0:

500 Home sections invalid

Do NOT allow composition to silently repair an out-of-band corrupted Hero
position.

No shipped application behavior prior to 1.20 legitimately moves Hero away
from index 0, so such data is corruption.

Add explicit automated coverage.

================================================================
10. UNKNOWN / FUTURE STORED SECTION POLICY
    ================================================================

FAIL CLOSED.

If Home.sections contains something such as:

{
id: "about",
type: "about"
}

composition returns:

500 Home sections invalid

and performs NO write.

Do NOT:

silently drop it
auto-preserve it
invent a UI label
reorder it opaquely
repair it

This prevents full-state omission semantics from destroying data the server
doesn't understand.

================================================================
11. AUTHORITATIVE CURRENT-SECTION CHECK
    ================================================================

Even if a requested id is canonical, it must CURRENTLY EXIST.

Example:

Contact is a canonical type

but current Home contains no Contact.

Request includes:

"contact"

Expected:

400 Unknown section id

Composition cannot create Contact.

The caller must use the existing Add Contact/editor flow first.

Perform this check against the authoritative stored map inside
mutateWorkingHome's transaction transform.

================================================================
12. MUTATION DESIGN
    ================================================================

Implement:

composeHomeSections(tenantId, input)

Preferred shape:

1. validateCompositionInput(input)
2. mutateWorkingHome(tenantId, sections => ...)
3. validate stored whole-array integrity
4. build authoritative Map<id, storedSection>
5. resolve each requested section id from the stored map
6. build next array in request order
7. return next array

Each surviving section in the result must be the existing stored section
object/content, not reconstructed from the client.

No Firestore reads inside the transform.

No published handle.

No Media writes.

No Lead writes.

================================================================
13. OBJECT/CONTENT PRESERVATION
    ================================================================

Reorder must preserve surviving section content exactly.

Preserve:

content
item ids
stored future metadata
section metadata

Only array order changes.

Removal:

omit the complete section object.

Do not reconstruct surviving sections field-by-field.

Tests should compare the pre/post surviving section values deeply.

Home/config updatedAt are expected to change.

================================================================
14. WORKING TIMESTAMPS
    ================================================================

Reuse mutateWorkingHome.

Therefore:

home.updatedAt advances
config.updatedAt advances

Do NOT change:

published/current
lifecycle status
lastPublishedAt
lastPublishedByUserId

No new version field.

================================================================
15. OPTIMISTIC CONCURRENCY
    ================================================================

Do NOT add expectedUpdatedAt.

Current CMS editing remains last-write-wins.

Lead status concurrency is a separate domain and remains unchanged.

Do not add a composition-only concurrency model.

================================================================
16. REMOVAL
    ================================================================

Omission of an optional existing section removes that entire section from
WORKING Home.sections.

This intentionally destroys its current WORKING section content.

It does NOT delete:

Media metadata
GCS objects
Leads
Lead Notes
tenant records
anything outside Home.sections

Removing Gallery:

Gallery working section disappears
Media remains

Removing Contact:

Contact working section disappears
Leads remain

================================================================
17. PUBLISHED SAFETY
    ================================================================

Removing/reordering working sections must leave:

published/current

byte-for-byte unchanged until Republish.

Normal public:

old snapshot

Preview:

working composition

Republish:

new composition becomes normal public.

================================================================
18. LEAD FORM LIFECYCLE
    ================================================================

Preserve the existing Step 1.14 authority model.

Scenario:

published Contact action = leadForm

Remove Contact from WORKING composition.

Before Republish:

public Contact/lead eligibility still based on published snapshot
public lead POST still succeeds

After Republish without Contact:

published snapshot contains no leadForm Contact
public lead POST fails closed according to existing behavior

Do NOT modify leadService.

Automated coverage required where practical.

================================================================
19. GALLERY / MEDIA LIFECYCLE
    ================================================================

Remove Gallery from working composition.

Expected:

Gallery section absent from working Home

Media metadata remains

GCS media remains

No storage adapter deletion is invoked/reachable.

Before Republish:

published Gallery still public

After Republish:

Gallery disappears from public site

Media remains tenant-owned for reuse.

================================================================
20. DEFAULT / CANONICAL ORDER
    ================================================================

Conceptual default order remains:

Hero
Services
Gallery
Testimonials
Contact

Do NOT add another persisted order model for this.

Do NOT add an unused persisted/default-rank field.

================================================================
21. EXISTING SECTION INSERTION RULES
    ================================================================

DO NOT modify the existing first-creation behavior in:

Services
Gallery
Testimonials
Contact

Re-added sections continue to use their existing deterministic upsert
placement:

Services:
after Hero

Gallery:
before Contact if present, otherwise append

Testimonials:
before Contact if present, otherwise append

Contact:
append

If the operator wants another position:

Manage Sections now provides that capability.

Do NOT introduce insertSectionByDefaultRank during Step 1.20.

Do NOT reorder existing sections merely because another section is re-added.

================================================================
22. PORTAL COMPOSITION EDITOR
    ================================================================

Add:

SectionCompositionEditor.tsx

Use the already-loaded working SiteDefinition.

No extra GET merely to open Manage Sections.

Rows should display current array order.

Hero:

shown
label = Hero
Fixed indicator
no Move
no Remove

Optional rows:

Services
Gallery
Testimonials
Contact

Controls:

Move Up
Move Down
Remove

No drag/drop.

No page-builder canvas.

No content fields.

================================================================
23. MOVE BOUNDARIES
    ================================================================

Hero remains row/index 0.

First optional section:

Move Up disabled

Last section:

Move Down disabled

Optional sections can otherwise move freely relative to one another,
including Contact.

================================================================
24. REMOVE UX
    ================================================================

Remove acts on LOCAL editor state only.

No request occurs when clicking Remove.

Show clear warning:

"Removing a section deletes its saved content from the working site.
Your published site won't change until you republish."

Save Layout:

persist local composition

Cancel:

discard local changes

Do NOT build undo/history.

================================================================
25. BUSINESSWEBSITE INTEGRATION
    ================================================================

Extend EditorMode with:

'composition'

Add:

Manage Sections

to initialized site management.

When composition editor is open:

ordinary Add/Edit section controls should not simultaneously present confusing
actions for locally-removed-but-unsaved sections.

On successful Save Layout:

use returned SiteDefinition

update in-memory site

close composition editor

no extra GET

Existing BusinessWebsite derived Add/Edit buttons should naturally change:

removed persisted section
->
Add <Section>

No Restore UI.

================================================================
26. PORTAL API
    ================================================================

Extend:

platform/apps/portal/lib/site.ts

Add typed:

CompositionInput {
sectionIds: string[]
}

and:

composeHomeSections(...)

Reuse:

apiSend

No new transport mechanism.

================================================================
27. RENDERER
    ================================================================

No renderer change expected.

SectionRenderer already consumes page.sections in array order.

Do NOT add client sorting.

Do NOT create visual order metadata.

================================================================
28. MEDIA HYDRATION
    ================================================================

Do not modify media hydration merely for composition.

Existing hydration must preserve section order.

Composition ordering/removal must survive:

authenticated getSite
preview getPublicSite
published getPublicSite

Add coverage if appropriate.

================================================================
29. STORED CONTENT VALIDITY VS COMPOSITION
    ================================================================

Composition owns SECTION STRUCTURAL integrity, not every section's content
schema.

Do not turn this milestone into a complete validation/migration pass over
Hero/Services/Gallery/Testimonials/Contact content.

A canonical section with content corruption can be preserved/reordered;
its own editor/public defensive behavior remains responsible for its domain.

Composition must, however, validate:

canonical section identities
unique identities
Hero presence/index
unknown stored section policy

Do not broaden this into generic site repair.

================================================================
30. TEST — REQUEST VALIDATION
    ================================================================

Cover:

valid full composition

Hero only

missing sectionIds

non-array

zero entries

non-string entry

blank string

whitespace-only string

noncanonical "bogus"

duplicate id

Hero missing

Hero duplicated

Hero not first

payload longer than CANONICAL_SECTION_IDS.size

All invalid requests:

no mutation.

================================================================
31. TEST — CURRENTLY ABSENT CANONICAL SECTION
    ================================================================

Current Home:

Hero + Services

Request:

Hero + Services + Contact

Expected:

400 Unknown section id

Contact is canonical but absent.

Composition cannot create it.

================================================================
32. TEST — STORED INTEGRITY
    ================================================================

Cover:

unknown future section
duplicate stored id
mismatched id/type
duplicate canonical identity
missing Hero
Hero present but not index 0

All:

500 Home sections invalid

No partial writes.

================================================================
33. TEST — REORDER
    ================================================================

Stored:

Hero
Services
Gallery
Testimonials
Contact

Request:

Hero
Testimonials
Gallery
Contact
Services

Expected exact persisted order.

For each surviving section:

content equal before/after
item identities equal
unknown stored metadata equal

Only working timestamps may differ.

================================================================
34. TEST — REMOVAL
    ================================================================

Request omits:

Services
Contact

Expected:

Hero
Gallery
Testimonials

Services/Contact working section objects gone.

Other section objects unchanged.

Minimum valid site:

Hero only

must succeed.

================================================================
35. TEST — MEDIA PRESERVATION
    ================================================================

Remove Gallery.

Assert:

Media Firestore documents unchanged.

No Media deletion behavior.

Do not require real GCS.

Composition must not call storage deletion.

================================================================
36. TEST — SNAPSHOT ISOLATION
    ================================================================

Original working/published:

Hero
Services
Gallery
Testimonials
Contact

Publish.

Working composition changes:

Hero
Testimonials
Gallery

Services + Contact removed.

Expected:

published/current bytes unchanged

normal public:
old order/all old sections

preview:
Hero, Testimonials, Gallery

Republish.

normal public:
Hero, Testimonials, Gallery

================================================================
37. TEST — LEAD FORM LIFECYCLE
    ================================================================

Publish Contact:

action = leadForm

Remove Contact from working composition.

Before Republish:

existing public lead eligibility succeeds

After Republish:

public lead eligibility fails closed / 404

No Lead records deleted.

No leadService code modification.

================================================================
38. TEST — AUTHORIZATION
    ================================================================

Composition PUT:

PLATFORM_ADMIN -> success

OWNER -> 403
ADMIN -> 403
STAFF -> 403
unauthenticated -> 401

No public composition endpoint.

================================================================
39. NO SECTION DELETE ROUTES
    ================================================================

Do NOT add:

DELETE /sections/services
DELETE /sections/gallery
DELETE /sections/testimonials
DELETE /sections/contact

Full-state composition omission is the one consistent removal mechanism.

================================================================
40. FILES EXPECTED TO ADD
    ================================================================

Expected:

platform/apps/portal/app/businesses/SectionCompositionEditor.tsx

server/test/siteCompositionService.test.js

================================================================
41. FILES EXPECTED TO MODIFY
    ================================================================

Expected:

server/services/siteService.js
server/routes/tenants.js
server/test/tenantRoutes.test.js
platform/apps/portal/lib/site.ts
platform/apps/portal/app/businesses/BusinessWebsite.tsx

Focused existing test changes are acceptable if needed.

================================================================
42. FILES THAT SHOULD REMAIN UNCHANGED
    ================================================================

Do not unnecessarily modify:

platform/packages/site-schema/src/index.ts

all public site-components

SectionRenderer

mediaService
gcsClient

leadService
publicLeads

publishSite implementation
unpublishSite implementation
mutateWorkingHome implementation

FakeDb

HeroEditor
ServicesEditor
GalleryEditor
TestimonialsEditor
ContactEditor

existing section upsert insertion semantics

================================================================
43. VERIFY
    ================================================================

Backend:

cd server
npm test

Run repo-appropriate StandardJS/syntax checks.

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

Everything from prior milestones must remain green.

================================================================
44. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Existing site containing all sections.

1. Portal -> Manage Website.

2. Click Manage Sections.

3. Verify:

Hero
Fixed

No Hero Move/Remove.

4. Move Testimonials above Gallery.

5. Verify first optional Move Up disabled.

6. Verify final optional Move Down disabled.

7. Remove Services locally.

8. Remove Contact locally.

9. Verify warning.

10. Before Save:
    nothing persisted.

11. Cancel.

Expected:
original composition returns.

12. Repeat reorder/removal.

13. Save Layout.

14. Working Firestore Home:

exact desired order
removed sections absent
surviving section data intact

15. Normal public:

old composition

16. Preview:

new composition

17. published/current:

unchanged

18. Republish.

19. Normal public:

new composition

20. Re-add Services or Contact using existing Add editor.

21. Observe its deterministic legacy placement.

22. Use Manage Sections to place it where desired.

23. Remove Gallery in a separate check.

Verify:

Media metadata remains
image objects remain/reusable

24. If published Contact was leadForm:

before Republish after working removal:
public lead submission remains authorized

after Republish:
public lead submission fails closed

25. Confirm Leads/Notes/status, Media, all section editors remain functional.

26. Confirm only bakerrang-dev changed.

================================================================
45. STEP 1.21
    ================================================================

Do not implement now.

After Step 1.20, recommended next milestone:

Public Website Design System + Branding

The CMS mechanics will then cover:

create
edit
compose
order
remove
publish

and we should shift deliberately into making public sites visually polished
rather than adding more CMS mechanics.

================================================================
46. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Endpoint.
4. Request/response.
5. Hero invariant.
6. Whole-array stored validation.
7. Unknown/future section policy.
8. Request validation.
9. Authoritative current-section validation.
10. Reorder semantics.
11. Removal semantics.
12. Object/content preservation.
13. Timestamp behavior.
14. Concurrency decision.
15. Existing insertion rules preserved.
16. Portal composition UX.
17. Warning/Cancel/Save behavior.
18. Gallery/Media preservation.
19. Contact/lead lifecycle.
20. Working/published isolation.
21. Tests.
22. Backend test result.
23. Platform checks.
24. Manual DEV verification if performed.
25. Deviations and why.
26. Anything influencing Step 1.21.

Do not implement beyond Step 1.20.