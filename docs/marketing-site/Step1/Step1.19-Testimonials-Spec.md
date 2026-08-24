# Claude Code Assignment — Step 1.19 Testimonials Section

DO NOT modify code.

Step 1.18 — Media Foundation + Gallery Section is complete and manually
verified against bakerrang-dev, including the DEV GCS bucket.

We now want the next public-site capability:

TESTIMONIALS

This milestone should reuse the section-editing, media, working/published, and
public-rendering architecture already established.

Do NOT integrate third-party review providers yet.

============================================================
1. GOAL
   ============================================================

Allow PLATFORM_ADMIN to add/edit a Testimonials section on the Home page.

Visitors should see customer testimonials on the public site.

A testimonial should support the minimum useful information necessary for a
local-service business.

Potential fields:

customerName
quote
rating?
mediaId?

The section itself may have:

title

Determine the cleanest V1 contract.

============================================================
2. IMPORTANT SCOPE BOUNDARY
   ============================================================

This is MANUALLY MANAGED TESTIMONIAL CONTENT.

Do NOT implement:

Google Business Profile integration
Google Reviews API
Yelp
Facebook reviews
review scraping
review synchronization
review request automation
review moderation workflows
public review submission
CRM review requests
star aggregates
schema.org review markup unless naturally trivial and clearly correct
testimonial approval workflows

Those belong later.

============================================================
3. INSPECT CURRENT IMPLEMENTATION
   ============================================================

Inspect actual shipped code from Steps 1.7–1.18, especially:

server/services/siteService.js
server/services/mediaService.js
server/routes/tenants.js

