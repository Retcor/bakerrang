# Claude Code Assignment — Step 1.15 Leads Inbox + Lead Detail

DO NOT modify code.

Step 1.14 is complete and manually verified against bakerrang-dev.

We now want the first authenticated consumer of the Lead business-data domain:

LEADS INBOX + LEAD DETAIL

This milestone is READ-ONLY.

Do NOT implement lead workflow mutations yet.

============================================================
1. GOAL
   ============================================================

Allow authorized portal users to:

- open a business's Leads area
- see recent leads newest-first
- open a lead
- see its complete submitted information

Conceptually:

Business
->
Leads
->
Recent Leads
->
Lead Detail

This closes the first visitor-to-business-user loop:

public visitor
->
lead submission
->
Firestore
->
authenticated business portal

============================================================
2. OUT OF SCOPE — IMPORTANT
   ============================================================

Do NOT implement:

lead status changes
lead notes
lead assignment
lead deletion
lead archiving
lead email sending
SMS
follow-up reminders
notifications
lead search
lead filters
pagination UI
lead export
analytics
CRM automation

Those belong in later milestones.

============================================================
3. INSPECT CURRENT IMPLEMENTATION
   ============================================================

Inspect actual:

server/services/leadService.js
server/routes/publicLeads.js
server/routes/tenants.js
server/app.js

server/middleware
server/test
server/test/helpers/fakeDb.js

platform/apps/portal
platform/apps/portal/lib/api.ts
platform/apps/portal/lib/site.ts

especially:

BusinessManager
BusinessWebsite
existing business-card/action layout
portal auth provider
current tenant API usage

Inspect the shipped Step 1.14 lead shape and persistence.

Document:

- Lead Firestore path
- exact stored fields
- current role middleware
- PLATFORM_ADMIN behavior
- tenant OWNER/ADMIN/STAFF authorization behavior
- FakeDb query capabilities
- Firestore SDK/query conventions already used in the repo
- current portal lazy-loading patterns

Ground the plan in the actual code.

============================================================
4. LEAD READ AUTHORIZATION
   ============================================================

Authenticated lead reads should be available to:

PLATFORM_ADMIN

and tenant:

OWNER
ADMIN
STAFF

This differs from lead-management operations we may add later.

For this read-only inbox, STAFF should be able to see incoming business leads.

Use the existing fresh-Firestore authorization model.

Do NOT put role claims into browser state.

Do NOT authorize solely from cached portal information.

============================================================
5. CROSS-TENANT ISOLATION
   ============================================================

Tenant A users must NEVER read Tenant B leads.

Lead ownership is structural:

tenants/{tenantId}/leads/{leadId}

The tenantId comes from the authorized route context.

Do not query a global leads collection.

Do not store/rely on a redundant tenantId field.

Tests must explicitly cover cross-tenant denial.

============================================================
6. LIST ENDPOINT
   ============================================================

Evaluate:

GET /tenants/:tenantId/leads

Preferred V1 response:

{
"leads": [
{
"id": "...",
"name": "...",
"email": "...",
"phone": "...",
"status": "NEW",
"source": "WEBSITE",
"createdAt": ...,
"updatedAt": ...
}
],
"hasMore": false
}

The list response should NOT need to include the full submitted message.

The message belongs in Lead Detail.

This reduces unnecessary PII/payload in the inbox listing.

Evaluate the exact summary shape against actual UI needs.

============================================================
7. BOUNDED QUERY — IMPORTANT
   ============================================================

Do NOT fetch an unbounded lead collection and sort it in Node merely because
the dataset is currently small.

Preferred V1 behavior:

- order by createdAt descending
- retrieve at most 51 docs
- expose only the first 50
- hasMore = true when the 51st exists

Conceptually:

orderBy('createdAt', 'desc')
limit(51)

Return:

50 summaries maximum.

If hasMore:

the portal may display:

"Showing the 50 most recent leads."

Do NOT implement cursor pagination yet.

============================================================
8. INSPECT FAKEDB BEFORE PLANNING QUERY CODE
   ============================================================

Inspect:

server/test/helpers/fakeDb.js

Determine whether it supports:

collection queries
orderBy
limit
query snapshots

If it already supports what production code needs:

reuse it.

If not:

recommend the SMALLEST faithful extension needed for:

orderBy(createdAt desc)
limit(51)

