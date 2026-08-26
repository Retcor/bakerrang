# Claude Code Assignment — Step 1.22 SEO & Discoverability Foundation

DO NOT modify code.

Steps 1.7–1.21 are complete and manually verified.

The platform now has:

- tenant/site initialization
- Hero
- Services
- Gallery
- Testimonials
- Contact / Lead Form
- Media
- Leads / workflow / notes
- section composition/order/removal
- working/published lifecycle
- tenant branding
- siteName
- primary/accent colors
- optional Media-backed logo
- shared public SiteShell
- header/navigation/footer
- canonical section anchors
- basic page <title>

The next milestone is:

SEO & DISCOVERABILITY FOUNDATION

This milestone should establish explicit structured public-business/SEO data
and use it to generate correct metadata.

Do NOT implement custom domains yet.

Custom Domains are expected to be Step 1.23.

============================================================
1. GOAL
   ============================================================

Give published tenant sites a proper foundational SEO layer:

- explicit site/business description
- structured public business identity where justified
- page titles
- meta descriptions
- canonical URL strategy
- OpenGraph metadata
- indexing behavior
- LocalBusiness JSON-LD where the available structured data supports it
- safe behavior for Preview/DRAFT
- backward compatibility for existing sites/snapshots

Potentially:

- robots.txt
- sitemap

BUT these two must be evaluated carefully against the current shared
multi-tenant renderer and upcoming custom-domain architecture.

Do not build SEO features just because they are traditionally on an SEO
checklist if the current architecture cannot support them correctly.

============================================================
2. CRITICAL DOMAIN PRINCIPLE
   ============================================================

DO NOT infer structured business facts from presentation content.

Examples:

Contact action:

{
type: 'phone',
value: '...'
}

does NOT necessarily mean:

this is the canonical business phone number.

Similarly:

Contact email
Hero title
CTA URL
section text

must not automatically become structured LocalBusiness facts unless the
product explicitly defines them as such.

Presentation content and structured public-business identity are different
domains.

Determine what explicit Business Profile / SEO data we actually need.

============================================================
3. INSPECT CURRENT SHIPPED CODE
   ============================================================

Inspect actual code after Step 1.21, especially:

server/services/siteService.js
server/services/mediaService.js
server/domain/siteBranding.js
server/routes/tenants.js

platform/packages/site-schema/src/index.ts

