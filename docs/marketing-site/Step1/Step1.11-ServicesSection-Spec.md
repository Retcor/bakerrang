# Claude Code Assignment — Step 1.11 Services Section

DO NOT modify code.

Step 1.10 is complete and manually verified against bakerrang-dev.

We are introducing the first reusable multi-item content section:

SERVICES

This milestone must preserve the working-copy → published-snapshot architecture.

Do NOT build a generic CMS/section framework yet.

============================================================
1. GOAL
   ============================================================

Extend the Home page from:

Hero

to:

Hero
Services

Services must:

- persist in the WORKING Home page
- support multiple ordered Service items
- render through the shared site renderer
- remain isolated from published/current until Publish/Republish
- be editable from the existing Manage Website portal experience

============================================================
2. INSPECT CURRENT IMPLEMENTATION
   ============================================================

Inspect actual:

server/services/siteService.js
server/routes/tenants.js
server/test/siteService.test.js
server/test/tenantRoutes.test.js

platform/packages/site-schema
platform/packages/site-components

platform/apps/site-renderer/components/SectionRenderer.tsx

platform/apps/portal/app/businesses/BusinessWebsite.tsx
platform/apps/portal/app/businesses/HeroEditor.tsx
platform/apps/portal/lib/site.ts
platform/apps/portal/lib/api.ts
@bakerrang/ui

Ground the plan in the implemented Step 1.10 code.

Document the patterns worth reusing from updateHomeHero.

============================================================
3. SHARED SCHEMA
   ============================================================

Expand @bakerrang/site-schema with the minimum Services contract.

Conceptually:

export interface ServiceItem {
id: string
name: string
description?: string
}

export interface ServicesContent {
title: string
items: ServiceItem[]
}

export interface ServicesSection {
id: string
type: 'services'
content: ServicesContent
}

Update:

SiteSection

from the current Hero-only union to:

HeroSection
| ServicesSection

Do not add:

price
image
icon
CTA
URL
category

yet.

============================================================
4. WORKING PERSISTENCE
   ============================================================

Services remains inline in:

tenants/{tenantId}/site/config/pages/home

inside:

sections[]

Do NOT create:

services subcollections
service-item Firestore documents
separate section documents

The current page document is still sufficiently small.

============================================================
5. SERVICES UPDATE ENDPOINT
   ============================================================

Plan a section-specific endpoint:

PUT /tenants/:tenantId/site/pages/home/sections/services

PLATFORM_ADMIN only.

Use PUT intentionally because the request represents the desired editor-managed
state of the Services section.

Do NOT create a generic:

/sections/:sectionId

handler yet.

============================================================
6. REQUEST SHAPE
   ============================================================

Conceptually:

{
"title": "Services",
"items": [
{
"id": "existing-id",
"name": "Frameless Shower Doors",
"description": "..."
},
{
"name": "Sliding Shower Doors",
"description": "..."
}
]
}

Existing items include their current server-generated id.

New items OMIT id.

The client does NOT select IDs for new items.

============================================================
7. SERVICE IDs
   ============================================================

Server generates stable IDs for new Service items.

Inspect the current Node/runtime version and choose an existing-runtime-safe
server-side UUID/random-ID mechanism, preferably node:crypto randomUUID if
supported by the actual runtime.

Do not add a UUID dependency if Node already provides what is needed.

Rules:

existing supplied id:
must correspond to an item currently in the Services section

new item:
id omitted
server generates id

supplied unknown id:
400

duplicate supplied IDs:
400

Server-generated IDs must be returned in the resulting SiteDefinition.

============================================================
8. VALIDATION
   ============================================================

Recommended constraints:

Services title:
- string
- required
- trim
- 1..100 characters

items:
- array
- at least 1 item
- maximum 20 items

Service name:
- string
- required
- trim
- 1..120 characters

Service description:
- optional string
- trim
- maximum 500 characters
- blank => absent

Do not accept HTML.

Inspect existing validation/error conventions and propose exact messages
consistent with the codebase.

============================================================
9. UPSERT SEMANTICS
   ============================================================

Add a service operation conceptually:

upsertHomeServices(tenantId, input)

Use a Firestore transaction.

Read before write:

site/config
site/config/pages/home

