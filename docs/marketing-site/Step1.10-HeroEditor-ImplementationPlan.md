Implement Step 1.10 — Hero Editor.

Claude Code has inspected the actual repository and produced an approved
implementation plan.

Follow Claude's repository findings and implementation plan, with the
corrections in this assignment taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Allow PLATFORM_ADMIN to edit the WORKING Home Hero:

- title
- subtitle

Edits must affect:

tenants/{tenantId}/site/config/pages/home

only.

They must NOT modify:

tenants/{tenantId}/site/config/published/current

until an explicit Publish/Republish.

================================================================
1. SHARED CONTRACT
   ================================================================

No changes expected to:

@bakerrang/site-schema
@bakerrang/site-components
site-renderer

Existing:

HeroContent {
title: string
subtitle?: string
ctaLabel?: string
}

already supports this milestone.

Do not expose CTA editing.

================================================================
2. SERVICE SIGNATURE — OVERRIDE
   ================================================================

Use:

updateHomeHero(tenantId, input)

Do NOT include an unused actorUserId parameter.

No editing audit metadata is being persisted in Step 1.10.

When editing history/audit is actually introduced, actor identity can be
threaded through deliberately.

================================================================
3. VALIDATION
   ================================================================

Server-authoritative validation:

title:

- required
- string
- trim
- non-empty
- max 200 characters

Errors:

missing/non-string/blank:
400 Hero title is required

too long:
400 Hero title must be 200 characters or fewer

subtitle:

- OPTIONAL PATCH field
- if supplied, must be a string
- trim
- max 500 characters
- supplied blank string removes subtitle

IMPORTANT PATCH SEMANTICS:

subtitle omitted entirely:
preserve existing subtitle

subtitle: " New subtitle "
replace with "New subtitle"

subtitle: ""
or
subtitle: "   "
REMOVE existing subtitle property

subtitle: null
or other non-string value:
400 Hero subtitle must be a string

Do not treat an omitted subtitle as a request to clear it.

Use an own-property check equivalent to:

Object.prototype.hasOwnProperty.call(input, 'subtitle')

to distinguish omitted from supplied-empty.

Ignore unrelated body fields.

In particular, do not accept client-supplied ctaLabel.

================================================================
4. FIRESTORE UPDATE
   ================================================================

Use one Firestore transaction.

Read BEFORE writing:

site/config
site/config/pages/home

Validate:

config exists
home exists
Hero section exists

Locate the Hero by:

section.id === 'hero'
&&
section.type === 'hero'

Do not assume array index 0.

================================================================
5. CONTENT PRESERVATION
   ================================================================

Preserve the entire existing Hero content object first.

Conceptually:

nextContent = {
...existing.content,
title
}

Then:

if subtitle WAS SUPPLIED:
trimmed nonblank -> nextContent.subtitle = trimmed
blank -> delete nextContent.subtitle

if subtitle WAS NOT SUPPLIED:
do not touch nextContent.subtitle

This is important.

Existing fields such as:

ctaLabel

must survive the edit.

Do not merge arbitrary request fields into content.

================================================================
6. SECTION PRESERVATION
   ================================================================

Replace the matching Hero section at the same array index.

Preserve:

section id
section type
section position/order
other section-level properties
all sibling sections

Use the existing section as the base:

{
...existingSection,
content: nextContent
}

Do not recreate the sections array from client data.

================================================================
7. HOME / CONFIG TIMESTAMPS
   ================================================================

On successful update:

home.updatedAt = now
config.updatedAt = now

Use the same `now` for both.

Preserve all other Home fields through spreading the existing document.

Do NOT modify:

home.createdAt
config.createdAt
config.createdByUserId
config.status
lastPublishedAt
lastPublishedByUserId
lastUnpublishedAt
lastUnpublishedByUserId

================================================================
8. SITE STATUS
   ================================================================

Editing does NOT alter lifecycle status.

DRAFT remains DRAFT.

PUBLISHED remains PUBLISHED.

A PUBLISHED config does not mean the working content equals the live snapshot.

Do not add dirty-state persistence.

================================================================
9. PUBLISHED SNAPSHOT
   ================================================================

