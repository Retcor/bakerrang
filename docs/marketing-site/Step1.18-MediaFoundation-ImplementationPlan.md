Implement Step 1.18 — Media Foundation + Gallery Section.

Claude Code inspected the repository and produced an approved plan.

Follow Claude's repository findings and plan, with the corrections below
taking precedence.

Do not expand scope.
Do not create GCP resources.
Do not deploy.

================================================================
GOAL
================================================================

Introduce tenant-owned immutable image Media and the first Gallery section.

V1 must support:

PLATFORM_ADMIN upload image
PLATFORM_ADMIN list/select tenant media
PLATFORM_ADMIN add/edit Home Gallery
working/published isolation
public Gallery rendering

Do NOT implement:

media deletion
media replacement
crop/edit
resize pipeline
video
folders/tags/search
media quotas
bulk organizer
drag/drop
lightbox
carousel
custom domains
SEO
testimonials
generic DAM

================================================================
1. UPLOAD ARCHITECTURE
   ================================================================

Use Claude's chosen architecture:

Portal
->
authenticated multipart POST to Express
->
route-scoped multer memoryStorage
->
server validates bytes
->
GCS
->
Firestore metadata

Do NOT implement signed upload URLs.

Existing portal/API authentication, CORS and CSRF remain authoritative.

Single-file upload only.

Maximum:

10 MB

Allowed:

image/jpeg
image/png
image/webp

Reject:

SVG
GIF
other types

================================================================
2. GCS CONFIGURATION
   ================================================================

Add explicit:

MEDIA_BUCKET_NAME

Required in all real environments.

No hardcoded PROD fallback.

Do not invent bucket names.

DEV and PROD must use different buckets.

Do not tie storage identity unnecessarily to FIRESTORE_PROJECT_ID.

The GCS adapter can use ADC plus the explicit globally-unique bucket name.

Do not assume the bucket necessarily belongs to the Firestore project merely
because it normally will.

================================================================
3. PUBLIC BUCKET IAM — IMPORTANT CORRECTION
   ================================================================

Claude incorrectly stated:

allUsers + roles/storage.objectViewer

does not permit listing.

It DOES.

Current Google Cloud Storage documentation says Storage Object Viewer includes:

storage.objects.get
storage.objects.list

For this architecture we want anonymous object GET but no anonymous object
listing.

Required manual GCP design:

Uniform Bucket-Level Access:
enabled

Public Access Prevention:
must NOT be enforced for this bucket

allUsers:
roles/storage.legacyObjectReader

The Legacy Object Reader role provides object GET without storage.objects.list.

Do NOT configure allUsers with roles/storage.objectViewer.

If organization-level Public Access Prevention prevents this, report that live
GCP setup is blocked and a private-delivery architecture would need to be
reconsidered. Do not silently work around it in code.

Public media is PUBLIC.

Opaque UUID object names reduce casual discoverability only.

Do NOT describe UUIDs as authorization, secrecy, or a security boundary.

================================================================
4. SERVER STORAGE PERMISSIONS
   ================================================================

The authenticated API identity needs sufficient bucket permissions to:

create objects

and perform failure-cleanup deletion.

Use the least practical bucket-scoped IAM.

Do not require:

signBlob

because signed URLs are not used.

Do not encode IAM provisioning in application code.

================================================================
5. MEDIA MODEL
   ================================================================

Firestore:

tenants/{tenantId}/media/{mediaId}

Exact V1 fields:

{
originalFilename,
objectName,
contentType,
sizeBytes,
width,
height,
createdAt,
createdByUserId
}

No:

binary bytes
tenantId
mediaId
altText
updatedAt
status
checksum

Media is immutable.

================================================================
6. ORIGINAL FILENAME
   ================================================================

originalFilename is display metadata only.

It must NEVER affect the GCS path.

Normalize defensively for storage/display:

- string only
- remove/avoid path semantics
- reasonable max length, e.g. 255 characters
- do not allow client pathname components to become storage paths

Do not overbuild filename handling.

================================================================
7. MEDIA ID / OBJECT NAME
   ================================================================

