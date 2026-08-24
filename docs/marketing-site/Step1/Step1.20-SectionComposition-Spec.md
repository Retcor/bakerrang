# Claude Code Assignment — Step 1.20 Section Composition, Ordering & Removal

DO NOT modify code.

Steps 1.7–1.19 are complete and manually verified.

The Home page now supports:

Hero
Services
Gallery
Testimonials
Contact

We have intentionally deferred cross-section composition and removal until now.

The next milestone is:

SECTION COMPOSITION + ORDERING + REMOVAL

============================================================
1. GOAL
   ============================================================

Allow PLATFORM_ADMIN to manage the composition of the working Home page:

- see the currently-present sections
- reorder optional sections
- remove optional sections
- save the resulting layout
- cancel local changes

Published site remains unchanged until Publish/Republish.

This milestone should finally resolve the creation-order caveat that has existed
across Services, Gallery, Testimonials, and Contact.

============================================================
2. CURRENT PRODUCT ASSUMPTION TO EVALUATE
   ============================================================

My preferred product model is:

Hero:
required
non-removable
fixed at the top

Services:
optional
reorderable
removable

Gallery:
optional
reorderable
removable

Testimonials:
optional
reorderable
removable

Contact:
optional
reorderable
removable

Evaluate whether the shipped architecture supports this cleanly.

Do not simply accept it if actual code/data invariants suggest a better model.

============================================================
3. INSPECT CURRENT IMPLEMENTATION
   ============================================================

Inspect actual shipped code:

server/services/siteService.js
server/routes/tenants.js

platform/packages/site-schema/src/index.ts
platform/apps/portal/app/businesses/BusinessWebsite.tsx

HeroEditor
ServicesEditor
GalleryEditor
TestimonialsEditor
ContactEditor

platform/apps/portal/lib/site.ts

platform/apps/site-renderer/components/SectionRenderer.tsx

tests for:

Hero
Services
Gallery
Testimonials
Contact
publication lifecycle
reserved identity corruption

Document:

- how Home.sections is currently persisted
- whether array order alone defines render order
- current section insertion rules
- current per-section reserved identity rules
- whether Hero is currently assumed required anywhere
- whether any code assumes Contact is last
- whether media hydration depends on section position
- how publish snapshots sections
- how getSite / getPublicSite copy/hydrate sections
- whether any unknown/manual section data can exist safely

============================================================
4. PRIMARY ARCHITECTURAL QUESTION — SOURCE OF TRUTH
   ============================================================

Evaluate whether:

Home.sections array order

should remain the sole source of truth for composition/render order.

My preference:

YES.

Avoid adding:

sectionOrder metadata
layout config documents
duplicate ordering arrays

unless absolutely necessary.

A single source of truth is preferable.

Explain the decision.

============================================================
5. COMPOSITION MUTATION SHAPE
   ============================================================

Design the cleanest mutation API.

Potential:

PUT /tenants/:tenantId/site/pages/home/sections

with:

{
"sectionIds": [
"hero",
"gallery",
"services",
"testimonials",
"contact"
]
}

Semantics:

- order = desired Home section order
- omission of an optional current section = remove it
- Hero must be present exactly once
- no new section can be created through this endpoint
- payload can reference only authoritative currently-present section identities

Evaluate whether this shape is correct.

Alternatives are acceptable if clearly better.

Do NOT send entire section content just to reorder/remove.

============================================================
6. FULL-STATE COMPOSITION SEMANTICS
   ============================================================

The request should ideally represent the desired composition of EXISTING
sections.

It should NOT:

- create Services
- create Gallery
- create Testimonials
- create Contact
- edit any section content

Existing section editor routes remain responsible for creation/content.

Composition only:

reorders
removes

Clarify exact semantics.

============================================================
7. HERO INVARIANT
   ============================================================

Evaluate Hero as:

required
exactly one
fixed index 0
not removable
not reorderable below other content

If confirmed:

composition payload must contain Hero exactly once and first.

Invalid examples:

[]
["services"]
["services", "hero"]
["hero", "hero"]

