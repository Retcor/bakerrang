Implement Step 1.7 — Site Definition Foundation.

Claude Code has inspected the repository and produced the implementation plan.

Use Claude's repository findings and general approach, BUT the corrections in
this assignment override Claude's plan wherever they differ.

Do not expand scope.

================================================================
GOAL
================================================================

Allow a PLATFORM_ADMIN to initialize a minimal Website for an existing
Business/Tenant.

Establish:

- persisted Site root/config
- persisted Home page
- persisted ordered Sections
- shared TypeScript SiteDefinition contract
- authenticated site initialization/read endpoints
- minimal Portal website initialization control

Do NOT connect the public site-renderer to data yet.

================================================================
1. FIRESTORE PHYSICAL MODEL — IMPORTANT OVERRIDE
   ================================================================

Claude correctly found that this is INVALID:

tenants/{tenantId}/site/pages/home

because Firestore requires alternating collection/document path segments.

Do NOT use Claude's proposed sibling-document model:

tenants/{tenantId}/site/config
tenants/{tenantId}/site/home

Instead use:

tenants/{tenantId}/site/config

and:

tenants/{tenantId}/site/config/pages/home

Interpret:

site/config

as the canonical Site root/config document.

Its `pages` subcollection contains SitePage documents.

This gives us a clean multi-page-compatible structure for later:

site/config/pages/home
site/config/pages/about
site/config/pages/services

Only `home` exists in Step 1.7.

================================================================
2. SITE CONFIG DOCUMENT
   ================================================================

Create:

tenants/{tenantId}/site/config

Exact initial persisted fields:

{
status: 'DRAFT',
createdAt,
updatedAt,
createdByUserId
}

Do not add:

domain
theme
branding
SEO
analytics
social configuration
publishing metadata

yet.

================================================================
3. HOME PAGE DOCUMENT
   ================================================================

Create:

tenants/{tenantId}/site/config/pages/home

Exact initial shape:

{
id: 'home',
slug: '/',
title: 'Home',
sections: [...],
createdAt,
updatedAt
}

Do not omit `slug`.

Do not omit page timestamps.

================================================================
4. INITIAL HERO — IMPORTANT CONTENT OVERRIDE
   ================================================================

The initial page contains exactly ONE section:

{
id: 'hero',
type: 'hero',
content: {
title: '<tenant name>'
}
}

Do NOT create:

subtitle
ctaLabel

during initialization.

Do NOT generate marketing copy.

Specifically, do NOT use Claude's suggested:

"Your website is being prepared."
"Contact us"

We know only the Business name at this point.

The persistence layer must not invent content.

================================================================
5. SHARED SITE SCHEMA
   ================================================================

Expand:

platform/packages/site-schema/src/index.ts

Preserve the existing HeroContent contract.

Add the minimum actual site contract.

Conceptually:

export interface HeroContent {
title: string
subtitle?: string
ctaLabel?: string
}

export interface HeroSection {
id: string
type: 'hero'
content: HeroContent
}

export type SiteSection =
| HeroSection

export interface SitePage {
id: string
slug: string
title: string
sections: SiteSection[]
}

export type SiteStatus =
| 'DRAFT'
| 'PUBLISHED'

export interface SiteDefinition {
status: SiteStatus
pages: SitePage[]
}

IMPORTANT:

HeroSection MUST have `id`.

SitePage MUST have `slug`.

Do not remove optional subtitle/ctaLabel from HeroContent because the existing
Hero component supports those future values.

They are simply not initialized in Step 1.7.

Do not add runtime schema libraries yet.

================================================================
6. SITE SERVICE
   ================================================================

Add:

server/services/siteService.js

Follow existing service conventions:

- httpError(status, message)
- Date.now() timestamps
- module-level Firestore reference
- `_setDb()` test seam

Implement:

initializeSite(tenantId, actorUserId)

getSite(tenantId)

================================================================
7. INITIALIZE SITE
   ================================================================

initializeSite must:

1. Verify tenant exists.
2. Read tenant name.
3. Verify site/config does not already exist.
4. Create config.
5. Create pages/home.
6. Perform config + home creation atomically.
7. Return aggregate SiteDefinition.