Server:

mediaId = randomUUID()

Object:

tenants/{tenantId}/media/{mediaId}

No extension required.

Never derive path from:

original filename
client id
client object name

================================================================
8. GCS IMMUTABILITY — REQUIRED CORRECTION
   ================================================================

Do not rely solely on "there is no overwrite route."

The storage adapter's create/write operation must use a create-only GCS
precondition equivalent to:

preconditionOpts: {
ifGenerationMatch: 0
}

Therefore the put succeeds only if no live object already exists at the object
name.

An existing object at the same objectName must NOT be overwritten.

Map an impossible/rare collision safely rather than replacing bytes.

This makes:

new upload -> new mediaId -> new object

a storage-enforced invariant.

================================================================
9. IMAGE VALIDATION
   ================================================================

Do not trust:

filename extension
browser Content-Type

Flow:

1. reject declared MIME outside jpeg/png/webp
2. inspect image bytes using the chosen lightweight image-size library
3. determine detected type + width + height
4. require detected type in:
   jpg
   png
   webp
5. require declared type to correspond to detected type
6. require positive valid width/height
7. reject malformed/empty image

This is header/signature validation, not a claim that the entire image file
has undergone a full security decode.

================================================================
10. AUTHORITATIVE CONTENT TYPE — REQUIRED CORRECTION
    ================================================================

Persist and send to GCS the canonical type derived from detected bytes:

jpg:
image/jpeg

png:
image/png

webp:
image/webp

Do NOT persist the client-declared MIME merely because it matched.

The detected bytes are authoritative.

================================================================
11. MEDIA TIMESTAMP / ACTOR
    ================================================================

createdAt:
server Date.now()

createdByUserId:
authenticated req.user.id

Client cannot supply either.

Media ID / timestamp / metadata must be server-owned.

================================================================
12. TENANT EXISTENCE BEFORE STORAGE WRITE — REQUIRED
    ================================================================

PLATFORM_ADMIN can call tenant routes without membership.

Before uploading image bytes to GCS:

verify:

tenants/{tenantId}

exists.

Missing tenant:

404 Tenant not found

Do not upload an object for a tenant that does not exist.

Recommended flow:

validate input/image
->
verify tenant exists
->
GCS create-only put
->
Firestore metadata write

Use current repository conventions.

Do not weaken tenant checks merely because only platform admins may upload.

================================================================
13. GCS + FIRESTORE FAILURE SEMANTICS
    ================================================================

GCS and Firestore cannot share one transaction.

Use:

object first
metadata second

because persisted metadata pointing at a known-nonexistent object is worse
than an unreferenced orphan object.

If metadata succeeds:
success

If metadata definitively fails:
best-effort object cleanup may be attempted

IMPORTANT:

cleanup must be conservative.

If the metadata write outcome is ambiguous and application code cannot safely
establish that metadata was not committed, prefer leaving an unreferenced
opaque object over deleting bytes that persisted metadata might reference.

No PENDING state.

No cleanup job.

No orphan scanner.

Report exact failure semantics.

================================================================
14. NO MEDIA DELETION
    ================================================================

No authenticated delete route.

No public delete route.

No replace route.

Private adapter deletion exists only for safe/best-effort failed-upload
cleanup.

Referenced Media cannot be destructively removed by Step 1.18.

================================================================
15. OBJECT CACHE CONTROL
    ================================================================

At upload set immutable public cache metadata:

Cache-Control:
public, max-age=31536000, immutable

Safe because bytes cannot be overwritten under a mediaId/objectName.

Authenticated media API responses use:

Cache-Control: no-store

including BOTH:

GET media
POST media

Do not no-store the public image bytes.

================================================================
16. GCS PUBLIC URL
    ================================================================

Storage adapter owns stable public URL construction.

Conceptual:

https://storage.googleapis.com/{bucket}/{objectName}

Do not persist the complete public URL in Firestore or site content.

Do not accept a client URL.

Do not derive host from Gallery input.

Site schema remains storage-provider-neutral.

================================================================
17. STORAGE ADAPTER
    ================================================================

