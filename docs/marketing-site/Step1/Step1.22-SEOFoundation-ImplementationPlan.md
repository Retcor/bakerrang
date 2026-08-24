Implement Step 1.22 — SEO & Discoverability Foundation.

Claude Code inspected the shipped repository and produced an approved plan.

Follow Claude's plan, with the corrections below taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Add explicit public Business Profile data and use the published SiteDefinition
to produce foundational SEO/discoverability output:

- meta description
- canonical URLs
- OpenGraph
- Twitter metadata
- environment-safe robots behavior
- conservative LocalBusiness JSON-LD
- optional managed social image

Do NOT implement:

custom domains
sitemap
GBP
analytics
SEO scoring
keyword tools
AI copy
business-category taxonomy
opening hours
geo coordinates
social accounts
multiple pages

Step 1.23 remains Custom Domains.

================================================================
1. DOMAIN BOUNDARY
   ================================================================

Presentation content is NOT structured business identity.

Do NOT infer Business Profile fields from:

Hero
Services
Testimonials
Contact
Contact actions

In particular:

Contact action:
{ type: 'phone', value: '...' }

does NOT populate:

businessProfile.phone

Contact action:
{ type: 'email', value: '...' }

does NOT populate:

businessProfile.email

Hero subtitle does NOT become:

businessProfile.description

Structured business facts come only from explicit Business Profile input.

The one deliberate identity reuse is:

branding.siteName
->
LocalBusiness.name

Do not add another business-name field.

================================================================
2. BUSINESS PROFILE MODEL
   ================================================================

Persist site-wide on:

tenants/{tenantId}/site/config.businessProfile

Approved persisted fields:

{
description?,
phone?,
email?,
address?,
serviceAreas?,
socialImageMediaId?
}

Address:

{
line1?,
line2?,
city,
region?,
postalCode?,
country?
}

No:

raw HTML
raw JSON-LD
schema type
canonical URL
public origin
resolved image URL
objectName
bucket
actor metadata

================================================================
3. SHARED TYPES
   ================================================================

Add:

PostalAddress

BusinessProfile

SiteDefinition.businessProfile?

BusinessProfile read-model may additionally include:

socialImageSrc?
socialImageWidth?
socialImageHeight?

Those are hydration-only and MUST NEVER persist.

Unlike branding:

businessProfile is optional.

If nothing is explicitly configured:

SiteDefinition.businessProfile should be absent.

Do not fabricate profile facts.

================================================================
4. DESCRIPTION
   ================================================================

Explicit:

businessProfile.description

Plain text.

Trim.

Maximum:
300 characters.

Blank/omitted in the full-state editor:

clears it.

Use this same explicit description for:

meta description
OpenGraph description
Twitter description
LocalBusiness.description when JSON-LD is otherwise eligible

Do NOT fall back to:

Hero subtitle
Services copy
Contact text

If no explicit description:

omit optional description metadata.

================================================================
5. PHONE / EMAIL
   ================================================================

Optional explicit public Business Profile fields.

Reuse the existing server contact-method validation where appropriate.

Store friendly/display representation according to current conventions.

Do NOT copy from Contact actions.

Blank in full-state editor:

clear.

================================================================
6. ADDRESS
   ================================================================

Optional structured address.

If any address field is supplied:

city is required.

Supported:

line1
line2
city
region
postalCode
country

Each bounded reasonably per Claude's plan.

A completely blank address object:

omit.

No geocoding.

No requirement that every local business expose a street address.

JSON-LD maps it to PostalAddress using present fields only.

================================================================
7. SERVICE AREAS
   ================================================================

Include:

serviceAreas?: string[]

because service-area businesses are a core platform use case.

Rules:

maximum 20
each 1..120 after trim
case-insensitive dedupe
preserve first occurrence/order

No geocoding.

No invented geographic precision.

Blank resulting list:

omit.

================================================================
8. SOCIAL IMAGE
   ================================================================

Support optional:

businessProfile.socialImageMediaId

This is an explicit SEO/social image.

Do NOT infer:

branding logo
first Gallery image