Use a Firestore transaction.

ALL transaction reads must occur before transaction writes.

Config:

{
status: 'DRAFT',
createdAt: now,
updatedAt: now,
createdByUserId: actorUserId
}

Home:

{
id: 'home',
slug: '/',
title: 'Home',
sections: [
{
id: 'hero',
type: 'hero',
content: {
title: tenant.name
}
}
],
createdAt: now,
updatedAt: now
}

No subtitle.
No CTA.

Duplicate site/config:

409 Site already initialized

Missing tenant:

404 Tenant not found

Concurrent initialization must not allow two successful creations.

================================================================
8. GET SITE
   ================================================================

getSite must read:

tenants/{tenantId}/site/config

and:

tenants/{tenantId}/site/config/pages/home

For Step 1.7 it is acceptable to load the known `home` document directly.

Do not build generalized multi-page collection loading yet unless it is
simpler and stays tightly scoped.

Missing config:

404 Site not initialized

Return an aggregate SiteDefinition, NOT raw Firestore snapshots.

Expected:

{
status: 'DRAFT',
pages: [
{
id: 'home',
slug: '/',
title: 'Home',
sections: [
{
id: 'hero',
type: 'hero',
content: {
title: '<business name>'
}
}
]
}
]
}

Do not expose:

createdAt
updatedAt
createdByUserId
Firestore paths

in SiteDefinition for this milestone.

Those values remain persistence/admin metadata.

================================================================
9. ROUTES
   ================================================================

Reuse the existing `/tenants` router and dependency-injection conventions.

Add:

POST /tenants/:tenantId/site

Authorization:

PLATFORM_ADMIN only

Success:

201

The route must pass:

req.params.tenantId
req.user.id

to initializeSite.

Add:

GET /tenants/:tenantId/site

Authorization:

PLATFORM_ADMIN
or OWNER
or ADMIN
or STAFF

Use existing requireTenantRole behavior so PLATFORM_ADMIN retains its normal
bypass.

Success:

200

Do not duplicate authorization logic.

================================================================
10. CSRF / MIDDLEWARE
    ================================================================

Continue relying on the existing app-level middleware:

session
passport
csrfProtection
/tenants tenantLimiter
isAuthenticated
route authorization

POST site initialization must automatically receive normal authenticated CSRF
protection.

Do not add another CSRF implementation.

================================================================
11. PORTAL SITE API
    ================================================================

Add:

platform/apps/portal/lib/site.ts

Use the existing Step 1.6 API client.

Portal must consume the shared:

@bakerrang/site-schema

SiteDefinition type.

Provide:

initializeSite(tenantId)

GET/POST helpers as needed.

No new request framework.

================================================================
12. PORTAL DEPENDENCY
    ================================================================

Add:

@bakerrang/site-schema

to the portal workspace dependencies.

Configure Next transpilePackages appropriately because the package ships
workspace TypeScript source.

Do not duplicate SiteDefinition locally.

================================================================
13. PORTAL BUSINESS WEBSITE CONTROL
    ================================================================

Add a small business-row website control.

A structure similar to:

BusinessWebsite.tsx

is approved.

It should allow:

Initialize Website

For the current browser session:

successful initialization:
show Website: DRAFT

409:
call GET /tenants/:tenantId/site
if successful:
show Website: DRAFT

Other errors:
show a small safe inline error

Do NOT build:

business detail page
CMS
editor
preview
publishing UI

================================================================
14. NO EAGER N+1 SITE FETCHING
    ================================================================

Do NOT issue:

GET /tenants/:tenantId/site

for every business when the Business list initially loads.

The tenant list currently contains no website status.

For Step 1.7:

- initialization success may set DRAFT locally
- a 409 may fetch the existing SiteDefinition
- a browser refresh is NOT required to automatically rediscover every
  business site's status

Do not change GET /tenants merely to add website status in this milestone.

We will address efficient site summaries/status in a later site-management
step.

================================================================
15. SITE RENDERER SECURITY BOUNDARY
    ================================================================