Add focused adapter consistent with Claude's plan:

server/client/gcsClient.js

Expected operations:

putObject
deleteObject
publicUrl

putObject must enforce:

create-only ifGenerationMatch: 0

correct canonical contentType

immutable Cache-Control metadata

Do not expose a generic overwrite operation.

================================================================
18. MEDIA SERVICE
    ================================================================

Add:

server/services/mediaService.js

Responsibilities:

tenant existence validation
image validation
media UUID
Firestore metadata
storage adapter call
safe failure handling
media list
Gallery media existence validation
Gallery resolution

Use repository-style injectable seams:

_setDb
_setStorage

Unit tests must never require GCS.

================================================================
19. MEDIA AUTHORIZATION
    ================================================================

Keep Media management PLATFORM_ADMIN-only.

Do NOT grant:

OWNER
ADMIN
STAFF

website/media editing rights in this milestone.

This is consistent with current CMS authorization.

Lead CRM authorization remains separate and unchanged.

================================================================
20. MEDIA ROUTES
    ================================================================

Authenticated tenant routes:

POST /tenants/:tenantId/media

GET /tenants/:tenantId/media

Both PLATFORM_ADMIN only.

POST:

route-scoped multer.single('file')
10 MB max
201
Cache-Control: no-store

GET:

Cache-Control: no-store
200

No global multipart parser.

Do not change existing express.json limit.

================================================================
21. MULTER ERROR HANDLING
    ================================================================

Map file-size excess cleanly:

413

and invalid image content to appropriate 400 errors.

Do not expose internal multer/GCS stack traces.

Only one file per request.

================================================================
22. PORTAL MULTIPART HELPER
    ================================================================

Add:

apiUpload(...)

only if consistent with current api.ts architecture.

It must preserve:

credentials
CSRF header
existing single-403 refresh/retry behavior where practical

CRITICAL:

DO NOT manually set the multipart Content-Type header when using FormData.

The browser must generate:

Content-Type: multipart/form-data; boundary=...

Setting it manually would omit/break the boundary.

================================================================
23. MEDIA LIST
    ================================================================

Bound the normal library query:

orderBy('createdAt', 'desc')
limit(51)

Return:

{
media: at most 50 recent entries,
hasMore
}

Approved authenticated media representation may include:

id
originalFilename
contentType
sizeBytes
width
height
createdAt
src

Do NOT return:

objectName
createdByUserId
unknown Firestore fields

unless a concrete UI need exists.

================================================================
24. EXISTING SELECTED MEDIA OUTSIDE RECENT 50 — REQUIRED
    ================================================================

A Gallery can outlive the recent-media window.

Example:

existing Gallery references media A

tenant later uploads 70 newer images

GET /media returns only recent 50

Gallery A must STILL remain renderable/editable in the portal.

Therefore reuse the media-resolution/hydration helper on authenticated working:

getSite(tenantId)

as well as:

getPublicSite(tenantId)

Authenticated getSite should return a COPY of the working SiteDefinition whose
Gallery items are hydrated with:

src
width
height

when media resolves.

Do NOT persist those fields back into Firestore.

This gives the GalleryEditor the selected image thumbnail/intrinsic dimensions
even when that media is no longer in the recent 50 library.

Recent media list remains bounded at 50.

Do not remove existing selected items merely because they are absent from the
recent library response.

================================================================
25. GALLERY PERSISTED SCHEMA
    ================================================================

Provider-neutral persisted Gallery:

GalleryItem {
id: string
mediaId: string
altText: string
}

GalleryContent {
title: string
items: GalleryItem[]
}

GallerySection {
id: 'gallery' conceptually
type: 'gallery'
content: GalleryContent
}

Resolved/read-time Gallery items may additionally contain:

src
width
height

These fields are read-model hydration only.

Never persist:

src
width
height
bucket
objectName

================================================================
26. ALT TEXT — OVERRIDE CLAUDE
    ================================================================

Media itself has NO altText.

Gallery usage DOES.

For Step 1.18, Gallery item altText is REQUIRED.

Rules:

string
trim
1..250 characters