should fail 400, not silently repair.

Also inspect whether malformed stored Hero identity should remain a controlled
500 invariant.

============================================================
8. OPTIONAL SECTION REMOVAL
   ============================================================

If an optional section is omitted from the desired composition:

remove the entire section object from WORKING Home.sections.

This intentionally removes its working content.

Do NOT delete:

Media objects
Leads
Notes
anything outside the site definition

For Gallery:

removing Gallery must NOT delete Media.

Media remains tenant-owned reusable data.

============================================================
9. RE-ADDING REMOVED SECTIONS
   ============================================================

A removed optional section should become absent.

Existing BusinessWebsite UI should then show:

Add Services
Add Gallery
Add Testimonials
Add Contact

as appropriate.

Re-adding uses the existing editor/upsert route.

Determine what default content behavior occurs when re-adding.

Do NOT build recycle-bin/restore-history behavior.

Published snapshot still preserves the previous published section until
Republish.

============================================================
10. CONTENT LOSS UX
    ============================================================

Removing a section from the working site destroys that working section content.

That deserves deliberate UX.

Evaluate:

A. Manage Sections editor with local changes + Save Layout / Cancel

B. immediate Remove with confirmation

My preference:

A.

User can reorder/remove locally, then explicitly Save Layout.

Consider whether an additional warning such as:

"Removing a section will remove its saved content from the working site."

is appropriate.

Do NOT build a sophisticated undo/history system.

============================================================
11. SERVER AUTHORITATIVE SECTION SET
    ============================================================

This is important.

Composition must operate on authoritative stored sections.

Client must not be able to submit arbitrary ids such as:

"evil"
"custom"
"hero2"

and cause fabricated sections or data loss.

Determine exact validation:

- every supplied id must correspond to a currently stored authoritative section
- duplicate ids rejected
- unknown ids rejected

For optional sections:

omission means removal.

Do not trust client type information.

Prefer IDs only if canonical ids are authoritative enough.

============================================================
12. UNKNOWN / FUTURE SECTION TYPES
    ============================================================

Think carefully about future compatibility and malformed data.

Suppose Home.sections contains a future or manually-added section unknown to
Step 1.20 code.

A full-state `sectionIds` endpoint could accidentally delete it through
omission.

Determine the safest policy.

Possible approaches:

A. fail composition with controlled invariant error when unsupported sections
exist

B. preserve unsupported sections automatically

C. include authoritative unknown ids as reorderable opaque sections

D. another approach

Choose deliberately.

Do not silently destroy section data the server doesn't understand.

This is one of the most important architectural questions in this milestone.

============================================================
13. RESERVED IDENTITY VALIDATION
    ============================================================

Today section-specific mutation endpoints detect corruption such as:

id === 'gallery'
OR
type === 'gallery'

with mismatched/duplicate reserved identity.

Composition touches the entire section array.

Evaluate introducing ONE validation helper for current known canonical section
identities:

hero
services
gallery
testimonials
contact

Potential goal:

validate composition-level section integrity before reorder/remove.

But do not unnecessarily refactor all existing section endpoints if the helper
does not improve them.

Determine whether this is now a legitimate shared abstraction.

============================================================
14. STORED DUPLICATE IDS
    ============================================================

Composition requires stable unique section identities.

If stored Home contains:

two sections with same id

or two canonical identities of same type

determine controlled behavior.

Do NOT arbitrarily pick one.

Prefer fail closed:

500 Home sections invalid

or existing section-specific invariant messages if appropriate.

Recommend exact policy.

============================================================
15. TRANSACTION DESIGN
    ============================================================

Composition is a working Home mutation.

Evaluate using:

mutateWorkingHome

with a transform that:

1. validates current sections
2. maps authoritative ids -> section objects
3. validates requested composition
4. builds new ordered array using the EXISTING STORED OBJECTS
5. returns new array

This would preserve all section content/metadata byte-for-byte while only
changing/removing array entries.

If that is correct, prefer it.

No need to rewrite section content.

============================================================
16. OBJECT PRESERVATION
    ============================================================