Do NOT modify the site-renderer to access Firestore.

Do NOT create Firestore credentials for it.

Do NOT create public site API endpoints yet.

Future architecture remains:

site-renderer
↓
sanitized public Express API
↓
Firestore

Step 1.8 will establish that boundary.

================================================================
16. FAKE DB / TESTS
    ================================================================

Use the existing fake DB if it supports:

collection()
doc()
subcollections
runTransaction()
transaction.get()
transaction.set()

Extend it only if required for the corrected:

site/config/pages/home

path.

Do not add Firestore Emulator unless genuinely necessary.

Tests must cover at minimum:

- missing tenant -> 404
- platform admin route can initialize
- unauthorized initialization blocked
- STAFF cannot initialize
- config created
- config.status === DRAFT
- config.createdByUserId matches actor
- home page created at corrected physical path
- home.id === 'home'
- home.slug === '/'
- home.title === 'Home'
- exactly one section
- section.id === 'hero'
- section.type === 'hero'
- hero content contains tenant name
- hero content does NOT contain subtitle
- hero content does NOT contain ctaLabel
- duplicate initialization -> 409
- failed duplicate init causes no partial write
- getSite -> aggregate SiteDefinition
- SiteDefinition contains slug
- missing site -> 404
- tenant roles OWNER/ADMIN/STAFF may GET
- existing tenant tests remain passing

If the fake transaction cannot perfectly model Firestore contention, unit-test
the duplicate guard and transaction behavior supported by the existing fake;
real duplicate/concurrency semantics are provided by Firestore transactions.

================================================================
17. SHARED SCHEMA VERIFICATION
    ================================================================

Ensure:

Hero still consumes HeroContent successfully.

site-components builds.

portal builds.

site-renderer builds.

SiteDefinition represents exactly the initial API response.

Do not modify Hero merely because the shared schema grew.

================================================================
18. MANUAL DEV VERIFICATION
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

only.

Verify:

1. API startup logs bakerrang-dev.
2. Portal login succeeds.
3. Existing Business is listed.
4. Click Initialize Website.
5. Portal displays Website: DRAFT.
6. In DEV Firestore verify:

tenants/{tenantId}/site/config

contains:

status: DRAFT
createdAt
updatedAt
createdByUserId

7. Verify:

tenants/{tenantId}/site/config/pages/home

contains:

id: home
slug: /
title: Home
createdAt
updatedAt

8. Verify exactly one section:

{
id: 'hero',
type: 'hero',
content: {
title: '<business name>'
}
}

9. Verify no subtitle or ctaLabel exists.

10. Attempt Initialize Website again.

11. Verify 409 is handled by loading the existing definition and continuing to
    show DRAFT.

12. Confirm production Firestore was untouched.

13. Refreshing the browser does NOT need to automatically rediscover DRAFT in
    Step 1.7; absence of eager site-status fetching is intentional.

================================================================
19. VERIFY
    ================================================================

Server:

npm test

Scoped/new StandardJS lint and syntax verification.

Do not fix unrelated pre-existing lint debt.

Platform:

npm run typecheck
npm run lint
npm run build

Both portal and site-renderer must remain green.

================================================================
20. OUT OF SCOPE
    ================================================================

Do not implement:

public site endpoint
dynamic renderer data fetching
direct renderer Firestore access
preview URLs
domains
publishing UI
page editing
section editing
reordering
multiple pages
themes
branding
services section
gallery
testimonials
quote form
SEO
media
leads
analytics
Google integrations
Instagram
AI content generation

================================================================
21. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Actual Firestore paths implemented.
4. Exact persisted config shape.
5. Exact persisted home shape.
6. Exact SiteDefinition response.
7. Transaction/duplicate behavior.
8. Routes and authorization.
9. Shared schema changes.
10. Portal integration.
11. Confirmation no eager N+1 site loading was added.
12. Confirmation site-renderer has no Firestore access.
13. Server test results.
14. Platform typecheck/lint/build results.
15. Manual DEV verification if performed.
16. Any deviations and why.
17. Anything that should influence Step 1.8.

Do not implement beyond Step 1.7.