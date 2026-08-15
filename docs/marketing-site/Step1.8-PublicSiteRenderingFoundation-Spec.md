# Step 1.8 — Public Site Rendering Foundation

Objective:
Render a tenant's persisted SiteDefinition through the public Next.js
site-renderer without giving the renderer Firestore access.

------------------------------------------------------------
1. PUBLIC EXPRESS API
------------------------------------------------------------

Add a public site endpoint conceptually:

GET /public/sites/:tenantId

It must NOT require:

- Google authentication
- Express session
- tenant membership
- CSRF

It should use the backend/service layer to retrieve and sanitize site data.

Do not let the site-renderer read Firestore directly.

------------------------------------------------------------
2. RESPONSE
------------------------------------------------------------

Return the canonical shared SiteDefinition shape:

{
"status": "DRAFT",
"pages": [
{
"id": "home",
"slug": "/",
"title": "Home",
"sections": [
{
"id": "hero",
"type": "hero",
"content": {
"title": "<business name>"
}
}
]
}
]
}

Do not return:

createdAt
updatedAt
createdByUserId
tenant members
user information
Firestore paths
other BakerRang data

------------------------------------------------------------
3. DRAFT/PUBLISHED SAFETY
------------------------------------------------------------

Inspect the cleanest way to prevent production from accidentally exposing
DRAFT sites.

Preferred conceptual behavior:

production:
only PUBLISHED sites are publicly readable

local/development:
DRAFT may be readable for development preview

A configuration option such as:

ALLOW_DRAFT_PUBLIC_SITES=true

is acceptable if it cleanly fits the existing configuration system.

If absent:

- production should fail closed for DRAFT
- non-production may either require explicit enablement or use a clearly
  documented safe development behavior

Claude should recommend the safest minimal design based on the existing env
patterns.

Do not implement publishing UI yet.

------------------------------------------------------------
4. SITE SERVICE
------------------------------------------------------------

Reuse existing site persistence logic where possible.

Do not duplicate Firestore traversal unnecessarily.

It is acceptable to add a service operation such as:

getPublicSite(tenantId)

if this cleanly separates public visibility rules from administrative:

getSite(tenantId)

Public visibility rules belong on the backend.

The renderer must not decide whether a site is publishable.

------------------------------------------------------------
5. PUBLIC ROUTER
------------------------------------------------------------

Prefer a separate route/module boundary for unauthenticated public APIs rather
than placing public behavior inside the authenticated tenant router.

Conceptually:

server/routes/publicSites.js

mounted:

/public/sites

Do not accidentally inherit:

isAuthenticated
tenantLimiter intended for administrative tenant operations
tenant authorization middleware

A reasonable public rate limiter is allowed if consistent with existing
security infrastructure.

------------------------------------------------------------
6. SITE-RENDERER DATA ACCESS
------------------------------------------------------------

The site-renderer should call the public Express endpoint over HTTP.

Use an environment variable such as:

SITE_API_BASE_URL=http://localhost:8080

Because this request can happen server-side in Next.js, do not require
NEXT_PUBLIC_ unless browser access is actually necessary.

Prefer server-side fetching.

Do not expose backend credentials because none should be required.

------------------------------------------------------------
7. RENDERER ROUTING
------------------------------------------------------------

Introduce a development-friendly tenant-addressed route.

Conceptually:

/site/[tenantId]

or another clean equivalent consistent with the current Next 16 app.

Example:

http://localhost:3002/site/<tenantId>

Do not implement custom domain routing yet.

------------------------------------------------------------
8. HOME PAGE SELECTION
------------------------------------------------------------

Given SiteDefinition.pages:

select the page whose:

slug === "/"

Do not assume array index 0 is permanently Home if avoiding that assumption is
trivial.

If no Home page exists:

render/notFound or return an appropriate controlled failure.

------------------------------------------------------------
9. SECTION RENDERING
------------------------------------------------------------

Create the smallest reusable section-rendering boundary.

Conceptually:

SectionRenderer

switch(section.type)

Current supported section:

hero

It should render:

<Hero content={section.content} />

from:

@bakerrang/site-components

Unknown section types should fail safely.

Do not create future section types.

------------------------------------------------------------
10. SHARED CONTRACT
------------------------------------------------------------

Use:

@bakerrang/site-schema

for:

SiteDefinition
SitePage
SiteSection
HeroSection

Do not redefine site types inside site-renderer.

------------------------------------------------------------
11. HERO
------------------------------------------------------------

The existing Hero component should render persisted HeroContent.

Do not hardcode the business name in the renderer.

Do not create fallback marketing copy.

The visible title must originate from the persisted SiteDefinition.

------------------------------------------------------------
12. LOADING / ERROR BEHAVIOR
------------------------------------------------------------

Since the renderer should preferably fetch server-side, avoid unnecessary
client-side loading state.

Handle:

404 site missing
403/not-public due to DRAFT policy
backend/network failure

appropriately.

Do not expose server internals to the browser.

------------------------------------------------------------
13. CACHING
------------------------------------------------------------

Do not introduce sophisticated caching yet.

Because site definitions will soon be editable, prefer fresh/correct behavior
during development.

Claude should inspect Next 16 fetch/cache defaults and explicitly choose the
smallest development-safe behavior.

Do not guess based on older Next versions.

------------------------------------------------------------
14. NO FIRESTORE IN NEXT
------------------------------------------------------------

The site-renderer must contain:

NO @google-cloud/firestore dependency
NO Firebase Admin
NO service account
NO ADC Firestore usage
NO direct database calls

All data comes from Express HTTP API.

------------------------------------------------------------
15. TESTING
------------------------------------------------------------

Backend tests should cover:

- public initialized site returns sanitized SiteDefinition
- missing site returns 404
- public response excludes persistence metadata
- DRAFT visibility policy
- PUBLISHED visibility policy
- endpoint requires no authenticated session
- existing authenticated site routes remain protected

Renderer/static verification should prove:

- shared SiteDefinition is consumed
- Home page selected by slug
- hero section maps to Hero component
- unknown section behavior is controlled
- typecheck/lint/build succeed

Avoid adding a major testing framework unless already justified by repository
structure.

------------------------------------------------------------
16. MANUAL DEV VERIFICATION
------------------------------------------------------------

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Initialize Website from portal if necessary.

Start API.

Start site-renderer.

Visit:

http://localhost:<renderer-port>/site/<tenantId>

Verify:

- Hero renders
- title matches persisted Business name
- changing nothing in renderer still produces persisted value
- renderer has no authenticated browser session requirement
- renderer has no Firestore credentials
- production Firestore remains untouched

------------------------------------------------------------
17. OUT OF SCOPE
------------------------------------------------------------

Do not implement:

custom domains
hostname lookup
publishing UI
CMS
page editing
section editing
additional section types
themes
branding
SEO
media
lead forms
analytics
Google integrations
ISR/revalidation system
CDN strategy
production deployment

Definition of Done:

1. Public site API exists.
2. Renderer accesses only that API.
3. Public response is sanitized.
4. DRAFT exposure is explicitly controlled.
5. Tenant-addressed renderer route works.
6. Persisted Home page is selected.
7. Persisted Hero renders through shared Hero component.
8. No Firestore access exists in site-renderer.
9. Backend tests pass.
10. Platform typecheck/lint/build pass.
11. Live DEV render succeeds.