updateHomeHero must NEVER read, write, overwrite, merge, or delete:

site/config/published/current

Only Publish/Republish may modify that document.

================================================================
10. RETURN VALUE
    ================================================================

Return the updated WORKING SiteDefinition using the existing mapping logic.

It should still contain only:

status
pages
id
slug
title
sections

No Firestore metadata.

================================================================
11. PATCH ROUTE
    ================================================================

Add:

PATCH /tenants/:tenantId/site/pages/home/sections/hero

Authorization:

PLATFORM_ADMIN only

Reuse the existing:

tenant router
isAuthenticated
tenantLimiter
global CSRF
requirePlatformAdmin
handle wrapper

Route calls:

sites.updateHomeHero(
req.params.tenantId,
req.body
)

Success:

200

Do not add another route mount or CSRF implementation.

================================================================
12. PORTAL API
    ================================================================

Extend:

platform/apps/portal/lib/site.ts

with a portal-local request type, conceptually:

interface HeroInput {
title: string
subtitle?: string
}

and:

updateHomeHero(tenantId, input)

using:

apiSend<SiteDefinition>(
'PATCH',
`/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/hero`,
input
)

Reuse the existing API client and its CSRF handling.

================================================================
13. HERO EDITOR
    ================================================================

Add:

platform/apps/portal/app/businesses/HeroEditor.tsx

Use the already-loaded working SiteDefinition.

Do NOT issue another GET just to open the editor.

Populate from:

page.slug === '/'

then:

section.id === 'hero'
&&
section.type === 'hero'

Fields:

Headline
Subtitle

Buttons:

Cancel
Save Changes

No CTA input.
No autosave.
No rich text.

================================================================
14. FORM CONTROLS
    ================================================================

Headline:

Use existing @bakerrang/ui Input.

maxLength:

200

Subtitle:

Prefer a simple portal-local <textarea> because Hero subtitles may naturally
be multi-line/paragraph copy.

maxLength:

500

Do NOT add a shared Textarea primitive solely for this milestone.

Style the textarea consistently using the existing semantic UI tokens.

Client validation:

title required after trim
title <= 200
subtitle <= 500

Server remains authoritative.

================================================================
15. SUBTITLE REQUEST SEMANTICS
    ================================================================

The portal normally has both loaded values, so it may send:

{
title,
subtitle
}

If the user clears the Subtitle field, send:

subtitle: ''

so the backend explicitly removes it.

The API helper/request type may still allow subtitle omission for legitimate
partial PATCH clients.

Do not rely on omission to clear a subtitle.

================================================================
16. BUSINESS WEBSITE UX
    ================================================================

Extend the existing lazy Manage Website state.

DRAFT:

Website: DRAFT
[ Edit Hero ]
[ Publish ]

PUBLISHED:

Website: PUBLISHED
[ Edit Hero ]
[ Republish ]
[ Unpublish ]

When Edit Hero is active, show the inline HeroEditor.

Cancel:

discard unsaved local form edits.

Save:

PATCH working Hero.

On success:

- replace locally-held SiteDefinition with returned definition
- close editor or show a sensible saved state
- preserve lifecycle controls
- clear prior error state

================================================================
17. SAVE FEEDBACK
    ================================================================

If the SiteDefinition lifecycle status was PUBLISHED:

show:

Saved to the working site. Republish to change the public site.

Equivalent wording is acceptable.

If DRAFT:

show:

Changes saved.

Do not say:

Published
Live
Updated public site

after a normal Hero save.

================================================================
18. NO PERSISTENT DIRTY STATE
    ================================================================

Do not add:

hasUnpublishedChanges
workingRevision
publishedRevision
dirty flags

Current-session feedback only.

A browser refresh is not required to remember that working content differs
from the published snapshot.

================================================================
19. SNAPSHOT ISOLATION TEST — REQUIRED
    ================================================================

Automated test:

1. Working Hero = Version A.
2. Publish.
3. Snapshot/public = Version A.
4. updateHomeHero -> Version B.
5. authenticated getSite = Version B.
6. normal public getPublicSite = Version A.
7. published/current deep-equals its pre-edit value.
8. Republish.
9. normal public = Version B.

This test is mandatory.