Reordering should preserve existing section objects exactly.

For sections that remain:

content unchanged
item IDs unchanged
unknown future stored metadata unchanged

Only:

array position

changes.

Removal simply omits the section object.

This should be tested.

============================================================
17. CONFIG UPDATEDAT
    ============================================================

Because composition changes the working Home:

Home.updatedAt
site config.updatedAt

should advance using the existing mutateWorkingHome behavior.

Published snapshot untouched.

Do not add another concurrency/version field unless actual repo needs it.

============================================================
18. OPTIMISTIC CONCURRENCY
    ============================================================

Evaluate whether composition needs an expectedUpdatedAt token.

Current CMS editors do not use optimistic concurrency.

My preference:

do NOT introduce one solely for composition unless there is a compelling
reason.

Keep consistency with current CMS mutation model.

But explicitly evaluate the risk.

============================================================
19. DEFAULT/CANONICAL ORDER
    ============================================================

Define the default order for newly-created/re-added sections.

Current conceptual default:

Hero
Services
Gallery
Testimonials
Contact

Step 1.20 should eliminate dependence on historical add order where practical.

Important design question:

After a user establishes CUSTOM order, then removes and later re-adds a
section, where should the newly-created section be inserted?

Options:

A. canonical default rank among existing sections

B. end of optional sections

C. existing section-specific insertion rule

D. another simple policy

Choose a deterministic rule.

Do not add separate layout metadata merely to remember a removed section's old
position unless justified.

============================================================
20. UPDATE EXISTING SECTION INSERTION RULES?
    ============================================================

Today:

Services
Gallery
Testimonials
Contact

have their own insertion conventions.

Evaluate whether Step 1.20 should modify these upsert endpoints so FIRST
creation uses a shared canonical insertion helper.

This may finally be justified because creation-order dependence is now a known
real problem.

Potential helper:

insertSectionByDefaultRank(sections, newSection)

Default rank:

hero = 0
services = 1
gallery = 2
testimonials = 3
contact = 4

But consider custom user-defined order.

If the site is already custom-ordered, inserting according to canonical rank
may be surprising.

Recommend the cleanest behavior.

Do not accidentally reorder existing sections when adding one new section.

============================================================
21. COMPOSITION UI
    ============================================================

Design a focused portal editor.

Potential:

Manage Sections

Hero
Fixed

Services
[Move Up] [Move Down] [Remove]

Gallery
[Move Up] [Move Down] [Remove]

Testimonials
[Move Up] [Move Down] [Remove]

Contact
[Move Up] [Move Down] [Remove]

[Save Layout]
[Cancel]

No drag/drop required.

No visual page-builder canvas.

============================================================
22. HERO UI
    ============================================================

If Hero is fixed:

show it in the composition list

but:

no Remove
no Move Up
no Move Down

or clearly label:

Fixed

Determine best simple UX.

============================================================
23. OPTIONAL SECTION REORDER BOUNDARIES
    ============================================================

Because Hero is fixed at position 0:

the first optional section may not move above Hero.

Move Up disabled when directly below Hero.

Last section Move Down disabled.

If Contact is no longer special/fixed, it can move anywhere after Hero.

Verify whether that is desirable.

My expectation:

YES — Contact should become just another optional reorderable content section.

============================================================
24. REMOVE UX
    ============================================================

Remove should alter LOCAL composition state first.

Suggested:

click Remove
->
row disappears from local composition
->
warning/state indicates unsaved layout changes

Save Layout:
commit

Cancel:
restore from loaded SiteDefinition

Do not call DELETE immediately.

No separate per-section DELETE routes if the full-state composition endpoint
can handle removal cleanly.

============================================================
25. RE-ADD UX
    ============================================================

After saved removal:

BusinessWebsite should naturally show the corresponding existing:

Add <Section>

button.

No separate Restore button.

If a section has been locally removed but layout has not yet been saved, do
not simultaneously show Add in another part of the UI in a confusing way.

Evaluate how BusinessWebsite mode/state should handle this.

============================================================
26. SECTION CONTENT EDITORS
    ============================================================

