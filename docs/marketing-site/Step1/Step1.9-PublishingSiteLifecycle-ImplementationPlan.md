Implement Step 1.9 — Publishing & Site Lifecycle.

Claude Code has inspected the actual repository and produced an approved
implementation plan.

Follow Claude's repository findings and general implementation plan, with the
corrections in this assignment taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Create a real:

WORKING COPY
↓ Publish
PUBLISHED SNAPSHOT
↓
PUBLIC API
↓
SITE RENDERER

Future edits to working page documents must NOT automatically alter the
public website.

================================================================
1. EXISTING WORKING DATA
   ================================================================

Keep existing working persistence unchanged:

tenants/{tenantId}/site/config

tenants/{tenantId}/site/config/pages/home

The working Home page remains the source that future CMS/editor operations
will modify.

Do not relocate working documents.

================================================================
2. PUBLISHED SNAPSHOT PATH
   ================================================================

Add/use:

tenants/{tenantId}/site/config/published/current

Claude verified this is a valid Firestore document path.

Meaning:

site/config
-> working/lifecycle config

site/config/pages/*
-> working pages

site/config/published/current
-> current live public snapshot

================================================================
3. SNAPSHOT SHAPE
   ================================================================

Persist:

{
siteDefinition: {
status: 'PUBLISHED',
pages: [...]
},

publishedAt: <Date.now()>,
publishedByUserId: <actorUserId>
}

siteDefinition must contain ONLY the existing shared public contract:

status
pages
id
slug
title
sections

Do not put:

createdAt
updatedAt
createdByUserId
publishedAt
publishedByUserId
Firestore paths

inside SiteDefinition.

Publication audit metadata remains outside SiteDefinition.

================================================================
4. PUBLISH SITE
   ================================================================

Add to:

server/services/siteService.js

publishSite(tenantId, actorUserId)

Use a Firestore transaction.

ALL reads must happen before writes.

Read:

site/config
site/config/pages/home

If config missing:

404 Site not initialized

If Home missing:

500 Site home page missing

Build the canonical sanitized working SiteDefinition using the existing
mapping logic.

Then create the snapshot definition by forcing:

status: 'PUBLISHED'

Write/overwrite:

site/config/published/current

with:

{
siteDefinition: snapshotDefinition,
publishedAt: now,
publishedByUserId: actorUserId
}

Also merge into:

site/config

at minimum:

{
status: 'PUBLISHED',
updatedAt: now,
lastPublishedAt: now,
lastPublishedByUserId: actorUserId
}

The lastPublished* fields are approved internal audit metadata.

Return the published SiteDefinition.

================================================================
5. REPUBLISH
   ================================================================

Publishing an already-PUBLISHED site is valid.

Do NOT return 409 merely because config.status is PUBLISHED.

Republish means:

"Take the current working SiteDefinition and replace the current public
snapshot."

Therefore:

Working A
Publish
Snapshot A

Working changes to B
Republish
Snapshot B

No history is retained in this milestone.

================================================================
6. UNPUBLISH
   ================================================================

Add:

unpublishSite(tenantId, actorUserId)

Use a transaction.

Read all required documents before writing.

If site/config missing:

404 Site not initialized

Update config using merge:

{
status: 'DRAFT',
updatedAt: now,
lastUnpublishedAt: now,
lastUnpublishedByUserId: actorUserId
}

The lastUnpublished* audit fields are approved.

DO NOT DELETE:

site/config/published/current

The snapshot remains internally retained.

Return the current working SiteDefinition with status DRAFT.

If returning the full working definition requires Home, read Home BEFORE any
transaction write.

================================================================
7. AUTHENTICATED ADMIN GET REMAINS WORKING COPY
   ================================================================

Do NOT alter the meaning of:

GET /tenants/:tenantId/site

It continues returning the CURRENT WORKING SiteDefinition.

It does NOT return published/current.

The portal needs this working state.

================================================================
8. NORMAL PUBLIC READ
   ================================================================

Refactor:

getPublicSite(tenantId, env)

Normal public behavior when DEV preview is NOT enabled:

1. Read site/config.

2. If config missing:
   404 Site not found

3. If config.status !== 'PUBLISHED':
   404 Site not found

4. Read:
   site/config/published/current

5. If published/current does not exist:
   404 Site not found

6. Validate minimally that:

   snapshot.siteDefinition exists

   AND

   snapshot.siteDefinition.status === 'PUBLISHED'

7. If either check fails:
   404 Site not found

8. Return:

   snapshot.siteDefinition

Do NOT fall back to the working copy.

This is fail-closed behavior.

================================================================
9. DEV PREVIEW — IMPORTANT OVERRIDE
   ================================================================

Preserve:

ALLOW_DRAFT_PUBLIC_SITES=true

only outside production.

When:

draftPreviewEnabled(env) === true

the public endpoint intentionally returns the CURRENT WORKING content.

HOWEVER:

Do NOT simply return getSite() unchanged.

A previously-published site's config may still have:

status: PUBLISHED

while its working content contains unpublished edits.

Returning that content with:

status: PUBLISHED

would falsely imply the previewed working version is live.

Therefore DEV preview must:

1. Load the working definition using getSite().
2. Return the working pages.
3. Override response status to:

   DRAFT

Conceptually:

const working = await getSite(tenantId)

return {
...working,
status: 'DRAFT'
}

Thus:

NORMAL public:
status = PUBLISHED
content = live snapshot

DEV preview:
status = DRAFT
content = current working content

Production remains unable to enable preview.

Do NOT change the authenticated getSite() status semantics.

================================================================
10. PUBLIC VISIBILITY SUMMARY
    ================================================================

DRAFT + preview false
-> 404

DRAFT + preview true outside production
-> 200 working SiteDefinition with status DRAFT

PUBLISHED + preview false
-> 200 published snapshot with status PUBLISHED

PUBLISHED + preview true outside production
-> 200 WORKING SiteDefinition with status DRAFT

PUBLISHED + snapshot missing + preview false
-> 404

PUBLISHED + malformed/missing snapshot.siteDefinition + preview false
-> 404

PUBLISHED + snapshot.siteDefinition.status != PUBLISHED + preview false
-> 404

production + ALLOW_DRAFT_PUBLIC_SITES=true
-> preview remains disabled

================================================================
11. ROUTES
    ================================================================

Inside the existing authenticated tenant router add:

POST /tenants/:tenantId/site/publish

POST /tenants/:tenantId/site/unpublish

Authorization:

PLATFORM_ADMIN only

Reuse existing:

tenantLimiter
isAuthenticated
global CSRF
requirePlatformAdmin
route handle wrapper

Success:

200

Pass:

req.params.tenantId
req.user.id

into the corresponding service operation.

Do not add new auth logic.

================================================================
12. PORTAL SITE API
    ================================================================

Extend:

platform/apps/portal/lib/site.ts

with:

publishSite(tenantId)
unpublishSite(tenantId)

Use the existing:

apiSend()

No new request layer.

No renderer APIs in the portal.

================================================================
13. PORTAL LIFECYCLE UX
    ================================================================

Refactor:

BusinessWebsite.tsx

into the lazy lifecycle control Claude proposed.

INITIAL:

[ Manage Website ]

Do NOT fetch site state until clicked.

On Manage Website:

GET /tenants/:tenantId/site

404:
show [ Initialize Website ]

DRAFT:
Website: DRAFT
[ Publish ]

PUBLISHED:
Website: PUBLISHED
[ Republish ]
[ Unpublish ]

Initialize success:

Website: DRAFT
[ Publish ]

Publish success:

Website: PUBLISHED
[ Republish ]
[ Unpublish ]

Unpublish success:

Website: DRAFT
[ Publish ]

Keep safe inline error states.

Disable relevant lifecycle buttons while a request is pending.

Do not eagerly load site status for every Business row.

================================================================
14. NO "DIRTY" STATE YET
    ================================================================

Do NOT attempt to determine whether:

working content != published snapshot

yet.

Therefore a published site may show:

Website: PUBLISHED
[ Republish ]
[ Unpublish ]

even if no unpublished changes exist.

Later editing work may introduce a dirty/unpublished-changes concept.

Out of scope now.

================================================================
15. RENDERER
    ================================================================

Expected changes:

NONE

The renderer continues:

GET /public/sites/:tenantId

It must remain ignorant of:

working paths
published paths
snapshot metadata
publish operations

Do not change the renderer unless a concrete compile issue requires it.

================================================================
16. SHARED SITE SCHEMA
    ================================================================

Expected changes:

NONE

Continue using the existing:

SiteDefinition
SitePage
SiteSection

No publication wrapper belongs in the shared public schema.

================================================================
17. TEST INFRASTRUCTURE
    ================================================================

Use existing:

node:test
FakeDb

Claude confirmed FakeDb already supports:

config/published/current
nested collections
runTransaction
transaction get/set
merge behavior

Do not change FakeDb unless implementation proves otherwise.

No Firestore Emulator.

================================================================
18. LOAD-BEARING SNAPSHOT ISOLATION TEST
    ================================================================

Implement a test proving:

1. Working Hero = "Version A".
2. Publish.
3. Public read = "Version A".
4. Modify ONLY working Home Hero to "Version B".
5. Public read with preview DISABLED still = "Version A".
6. Republish.
7. Public read now = "Version B".

This test is mandatory.

It proves editing working data cannot accidentally modify the live site.

================================================================
19. PREVIEW SEMANTICS TEST
    ================================================================

Also prove:

Published snapshot:
Version A

Working:
Version B

preview disabled:
response.status === 'PUBLISHED'
title === Version A

preview enabled outside production:
response.status === 'DRAFT'
title === Version B

production + preview flag true:
response remains normal-public behavior
-> Version A / PUBLISHED if published snapshot exists

The preview endpoint must never label unpublished working content PUBLISHED.

================================================================
20. FAIL-CLOSED SNAPSHOT TESTS
    ================================================================

When normal public access sees config.status=PUBLISHED:

missing published/current:
404 Site not found

published/current exists but missing siteDefinition:
404 Site not found

siteDefinition.status !== PUBLISHED:
404 Site not found

No fallback to working pages.

================================================================
21. OTHER REQUIRED TESTS
    ================================================================

Cover at minimum:

- publish missing site -> 404
- snapshot created
- snapshot sanitized
- publication audit metadata persisted
- config status becomes PUBLISHED
- config updatedAt changes
- republish succeeds
- republish replaces snapshot
- unpublish sets DRAFT
- unpublish audit metadata persisted
- snapshot retained after unpublish
- normal public read hidden after unpublish
- preview enabled can still read working DRAFT
- production preview ceiling
- authenticated getSite remains working copy
- publish route PLATFORM_ADMIN only
- unpublish route PLATFORM_ADMIN only
- existing site/tenant/public tests remain green

================================================================
22. TEST MODIFICATION DISCIPLINE
    ================================================================

Update existing tests only where Step 1.9 legitimately changes behavior.

For example:

old assumption:
PUBLISHED working config alone is public

new assumption:
PUBLISHED config requires published/current snapshot

Do not modify unrelated tests merely because they exist.

The draftPreviewEnabled helper itself is unchanged, so do not rewrite its tests
unless needed for additional coverage.

================================================================
23. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Start with:

ALLOW_DRAFT_PUBLIC_SITES=false

Run:

API
portal
site-renderer

Flow:

1. Manage Website.
2. Ensure site is DRAFT.
3. Public renderer => not found.

4. Publish.
5. Portal => Website: PUBLISHED.
6. Public renderer => persisted published Hero.

7. Record published Hero title.

8. Directly change only the WORKING Hero in DEV Firestore to:

   UNPUBLISHED WORKING CHANGE

9. Reload public renderer with preview false.

Expected:
OLD published Hero remains.

10. Set:
    ALLOW_DRAFT_PUBLIC_SITES=true

11. Restart API.

12. Reload renderer.

Expected:
UNPUBLISHED WORKING CHANGE

The public API response in this mode should also report:

status: DRAFT

13. Set preview=false again and restart.

Expected:
old published Hero again.

14. Click Republish.

Expected:
renderer now shows UNPUBLISHED WORKING CHANGE.

15. Click Unpublish.

Expected:
renderer not-found.

16. Verify:

site/config/published/current

still exists.

17. Confirm production Firestore remains untouched.

================================================================
24. VERIFY
    ================================================================

Server:

npm test

Run scoped/new StandardJS lint and syntax verification.

Do not fix unrelated existing lint debt.

Platform:

npm run typecheck
npm run lint
npm run build

Both portal and renderer must remain green.

================================================================
25. OUT OF SCOPE
    ================================================================

Do not implement:

revision history
rollback
snapshot versions
scheduled publishing
approval workflow
business-role publishing
dirty-state detection
page editing
section editing
new sections
CMS
domains
themes
SEO
media
leads
analytics
production deployment

================================================================
26. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Snapshot path implemented.
4. Exact snapshot persisted shape.
5. Publish transaction behavior.
6. Republish behavior.
7. Unpublish behavior.
8. Config audit metadata.
9. Normal public-read behavior.
10. DEV preview behavior, including forced DRAFT response status.
11. Fail-closed malformed snapshot behavior.
12. Portal lifecycle UX.
13. Confirmation no N+1 site loading.
14. Confirmation renderer unchanged.
15. Confirmation shared schema unchanged.
16. Snapshot-isolation test result.
17. Preview-semantics test result.
18. Backend test results.
19. Platform typecheck/lint/build.
20. Manual DEV verification if performed.
21. Deviations and why.
22. Anything affecting the future editing/CMS architecture.

Do not implement beyond Step 1.9.