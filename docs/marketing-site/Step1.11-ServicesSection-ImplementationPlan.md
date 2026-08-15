Implement Step 1.11 — Services Section.

Claude Code has inspected the actual repository and produced an approved
implementation plan.

Follow Claude's repository findings and implementation plan, with the
corrections below taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Introduce the first reusable multi-item website section:

SERVICES

The working Home page becomes conceptually:

Hero
Services

Services must:

- persist inline in the WORKING Home document
- support ordered service items
- support add/edit/remove through one full-state PUT
- render through the shared site renderer
- remain isolated from published/current until Publish/Republish
- be editable through the existing lazy Manage Website flow

Do NOT create a generic CMS/section framework yet.

================================================================
1. SHARED SCHEMA
   ================================================================

Extend:

@bakerrang/site-schema

Add:

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

Widen:

SiteSection

to:

HeroSection | ServicesSection

Do not add:

price
image
icon
CTA
URL
category

================================================================
2. HERO EDITOR UNION NARROWING — REQUIRED
   ================================================================

Widening SiteSection means HeroEditor can no longer rely on a plain boolean
predicate and then access Hero-specific content properties.

Update its section lookup using a real TypeScript type guard.

Conceptually:

sections.find(
(section): section is HeroSection =>
section.id === 'hero' &&
section.type === 'hero'
)

This is a required compile correction resulting from the widened union.

Do not otherwise change Hero editing behavior.

================================================================
3. WORKING STORAGE
   ================================================================

Services remains inline inside:

tenants/{tenantId}/site/config/pages/home

under:

sections[]

Do NOT create:

Services Firestore collection
Service item documents
section subcollections
separate page-section documents

================================================================
4. SERVICES ENDPOINT
   ================================================================

Add:

PUT /tenants/:tenantId/site/pages/home/sections/services

PLATFORM_ADMIN only.

Use PUT intentionally.

The request represents the complete desired state of the Services content
managed by this editor.

Do NOT replace this with generic section CRUD.

================================================================
5. REQUEST
   ================================================================

Shape:

{
"title": "Services",
"items": [
{
"id": "<existing-server-id>",
"name": "Frameless Shower Doors",
"description": "..."
},
{
"name": "Sliding Shower Doors",
"description": "..."
}
]
}

Existing items return/send their server id.

New items omit id.

Never accept section:

id
type

from the request.

================================================================
6. FULL-STATE PUT SEMANTICS — IMPORTANT
   ================================================================

This is different from Step 1.10's PATCH semantics.

The Services request represents the complete desired editor-owned state.

Therefore:

ITEM OMITTED FROM ARRAY
-> remove that item from working Services

REQUEST ARRAY ORDER
-> resulting persisted/display order

EXISTING ITEM ID
-> preserve identity

NEW ITEM WITHOUT ID
-> create with server-generated id

DESCRIPTION OMITTED
-> resulting item has no description

DESCRIPTION BLANK
-> resulting item has no description

DESCRIPTION NONBLANK
-> trim and persist

For BOTH existing and new items:

description omitted is equivalent to desired absence.

Do NOT use Hero PATCH semantics where omission preserves description.

Unknown/future fields that are NOT editor-owned must still be preserved for
existing items.

================================================================
7. SERVER GENERATED IDS
   ================================================================

Use the existing Node runtime's:

node:crypto
randomUUID()

No UUID dependency.

Rules:

id omitted:
new item; server generates id

id supplied and matches existing item:
update existing item

id supplied but unknown:
400 Unknown service item id

duplicate supplied ids:
400 Duplicate service item id

id supplied but not a valid string:
400 Service item id must be a string

An arbitrary client-provided id must NEVER establish identity for a new item.

Generated ids must be returned through the resulting SiteDefinition.

================================================================
8. VALIDATION
   ================================================================

Services title:

- required string
- trim
- non-empty
- max 100

Errors:

Services title is required

Services title must be 100 characters or fewer

Items:

- must be array
- minimum 1
- maximum 20

Errors:

Services items must be an array

Services must include at least one item

Services cannot exceed 20 items

Service name:

- required string
- trim
- non-empty
- max 120

Errors:

Service name is required

Service name must be 120 characters or fewer

Service description:

- optional
- if supplied, must be string
- trim
- max 500
- blank => absent

Errors:

Service description must be a string

