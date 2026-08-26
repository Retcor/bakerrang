# Claude Code Assignment — Step 1.16 Lead Workflow Foundation

DO NOT modify code.

Step 1.15 is complete and manually verified against bakerrang-dev.

We now want to design the first mutable CRM behavior for Leads.

Current Lead lifecycle:

public visitor
->
lead capture
->
tenant Lead record
->
authenticated inbox
->
lead detail

Step 1.16 should determine what happens AFTER a business user reads a lead.

============================================================
1. GOAL
   ============================================================

Evaluate and plan a minimal Lead Workflow milestone.

Primary candidate capabilities:

1. Lead status changes
2. Internal lead notes

However:

DO NOT assume both belong in the same implementation milestone.

Inspect the actual code and decide whether:

A. Step 1.16 should contain status + notes

or

B. Step 1.16 should contain status only
and notes should become Step 1.17

Prefer smaller coherent milestones over bundling unrelated mutation patterns.

============================================================
2. INSPECT CURRENT IMPLEMENTATION
   ============================================================

Inspect actual:

server/services/leadService.js
server/routes/tenants.js
server/test/leadReadService.test.js
server/test/tenantRoutes.test.js
server/test/helpers/fakeDb.js

platform/apps/portal/lib/leads.ts
platform/apps/portal/app/businesses/BusinessLeads.tsx

Also inspect:

tenant authorization middleware
existing transaction patterns
site mutation concurrency behavior
Firestore timestamp conventions
portal API error handling
current lead list/detail response contracts

Document:

- exact Lead model
- current LeadSummary
- current LeadDetail
- role behavior
- updatedAt semantics
- current FakeDb transaction capabilities
- whether lead mutation can safely use transactions today

============================================================
3. STATUS MODEL
   ============================================================

Evaluate a small explicit LeadStatus enum.

Candidate:

NEW
CONTACTED
QUALIFIED
WON
LOST

But do not accept this blindly.

Evaluate whether a local-service business would be better served by something
like:

NEW
CONTACTED
ESTIMATE_SCHEDULED
WON
LOST

or another minimal set.

We do NOT want a huge sales-pipeline system.

Recommend:

- exact statuses
- meaning of each
- whether transitions should be unrestricted between statuses in V1
- whether terminal statuses exist
- whether reopening WON/LOST should be allowed

Prefer simplicity.

============================================================
4. STATUS ENUM LOCATION
   ============================================================

Determine where the server-owned Lead status contract should live.

Potentially:

server/domain/leads
shared schema
or another small module

Consider that:

server
portal

both need the allowed status values.

Do NOT introduce a broad domain-framework package merely for one enum.

Recommend the smallest source-of-truth arrangement that avoids string drift.

============================================================
5. EXISTING LEADS
   ============================================================

Existing leads currently store:

status: 'NEW'

Any new enum must remain compatible with existing documents.

No migration should be required if possible.

Explain compatibility.

============================================================
6. AUTHORIZATION FOR MUTATION
   ============================================================

Current lead reads allow:

PLATFORM_ADMIN
OWNER
ADMIN
STAFF

Evaluate who should be allowed to mutate lead workflow.

My initial preference:

PLATFORM_ADMIN
OWNER
ADMIN
STAFF

because STAFF are likely the users actually responding to leads.

Do not restrict STAFF merely because membership management is OWNER/ADMIN.

Recommend based on the business workflow.

============================================================
7. STATUS UPDATE ENDPOINT
   ============================================================

Evaluate a focused endpoint such as:

PATCH /tenants/:tenantId/leads/:leadId

Input conceptually:

{
status: 'CONTACTED',
expectedUpdatedAt: 123456789
}

Do NOT let this become arbitrary Lead patching.

Only editor-owned workflow fields should be mutable.

If notes are split into another milestone, this PATCH should be status-only.

============================================================
8. OPTIMISTIC CONCURRENCY
   ============================================================

This is important.

Multiple business users may eventually view and update the same lead.

Evaluate requiring the caller to submit the Lead version it last read:

expectedUpdatedAt

Then execute mutation transactionally:

read lead
->
verify current updatedAt === expectedUpdatedAt
->
apply mutation
->
new updatedAt

If version differs:

409 Conflict

with a controlled message such as:

Lead has changed. Refresh and try again.

Evaluate whether numeric Date.now timestamps are sufficient as the V1
concurrency token.

Do not introduce ETags/version integers unless they materially improve the
actual implementation.

============================================================
9. SAME-MILLISECOND EDGE CASE
   ============================================================

Because updatedAt uses Date.now():

evaluate whether two updates in the same millisecond could produce the same
version.

If so, recommend the smallest reliable fix.

Possible options:

- explicit numeric version counter
- ensure new updatedAt > previous updatedAt
- Firestore server timestamps plus another version token

Do NOT overengineer.

We need a concurrency token that actually changes on every successful mutation.

============================================================
10. TRANSACTION
    ============================================================

Status mutation should be atomic.

Likely:

transaction.get(leadRef)
verify existence
verify data
verify expected version
validate requested status
transaction.set/update(...)
return sanitized LeadDetail

All reads before writes.

Inspect current FakeDb transaction support and determine whether it faithfully
supports this.

Do not weaken production semantics to accommodate FakeDb.

============================================================
11. STATUS TRANSITIONS
    ============================================================

Decide whether V1 should enforce a transition graph.

Potential simple policy:

any valid status
->
any other valid status

This is easier for real businesses and avoids trapping users in an artificial
workflow.

Alternative:

terminal WON/LOST still may reopen manually.

Recommend whether unrestricted valid transitions are the right V1 choice.

Do not build a configurable workflow engine.

============================================================
12. AUDIT HISTORY
    ============================================================

Evaluate whether every status change should create history now.

Possible model:

tenants/{tenantId}/leads/{leadId}/events/{eventId}

with:

type: STATUS_CHANGED
fromStatus
toStatus
changedAt
changedByUserId

But do NOT implement this merely because it sounds enterprise-friendly.

Determine whether audit history is genuinely necessary in Step 1.16.

Consider:

- multiple staff members
- accountability
- future reporting
- rollback/debugging
- additional transaction writes
- extra API/UI complexity

If it can safely wait, explicitly defer it.

============================================================
13. ACTOR ID
    ============================================================

If status changes are persisted:

determine whether the Lead document itself should store:

updatedByUserId

or whether that belongs only in future audit events.

Avoid adding metadata with unclear use.

If useful for the portal, explain why.

============================================================
14. NOTES — SCOPE DECISION
    ============================================================

Evaluate internal notes.

Examples:

"Called customer, left voicemail."

"Customer wants installation next Thursday."

Notes are business-internal and must never appear publicly.

Determine whether notes should be:

A. included in Step 1.16

or

B. deferred to Step 1.17

Consider that notes introduce a different data pattern:

append-only collection

rather than updating a single Lead field.

Prefer splitting if combining status update + append-only notes would make the
milestone too broad.

============================================================
15. IF NOTES ARE INCLUDED
    ============================================================

Only if you recommend notes in 1.16, evaluate a model like:

tenants/{tenantId}/leads/{leadId}/notes/{noteId}

{
text,
createdAt,
createdByUserId
}

Do NOT store notes as an ever-growing array in the Lead doc unless there is a
strong reason.

Evaluate:

POST /tenants/:tenantId/leads/:leadId/notes

GET /tenants/:tenantId/leads/:leadId/notes

bounded newest/oldest ordering

authorization

PII/no-store

But if notes should be separate, do not plan all of this in implementation
detail yet.

============================================================
16. LEAD DETAIL CONTRACT
    ============================================================

Evaluate whether LeadDetail should gain anything for workflow.

Likely:

status remains present
updatedAt remains version token

Potentially:

updatedByUserId?

Do not add notes inline if notes are a subcollection.

Do not expose internal Firestore implementation fields.

============================================================
17. LIST BEHAVIOR AFTER STATUS UPDATE
    ============================================================

The inbox currently stores LeadSummary in memory.

After a successful status change in detail:

decide how the portal should update the existing inbox row.

Preferred:

PATCH returns the updated sanitized LeadDetail

Portal then updates:

selected detail
matching LeadSummary in local list

without refetching the entire inbox.

Evaluate if this is clean with current BusinessLeads state.

============================================================
18. PORTAL STATUS UX
    ============================================================

Plan a minimal status control in Lead Detail.

Potential:

Status
[ NEW ▼ ]

Save Status

or immediate select with confirmation/error handling.

Prefer clear explicit mutation UX.

Must handle:

idle
saving
success
409 conflict
403
404
generic error

Do not redesign the inbox.

============================================================
19. CONFLICT UX
    ============================================================

For 409:

show a clear message:

This lead changed since you opened it.

Provide:

Refresh Lead

which GETs the detail again.

Do not silently overwrite.

Do not automatically retry a stale mutation.

============================================================
20. INBOX SUMMARY STATUS
    ============================================================

After successful status mutation:

the inbox list row should reflect the new status immediately.

No full list refetch should be required.

Back to Inbox should show the updated status.

============================================================
21. STATUS FILTERS
    ============================================================

Do NOT add filters in this milestone.

Even after statuses become meaningful:

no:

All / New / Contacted / Won

UI yet.

That can come later.

============================================================
22. UPDATEDAT
    ============================================================

Every successful workflow mutation must update:

updatedAt

createdAt must remain unchanged.

If using updatedAt as concurrency token, it must strictly change after every
successful update.

Recommend the implementation.

============================================================
23. CLIENT-CONTROLLED FIELDS
    ============================================================

The PATCH must not allow modification of:

name
email
phone
message
source
createdAt
id
tenantId

unless a future explicit lead-edit feature is designed.

Only explicitly supported workflow fields.

Unknown request fields should be ignored or rejected according to existing
API conventions.

Recommend which is clearer for mutation safety.

============================================================
24. MISSING / MALFORMED LEAD
    ============================================================