Do NOT weaken production code to:

get everything
sort in application memory

solely because FakeDb is limited.

The production query should be architecturally correct.

============================================================
9. FUTURE PAGINATION COMPATIBILITY
   ============================================================

We are deliberately deferring cursor pagination UI/API.

However, avoid a response shape that prevents adding it cleanly.

Preferred:

{
leads,
hasMore
}

A later milestone can add:

nextCursor

without breaking existing consumers.

Do NOT design or implement the cursor now.

Note:

ordering solely by createdAt is sufficient for the bounded recent-list V1.

A future cursor implementation may need a deterministic secondary document-id
ordering for timestamp ties.

Do NOT prematurely implement that unless the current Firestore API requires it
for this milestone.

============================================================
10. LEAD DETAIL ENDPOINT
    ============================================================

Plan:

GET /tenants/:tenantId/leads/:leadId

Authorized:

PLATFORM_ADMIN
OWNER
ADMIN
STAFF

Response should contain the complete approved lead model:

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

Do not expose unknown Firestore fields simply because they exist.

Construct/sanitize the response from approved fields.

============================================================
11. LEAD NOT FOUND
    ============================================================

Missing lead should return a controlled:

404

Lead not found

Do not expose Firestore path information.

Determine how nonexistent tenant vs nonexistent lead currently interacts with
the authorization middleware.

In particular:

PLATFORM_ADMIN may bypass membership.

Inspect whether service-level tenant existence verification is needed so:

nonexistent tenant

does not silently look like:

empty valid inbox

for PLATFORM_ADMIN.

Recommend the cleanest behavior grounded in the current middleware/service
architecture.

============================================================
12. LEAD SERVICE RESPONSIBILITY
    ============================================================

Extend the existing:

leadService.js

Do NOT create another service.

Likely operations:

listTenantLeads(tenantId)

getTenantLead(tenantId, leadId)

or names consistent with repository conventions.

Keep:

createPublicLead

in the same lead domain service.

Public creation and authenticated reads are different entry points into the
same Lead domain.

============================================================
13. PUBLIC LEAD API MUST REMAIN UNCHANGED
    ============================================================

Do NOT change:

POST /public/sites/:tenantId/leads

its response
published eligibility
honeypot
rate limit
CORS
request-size limit
CSRF behavior
lead persistence shape

Step 1.14 must remain fully backward compatible.

============================================================
14. PII / CACHE POLICY
    ============================================================

Authenticated lead endpoints return customer PII.

Evaluate setting:

Cache-Control: no-store

for authenticated lead list/detail responses.

Preferred:

YES.

Do not allow shared/intermediary caching of lead data.

Determine the cleanest route/middleware placement.

Do not globally disable caching for unrelated endpoints.

============================================================
15. LIST RESPONSE PRIVACY
    ============================================================

Keep the inbox summary intentionally minimal.

Preferred summary:

id
name
email?
phone?
status
source
createdAt
updatedAt

No full message.

No Firestore metadata.

No unknown future fields.

Lead Detail can contain message.

============================================================
16. SORTING
    ============================================================

Newest first:

createdAt DESC

Do not sort by updatedAt yet.

The inbox currently represents incoming leads, not workflow activity.

Future CRM views may later support:

recently updated
status filters
assigned to me

Out of scope now.

============================================================
17. MALFORMED LEGACY DATA
    ============================================================

Consider how list/detail should behave if a manually edited or malformed lead
document exists.

Do not build a migration framework.

At minimum:

- response construction should not spread arbitrary Firestore data
- one malformed optional field should not create cross-tenant leakage
- avoid crashing the whole inbox if a reasonable defensive mapping is easy

Recommend whether malformed records should:

be skipped
fail the request
or be sanitized

based on existing codebase conventions.

Keep this narrowly scoped.

============================================================
18. ROUTES
    ============================================================

Add authenticated tenant routes:

GET /tenants/:tenantId/leads

GET /tenants/:tenantId/leads/:leadId

Use existing:

authentication
tenant limiter
fresh role authorization

Do not place these under `/public`.

Do not require PLATFORM_ADMIN exclusively.

============================================================
19. AUTHORIZATION MIDDLEWARE
    ============================================================

Inspect the exact signature/use of:

requireTenantRole

and PLATFORM_ADMIN bypass behavior.

Use the existing mechanism correctly rather than inventing new role logic.

