Implement Step 1.16 — Lead Workflow Foundation.

Claude Code inspected the actual repository and produced an approved plan.

Follow Claude's repository findings and plan, with the corrections below
taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Add the first authenticated Lead workflow mutation:

STATUS CHANGE ONLY

Notes are deferred to Step 1.17.

Do NOT implement:

notes
audit history
assignment
deletion
archiving
filters
notifications
email/SMS
pipeline customization

================================================================
1. STATUS MODEL
   ================================================================

Introduce the server-authoritative statuses:

NEW
CONTACTED
QUOTED
WON
LOST

Semantics:

NEW:
newly submitted, not yet actioned

CONTACTED:
business has responded/reached out

QUOTED:
estimate/quote has been provided

WON:
converted to job/sale

LOST:
not converting

Existing leads already store:

NEW

so no migration is required.

================================================================
2. SERVER STATUS SOURCE OF TRUTH
   ================================================================

Add the smallest server module consistent with Claude's inspection, expected:

server/domain/leadStatus.js

Export:

LEAD_STATUSES

isLeadStatus(value)

Do not build a general domain framework.

================================================================
3. PORTAL STATUS CONTRACT
   ================================================================

Portal may mirror:

LEAD_STATUSES

and:

LeadStatus

inside:

platform/apps/portal/lib/leads.ts

because server and platform are separate workspaces.

The server remains authoritative.

IMPORTANT:

Update LeadSummary / LeadDetail portal types so:

status: LeadStatus

not arbitrary string.

================================================================
4. READ SANITIZER STATUS INVARIANT — REQUIRED CORRECTION
   ================================================================

Now that a real LeadStatus enum exists, Lead API sanitizers must no longer
accept arbitrary non-empty status strings.

Update the Lead read validation/sanitizers to require:

isLeadStatus(data.status)

For LIST:

unsupported/malformed stored status
-> malformed row
-> skip row

For DETAIL:

unsupported/malformed stored status
-> controlled 500 Lead data invalid

This keeps runtime responses consistent with:

status: LeadStatus

Existing NEW records remain valid.

Add focused tests for a manually-corrupted unsupported stored status.

Do not add migrations.

================================================================
5. AUTHORIZATION
   ================================================================

PATCH access:

PLATFORM_ADMIN
OWNER
ADMIN
STAFF

Reuse:

requireTenantRole(allTenantRoles)

STAFF must be explicitly proven allowed.

Cross-tenant access remains denied.

Actor identity comes from the authenticated session for authorization only.

================================================================
6. DO NOT STORE updatedByUserId — OVERRIDE CLAUDE
   ================================================================

Do NOT add:

updatedByUserId

to the Lead document or API response in Step 1.16.

Audit history is deferred, and a standalone "last updater" field has ambiguous
future semantics once notes/assignment/other mutations exist.

Lead mutation writes ONLY:

status
updatedAt

createdAt remains unchanged.

Actor attribution should be introduced later through a deliberately designed
activity/audit model.

LeadSummary / LeadDetail shapes therefore do NOT gain updatedByUserId.

================================================================
7. PATCH ENDPOINT
   ================================================================

Add:

PATCH /tenants/:tenantId/leads/:leadId

Inside the authenticated tenant router.

Use:

requireTenantRole(allTenantRoles)

Cache-Control:

no-store

Input:

{
"status": "CONTACTED",
"expectedUpdatedAt": 1723680000000
}

Response:

existing sanitized LeadDetail shape:

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

No extra mutation metadata.

================================================================
8. STATUS PATCH IS NARROW
   ================================================================

This is NOT arbitrary Lead PATCH.

Only read:

status
expectedUpdatedAt

Do NOT allow mutation of:

name
email
phone
message
source
createdAt
id
tenantId

Unknown request fields may be ignored consistent with existing repository
conventions, but must never be persisted.

================================================================
9. STATUS VALIDATION
   ================================================================

status:

required string

must exactly match one of:

NEW
CONTACTED
QUOTED
WON
LOST

No trim.

No case folding.

Examples rejected:

new
Contacted
UNKNOWN

Errors consistent with Claude's plan:

missing/non-string:
Lead status is required

unsupported:
Lead status is not supported

