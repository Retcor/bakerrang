# Step 1.9 — Publishing & Site Lifecycle

OBJECTIVE

Establish a real working-copy → published-snapshot boundary.

Publishing must create a stable public snapshot so future changes to the
working SiteDefinition cannot automatically alter the live website.

------------------------------------------------------------
1. WORKING CONTENT
------------------------------------------------------------

Existing working site data remains:

tenants/{tenantId}/site/config

and:

tenants/{tenantId}/site/config/pages/home

These remain the editable/working representation.

Do not move or duplicate the working page structure.

------------------------------------------------------------
2. PUBLISHED SNAPSHOT
------------------------------------------------------------

Add:

tenants/{tenantId}/site/config/published/current

Persist:

{
siteDefinition: <sanitized SiteDefinition>,
publishedAt,
publishedByUserId
}

siteDefinition.status must be:

PUBLISHED

The snapshot must contain only the public SiteDefinition.

Do not put persistence/audit fields inside SiteDefinition.

------------------------------------------------------------
3. PUBLISH OPERATION
------------------------------------------------------------

Add backend operation:

publishSite(tenantId, actorUserId)

It must:

1. Verify site/config exists.
2. Read the current working page(s).
3. Build the canonical sanitized SiteDefinition.
4. Override the snapshot SiteDefinition status to PUBLISHED.
5. Write published/current.
6. Update site/config:

   status: PUBLISHED
   updatedAt: now

7. Persist publication audit metadata appropriately.
8. Perform the publication writes atomically.

All transaction reads must occur before writes.

------------------------------------------------------------
4. REPUBLISH
------------------------------------------------------------

Publishing an already-PUBLISHED site is allowed.

Do NOT return 409 simply because status is already PUBLISHED.

A publish operation always means:

"Take the current working SiteDefinition and make it the live snapshot."

Therefore:

PUBLISHED
+ working changes
+ Publish
  ↓
  replace published/current

This gives us a future Republish flow without additional APIs.

------------------------------------------------------------
5. UNPUBLISH
------------------------------------------------------------

Add:

unpublishSite(tenantId, actorUserId)

It should:

- verify the site exists
- set config.status = DRAFT
- update config.updatedAt
- optionally persist simple unpublish audit metadata if consistent with
  existing conventions

Do NOT delete:

published/current

The snapshot may remain internally.

The public API must simply refuse to expose it while the site is DRAFT.

Unpublish should be safe/idempotent where practical.

------------------------------------------------------------
6. ROUTES
------------------------------------------------------------

Add authenticated routes:

POST /tenants/:tenantId/site/publish

POST /tenants/:tenantId/site/unpublish

Initial authorization:

PLATFORM_ADMIN only

Reuse:

isAuthenticated
CSRF
requirePlatformAdmin
tenantLimiter

Do not implement another authorization system.

------------------------------------------------------------
7. ADMIN GET
------------------------------------------------------------

Existing:

GET /tenants/:tenantId/site

continues returning the WORKING SiteDefinition.

It must NOT return the published snapshot instead.

Portal/site management always needs the editable working state.

------------------------------------------------------------
8. PUBLIC GET — IMPORTANT CHANGE
------------------------------------------------------------

Existing:

GET /public/sites/:tenantId

must change behavior.

NORMAL PUBLIC ACCESS:

If config.status !== PUBLISHED:

    404 Site not found

If config.status === PUBLISHED:

    load published/current

If no published/current exists:

    fail closed with 404 Site not found

Return:

published/current.siteDefinition

Do NOT return the working page documents.

------------------------------------------------------------
9. DEV DRAFT PREVIEW
------------------------------------------------------------

Preserve:

ALLOW_DRAFT_PUBLIC_SITES=true

outside production.

When explicit draft preview is enabled:

the public endpoint may return the CURRENT WORKING SiteDefinition.

This is intentional developer preview behavior.

Therefore:

DEV + preview=true
→ working content

normal public / production
→ published snapshot only

Production remains unable to enable draft preview.

------------------------------------------------------------
10. CRITICAL ISOLATION TEST
------------------------------------------------------------

Automated tests must prove:

1. Publish working Hero title "Version A".
2. Public API returns "Version A".
3. Change working Hero to "Version B".
4. Public API STILL returns "Version A".
5. Publish again.
6. Public API now returns "Version B".

This is one of the most important tests in Step 1.9.

It proves that publishing actually means something.

------------------------------------------------------------
11. SHARED SITE SCHEMA
------------------------------------------------------------

No changes to SiteDefinition should be necessary.

Continue using:

SiteDefinition
SitePage
SiteSection

from:

@bakerrang/site-schema

Do not create a public-specific duplicate schema.

------------------------------------------------------------
12. PORTAL SITE MANAGEMENT
------------------------------------------------------------

Improve BusinessWebsite from the temporary Step 1.7 behavior.