Required access:

PLATFORM_ADMIN
OWNER
ADMIN
STAFF

No browser-side authorization decisions.

============================================================
20. PORTAL DOMAIN API
    ============================================================

Add a new portal domain module, preferred:

platform/apps/portal/lib/leads.ts

Do NOT add Lead concerns to:

lib/site.ts

Define minimum types:

LeadSummary
LeadDetail
LeadListResponse

Functions conceptually:

getLeads(tenantId)
getLead(tenantId, leadId)

using the existing:

apiGet

credentials/include
403 retry/auth behavior

Do not create another request layer.

============================================================
21. PORTAL LEADS ENTRY POINT
    ============================================================

Inspect the actual Business UI.

Add the smallest clear Leads entry point for each business.

Potentially:

Manage Leads

or:

Leads

Do NOT redesign business cards or global navigation.

The Leads area should load lazily.

Do NOT fetch leads for every business when the Businesses page loads.

Avoid an N+1 lead-list query.

============================================================
22. PORTAL LAZY LOADING
    ============================================================

Follow the same philosophy as Website management:

initial Businesses page
->
no leads requests

user opens Leads
->
GET tenant leads

This is important if a PLATFORM_ADMIN later manages many businesses.

Do not eagerly load lead counts either.

No count badge yet.

============================================================
23. LEADS INBOX COMPONENT
    ============================================================

Plan a focused component, conceptually:

BusinessLeads.tsx

or a name consistent with current structure.

States:

not opened
loading
empty
success
error
forbidden

Display a compact recent-lead list.

Suggested visible fields:

Name
Email / Phone
Status
Received

Do not put the entire message into every row.

No polished CRM design yet.

Use existing UI tokens/components.

============================================================
24. LEAD DETAIL UX
    ============================================================

Click/select a lead to show detail.

Determine the smallest clean UX in the current portal structure.

Could be:

inline detail below/next to list

or:

replace inbox content with detail + Back

Do NOT introduce:

modal framework
drawer framework
new routing architecture

unless the existing portal already has a natural route pattern that makes a
dedicated page clearly simpler.

Prefer the smallest fit with the actual implementation.

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

============================================================
25. LEAD DETAIL FETCH
    ============================================================

Prefer fetching Lead Detail only when the user selects a lead.

Do NOT put full messages into the list response merely to avoid a second call.

This intentionally gives:

Inbox GET
->
small summaries

Select lead
->
Lead Detail GET

That is an acceptable and deliberate request pattern.

============================================================
26. PORTAL DATE DISPLAY
    ============================================================

Lead timestamps are server-created numeric epoch timestamps.

Keep transport values numeric.

Portal may render with the browser's locale/time zone.

Do not store formatted dates.

Do not convert Firestore values to presentation strings on the backend.

Handle malformed/missing timestamps defensively.

============================================================
27. STATUS DISPLAY
    ============================================================

For Step 1.15:

status is READ ONLY.

Existing status:

NEW

Display it as data.

Do not introduce a complete status enum/workflow yet unless the server already
has one.

Step 1.16 will define mutation semantics and likely the actual status model.

Do not let the portal PATCH status now.

============================================================
28. EMPTY STATE
    ============================================================

No leads should be a normal state.

Example:

No leads yet.

Do not present it as an error.

No onboarding wizard.

============================================================
29. HASMORE UX
    ============================================================

If:

hasMore === true

display a small informational message:

Showing the 50 most recent leads.

Do NOT add:

Load More
pagination buttons
infinite scroll

yet.

This makes the bounded-query limitation explicit rather than silently hiding
older data.

============================================================
30. ERROR HANDLING
    ============================================================

Follow existing portal API conventions.

401/auth state:
existing AuthProvider behavior

403:
appropriate access/forbidden state

404 lead detail:
Lead not found / return to inbox

500/network:
generic error + Retry where appropriate

Do not expose internal Firestore errors.

============================================================
31. NO PUBLIC LEAD READING
    ============================================================

There must be NO endpoint such as:

GET /public/sites/:tenantId/leads

Anonymous visitors must never read submitted leads.

Public API remains WRITE ONLY for the lead domain.

Tests should make this boundary obvious where practical.

============================================================
32. TESTS — LEAD SERVICE LIST
    ============================================================

Cover:

empty lead collection

one lead

multiple leads newest-first

