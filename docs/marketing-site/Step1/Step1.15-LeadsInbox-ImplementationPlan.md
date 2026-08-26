Implement Step 1.15 — Leads Inbox + Lead Detail.

Claude Code inspected the repository and produced an approved implementation
plan.

Follow Claude's repository findings and plan, with the corrections below
taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Implement the first authenticated reader of tenant Lead data:

Business
->
Leads Inbox
->
Lead Detail

This milestone is READ ONLY.

Do NOT implement:

status mutations
notes
assignment
deletion
archiving
notifications
email/SMS
search
filters
pagination UI

================================================================
1. AUTHORIZATION
   ================================================================

Authenticated lead reads must allow:

PLATFORM_ADMIN

and tenant:

OWNER
ADMIN
STAFF

Use the existing:

requireTenantRole(allTenantRoles)

fresh-Firestore authorization model.

Do not add browser-trusted role claims.

Cross-tenant access must remain denied.

Routes belong inside the existing authenticated tenant router.

================================================================
2. ROUTES
   ================================================================

Add:

GET /tenants/:tenantId/leads

GET /tenants/:tenantId/leads/:leadId

Both:

- authenticated
- tenant-limited through existing mount
- require all tenant read roles
- PLATFORM_ADMIN bypass supported through existing middleware
- Cache-Control: no-store

Do NOT expose lead reads under /public.

Step 1.14:

POST /public/sites/:tenantId/leads

must remain unchanged.

================================================================
3. LEAD LIST RESPONSE
   ================================================================

Return:

{
"leads": [
{
"id": "...",
"name": "...",
"email": "...",
"phone": "...",
"status": "NEW",
"source": "WEBSITE",
"createdAt": 123,
"updatedAt": 123
}
],
"hasMore": false
}

Lead summary fields:

id: string
name: string
email?: string
phone?: string
status: string
source: string
createdAt: number
updatedAt: number

NO message.

NO unknown Firestore fields.

NO Firestore metadata.

Do not spread raw documents.

================================================================
4. BOUNDED FIRESTORE QUERY
   ================================================================

Production query must be:

tenants/{tenantId}/leads

orderBy('createdAt', 'desc')

limit(51)

Do NOT:

fetch entire collection
sort in Node

Then:

hasMore = docs.length > 50

Expose:

docs.slice(0, 50)

subject to the malformed-record rule below.

This is intentionally bounded.

No pagination cursor yet.

================================================================
5. FAKEDB QUERY SUPPORT
   ================================================================

Claude verified FakeDb currently lacks orderBy/limit.

Extend FakeDb minimally and faithfully.

Add the smallest query abstraction needed for:

collection
.orderBy(field, direction)
.limit(n)
.get()

Do NOT create general where/cursor/query machinery.

IMPORTANT CORRECTION:

Firestore orderBy excludes documents that do not contain the ordered field.

Therefore FakeQuery.get() must conceptually:

1. collect direct-child documents
2. when orderBy is configured:
   exclude documents where the ordered field is absent
3. sort by the ordered field
4. apply direction
5. apply limit
6. return query snapshot shape used by production code

For this milestone the ordered value is numeric createdAt.

Do not let a missing-createdAt FakeDb document appear when real Firestore
would exclude it.

Leave ordinary FakeCollectionReference.get behavior unchanged.

================================================================
6. HASMORE
   ================================================================

Response:

{
leads,
hasMore
}

Fetch max 51.

Return max 50 valid recent summaries.

No:

nextCursor
Load More
infinite scroll

yet.

If hasMore is true, portal displays:

Showing the 50 most recent leads.

A future milestone may add nextCursor without changing current fields.

================================================================
7. TENANT EXISTENCE — CORRECTION
   ================================================================

Add a small internal Lead-domain helper conceptually:

requireTenantExists(tenantId)

It should read:

tenants/{tenantId}

If missing:

404 Tenant not found

Use it from BOTH:

listTenantLeads

getTenantLead

This creates the consistent PLATFORM_ADMIN contract:

nonexistent tenant
-> 404 Tenant not found

existing tenant + missing lead
-> 404 Lead not found

For ordinary unauthorized users, requireTenantRole runs before the Lead service,
so they must still receive 403 rather than tenant-existence information.

Do not create a new tenant service dependency solely for this if a direct
Lead-service tenant existence read is consistent with the existing repo.

================================================================
8. LEAD DETAIL
   ================================================================

GET /tenants/:tenantId/leads/:leadId

Return exactly:

{
id,
name,
email?,
phone?,
message,
status,
source,
createdAt,
updatedAt
}

Missing lead:

404 Lead not found

Unknown Firestore fields must not be returned.

No raw spread.

================================================================
9. MALFORMED DATA — OVERRIDE CLAUDE
   ================================================================

Do NOT return runtime values that contradict the API TypeScript contract.

In particular DO NOT return:

createdAt: null

when the contract says:

createdAt: number

Do NOT fabricate:

createdAt: 0
name: ""
status: ""

to make a malformed record appear valid.

For LIST:

A LeadSummary document is valid only if its required fields have the expected
runtime types.