Blank:

400 / editor validation

Rationale:

upload is context-neutral and can occur without alt text

but once a project image is intentionally placed into a public Gallery it is
meaningful page content and should receive contextual alternative text.

Do not put global alt text on Media.

Future truly-decorative image consumers may define different semantics.

================================================================
27. GALLERY ITEM IDS
    ================================================================

Gallery item IDs are separate from mediaId.

New item:

client omits id
server randomUUID()

Existing item:

supplied id must match an authoritative existing Gallery item id

Unknown supplied id:

400

Duplicate supplied ids:

400

Do NOT accept arbitrary client-generated existing identities.

Follow the authoritative identity pattern already established by Services.

Duplicate mediaId in the same Gallery:

400

================================================================
28. GALLERY VALIDATION
    ================================================================

title:

required string
trim
1..100

items:

array
1..20

each:

mediaId required
altText required 1..250
media belongs to SAME tenant
duplicate mediaId rejected
stable item identity rules
unknown fields dropped

Ignore client:

src
width
height
objectName
bucket

Missing or foreign media:

400 Gallery image not found

================================================================
29. GALLERY RESERVED IDENTITY
    ================================================================

Follow Services/Contact precedent.

Any section where:

id === 'gallery'
OR
type === 'gallery'

participates in reserved identity validation.

Valid state:

exactly one canonical section with:

id === 'gallery'
type === 'gallery'

when Gallery exists.

Duplicate/wrong pairing:

500 Home gallery section invalid

Do not silently repair corruption.

================================================================
30. GALLERY INSERTION
    ================================================================

On first add:

insert immediately BEFORE Contact when Contact exists

otherwise append to current sections

This yields the intended current convention:

Hero
Services
Gallery
Contact

when all sections exist.

If an existing valid Gallery is edited:

preserve its current section index.

No general reordering yet.

================================================================
31. MEDIA EXISTENCE FOR GALLERY SAVE
    ================================================================

Every mediaId must be resolved structurally under:

tenants/{tenantId}/media/{mediaId}

Use batched Firestore reads.

Foreign-tenant media must fail just like nonexistent media.

Because Media has:

no delete endpoint
no mutation endpoint

the media-existence validation may occur immediately before
mutateWorkingHome without coupling the existing working-home mutation helper
to database reads.

Do not trust client media descriptors.

================================================================
32. GALLERY WORKING MUTATION
    ================================================================

Add expected route:

PUT /tenants/:tenantId/site/pages/home/sections/gallery

PLATFORM_ADMIN only.

Full editor-owned desired-state semantics like Services.

Working site ONLY.

Do not write published/current.

Preserve:

section position
unknown future section/content metadata where consistent with Services
existing authoritative item IDs

Rebuild editor-owned Gallery fields safely.

================================================================
33. SITE-SCHEMA READ MODEL
    ================================================================

It is acceptable in V1 for shared Gallery item typing to contain optional
resolved-only:

src
width
height

if that is the smallest fit with the current single SiteDefinition model.

But document/enforce:

persisted form:
mediaId + contextual fields only

hydrated response form:
may additionally contain src/dimensions

Server mutation code must always strip resolved fields before persistence.

Do not add storage provider fields to site-schema.

================================================================
34. MEDIA HYDRATION HELPER
    ================================================================

Build one media-resolution operation that can hydrate Gallery items
field-by-field from same-tenant managed Media.

Use batched Firestore getAll, not one query per image.

Use it for:

authenticated getSite working response
public getPublicSite working preview response
public getPublicSite published snapshot response

Hydration must:

create a returned copy
not mutate persisted objects
skip malformed/missing Media safely
construct src only through trusted storage adapter
return width/height from sanitized metadata
strip internal metadata

No renderer Firestore access.

================================================================
35. SNAPSHOT SEMANTICS
    ================================================================

Persisted working Gallery:

media A+B

Publish:

snapshot contains mediaId references A+B

Edit working:

A+C

Expected:

authenticated working getSite:
A+C hydrated

normal public:
A+B hydrated

preview:
A+C hydrated

Republish:

normal public:
A+C hydrated

publishSite itself remains section-agnostic.

Do NOT embed GCS URLs into persisted published snapshots.

================================================================
36. MANUALLY MISSING STORAGE OBJECT
    ================================================================

No application deletion exists.

Gallery validation/public resolution may trust valid Media metadata rather than
performing a GCS existence check on every save/request.

If an operator manually removes a backing GCS object, its URL may fail to load.

Do not add per-request GCS existence calls or a reconciliation system in 1.18.

This is an operational corruption case, not a normal application state.

================================================================
37. PUBLIC SITE RESPONSE
    ================================================================

Anonymous hydrated Gallery items expose only what rendering needs:

id
mediaId
altText
src
width
height

Do NOT expose:

objectName
originalFilename
sizeBytes
createdByUserId
bucket configuration

No separate per-image public lookup requests.

================================================================
38. PUBLIC GALLERY COMPONENT
    ================================================================

Add neutral shared Gallery component.

Simple responsive grid.

Use plain:

<img>

not Next/Image in 1.18.

Include:

src
alt
width
height
loading="lazy"

No:

lightbox
carousel
masonry dependency
animation

Render null if zero valid hydrated items.

Do not change renderer next.config for image domains.

================================================================
39. PORTAL GALLERY EDITOR
    ================================================================

Add focused GalleryEditor consistent with existing CMS editor patterns.

Needs:

title

single-file Upload Image

recent Uploaded Images library

selected Gallery list

required alt text per selected item

Move Up
Move Down
Remove

Save
Cancel

No drag/drop.

No general Media Library screen.

Existing selected Gallery items use hydrated working-site data so they remain
visible even when outside recent 50 media results.

================================================================
40. UPLOAD UX
    ================================================================

Single-file only.

States:

idle
uploading
success
validation error
server error

On successful upload:

add returned Media item to the current recent-media UI

Uploading Media by itself does NOT change working Gallery content.

Uploading Media by itself does NOT change published site content.

================================================================
41. MEDIA LIBRARY LAZY LOADING
    ================================================================

No media request on:

Businesses initial load
ordinary Leads
ordinary Manage Website load unless Gallery editor is opened

Recent media library GET occurs when Gallery editor opens.

Existing Gallery read hydration via getSite is acceptable because it is needed
to render/edit current Gallery selections.

No count badges.

================================================================
42. IMAGE DIMENSIONS
    ================================================================

Extract and store:

width
height

Require valid positive integer dimensions.

No resizing.

No cropping.

No derived thumbnails.

No image optimization pipeline.

Public browser uses original immutable object.

================================================================
43. TEST STORAGE SEAM
    ================================================================

Unit tests MUST NOT contact GCS.

Add injected fake storage consistent with repo conventions.

Fake should record:

putObject arguments
deleteObject calls
publicUrl

Assert:

opaque tenant object path

detected canonical MIME

immutable Cache-Control

create-only precondition expectation

No overwrite behavior.

================================================================
44. FAKEDB
    ================================================================

Add only the smallest missing Firestore feature:

getAll(...refs)

returning snapshots in requested order.

Exercise it through Gallery/media tests.

No broader query framework changes.

================================================================
45. TEST — MEDIA VALIDATION
    ================================================================

Cover:

JPEG
PNG
WebP

SVG rejected
GIF rejected
other MIME rejected
empty image rejected
declared/detected mismatch rejected
mislabelled non-image rejected

canonical detected contentType persisted

valid positive dimensions persisted

oversized route -> 413

original filename never affects objectName

client metadata ignored

================================================================
46. TEST — IMMUTABILITY
    ================================================================

Assert storage put is invoked with create-only semantics.

No replace/overwrite API.

Two uploads yield:

different mediaId
different objectName

If fake storage supports a collision simulation:

existing object must not be overwritten.

Do not create elaborate collision infrastructure solely for this.

================================================================
47. TEST — TENANT BEFORE UPLOAD
    ================================================================

Missing tenant:

404 Tenant not found

and:

fakeStorage.putObject was NOT called

This explicitly prevents storage writes for nonexistent tenants.