Service description must be 500 characters or fewer

Ignore unrelated request fields.

Do not accept HTML/rich content.

================================================================
9. SERVICE FUNCTION
   ================================================================

Add:

upsertHomeServices(tenantId, input)

Follow the Step 1.10 service patterns.

Purely validate request shape where possible before transaction.

Use one Firestore transaction.

Read BEFORE writing:

site/config
site/config/pages/home

Missing config:

404 Site not initialized

Missing Home:

500 Site home page missing

================================================================
10. HERO INVARIANT
    ================================================================

When adding Services, locate:

id === 'hero'
&&
type === 'hero'

because new Services is inserted immediately after Hero.

If Hero cannot be found:

500 controlled invariant error consistent with current conventions.

Do not assume Hero is sections[0].

================================================================
11. SERVICES SECTION INVARIANT — OVERRIDE
    ================================================================

Do NOT simply find the first:

id === 'services' && type === 'services'

and assume there can be no malformed duplicates.

Before mutation, inspect sections for reserved Services identity.

Treat a section as Services-related if:

section.id === 'services'
OR
section.type === 'services'

Valid states:

A. No Services-related section exists
-> insert a new Services section.

B. Exactly one exists AND:
id === 'services'
type === 'services'
-> update it.

Invalid/corrupt states include:

- more than one Services-related section
- id === 'services' but type !== 'services'
- type === 'services' but id !== 'services'

In an invalid state:

FAIL safely with a controlled 500 invariant error such as:

Home services section invalid

Do NOT silently create another Services section.
Do NOT silently leave duplicates in place.
Do NOT implement automatic repair.

After every successful upsert, the working page must contain exactly one:

{
id: 'services',
type: 'services'
}

section.

================================================================
12. NEW SECTION INSERTION
    ================================================================

If Services does not exist:

construct server-side:

{
id: 'services',
type: 'services',
content: {
title,
items
}
}

Insert immediately after Hero.

Do not receive section id/type from the client.

================================================================
13. EXISTING SECTION UPDATE
    ================================================================

If Services exists:

preserve its current section array position.

Start with the existing section object so future section-level metadata
survives.

Conceptually:

{
...existingServices,
content: nextContent
}

Do not move the section back after Hero on every save.

Insertion position is only used when first adding it.

================================================================
14. CONTENT PRESERVATION
    ================================================================

For an existing Services section:

start from:

existingServices.content

Preserve unknown future content-level fields.

Overwrite only editor-owned:

title
items

Conceptually:

nextContent = {
...existingServices.content,
title,
items: resolvedItems
}

================================================================
15. EXISTING SERVICE ITEM PRESERVATION
    ================================================================

Match existing items by their server id.

For an existing item, start from the authoritative stored object.

Preserve unknown future fields.

Overwrite:

name

Then handle description using FULL PUT semantics:

if normalized description exists:
nextItem.description = description

otherwise:
delete nextItem.description

Do not merge arbitrary request keys.

Thus:

existing stored:

{
id,
name,
description,
futureField
}

request:

{
id,
name: "Changed"
}

result:

{
id,
name: "Changed",
futureField
}

with description ABSENT.

This is intentional because description is an editor-owned optional field in a
full-state PUT.

================================================================
16. NEW SERVICE ITEMS
    ================================================================

For a new item:

{
id: randomUUID(),
name,
description?
}

Only server-approved fields.

Do not preserve arbitrary client properties.

================================================================
17. ITEM REMOVAL
    ================================================================

Any existing ServiceItem omitted from the request items array is removed from
the working Services section.

No separate DELETE endpoint.

No tombstones.

No published snapshot modification.

================================================================
18. ITEM ORDER
    ================================================================

Persist items in EXACT request-array order.

The renderer displays that order.

No drag/drop UI is needed yet, but the server contract must already support
reordering through array order.

================================================================
19. TIMESTAMPS
    ================================================================

On save:

home.updatedAt = now
config.updatedAt = same now

Preserve:

home.createdAt
config.createdAt
config.createdByUserId
config.status
publication audit metadata

DRAFT stays DRAFT.

PUBLISHED stays PUBLISHED.

================================================================
20. SNAPSHOT ISOLATION
    ================================================================

upsertHomeServices must NEVER read/write:

site/config/published/current

No publish-service changes are expected.

