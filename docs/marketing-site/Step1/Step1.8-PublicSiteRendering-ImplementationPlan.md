Implement Step 1.8 — Public Site Rendering Foundation.

Claude Code has inspected the repository and produced an approved
implementation plan.

Follow Claude's repository findings and implementation plan, with the
corrections below taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Complete the first public website rendering vertical slice:

bakerrang-dev Firestore
↓
Express sanitized public API
↓
Next.js site-renderer
↓
persisted Home page
↓
persisted Hero title

The site-renderer must never access Firestore directly.

================================================================
1. PUBLIC SITE SERVICE
   ================================================================

Extend:

server/services/siteService.js

with:

getPublicSite(tenantId, env = process.env)

Reuse the existing:

getSite(tenantId)

and its existing SiteDefinition mapping.

Do NOT duplicate Firestore reads/mapping unnecessarily.

Existing getSite already returns the sanitized aggregate contract.

================================================================
2. DRAFT VISIBILITY CONFIG
   ================================================================

Add:

server/config/publicSite.js

Provide a pure helper equivalent to:

draftPreviewEnabled(env)

Rules:

Draft preview is enabled ONLY when:

- NODE_ENV !== 'production'
- AND ALLOW_DRAFT_PUBLIC_SITES === 'true'

The flag must be explicitly the string:

true

Unset or any other value means disabled.

Production is an unconditional ceiling:

NODE_ENV === 'production'

must NEVER allow DRAFT sites, even if:

ALLOW_DRAFT_PUBLIC_SITES=true

================================================================
3. PUBLIC VISIBILITY RULES
   ================================================================

getPublicSite must behave as follows:

PUBLISHED
-> 200 SiteDefinition

DRAFT + explicit preview enabled outside production
-> 200 SiteDefinition

DRAFT + preview disabled
-> 404 Site not found

DRAFT + flag=true in production
-> 404 Site not found

missing site
-> 404 Site not found

Do not reveal whether a 404 represents:

- nonexistent site
- hidden DRAFT site

Normalize those cases to:

Site not found

Do not implement publishing.

================================================================
4. PUBLIC RESPONSE
   ================================================================

Return ONLY the existing shared SiteDefinition:

{
status,
pages: [
{
id,
slug,
title,
sections
}
]
}

Do not expose:

createdAt
updatedAt
createdByUserId
Firestore paths
tenant members
user data
session data
internal configuration

No additional sanitization layer is required if the existing getSite mapping
already guarantees this exact boundary.

================================================================
5. PUBLIC ROUTER
   ================================================================

Add a separate unauthenticated router:

server/routes/publicSites.js

Route:

GET /sites/:tenantId

Mount from app.js as:

/public

Resulting endpoint:

GET /public/sites/:tenantId

The public router must NOT use:

isAuthenticated
requirePlatformAdmin
requireTenantRole
tenant membership middleware

Do not put the endpoint inside the authenticated tenant router.

================================================================
6. NO PUBLIC-SITE IP RATE LIMITER IN STEP 1.8
   ================================================================

OVERRIDE CLAUDE'S publicSiteLimiter proposal.

Do NOT add the proposed:

300 requests / 15 minutes

IP-based public site limiter in this milestone.

Reason:

The Next site-renderer fetches this API server-side.

In deployment, requests from many visitors may therefore reach Express from
shared renderer infrastructure/source addresses.

An IP-based application limit could accidentally throttle all public site
traffic together.

This endpoint is currently:

- GET only
- read-only
- small
- sanitized

We will design appropriate public API / edge / CDN / Cloud Run protection once
deployment topology is established.

Do not modify unrelated existing rate limiters.

================================================================
7. MIDDLEWARE / ANONYMOUS ACCESS
   ================================================================

Mount the public router so that it remains outside authenticated tenant
middleware.

Global middleware may still run:

helmet
cors
session
passport
csrf

but the route itself must work with:

req.user === undefined

GET must not require CSRF.

CORS changes are not expected because the site-renderer fetch is server-side
and does not send a browser Origin header.

