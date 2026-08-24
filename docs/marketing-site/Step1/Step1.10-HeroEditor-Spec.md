STEP 1.10 — HERO EDITOR

OBJECTIVE

Allow PLATFORM_ADMIN to edit the existing Home Hero working content.

Editing affects working Firestore documents only.

Published snapshot remains unchanged until Publish/Republish.

============================================================
1. EXISTING DOCUMENT
   ============================================================

Edit:

tenants/{tenantId}/site/config/pages/home

Do not create another Hero document or editor-specific collection.

Sections remain inline.

============================================================
2. EDITABLE FIELDS
   ============================================================

Expose:

title
subtitle

Do NOT expose:

ctaLabel

yet.

title:
- string
- trim
- required
- 1..200 characters

subtitle:
- optional string
- trim
- maximum 500 characters
- empty/whitespace-only becomes absent

No HTML/rich text.

============================================================
3. PRESERVE OTHER HERO CONTENT
   ============================================================

Updating title/subtitle must preserve any other existing HeroContent fields.

Example existing:

{
title: "...",
subtitle: "...",
ctaLabel: "Contact Us"
}

Changing title must NOT accidentally remove ctaLabel.

Merge supported Hero fields rather than blindly replacing the entire content
object with only the request fields.

============================================================
4. BACKEND SERVICE
   ============================================================

Add an operation conceptually:

updateHomeHero(tenantId, actorUserId, input)

Follow existing siteService conventions.

Use a Firestore transaction.

Read before write:

site/config
site/config/pages/home

Validate:

- site exists
- Home exists
- Hero section with id='hero' exists
- section.type === 'hero'

Then replace the matching section inside the ordered sections array.

Do not alter section ordering.

============================================================
5. TIMESTAMPS
   ============================================================

On successful save:

home.updatedAt = now

and merge:

site/config.updatedAt = now

This gives the working site a meaningful modification timestamp.

Do NOT change:

createdAt
createdByUserId
lastPublishedAt
lastPublishedByUserId

during editing.

============================================================
6. SITE STATUS
   ============================================================

Editing must NOT automatically change:

config.status

Therefore:

DRAFT remains DRAFT

PUBLISHED remains PUBLISHED

The public snapshot boundary handles unpublished changes.

============================================================
7. PUBLISHED SNAPSHOT
   ============================================================

Hero editing must NEVER write:

site/config/published/current

Only Publish/Republish may modify that document.

============================================================
8. ROUTE
   ============================================================

Add:

PATCH /tenants/:tenantId/site/pages/home/sections/hero

Authorization:

PLATFORM_ADMIN only

Reuse:

authentication
CSRF
tenantLimiter
requirePlatformAdmin

Request:

{
"title": "...",
"subtitle": "..."
}

Return:

the updated WORKING SiteDefinition.

Success:

200

============================================================
9. ERRORS
   ============================================================

At minimum:

site missing:
404

Home missing/corrupt:
use the existing site's invariant/error convention

Hero missing:
controlled error

invalid title:
400

subtitle too long:
400

Do not expose Firestore internals.

============================================================
10. PORTAL API
    ============================================================

Extend:

platform/apps/portal/lib/site.ts

Add something equivalent to:

updateHomeHero(tenantId, input)

Reuse:

apiSend('PATCH', ...)

No new networking layer.

============================================================
11. PORTAL EDITOR
    ============================================================

Extend the existing on-demand Manage Website experience.

Once the SiteDefinition has been loaded:

DRAFT:
Website: DRAFT
[ Edit Hero ]
[ Publish ]

PUBLISHED:
Website: PUBLISHED
[ Edit Hero ]
[ Republish ]
[ Unpublish ]

Click:

Edit Hero

Show an inline editor.

No new page/router required.

============================================================
12. HERO FORM
    ============================================================

Populate fields from the currently loaded working SiteDefinition.

Headline:
[ current hero title ]

Subtitle:
[ current hero subtitle ]

Actions:

[ Cancel ]
[ Save Changes ]

Use existing @bakerrang/ui primitives where appropriate.

Do not add a form framework.

============================================================
13. SAVE BEHAVIOR
    ============================================================

On Save:

- trim values
- client-side validate obvious constraints
- disable controls during request
- PATCH working Hero
- replace locally-held working SiteDefinition with returned definition
- close or retain editor in a sensible saved state
- show safe success/error feedback

Do not refetch unnecessarily.

