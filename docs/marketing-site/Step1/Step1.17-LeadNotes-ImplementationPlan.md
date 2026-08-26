Implement Step 1.17 — Lead Notes.

Claude Code inspected the repository and produced an approved implementation
plan.

Follow Claude's repository findings and plan, with the corrections below
taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Add authenticated, internal, append-only Notes to Leads.

Users may:

GET Lead Notes
POST Lead Note

No:

note editing
note deletion
status audit events
activity timeline
attachments
mentions
notifications
assignment
reminders

================================================================
1. FIRESTORE MODEL
   ================================================================

Use:

tenants/{tenantId}/leads/{leadId}/notes/{noteId}

Document:

{
text,
createdAt,
createdByUserId
}

Do NOT redundantly persist:

tenantId
leadId
noteId

The document id is the Note id.

================================================================
2. NOTE ID
   ================================================================

Server-owned:

node:crypto randomUUID()

Do not accept a client Note id.

================================================================
3. ACTOR ATTRIBUTION
   ================================================================

createdByUserId comes ONLY from:

req.user.id

Never from request body.

This has unambiguous semantics:

the authenticated user who created this specific Note.

Do NOT add Lead.updatedByUserId.

================================================================
4. AUTHORIZATION
   ================================================================

GET Notes and POST Note allow:

PLATFORM_ADMIN
OWNER
ADMIN
STAFF

Reuse:

requireTenantRole(allTenantRoles)

Fresh-Firestore role checks remain authoritative.

Explicitly prove STAFF creation access.

Cross-tenant access remains denied.

================================================================
5. NOTE VALIDATION
   ================================================================

Request:

{
"text": "Called customer, left voicemail."
}

text:

required string
trim
non-empty
max 2000 characters

Errors:

Lead note is required

Lead note must be 2000 characters or fewer

No HTML interpretation.

No Markdown.

Unknown request fields must never persist.

Ignore client-controlled:

id
createdAt
createdByUserId
tenantId
leadId

================================================================
6. NOTE CONTRACT
   ================================================================

LeadNote:

{
id: string,
text: string,
createdAt: number,
createdByUserId: string
}

LeadNoteListResponse:

{
notes: LeadNote[],
hasMore: boolean
}

Build responses field-by-field.

Never raw-spread Firestore data.

================================================================
7. NOTE TIMESTAMP VALIDATION — CORRECTION
   ================================================================

For stored Note sanitization, createdAt must be a legitimate server timestamp:

Number.isSafeInteger(createdAt)
&& createdAt >= 0

Do NOT merely accept any finite number.

Malformed Note examples that must be skipped:

createdAt = -1
createdAt = 1.5
createdAt missing
createdAt non-number

A valid LeadNote returned by the API always has a valid numeric timestamp.

Do not broaden this into an unrelated Lead timestamp refactor.

================================================================
8. CREATE ENDPOINT
   ================================================================

Add:

POST /tenants/:tenantId/leads/:leadId/notes

Authenticated tenant route.

Use:

requireTenantRole(allTenantRoles)
noStore

Success:

201

return the sanitized created LeadNote.

No public route.

================================================================
9. GET ENDPOINT
   ================================================================

Add:

GET /tenants/:tenantId/leads/:leadId/notes

Authenticated tenant route.

Use:

requireTenantRole(allTenantRoles)
noStore

Return:

{
notes,
hasMore
}

No public route.

================================================================
10. PARENT EXISTENCE
    ================================================================

A Note requires:

existing tenant
existing Lead

Create:

transactionally read BOTH tenant and Lead before writing the Note.

Missing tenant:

404 Tenant not found

Existing tenant + missing Lead:

404 Lead not found

No orphan Notes.

For list:

Claude's proposed existing read-style tenant + Lead existence verification is
acceptable.

================================================================
11. LEAD WELL-FORMEDNESS
    ================================================================

Do NOT require the Lead to pass the complete LeadDetail sanitizer merely to add
or list Notes.

Parent existence is sufficient.

Notes are an independent child resource.

Do not repair malformed Leads.

Do not mutate malformed Lead fields.

================================================================
12. TRANSACTION RETRY DETERMINISM — REQUIRED CORRECTION
    ================================================================

Validate text before the transaction.

Construct immutable server-owned Note data BEFORE runTransaction:

const noteId = randomUUID()
const createdAt = Date.now()

const note = {
text,
createdAt,
createdByUserId: actorUserId
}

Then build noteRef.

runTransaction callback:

1. transaction.get tenant
2. transaction.get lead
3. verify tenant exists
4. verify lead exists
5. transaction.set(noteRef, note)
6. return sanitized { id: noteId, ...note }

All reads before write.

Do NOT call Date.now() inside the retryable transaction callback.