================================================================
48. TEST — FAILURE SEMANTICS
    ================================================================

GCS failure:

no Firestore media metadata

Metadata failure after successful object upload:

exercise the chosen conservative cleanup behavior

Do not accidentally delete an object when metadata persistence may have
succeeded.

Document exact behavior in final report.

================================================================
49. TEST — MEDIA LIST
    ================================================================

Empty

one item

newest-first

50 -> hasMore false

51 -> 50 + hasMore true

approved fields only

src constructed by storage adapter

internal objectName excluded

createdByUserId excluded

foreign tenant excluded

missing tenant -> 404

================================================================
50. TEST — GALLERY ALT/IDENTITY
    ================================================================

Valid Gallery

alt text trim

blank alt text -> 400

missing alt text -> 400

>250 -> 400

new item missing id -> server UUID

existing authoritative id preserved

unknown supplied id -> 400

duplicate supplied ids -> 400

duplicate mediaId -> 400

client src/width/height ignored

unknown properties ignored

================================================================
51. TEST — GALLERY MEDIA OWNERSHIP
    ================================================================

Same-tenant Media:

accepted

missing:

400 Gallery image not found

Media ID that exists under Tenant B but not Tenant A:

400 Gallery image not found

No cross-tenant descriptor leakage.

================================================================
52. TEST — GALLERY INSERTION
    ================================================================

Hero + Services + Contact:

Hero
Services
Gallery
Contact

No Contact:

append Gallery

Existing Gallery:

retain existing index on update

Identity corruption:

controlled 500

================================================================
53. TEST — WORKING/PUBLISHED
    ================================================================

Upload A/B/C

working Gallery A+B

publish

normal public A+B

edit working A+C

authenticated getSite:
A+C

preview:
A+C

normal public:
A+B

republish

normal public:
A+C

No published snapshot mutation during working edit.

================================================================
54. TEST — AUTHENTICATED HYDRATION / BOUNDED LIBRARY
    ================================================================

Create more than 50 Media records.

Existing Gallery references an older Media record outside the recent 50.

GET media:

older selected Media absent from recent library

GET authenticated site:

Gallery selected item is still hydrated with:

src
width
height

Gallery edit/save must be able to preserve it.

This protects existing Gallery content from the media-library pagination bound.

================================================================
55. TEST — PUBLIC HYDRATION
    ================================================================

Public response:

same-tenant managed media only

src server constructed

width/height sanitized

internal metadata excluded

missing/malformed Media skipped

zero resolved items:
renderer renders null

No arbitrary external client URL survives into public Gallery.

================================================================
56. TEST — AUTHORIZATION
    ================================================================

Media POST/GET:

PLATFORM_ADMIN allowed

OWNER 403
ADMIN 403
STAFF 403

Gallery PUT:

same PLATFORM_ADMIN-only CMS contract

No broadening of site-edit authorization.

================================================================
57. TEST — CACHE
    ================================================================

Authenticated media GET:

Cache-Control: no-store

Authenticated media POST:

Cache-Control: no-store

Fake storage upload receives immutable object Cache-Control.

================================================================
58. PUBLIC BOUNDARY
    ================================================================

Do not expose media management publicly.

Public site API may return resolved Gallery image descriptors as part of
SiteDefinition.

No:

public media metadata library
public upload
public arbitrary media lookup endpoint

The GCS image URL itself is intentionally anonymous-public.

================================================================
59. EXISTING FEATURES UNCHANGED
    ================================================================

Do not alter:

Lead capture
Lead Inbox
Lead status
Lead Notes
Hero behavior
Services behavior
Contact behavior
public Lead API
publish lifecycle semantics
unpublish behavior
mutateWorkingHome contract

Everything from 1.14-1.17 must stay green.

================================================================
60. EXPECTED FILES
    ================================================================

Claude's expected file set is reasonable:

Add:

server/config/mediaConfig.js
server/client/gcsClient.js
server/services/mediaService.js
server/test/helpers/fakeStorage.js
server/test/mediaService.test.js
server/test/galleryService.test.js
platform/packages/site-components/src/Gallery.tsx
platform/apps/portal/lib/media.ts
platform/apps/portal/app/businesses/GalleryEditor.tsx