Use existing contracts:

missing tenant:
404 Tenant not found

missing lead:
404 Lead not found

malformed lead:
controlled internal failure

Do not mutate malformed documents.

============================================================
25. CACHE CONTROL
    ============================================================

Mutation response and subsequent Lead reads contain PII.

Continue:

Cache-Control: no-store

for Lead workflow endpoints.

============================================================
26. PUBLIC API
    ============================================================

Public Lead API remains unchanged:

anonymous POST only

No public:

status reads
status writes
notes
lead detail

Do not touch Step 1.14 behavior.

============================================================
27. FAKEDB
    ============================================================

Inspect whether FakeDb supports:

transaction get
transaction update/set merge
atomic behavior

If status concurrency requires an extension:

make the smallest faithful extension.

Do not create a fake-only implementation path.

============================================================
28. TESTS — STATUS VALIDATION
    ============================================================

If status mutation is recommended, cover:

each valid status

unsupported status -> 400

missing status -> 400

non-string status -> 400

trim/casing policy as chosen

unknown request fields behavior

============================================================
29. TESTS — STATUS MUTATION
    ============================================================

Cover:

NEW -> another status

createdAt unchanged

updatedAt changes

response sanitized

unknown stored fields excluded

tenant-scoped path

missing tenant

missing lead

malformed lead

============================================================
30. TESTS — CONCURRENCY
    ============================================================

Cover:

matching expectedUpdatedAt -> success

stale expectedUpdatedAt -> 409

missing expectedUpdatedAt -> chosen validation failure

invalid expectedUpdatedAt type

two sequential successful mutations produce distinct concurrency versions

old version cannot mutate after first update

No silent last-write-wins.

============================================================
31. TESTS — AUTHORIZATION
    ============================================================

Cover chosen mutation roles:

unauthenticated

non-member

STAFF

ADMIN

OWNER

PLATFORM_ADMIN

cross-tenant user

If STAFF is allowed, explicitly prove it.

============================================================
32. TESTS — READ COMPATIBILITY
    ============================================================

Existing:

GET list
GET detail

must still work.

Updated status must appear in both after mutation.

No change to list limit/pagination behavior.

============================================================
33. PORTAL TEST / BUILD CONSIDERATIONS
    ============================================================

Portal may not currently have component tests.

Do not introduce a large frontend testing framework solely for this milestone.

Rely on:

TypeScript
lint
build
backend contract tests
manual DEV verification

unless lightweight existing testing infrastructure already exists.

============================================================
34. MANUAL DEV E2E
    ============================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Existing test lead.

1. Portal -> Leads -> open Lead Detail.

2. Change status.

3. Save.

4. Confirm detail immediately displays new status.

5. Back to inbox.

Expected:
same row shows updated status without list refetch.

6. Reload page/open Leads again.

Expected:
new status persisted.

7. Concurrency test:

Open same lead in two browser tabs.

Tab A and Tab B both load version X.

Tab A:
change status + save -> success, version becomes Y.

Tab B:
change status + save using X.

Expected:
409 conflict
clear stale-data message
no overwrite

Refresh Lead in Tab B.

Expected:
latest status/version appears.

8. Confirm createdAt unchanged.

9. Confirm updatedAt advanced.

10. Verify STAFF mutation if convenient if STAFF is chosen as allowed.

Automated auth coverage may be authoritative otherwise.

11. Confirm public lead form still works unchanged.

============================================================
35. STEP 1.17
    ============================================================

If notes are deferred, define Step 1.17 conceptually as:

Lead Notes

append-only internal notes
actor attribution
bounded note reads
PII/no-store
lead-detail integration

Do not implement now.

If notes are included in 1.16, recommend what 1.17 should become instead.

============================================================
36. ARCHITECTURAL LESSON
    ============================================================

This is our first authenticated tenant business-data MUTATION.

Identify what reusable pattern it establishes for future domains:

fresh authorization
transactional mutation
optimistic concurrency
sanitized response
server-owned mutable fields
client stale-state handling

Do not frameworkize it yet.

============================================================
DELIVERABLE
============================================================

Return:

1. Current Lead mutation readiness.
2. Recommended Step 1.16 scope:
   status only
   OR
   status + notes.
3. Recommended status enum.
4. Status semantics.
5. Allowed roles.
6. PATCH endpoint contract.
7. Exact request shape.
8. Exact response shape.
9. Validation.
10. Transition policy.
11. Concurrency design.
12. Same-millisecond/version-token handling.
13. Transaction design.
14. Audit-history decision.
15. updatedBy decision.
16. Notes decision.
17. LeadDetail/List compatibility.
18. Portal UX.
19. 409 conflict UX.
20. Local inbox update strategy.
21. Files to add.
22. Files to modify.
23. Files explicitly unchanged.
24. FakeDb changes if required.
25. Tests.
26. Verification commands.
27. Manual DEV E2E.
28. Concrete risks.
29. Future Step 1.17.
30. What this establishes for future tenant-data mutations.
31. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.