================================================================
8. ENVIRONMENT EXAMPLE
   ================================================================

Update:

server/.env.example

Document:

ALLOW_DRAFT_PUBLIC_SITES=false

or equivalent explanatory example.

For local DEV rendering, the developer will explicitly configure:

ALLOW_DRAFT_PUBLIC_SITES=true

Production must not depend merely on the flag; NODE_ENV=production remains the
hard ceiling.

================================================================
9. SITE-RENDERER API CLIENT
   ================================================================

Add:

platform/apps/site-renderer/lib/api.ts

This module is server-side only.

Use:

SITE_API_BASE_URL

NOT:

NEXT_PUBLIC_SITE_API_BASE_URL

Conceptual behavior:

const apiBaseUrl = process.env.SITE_API_BASE_URL

If missing:
throw a clear server configuration error

Fetch:

GET ${SITE_API_BASE_URL}/public/sites/<tenantId>

IMPORTANT:

Encode the route value:

encodeURIComponent(tenantId)

Do not interpolate the raw route parameter directly into the API URL.

Example:

const encodedTenantId = encodeURIComponent(tenantId)

fetch(
`${baseUrl()}/public/sites/${encodedTenantId}`,
{ cache: 'no-store' }
)

================================================================
10. FETCH / CACHING
    ================================================================

Use:

cache: 'no-store'

explicitly.

Claude verified from the locally installed Next 16 documentation that fetch is
not cached by default, but `no-store` makes our current correctness requirement
explicit.

Do not add:

ISR
revalidation
cache tags
CDN behavior

yet.

================================================================
11. SITE-RENDERER ROUTE
    ================================================================

Add the Next 16 App Router tenant-addressed route:

app/site/[tenantId]/page.tsx

Use the actual Next 16 async params contract:

params: Promise<{ tenantId: string }>

and:

const { tenantId } = await params

Fetch the SiteDefinition server-side.

No client-side fetching.

No authenticated browser session.

================================================================
12. HOME SELECTION
    ================================================================

Select Home using:

site.pages.find(page => page.slug === '/')

Do not permanently assume:

pages[0]

If Home is missing:

notFound()

================================================================
13. API ERROR BEHAVIOR
    ================================================================

Public API 404:

return null from the renderer API helper

then:

notFound()

This covers:

missing site
hidden DRAFT site

API 5xx / network error:

throw a safe server-side Error.

Do not include backend response bodies or internal details in browser-visible
errors.

Default Next error handling is sufficient for this milestone.

================================================================
14. SECTION RENDERER
    ================================================================

Add:

platform/apps/site-renderer/components/SectionRenderer.tsx

Use:

SiteSection

from:

@bakerrang/site-schema

Current behavior:

switch(section.type)

case 'hero':
return <Hero content={section.content} />

default:
return null

Unknown/future sections should be skipped safely rather than crashing the page.

Do not add any new section types.

================================================================
15. SHARED CONTRACT
    ================================================================

Use:

@bakerrang/site-schema

directly.

Add it as a DIRECT site-renderer workspace dependency.

Do not redefine:

SiteDefinition
SitePage
SiteSection
HeroSection

inside the renderer.

Existing next.config.ts already lists site-schema in transpilePackages; preserve
that if confirmed by the repository.

================================================================
16. STATIC DEMO ROOT
    ================================================================

Do not expand scope around the existing site-renderer root page.

The milestone route is:

/site/[tenantId]

If the existing `/` static Hero demo can remain without interfering, leave it
alone.

Do not redesign the renderer landing page in Step 1.8.

================================================================
17. FIRESTORE SECURITY BOUNDARY
    ================================================================

The site-renderer must have:

NO @google-cloud/firestore
NO firebase-admin
NO Firebase client SDK for persistence
NO service-account key
NO ADC database access
NO direct Firestore calls

The renderer knows only:

SITE_API_BASE_URL
tenantId

All SiteDefinition data comes through Express HTTP.

================================================================
18. BACKEND TESTS
    ================================================================