Required summary fields:

name:
non-empty string

status:
non-empty string

source:
non-empty string

createdAt:
finite number

updatedAt:
finite number

email:
optional; include only if non-empty string

phone:
optional; include only if non-empty string

If a queried document is malformed in one of the REQUIRED fields:

SKIP that malformed row.

Do not crash the entire inbox.

Do not leak arbitrary fields.

NOTE:

Because Firestore orderBy already excludes docs lacking createdAt, a missing
createdAt normally never enters the list query. Other malformed required fields
could still occur from manual corruption.

For DETAIL:

Required fields are:

name
message
status
source
createdAt
updatedAt

with their expected runtime types.

If the requested document exists but required data is malformed:

fail with a controlled internal error.

Do not return a contract-invalid LeadDetail.

The HTTP wrapper should continue keeping 500 responses generic to the browser.

No migration or repair framework.

================================================================
10. MALFORMED ROW / HASMORE BEHAVIOR
    ================================================================

Do not add extra Firestore queries merely to fill skipped malformed rows back
up to 50.

This edge case exists only for manually-corrupted data.

Use the bounded result set.

hasMore continues to describe whether the bounded Firestore query observed a
51st candidate document.

Document this if relevant.

No data-cleanup system in this milestone.

================================================================
11. CACHE POLICY
    ================================================================

Both authenticated lead list and detail responses contain customer PII.

Set:

Cache-Control: no-store

only on these lead routes.

Do not globally alter caching behavior.

A small tenant-router middleware is acceptable.

Add a focused route assertion if easy.

================================================================
12. LEAD SERVICE
    ================================================================

Extend existing:

server/services/leadService.js

Keep:

createPublicLead

unchanged.

Add operations named consistently with the repo, expected:

listTenantLeads(tenantId)

getTenantLead(tenantId, leadId)

Add private mapping/validation helpers as needed.

Do NOT create another Lead service.

Public creation and authenticated reading are two entry points into the same
domain.

================================================================
13. PUBLIC LEAD WRITE CONTRACT
    ================================================================

Do NOT change anything from Step 1.14:

POST /public/sites/:tenantId/leads

published leadForm eligibility

preview/write authority

CORS

credentials handling

rate limiter

16 KB body limit

honeypot

validation

persistence

response

This milestone must be backward compatible with Step 1.14.

================================================================
14. PORTAL API MODULE
    ================================================================

Add:

platform/apps/portal/lib/leads.ts

Do NOT put Lead reads into lib/site.ts.

Define:

LeadSummary

LeadDetail

LeadListResponse

Functions:

getLeads(tenantId)

getLead(tenantId, leadId)

Reuse existing:

apiGet

and its:

credentials include
auth handling
403 retry/refresh behavior

No new request layer.

================================================================
15. LAZY BUSINESS INBOX
    ================================================================

Add a focused portal component, expected:

BusinessLeads.tsx

Businesses initial load must make:

ZERO lead requests.

No lead counts.

No N+1.

Only after user explicitly clicks:

Leads

for a business:

GET /tenants/:tenantId/leads

Do not eagerly fetch for other businesses.

================================================================
16. INBOX STATES
    ================================================================

Support:

initial
loading
empty
success
forbidden
error

Initial:

Leads button only.

Empty:

No leads yet.

Error:

generic message + Retry.

Forbidden:

appropriate access message.

Do not redesign the portal.

================================================================
17. INBOX DISPLAY
    ================================================================

Display compact summary data:

Name

Email / Phone

Status

Received

Do NOT show Message in each row.

Newest leads are already ordered by backend.

If:

hasMore === true

show:

Showing the 50 most recent leads.

No pagination controls.

No Load More.

No infinite scroll.

================================================================
18. LEAD DETAIL UX
    ================================================================

When a user selects a lead:

fetch detail ONLY THEN.

GET:

/tenants/:tenantId/leads/:leadId

Use the smallest current-portal UX:

replace inbox list with detail
+
Back to inbox

No:

modal system
drawer system
new portal routing architecture

Detail shows:

Name
Email if present
Phone if present
Message
Status
Source
Received
Updated

No edit controls.

================================================================
19. PORTAL DATE DISPLAY
    ================================================================

Backend keeps numeric timestamps.

Portal formats valid numeric timestamps using browser locale/time zone.

Do not store/transport formatted date strings.

Because backend response guarantees valid LeadSummary/LeadDetail timestamps,
normal rows should always receive numbers.

Still render defensively in the UI in case a bad runtime response somehow
arrives.

Do not allow a date rendering exception to crash the whole component.

================================================================
20. STATUS
    ================================================================

Status is READ ONLY in Step 1.15.

Display current stored value:

NEW

or any future string returned by the server.

Do NOT:

define mutation workflow
PATCH status
add status dropdown
add status buttons

Step 1.16 will define status semantics.

================================================================
21. AUTH TESTS
    ================================================================

Cover:

unauthenticated -> 401

authenticated non-member -> 403

STAFF -> 200

ADMIN -> 200

OWNER -> 200