as the social image.

Must reference existing same-tenant Media.

Use existing:

requireTenantMedia

No separate binary endpoint.

Upload uses existing Media API.

Persist mediaId only.

================================================================
9. SOCIAL IMAGE HYDRATION
   ================================================================

Extend existing batched SiteDefinition Media hydration.

One deduplicated Firestore getAll should cover:

Gallery media
Brand logo
Business Profile social image

No N+1.

Hydrated profile may expose:

socialImageSrc
socialImageWidth
socialImageHeight

Never expose:

objectName
bucket
createdByUserId
other internal Media metadata

================================================================
10. CURRENT SOCIAL IMAGE OUTSIDE RECENT 50 — REQUIRED
    ================================================================

BusinessProfileEditor must treat loaded hydrated BusinessProfile as
authoritative for the existing social-image selection.

If current socialImageMediaId is older than the recent 50 Media records:

the current image must still:

display
remain selected
survive unrelated profile edits
be removable

Absence from GET /media's bounded picker is NOT permission to clear it.

Follow the same principle already established for Branding logo.

================================================================
11. FULL-STATE PROFILE ENDPOINT
    ================================================================

Add:

PUT /tenants/:tenantId/site/profile

PLATFORM_ADMIN only.

Full-state editor-owned semantics.

Response:

hydrated working SiteDefinition.

Omitted/blank optional fields:

cleared.

Unknown client fields:

dropped.

No stale nested-field preservation.

No public mutation route.

================================================================
12. EMPTY PROFILE PERSISTENCE — REQUIRED CORRECTION
    ================================================================

The persisted contract says:

when NO Business Profile fields remain,
config.businessProfile should be ABSENT.

Do NOT persist:

businessProfile: {}

When updating:

read config
construct nextConfig

If sanitized profile contains fields:

nextConfig.businessProfile = profile

Otherwise:

delete nextConfig.businessProfile

Then write the entire reconstructed config document in the transaction.

Conceptual:

const nextConfig = {
...configSnap.data(),
updatedAt: now
}

if (hasBusinessProfile(profile)) {
nextConfig.businessProfile = profile
} else {
delete nextConfig.businessProfile
}

transaction.set(configRef, nextConfig)

This also guarantees removed subfields do not survive Firestore map merge
semantics.

Do NOT use a merge write that can retain stale nested fields.

No FieldValue.delete requirement is needed.

================================================================
13. WORKING / PUBLISHED LIFECYCLE
    ================================================================

Business Profile follows the existing lifecycle exactly.

Save:
working config only

Preview:
working profile

Normal public:
published profile

Republish:
promotes profile

published/current must remain unchanged by working edits.

No separate SEO publication model.

================================================================
14. LEGACY COMPATIBILITY
    ================================================================

Existing working config with no businessProfile:

renders normally
SiteDefinition omits businessProfile

Existing pre-1.22 published snapshot with no businessProfile:

renders normally
optional metadata omitted

No migration.

No repair write.

Do NOT fabricate:

phone
email
address
serviceAreas
description

from presentation content.

================================================================
15. CANONICAL URL ARCHITECTURE — REQUIRED CORRECTION
    ================================================================

Do NOT model the future seam as merely:

resolveSiteOrigin(tenantId)

plus an unconditional:

/site/{tenantId}

suffix.

That would fail for custom domains where the tenant site's root will likely
be:

https://example.com/

not:

https://example.com/site/{tenantId}

Instead establish a TENANT SITE BASE URL seam.

Recommended conceptual helper:

resolveSiteBaseUrl(tenantId): string | null

Today:

SITE_PUBLIC_ORIGIN=https://sites.bakerrang.com

tenantId=abc

resolveSiteBaseUrl('abc')
->
https://sites.bakerrang.com/site/abc

Step 1.23:

verified custom domain for abc

resolveSiteBaseUrl('abc')
->
https://www.customer-domain.com

No SiteDefinition change.

No snapshot migration.

Then derive:

home:
siteBaseUrl

contact:
siteBaseUrl + '/contact'