platform/packages/site-schema/src/index.ts
platform/packages/site-components/*
platform/apps/site-renderer/components/SectionRenderer.tsx

platform/apps/portal/app/businesses/BusinessWebsite.tsx
platform/apps/portal/app/businesses/ServicesEditor.tsx
platform/apps/portal/app/businesses/GalleryEditor.tsx
platform/apps/portal/lib/site.ts

server/test/galleryService.test.js
server/test/helpers/fakeDb.js

Document:

- current section mutation conventions
- reserved identity handling
- item stable-ID handling
- media hydration behavior
- working/published isolation
- Gallery insertion behavior
- current portal editor mode structure
- current CMS authorization

Ground the plan in shipped code.

============================================================
4. PRIMARY PRODUCT QUESTION — TESTIMONIAL VS REVIEW
   ============================================================

Evaluate whether the section should be called:

Testimonials

or:

Reviews

or whether the internal type should be testimonials while UI wording can vary.

Because this milestone is manually entered content and NOT provider-sourced
reviews, avoid creating a misleading impression that entries are verified
third-party reviews.

Recommend terminology.

============================================================
5. TESTIMONIAL ITEM CONTRACT
   ============================================================

Evaluate a minimal item such as:

interface TestimonialItem {
id: string
customerName: string
quote: string
rating?: number
mediaId?: string
}

Determine whether each field belongs in V1.

Consider:

customerName:
likely required

quote:
required

rating:
optional?
required?
omit entirely?

mediaId:
optional customer/project image?

Do not add fields merely because testimonial systems often have them.

Potentially defer:

company
job title
location
date
source URL
review provider
verified badge

unless there is a concrete V1 use.

============================================================
6. RATING DECISION
   ============================================================

This deserves explicit thought.

If ratings are supported, determine:

integer only?
1..5?
optional?

Consider whether manually entering a five-star rating creates an unnecessary
"review" implication.

A testimonial quote may stand perfectly well without stars.

Recommend one of:

A. no rating in Step 1.19

B. optional 1..5 rating

C. required 1..5 rating

Explain why.

Do NOT create rating aggregation.

============================================================
7. MEDIA DECISION
   ============================================================

Step 1.18 introduced reusable immutable Media.

Evaluate whether a testimonial should optionally reference:

mediaId

Potential uses:

customer photo
project photo associated with testimonial

But do not force a photo.

If media is supported:

- must be same tenant
- reference existing Media
- do not duplicate storage metadata
- hydrate via existing Media system
- image needs contextual alt text if rendered

Evaluate whether this adds enough value to include now.

Prefer reusing existing media infrastructure if it fits cleanly.

============================================================
8. ALT TEXT IF MEDIA IS USED
   ============================================================

If Testimonial media is included:

do NOT put global alt text on Media.

Store contextual alt text on the testimonial item/use.

Potential:

imageAltText

Rules similar to Gallery:

required when mediaId exists
trim
1..250

No media:
no imageAltText needed.

Determine exact contract.

============================================================
9. SECTION CONTRACT
   ============================================================

Potential:

interface TestimonialsContent {
title: string
items: TestimonialItem[]
}

interface TestimonialsSection {
id: string
type: 'testimonials'
content: TestimonialsContent
}

Recommend exact names and types consistent with site-schema conventions.

============================================================
10. ITEM LIMIT
    ============================================================

Choose a sensible V1 limit.

Potential:

1..10
1..20

Testimonials are larger content blocks than Services.

Avoid an effectively unbounded section.

Recommend exact bound.

============================================================
11. STRING LIMITS
    ============================================================

Recommend exact validation.

Potential:

section title:
1..100

customerName:
1..120

quote:
1..1000

imageAltText:
1..250 if media exists

Keep enough room for real testimonials without allowing enormous page content.

============================================================
12. ITEM IDS
    ============================================================

Follow the established Services/Gallery authoritative identity pattern.

New item:
client omits id
server UUID

Existing item:
supplied id must match authoritative current item

Unknown supplied id:
400

Duplicate supplied id:
400

Omitted current item:
removed

Request array order:
persisted/render order

Do not trust arbitrary client item IDs.

============================================================
13. FULL-STATE EDITOR SEMANTICS
    ============================================================

Use the existing full-state editor-owned pattern.

PUT conceptually:

/tenants/:tenantId/site/pages/home/sections/testimonials

The submitted item array becomes the desired Testimonials state.

Preserve:

existing item future metadata where appropriate

Drop:

unknown client-owned fields

Follow Services/Gallery precedent.

============================================================
14. RESERVED SECTION IDENTITY
    ============================================================

Use canonical:

id === 'testimonials'
type === 'testimonials'

Reserved identity scan:

id === 'testimonials'
OR
type === 'testimonials'

Exactly one canonical section if present.

Duplicate/wrong pair:
controlled 500

Suggested message:

Home testimonials section invalid

Do not silently repair corruption.

============================================================
15. SECTION INSERTION POSITION
    ============================================================

Current conceptual layout:

Hero
Services
Gallery
Contact

Determine Testimonials insertion rule.

My initial preference:

Hero
Services
Gallery
Testimonials
Contact

So on first add:

insert immediately before Contact

but relative to Gallery, ensure Testimonials lands after Gallery when Gallery
exists.

Need account for missing Services/Gallery/Contact.

Recommend deterministic minimal rule.

No arbitrary section ordering yet.

============================================================
16. MEDIA VALIDATION IF USED
    ============================================================

If Testimonial items may reference media:

every mediaId must exist under:

tenants/{tenantId}/media/{mediaId}

Use the existing Media validation/batching infrastructure.

No cross-tenant references.

Media remains immutable/non-deletable.

Do not create Testimonial-specific storage logic.

============================================================
17. MEDIA HYDRATION IF USED
    ============================================================

If media is supported, reuse the existing Gallery media hydration machinery
rather than adding one Firestore read per Testimonial.

Consider generalizing the existing helper only as much as needed.

Potentially hydrate both:

Gallery items
Testimonial media

in one batched same-tenant media-resolution pass.

BUT:

Do not prematurely create a generic CMS hydration framework unless the second
consumer now genuinely proves the shared abstraction.

This is exactly the moment to evaluate whether a small reusable media-reference
hydrator is justified.

Recommend based on actual code.

============================================================
18. WORKING / PUBLISHED SEMANTICS
    ============================================================

Testimonials follow the existing model:

Save:
working Home only

Normal public:
unchanged before publish

Preview:
working Testimonials

Publish/Republish:
public snapshot changes

Automated tests must prove snapshot isolation.

No publish-specific Testimonials code if avoidable.

============================================================
19. PUBLIC REPRESENTATION
    ============================================================

Anonymous SiteDefinition should expose only what renderer needs.

If no media:

id
customerName
quote
rating? as chosen

If media:

plus:
mediaId
imageAltText
src
width
height

Do not expose internal Media metadata.

============================================================
20. PUBLIC COMPONENT
    ============================================================

Add a shared neutral component:

Testimonials

No final design-system polish yet.

Suggested rendering:

section title

testimonial cards/blocks

quote

customer name

optional rating if chosen

optional image if chosen

No:

carousel
autoplay
animation
slider dependency

Responsive static layout.

============================================================
21. SEMANTIC HTML
    ============================================================

Use reasonable semantic markup.

Potential:

<section>
<h2>
<blockquote>
<footer/cite>

Evaluate clean HTML.

Do not misuse <cite> if actual semantics do not fit.

No invented schema.org metadata in this milestone unless clearly correct.

============================================================
22. PORTAL EDITOR
    ============================================================

Add:

TestimonialsEditor.tsx

Follow Services/Gallery editor patterns.

Needs:

section title

ordered testimonials

customer name

quote textarea

rating UI only if rating chosen

optional media selector only if media chosen

required contextual image alt text if media chosen

Add Testimonial
Remove
Move Up
Move Down if useful
Save
Cancel

Do not add drag/drop.

============================================================
23. MEDIA PICKER IF USED
    ============================================================

If Testimonial media is optional:

reuse the bounded recent Media library.

Do NOT duplicate the Gallery upload/media library implementation wholesale.

Evaluate whether:

- selecting existing media only
  or
- uploading from within Testimonials

should be supported.

My preference:

allow selecting existing Media and potentially use the same upload helper, but
do not create another full media-management UI.

Recommend the smallest clean UX.

============================================================
24. UPLOAD DUPLICATION
    ============================================================

If both GalleryEditor and TestimonialsEditor need inline media upload, inspect
whether Step 1.18 left upload/media-picker behavior too tightly coupled to
GalleryEditor.

This may be the first evidence for extracting a small reusable portal component
such as:

MediaPicker
MediaUploader

BUT:

only extract if there is now real duplication.

Do not create a generic media-management framework.

Explain whether this milestone justifies the extraction.

============================================================
25. AUTHORIZATION
    ============================================================

Testimonials are website CMS content.

Keep:

PLATFORM_ADMIN only

unless current code has changed.

Do NOT grant OWNER/ADMIN/STAFF site editing here.

Lead permissions remain unrelated.

============================================================
26. ROUTE
    ============================================================

Likely:

PUT /tenants/:tenantId/site/pages/home/sections/testimonials

PLATFORM_ADMIN only.

Use existing site service/editor patterns.

No public mutation route.

============================================================
27. DELETE SECTION
    ============================================================

Current section editors primarily support upsert/content editing.

Evaluate whether Testimonials needs:

Remove Testimonials section

now.

If existing Services/Gallery do not support full section deletion, do NOT
introduce a one-off delete UX solely here.

Keep consistency.

============================================================
28. TESTIMONIAL ORDER
    ============================================================

Request item array order should equal persisted/render order.

Portal needs a simple way to reorder.

Potential:

Move Up
Move Down

If Services currently lack ordering controls, inspect consistency.

Do not add drag/drop.

============================================================
29. MALFORMED CONTENT
    ============================================================

Public renderer should fail safely.

Malformed Testimonials section or item should not crash the whole site.

Determine which server layer validates/sanitizes persisted section content
today.

Follow existing Gallery/Services behavior rather than inventing a second
content-repair mechanism.

============================================================
30. TESTS — VALIDATION
    ============================================================

Cover chosen contract:

valid item

section title rules

customer name rules

quote rules

item min/max

stable ids

unknown supplied id

duplicate supplied id

unknown client fields

order preservation

rating validation if rating chosen

media validation if media chosen

alt text validation if media chosen

============================================================
31. TESTS — SECTION IDENTITY
    ============================================================

Cover:

canonical Testimonials

wrong id/type pairing

duplicate reserved identity

controlled invariant failure

insert position

existing position preserved

============================================================
32. TESTS — WORKING / PUBLISHED
    ============================================================

Critical:

working Testimonials A+B

publish

normal public A+B

edit working A+C

normal public remains A+B

preview A+C

republish

normal public A+C

No snapshot mutation on working edit.

============================================================
33. TESTS — MEDIA IF INCLUDED
    ============================================================

If testimonial media is supported:

same-tenant media accepted

foreign media rejected

missing media rejected

resolved public descriptors contain only safe fields

working getSite hydration works

published hydration works

old selected media outside recent 50 remains usable

No N+1 media reads.

============================================================
34. TESTS — PUBLIC COMPONENT
    ============================================================

Where current infrastructure permits:

valid Testimonials renders

zero valid items renders null or appropriate behavior

quote/name rendered

rating rendered correctly if used

image alt applied if media used

Do not introduce a large frontend test framework solely for this.

============================================================
35. TESTS — AUTHORIZATION
    ============================================================

Testimonials PUT:

PLATFORM_ADMIN allowed

OWNER 403
ADMIN 403
STAFF 403

No public mutation route.

============================================================
36. PORTAL STATE
    ============================================================

Testimonials editor should use the currently-loaded working SiteDefinition.

No extra site GET merely to enter editor mode.

If media library needed:
load media lazily only when the Testimonial media UI needs it.

Avoid N+1.

============================================================
37. EXISTING FEATURES MUST REMAIN UNCHANGED
    ============================================================

Do not alter behavior of:

Hero
Services
Gallery
Contact
Lead Form
Lead Inbox
Lead Status
Lead Notes
Media upload
Media immutability
Media list
publish lifecycle
preview
public renderer boundaries

All previous automated tests remain green.

============================================================
38. OUT OF SCOPE
    ============================================================

Do NOT implement:

Google reviews
review provider integrations
review import/sync
review request campaigns
public review submissions
aggregate ratings
verified badges
review dates/source links unless explicitly justified
carousel
testimonial autoplay
AI testimonial generation
section drag/drop
site branding/design overhaul
SEO schema
tenant-owner CMS permissions

============================================================
39. FUTURE REVIEW INTEGRATION
    ============================================================

Explain how manually managed Testimonials should coexist with future external
Reviews.

Potential future distinction:

Testimonials:
curated/manual CMS content

Reviews:
provider-sourced structured records

Do not design the provider system now.

Avoid naming/schema choices that make future distinction awkward.

============================================================
40. FUTURE MEDIA REUSE
    ============================================================

If Testimonials becomes the second Media consumer, identify what small Media
abstraction is now legitimately reusable.

Potentially:

same-tenant media reference validation

media hydration

portal media picker

Do NOT over-generalize.

============================================================
41. MANUAL DEV E2E
    ============================================================

Plan:

1. Portal -> Manage Website.

2. Add Testimonials.

3. Create 2 testimonials.

4. Save.

5. Normal public unchanged.

6. Preview shows Testimonials.

7. Publish.

8. Normal public shows Testimonials.

9. Edit working testimonial.

10. Normal public retains old snapshot.

11. Preview shows edit.

12. Republish.

13. Normal public changes.

If media is included:

14. Select tenant media.

15. Verify required contextual alt text.

16. Verify public hydrated image.

17. Verify persisted section contains mediaId but not storage fields/URL.

18. Confirm Gallery/media behavior remains unchanged.

============================================================
42. FILES
    ============================================================

Return exact:

files to add

files to modify

files explicitly unchanged

based on actual repository structure.

============================================================
43. VERIFICATION
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

============================================================
44. ARCHITECTURAL LESSON
    ============================================================

Identify whether this milestone proves any reusable pattern beyond what already
exists.

Potential:

second structured multi-item CMS section

second Media consumer

Do not extract abstractions until real duplication justifies them.

============================================================
DELIVERABLE
============================================================

Return:

1. Current readiness.
2. Testimonials vs Reviews naming decision.
3. Exact item schema.
4. Rating decision.
5. Media decision.
6. Alt-text decision.
7. Section schema.
8. Item/string limits.
9. Stable-ID behavior.
10. Full-state update semantics.
11. Reserved identity behavior.
12. Insertion rule.
13. Media validation/hydration if applicable.
14. Whether existing media code should be generalized.
15. Working/published behavior.
16. Public representation.
17. Shared component design.
18. Portal editor UX.
19. Portal media-picker reuse/extraction decision.
20. Authorization.
21. Endpoint.
22. Tests.
23. Files to add.
24. Files to modify.
25. Files explicitly unchanged.
26. Verification commands.
27. Manual DEV E2E.
28. Concrete risks.
29. Future external Reviews compatibility.
30. What should be Step 1.20.
31. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.