PLATFORM_ADMIN -> 200

member of another tenant -> 403

Use the existing fresh-Firestore role test patterns.

Cover both list/detail sufficiently without meaningless duplication.

================================================================
22. TENANT EXISTENCE TESTS
    ================================================================

PLATFORM_ADMIN:

GET /tenants/missing/leads
-> 404 Tenant not found

GET /tenants/missing/leads/someLead
-> 404 Tenant not found

Existing tenant:

GET /tenants/existing/leads/missing
-> 404 Lead not found

Ordinary non-member should still be rejected by authorization before the
service exposes tenant existence.

================================================================
23. LIST SERVICE TESTS
    ================================================================

Cover:

empty tenant lead collection

one lead

multiple leads newest-first

50 leads
-> 50 returned
-> hasMore false

51 leads
-> 50 returned
-> hasMore true

message excluded

approved fields only

unknown raw Firestore field excluded

foreign tenant leads excluded structurally

missing createdAt document excluded by FakeDb orderBy behavior

malformed required summary field is skipped

optional email absent

optional phone absent

timestamps numeric

================================================================
24. DETAIL SERVICE TESTS
    ================================================================

Cover:

valid existing lead

message returned

approved fields only

unknown Firestore property excluded

optional email absent

optional phone absent

missing lead
-> 404 Lead not found

foreign-tenant lead via current tenant path
-> 404 Lead not found

malformed required detail field
-> controlled internal failure

timestamps remain numeric

================================================================
25. NO PUBLIC READ
    ================================================================

There must remain NO:

GET /public/sites/:tenantId/leads

Anonymous lead domain remains:

WRITE ONLY

where appropriate, assert publicLeadRouter does not expose GET lead data.

Do not add any public lead-reading API.

================================================================
26. NO-STORE TEST
    ================================================================

If current route tests make it easy, assert a successful:

GET lead list

or detail contains:

Cache-Control: no-store

One focused assertion is enough.

================================================================
27. FILES EXPECTED TO ADD
    ================================================================

Expected:

server/test/leadReadService.test.js

platform/apps/portal/lib/leads.ts

platform/apps/portal/app/businesses/BusinessLeads.tsx

Do not add more files unless the actual implementation needs them.

================================================================
28. FILES EXPECTED TO MODIFY
    ================================================================

Expected:

server/services/leadService.js

server/routes/tenants.js

server/test/helpers/fakeDb.js

server/test/tenantRoutes.test.js

platform/apps/portal/app/businesses/BusinessList.tsx

Public Lead creation files should remain untouched.

================================================================
29. VERIFY
    ================================================================

Backend:

cd server
npm test

Run scoped StandardJS/syntax checks according to repo conventions.

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

All existing Step 1.14 tests must remain green.

================================================================
30. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Use the lead created during Step 1.14 or create one new public lead.

1. Open Portal → Businesses.

Network:

NO lead requests on initial Businesses load.

2. Click:

Leads

for one business.

Expected:

exactly one:

GET /tenants/:tenantId/leads

3. Inbox shows:

name
email/phone
status NEW
received date/time

4. Select lead.

Expected:

detail GET only now:

GET /tenants/:tenantId/leads/:leadId

5. Detail shows:

name
email/phone
message
status
source
received
updated

6. Browser Network:

lead list/detail responses include:

Cache-Control: no-store

7. Back returns to the already-loaded inbox.

Prefer not to refetch list merely because Back was clicked unless actual
component simplicity requires it.

8. Confirm initial Businesses page still has no N+1 lead requests.

9. STAFF/cross-tenant manual checks optional; automated coverage authoritative.

10. No production writes or changes.

================================================================
31. FUTURE STEP 1.16
    ================================================================

Do not decide these yet:

final status enum

allowed transitions

who can change status

optimistic concurrency

audit history

notes storage

assignment

These are Step 1.16 design questions.

Current API should leave room for:

PATCH /tenants/:tenantId/leads/:leadId

later.

No current public contract needs to change.

================================================================
32. ARCHITECTURAL PRINCIPLE
    ================================================================

This milestone establishes:

PUBLIC:
anonymous write only

TENANT:
authenticated read

Lead ownership:

tenant-scoped Firestore path

Portal:

lazy domain loading

Server:

bounded ordered queries
sanitized summaries/details
fresh tenant authorization
no-store for PII

Do NOT turn this into a generalized business-data framework yet.

================================================================
33. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. List endpoint.
4. Detail endpoint.
5. Authorization behavior.
6. Tenant-existence behavior.
7. LeadSummary contract.
8. LeadDetail contract.
9. Firestore query/limit behavior.
10. FakeDb extension.
11. Malformed-data behavior.
12. hasMore behavior.
13. Cache-Control behavior.
14. Portal leads API.
15. Lazy loading behavior.
16. Inbox UI.
17. Detail UI.
18. Public read boundary.
19. Tests.
20. Backend test result.
21. Platform typecheck/lint/build.
22. Manual DEV verification if performed.
23. Deviations and why.
24. Anything influencing Step 1.16.

Do not implement beyond Step 1.15.