Use proper URL construction rather than string concatenation where practical.

================================================================
16. SITE_PUBLIC_ORIGIN
    ================================================================

Add explicit renderer env:

SITE_PUBLIC_ORIGIN

This represents the SHARED platform public origin today.

Example:

https://sites.bakerrang.com

Do not hardcode production.

Do not use:

SITE_API_BASE_URL
portal URL
request Host header

for canonical identity.

================================================================
17. ORIGIN VALIDATION
    ================================================================

Validate SITE_PUBLIC_ORIGIN.

It must be a valid absolute:

http:
or
https:

URL representing an origin.

Reject/treat unavailable:

credentials
query
fragment
unexpected path components

Normalize trailing slash safely.

Do not merely call:

replace(/\/$/, '')

on an arbitrary string and assume it is a safe origin.

If unavailable/invalid:

resolveSiteBaseUrl returns null.

================================================================
18. NO GLOBAL SHARED metadataBase — REQUIRED CORRECTION
    ================================================================

Do NOT add a root-layout metadataBase fixed to SITE_PUBLIC_ORIGIN unless a
specific Next metadata field actually requires it.

Canonical URLs, OG URLs and existing managed image URLs are already absolute.

A global platform metadataBase becomes conceptually wrong once the same
renderer serves different custom domains in Step 1.23.

Prefer tenant-aware absolute URLs from resolveSiteBaseUrl.

If implementation discovers metadataBase is unavoidable for a specific Next
API, document why and keep its use narrowly scoped.

================================================================
19. INDEXING ENVIRONMENT CONFIG
    ================================================================

Add:

SITE_PUBLIC_INDEXING_ENABLED

Only exact:

true

enables indexing consideration.

Fail closed otherwise.

Do NOT rely only on NODE_ENV.

DEV should normally have:

false / unset.

================================================================
20. INDEXING ALSO REQUIRES A VALID PUBLIC BASE — REQUIRED
    ================================================================

Today a normal page should only be indexable when BOTH:

SITE_PUBLIC_INDEXING_ENABLED === 'true'

AND

a valid shared public-site URL configuration is available.

Do NOT allow:

indexing flag = true
public origin missing/invalid
page = indexable with no trustworthy canonical

If URL infrastructure is invalid/unavailable:

pages:
noindex,nofollow

robots.txt:
Disallow: /

This keeps discoverability infrastructure fail-closed.

Step 1.23 can evolve this to tenant-aware custom-domain resolution.

================================================================
21. PREVIEW ROBOTS
    ================================================================

Preview is identified by:

site.status === 'DRAFT'

Preview MUST always emit:

noindex
nofollow

regardless of environment indexing flag.

No preview content should become search-indexable.

================================================================
22. NORMAL DRAFT / UNPUBLISHED
    ================================================================

Normal public unpublished sites already fail closed/notFound.

Preserve that behavior.

Do not produce an indexable placeholder.

================================================================
23. HOME METADATA
    ================================================================

Server-rendered metadata from the SAME SiteDefinition used to render the page.

Home:

title:
branding.siteName

description:
businessProfile.description when explicitly present

canonical:
resolved Home base URL when available

OpenGraph:

title
description if present
url if available
siteName
type='website'
explicit social image if hydrated

Twitter:

title
description if present

card:
summary_large_image when explicit social image exists
summary otherwise

No keyword stuffing.

No location/service name inference.

================================================================
24. CONTACT METADATA
    ================================================================

Contact page:

title:
Contact | siteName

robots:
noindex, follow

canonical:
resolved `${siteBaseUrl}/contact` when available

Do not add duplicate LocalBusiness JSON-LD here.

Lead Form remains transactional.

No Lead behavior changes.

================================================================
25. OPEN GRAPH IMAGE
    ================================================================

Use ONLY explicit:

businessProfile.socialImageMediaId

when configured/resolved.

Do NOT automatically use:

logo
first Gallery image
Hero image
other Media

If no social image:

omit OG image.

================================================================
26. JSON-LD
    ================================================================

Home page only.

Construct application-owned:

LocalBusiness

from EXPLICIT fields only.

Potential properties:

@context
@type
name
url
description
telephone
email
address
areaServed
logo
image

Sources:

name:
branding.siteName

url:
resolved site base URL if available

description:
businessProfile.description

telephone:
businessProfile.phone

email:
businessProfile.email

address:
businessProfile.address

areaServed:
businessProfile.serviceAreas

logo:
hydrated branding.logoSrc

image:
hydrated socialImageSrc when available
otherwise logo may be used only if intentionally retained by Claude's plan

Never inspect sections for structured business facts.

================================================================
27. JSON-LD ELIGIBILITY — REQUIRED CORRECTION
    ================================================================

Do NOT emit LocalBusiness solely because:

description

exists.

Description is useful SEO copy but by itself creates a nearly-empty structured
business entity.

Require Business Profile plus at least one OPERATIONAL structured fact:

phone
email
address
serviceAreas

Social image alone does not qualify.

Description alone does not qualify.

Once eligible:

description may enrich the entity.

name + URL alone are also insufficient.

================================================================
28. JSON-LD OPTIONAL FIELDS
    ================================================================

Omit missing fields.

Never emit:

telephone: ''
email: ''
address: {}
areaServed: []

No fabricated placeholder data.

Address:

@type = PostalAddress

with only validated present fields.

serviceAreas:

use clean plain-string areaServed values.

No geocoding.

================================================================
29. JSON-LD SAFETY
    ================================================================

Never accept raw JSON-LD from users.

Build a plain JS object.

JSON.stringify.

Escape HTML-script-breaking characters including:

<
>
&

before placing into:

<script type="application/ld+json">

Explicitly test strings containing:

</script>
<
>
&
quotes

No script injection.

================================================================
30. ROBOTS.TXT
    ================================================================

Implement global renderer robots policy now because it provides useful
environment indexing safety.

No sitemap line.

When indexing configuration is NOT valid/enabled:

User-agent: *
Disallow: /

When enabled and public URL configuration is valid:

User-agent: *
Allow: /

Do not pretend this is tenant-specific robots behavior yet.

Step 1.23 may need to make robots host-aware once custom domains exist.

================================================================
31. SITEMAP
    ================================================================

DO NOT implement sitemap in Step 1.22.

A correct shared-host sitemap would require platform-wide published-tenant
enumeration, filtering, pagination and URL exposure.

Do not build that system merely for SEO completeness.

Step 1.23 custom domains should revisit tenant-specific sitemap delivery.

================================================================
32. BUSINESS PROFILE EDITOR
    ================================================================

Add:

BusinessProfileEditor.tsx

Owner-friendly label:

Business Profile

Fields:

Description
Phone
Email

Address:
line 1
line 2
city
region/state
postal code
country

Service Areas:
repeatable rows

Social Image:
single tenant-Media selection
existing Media upload may be reused
Remove Social Image

Save
Cancel

No SEO score.

No keyword input.

No raw JSON.

No AI generation.

================================================================
33. PUBLIC PRIVACY HELP
    ================================================================

Display clear helper text:

"These details may appear on your public website and in search-engine
listings. Only enter information you want to be public."

Phone/email/address/service-area values in this editor are PUBLIC data by
design.

Do not present them as private CRM fields.

================================================================
34. PORTAL DATA FLOW
    ================================================================

Use the already-loaded SiteDefinition.

No extra site GET just to enter Business Profile.

Save returns updated working SiteDefinition.

Use existing standard feedback:

Saved to working site / Republish to make public.

No new publication UX.

================================================================
35. SOCIAL IMAGE PICKER
    ================================================================

Use existing Media infrastructure.

Do NOT create another media subsystem.

No general Media Manager refactor required.

Current social image from hydrated Business Profile must remain representable
even outside the recent library results.

================================================================
36. AUTHORIZATION
    ================================================================

PUT /site/profile:

PLATFORM_ADMIN allowed

OWNER 403
ADMIN 403
STAFF 403
unauthenticated 401

No public mutation endpoint.