This ensures Firestore transaction retries attempt the same Note id AND the
same immutable Note content.

================================================================
13. LEAD DOCUMENT MUST REMAIN UNCHANGED
    ================================================================

Creating a Note must write ONLY:

noteRef

Do NOT write Lead.

Do NOT change:

Lead.status
Lead.createdAt
Lead.updatedAt
any Lead field

This is a critical invariant.

================================================================
14. STATUS CONCURRENCY INDEPENDENCE
    ================================================================

Lead.updatedAt remains the version of mutable Lead state.

Adding an append-only Note must NOT invalidate a status editor.

Scenario:

Lead.updatedAt = X

User A loads status editor at X

User B creates Note

Lead.updatedAt remains X

User A PATCHes status using expectedUpdatedAt X

Expected:

status mutation succeeds

This must have automated coverage.

================================================================
15. NOTE QUERY
    ================================================================

GET Notes production query:

orderBy('createdAt', 'desc')
limit(51)

No unbounded collection fetch.

hasMore:

query returned > 50 candidate Notes

Return:

first 50

API order:

newest first

No cursor yet.

================================================================
16. MALFORMED NOTE POLICY
    ================================================================

Required Note fields:

text:
non-empty string

createdAt:
non-negative safe integer

createdByUserId:
non-empty string

Malformed Note:

skip from list

Do not fail the entire Notes request because one manually-corrupted row exists.

Unknown stored properties:

exclude.

As with Lead list behavior, hasMore may describe bounded query candidates
before malformed rows are removed.

Do not issue additional reads merely to replace corrupt skipped Notes.

================================================================
17. UI ORDER
    ================================================================

API returns recent Notes:

newest -> oldest

Portal displays the returned recent set:

oldest -> newest

Newly created Note:

append to bottom of in-memory displayed Notes.

If hasMore:

show:

Showing the most recent 50 notes.

No:

Load More
pagination
infinite scroll

================================================================
18. AUTHOR DISPLAY
    ================================================================

Preserve:

createdByUserId

in API data.

Portal:

if note.createdByUserId === current authenticated user id:

You

otherwise:

Team member

Do not display raw user IDs.

Do not add one user lookup per Note.

Do not denormalize author names/emails into Note documents.

No people-directory system.

================================================================
19. SERVICE PLACEMENT
    ================================================================

Keep Note behavior in existing:

server/services/leadService.js

unless actual implementation reveals a concrete cohesion problem.

Expected additions:

validateNote

noteFrom

createLeadNote

listLeadNotes

Do not create a generic comments service.

Do not create another Firestore/test seam merely for Notes.

================================================================
20. PORTAL API
    ================================================================

Extend:

platform/apps/portal/lib/leads.ts

with:

LeadNote
LeadNoteListResponse
getLeadNotes
addLeadNote

Reuse:

apiGet
apiSend

No new network layer.

================================================================
21. PORTAL NOTES COMPONENT
    ================================================================

Add a focused component expected:

LeadNotes.tsx

Integrate into Lead Detail.

Display:

Internal Notes

existing Notes

textarea

Add Note button

No:

edit
delete
modal
drawer
new page architecture

Textarea:

maxLength=2000

Blank input cannot submit.

Disable while saving.

On success:

insert returned Note locally

Do NOT refetch the Notes list solely to display the new Note.

================================================================
22. LAZY LOADING
    ================================================================

Businesses list:

ZERO Note requests.

Leads Inbox:

ZERO Note requests.

Only after a Lead is selected may Notes load.

Keep Notes as a separate resource:

do NOT add Notes to LeadDetail.

================================================================
23. PARALLELISM — CORRECTION
    ================================================================

Fetching Lead Detail and Notes in parallel is desirable ONLY if it naturally
fits the existing BusinessLeads component structure.

Do NOT restructure the Step 1.16 detail/status state machine merely to force
parallel requests.

Required behavior is:

Lead selected
-> Notes become eligible to fetch

Notes load failure
-> Lead Detail/status remains usable

Notes remain independent from LeadDetail API.

If the current component tree naturally starts both GETs concurrently, do so.

If LeadNotes naturally mounts after Lead Detail becomes ready, that is
acceptable for Step 1.17.

Correctness/isolation is more important than forced parallelism.

================================================================
24. NOTES ERROR ISOLATION
    ================================================================

Notes own separate:

load state
add state
error state

GET failure:

Unable to load notes.
Retry

Lead Detail/status must remain functional.

POST failure:

inline Notes error only.

Do not destroy selected Lead state.

Do not interfere with:

selectedStatus
expectedUpdatedAt
409 Refresh Lead

================================================================
25. CACHE CONTROL
    ================================================================

GET Notes:

Cache-Control: no-store

POST Note:

Cache-Control: no-store

Reuse existing noStore route middleware.

Do not alter global caching.