platform/apps/site-renderer/app/layout.tsx
platform/apps/site-renderer/app/site/[tenantId]/page.tsx
platform/apps/site-renderer/app/site/[tenantId]/contact/page.tsx
platform/apps/site-renderer/lib/*
platform/apps/site-renderer/components/*

platform/packages/site-components/*
platform/apps/portal/app/businesses/BrandingEditor.tsx
platform/apps/portal/app/businesses/BusinessWebsite.tsx
platform/apps/portal/lib/site.ts

public-site fetch flow
preview mechanism
renderer environment configuration
Cloud Run assumptions

Document the actual current state.

============================================================
4. CURRENT SEO READINESS
   ============================================================

Document what currently exists:

- page title behavior
- metadata API usage
- HTML lang
- semantic headings
- canonical anchors
- public URL construction
- public renderer host/origin configuration
- preview URL behavior
- published vs working public reads
- any robots/sitemap files
- any OpenGraph metadata
- any JSON-LD
- any site description
- any public business address/contact profile

Do not assume.

============================================================
5. BUSINESS PROFILE VS SEO SETTINGS
   ============================================================

Evaluate whether we need:

A. one combined object

or:

B. separate:

BusinessProfile
SeoSettings

Potential structured concerns:

BusinessProfile:
- public business name?
- phone?
- email?
- address?
- serviceAreas?

SEO:
- description
- social/OG image?
- indexing controls?

Remember:

branding.siteName already exists.

Avoid duplicating siteName/business name unnecessarily.

Recommend the cleanest model.

============================================================
6. BRANDING.SITENAME
   ============================================================

We already have:

branding.siteName

It is the public site identity.

Evaluate whether LocalBusiness:

name

should simply use:

branding.siteName

rather than adding another:

businessProfile.businessName

field.

My preference:

avoid duplicate public-name fields unless they serve a distinct business
purpose.

Explain.

============================================================
7. SEO DESCRIPTION
   ============================================================

We need an explicit business/site description.

Potential use:

<meta name="description">
OpenGraph description
possibly LocalBusiness.description

Determine where it belongs.

Potential:

seo.description

or:

businessProfile.description

Do NOT derive it from:

Hero subtitle
Services text
Contact text

Those may be marketing copy but aren't necessarily intended as the canonical
site description.

Recommend exact contract and validation limit.

Do not blindly enforce "160 characters" merely because old SEO advice often
mentions that number.

Choose a practical storage limit.

============================================================
8. STRUCTURED BUSINESS CONTACT DATA
   ============================================================

Evaluate explicit optional fields such as:

phone
email

They should be structured profile fields if we want them available to
LocalBusiness JSON-LD.

Determine:

validation
normalization
storage representation

Phone may need friendly display value rather than forcing a globally formatted
number if that's consistent with current Contact handling.

Email should use pragmatic validation.

Do NOT automatically copy Contact action into these fields.

============================================================
9. STRUCTURED POSTAL ADDRESS
   ============================================================

Evaluate whether Step 1.22 should support a structured address.

Potential:

address: {
line1
line2?
city
region
postalCode
country
}

But many local service businesses:

- work from home
- don't expose a public street address
- operate as service-area businesses

Do not require an address.

If included, determine:

- exact fields
- optional/full-address semantics
- whether partial addresses are valid
- country representation
- validation limits

Avoid storing a single unstructured address blob if structured PostalAddress
JSON-LD is a concrete goal.

============================================================
10. SERVICE AREA
    ============================================================

Because this platform targets local service businesses, evaluate whether we
need:

serviceAreas: string[]

Example:

Draper, Utah
Salt Lake County
Utah County

Potentially useful for:

public business profile
future Local SEO
future GBP integration

But do not add it merely because it sounds useful.

Determine whether it belongs in 1.22 or should be deferred.

If included:

choose a bound
trim
deduplicate
preserve requested order

No geographic lookup/geocoding in V1.

============================================================
11. BUSINESS CATEGORY / SCHEMA TYPE
    ============================================================

Evaluate whether we need:

businessType
industry
schema.org subtype

My initial preference:

NO.

Use generic:

LocalBusiness

when structured data is eligible.

Do NOT allow arbitrary user-supplied schema.org type strings.

Do NOT build a business-category taxonomy in 1.22 unless actual requirements
justify it.

============================================================
12. HOURS / PRICE / GEO / SOCIAL
    ============================================================

Likely defer:

openingHours
priceRange
latitude/longitude
social links
sameAs
fax
payment methods

Explicitly evaluate but avoid scope creep.

============================================================
13. SEO / PROFILE PERSISTENCE LOCATION
    ============================================================

Branding currently lives on:

tenants/{tenantId}/site/config.branding

Evaluate where the new site-wide structured data belongs.

Potential:

config.seo
config.businessProfile

or another site-level field.

Do NOT create per-page Firestore documents solely for Home SEO unless needed.

No duplication on individual sections.

Recommend exact persistence location.

============================================================
14. WORKING / PUBLISHED LIFECYCLE
    ============================================================

SEO and public Business Profile data should almost certainly participate in
the same lifecycle as branding/content.

Expected:

Save SEO/Profile
->
working only

Preview
->
new metadata/profile

Normal public
->
old published metadata/profile

Republish
->
new public metadata/profile

Evaluate and confirm.

Do NOT create a separate immediate-public SEO settings system.

============================================================
15. SITEDEFINITION CONTRACT
    ============================================================

If SEO/profile participates in publication, evaluate adding it to:

SiteDefinition

Potential:

interface SiteSeo { ... }

interface BusinessProfile { ... }

interface SiteDefinition {
status
branding
seo?
businessProfile?
pages
}

Determine exact persisted vs hydrated/read-model contract.

Provider-neutral only.

============================================================
16. BACKWARD COMPATIBILITY
    ============================================================

Existing working sites and existing published snapshots have no SEO/profile
fields.

They must continue rendering.

No migration should be required.

Determine safe read defaults.

Important distinction:

missing SEO/profile may simply mean:

metadata omitted

rather than fabricating business facts.

Do NOT default:

phone
email
address
service area

from presentation content.

============================================================
17. SEO EDITOR / BUSINESS PROFILE EDITOR
    ============================================================

Portal needs a minimal editor.

Determine whether it should be called:

SEO
SEO & Business Profile
Site Details
Business Profile
Search & Business Info

We do not want an overly technical UI if business owners eventually use it.

Potential fields:

Description
Phone
Email
Address
Service Areas

depending on chosen contract.

No giant SEO dashboard.

No keyword scoring.

No "SEO health score."

No AI-generated copy.

============================================================
18. AUTHORIZATION
    ============================================================

Maintain current CMS rule:

PLATFORM_ADMIN only

unless shipped code has changed.

Do NOT grant OWNER/ADMIN/STAFF website editing in this milestone.

============================================================
19. MUTATION ENDPOINT
    ============================================================

Design the exact endpoint.

Potential:

PUT /tenants/:tenantId/site/seo

or:

PUT /tenants/:tenantId/site/profile

or:

PUT /tenants/:tenantId/site/public-profile

If BusinessProfile + SEO are separate concepts, evaluate:

one endpoint
or
two narrow endpoints

Prefer smallest coherent contract.

Do not create a generic site-config PATCH.

============================================================
20. FULL-STATE VS PATCH
    ============================================================

Evaluate full-state PUT vs PATCH.

Current CMS patterns increasingly favor explicit full-state editor-owned
objects.

Prefer a full-state narrow object if clean.

Define:

omitted optional fields
blank fields
clear semantics

Do not preserve stale fields accidentally.

============================================================
21. CANONICAL URL — MAJOR ARCHITECTURAL QUESTION
    ============================================================

Today public sites are served conceptually at:

/site/{tenantId}

Custom domains do NOT exist yet.

Step 1.23 is expected to add them.

Design the canonical URL strategy so 1.22 does NOT need a rewrite/data
migration immediately afterward.

Questions:

- Should canonical URLs be persisted? Probably not.
- Should canonical URLs be derived by the renderer?
- Should renderer have a public-origin configuration?
- How should a future tenant custom domain override this?
- Should request Host be trusted?
- What happens behind Cloud Run / reverse proxies?

Recommend a clean seam.

My preference:

canonical URL is RENDER-TIME infrastructure/domain resolution,
not user-authored CMS data.

But inspect actual deployment/runtime before deciding.

============================================================
22. PUBLIC ORIGIN ENVIRONMENT
    ============================================================

Determine whether renderer currently has enough information to create an
absolute canonical URL.

Potential config:

SITE_PUBLIC_ORIGIN

or equivalent.

If a new env var is needed:

- explicit
- environment-specific
- fail-safe
- no hardcoded production guess

But consider DEV convenience.

Do NOT infer a canonical production domain from arbitrary Host headers unless
that is demonstrably safe in the deployed architecture.

============================================================
23. FUTURE CUSTOM-DOMAIN COMPATIBILITY
    ============================================================

Design a resolver boundary conceptually like:

resolveSiteOrigin(...)

Today:
platform shared origin

Step 1.23:
custom tenant domain when mapped

No SiteDefinition migration.

No canonical URL persisted into publication snapshots.

Explain how 1.22 prepares for 1.23.

Do NOT implement custom-domain lookup now.

============================================================
24. PAGE CANONICALS
    ============================================================

At minimum evaluate:

Home:
canonical site root /site/{tenantId}

Contact Lead Form:
canonical /site/{tenantId}/contact

If Contact is not published/eligible, determine whether the route should be
indexable/canonical at all.

Do not emit broken canonicals.

============================================================
25. PREVIEW INDEXING
    ============================================================

Critical.

Working DEV Preview / draft preview should not be indexed.

Determine how renderer knows the response is preview/working.

For Preview metadata, ensure:

robots:
noindex
nofollow

or equivalent.

Normal published pages:

index/follow unless another explicit rule applies.

Do NOT allow preview content into search indexes.

============================================================
26. UNPUBLISHED / DRAFT INDEXING
    ============================================================

Normal public endpoint already fails closed for unpublished sites.

Confirm renderer behavior.

Do not generate indexable pages for unavailable/unpublished sites.

If Next notFound() is used:

document expected metadata behavior.

============================================================
27. OPEN GRAPH
    ============================================================

Implement foundational OpenGraph metadata if clean.

Potential:

title
description
url
siteName
type=website

Image question:

We currently have an optional logo Media.

A LOGO is not necessarily an ideal OpenGraph social-card image.

Evaluate:

A. use logo as fallback OG image

B. omit OG image in V1

C. add explicit seo.socialImageMediaId

D. another approach

Do NOT automatically use the first Gallery image unless product semantics
explicitly justify that inference.

Recommend deliberately.

============================================================
28. THIRD MEDIA CONSUMER
    ============================================================

If an explicit SEO/social Media reference is added:

it becomes another media consumer.

Reuse:

tenant media validation
batched hydration

Do not invent another Media subsystem.

But do not add social image solely to exercise reuse.

============================================================
29. TWITTER/X METADATA
    ============================================================

Evaluate whether generic:

twitter card
title
description

is effectively free once OpenGraph exists.

No social account configuration.

No platform integration.

Only include if clean and standards-supported by current Next metadata APIs.

============================================================
30. LOCALBUSINESS JSON-LD
    ============================================================

Evaluate generating:

{
"@context": "https://schema.org",
"@type": "LocalBusiness",
...
}

from EXPLICIT structured fields only.

Potential sources:

name:
branding.siteName

description:
explicit SEO/profile description

telephone:
businessProfile.phone

email:
businessProfile.email

address:
businessProfile.address

areaServed:
businessProfile.serviceAreas

url:
renderer canonical site URL

logo:
hydrated branding.logoSrc?

Be conservative.

Do NOT derive business facts from Contact/Services/Hero.

============================================================
31. JSON-LD MINIMUM ELIGIBILITY
    ============================================================

Determine when LocalBusiness JSON-LD should actually be emitted.

For example:

Is:

name + url

enough to justify it?

Or should we require at least one meaningful local-business signal such as:

phone
address
serviceArea

?

We don't want technically-valid-but-nearly-empty structured data that provides
little value.

Recommend a clear eligibility rule.

============================================================
32. JSON-LD FIELD OMISSION
    ============================================================

Optional missing data should be omitted.

Do NOT emit:

telephone: ""
email: ""
address: {}
areaServed: []

No fabricated placeholders.

============================================================
33. JSON-LD SAFETY
    ============================================================

Do not accept raw JSON-LD from users.

Application constructs the object from validated structured data.

When inserting into:

<script type="application/ld+json">

ensure serialization cannot prematurely close/inject HTML script content.

Use a safe serialization strategy appropriate to React/Next.

Explicitly plan/test strings containing:

<
>
&
"</script>"

or similar user content.

No XSS via JSON-LD.

============================================================
34. STRUCTURED ADDRESS JSON-LD
    ============================================================

If address is implemented:

map to:

PostalAddress

using exact structured fields.

Do NOT concatenate an address string and pretend it is structured.

Determine required/optional combinations.

============================================================
35. SERVICE AREA JSON-LD
    ============================================================

If serviceAreas exist:

determine clean schema.org representation.

Prefer simple valid:

areaServed

strings/objects without fake geographic precision.

Do NOT geocode.

============================================================
36. ROBOTS.TXT — MAJOR SHARED-HOST QUESTION
    ============================================================

Evaluate whether Step 1.22 should add:

/robots.txt

The site-renderer is multi-tenant under a shared host.

robots.txt applies to the HOST, not to an individual /site/{tenantId}
subtree in isolation.

Determine whether a global renderer robots policy is appropriate now.

Potential:

User-agent: *
Allow: /site/

But also consider:

preview URLs
internal routes
contact form
future custom domains
DEV deployment indexing

Do NOT accidentally tell crawlers to index DEV.

Recommend:

implement now
or defer to 1.23

with rationale.

============================================================
37. ENVIRONMENT INDEXING SAFETY
    ============================================================

We have DEV and PROD environments.

DEV should generally NOT be search-indexed.

Determine an explicit environment config such as:

PUBLIC_SITE_INDEXING_ENABLED=true|false

or equivalent if necessary.

Do not infer purely from NODE_ENV if Cloud Run preview/deployment semantics make
that insufficient.

Prefer fail-closed indexing if config is missing.

Evaluate exact approach.

============================================================
38. SITEMAP — MAJOR ARCHITECTURAL QUESTION
    ============================================================

Evaluate whether Step 1.22 should implement sitemap generation.

The shared renderer currently serves MANY tenants under:

/site/{tenantId}

A host-level:

/sitemap.xml

would potentially require enumerating all published tenants.

That could require:

- a new public tenant index/list endpoint
- Firestore scanning/query
- publication filtering
- pagination
- cache strategy
- exposing site URLs platform-wide

Do NOT introduce that infrastructure casually.

Potential decisions:

A. implement global shared-host sitemap properly

B. defer sitemap until custom domains

C. support per-site sitemap-like route even though standard crawler discovery
may be limited

D. another clean architecture

Recommend deliberately.

My bias:

DEFER if doing it correctly would require a new global public site-directory
domain merely for this milestone.

============================================================
39. ROBOTS ↔ SITEMAP RELATIONSHIP
    ============================================================

If sitemap is deferred:

robots need not reference one.

Do not emit a fake/nonexistent sitemap URL.

If custom-domain work in 1.23 naturally solves tenant-specific sitemap
delivery, document that.

============================================================
40. CONTACT FORM INDEXING
    ============================================================

Evaluate whether:

/site/{tenantId}/contact

should be:

index/follow
or
noindex/follow

It's primarily a transactional Lead Form rather than rich content.

Recommend deliberately.

My initial lean:

noindex, follow

to concentrate search relevance on the main business site.

But do not treat that as predetermined.

============================================================
41. HEADER/FOOTER LINKS
    ============================================================

SEO work must not alter current navigation semantics unnecessarily.

No arbitrary navigation editor.

No keyword stuffing in labels.

Current canonical section links remain.

============================================================
42. METADATA FROM PUBLISHED VS WORKING
    ============================================================

Normal public metadata must derive exclusively from the PUBLISHED
SiteDefinition.

Preview metadata derives from working but is noindex.

No normal-public metadata should accidentally read:

current working config
current working branding
current working SEO/profile

when rendering an older published snapshot.

This is a mandatory snapshot-isolation invariant.

============================================================
43. PUBLIC API REPRESENTATION
    ============================================================

Determine what fields in BusinessProfile/SEO must be exposed in anonymous
SiteDefinition for renderer metadata/JSON-LD generation.

Expose only what's intended to be PUBLIC.

Important:

phone/email/address/profile fields included in SiteDefinition are therefore
public by design.

Make that explicit in the model/portal UX.

Do not include private/internal business data in these fields.

============================================================
44. PROFILE FIELD PRIVACY UX
    ============================================================

If the editor accepts:

phone
email
address

make it clear these are PUBLIC website/business details.

Potential helper text:

"These details may be published in website metadata and search-engine
structured data."

Recommend wording.

This prevents an admin from accidentally entering private internal contact
information.

============================================================
45. SITE SHELL VISUAL IMPACT
    ============================================================

Step 1.22 is not another visual redesign.

Do NOT redesign Header/Footer/sections again.

If public Business Profile data is NOT currently shown visually, do not
automatically add address/phone/footer blocks unless product value clearly
requires it.

This milestone is primarily metadata/discoverability.

============================================================
46. META TITLE
    ============================================================

Current Home title = branding.siteName.

Evaluate whether to keep exactly that or use a templated title.

Potential:

branding.siteName

Contact:
Contact | branding.siteName

Do not automatically stuff service keywords/location into titles.

No keyword generator.

============================================================
47. META DESCRIPTION FALLBACK
    ============================================================

If explicit SEO description is missing on an old site:

Options:

A. omit description

B. fallback to Hero subtitle

C. another safe behavior

My preference:

omit rather than reinterpret presentation content.

Determine deliberately.

No invented copy.

============================================================
48. OPEN GRAPH FALLBACK
    ============================================================

Likewise:

if description/image missing:

omit optional fields safely.

Do not manufacture them from unrelated section data without an explicit
contract.

============================================================
49. LOCALBUSINESS DESCRIPTION
    ============================================================

If SEO description is the explicit canonical public business description, it
may cleanly power both:

meta description
OpenGraph description
LocalBusiness.description

Evaluate whether this is desirable or whether BusinessProfile needs its own
description.

Avoid unnecessary duplicate description fields.

============================================================
50. PUBLIC URL STORAGE
    ============================================================

Do NOT persist:

canonicalUrl
og:url
site origin

inside working SiteDefinition unless Claude finds an exceptionally strong
reason.

URLs are infrastructure/domain resolution and will change under Step 1.23
custom domains.

Prefer render-time derivation.

============================================================
51. SEO MEDIA STORAGE
    ============================================================

If socialImageMediaId is supported:

persist only:

mediaId

Never:

src
width
height
objectName
bucket

Hydration-only provider fields follow existing Media discipline.

============================================================
52. NEW SITE INITIALIZATION
    ============================================================

Determine whether initializeSite should seed:

seo.description = ?

businessProfile = ?

Likely:

do NOT invent content.

Missing optional SEO/profile data may be better than placeholder data.

Branding already seeds siteName/colors.

Explain.

============================================================
53. SEO EDITOR INITIAL STATE
    ============================================================

Existing legacy sites may have no fields.

Portal editor should initialize cleanly with blank optional values.

Do not force fake defaults.

No extra GET beyond the already-loaded SiteDefinition if the required fields
are available there.

============================================================
54. EDITOR SAVE FEEDBACK
    ============================================================

Follow existing publishing UX.

If site is already PUBLISHED:

"Saved to the working site. Republish to change the public site."

or existing standard message.

Do not create special SEO publication semantics.

============================================================
55. BUSINESS PROFILE VALIDATION
    ============================================================

If chosen fields include:

phone
email
address
serviceAreas

define exact validation.

Be pragmatic.

Avoid overcomplex international-address libraries.

But reject malformed types and unreasonable lengths.

Unknown client fields dropped.

No raw JSON.

============================================================
56. SEO VALIDATION
    ============================================================

Define exact:

description length
optional social image if selected
other chosen fields

Unknown client fields dropped.

No raw HTML.

Plain text only.

============================================================
57. PUBLIC HTML ESCAPING
    ============================================================

Metadata, description, business names, and profile values are user-entered
plain strings.

Use framework-safe escaping.

Do not inject raw HTML into:

<title>
meta tags
visible content
JSON-LD

JSON-LD requires its own safe serialization treatment (§33).

============================================================
58. TEST — VALIDATION
    ============================================================

Cover chosen contract:

description
phone
email
address
serviceAreas
social image if chosen

including:

trim
blank clearing semantics
length limits
wrong types
unknown client fields dropped
same-tenant media ownership if applicable

============================================================
59. TEST — WORKING / PUBLISHED SEO ISOLATION
    ============================================================

Mandatory:

working SEO/profile A

publish

normal public:
A

edit working to B

normal public:
A

preview:
B + noindex

published/current bytes unchanged

republish

normal public:
B

============================================================
60. TEST — LEGACY SNAPSHOT
    ============================================================

Pre-1.22 published snapshot has no:

seo
businessProfile

Normal public must still render.

No migration.

No repair write.

Metadata safely omits unavailable optional information.

============================================================
61. TEST — NO PRESENTATION-DATA INFERENCE
    ============================================================

Important.

Seed:

Contact action phone/email

but leave BusinessProfile phone/email empty.

Assert structured public BusinessProfile / JSON-LD does NOT suddenly contain
those Contact values.

Likewise Hero subtitle should not silently become SEO description if the
chosen policy is omission.

Prove this boundary.

============================================================
62. TEST — CANONICAL
    ============================================================

Given configured shared public origin:

Home canonical is correct absolute URL.

Contact canonical/indexing behavior follows chosen policy.

No canonical uses API host or portal host.

No tenant-controlled arbitrary URL.

Future custom-domain resolver seam is preserved.

============================================================
63. TEST — PREVIEW ROBOTS
    ============================================================

Preview:

noindex
nofollow

Normal published:

index behavior according to environment config/policy.

DEV indexing disabled.

No preview leak.

============================================================
64. TEST — JSON-LD
    ============================================================

If implemented:

uses explicit structured fields only

correct @context/@type

optional fields omitted cleanly

address mapped structurally

serviceAreas handled correctly

URL from canonical/domain resolver

logo only from managed Media if included

no internal Media fields

safe serialization against script-breaking strings

============================================================
65. TEST — OPEN GRAPH
    ============================================================

If implemented:

title
description when configured
URL
siteName
image according to chosen policy

No invented image/copy.

Preview behavior safe.

============================================================
66. TEST — MEDIA IF USED
    ============================================================

If social image is implemented:

same-tenant accepted
foreign/missing rejected
resolved in existing batched hydration
provider-neutral persistence
no N+1

Gallery and branding logo remain unaffected.

============================================================
67. TEST — AUTHORIZATION
    ============================================================

SEO/Profile mutation:

PLATFORM_ADMIN allowed

OWNER 403
ADMIN 403
STAFF 403
unauthenticated 401

No public mutation route.

============================================================
68. TEST — PUBLIC DATA SANITIZATION
    ============================================================

Anonymous SiteDefinition exposes only intentional public profile/SEO fields.

No:

Firestore internals
actor user id
bucket
objectName
internal tenant metadata

============================================================
69. RENDERER IMPLEMENTATION
    ============================================================

Use current Next 16 App Router patterns.

Inspect current:

generateMetadata
request caching
notFound
server component fetch

Avoid duplicate public API fetches where current React cache helper can be
reused.

Do not add a client-side SEO layer.

Metadata is server-rendered.

============================================================
70. JSON-LD COMPONENT LOCATION
    ============================================================

If JSON-LD is implemented:

recommend whether it lives:

Home page
SiteShell
dedicated server component/helper

Do not put Home LocalBusiness JSON-LD on unrelated routes unless semantically
appropriate.

Avoid duplicate structured-data blocks.

============================================================
71. CONTACT PAGE STRUCTURED DATA
    ============================================================

Likely no duplicate LocalBusiness JSON-LD needed on Contact Form page.

Evaluate.

If Home is canonical primary business page, keep structured business data
there unless there is a standards reason otherwise.

============================================================
72. ROBOTS IMPLEMENTATION LOCATION
    ============================================================

If global robots is implemented, identify exact Next file:

app/robots.ts

or equivalent current supported approach.

Account for:

DEV noindex
PROD shared host
future domains

Do not handwave.

============================================================
73. SITEMAP IMPLEMENTATION LOCATION
    ============================================================

If sitemap is implemented, identify:

exact route/file
data source
published filtering
pagination/cache strategy
failure behavior

If this requires broad public tenant enumeration, explicitly call it out.

Do not say "add sitemap" without solving the data source.

============================================================
74. CACHE STRATEGY
    ============================================================

Current public SiteDefinition fetch is no-store.

Determine whether SEO work requires any new caching.

Prefer no cache architecture change in 1.22 unless needed.

Do not add CDN/cache complexity just for metadata.

============================================================
75. NO CUSTOM DOMAINS
    ============================================================

Do NOT implement:

domain Firestore mappings
Host -> tenant lookup
domain verification
TLS provisioning
DNS onboarding
domain editor

Those are Step 1.23.

Only create the clean URL/origin abstraction needed so 1.23 can plug in.

============================================================
76. NO SEO ANALYTICS
    ============================================================

Do NOT implement:

Search Console
rank tracking
keyword research
traffic analytics
conversion analytics
SEO scoring

Not this milestone.

============================================================
77. NO GBP
    ============================================================

Do NOT implement:

Google Business Profile API
GBP sync
review sync
maps
places lookup

Structured Business Profile data may later support GBP integration, but no
integration now.

============================================================
78. NO GENERATED SEO COPY
    ============================================================

Do NOT implement:

AI descriptions
AI keywords
AI titles
auto-generated city pages
keyword stuffing
templated service/location pages

Explicit admin-entered data only.

============================================================
79. FILES
    ============================================================

Return exact:

files to add
files to modify
files explicitly unchanged

Likely possibilities may include:

server/domain/siteSeo.js
server/test/siteSeoService.test.js
portal SeoEditor/BusinessProfileEditor
renderer SEO helpers / structured-data helper

But inspect actual architecture before deciding.

============================================================
80. VERIFICATION
    ============================================================

Backend:

cd server
npm test

repo-appropriate StandardJS/syntax

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

All previous Steps 1.2–1.21 must remain green.

============================================================
81. MANUAL DEV E2E
    ============================================================

Plan a realistic DEV walkthrough.

Potential:

1. Existing published DEV site.

2. Open SEO / Business Profile editor.

3. Enter explicit description.

4. Enter chosen structured public contact/address/service-area fields.

5. Save.

6. Normal public metadata remains old.

7. Preview reflects new SEO/profile and is NOINDEX.

8. Inspect page source/head:
   title
   description
   canonical
   OpenGraph
   robots meta
   JSON-LD if eligible.

9. Verify Contact action values that were NOT copied into BusinessProfile do
   not appear magically in JSON-LD.

10. Republish.

11. Normal public metadata updates.

12. Inspect JSON-LD.

13. Verify provider-neutral Media behavior if SEO image exists.

14. Verify Contact Form indexing behavior.

15. Verify DEV environment itself cannot be accidentally indexed according to
    chosen environment policy.

16. Verify legacy site/snapshot missing SEO fields still renders.

17. Verify Leads/Media/branding/composition unchanged.

18. Confirm only bakerrang-dev changed.

============================================================
82. FUTURE CUSTOM DOMAIN HANDOFF
    ============================================================

Explain exactly what Step 1.23 needs to plug into.

Expected concept:

SEO helpers ask:

"What is the canonical public origin for this rendered tenant?"

Step 1.22 currently answers:
shared renderer origin

Step 1.23 can answer:
verified tenant custom domain

without changing:

SiteDefinition SEO data
published snapshots
metadata content fields

Document the seam.

============================================================
83. RECOMMENDED STEP 1.23
    ============================================================

Assuming 1.22 is complete:

Step 1.23 should likely be Custom Domains.

Explain any prerequisites SEO work establishes for it.

============================================================
84. ARCHITECTURAL PRINCIPLE
    ============================================================

The intended model should be roughly:

explicit public business facts
+
explicit SEO copy
+
published SiteDefinition
+
render-time canonical/domain resolution
↓
server-rendered metadata
OpenGraph
safe structured data

while:

presentation sections
≠
structured business profile

and:

canonical URL/domain
≠
persisted CMS content

============================================================
DELIVERABLE
============================================================

Return:

1. Current SEO readiness.
2. Existing metadata behavior.
3. BusinessProfile vs SEO model decision.
4. Exact persisted schema.
5. Exact SiteDefinition schema changes.
6. Branding.siteName relationship.
7. Description decision.
8. Phone/email decision.
9. Address decision.
10. Service-area decision.
11. Business-category decision.
12. Deferred structured fields.
13. Persistence location.
14. Working/published lifecycle.
15. Backward compatibility.
16. Editor UX.
17. Endpoint(s).
18. Authorization.
19. Full-state/PATCH decision.
20. Exact validation limits.
21. Canonical URL architecture.
22. Public-origin environment strategy.
23. Step 1.23 custom-domain seam.
24. Home/contact canonical behavior.
25. Preview/DRAFT robots behavior.
26. Environment indexing safety.
27. OpenGraph strategy.
28. OG image decision.
29. Twitter metadata decision.
30. LocalBusiness JSON-LD contract.
31. JSON-LD eligibility.
32. Address/service-area mapping.
33. JSON-LD safety/escaping.
34. robots.txt decision.
35. sitemap decision.
36. Contact-page indexing decision.
37. Metadata snapshot-isolation behavior.
38. Public SiteDefinition sanitization.
39. Portal privacy/help text.
40. Files to add.
41. Files to modify.
42. Files explicitly unchanged.
43. Backend tests.
44. Platform checks.
45. Manual DEV E2E.
46. Concrete risks.
47. Intentional deferrals.
48. Exact handoff to Step 1.23.
49. Recommended Step 1.23.
50. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.