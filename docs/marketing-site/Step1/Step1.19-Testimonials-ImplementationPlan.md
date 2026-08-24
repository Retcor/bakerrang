Implement Step 1.19 — Testimonials Section.

Claude Code inspected the actual repository and produced an approved plan.

Follow Claude's plan as written, with the implementation guardrails below.

Do not expand scope.

================================================================
GOAL
================================================================

Add a manually-managed, text-only Testimonials section to the Home page.

PLATFORM_ADMIN can:

add Testimonials
edit Testimonials
add testimonial items
remove testimonial items
reorder testimonial items
save working content

Public visitors see Testimonials after Publish/Republish.

This milestone is deliberately:

TEXT ONLY

No:

ratings
stars
media
review-provider integration
Google reviews
Yelp
Facebook
external review sync
verified badges
review dates
source URLs
schema.org review markup
public review submission
section deletion
cross-section drag/drop/reordering

================================================================
1. PRODUCT TERMINOLOGY
   ================================================================

Use:

testimonials

for the internal section:

id = 'testimonials'
type = 'testimonials'

Portal wording:

Testimonials

Do NOT call this feature:

Reviews

These are curated/manual CMS quotes, not provider-verified reviews.

Reserve a future:

reviews

domain/section concept for externally sourced structured reviews.

================================================================
2. SITE SCHEMA
   ================================================================

Add:

export interface TestimonialItem {
id: string
customerName: string
quote: string
}

export interface TestimonialsContent {
title: string
items: TestimonialItem[]
}

export interface TestimonialsSection {
id: string
type: 'testimonials'
content: TestimonialsContent
}

Widen:

SiteSection

to include TestimonialsSection.

Add:

isTestimonialsSection()

consistent with existing guards.

No:

rating
mediaId
imageAltText
location
company
jobTitle
date
source
provider
verified

in Step 1.19.

================================================================
3. VALIDATION
   ================================================================

Section title:

required string
trim
1..100

Items:

array
1..10

customerName:

required string
trim
1..120

quote:

required string
trim
1..1000

Use repository-style controlled 400 errors.

Expected messages may follow Claude's proposed wording:

Testimonials title is required

Testimonials title must be 100 characters or fewer

Testimonials must include at least one testimonial

Testimonials cannot exceed 10 testimonials

Testimonial name is required

Testimonial name must be 120 characters or fewer

Testimonial quote is required

Testimonial quote must be 1000 characters or fewer

Keep messages consistent with existing validation conventions.

================================================================
4. AUTHORITATIVE ITEM IDENTITY
   ================================================================

Follow the exact Services/Gallery authoritative ID model.

NEW item:

client omits id
server assigns randomUUID()

EXISTING item:

client supplies id
id must match an authoritative currently-stored Testimonial item

Unknown supplied id:

400 Unknown testimonial item id

Duplicate supplied id:

400 Duplicate testimonial item id

Malformed stored item identities:

500 Home testimonials section invalid

Omitted existing item:

removed

Request array order:

persisted order
render order

Do NOT accept arbitrary client-generated item IDs.

================================================================
5. FULL-STATE SEMANTICS
   ================================================================

Testimonials PUT represents the complete desired Testimonials state.

For an existing authoritative item:

start from the stored item

preserve unknown FUTURE SERVER/STORED metadata

overwrite editor-owned fields:

customerName
quote

For a new item:

persist ONLY approved current fields:

id
customerName
quote

Unknown CLIENT request fields must be discarded.

Do not let:

{
customerName,
quote,
hackedField,
futureServerField
}

create arbitrary persisted properties for a new item.

================================================================
6. RESERVED SECTION IDENTITY
   ================================================================

Canonical:

id === 'testimonials'
type === 'testimonials'

Reserved scan includes any section where:

id === 'testimonials'
OR
type === 'testimonials'

Valid existing state:

exactly one canonical Testimonials section

Invalid:

duplicate reserved identity
wrong id/type pair

Controlled error:

500 Home testimonials section invalid

Do not silently repair corrupted Home data.