================================================================
26. PUBLIC BOUNDARY
    ================================================================

There must remain NO public Note API.

Do NOT add:

GET /public/.../notes

POST /public/.../notes

Public Lead form remains completely unchanged.

================================================================
27. FAKEDB
    ================================================================

Claude verified FakeDb already supports:

orderBy
limit
transaction.get
transaction.set

No FakeDb changes expected.

Do not weaken production query/transaction behavior to accommodate tests.

================================================================
28. TESTS — VALIDATION
    ================================================================

Cover:

valid Note

text trimming

missing text

blank text

non-string text

>2000

unknown request properties excluded

client id ignored

client createdAt ignored

client createdByUserId ignored

================================================================
29. TESTS — CREATE
    ================================================================

Cover:

server UUID

server createdAt

createdByUserId from actor argument/session

tenant-scoped Note path

missing tenant

missing Lead

Lead document byte-for-byte unchanged after Note creation

status unchanged

createdAt unchanged

updatedAt unchanged

Only Note document is written.

================================================================
30. TESTS — TRANSACTION DATA
    ================================================================

If current test seams make this practical, verify the created Note's timestamp
is generated once per service call rather than from inside transactional retry
logic.

At minimum structure the implementation so noteId/createdAt/note are all
constructed outside runTransaction.

Do not build a fake retry framework merely for this assertion.

================================================================
31. TESTS — LIST
    ================================================================

No Notes

one Note

multiple Notes:

API newest-first

51 Notes:

50 returned
hasMore true

50 Notes:

hasMore false

approved fields only

unknown property excluded

malformed Note skipped

invalid createdAt skipped

tenant isolation

Lead isolation

================================================================
32. TESTS — AUTHORIZATION
    ================================================================

GET and POST:

unauthenticated -> 401

non-member -> 403

STAFF -> allowed

ADMIN -> allowed

OWNER -> allowed

PLATFORM_ADMIN -> allowed

cross-tenant member -> 403

Explicitly prove STAFF POST -> 201.

================================================================
33. TESTS — CACHE
    ================================================================

Assert no-store on at least:

successful GET Notes

successful POST Note

if current route tests make that cheap.

================================================================
34. TESTS — STATUS INTERACTION
    ================================================================

Lead.updatedAt = X

create Note

assert Lead.updatedAt remains X

then:

updateLeadStatus(
...,
expectedUpdatedAt: X
)

Expected:

success

This proves Notes do not invalidate Lead status concurrency.

================================================================
35. TESTS — PUBLIC BOUNDARY
    ================================================================

Where practical assert no public Note read/write route exists.

Step 1.14 public Lead creation tests remain unchanged and green.

================================================================
36. VERIFY
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

Everything from Steps 1.14-1.16 must remain green.

================================================================
37. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Existing Lead.

1. Portal -> Leads -> Lead Detail.

2. Verify Notes do not load before Lead selection.

3. Initial:

No notes yet.

4. Add:

Called customer, left voicemail.

Expected:

appears immediately
author = You

5. Firestore:

tenants/{tenantId}/leads/{leadId}/notes/{noteId}

contains ONLY:

text
createdAt
createdByUserId

No:

id
tenantId
leadId
client timestamps

6. Add second Note.

Expected UI:

oldest first
newest appended at bottom.

7. Reload detail.

Notes persist.

8. Verify parent Lead before/after Note:

status unchanged
createdAt unchanged
updatedAt unchanged

9. Concurrency independence:

load Lead at version X

add Note

save a status change using X

Expected:

success

10. If another user's Note is available, verify display:

Team member

rather than raw user id.

11. Notes load/add failure should not affect Lead status controls.

12. Public Lead form remains unchanged.

13. Confirm only bakerrang-dev changed.

================================================================
38. FUTURE ACTIVITY
    ================================================================

Do not implement status audit events now.

Future Activity may combine:

Lead Notes

and:

STATUS_CHANGED events

chronologically.

The Note schema already supports this without modification:

text
createdAt
createdByUserId

Actor attribution for future status events can be designed when Activity is
actually introduced.

================================================================
39. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Note model.
4. Note ID strategy.
5. Actor attribution.
6. Authorization.
7. Validation.
8. POST route.
9. GET route.
10. Parent validation.
11. Transaction/retry behavior.
12. Lead.updatedAt behavior.
13. Status-concurrency interaction.
14. Query/bound.
15. API/UI ordering.
16. malformed Note behavior.
17. Author display.
18. Portal lazy loading.
19. Notes UI.
20. Error isolation.
21. Cache behavior.
22. Public boundary.
23. Tests.
24. Backend results.
25. Platform results.
26. Manual DEV verification if performed.
27. Deviations and why.
28. Anything influencing future Lead Activity.

Do not implement beyond Step 1.17.