============================================================
14. PUBLISHED-SITE EDIT FEEDBACK
    ============================================================

When editing a currently PUBLISHED site succeeds, display:

Saved to working site.

Republish to make these changes public.

Equivalent wording is fine.

Do NOT imply the edit is already live.

============================================================
15. DRAFT EDIT FEEDBACK
    ============================================================

For a DRAFT site, something equivalent to:

Changes saved.

is sufficient.

============================================================
16. NO PERSISTENT DIRTY STATE YET
    ============================================================

Do not add:

hasUnpublishedChanges
workingRevision
publishedRevision

yet.

The current-session UI may know an edit occurred and show appropriate
messaging.

After a browser refresh, persistent dirty detection is not required in Step
1.10.

We can add revision/change tracking when the editor grows enough to justify it.

============================================================
17. SNAPSHOT ISOLATION TEST
    ============================================================

Extend automated tests to prove:

Publish Hero "Version A"

Edit working Hero to "Version B"

Normal public API still returns:
Version A

Authenticated getSite returns:
Version B

Republish

Normal public API returns:
Version B

This remains a load-bearing guarantee.

============================================================
18. DEV PREVIEW
    ============================================================

Existing:

ALLOW_DRAFT_PUBLIC_SITES=true

must continue showing the WORKING Hero.

Therefore after editing:

normal public:
old snapshot

DEV preview:
new working Hero

No renderer changes should be necessary.

============================================================
19. CTA
    ============================================================

Do NOT expose CTA editing yet.

Reason:

HeroContent currently supports ctaLabel but there is no proper CTA destination
model in the approved site schema.

If ctaLabel already exists, preserve it during title/subtitle updates.

CTA action/link modeling can be added deliberately later.

============================================================
20. SHARED SCHEMA
    ============================================================

Expected change:

NONE

Existing HeroContent already supports:

title
subtitle?
ctaLabel?

Do not create editor-specific shared types unless necessary.

Portal request types may remain portal-local.

============================================================
21. RENDERER
    ============================================================

Expected change:

NONE

Renderer already consumes:

HeroContent

through:

SectionRenderer
→ Hero

Republished Hero data should automatically render.

============================================================
22. TESTS
    ============================================================

Backend coverage must include:

- update missing site
- update missing Home
- update missing Hero
- invalid title
- empty title after trim
- title too long
- subtitle too long
- title trims correctly
- subtitle trims correctly
- blank subtitle removed
- existing ctaLabel preserved
- section id/type preserved
- section order preserved
- home.updatedAt changes
- config.updatedAt changes
- config.status unchanged when DRAFT
- config.status unchanged when PUBLISHED
- published snapshot untouched by edit
- authenticated getSite returns new working Hero
- public normal read still returns old snapshot
- dev preview returns new working Hero
- republish updates snapshot
- PATCH route PLATFORM_ADMIN only
- existing suites remain green

============================================================
23. MANUAL DEV E2E
    ============================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev
ALLOW_DRAFT_PUBLIC_SITES=false

For a PUBLISHED site:

1. Manage Website.
2. Click Edit Hero.
3. Change headline.
4. Add/change subtitle.
5. Save.
6. Confirm portal displays saved-working-copy message.
7. Reload public renderer.
8. Public site must still show OLD published Hero.

Then:

ALLOW_DRAFT_PUBLIC_SITES=true

9. Restart API.
10. Reload renderer.
11. Renderer must show NEW working Hero.

Restore preview=false.

12. Renderer returns OLD Hero again.

13. Click Republish.
14. Renderer now shows NEW Hero.

15. Confirm Firestore working Home contains new values.
16. Confirm published/current changed only after Republish.
17. Confirm production remains untouched.

============================================================
24. OUT OF SCOPE
    ============================================================

Do not implement:

CTA links/actions
section creation
section deletion
section ordering
new section types
generic CMS engine
multiple pages
rich text
autosave
revision tracking
persistent dirty-state tracking
preview tokens
custom domains
media
SEO
analytics

DEFINITION OF DONE

1. Hero title/subtitle can be edited.
2. Working Home is updated.
3. Other Hero fields survive the edit.
4. Published snapshot remains unchanged.
5. DEV preview sees working changes.
6. Normal public rendering remains on snapshot.
7. Republish makes edits public.
8. Portal clearly distinguishes saved vs live.
9. Renderer/schema remain unchanged.
10. Tests/builds pass.
11. Live DEV edit→preview→republish flow succeeds.