================================================================
7. ENDPOINT
   ================================================================

Add:

PUT /tenants/:tenantId/site/pages/home/sections/testimonials

Authorization:

requirePlatformAdmin

Do NOT allow:

OWNER
ADMIN
STAFF

CMS editing remains PLATFORM_ADMIN-only.

Use the existing authenticated tenant router / CSRF behavior.

No public mutation route.

================================================================
8. SITE SERVICE
   ================================================================

Add:

validateTestimonialsInput

and:

upsertHomeTestimonials

to the existing site service architecture.

Use:

mutateWorkingHome

Do NOT create:

testimonialService.js
generic sectionService.js
CMS framework

This remains another section-specific validator/mutator using the established
shared working-home transaction envelope.

================================================================
9. INSERTION RULE
   ================================================================

On FIRST creation:

if Contact exists:
insert Testimonials immediately BEFORE Contact

else:
append Testimonials

With current normally-created sections this should yield:

Hero
Services
Gallery
Testimonials
Contact

when all are present.

On editing an existing valid Testimonials section:

preserve its existing section array index.

IMPORTANT:

Do NOT attempt to canonicalize all middle-section order.

Do NOT change Gallery insertion behavior.

Do NOT solve add-order-dependent section positioning in this milestone.

Step 1.20 will deliberately introduce cross-section composition/order.

================================================================
10. NO SECTION DELETE
    ================================================================

Do NOT introduce:

DELETE Testimonials
Remove Testimonials Section

Existing sections do not yet have a general section-removal model.

Step 1.20 will address section composition/removal consistently.

Item removal INSIDE Testimonials is supported.

Section removal is not.

================================================================
11. WORKING / PUBLISHED ISOLATION
    ================================================================

Testimonials Save modifies:

WORKING Home only.

Must NOT modify:

published/current

Expected:

working Testimonials A+B

Publish

normal public:
A+B

edit working:
A+C

normal public:
A+B

preview:
A+C

Republish

normal public:
A+C

publishSite remains section-agnostic.

Do NOT add Testimonials-specific publishing behavior.

================================================================
12. NO MEDIA CHANGES
    ================================================================

Testimonials are text-only.

Do NOT modify:

mediaService.js

hydrateSiteMedia

requireGalleryMedia / equivalent Gallery media validators

GCS adapter

Media API

Media picker

Gallery upload UX

Media schema

No media abstraction/generalization is justified in this milestone.

Testimonials is NOT the second Media consumer.

================================================================
13. PUBLIC REPRESENTATION
    ================================================================

Public SiteDefinition passes:

{
id,
customerName,
quote
}

for each Testimonial item.

No internal metadata.

No rating.

No media fields.

No verification/provider fields.

================================================================
14. SHARED COMPONENT
    ================================================================

Add:

platform/packages/site-components/src/Testimonials.tsx

Export it from the package index.

Use a neutral, responsive static layout.

No:

carousel
slider
autoplay
animation
masonry
external dependency

Suggested semantic structure:

<section>
  <h2>...</h2>

  <figure>
    <blockquote>...</blockquote>
    <figcaption>Customer Name</figcaption>
  </figure>
</section>

Do NOT use <cite> merely for the customer's name.

Do NOT manually inject decorative quote characters into the underlying text
data.

Styling may provide presentation if desired, but the quote content itself
remains the customer's entered text.

================================================================
15. DEFENSIVE PUBLIC RENDERING
    ================================================================

Server writes are validated, but manual Firestore corruption must not crash the
public site.

Testimonials component should defensively require:

non-empty title as appropriate

per-item:
non-empty customerName
non-empty quote

Malformed individual item:

skip

Zero renderable items:

return null

Do not mutate or repair stored content during rendering.

================================================================
16. SECTION RENDERER
    ================================================================

Add:

case 'testimonials'

to the public SectionRenderer.

Use:

isTestimonialsSection

where appropriate instead of unsafe casts.

Do not alter Hero/Services/Gallery/Contact behavior.

================================================================
17. PORTAL API
    ================================================================