Modify as required:

server/package.json
server/services/siteService.js
server/routes/tenants.js
server/.env.example
server/test/helpers/fakeDb.js
server/test/tenantRoutes.test.js
platform/packages/site-schema/src/index.ts
platform/packages/site-components/src/index.ts
platform/apps/site-renderer/components/SectionRenderer.tsx
platform/apps/portal/lib/api.ts
platform/apps/portal/lib/site.ts
platform/apps/portal/app/businesses/BusinessWebsite.tsx

Additional focused test modifications are acceptable.

Do not add unrelated infrastructure.

================================================================
61. DEPENDENCIES
    ================================================================

Expected additions:

@google-cloud/storage

image-size

Use versions compatible with the actual current server Node/module setup.

Do not introduce Sharp or another image-processing framework.

================================================================
62. VERIFY
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

Everything from prior milestones remains green.

================================================================
63. MANUAL GCP SETUP — REPORT ONLY
    ================================================================

Codex must NOT execute GCP changes.

Final report should state the operator needs a DEV bucket configured with:

separate DEV bucket

Uniform Bucket-Level Access enabled

Public Access Prevention not enforced

allUsers:
roles/storage.legacyObjectReader
NOT roles/storage.objectViewer

API/local ADC identity:
bucket-scoped create + cleanup-delete permissions

MEDIA_BUCKET_NAME=<dev bucket>

No signBlob

No browser-to-GCS upload CORS required

A distinct PROD bucket is required later.

================================================================
64. MANUAL DEV E2E
    ================================================================

After operator configures the DEV bucket:

FIRESTORE_PROJECT_ID=bakerrang-dev
MEDIA_BUCKET_NAME=<dev bucket>

1. Portal -> Business -> Manage Website -> Add Gallery.

2. Open Gallery editor.

Expected:
recent media loads only now.

3. Upload JPEG.

Verify:
201
opaque UUID object path
canonical detected MIME
width/height
immutable cache metadata
Firestore Media metadata

4. Upload PNG and WebP.

5. Select project images.

6. Enter REQUIRED contextual alt text.

7. Reorder with Move Up/Down.

8. Save.

Expected:
working site only.

9. Normal public:
   unchanged.

10. Preview:
    Gallery visible.

11. Publish/Republish.

12. Normal public:
    Gallery visible.

13. Browser image URL:
    managed storage.googleapis.com URL.

14. Confirm anonymous bucket object listing is NOT granted by the chosen
    public-reader IAM role.

15. Upload unused media.

Expected:
it does not appear on site merely because object is public by URL.

16. Edit working Gallery A+B -> A+C.

Expected:
normal public still A+B
preview A+C

17. Republish.

Expected:
normal public A+C.

18. Parent Lead/CRM features unaffected.

19. Confirm only bakerrang-dev + DEV media bucket changed.

================================================================
65. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Dependencies.
4. Upload architecture.
5. Media bucket config.
6. Public IAM assumption.
7. Storage permissions.
8. Media model.
9. Object naming.
10. GCS create-only immutability.
11. Image validation.
12. Canonical MIME behavior.
13. File limit.
14. Dimensions.
15. Tenant-existence-before-upload behavior.
16. GCS/Firestore failure behavior.
17. Deletion deferral.
18. Cache behavior.
19. Media routes/auth.
20. Media list bounding.
21. Gallery schema.
22. Required alt-text behavior.
23. Stable Gallery identity.
24. Gallery insertion.
25. Working/published isolation.
26. Authenticated Gallery hydration.
27. Public Gallery hydration.
28. Gallery component.
29. Portal editor/upload UX.
30. Test seams.
31. Backend test results.
32. Platform typecheck/lint/build.
33. Manual GCP prerequisites.
34. Manual DEV verification if performed.
35. Deviations and why.
36. Anything affecting Step 1.19+.

Do not implement beyond Step 1.18.
Do not create cloud resources.
Do not deploy.