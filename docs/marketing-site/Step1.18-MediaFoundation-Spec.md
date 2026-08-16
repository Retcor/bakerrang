# Claude Code Assignment — Step 1.18 Media Foundation + Gallery Section

DO NOT modify code.

Steps 1.14–1.17 are complete and manually verified against bakerrang-dev.

We are intentionally shifting focus back from deeper CRM functionality toward
public website composition and presentation.

The next milestone is:

MEDIA FOUNDATION + GALLERY SECTION

This is the first BakerRang platform feature that stores tenant-owned binary
media and references that media from published website content.

============================================================
1. GOAL
   ============================================================

Design the smallest correct media architecture that allows an authorized
platform user to:

1. upload images for a tenant
2. view that tenant's uploaded images
3. create/edit a Gallery section on the Home page
4. select tenant-owned images for that Gallery
5. publish the site
6. render those images publicly

This milestone establishes reusable tenant media for future:

business logos
Hero images
service images
Gallery/project photos
testimonial avatars
social/OG images

But Step 1.18 should implement ONLY enough media functionality to support the
Gallery section cleanly.

============================================================
2. CURRENT PLATFORM CONTEXT
   ============================================================

Architecture currently includes:

existing server/
Node/Express
Firestore
Google OAuth/session auth
tenant authorization

platform/apps/portal
authenticated Next.js portal

platform/apps/site-renderer
public Next.js multi-tenant renderer

platform/packages/site-schema
platform/packages/site-components
platform/packages/ui

Runtime:

Google Cloud Run

NOT Kubernetes / GKE.

Data isolation:

DEV Firestore project:
bakerrang-dev

PROD Firestore project:
avian-cable-379805

Development configuration intentionally fails fast when Firestore project
identity is ambiguous.

Public site renderer does NOT read Firestore directly.

Current public architecture:

Renderer
->
sanitized Express public API
->
Firestore

Working/published site snapshots already exist.

Do not violate these boundaries.

============================================================
3. INSPECT CURRENT REPOSITORY
   ============================================================

Inspect actual:

server/package.json
server/app.js
server/config/*
server/routes/*
server/services/*
server/middleware/*
server/test/helpers/fakeDb.js

server/services/siteService.js
server/services/leadService.js

platform/package.json
platform/apps/portal/*
platform/apps/site-renderer/*

platform/packages/site-schema/*
platform/packages/site-components/*
platform/packages/ui/*

Current:

Hero
Services
Contact
BusinessWebsite
section editors
SectionRenderer
published snapshot behavior

Also inspect:

.env.example files
Cloud Run/deployment scripts/config/docs if present
Google Cloud client libraries already installed
existing storage/file-upload code anywhere in the repo
body-size middleware
multipart dependencies
image-related dependencies
Next.js image configuration

Do NOT assume any GCS infrastructure already exists.

============================================================
4. INSPECT CURRENT GOOGLE CLOUD ASSUMPTIONS
   ============================================================

Determine what the repository currently knows about:

Cloud Run service accounts
Application Default Credentials
Firestore project selection
Google Cloud Storage
bucket names
environment variables
deployment environment separation

If no storage infrastructure exists, say so explicitly.

Determine what Cloud Run identity would need permission to do for the proposed
design.

Do not fabricate bucket names or deployed resources.

============================================================
5. PRIMARY ARCHITECTURAL DECISION — UPLOAD PATH
   ============================================================

Evaluate the best V1 upload architecture.

Main options:

A. Browser uploads image bytes to Express API:
Portal
->
multipart POST
->
Express
->
GCS

B. Portal asks API for a signed upload URL:
Portal
->
authenticated API
->
signed GCS upload URL
->
browser uploads directly to GCS
->
API finalization/metadata step

C. another architecture clearly better for this actual repo

Compare:

security
Cloud Run memory
Cloud Run request-size limits
implementation complexity
upload progress
content validation
credential exposure
CORS
GCS signed URL support
future scalability

We do NOT need premature scale engineering.

Recommend the smallest architecture that is still correct.

============================================================
6. DO NOT ASSUME SIGNED URLS ARE AUTOMATICALLY BETTER
   ============================================================

If recommending signed URLs, account for:

- service-account signing capability
- IAM requirements
- browser -> GCS CORS
- how server verifies upload completion
- client spoofing of content metadata
- abandoned uploads
- signed URL expiration
- upload content type
- object naming
- DEV/PROD bucket separation

If recommending API-streamed uploads, account for:

- multipart parsing
- memory vs streaming behavior
- route-specific request limits
- Cloud Run request limitations
- image size validation
- content-type validation

Choose deliberately.

============================================================
7. STORAGE PROVIDER
   ============================================================

Preferred provider is expected to be:

Google Cloud Storage

because the platform already runs on Google Cloud.

Validate whether that is the best fit.

Do NOT introduce:

Cloudinary
S3
Firebase Storage

unless there is a concrete reason GCS is unsuitable.

============================================================
8. DEV / PROD STORAGE ISOLATION
   ============================================================

This is mandatory.

Media DEV and PROD must never share the same bucket/object namespace in a way
that risks accidental cross-environment writes.

Evaluate the cleanest V1 configuration.

Potentially:

MEDIA_BUCKET_NAME

explicitly required.

Preferred behavior:

development:
explicit DEV bucket name
fail fast when missing

production:
explicit PROD bucket name
ideally no hardcoded fallback

Consider whether this is a good opportunity to improve the existing production
Firestore explicit-env TODO, but DO NOT broaden Step 1.18 into deployment
cleanup unless required.

Recommend exact env vars.

Do NOT invent actual bucket names unless they already exist in repo/config.

============================================================
9. MEDIA OWNERSHIP MODEL
   ============================================================

All media must be tenant-owned.

Determine the metadata model.

Potential Firestore structure:

tenants/{tenantId}/media/{mediaId}

Conceptual metadata:

{
objectName,
originalFilename,
contentType,
sizeBytes,
createdAt,
createdByUserId
}

Evaluate exact fields.

Avoid storing unnecessary metadata.

Do NOT store binary image data in Firestore.

============================================================
10. MEDIA ID / OBJECT NAMING
    ============================================================

Server owns media IDs.

Prefer random UUID if consistent.

Evaluate object path such as:

tenants/{tenantId}/media/{mediaId}

or:

tenants/{tenantId}/media/{mediaId}.{ext}

Consider:

content-type
extension trust
path traversal
filename collisions
tenant isolation

Original filename should never control the GCS object path directly.

Recommend exact strategy.

============================================================
11. PUBLIC VS PRIVATE GCS OBJECTS
    ============================================================

This is a critical decision.

Evaluate:

A. publicly readable bucket/object URLs

B. private bucket + server/proxy delivery

C. private bucket + signed read URLs

D. another clean architecture

Important requirements:

Published website images must be stable.

A public page must NOT depend on a short-lived URL stored inside a published
snapshot.

Do not persist expiring signed URLs into site content.

Consider:

security
simplicity
cacheability
CDN/browser behavior
future custom domains
deletion/revocation
tenant isolation

Recommend the correct V1 read model.

============================================================
12. STABLE MEDIA REFERENCES
    ============================================================

Site content should NOT persist arbitrary user-entered URLs for managed media.

Prefer referencing a stable media identity.

Potential Gallery item:

{
id,
mediaId,
altText?
}

or similar.

Then the sanitized public API/renderer can resolve mediaId to a stable public
media URL.

Evaluate whether site snapshots should contain:

mediaId only

or:

sanitized immutable media descriptor

or another model.

This is important for snapshot stability.

============================================================
13. PUBLISHED SNAPSHOT SEMANTICS
    ============================================================

Current publication freezes working site content.

Gallery must preserve that semantic.

Scenario:

working Gallery references:

Media A
Media B

Publish.

Then working Gallery changes to:

Media A
Media C

Expected:

normal public site still shows A+B
preview shows A+C
republish changes public to A+C

Design the schema/service accordingly.

============================================================
14. MEDIA MUTABILITY VS SNAPSHOT STABILITY
    ============================================================

Consider another case:

Gallery snapshot references Media A.

Later someone replaces/overwrites the underlying GCS object for Media A.

That could silently change an already-published snapshot.

Preferred V1 principle:

MEDIA OBJECTS SHOULD BE IMMUTABLE.

Uploading a new image should create a new mediaId/object.

Do NOT overwrite an existing media object's bytes.

If users want a replacement, upload a new object and update working site
references.

Validate this architecture.

============================================================
15. MEDIA DELETION SEMANTICS
    ============================================================

This needs careful design.

If a media item is referenced by:

working site
published snapshot
future sections

deleting the underlying object could break the public site.

Evaluate safe V1 behavior.

Options:

A. no deletion at all in 1.18

B. delete only when unreferenced by working AND published site

C. soft-delete metadata, retain object if published

D. another approach

My initial preference:

DO NOT add destructive media deletion unless reference safety is straightforward
and well-tested.

It is completely acceptable for Step 1.18 upload/library to be:

upload
list/select

with deletion deferred.

Recommend the smallest safe scope.

============================================================
16. MEDIA LIBRARY
    ============================================================

Portal needs enough UI to select Gallery images.

Evaluate whether Step 1.18 needs a general Media Library screen.

Preferred minimal approach:

Gallery editor contains:

Upload Images
Uploaded Images
select/deselect images

Do NOT build a full Digital Asset Manager.

No:

folders
tags
search
bulk organization
media editing

unless needed.

============================================================
17. IMAGE TYPES
    ============================================================

V1 should support common web image formats only.

Evaluate:

JPEG
PNG
WebP

Possibly GIF?

SVG should be considered separately because SVG is active/XML content and can
introduce security concerns when served/rendered improperly.

My preference:

JPEG
PNG
WebP

and reject SVG/GIF initially unless a concrete reason exists.

Recommend exact MIME allowlist.

Do not trust filename extension alone.

============================================================
18. MIME / FILE VALIDATION
    ============================================================

Evaluate how strongly V1 should validate uploaded bytes.

At minimum:

content type allowlist
maximum size

But Content-Type headers can lie.

Determine whether the backend should inspect magic bytes/file signatures for:

JPEG
PNG
WebP

Use a small safe library if appropriate.

Do NOT implement heavyweight image processing solely to sniff formats.

Recommend exact approach.

============================================================
19. FILE SIZE LIMIT
    ============================================================

Choose a reasonable V1 upload maximum for local-business project photos.

Potential:

5 MB
10 MB

Consider smartphone photos.

Do not allow unlimited uploads.

If API-streamed, account for Cloud Run/body parser behavior.

If signed URL, enforce as strongly as practical.

Recommend exact limit.

============================================================
20. IMAGE DIMENSIONS
    ============================================================

Should Step 1.18 validate width/height?

Should it store:

width
height

in media metadata?

This may help public rendering avoid layout shift and support Next/Image.

Evaluate whether a lightweight image metadata library is justified now.

Potential benefits:

intrinsic dimensions
aspect ratios
future layouts

Do NOT implement resizing/cropping yet unless essential.

============================================================
21. IMAGE OPTIMIZATION
    ============================================================

Evaluate where optimization should happen.

Options:

- store original only, let Next/Image optimize at render time
- preprocess on upload
- Cloud Run image proxy
- future Cloud CDN/image pipeline

For Step 1.18, prefer simplicity.

Determine what Next.js site renderer can safely do with GCS-hosted media.

Inspect actual Next version/config.

============================================================
22. NEXT/IMAGE
    ============================================================

Inspect:

site-renderer next.config.*

Determine requirements for externally hosted GCS media.

Evaluate:

remotePatterns
stable hostname
security risks of broad wildcard patterns

Prefer tightly scoped configuration based on environment where possible.

Do not allow arbitrary external image domains through managed Gallery data.

============================================================
23. PUBLIC MEDIA URL CONSTRUCTION
    ============================================================

Do NOT let the browser/working-site editor supply public object URLs.

Determine which layer constructs the public media URL:

server public API
renderer
media service

Prefer one clear source.

If bucket/object naming changes later, persisted site definitions should not
need rewriting.

============================================================
24. FIRESTORE MEDIA METADATA CONTRACT
    ============================================================

Define exact V1 media metadata.

Potential:

{
originalFilename: string,
objectName: string,
contentType: 'image/jpeg' | 'image/png' | 'image/webp',
sizeBytes: number,
width: number,
height: number,
createdAt: number,
createdByUserId: string
}

Decide whether:

status
altText
updatedAt
checksum

are needed.

Avoid speculative fields.

Media should be immutable where practical.

============================================================
25. AUTHORIZATION — MEDIA MANAGEMENT
    ============================================================

Determine roles for:

upload
list/select

Potential:

PLATFORM_ADMIN
OWNER
ADMIN
STAFF

Currently website editing endpoints are PLATFORM_ADMIN-only.

This creates an important product question.

Inspect current portal/business website authorization and roadmap.

Step 1.18 should NOT accidentally grant STAFF general website-editing rights if
the existing CMS is still platform-admin-only.

Separate:

media read/upload permissions

from:

Gallery/site-definition mutation permissions

if necessary.

Recommend the role policy consistent with current product architecture.

Do not casually broaden CMS authorization.

============================================================
26. GALLERY SCHEMA
    ============================================================

Design a Gallery section for shared `site-schema`.

Potential:

interface GalleryItem {
id: string
mediaId: string
altText?: string
}

interface GalleryContent {
title: string
items: GalleryItem[]
}

interface GallerySection {
id: string
type: 'gallery'
content: GalleryContent
}

Evaluate:

- title required/optional
- item minimum/maximum
- stable Gallery item IDs
- altText requirements
- captions
- image ordering

Keep V1 narrow.

No categories/lightbox metadata unless needed.

============================================================
27. ALT TEXT
    ============================================================

Accessibility matters.

Determine whether alt text should be:

required

or:

optional but editable

For project photos, a useful V1 may require alt text per selected image.

But don't make uploads impossible before semantic context is known.

Potential model:

Media has no alt text globally.

Gallery item stores contextual altText.

This allows the same media object to have different alt text in different
sections later.

Evaluate and recommend.

============================================================
28. GALLERY ITEM IDS
    ============================================================

Evaluate whether Gallery items need their own stable ids separate from mediaId.

Potential benefits:

same media used twice
future captions/layout
stable editing

Potential simplicity:

mediaId itself as identity

Follow existing Services-section lessons about server-owned stable item IDs.

Recommend exact approach.

============================================================
29. GALLERY VALIDATION
    ============================================================

Define exact server validation.

Potential:

title:
trim, 1..100

items:
1..20

each:

existing/server-approved item id handling
mediaId required
altText required/optional with max length

Importantly:

Every referenced mediaId must belong to the SAME tenant.

Do not allow cross-tenant media references.

Do not trust client media metadata.

============================================================
30. GALLERY MUTATION ENDPOINT
    ============================================================

Likely:

PUT /tenants/:tenantId/site/pages/home/sections/gallery

Follow Services/Contact editor-owned full-state semantics.

Evaluate:

insert position
reserved identity corruption handling
metadata preservation
stable item IDs
unknown client fields
working-only update
published snapshot untouched

Use existing:

mutateWorkingHome

if appropriate.

Do NOT create a generic section mutation framework.

============================================================
31. GALLERY SECTION POSITION
    ============================================================

Current insertion conventions:

Services after Hero
Contact last

Determine deterministic Gallery insertion behavior.

Potential:

Hero
Services
Gallery
Contact

Recommended if these sections exist.

Need handle cases where some are absent.

Define the smallest deterministic insertion rule.

Do not implement arbitrary drag/drop ordering yet; Step 1.20 is intended for
section composition/order.

============================================================
32. MEDIA EXISTENCE DURING GALLERY SAVE
    ============================================================

When saving Gallery:

all mediaIds must be verified against:

tenants/{tenantId}/media/{mediaId}

Determine whether this validation should occur transactionally with the Home
page update.

Important:

Firestore requires all transaction reads before writes.

Need potentially read:

config
home
N media docs

before site writes.

Evaluate:

item count limit
transaction read cost
FakeDb support

Do not permit a Gallery referencing nonexistent or foreign media.

============================================================
33. MEDIA PUBLIC API
    ============================================================

Current public site API returns a sanitized SiteDefinition.

Determine how Gallery media becomes renderable without exposing private tenant
metadata.

Options:

A. public SiteDefinition expands Gallery items:

{
id,
mediaId,
altText,
src,
width,
height
}

B. separate public media lookup API

C. renderer URL derivation

Recommend the cleanest architecture.

Avoid one public API request per image.

No renderer-side Firestore.

============================================================
34. PUBLIC SNAPSHOT + MEDIA RESOLUTION
    ============================================================

Be explicit about when media resolution happens:

publish time
public API request time
renderer request time

Consider media immutability.

A good design should avoid:

N+1 Firestore reads per Gallery image on every public request

if possible.

Evaluate whether publication should embed sanitized immutable media descriptors
into the published snapshot.

But also consider whether working preview needs similar resolution.

Recommend the right balance.

============================================================
35. SITE-SCHEMA BOUNDARY
    ============================================================

Shared `site-schema` is used by:

server conceptually
portal
renderer
site-components

Determine whether Gallery's persisted schema should contain storage-specific
fields such as:

bucket
objectName

My preference:

NO.

Site schema should remain provider-neutral.

Potential persisted reference:

mediaId + contextual alt text

and resolved/public representation may be separate.

Evaluate actual repo constraints.

============================================================
36. PUBLIC COMPONENT
    ============================================================

Add shared Gallery rendering in:

@bakerrang/site-components

Keep design intentionally neutral for now.

Public design-system polish is a later milestone.

Needs:

responsive layout
semantic section/title
accessible images
reasonable aspect handling

No:

lightbox
carousel
animation
masonry dependency

unless clearly justified.

Simple responsive grid is preferred.

============================================================
37. EMPTY GALLERY
    ============================================================

Persisted Gallery likely should require at least one item.

Renderer should still fail safely:

zero valid/renderable items
-> render null

Unknown/malformed media should not crash the page.

Determine exactly where malformed filtering occurs.

============================================================
38. PORTAL GALLERY EDITOR
    ============================================================

Follow existing editor pattern.

Potential flow:

Manage Website
->
Add Gallery / Edit Gallery
->
Title

Uploaded Images:
[ thumbnail ][ select ]
[ thumbnail ][ select ]

Upload Image

Selected Gallery:
ordered items
alt text
remove

Save
Cancel

Do NOT overbuild visual design.

============================================================
39. IMAGE UPLOAD UX
    ============================================================

Minimal V1:

single-file upload

or multiple-file upload?

Evaluate complexity.

It may be valuable to allow multiple project photos at once, but do not add
complex upload queues unless easy.

Recommend:

single upload
or
small multiple upload

grounded in chosen API architecture.

Need:

uploading
success
validation error
server error

No drag-drop requirement.

============================================================
40. MEDIA LIST BOUNDING
    ============================================================

Do not fetch an unbounded tenant media library forever.

Evaluate:

50 recent media
100 recent media

or whether V1 can reasonably be bounded without pagination UI.

Potential response:

{
media: [...],
hasMore: false
}

If bounding now materially complicates selection of older images, explain.

Avoid silently creating an unbounded media query.

============================================================
41. MEDIA SORTING
    ============================================================

Likely:

createdAt DESC

for media library.

No folder/tag sorting.

============================================================
42. MEDIA SANITIZATION
    ============================================================

Authenticated media API must return approved fields only.

No arbitrary Firestore spread.

Public site must expose only what the renderer needs.

Do not expose:

createdByUserId
internal object metadata

to anonymous users unless genuinely required.

============================================================
43. MEDIA API ROUTES
    ============================================================

Depending on architecture, evaluate routes conceptually like:

GET /tenants/:tenantId/media

POST /tenants/:tenantId/media

or signed-upload lifecycle endpoints.

Define exact routes based on selected architecture.

All tenant media management routes authenticated.

Use:

Cache-Control: no-store

for authenticated media library responses if appropriate.

Binary/object responses may have different cache requirements.

============================================================
44. CORS
    ============================================================

If browser talks directly to GCS:

fully account for required GCS bucket CORS.

If browser uploads to Express:

existing portal -> API CORS/auth/CSRF behavior may already handle it.

Do not propose an architecture that works only after undocumented CORS changes.

Document exact requirements.

============================================================
45. CSRF
    ============================================================

Authenticated media management mutations must preserve existing CSRF behavior.

If using signed direct upload:

the API endpoint that issues/finalizes upload still requires authenticated
tenant authorization + CSRF according to existing conventions.

Do not add blanket exemptions.

============================================================
46. REQUEST SIZE
    ============================================================

Inspect current:

express.json 10 MB behavior
route-specific parsers
Cloud Run request constraints

If binary upload enters Express, JSON parser should NOT consume multipart body.

Need scoped multipart behavior.

Do not globally raise body limits.

============================================================
47. STORAGE SERVICE BOUNDARY
    ============================================================

Evaluate introducing a focused module such as:

mediaService.js
storageService.js

Preferred division:

Media domain:
tenant authorization assumptions
metadata
media IDs
Firestore records

Storage adapter:
GCS put/delete/url construction

But do NOT create excessive abstraction for one provider.

Recommend the smallest cohesive modules.

============================================================
48. TESTABILITY
    ============================================================

Do NOT make unit tests require real GCS.

Design a small injection/test seam for object storage if needed.

Potential:

storage adapter injected into media service

or module-level `_setStorage`

consistent with current repo conventions.

FakeDb remains Firestore-only.

Determine cleanest pattern.

============================================================
49. LOCAL / DEV TESTING
    ============================================================

We do not currently want developers accidentally uploading to PROD.

Determine local DEV path.

Potential:

real bakerrang-dev GCS bucket

or emulator/local filesystem?

Prefer using a real isolated DEV bucket if operationally simple.

Do not introduce a storage emulator unless it clearly helps.

Document what infrastructure must be manually created/configured before live
verification.

============================================================
50. GCS IAM
    ============================================================

If using GCS, identify required Cloud Run/server permissions.

Examples conceptually:

storage.objects.create
storage.objects.get
storage.objects.delete

Only include what the chosen architecture actually needs.

If signed URLs require:

iam.serviceAccounts.signBlob

or equivalent signing capability, explicitly call it out.

Do not claim current service accounts already have permissions unless repo or
configuration proves it.

============================================================
51. BUCKET SECURITY
    ============================================================

If objects are public:

consider Uniform Bucket-Level Access
public viewer IAM
whether the entire bucket becomes enumerable/listable
object-name opacity
tenant privacy implications

If objects are private:

explain anonymous delivery architecture.

Choose intentionally.

"Public URL" and "publicly listable bucket" are not necessarily the same thing;
be precise.

============================================================
52. CACHE HEADERS
    ============================================================

Images are immutable if the architecture follows §14.

That enables aggressive caching.

Evaluate setting object metadata:

Cache-Control: public, max-age=..., immutable

for public media.

Do not apply no-store to immutable public image bytes.

Authenticated metadata APIs may remain no-store.

Recommend sensible cache semantics.

============================================================
53. ORPHANED UPLOADS
    ============================================================

Depending on upload architecture, evaluate whether an object could exist in
GCS without Firestore metadata.

If so, explain the failure window.

Do NOT build background cleanup jobs in Step 1.18 unless absolutely necessary.

A bounded orphan risk may be acceptable.

Recommend write ordering / cleanup-on-failure behavior.

============================================================
54. ATOMICITY — MEDIA METADATA
    ============================================================

GCS + Firestore cannot participate in one atomic transaction.

Acknowledge this.

Determine desired sequence:

upload object
then metadata

or:

reserve metadata
then upload object
finalize status

Avoid introducing a complex PENDING/READY state unless actually needed.

Choose the cleanest failure semantics.

============================================================
55. PUBLISH FAILURE CASES
    ============================================================

Consider:

working Gallery references media metadata that exists

but GCS object was manually removed.

How should publish behave?

Potential:

validate media metadata only

or

storage existence check

Avoid expensive storage checks if media is immutable and managed correctly.

Define fail-safe behavior.

============================================================
56. GALLERY DUPLICATES
    ============================================================

Should the same mediaId be allowed multiple times in one Gallery?

Probably not for V1.

Recommend explicit behavior.

If disallowed:

server validation should reject duplicate mediaIds.

============================================================
57. GALLERY ORDER
    ============================================================

Selected image order should be explicit.

Portal may provide simple:

Move Up
Move Down

or selection order.

Do NOT introduce drag/drop infrastructure unless already trivial.

Determine smallest usable ordering control.

============================================================
58. MEDIA UPLOAD LIMIT PER TENANT
    ============================================================

Do we need quota enforcement now?

Likely NO.

But consider:

unbounded storage abuse

Authenticated access today is limited and primarily platform-admin CMS.

Recommend whether V1 can defer quotas.

No billing system.

============================================================
59. RATE LIMITING
    ============================================================

Evaluate whether existing tenant limiter sufficiently covers media metadata
routes.

If uploads are large, generic request-count limits may not address resource
abuse.

Do NOT invent complex per-byte quotas.

Recommend minimal V1 protection.

============================================================
60. PUBLIC SECURITY
    ============================================================

Gallery rendering must never permit:

javascript:
data:
arbitrary attacker-controlled external URLs

if using managed media.

Managed Gallery items should derive their src only from trusted server-owned
media metadata/storage configuration.

============================================================
61. SECTION CORRUPTION INVARIANT
    ============================================================

Follow Contact/Services precedent.

Reserved Gallery identity:

id === 'gallery'
OR
type === 'gallery'

Exactly one canonical Gallery if it exists:

id === 'gallery'
type === 'gallery'

Duplicate/wrong pairing should produce a controlled server invariant failure.

Do not silently repair corrupted Home section definitions.

============================================================
62. WORKING / PUBLISHED ISOLATION
    ============================================================

Gallery editor modifies WORKING Home only.

Save:

public normal site unchanged

DEV preview:
working Gallery visible

Republish:
new Gallery becomes normal public content

Automated tests must prove this.

============================================================
63. MEDIA UPLOAD VS PUBLISH
    ============================================================

Uploading media alone must NOT make it appear publicly on the site.

Only:

Gallery working content
->
publish/republish

controls website visibility.

The fact that an image object might technically be publicly fetchable must not
mean it appears in the site's content/navigation.

Distinguish storage visibility from site publication.

============================================================
64. PORTAL ROLE REALITY
    ============================================================

Current Business/Website management UX is heavily PLATFORM_ADMIN oriented.

Inspect whether a tenant OWNER currently has a way to discover/navigate their
business in the portal.

Do NOT accidentally solve full tenant-owner onboarding/navigation in 1.18.

But identify whether current authorization means Gallery/media editing remains
PLATFORM_ADMIN-only for now.

Be explicit.

============================================================
65. TESTS — MEDIA VALIDATION
    ============================================================

Depending on chosen upload architecture, plan coverage for:

allowed MIME types

disallowed MIME

oversized file

empty file

filename/path injection attempt

client-supplied object name ignored

server-owned media ID

server-owned metadata

tenant-scoped storage path

============================================================
66. TESTS — MEDIA METADATA
    ============================================================

Cover:

create media metadata

list media

bounded ordering

approved fields only

unknown fields excluded

cross-tenant isolation

missing tenant

authorization

server-created actor/timestamps if stored

============================================================
67. TESTS — STORAGE ADAPTER
    ============================================================

Do not hit GCS in ordinary unit tests.

Test:

correct object path

correct content type

cache metadata if applicable

upload called with expected bytes/stream

failure cleanup behavior

using a fake/injected adapter.

============================================================
68. TESTS — GALLERY VALIDATION
    ============================================================

Cover:

valid Gallery

item count bounds

title rules

alt text rules

unknown client fields

server-owned/stable Gallery item IDs as chosen

duplicate mediaIds

foreign tenant mediaId

missing mediaId

Gallery identity corruption

position insertion

existing position preservation

============================================================
69. TESTS — SNAPSHOT ISOLATION
    ============================================================

Critical:

upload A/B/C

working Gallery A+B

publish

public snapshot A+B

edit working Gallery A+C

normal public remains A+B

preview A+C

republish

normal public A+C

============================================================
70. TESTS — MEDIA IMMUTABILITY ASSUMPTION
    ============================================================

If media bytes are immutable:

test/service design must provide no overwrite endpoint.

Same mediaId must not accept replacement bytes.

New upload -> new mediaId.

============================================================
71. TESTS — PUBLIC RESOLUTION
    ============================================================

Public SiteDefinition / rendering:

Gallery resolves only same-tenant managed media

anonymous response excludes internal metadata

invalid/missing media fails safely

renderer never accesses Firestore

no arbitrary external URL injection

============================================================
72. TESTS — PUBLIC COMPONENT
    ============================================================

Where existing testing makes sense:

Gallery with valid items renders

zero valid items renders null

alt text applied

No need to introduce a large React testing framework solely for this feature.

Typecheck/lint/build/manual verification may cover component behavior.

============================================================
73. MANUAL DEV INFRASTRUCTURE
    ============================================================

List exactly what must exist before live validation.

Potential:

DEV GCS bucket
bucket region
bucket IAM
bucket CORS if needed
server env var
local ADC permissions

Do NOT execute cloud changes.

Do NOT create resources.

Planning only.

============================================================
74. MANUAL DEV E2E
    ============================================================

Plan an eventual live flow similar to:

1. Configure explicit DEV media bucket.

2. Start API:
   FIRESTORE_PROJECT_ID=bakerrang-dev
   MEDIA_BUCKET_NAME=<DEV bucket>

3. Portal -> Business -> Manage Website -> Gallery.

4. Upload JPEG.

5. Verify object stored under tenant-scoped opaque object name.

6. Verify Firestore:
   tenants/{tenantId}/media/{mediaId}

7. Upload PNG/WebP.

8. Add Gallery working section.

9. Select images + contextual alt text.

10. Save.

11. Normal public site:
    unchanged before publish.

12. DEV preview:
    Gallery visible.

13. Publish/republish.

14. Normal public:
    Gallery visible.

15. Verify browser image URLs come only from managed media.

16. Edit working Gallery ordering/images.

17. Normal public remains old snapshot.

18. Preview shows working.

19. Republish.

20. Normal public changes.

21. Confirm uploaded media did NOT alter Lead/CRM behavior.

22. Confirm only bakerrang-dev + DEV bucket changed.

Refine based on chosen architecture.

============================================================
75. OUT OF SCOPE
    ============================================================

Do NOT implement in Step 1.18:

image cropper
image editor
resizing pipeline unless essential
AI image processing
video
PDF/media documents
folders
tags
search
media quotas/billing
bulk organizer
drag/drop framework
lightbox
carousel
animations
testimonial section
arbitrary section ordering
branding/theme system
custom domains
SEO
Cloud CDN
background cleanup jobs
generic asset-management framework

============================================================
76. FUTURE COMPATIBILITY
    ============================================================

Explain how the design supports later:

Hero image
Service image
Business logo
Testimonials
OG/social images
Gallery expansion

without baking Gallery-specific concerns into the Media model.

Media should remain generic.

Gallery owns contextual fields such as alt text/caption/order where
appropriate.

============================================================
77. ARCHITECTURAL PRINCIPLE
    ============================================================

This milestone should establish:

tenant-owned immutable media
->
server-controlled storage identity
->
authenticated upload/list
->
provider-neutral media references in site content
->
working/published snapshot isolation
->
sanitized public media resolution
->
public renderer
->
cacheable images

Do not frameworkize beyond what this first media consumer proves.

============================================================
DELIVERABLE
============================================================

Return:

1. Current repo/storage readiness.
2. Existing Google Cloud/storage assumptions.
3. Recommended upload architecture.
4. Why that upload architecture wins.
5. Required DEV/PROD env configuration.
6. Required GCS infrastructure/IAM/CORS.
7. Public/private bucket/object decision.
8. Public image delivery strategy.
9. Media Firestore model.
10. Media ID/object naming.
11. Media immutability policy.
12. Media deletion decision.
13. MIME allowlist.
14. MIME/byte validation.
15. File-size limit.
16. Width/height decision.
17. Image optimization strategy.
18. Next/Image configuration strategy.
19. Cache strategy.
20. Media service/storage-adapter design.
21. Testability seam.
22. Authenticated media routes.
23. Media authorization.
24. Media list bounding.
25. GCS/Firestore failure semantics.
26. Gallery site-schema contract.
27. Gallery item/alt-text strategy.
28. Gallery validation.
29. Gallery insertion rule.
30. Gallery mutation transaction design.
31. Media reference validation.
32. Public snapshot/media-resolution strategy.
33. Public SiteDefinition representation.
34. Shared Gallery component.
35. Portal Gallery editor.
36. Upload UX.
37. Lazy-loading/media-library behavior.
38. Files to add.
39. Files to modify.
40. Files explicitly unchanged.
41. FakeDb/storage-fake changes.
42. Backend tests.
43. Platform tests/build checks.
44. Required manual GCP setup.
45. Manual DEV E2E.
46. Concrete risks.
47. Future media-consumer compatibility.
48. What should be deferred to Step 1.19+.
49. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.
Do not create cloud resources.
Do not deploy anything.