Avoid eager N+1 GET requests.

Initial business row may show:

[ Manage Website ]

When clicked:

GET /tenants/:tenantId/site

Then:

404:
offer Initialize Website

DRAFT:
show Website: DRAFT
[ Publish ]

PUBLISHED:
show Website: PUBLISHED
[ Republish ]
[ Unpublish ]

This is an ON-DEMAND request.

Do not fetch site status for every business automatically.

------------------------------------------------------------
13. INITIALIZE
------------------------------------------------------------

Existing site initialization remains unchanged.

If Manage Website discovers the site does not exist:

[ Initialize Website ]

After initialization:

Website: DRAFT
[ Publish ]

------------------------------------------------------------
14. PUBLISH PORTAL FLOW
------------------------------------------------------------

Use existing shared apiSend.

POST:

/tenants/:tenantId/site/publish

During request:

disable lifecycle buttons
show publishing state

Success:

display:

Website: PUBLISHED

and expose:

[ Republish ]
[ Unpublish ]

------------------------------------------------------------
15. UNPUBLISH PORTAL FLOW
------------------------------------------------------------

POST:

/tenants/:tenantId/site/unpublish

Success:

display:

Website: DRAFT

and expose:

[ Publish ]

Public site becomes unavailable under normal public visibility rules.

------------------------------------------------------------
16. NO PUBLIC SNAPSHOT IN PORTAL TYPES
------------------------------------------------------------

The portal does not need:

publishedAt
publishedByUserId
published/current Firestore shape

to perform this milestone.

Keep publication persistence details backend-internal unless a concrete UI
requirement exists.

------------------------------------------------------------
17. RENDERER
------------------------------------------------------------

The renderer should require little or NO change.

It still calls:

GET /public/sites/:tenantId

The backend decides whether that request receives:

working preview
or
published snapshot.

This is intentional.

Do not teach the renderer about draft/published Firestore structure.

------------------------------------------------------------
18. TESTS
------------------------------------------------------------

Backend tests must cover at minimum:

- publish missing site -> 404
- publish creates published/current
- snapshot SiteDefinition status = PUBLISHED
- snapshot contains sanitized SiteDefinition only
- publish updates config status to PUBLISHED
- publish updates updatedAt
- actor publication metadata stored
- already-PUBLISHED site can be republished
- working data changes do NOT alter current public snapshot
- republish updates public snapshot
- unpublish changes config to DRAFT
- unpublish causes normal public endpoint to return 404
- retained snapshot is not publicly visible when DRAFT
- dev preview=true still returns working draft
- production preview ceiling still enforced
- PUBLISHED with missing snapshot fails closed
- existing authenticated getSite still returns working definition
- existing tenant/site tests remain green

Use existing node:test/FakeDb infrastructure.

------------------------------------------------------------
19. MANUAL DEV E2E
------------------------------------------------------------

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Start with:

ALLOW_DRAFT_PUBLIC_SITES=false

1. Open Manage Website.
2. Site currently DRAFT.
3. Public renderer should be unavailable.
4. Click Publish.
5. Portal shows PUBLISHED.
6. Renderer now loads without draft-preview flag.
7. Verify published/current exists.
8. Record live Hero title.

Then directly alter the working Home Hero title in DEV Firestore:

"UNPUBLISHED WORKING CHANGE"

9. Reload renderer.
10. Renderer MUST still show the old published title.

Then temporarily:

ALLOW_DRAFT_PUBLIC_SITES=true

11. Restart API.
12. Renderer should show "UNPUBLISHED WORKING CHANGE" because preview uses the
    working definition.

Restore:

ALLOW_DRAFT_PUBLIC_SITES=false

13. Click Republish.
14. Renderer now shows "UNPUBLISHED WORKING CHANGE".

15. Click Unpublish.
16. Renderer becomes not-found again.

17. Confirm published/current still exists internally.

18. Confirm production Firestore remains untouched.

------------------------------------------------------------
20. OUT OF SCOPE
------------------------------------------------------------

Do not implement:

revision history
multiple published versions
rollback UI
scheduled publishing
approval workflows
business-member publishing permissions
page editing
section editing
new sections
CMS
custom domains
themes
SEO
media
leads
analytics
production deployment

------------------------------------------------------------
DEFINITION OF DONE
------------------------------------------------------------

Step 1.9 is complete when:

1. Working and public content are physically separated.
2. Publish creates a stable sanitized snapshot.
3. Public API uses the snapshot.
4. Editing working content cannot alter live output.
5. Republish replaces live output.
6. Unpublish removes public visibility.
7. Explicit DEV preview still uses working data.
8. Renderer remains unaware of Firestore/publication internals.
9. Portal supports Manage / Publish / Republish / Unpublish.
10. Backend tests pass.
11. Platform typecheck/lint/build pass.
12. Live DEV lifecycle verification passes.