================================================================
37. SERVER PROFILE SANITIZATION
    ================================================================

Create a focused Business Profile domain helper consistent with siteBranding.

Writes:

strict validation
plain strings only
unknown client fields dropped

Reads:

field-by-field sanitized public response

Malformed stored data:

omit invalid optional values safely

Do not raw-spread Firestore profile data into public SiteDefinition.

================================================================
38. MEDIA SANITIZATION
    ================================================================

Public SiteDefinition may expose intentional:

socialImageMediaId
socialImageSrc
socialImageWidth
socialImageHeight

Do NOT expose:

objectName
bucket
createdByUserId
originalFilename
storage metadata

Provider-neutral persisted data remains intact.

================================================================
39. METADATA SNAPSHOT ISOLATION
    ================================================================

Mandatory:

profile A
publish

normal public metadata/JSON-LD:
A

edit working profile to B

preview:
B + noindex

normal public:
A

published/current:
byte-for-byte unchanged

republish

normal public:
B

No metadata helper may fetch current working config on the normal-public path.

================================================================
40. LEGACY SNAPSHOT TEST
    ================================================================

Pre-1.22 published SiteDefinition without businessProfile:

still renders

title still works from branding

description omitted

optional OG fields omitted

LocalBusiness omitted

no migration

no repair write

================================================================
41. PRESENTATION-INFERENCE TEST
    ================================================================

Seed Contact with explicit:

phone
or
email action

Leave businessProfile equivalent field empty.

Assert:

BusinessProfile remains absent/empty
metadata does not infer it
LocalBusiness does not contain it

Hero subtitle must not become meta description.

This boundary is mandatory.

================================================================
42. FULL-STATE CLEAR TEST
    ================================================================

Save:

phone
email
serviceAreas

Then save another full-state payload that omits phone/serviceAreas.

Assert persisted config.businessProfile contains only the remaining intended
fields.

Then save an entirely blank profile.

Assert:

config.businessProfile property is ABSENT

not:

{}

not stale old data.

================================================================
43. CANONICAL TESTS
    ================================================================

With:

SITE_PUBLIC_ORIGIN=https://sites.example.com

tenantId=abc

today:

base URL:
https://sites.example.com/site/abc

Home canonical:
https://sites.example.com/site/abc

Contact:
https://sites.example.com/site/abc/contact

No URL comes from:

API host
portal host
request Host header
tenant-entered values

Invalid/missing origin:

no canonical
no OG URL
no indexing

================================================================
44. CUSTOM-DOMAIN SEAM TEST/DOCUMENTATION
    ================================================================

The helper API must make this future transition possible WITHOUT changing
callers:

Today:

resolveSiteBaseUrl('abc')
-> https://sites.example.com/site/abc

Step 1.23:

resolveSiteBaseUrl('abc')
-> https://customer-domain.com

Therefore metadata callers only append relative page paths to an already
resolved tenant site base.

Do NOT hardcode /site/{tenantId} outside the current shared-platform resolver.

================================================================
45. ROBOTS TESTS
    ================================================================

Indexing disabled:
robots.txt Disallow /

Indexing flag true + invalid/missing public origin:
robots.txt Disallow /

Indexing flag true + valid public origin:
robots.txt Allow /

Preview:
page noindex,nofollow

Published normal + fully valid indexing config:
index,follow

Contact:
noindex,follow

================================================================
46. JSON-LD TESTS
    ================================================================

Description only:
NO LocalBusiness

Social image only:
NO LocalBusiness

Phone configured:
LocalBusiness eligible

Email configured:
eligible

Address configured:
eligible

Service area configured:
eligible

Explicit description enriches an already-eligible LocalBusiness.

Correct:

@context
@type
PostalAddress
areaServed

Empty optional fields omitted.

Safe serialization prevents </script> break-out.

================================================================
47. OPEN GRAPH TESTS
    ================================================================

Explicit description:
included

No description:
omitted

Explicit social image:
included

No social image:
no invented image

Canonical/base available:
url included

Unavailable:
url omitted

No Hero/Gallery/Logo inference as social image.