Extend:

platform/apps/portal/lib/site.ts

with:

upsertHomeTestimonials(...)

using the existing authenticated API helper.

Do not create a new transport layer.

================================================================
18. PORTAL EDITOR
    ================================================================

Add:

TestimonialsEditor.tsx

Seed from the ALREADY-LOADED working SiteDefinition using:

findHomePage
isTestimonialsSection

Do NOT make an extra site GET merely to enter editor mode.

Fields:

Section Title

ordered Testimonial rows:

Customer Name
Quote

Controls:

Add Testimonial
Remove
Move Up
Move Down
Save
Cancel

No:

rating control
stars
media picker
upload
drag/drop

================================================================
19. PORTAL VALIDATION GUARDRAILS
    ================================================================

Mirror server limits in the editor:

title maxLength=100
customerName maxLength=120
quote maxLength=1000

Quote should use a textarea.

Disable Save when the editor is obviously invalid, including:

blank title
zero Testimonials
blank customer name
blank quote

Server validation remains authoritative.

Do not attempt to duplicate every server invariant client-side.

================================================================
20. REORDER UX
    ================================================================

Request order is persisted/render order.

Implement:

Move Up
Move Down

Disable Move Up for first row.

Disable Move Down for last row.

Do not implement drag/drop infrastructure.

Use stable local React keys separate from persisted server ids where needed,
following Services/Gallery conventions.

================================================================
21. BUSINESS WEBSITE INTEGRATION
    ================================================================

Extend BusinessWebsite editor union with:

'testimonials'

Add:

Add Testimonials

when absent

and:

Edit Testimonials

when present.

Do not redesign the overall Manage Website UI.

No N+1 requests.

No eager Testimonials fetch.

Use loaded SiteDefinition.

================================================================
22. AUTHORIZATION TESTS
    ================================================================

Testimonials PUT:

unauthenticated -> 401

OWNER -> 403

ADMIN -> 403

STAFF -> 403

PLATFORM_ADMIN -> success

Do not broaden CMS permissions.

================================================================
23. VALIDATION TESTS
    ================================================================

Cover:

valid title/item

title missing
title blank
title too long

items missing/not array as appropriate
zero items
11 items

customerName missing
customerName blank
customerName too long

quote missing
quote blank
quote too long

trimming

new item gets server UUID

existing item ID preserved

unknown supplied ID -> 400

duplicate supplied ID -> 400

omitted existing item removed

request order preserved

unknown client fields dropped

stored future metadata preserved for existing authoritative item if that is
the established Services/Gallery behavior

================================================================
24. SECTION INVARIANT TESTS
    ================================================================

Canonical section works.

Wrong:

id='testimonials'
type='somethingElse'

-> controlled 500

Wrong:

id='somethingElse'
type='testimonials'

-> controlled 500

Duplicate reserved Testimonials identities:

controlled 500

Malformed stored item ID:

controlled 500

Do not repair.

================================================================
25. INSERTION TESTS
    ================================================================

Hero + Services + Gallery + Contact:

result:

Hero
Services
Gallery
Testimonials
Contact

Contact exists but some middle sections absent:

Testimonials goes immediately before Contact.

No Contact:

Testimonials appends.

Existing Testimonials:

update preserves existing section index.

Do NOT add tests expecting universal canonical cross-section order independent
of section creation history.

That belongs to Step 1.20.

================================================================
26. SNAPSHOT TESTS
    ================================================================

Mandatory:

working Testimonials A+B

publish

normal public:
A+B

edit working to:
A+C

assert published snapshot bytes unchanged

normal public:
A+B

preview:
A+C

republish

normal public:
A+C

No Testimonials-specific publish transformation.

================================================================
27. PUBLIC COMPONENT CHECKS
    ================================================================

Do not introduce a new React testing framework solely for this.

Use existing:

typecheck
lint
build

and lightweight tests only if existing infrastructure already supports them.

Component behavior should include:

valid section renders

quote renders

customer name renders

malformed item skipped

zero valid items -> null