Validate the site/Home invariants.

If a Services section does NOT exist:

- construct it server-side
- id = 'services'
- type = 'services'
- insert it immediately AFTER the Hero section

Do not accept section id/type from the request.

If Services already exists:

- preserve its existing array position
- preserve section-level unknown metadata
- overwrite only the editor-owned Services content fields

There must never be more than one:

id === 'services'
type === 'services'

section after this operation.

============================================================
10. ITEM UPDATE/PRESERVATION RULES
    ============================================================

Existing items are matched by id.

For an existing item:

start from the existing server-side object, then overwrite only:

name
description

This preserves future fields that the current editor does not know about.

For a new item:

create:

{
id: generatedId,
name,
description?
}

Do not merge arbitrary request properties.

Items omitted from the request are removed from the WORKING Services section.

Request array order becomes the resulting display order.

This gives the editor add/edit/remove/order semantics in one section-specific
operation.

No drag/drop UI is required yet.

============================================================
11. TIMESTAMPS / LIFECYCLE
    ============================================================

On successful save:

home.updatedAt = now
config.updatedAt = now

Use the same timestamp.

Do NOT modify:

config.status
publication audit metadata
published/current
created timestamps

DRAFT stays DRAFT.

PUBLISHED stays PUBLISHED.

============================================================
12. SNAPSHOT ISOLATION
    ============================================================

Services editing must NEVER read/write:

site/config/published/current

except through the already-existing Publish/Republish operation.

The current publish implementation snapshots the working Home sections array,
so confirm that adding Services automatically enters the next published
SiteDefinition without a special publishing implementation.

If a concrete publish change is required, identify exactly why.

Expected result:

NO publish-service architecture change required.

============================================================
13. SHARED SERVICES COMPONENT
    ============================================================

Add a generic:

@bakerrang/site-components/Services

It should consume:

ServicesContent

and render:

section title
ordered service items
service name
optional description

Keep styling neutral and reusable across businesses.

Do not make it shower-glass-specific.

Do not add images/icons/pricing.

If zero items somehow reach the component despite server validation, determine
whether rendering nothing is the safest defensive behavior.

============================================================
14. SECTION RENDERER
    ============================================================

Extend:

SectionRenderer

with:

case 'services'

rendering the shared Services component.

Keep:

hero

unchanged.

Unknown section behavior remains controlled.

============================================================
15. PORTAL UX
    ============================================================

Extend the loaded Manage Website experience.

If no Services section exists:

[ Add Services ]

If Services exists:

[ Edit Services ]

Do NOT issue another GET.

Use the already-loaded working SiteDefinition.

The Services editor should be inline like HeroEditor.

============================================================
16. SERVICES EDITOR
    ============================================================

Plan:

ServicesEditor.tsx

Fields:

Section Heading

Then an ordered collection of Service rows:

Service Name
Description

Controls:

[ Add Service ]
[ Remove ]

[ Cancel ]
[ Save Changes ]

No drag/drop yet.

Existing item order is displayed and preserved.

New items may use portal-local temporary keys for React rendering, but those
temporary keys must NEVER be persisted or sent as server IDs.

Existing server IDs must be sent back unchanged.

============================================================
17. INITIAL ADD FLOW
    ============================================================

When Services does not exist and the admin clicks:

Add Services

Open an unsaved editor seeded with:

title:
Services

one empty Service row

Do NOT write anything to Firestore until Save Changes succeeds.

The generic heading "Services" is an editor default, not fabricated
business-specific marketing content.

The user can change it before saving.

============================================================
18. PORTAL API
    ============================================================

Extend portal/lib/site.ts with the minimum request types and:

upsertHomeServices(tenantId, input)

using:

apiSend(
'PUT',
`/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/services`,
input
)

Reuse existing CSRF/API behavior.

No new request layer.

============================================================
19. SAVE FEEDBACK
    ============================================================

Reuse Step 1.10 semantics.

If lifecycle status is DRAFT:

Changes saved.

If lifecycle status is PUBLISHED:

Saved to the working site. Republish to change the public site.

Do not claim Services are live until Publish/Republish.

============================================================
20. PUBLISHED SNAPSHOT TEST
    ============================================================

Mandatory lifecycle test:

Working has Hero only.

Add Services:
A
B

Publish.

Normal public:
Hero + Services A/B.

Edit working Services:
change A
remove B
add C

Normal public WITHOUT republish:
still original A/B.

Authenticated working getSite:
changed A/C.

DEV preview:
changed A/C.

Republish.

Normal public:
changed A/C.

This proves the existing snapshot architecture works for repeatable sections.

============================================================
21. ID TESTS
    ============================================================

Test:

- new items receive server-generated IDs
- returned SiteDefinition contains those IDs
- subsequent edit with those IDs preserves them
- removing an item removes it from working content
- unknown supplied ID -> 400
- duplicate ID -> 400
- new client-supplied arbitrary ID is NOT accepted as a new item
- future/unknown existing item fields survive edits

============================================================
22. OTHER BACKEND TESTS
    ============================================================

Cover:

missing site
missing Home
missing Hero when inserting Services if Hero position is required
invalid title
title trim
too-long title
items non-array
zero items
>20 items
invalid service name
name trim
name too long
description trim
description blank -> absent
description too long
section inserted immediately after Hero
existing Services position preserved
section id/type preserved
sibling sections preserved
request item order preserved
home.updatedAt changed
config.updatedAt changed
DRAFT status unchanged
PUBLISHED status unchanged
published/current unchanged during save
public snapshot isolation
preview uses working Services
republish updates public Services
PUT route PLATFORM_ADMIN only

Use existing node:test/FakeDb.

No emulator.

============================================================
23. FRONTEND VERIFICATION
    ============================================================

Do not add a major frontend test framework.

Verify:

site-schema union compiles
site-components compiles
portal compiles
renderer compiles

Run:

npm run typecheck
npm run lint
npm run build

============================================================
24. MANUAL DEV E2E
    ============================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Start with:

ALLOW_DRAFT_PUBLIC_SITES=false

Use a PUBLISHED test site.

Manage Website.

Add Services.

Create at least:

Frameless Shower Doors
Sliding Shower Doors

Save.

Expected:

working SiteDefinition contains Services.

Normal renderer:
NO Services yet.

Enable preview:

ALLOW_DRAFT_PUBLIC_SITES=true

Restart API.

Renderer:
Services appear.

Disable preview.

Renderer:
old published site again.

Republish.

Renderer:
Services appear publicly.

Then Edit Services:

- rename one
- remove one
- add another

Save.

Normal renderer:
old published Services.

Preview:
new working Services.

Republish:
new Services public.

Verify only bakerrang-dev changed.

============================================================
25. OUT OF SCOPE
    ============================================================

Do not plan:

generic section CRUD
generic section editor
section drag/drop
page section ordering UI
service drag/drop
service images
icons
pricing
CTA
links
multiple pages
media library
rich text
persistent dirty state
revision history
custom domains
SEO
analytics
production deployment

============================================================
26. IMPORTANT DESIGN QUESTION FOR CLAUDE
    ============================================================

Review the full-state PUT approach above against the actual repository.

Specifically evaluate whether:

- matching existing items by server ID
- server-generating IDs for new items
- omission meaning removal
- request order meaning resulting order
- preserving unknown fields for existing items

is clean and safe in the current architecture.

If there is a concrete technical problem, identify it.

Do NOT replace it with a generic CRUD framework simply because separate CRUD
endpoints are more conventional.

============================================================
DELIVERABLE
============================================================

Return:

1. Existing patterns from Hero editing relevant to Services.
2. Exact shared-schema additions.
3. Shared Services component design.
4. Exact Firestore/upsert strategy.
5. Exact request/response contract.
6. ID-generation and identity rules.
7. Validation rules/messages.
8. Content/metadata preservation strategy.
9. Section insertion/update ordering.
10. Files to add.
11. Files to modify.
12. PUT route + authorization.
13. Portal ServicesEditor design.
14. Add/Edit Services UX.
15. Snapshot-isolation behavior.
16. Backend test plan.
17. Renderer/schema/component verification.
18. Ordered Codex implementation plan.
19. Verification commands.
20. Manual DEV E2E.
21. Concrete risks.
22. Whether the full-state PUT design is approved or needs correction.
23. What this teaches us about a future generic section API.
24. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.