Existing publishSite already snapshots:

toSiteDefinition(config, home)

and `home.sections` is included in the aggregate.

Therefore Services should automatically enter the published snapshot on the
next Publish/Republish.

Do not alter publishing architecture unless actual implementation proves this
assumption false.

================================================================
21. SHARED SERVICES COMPONENT
    ================================================================

Add:

platform/packages/site-components/src/Services.tsx

Use:

ServicesContent

from site-schema.

Render:

section title

ordered service items

item name

optional item description

Keep styling:

neutral
business-agnostic
semantic-token based

Do NOT add:

images
icons
pricing
links
CTAs

If content.items is empty despite server invariants:

return null

rather than rendering a broken empty section.

Export Services from the site-components package index.

================================================================
22. SECTION RENDERER
    ================================================================

Extend:

SectionRenderer

with:

case 'services':
return <Services content={section.content} />

Keep Hero unchanged.

Unknown sections continue returning null.

================================================================
23. PORTAL API
    ================================================================

Extend:

portal/lib/site.ts

with portal-local request types:

ServiceItemInput {
id?: string
name: string
description?: string
}

ServicesInput {
title: string
items: ServiceItemInput[]
}

Add:

upsertHomeServices(tenantId, input)

using:

apiSend<SiteDefinition>(
'PUT',
`/tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/services`,
input
)

Reuse existing CSRF handling.

No new networking layer.

================================================================
24. SERVICES EDITOR
    ================================================================

Add:

ServicesEditor.tsx

Use the already-loaded working SiteDefinition.

Do NOT fetch again merely to open the editor.

Use a real type guard to locate ServicesSection.

Fields:

Section Heading

For each service:

Service Name
Description

Controls:

Add Service
Remove

Cancel
Save Changes

No drag/drop.

No images.
No pricing.
No CTA.

================================================================
25. PORTAL TEMPORARY ROW IDENTITY
    ================================================================

Editor rows need a local React key distinct from server identity.

A row may conceptually contain:

{
key,
id?,
name,
description
}

Existing rows:
- keep server id
- also have local React key

New rows:
- id undefined
- local React key only

Temporary React keys must NEVER be sent as ServiceItem ids.

Using browser crypto.randomUUID() is acceptable if already supported by the
target browser/runtime, but a component-local monotonically increasing key is
also sufficient.

Do not add a dependency just for local row keys.

================================================================
26. ADD SERVICES FLOW
    ================================================================

If the currently-loaded SiteDefinition has no Services section:

show:

[ Add Services ]

Click opens ServicesEditor seeded IN MEMORY with:

title = "Services"

one empty Service row

Do not write Firestore yet.

"Services" is a neutral editor default, not fabricated business marketing
copy.

================================================================
27. EDIT SERVICES FLOW
    ================================================================

If the working SiteDefinition already has Services:

show:

[ Edit Services ]

Seed the editor from the loaded working section.

Round-trip all server item ids.

Preserve editor item order.

================================================================
28. BUSINESS WEBSITE EDITOR MODES
    ================================================================

Replace/extend the Hero-only editor boolean with a small mutually-exclusive
mode:

'hero'
'services'
null

Only one editor is open at a time.

Lifecycle buttons remain available as appropriate.

Do not introduce a generic editor registry yet.

================================================================
29. SAVE FEEDBACK
    ================================================================

Reuse existing Step 1.10 wording.

DRAFT:

Changes saved.

PUBLISHED:

Saved to the working site. Republish to change the public site.

Do not imply saved Services are live before Publish/Republish.

================================================================
30. BACKEND ID TESTS
    ================================================================

Test:

new items get server-generated ids

returned SiteDefinition contains ids

subsequent PUT using those ids preserves identity

unknown supplied id -> 400

duplicate supplied id -> 400

non-string supplied id -> 400

arbitrary client-supplied new id rejected

omitted item removed

request order persisted

future/unknown existing item fields preserved

================================================================
31. DESCRIPTION FULL-STATE SEMANTIC TESTS
    ================================================================

Starting stored existing item:

{
id: "abc",
name: "Existing",
description: "Existing description",
futureField: "keep"
}

A. PUT existing item with:

{
id: "abc",
name: "Changed"
}

Expected:

{
id: "abc",
name: "Changed",
futureField: "keep"
}

description ABSENT.

B. PUT:

{
id: "abc",
name: "Changed",
description: "  New description  "
}

Expected:

description = "New description"

C. PUT:

{
id: "abc",
name: "Changed",
description: "   "
}

Expected:

description ABSENT.

This deliberately differs from PATCH Hero semantics.

================================================================
32. SECTION INVARIANT TESTS
    ================================================================

Test:

no Services -> insert immediately after Hero

one valid Services -> replace in existing position

two Services-related sections -> controlled failure

id='services' with wrong type -> controlled failure

type='services' with wrong id -> controlled failure

No successful operation may leave duplicate/reserved Services identity.

================================================================
33. OTHER BACKEND TESTS
    ================================================================

Cover:

missing site
missing Home
missing Hero on initial insertion
invalid title
title trim
title too long
items non-array
zero items
>20 items
invalid name
name trim
name too long
description non-string
description trim
description too long
section metadata preserved
content metadata preserved
sibling sections preserved
section ordering preserved
item ordering preserved
home.updatedAt changed
config.updatedAt changed
timestamps equal
DRAFT status unchanged
PUBLISHED status unchanged
published/current unchanged during PUT
preview shows working Services
republish publishes Services
PUT PLATFORM_ADMIN only

Use existing node:test/FakeDb.

No emulator.

================================================================
34. MANDATORY SNAPSHOT LIFECYCLE TEST
    ================================================================

1. Initialize Hero-only site.
2. Add Services A + B.
3. Publish.
4. Normal public = Hero + Services A/B.

5. Modify WORKING Services:
    - rename A
    - remove B
    - add C

6. Capture published/current before edit or verify unchanged afterward.

7. Normal public WITHOUT republish:
   still old A/B.

8. Authenticated getSite:
   new A/C.

9. DEV preview:
   new A/C as working content.

10. Republish.

11. Normal public:
    new A/C.

This test is mandatory.

================================================================
35. FRONTEND TYPE SAFETY
    ================================================================

Because SiteSection is now a real discriminated union:

Use type guards where editors need a concrete section type.

Do not use casts merely to suppress errors.

SectionRenderer's switch should narrow naturally.

Ensure:

HeroEditor
ServicesEditor
BusinessWebsite

remain type-safe.

================================================================
36. VERIFY
    ================================================================

Backend:

npm test

Run scoped/new StandardJS lint and syntax checks.

Do not fix unrelated lint debt.

Platform:

npm run typecheck
npm run lint
npm run build

Verify:

site-schema
site-components
portal
site-renderer

all succeed.

================================================================
37. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev
ALLOW_DRAFT_PUBLIC_SITES=false

Use a PUBLISHED site.

1. Manage Website.
2. Add Services.
3. Add:

   Frameless Shower Doors
   Sliding Shower Doors

4. Save.

Expected portal:

Saved to the working site. Republish to change the public site.

5. Normal renderer:
   Services NOT visible yet.

6. Enable:

ALLOW_DRAFT_PUBLIC_SITES=true

Restart API.

7. Renderer:
   Services visible.

8. Disable preview and restart.

9. Renderer:
   old published site again.

10. Republish.

11. Renderer:
    Services now public.

12. Edit Services:
    rename one
    remove one
    add another

13. Save.

14. Normal renderer:
    old published Services.

15. Preview:
    new working Services.

16. Republish.

17. Normal renderer:
    new Services.

18. Verify server-generated ids persisted and surviving item retained the same
    id across saves.

19. Verify only bakerrang-dev changed.

================================================================
38. OUT OF SCOPE
    ================================================================

Do not implement:

generic section API
generic section editor
section drag/drop
service drag/drop UI
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

================================================================
39. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Shared schema additions.
4. HeroEditor type-narrowing fix.
5. Services component.
6. PUT request/response.
7. Validation.
8. Exact description PUT semantics.
9. ID generation/identity.
10. Section invariant handling.
11. Existing item metadata preservation.
12. Insertion/update ordering.
13. Firestore transaction behavior.
14. Lifecycle/snapshot isolation.
15. Portal ServicesEditor.
16. Add/Edit Services UX.
17. Backend tests.
18. Mandatory lifecycle test result.
19. Typecheck/lint/build results.
20. Manual DEV verification if performed.
21. Deviations and why.
22. Lessons for future generic section editing.

Do not implement beyond Step 1.11.