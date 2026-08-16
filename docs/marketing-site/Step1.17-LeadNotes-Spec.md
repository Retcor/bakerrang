# Claude Code Assignment — Step 1.17 Lead Notes

DO NOT modify code.

Step 1.16 is complete and manually verified against bakerrang-dev.

We now want the next Lead workflow capability:

INTERNAL LEAD NOTES

This is intentionally a separate milestone from status mutation because Notes
introduce an append-only child-resource pattern.

============================================================
1. GOAL
   ============================================================

Allow authorized business users to:

- view internal notes attached to a Lead
- add a new internal note

Example:

"Called customer, left voicemail."

"Customer wants installation next Thursday."

Notes are:

- tenant-owned
- lead-scoped
- internal only
- append-only in V1

Do NOT implement editing or deletion yet.

============================================================
2. INSPECT CURRENT IMPLEMENTATION
   ============================================================

Inspect actual:

server/services/leadService.js
server/domain/leadStatus.js
server/routes/tenants.js
server/test/leadReadService.test.js
server/test/leadStatusService.test.js
server/test/tenantRoutes.test.js
server/test/helpers/fakeDb.js

platform/apps/portal/lib/leads.ts
platform/apps/portal/app/businesses/BusinessLeads.tsx
platform/apps/portal/lib/api.ts

Also inspect:

tenant authorization middleware
transaction patterns
current LeadDetail state handling
current portal status mutation UI
date formatting helpers/patterns
FakeDb query support added in Step 1.15

Document current Lead read/mutation architecture before planning Notes.

============================================================
3. SCOPE DECISION
   ============================================================

Step 1.17 should contain ONLY:

GET Lead Notes
POST Lead Note

Do NOT include:

note editing
note deletion
status-change audit history
generic activity timeline
attachments
mentions
notifications
email/SMS
assignment
reminders

============================================================
4. FIRESTORE MODEL
   ============================================================

Evaluate:

tenants/{tenantId}/leads/{leadId}/notes/{noteId}

Recommended V1 document:

{
text,
createdAt,
createdByUserId
}

Determine whether anything else is genuinely required.

Do NOT redundantly store:

tenantId
leadId
noteId

inside the document unless the actual repo gives a concrete reason.

============================================================
5. NOTE ID
   ============================================================

Server owns Note IDs.

Prefer:

randomUUID()

if consistent with Lead and Services conventions.

Do not accept client-generated note IDs.

============================================================
6. ACTOR ATTRIBUTION
   ============================================================

createdByUserId must come from:

req.user.id

Never from request body.

This attribution is semantically clear:

the user who created this specific note.

This is different from the intentionally-deferred ambiguous Lead-level:

updatedByUserId

Do NOT add updatedByUserId to Lead.

============================================================
7. AUTHORIZATION
   ============================================================

Evaluate Notes access for:

PLATFORM_ADMIN
OWNER
ADMIN
STAFF

My preference:

all four may READ and ADD notes

because STAFF are the users actually working leads.

Use existing fresh-Firestore tenant authorization.

Cross-tenant access must remain denied.

============================================================
8. NOTE VALIDATION
   ============================================================

Recommend exact constraints.

Suggested:

text:
- required string
- trim
- 1..2000

Errors conceptually:

Lead note is required

Lead note must be 2000 characters or fewer

No rich text.

No HTML interpretation.

React escaping remains sufficient.

Unknown request fields must not be persisted.

============================================================
9. CREATE NOTE ENDPOINT
   ============================================================

Evaluate:

POST /tenants/:tenantId/leads/:leadId/notes

Input:

{
"text": "Called customer, left voicemail."
}

Server determines:

note id
createdAt
createdByUserId

Response should return the sanitized created Note.

Potential:

201

{
id,
text,
createdAt,
createdByUserId
}

Determine whether 201 is consistent with current route infrastructure.

============================================================
10. LEAD EXISTENCE
    ============================================================

A note cannot be created for a nonexistent Lead.

Use existing contracts:

missing tenant:
404 Tenant not found

existing tenant + missing lead:
404 Lead not found

Do not create orphan Notes.

Determine whether tenant + lead existence checks for POST should occur in a
transaction.

Because Note creation adds a child document, evaluate the cleanest atomic
pattern.

============================================================
11. TRANSACTION / ATOMICITY
    ============================================================

Evaluate whether POST should transactionally:

read tenant
read lead
validate existence/well-formed Lead
write note

or whether a non-transactional parent check + note write is sufficient.

Prefer avoiding a TOCTOU gap if the cost is small.

Do not mutate the Lead merely because a Note is added unless there is a
concrete reason.

In particular:

do NOT automatically change:

status
updatedAt

just because a note was written unless you can justify that semantically.

My initial preference:
Lead `updatedAt` continues to mean Lead-state mutation version and should NOT
change for append-only Notes.

Evaluate carefully because this affects optimistic concurrency.

============================================================
12. STATUS CONCURRENCY INTERACTION
    ============================================================

This is important.

Step 1.16 uses:

Lead.updatedAt

as the optimistic concurrency token for Lead status.

Adding a Note should probably NOT invalidate an open Status editor unless the
Lead document itself changed.

Therefore preferred behavior:

add Note
-> Lead.updatedAt unchanged
-> status editor's concurrency token remains valid

Evaluate and explicitly confirm whether this is the cleanest semantic model.

============================================================
13. LIST NOTES ENDPOINT
    ============================================================

Evaluate:

GET /tenants/:tenantId/leads/:leadId/notes

Return a bounded list.

Determine preferred ordering.

For a chronological conversation/activity feed, my initial preference is:

oldest first in the UI

But production query efficiency may favor:

createdAt DESC
limit(N)

then reverse in the portal.

Evaluate the best V1 design.

============================================================
14. BOUNDED NOTE READS
    ============================================================

Do NOT fetch an unbounded Notes subcollection.

Recommend a V1 bound.

Potential:

50 most recent notes

or:

100 most recent notes

Given notes are small and lead-scoped, choose a sensible number.

Preferred response concept:

{
"notes": [...],
"hasMore": false
}

This mirrors Leads.

Do NOT implement pagination UI yet.

If hasMore:

show an informational message.

============================================================
15. NOTE ORDER
    ============================================================

Explicitly choose one API order and one UI order.

Possible:

API:
newest first

UI:
oldest-to-newest within returned recent set

or API oldest first directly.

Consider future cursor pagination.

Do not overengineer now.

============================================================
16. NOTE CONTRACT
    ============================================================

Define exact:

LeadNote

Likely:

interface LeadNote {
id: string
text: string
createdAt: number
createdByUserId: string
}

Do not expose raw Firestore fields.

Sanitize field-by-field.

============================================================
17. MALFORMED NOTE DATA
    ============================================================

Apply the same discipline as Leads.

Required:

text:
non-empty string

createdAt:
finite/safe numeric timestamp as appropriate

createdByUserId:
non-empty string

Malformed list Note:

prefer skip rather than crash entire Lead detail.

Determine behavior for direct Note detail if no detail endpoint exists.

No migration framework.

============================================================
18. USER DISPLAY / AUTHOR NAME
    ============================================================

The Note stores only:

createdByUserId

Evaluate what the UI should display as the author.

Options:

A. display user ID
B. resolve user name/profile server-side
C. omit author name for V1 but preserve attribution
D. return a small sanitized author display field

Inspect existing user documents and identity helpers.

Do NOT create N+1 user lookups per Note if avoidable.

Do NOT denormalize user email/name into Notes without considering what happens
when profile data changes.

Recommend the smallest useful approach.

My preference:
avoid exposing raw IDs in UI if possible.

============================================================
19. POTENTIAL AUTHOR LOOKUP
    ============================================================

If resolving author display:

evaluate collecting unique createdByUserId values from the bounded note set and
fetching users efficiently.

But do NOT build a generic people directory.

If the existing User model makes this awkward, it is acceptable for Step 1.17
to render:

"Team member"

while preserving server-side createdByUserId attribution.

Ground this in actual code.

============================================================
20. CACHE CONTROL
    ============================================================

Notes contain internal customer/business context.

GET and POST responses:

Cache-Control: no-store

Do not globally modify caching.

============================================================
21. PUBLIC BOUNDARY
    ============================================================

There must be NO public Note API.

Do NOT add:

GET /public/.../notes
POST /public/.../notes

Lead Notes are authenticated tenant data only.

Public Lead form remains unchanged.

============================================================
22. LEAD SERVICE RESPONSIBILITY
    ============================================================

Evaluate whether Notes belong in:

leadService.js

or whether a dedicated:

leadNoteService.js

is justified.

My initial preference:

keep them in the Lead domain unless the file is becoming unwieldy.

However, Notes are a subresource with their own query/create behavior.

Inspect actual leadService size/cohesion and recommend the cleanest split.

Do NOT create a generic comments service.

============================================================
23. PORTAL API
    ============================================================

Extend:

platform/apps/portal/lib/leads.ts

or create:

lib/leadNotes.ts

only if the domain separation is genuinely clearer.

Types:

LeadNote
LeadNoteListResponse

Functions:

getLeadNotes(tenantId, leadId)

addLeadNote(tenantId, leadId, input)

Reuse:

apiGet
apiSend

No new transport layer.

============================================================
24. LAZY NOTE LOADING
    ============================================================

Do NOT load Notes in the Lead list.

Do NOT load Notes for every lead.

Notes should load only when the Lead Detail view is opened.

Evaluate whether:

Lead Detail GET
and
Notes GET

can happen in parallel once a Lead is selected.

Current behavior already fetches Lead Detail on selection.

Preferred:

when detail opens:
fetch Lead Detail
fetch Notes

without changing the LeadDetail API to embed Notes.

Keep Notes as their own resource.

============================================================
25. PORTAL NOTES UI
    ============================================================

Integrate into current BusinessLeads Lead Detail.

Simple section:

Internal Notes

[ existing note ]
[ existing note ]

[ Add a note...                     ]
[ Add Note ]

No new modal/drawer/page framework.

Use existing tokens/components.

============================================================
26. NOTE DISPLAY
    ============================================================

Each Note should show at minimum:

text
created time

and author representation according to §18.

No Markdown rendering.

No HTML.

No edit/delete buttons.

============================================================
27. ADD NOTE UX
    ============================================================

Textarea:

maxLength based on server limit.

Button:

Add Note

States:

idle
saving
success
403
404
generic error

Disable while saving.

Blank note cannot submit.

On success:

append/insert the returned Note into the in-memory note list

Do NOT refetch all notes just to show the new one.

============================================================
28. NOTE SORT AFTER CREATE
    ============================================================

If UI is chronological:

new Note should appear at the bottom.

If UI newest-first:

new Note at the top.

Make this consistent with chosen presentation order.

============================================================
29. HASMORE UX
    ============================================================

If older Notes exist beyond the V1 bound:

show something like:

Showing the most recent 50 notes.

Do NOT implement:

Load More
pagination
infinite scrolling

yet.

============================================================
30. ERROR ISOLATION
    ============================================================

Notes failing to load should NOT make the entire Lead Detail unusable.

Lead core detail/status may still render while Notes show their own:

Unable to load notes.
Retry

Likewise a Note POST error should not destroy Lead Detail state.

This is a separate subresource.

============================================================
31. STATUS CONFLICT UX MUST REMAIN
    ============================================================

Step 1.16 behavior must remain unchanged.

Adding/loading Notes must not interfere with:

selected status
Save Status
expectedUpdatedAt
409 Refresh Lead

If Note creation does not change Lead.updatedAt, an open status editor remains
valid.

Test/verify this.

============================================================
32. NOTE CREATION + STATUS CONCURRENCY TEST
    ============================================================

Important scenario:

Lead updatedAt = X.

Tab/user loads Lead at X.

Another user adds Note.

Lead updatedAt should remain X.

First user changes status using expectedUpdatedAt X.

Expected:

status update succeeds

because adding an append-only Note did not mutate Lead state.

If you recommend different semantics, justify them strongly.

============================================================
33. AUDIT HISTORY RELATIONSHIP
    ============================================================

Do NOT turn Notes into status-change audit events.

But evaluate future possibility of an Activity feed combining:

notes
status events

without requiring Notes schema changes.

A future normalized activity view may merge multiple subresources/read models.

Do not implement it now.

============================================================
34. TESTS — NOTE VALIDATION
    ============================================================

Cover:

valid note

trimmed text

blank

missing

non-string

too long

unknown request fields excluded

client id ignored

client createdAt ignored

client createdByUserId ignored

============================================================
35. TESTS — NOTE CREATE
    ============================================================

Cover:

server UUID

createdAt server-owned

actor from authenticated session

tenant-scoped lead note path

missing tenant

missing lead

malformed lead if parent Lead validity is required

Lead document unchanged

Lead.updatedAt unchanged