================================================================
28. FILES EXPECTED TO ADD
    ================================================================

Expected:

platform/packages/site-components/src/Testimonials.tsx

platform/apps/portal/app/businesses/TestimonialsEditor.tsx

server/test/testimonialsService.test.js

Do not add unrelated files.

================================================================
29. FILES EXPECTED TO MODIFY
    ================================================================

Expected:

server/services/siteService.js

server/routes/tenants.js

server/test/tenantRoutes.test.js

platform/packages/site-schema/src/index.ts

platform/packages/site-components/src/index.ts

platform/apps/site-renderer/components/SectionRenderer.tsx

platform/apps/portal/lib/site.ts

platform/apps/portal/app/businesses/BusinessWebsite.tsx

Additional focused existing test changes are acceptable if genuinely required.

================================================================
30. FILES THAT SHOULD REMAIN UNCHANGED
    ================================================================

Do not alter behavior/code unnecessarily in:

server/services/mediaService.js
server/client/gcsClient.js
server/services/leadService.js
server/routes/publicLeads.js

Hero mutation/component/editor
Services mutation/component/editor
Gallery mutation/component/editor
Contact mutation/component/editor

publishSite
unpublishSite
mutateWorkingHome

FakeDb unless an actual missing behavior unexpectedly requires it

renderer next.config.ts

Media infrastructure

Lead CRM infrastructure

================================================================
31. VERIFY
    ================================================================

Backend:

cd server
npm test

Run repository-appropriate StandardJS/syntax checks.

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

All previous tests must remain green.

================================================================
32. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Existing DEV environment.

1. Portal -> Business -> Manage Website.

2. Click:

Add Testimonials

3. Add:

Section title:
What Our Customers Say

Testimonial 1:
Name:
Jane Smith

Quote:
Fantastic work. The new shower looks amazing.

Testimonial 2:
Name:
Mike Johnson

Quote:
Fast, professional, and exactly what we wanted.

4. Reorder with Move Up/Down.

Verify boundary controls behave correctly.

5. Save.

Expected:
working only.

6. Normal public:

Testimonials absent / old published state.

7. DEV Preview:

Testimonials visible.

8. Inspect working Firestore Home.

Persisted Testimonials should contain ONLY intended schema fields plus any
normal server-managed existing metadata.

No rating/media/review fields.

9. Publish/Republish.

10. Normal public:

Testimonials visible.

11. Edit working Testimonial text.

12. Normal public:

old quote remains.

13. Preview:

edited quote appears.

14. Republish.

15. Normal public:

edited quote appears.

16. Confirm:

Gallery works unchanged
Media upload works unchanged
Contact works unchanged
Lead capture/inbox/status/notes unchanged

17. Confirm only bakerrang-dev changed.

================================================================
33. FUTURE REVIEWS BOUNDARY
    ================================================================

Do not create compatibility code for future external Reviews.

The intended product distinction is:

Testimonials:
manual curated CMS content

Reviews:
future provider-sourced structured business records

Future Reviews may have:

provider
source
rating
review date
verification/provenance

Those do NOT belong in this Testimonials schema.

================================================================
34. STEP 1.20
    ================================================================

Do not implement it now.

Step 1.20 should be:

SECTION COMPOSITION + ORDERING

Expected design questions:

cross-section Move Up/Move Down
section removal
canonical/default order
working/published behavior
which sections are required vs removable
whether Hero remains required/fixed

The existing add-order caveat is intentionally left for that milestone.

================================================================
35. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Testimonials schema.
4. Why no rating/media was added.
5. Validation.
6. Stable item identity.
7. PUT route.
8. Authorization.
9. Insertion rule.
10. Full-state semantics.
11. Reserved identity behavior.
12. Public component.
13. Portal editor.
14. Ordering controls.
15. Working/published isolation.
16. Tests.
17. Backend result.
18. Platform typecheck/lint/build.
19. Manual DEV validation if performed.
20. Deviations and why.
21. Anything influencing Step 1.20.

Do not implement beyond Step 1.19.