Existing Hero/Services/Gallery/Testimonials/Contact editors should continue to
edit content exactly as before.

Do not merge content editing into Manage Sections.

Composition is separate from content.

============================================================
27. BUSINESS WEBSITE UX
    ============================================================

BusinessWebsite currently exposes Add/Edit section buttons.

Determine the smallest integration.

Potential:

Manage Sections

button appears once site is initialized.

The composition editor uses the already-loaded SiteDefinition.

No extra GET merely to open it.

On successful save:

update in-memory SiteDefinition
return to normal website-management view

No unnecessary site refetch.

============================================================
28. PORTAL API
    ============================================================

Extend:

platform/apps/portal/lib/site.ts

with the composition mutation.

Typed request/response.

Reuse existing apiSend.

No new transport layer.

============================================================
29. SERVER ENDPOINT
    ============================================================

Recommend exact route.

Potential:

PUT /tenants/:tenantId/site/pages/home/sections

or:

PUT /tenants/:tenantId/site/pages/home/composition

Choose based on collision/clarity with existing:

/sections/hero
/sections/services
...

I slightly prefer:

PUT /tenants/:tenantId/site/pages/home/composition

if it avoids ambiguity.

But choose what fits the actual router cleanly.

PLATFORM_ADMIN only.

============================================================
30. RESPONSE CONTRACT
    ============================================================

Prefer returning the updated working:

SiteDefinition

or:

SitePage

consistent with current mutation endpoints.

Inspect existing editors.

Choose the response that minimizes portal refetching and maintains current
patterns.

============================================================
31. WORKING / PUBLISHED ISOLATION
    ============================================================

Mandatory scenario:

working order:
Hero, Services, Gallery, Testimonials, Contact

Publish.

Then working composition changes to:

Hero, Testimonials, Gallery

Meaning:

Services removed
Contact removed
Testimonials/Gallery reordered

Expected:

normal public:
Hero, Services, Gallery, Testimonials, Contact

preview:
Hero, Testimonials, Gallery

published snapshot bytes unchanged.

Republish:

normal public:
Hero, Testimonials, Gallery

Automated test this.

============================================================
32. REMOVED GALLERY / MEDIA
    ============================================================

Critical:

Remove Gallery from working composition.

Expected:

Gallery section removed from working Home

Media metadata remains
GCS objects remain

published site still shows old Gallery until Republish

after Republish:
Gallery disappears from public site

Media remains available for future re-add/use.

Test at least the Firestore side; no GCS needed.

============================================================
33. REMOVED CONTACT / LEAD FORM
    ============================================================

This is subtle.

Contact may contain:

email
phone
URL
leadForm

If Contact section is removed from WORKING:

normal published lead-form eligibility should remain based on the old published
snapshot until Republish.

After Republish without Contact:

public lead submission should become ineligible/404 according to existing
Step 1.14 rules.

Preview may no longer show Contact.

Composition must not directly modify Lead records.

This is an important lifecycle regression test.

============================================================
34. SECTION REMOVAL + PUBLIC LEAD REGRESSION
    ============================================================

If published Contact currently has:

action: leadForm

Scenario:

publish Contact leadForm

working composition removes Contact

before republish:
public form still works
public lead POST still authorized

after republish:
Contact absent
public lead form absent
public lead POST fails closed

This should be explicitly tested if practical.

============================================================
35. REMOVE SERVICES / TESTIMONIALS
    ============================================================

Removal should not affect:

their previous published copy before republish

other section content

site config status

tenant data outside Home.sections

============================================================
36. REMOVE HERO ATTEMPT
    ============================================================

Client attempts composition without Hero:

400

Client attempts Hero not first:

400

Client attempts duplicate Hero:

400

Stored malformed Hero:

controlled 500

Hero remains non-removable.

============================================================
37. UNKNOWN REQUEST IDS
    ============================================================

Payload includes:

["hero", "services", "bogus"]

Expected:

400

Do not ignore bogus ids.

Do not create anything.

Do not partially mutate.