================================================================
10. expectedUpdatedAt VALIDATION — CORRECTION
    ================================================================

expectedUpdatedAt is the server-issued concurrency token.

Require:

Number.isSafeInteger(expectedUpdatedAt)

and:

expectedUpdatedAt >= 0

Do not merely accept any finite number.

Reject:

strings
null
fractional values
negative values
NaN
Infinity

Normal JSON clients submit the integer returned by the LeadDetail API.

Use clear existing-style 400 messages.

Expected conceptual messages:

expectedUpdatedAt is required

expectedUpdatedAt must be a number

If a more accurate existing-style timestamp message fits cleanly, report it.

================================================================
11. TENANT EXISTENCE INSIDE TRANSACTION — CORRECTION
    ================================================================

Do NOT call:

requireTenantExists(tenantId)

as a separate pre-transaction existence check for the mutation.

For updateLeadStatus, create:

tenantRef
leadRef

Then transactionally read BOTH.

Conceptually:

runTransaction(async transaction => {
tenantSnap = await transaction.get(tenantRef)
leadSnap = await transaction.get(leadRef)

    // no writes yet

    if tenant missing:
        404 Tenant not found

    if lead missing:
        404 Lead not found

    ...
})

Both reads must occur before the first transaction.set.

This avoids a tenant-existence time-of-check/time-of-use gap and establishes
the stronger mutation pattern for future domains.

Existing read operations may continue using requireTenantExists.

================================================================
12. MALFORMED LEAD
    ================================================================

Before mutation, validate the stored Lead using the same required LeadDetail
invariants.

This now includes:

status must be a supported LeadStatus.

Malformed Lead:

500 Lead data invalid

NO write.

Do not repair malformed records during status mutation.

================================================================
13. OPTIMISTIC CONCURRENCY
    ================================================================

After reading/validating the Lead:

compare:

current.updatedAt

with:

expectedUpdatedAt

Exact numeric equality.

Mismatch:

409

Lead has changed. Refresh and try again.

No silent overwrite.

No automatic retry.

No last-write-wins.

================================================================
14. SAME-STATUS NO-OP — REQUIRED
    ================================================================

After the concurrency check:

if requested status === current.status:

return current sanitized LeadDetail

WITHOUT:

writing Firestore
changing updatedAt

This is a successful no-op, not a mutation.

Concurrency MUST be checked first.

Therefore:

same status + current version
-> 200 unchanged detail

same status + stale version
-> 409

different status + current version
-> actual mutation

Portal should normally prevent this by disabling Save when nothing changed,
but the server must still handle it correctly.

================================================================
15. UPDATEDAT VERSION TOKEN
    ================================================================

For an ACTUAL status change:

const nextUpdatedAt = Math.max(
Date.now(),
current.updatedAt + 1
)

This guarantees:

nextUpdatedAt > current.updatedAt

even if Date.now() returns the same millisecond.

Write:

{
status,
updatedAt: nextUpdatedAt
}

with merge semantics.

Do NOT change createdAt.

Do NOT add a version field.

Do NOT use server timestamp sentinels.

================================================================
16. TRANSACTION STRUCTURE
    ================================================================

Expected structure:

validate request outside transaction

derive tenantRef + leadRef

runTransaction:
read tenant
read lead

    validate tenant existence
    validate lead existence
    validate lead stored shape
    validate concurrency token

    if same status:
        return sanitized current LeadDetail

    calculate strictly greater updatedAt

    transaction.set(
      leadRef,
      { status, updatedAt },
      { merge: true }
    )

    return sanitized post-update LeadDetail

All transaction.get calls must happen before transaction.set.

FakeDb already supports get + merge set according to Claude.

Do not add fake-only mutation behavior.

================================================================
17. STATUS TRANSITIONS
    ================================================================

V1 transition policy:

ANY supported status
->
ANY supported status

No terminal locking.

WON and LOST may be reopened.

No configurable transition graph.

No workflow engine.

================================================================
18. AUDIT HISTORY
    ================================================================

DEFER.

Do NOT create:

lead events
status-change history
activity subcollection

in Step 1.16.

================================================================
19. NOTES
    ================================================================

DEFER to Step 1.17.

Do NOT add:

notes collection
notes routes
notes UI

This milestone stays status-only.

================================================================
20. PORTAL API
    ================================================================

Extend:

platform/apps/portal/lib/leads.ts

with:

LEAD_STATUSES
LeadStatus

and:

updateLeadStatus(
tenantId,
leadId,
{
status,
expectedUpdatedAt
}
)

Use existing:

apiSend

PATCH method.

Do not create a new transport layer.

================================================================
21. PORTAL DETAIL STATUS UI
    ================================================================

In BusinessLeads detail view add:

Status select

Save Status button

Use explicit save, not immediate mutation on select change.

Select uses:

LEAD_STATUSES

Seed from:

detail.status

No inbox redesign.

No filters.

================================================================
22. SAVE BUTTON NO-OP UX
    ================================================================

Disable Save Status when:

selectedStatus === detail.status

Also disable while:

saving

This avoids pointless requests in the normal UI.

Server no-op handling remains required regardless.

================================================================
23. SUCCESSFUL PORTAL UPDATE
    ================================================================

PATCH returns updated LeadDetail.

On success:

1. replace current detail state

2. update matching LeadSummary in the existing in-memory leads list with:

status
updatedAt

and any other summary fields already present in the returned detail if the
current implementation makes that clean.

Do NOT refetch the full inbox.

Back to Inbox should immediately show the new status.

================================================================
24. 409 CONFLICT UX
    ================================================================

If PATCH returns 409:

show:

This lead changed since you opened it.

Provide:

Refresh Lead

Refresh Lead performs:

GET /tenants/:tenantId/leads/:leadId

and replaces current detail/status/version.

Do NOT:

silently overwrite
auto retry
auto merge

User must see the current state first.

================================================================
25. OTHER ERROR UX
    ================================================================

403:
access message consistent with current component behavior

404:
Lead not found

500/network:
generic error

No internal Firestore details.

================================================================
26. CACHE CONTROL
    ================================================================

PATCH response contains customer PII.

Use existing lead:

Cache-Control: no-store

behavior for the mutation route.

Do not globally modify caching.

================================================================
27. PUBLIC LEAD API
    ================================================================

DO NOT modify Step 1.14 public behavior.

Public remains:

POST /public/sites/:tenantId/leads

anonymous write only.

No public:

lead reads
status reads
status writes
notes

================================================================
28. FAKEDB
    ================================================================

Claude verified FakeDb transaction support is already sufficient:

transaction.get

transaction.set(..., { merge:true })

buffered writes

No FakeDb changes expected.

Do not add transaction.update solely for this feature.

================================================================
29. TESTS — STATUS ENUM / READ CONTRACT
    ================================================================

Test every supported status.

Test unsupported input status -> 400.

Test lowercase -> 400.

Also test stored unsupported status:

LIST:
malformed row skipped

DETAIL:
500 Lead data invalid

Existing NEW leads continue to read normally.

================================================================
30. TESTS — MUTATION
    ================================================================

Cover:

NEW -> CONTACTED

CONTACTED -> QUOTED

QUOTED -> WON

WON -> NEW

LOST -> CONTACTED

to prove unrestricted valid transitions sufficiently.

Do not exhaustively test every N² pair.

Verify:

createdAt unchanged

updatedAt strictly increases

response sanitized

unknown stored fields excluded

only status + updatedAt changed

unknown request fields not persisted

================================================================
31. TESTS — TENANT / LEAD CONTRACT
    ================================================================

Missing tenant:

404 Tenant not found

Existing tenant + missing lead:

404 Lead not found

Malformed lead:

500 Lead data invalid

and stored document remains unchanged.

================================================================
32. TESTS — CONCURRENCY
    ================================================================

Matching expectedUpdatedAt:
success

Stale:
409

Missing token:
400

String:
400

Fraction:
400

Negative:
400

Two sequential actual mutations with Date.now stubbed to same value:

updatedAt still strictly increases.

Old token after first change:

409

No silent last-write-wins.

================================================================
33. TESTS — SAME STATUS
    ================================================================

Fresh expectedUpdatedAt + same requested/current status:

200

LeadDetail unchanged

updatedAt unchanged

stored doc unchanged