================================================================
20. SUBTITLE PATCH TESTS — IMPORTANT
    ================================================================

Explicitly test all three distinct cases.

Starting with existing:

subtitle = 'Existing'

A. Request omits subtitle:

{
title: 'Changed'
}

Expected:

subtitle remains 'Existing'

B. Request sends:

{
title: 'Changed',
subtitle: '  New subtitle  '
}

Expected:

subtitle = 'New subtitle'

C. Request sends:

{
title: 'Changed',
subtitle: '   '
}

Expected:

subtitle property does not exist

Also test:

subtitle: null
subtitle: 123

-> 400

================================================================
21. OTHER SERVICE TESTS
    ================================================================

Cover:

missing site -> 404
missing Home -> 500
missing Hero -> controlled 500
missing title
blank title
non-string title
title >200
title trimming
subtitle >500
ctaLabel preservation
section id preserved
section type preserved
section position preserved
siblings preserved if present
home.createdAt preserved
home.updatedAt changed
config.updatedAt changed
DRAFT status unchanged
PUBLISHED status unchanged
published snapshot untouched
returned SiteDefinition reflects working edit
DEV preview returns updated working content as DRAFT
republish publishes updated content

Use existing node:test/FakeDb.

No emulator.

================================================================
22. ROUTE TEST
    ================================================================

Verify PATCH route:

- unauthenticated remains rejected by the actual mounted auth boundary where
  existing test infrastructure supports it
- non-platform roles cannot edit
- PLATFORM_ADMIN succeeds
- tenantId and body are forwarded correctly

Since actorUserId is not used by updateHomeHero, do NOT assert that the service
receives actor identity.

Existing authorization architecture remains unchanged.

================================================================
23. RENDERER / SCHEMA
    ================================================================

Expected modifications:

NONE

The renderer already consumes HeroContent.

The schema already supports optional subtitle.

Both must continue building.

================================================================
24. VERIFY
    ================================================================

Backend:

npm test

Run scoped/new StandardJS lint and syntax checks.

Do not fix unrelated pre-existing lint debt.

Platform:

npm run typecheck
npm run lint
npm run build

Portal and site-renderer must both remain green.

================================================================
25. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev
ALLOW_DRAFT_PUBLIC_SITES=false

Use a PUBLISHED site.

1. Manage Website.
2. Edit Hero.
3. Change Headline.
4. Change/add Subtitle.
5. Save.

Expected portal message:

Saved to the working site. Republish to change the public site.

6. Reload normal renderer.

Expected:
OLD published Hero remains.

7. Enable:

ALLOW_DRAFT_PUBLIC_SITES=true

Restart API.

8. Reload renderer.

Expected:
NEW working Headline/Subtitle.

Preview SiteDefinition status:
DRAFT

9. Disable preview and restart API.

Expected:
OLD published Hero.

10. Republish.

Expected:
NEW Hero becomes public.

11. Edit Hero again and clear Subtitle.
12. Save and preview working copy.
13. Verify Subtitle is absent/not rendered.
14. Republish if desired.

Confirm:

working Home changes on Save
published/current changes only on Republish
production Firestore remains untouched

================================================================
26. OUT OF SCOPE
    ================================================================

Do not implement:

CTA editing
CTA destinations
new section types
generic section endpoint
section creation
section deletion
section ordering
multiple pages
rich text
autosave
revision tracking
persistent dirty-state
custom domains
media
SEO
analytics
production deployment

================================================================
27. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Service signature.
4. Exact validation behavior.
5. Subtitle omit/set/clear semantics.
6. Hero content-preservation strategy.
7. Firestore transaction behavior.
8. Timestamp behavior.
9. Confirmation lifecycle status unchanged.
10. Confirmation published/current untouched by edit.
11. PATCH route + authorization.
12. Portal editor implementation.
13. Portal saved-vs-live messaging.
14. Snapshot-isolation test result.
15. Subtitle PATCH semantic tests.
16. Backend test result.
17. Platform typecheck/lint/build results.
18. Confirmation renderer/schema unchanged.
19. Manual DEV verification if performed.
20. Deviations and why.
21. Anything relevant to future generic section editing.

Do not implement beyond Step 1.10.