Use existing:

node:test
FakeDb

Add tests for:

draftPreviewEnabled:
- non-production + true => true
- non-production + missing => false
- non-production + false => false
- production + true => false
- production + missing => false

getPublicSite:
- PUBLISHED => success
- DRAFT + preview enabled => success
- DRAFT + preview disabled => 404 Site not found
- DRAFT + production even with flag=true => 404
- missing site => normalized 404 Site not found
- response contains only sanitized SiteDefinition metadata

Public route:
- request succeeds without req.user
- 404 service error maps correctly

================================================================
19. VERIFY ACTUAL APP MOUNT IS PUBLIC
    ================================================================

In addition to testing createPublicSiteRouter in isolation, verify that the
ACTUAL app.js mount does not place:

/public

behind:

isAuthenticated
tenant auth middleware

If the existing test harness makes an assembled-app anonymous HTTP test
straightforward, add one:

anonymous GET /public/sites/:tenantId

must reach the public router without authentication rejection.

If doing so would require a disproportionate new integration harness, do not
introduce one solely for this milestone.

Instead:

- structurally verify the app.js middleware ordering
- ensure /public is directly mounted without isAuthenticated
- report this explicitly in the final implementation report

Do not claim router-unit testing alone proves app-level middleware placement.

================================================================
20. RENDERER VERIFICATION
    ================================================================

Do not add a major frontend testing framework.

Verify through:

npm run typecheck
npm run lint
npm run build

Ensure both:

portal
site-renderer

still build.

Ensure SectionRenderer type-checks against the shared SiteSection.

================================================================
21. LOCAL ENVIRONMENT
    ================================================================

Add an example for the renderer such as:

platform/apps/site-renderer/.env.local.example

containing:

SITE_API_BASE_URL=http://localhost:8080

Ensure actual .env.local files remain ignored.

Do not commit developer-local environment values.

================================================================
22. MANUAL DEV E2E
    ================================================================

All persistence must remain in:

bakerrang-dev

Server local environment:

FIRESTORE_PROJECT_ID=bakerrang-dev
ALLOW_DRAFT_PUBLIC_SITES=true

Start API.

Confirm:

Firestore configuration:
project: bakerrang-dev

Ensure the Step 1.7 Website exists for the Business.

Renderer environment:

SITE_API_BASE_URL=http://localhost:8080

Start site-renderer.

Visit:

http://localhost:3002/site/<tenantId>

Verify:

1. Page renders.
2. Hero title equals the persisted Business name.
3. Hero title is coming from the public API, not static renderer data.
4. No Google login/session is required to view it.
5. Renderer has no Firestore credentials/access.
6. Public API response contains only SiteDefinition.

Fail-safe verification:

1. Stop API.
2. Set/unset:

ALLOW_DRAFT_PUBLIC_SITES=false

3. Restart API.
4. Reload the tenant route.
5. DRAFT site must return/render not-found.

Restore true for local development afterward if desired.

Confirm production Firestore remains untouched.

================================================================
23. OUT OF SCOPE
    ================================================================

Do not implement:

custom domains
hostname lookup
publishing UI
CMS
page editing
section editing
new section types
themes
branding
SEO
media
leads
analytics
Google integrations
ISR
revalidation architecture
CDN
production deployment

================================================================
24. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Public endpoint implemented.
4. Confirmation it requires no authentication.
5. Draft/PUBLISHED visibility behavior.
6. Exact public response.
7. Confirmation public data reuses getSite mapping.
8. Renderer HTTP client.
9. Confirmation tenantId is URL-encoded.
10. Next route and async params behavior.
11. `no-store` caching choice.
12. SectionRenderer behavior.
13. Confirmation renderer has no Firestore dependency/access.
14. Backend test results.
15. App-mount anonymous-access verification.
16. Platform typecheck result.
17. Platform lint result.
18. Platform build result.
19. Manual DEV E2E if performed.
20. Any deviations and why.
21. Anything that should influence Step 1.9.

Do not implement beyond Step 1.8.