Lead.status unchanged

============================================================
36. TESTS — NOTE LIST
    ============================================================

Cover:

no notes

one note

multiple notes chosen order

bounded result

hasMore behavior

approved fields only

malformed note skipped

unknown stored fields excluded

tenant/lead isolation

============================================================
37. TESTS — AUTHORIZATION
    ============================================================

GET Notes and POST Note:

unauthenticated

non-member

STAFF

ADMIN

OWNER

PLATFORM_ADMIN

cross-tenant

Explicitly prove STAFF can add Notes if that is the chosen policy.

============================================================
38. TESTS — CACHE CONTROL
    ============================================================

GET/POST Note responses:

Cache-Control: no-store

One focused route assertion per behavior if practical.

============================================================
39. TESTS — PUBLIC BOUNDARY
    ============================================================

Assert no public Note read/write route exists where practical.

Existing public Lead POST remains unchanged.

============================================================
40. TESTS — STATUS INTERACTION
    ============================================================

Create Note while Lead updatedAt = X.

Assert Lead document still has updatedAt = X.

Then perform existing status update with expectedUpdatedAt X.

Expected:

success.

This proves Notes and Lead-state concurrency remain independent.

============================================================
41. FAKEDB
    ============================================================

Inspect whether current FakeDb query support handles the chosen Notes query.

If Notes use:

orderBy(createdAt)
limit(...)

the Step 1.15 FakeQuery may already be sufficient.

Extend minimally only if genuinely necessary.

Do not weaken production query design to fit FakeDb.

============================================================
42. MANUAL DEV E2E
    ============================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Existing Lead.

1. Portal -> Leads -> Lead Detail.

2. Notes load only once detail is opened.

3. Existing empty state:

No notes yet.

4. Add:

"Called customer, left voicemail."

Expected:
new Note appears immediately.

5. Inspect Firestore:

tenants/{tenantId}/leads/{leadId}/notes/{noteId}

Verify:

text
createdAt
createdByUserId

No:

tenantId
leadId
id
client timestamps

6. Add second Note.

Verify ordering.

7. Reload Lead Detail.

Notes persist and load in chosen order.

8. Verify Lead:

status unchanged
createdAt unchanged
updatedAt unchanged

after Note creation.

9. Concurrency independence:

open Lead Status with current version X.

Add a Note from another tab/session if convenient.

Save a status change from first tab with X.

Expected:
success.

10. Verify Notes have no public API access.

11. STAFF manual check optional; automated auth coverage authoritative.

12. Confirm only bakerrang-dev changed.

============================================================
43. FUTURE STEP
    ============================================================

After Notes, evaluate:

Lead Activity / Audit History

Potentially status-change events:

STATUS_CHANGED
fromStatus
toStatus
createdAt
createdByUserId

Then UI may eventually combine:

Notes
Status Events

into one chronological Activity feed.

Do NOT implement in 1.17.

============================================================
44. ARCHITECTURAL LESSON
    ============================================================

This milestone should establish the append-only authenticated child-resource
pattern:

fresh tenant authorization
->
validate parent tenant + Lead
->
server-owned child ID
->
session-owned actor attribution
->
append child record
->
bounded sanitized reads
->
no-store
->
local UI insertion

without mutating the parent concurrency token.

Do NOT generalize into a framework yet.

============================================================
DELIVERABLE
============================================================

Return:

1. Current Lead/portal readiness for Notes.
2. Recommended Note service/module placement.
3. Exact Firestore model.
4. Note ID strategy.
5. Actor attribution.
6. Allowed roles.
7. Validation.
8. POST endpoint.
9. GET endpoint.
10. Parent tenant/Lead validation.
11. Transaction decision.
12. Lead.updatedAt interaction.
13. Status concurrency interaction.
14. Note list bound.
15. API order.
16. UI order.
17. hasMore design.
18. LeadNote contract.
19. Malformed-note policy.
20. Author-display decision.
21. Cache policy.
22. Portal API.
23. Lazy loading.
24. Notes UI.
25. Error isolation.
26. Files to add.
27. Files to modify.
28. Files explicitly unchanged.
29. FakeDb changes if any.
30. Tests.
31. Verification commands.
32. Manual DEV E2E.
33. Concrete risks.
34. Future Activity/Audit compatibility.
35. What this establishes for append-only tenant child resources.
36. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.