============================================================
38. DUPLICATE REQUEST IDS
    ============================================================

Payload:

["hero", "services", "services"]

Expected:

400

No mutation.

============================================================
39. REQUEST TYPE VALIDATION
    ============================================================

Validate exact payload shape.

Potential:

{
sectionIds: string[]
}

Reject:

missing sectionIds
non-array
non-string values
empty strings

Determine sensible max.

Because Home currently supports only a handful of canonical sections, an
arbitrary huge payload should fail.

Do not silently coerce.

============================================================
40. OPTIONAL EMPTY SITE
    ============================================================

If Hero is required:

minimum valid composition:

["hero"]

This should be supported.

Public site with only Hero should render.

============================================================
41. RENDERER
    ============================================================

Renderer already renders sections in array order.

Confirm no renderer change is necessary.

If no change required:

leave it unchanged.

Do not add client-side sorting.

Server persistence order should be render order.

============================================================
42. MEDIA HYDRATION
    ============================================================

Confirm Gallery hydration preserves section order.

Composition reorder must remain intact after:

getSite
getPublicSite preview
getPublicSite published

Media hydration must not reorder sections.

If code already maps in place:

no change.

Test if useful.

============================================================
43. PUBLIC DEFENSIVE BEHAVIOR
    ============================================================

A valid working/published SiteDefinition should preserve requested order.

Unknown malformed sections should continue to follow current renderer behavior
(null/skip) unless composition validation intentionally blocks them earlier.

Do not invent repair logic.

============================================================
44. TESTS — COMPOSITION VALIDATION
    ============================================================

Cover:

valid full order

Hero only

Hero missing

Hero duplicated

Hero not first

unknown requested id

duplicate requested id

missing sectionIds

non-array

non-string id

empty string

attempt to reference a section that is known by schema but currently ABSENT

Expected:
400

Composition cannot create missing sections.

============================================================
45. TESTS — REORDER
    ============================================================

Existing:

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

Expected exact stored order.

All remaining section objects/content byte-equivalent except Home/config
timestamps.

============================================================
46. TESTS — REMOVAL
    ============================================================

Request omits:

Services
Contact

Expected working:

Hero
Gallery
Testimonials

No Services/Contact section objects.

Other section data preserved exactly.

============================================================
47. TESTS — GALLERY MEDIA PRESERVATION
    ============================================================

Remove Gallery.

Assert:

tenant Media metadata remains unchanged.

If tests use FakeStorage:

no deleteObject calls.

Composition never manages Media lifecycle.

============================================================
48. TESTS — SNAPSHOT ISOLATION
    ============================================================

Publish original composition.

Change working reorder/removal.

Assert:

published/current bytes unchanged

normal public:
old composition

preview:
new composition

Republish.

normal public:
new composition

============================================================
49. TESTS — LEAD FORM LIFECYCLE
    ============================================================

Where practical:

publish Contact with leadForm

remove Contact from working composition

before republish:
public lead authorization still succeeds

after republish:
public lead authorization fails closed

Do not alter leadService behavior.

============================================================
50. TESTS — AUTHORIZATION
    ============================================================

Composition PUT:

PLATFORM_ADMIN -> success

OWNER -> 403
ADMIN -> 403
STAFF -> 403
unauthenticated -> 401

No public composition mutation route.

============================================================
51. TESTS — STORED CORRUPTION
    ============================================================

Cover:

duplicate current section ids

mismatched reserved id/type

duplicate reserved section identity

unsupported/unknown stored section behavior according to chosen §12 policy

Fail controlled.

No partial write.

============================================================
52. TESTS — UI STATE
    ============================================================

No need for a new frontend testing framework.

Manual/typecheck/build validation is sufficient unless existing lightweight
coverage exists.

Manual check:

Move boundaries
local Remove
Cancel
Save Layout
Add buttons after saved removal

============================================================
53. DEFAULT INSERTION AFTER REMOVAL
    ============================================================

Manual/automated scenario:

custom order exists

remove Services
save

click Add Services later
save new Services

Document where Services is inserted by the chosen default rule.

Ensure behavior is deterministic.