================================================================
48. EXISTING FEATURES UNCHANGED
    ================================================================

Do not alter:

section visual design
Header/Footer layout
branding lifecycle
section composition
Media immutability
Gallery behavior
Hero/Services/Testimonials/Contact content semantics
Lead capture
Lead Inbox
Lead Status
Lead Notes
publish/unpublish behavior

This is metadata/structured-public-profile work.

================================================================
49. EXPECTED FILES
    ================================================================

Claude's proposed file set is generally approved.

Likely add:

server/domain/businessProfile.js
server/test/businessProfileService.test.js

BusinessProfileEditor.tsx

renderer site-base URL helper
renderer metadata/JSON-LD helper
BusinessJsonLd
robots.ts

Modify:

siteService
mediaService
tenant routes/tests
site schema
portal site API
BusinessWebsite
Home renderer page
Contact renderer page
renderer env examples

Do NOT modify unrelated UI/sections.

================================================================
50. VERIFY
    ================================================================

Backend:

cd server
npm test

repo-appropriate StandardJS/syntax checks

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

All prior suites remain green.

================================================================
51. MANUAL DEV E2E
    ================================================================

Use existing DEV:

FIRESTORE_PROJECT_ID=bakerrang-dev
MEDIA_BUCKET_NAME=<existing>
SITE_PUBLIC_ORIGIN=<your DEV public site origin if available>
SITE_PUBLIC_INDEXING_ENABLED=false

1. Open Business Profile.

2. Verify blank legacy/default profile state.

3. Enter:
   description
   phone
   email
   city/country address
   service areas
   optional social image

4. Save.

5. Normal public:
   previous published metadata.

6. Preview:
   working metadata
   noindex,nofollow.

7. Inspect document head/source:

title
description
canonical when origin configured
OpenGraph
Twitter
robots

8. Inspect JSON-LD.

Verify it uses ONLY Business Profile + branding identity.

9. Remove Business Profile phone while Contact still has a phone action.

Verify structured data does NOT continue using Contact phone.

10. Republish.

Normal public receives new metadata/profile.

11. Verify social image:
    Firestore stores mediaId only
    public read hydrates URL/dimensions

12. Verify current social image remains visible/preserved if absent from recent
    Media list where practical.

13. Clear entire Business Profile.

Verify working Firestore has NO businessProfile property.

14. Before republish:
    normal public still has old published profile.

15. Republish:
    optional metadata/profile disappears.

16. robots.txt in DEV:
    Disallow /

17. Contact page:
    noindex,follow

18. Existing legacy site/snapshot lacking profile still renders.

19. Lead behavior unchanged.

20. Branding/Media/Gallery/composition unchanged.

21. Confirm only bakerrang-dev + existing DEV media bucket changed.

================================================================
52. STEP 1.23
    ================================================================

Do not implement now.

Step 1.23 should be:

Custom Domains

It should plug into:

resolveSiteBaseUrl(tenantId)

Today:

shared platform URL including /site/{tenantId}

Then:

verified custom-domain root

without changing:

BusinessProfile
SiteDefinition
published snapshots
SEO content
metadata field contracts

Sitemap should be reconsidered there.

================================================================
53. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Business Profile model.
4. Description/contact/address/service-area validation.
5. Social image model.
6. Social image hydration.
7. Current-image-outside-recent-50 behavior.
8. Empty-profile persistence behavior.
9. Working/published isolation.
10. Legacy compatibility.
11. Presentation-vs-profile boundary.
12. Endpoint/auth.
13. Site base URL resolver.
14. Origin validation.
15. Indexing gating.
16. Preview robots.
17. robots.txt.
18. Home metadata.
19. Contact metadata.
20. OpenGraph/Twitter.
21. JSON-LD contract.
22. JSON-LD eligibility.
23. JSON-LD safe serialization.
24. Sitemap deferral.
25. Tests.
26. Backend result.
27. Platform checks.
28. Manual DEV verification if performed.
29. Deviations.
30. Exact handoff to Step 1.23.

Do not implement beyond Step 1.22.