maximum 50 returned

51 records -> 50 returned + hasMore true

50 records -> hasMore false

summary excludes message

summary contains approved fields only

unknown Firestore fields excluded

tenant-scoped collection path

============================================================
33. TESTS — LEAD DETAIL
    ============================================================

Cover:

existing lead returned

approved fields only

message returned

missing lead -> 404 Lead not found

lead from Tenant A cannot be returned through Tenant B path

optional email absent

optional phone absent

timestamps preserved numerically

============================================================
34. TESTS — AUTHORIZATION
    ============================================================

Route coverage:

unauthenticated -> 401

ordinary authenticated user without membership -> 403

STAFF -> 200

ADMIN -> 200

OWNER -> 200

PLATFORM_ADMIN -> 200

Cross-tenant member -> 403

Do this for list and detail where useful without meaningless duplication.

Use existing auth/fresh-Firestore test patterns.

============================================================
35. TESTS — TENANT EXISTENCE
    ============================================================

Based on your inspection of middleware/service behavior, cover the chosen
contract for:

nonexistent tenant

particularly for PLATFORM_ADMIN.

Do not allow a nonexistent tenant to masquerade as a legitimate empty business
if that conflicts with current tenant API semantics.

============================================================
36. TESTS — CACHE CONTROL
    ============================================================

If authenticated lead endpoints set:

Cache-Control: no-store

add a focused route assertion if current test infrastructure makes that easy.

Do not build a separate caching test framework.

============================================================
37. FAKEDB TEST SUPPORT
    ============================================================

If production list implementation requires missing FakeDb query behavior:

extend FakeDb minimally and faithfully.

Test the FakeDb extension through the Lead service tests.

Do not create a second fake query system inside leadService tests.

Do not change production architecture to accommodate the fake.

============================================================
38. MANUAL DEV E2E
    ============================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Use the lead created during Step 1.14 or submit one new test lead.

1. Portal -> Business.

2. Confirm Businesses initial load does NOT request leads.

3. Open Leads.

Expected:
one GET for the selected tenant.

4. Inbox shows newest lead.

Verify:

name
contact method(s)
status NEW
received time

5. Open the lead.

Expected:
detail GET occurs only now.

6. Detail shows:

name
email/phone
message
status
source
received
updated

7. Browser Network:

lead list/detail responses include no-store if implemented.

8. Verify STAFF access if a convenient DEV staff account exists.

If not, automated auth coverage is sufficient.

9. Verify a user from another tenant cannot access the endpoint if convenient.

Automated auth coverage remains authoritative.

10. Confirm only bakerrang-dev was read; no production changes.

============================================================
39. FUTURE STEP 1.16
    ============================================================

Explain how the chosen API/model supports the next milestone:

Lead Workflow

Likely:

PATCH /tenants/:tenantId/leads/:leadId

for controlled status changes.

Potential future fields:

status
notes/history
updatedAt

But do NOT implement them now.

Specifically identify whether:

status enum
optimistic concurrency
audit history
notes subcollection

should be decided in 1.16 rather than prematurely here.

============================================================
40. ARCHITECTURAL QUESTION
    ============================================================

Leads are our first authenticated tenant business-data read domain.

Based on the actual implementation, identify the pattern future domains should
follow:

public write
authenticated tenant read
tenant-scoped collection
domain service
sanitized summaries/details
lazy portal loading

Examples later could include:

reviews
bookings
messages

Do not generalize into a framework yet.

============================================================
DELIVERABLE
============================================================

Return:

1. Current Lead domain architecture.
2. Current tenant authorization behavior.
3. Recommended list endpoint.
4. Recommended detail endpoint.
5. Exact LeadSummary contract.
6. Exact LeadDetail contract.
7. Query/order/limit strategy.
8. FakeDb capability analysis.
9. `hasMore` design.
10. Tenant-existence behavior.
11. PII/cache policy.
12. Malformed-data policy.
13. Lead service additions.
14. Route additions + authorization.
15. Portal leads API module.
16. Lazy loading behavior.
17. Inbox component design.
18. Lead detail UX.
19. Files to add.
20. Files to modify.
21. Files explicitly unchanged.
22. Tests.
23. Verification commands.
24. Manual DEV E2E.
25. Concrete risks.
26. Future Step 1.16 compatibility.
27. What this establishes for future tenant business-data domains.
28. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.