No transaction write should occur if current FakeDb makes that assertion
practical.

Stale expectedUpdatedAt + same requested/current status:

409

because concurrency is checked before no-op determination.

================================================================
34. TESTS — AUTHORIZATION
    ================================================================

PATCH:

unauthenticated -> 401

non-member -> 403

STAFF -> 200

ADMIN -> 200

OWNER -> 200

PLATFORM_ADMIN -> 200

cross-tenant member -> 403

Explicitly prove STAFF mutation access.

================================================================
35. TESTS — READ COMPATIBILITY
    ================================================================

Existing Lead list/detail tests remain green.

After actual mutation:

new status appears in subsequent list

new status + updatedAt appear in detail

List query:

order/limit/hasMore unchanged.

Step 1.14 public lead creation tests remain green.

================================================================
36. FILES EXPECTED TO ADD
    ================================================================

Expected:

server/domain/leadStatus.js

server/test/leadStatusService.test.js

Do not add more unless implementation genuinely requires it.

================================================================
37. FILES EXPECTED TO MODIFY
    ================================================================

Expected:

server/services/leadService.js

server/routes/tenants.js

server/test/tenantRoutes.test.js

server/test/leadReadService.test.js
if needed for unsupported stored status regression

platform/apps/portal/lib/leads.ts

platform/apps/portal/app/businesses/BusinessLeads.tsx

FakeDb should remain unchanged.

Public Lead files should remain unchanged.

================================================================
38. VERIFY
    ================================================================

Backend:

cd server
npm test

Run scoped StandardJS/syntax verification according to repository convention.

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

Everything from Steps 1.14 and 1.15 must remain green.

================================================================
39. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Existing DEV Lead.

1. Portal -> Leads -> Lead Detail.

2. Select:

CONTACTED

Save Status.

Expected:

detail shows CONTACTED.

3. Back to Inbox.

Expected:

row shows CONTACTED without list refetch.

4. Reopen/reload.

Expected:

CONTACTED persisted.

5. Change:

CONTACTED -> QUOTED

verify normally.

6. Concurrency:

open same lead in two browser tabs.

Both load version X.

Tab A:
change status + Save
-> success
-> version Y

Tab B:
change status + Save with X
-> 409

UI:

This lead changed since you opened it.

No overwrite.

Click:

Refresh Lead

Expected:
latest status/version loaded.

7. Try selecting the already-current status.

Save Status should be disabled.

8. Verify createdAt unchanged.

9. Verify updatedAt advanced on actual changes.

10. STAFF manual check optional; automated role tests authoritative.

11. Verify public lead form still works unchanged.

12. Confirm only bakerrang-dev changed.

================================================================
40. STEP 1.17
    ================================================================

Step 1.17 remains:

Lead Notes

Likely append-only:

tenants/{tenantId}/leads/{leadId}/notes/{noteId}

with:

text
createdAt
createdByUserId

But do NOT implement or fully design it now.

Activity/audit history can be evaluated alongside or after Notes, when actor
attribution has a clear durable model.

================================================================
41. ARCHITECTURAL PATTERN
    ================================================================

This milestone establishes the first authenticated tenant-data mutation shape:

fresh authorization
↓
transactional tenant + record read
↓
stored-record validation
↓
optimistic concurrency check
↓
explicit server-owned mutation
↓
strictly increasing version token
↓
sanitized response
↓
client updates local state

409:

refresh, never overwrite

Do not generalize this into a framework yet.

================================================================
42. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. LeadStatus contract.
4. Read sanitizer status enforcement.
5. PATCH route.
6. Authorization.
7. Request contract.
8. Response contract.
9. expectedUpdatedAt validation.
10. Transaction tenant/lead reads.
11. Malformed-lead behavior.
12. Concurrency behavior.
13. Same-millisecond protection.
14. Same-status no-op.
15. Transition policy.
16. Audit-history deferral.
17. updatedBy deferral.
18. Notes deferral.
19. Portal status UX.
20. 409 UX.
21. In-memory inbox update.
22. Tests.
23. Backend result.
24. Platform typecheck/lint/build.
25. Manual DEV verification if performed.
26. Deviations and why.
27. Anything influencing Step 1.17.

Do not implement beyond Step 1.16.