Do not attempt to restore deleted content.

============================================================
54. SECTION REMOVAL IS DESTRUCTIVE TO WORKING CONTENT
    ============================================================

Make UX clear enough that users understand:

removing a section removes its working content.

However:

published snapshot remains until Republish.

No undo/history in V1.

Potential warning text:

"Removing a section will delete its saved content from the working site.
Your published site will not change until you republish."

Evaluate exact wording.

============================================================
55. NO GENERIC PAGE BUILDER
    ============================================================

Do not implement:

drag/drop library
layout columns
nested sections
arbitrary custom section types
visual canvas
templates
per-device ordering
hidden vs visible flags
draft-disabled sections
section cloning

This is a simple ordered Home section list.

============================================================
56. NO SECOND PAGE YET
    ============================================================

Do not generalize composition across arbitrary pages unless the actual code
makes it trivial.

This milestone is specifically:

Home page composition.

Future multi-page composition can reuse the pattern later.

============================================================
57. FILES
    ============================================================

Return exact:

files to add
files to modify
files explicitly unchanged

Likely additions may include:

SectionCompositionEditor.tsx

and:

server/test/siteCompositionService.test.js

but inspect actual repo before deciding.

============================================================
58. VERIFICATION
    ============================================================

Backend:

cd server
npm test

repository-appropriate lint/syntax

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

All previous tests must remain green.

============================================================
59. MANUAL DEV E2E
    ============================================================

Plan:

1. Existing site with all sections.

2. Open Manage Website.

3. Open Manage Sections.

4. Verify Hero is fixed.

5. Move Testimonials above Gallery.

6. Remove Services.

7. Remove Contact.

8. Before Save:
   normal BusinessWebsite/editor data unchanged outside local composition state.

9. Cancel.
   original composition restored.

10. Repeat reorder/removal.

11. Save Layout.

12. Firestore working Home:
    new exact section order
    removed section objects absent

13. Media:
    unchanged even if Gallery removed in another test.

14. Normal public:
    old composition before republish.

15. Preview:
    new composition.

16. Republish.

17. Normal public:
    new composition.

18. Re-add removed section using existing Add editor.

19. Confirm deterministic default insertion.

20. If Contact leadForm used:
    verify public lead eligibility persists until republish then disappears.

21. Confirm only bakerrang-dev changed.

============================================================
60. FUTURE STEP
    ============================================================

After Step 1.20, recommend what should be next.

Likely possibilities:

1.21 Public Website Design System + Branding

or:

Portal Website-management UX polish

My preference after composition is to begin the deliberate public visual/design
phase rather than continuing to add more section mechanics.

Evaluate this in context.

============================================================
61. ARCHITECTURAL PRINCIPLE
    ============================================================

This milestone should establish:

Home.sections array
=
single source of truth for:

existence
order
render sequence

Composition mutation:

authoritative stored sections
->
validate
->
reorder / omit optional sections
->
preserve remaining section objects
->
working site only
->
publish snapshot later

No second ordering model.

============================================================
DELIVERABLE
============================================================

Return:

1. Current composition readiness.
2. Whether Hero should be fixed/required.
3. Whether optional sections are all removable/reorderable.
4. Source-of-truth decision.
5. Exact API route.
6. Exact request/response contract.
7. Authoritative section validation.
8. Unknown/future stored-section policy.
9. Reserved identity/corruption policy.
10. Transaction/mutation design.
11. Object/content preservation.
12. Working timestamp behavior.
13. Concurrency decision.
14. Canonical/default order.
15. New-section insertion behavior after custom ordering/removal.
16. Whether existing upsert insertion rules should change.
17. Portal composition UX.
18. Remove warning/UX.
19. Re-add behavior.
20. Renderer/media hydration impact.
21. Lead-form lifecycle impact.
22. Tests.
23. Files to add.
24. Files to modify.
25. Files explicitly unchanged.
26. Verification commands.
27. Manual DEV E2E.
28. Concrete risks.
29. What this establishes architecturally.
30. Recommended Step 1.21.
31. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.