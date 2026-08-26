# Claude Code Assignment — Step 1.14 Lead Form + Secure Lead Capture

DO NOT modify code.

Step 1.13 is complete and manually verified against bakerrang-dev.

We now want the first public conversion flow that creates tenant-scoped
business data:

CONTACT CTA
->
LEAD FORM
->
PUBLIC SUBMISSION
->
TENANT LEAD RECORD

Do NOT build the CRM UI yet.

============================================================
1. GOAL
   ============================================================

Add a public lead form that can be selected as a Contact action.

Visitor flow:

Contact section
->
Request / Contact CTA
->
Lead form
->
Submit
->
lead persisted under the correct tenant
->
simple success confirmation

Keep this milestone focused on:

form rendering
validation
anonymous submission
secure tenant-scoped persistence
basic spam/abuse protections

Do NOT implement lead management UI yet.

============================================================
2. INSPECT CURRENT IMPLEMENTATION
   ============================================================

Inspect actual:

server/app.js
server/services/siteService.js
server/routes/tenants.js
server/routes/publicSites.js
server/middleware
server/config
server/test

platform/packages/site-schema/src/index.ts
platform/packages/site-components
platform/apps/site-renderer
platform/apps/portal
platform/apps/portal/lib/site.ts

Inspect Step 1.13 Contact implementation including:

ContactAction
Contact component
contactHref
ContactEditor
upsertHomeContact
public site API
rate limiting
CSRF behavior
auth middleware

Identify the correct place for an anonymous public write route.

============================================================
3. CONTACT ACTION EXTENSION
   ============================================================

Extend ContactAction with:

{
type: 'leadForm'
}

No value field unless the actual implementation demonstrates a concrete need.

Existing action members remain unchanged:

email
phone
url

Do not break stored Contact content.

Update validation so Contact action:

leadForm

is accepted.

No arbitrary extra fields.

============================================================
4. CONTACT RENDERER BEHAVIOR
   ============================================================

Determine the cleanest public UX for leadForm.

Preferred possibilities:

A. CTA links to a dedicated route such as:

/site/:tenantId/contact

or

B. CTA reveals an inline form

Evaluate the current Next renderer architecture.

Prefer the solution that:

- keeps the Contact section reusable
- avoids overloading Contact.tsx
- gives the form its own clear page/component boundary
- remains easy to deep-link
- works cleanly with future custom domains

My initial preference is a dedicated lead-form route/page.

Do not create a general page-builder routing system.

============================================================
5. FUTURE CUSTOM DOMAIN COMPATIBILITY
   ============================================================

The current renderer route includes tenantId.

Design the leadForm action so it does not permanently bake tenantId-specific
URLs into persisted Contact content.

The Contact action should remain semantic:

{
type: 'leadForm'
}

The renderer derives the correct destination.

Explain how this will later work under:

www.customer-domain.com

without changing persisted Contact content.

============================================================
6. LEAD FIRESTORE MODEL
   ============================================================

Evaluate tenant-scoped storage conceptually:

tenants/{tenantId}/leads/{leadId}

Recommend exact V1 shape.

Likely:

{
name,
email?,
phone?,
message?,
status: 'NEW',
source: 'WEBSITE',
createdAt
}

Consider whether to also store:

updatedAt

at creation for future CRM consistency.

Prefer server-generated lead ID.

Do NOT store tenantId redundantly inside the document unless there is a real
query/indexing reason.

Do NOT add assignment/notes/history yet.

============================================================
7. LEAD ID
   ============================================================

Server owns lead IDs.

Use the existing runtime-safe ID mechanism:

randomUUID()

or Firestore-generated ID if that fits repository conventions better.

Do not accept client-generated lead IDs.

Explain the choice.

============================================================
8. LEAD FORM FIELDS
   ============================================================

Initial form:

Name
Email
Phone
Message

Determine exact required/optional rules.

My preference:

Name:
required

Email:
optional

Phone:
optional

At least one of:
Email or Phone
required

Message:
required

Evaluate whether this is the best UX for local-service businesses.

Do not add:

address
budget
service selection
preferred time
file upload

yet.

============================================================
9. VALIDATION
   ============================================================

Recommend exact server-authoritative limits/messages.

Suggested:

name:
required string
trim
1..120

email:
optional string
trim
max 254
same pragmatic address validation used for Contact email action

phone:
optional string
trim
max 50
same phone validation philosophy used for Contact phone action

email OR phone:
at least one valid contact method

message:
required string
trim
1..2000

No HTML.

No rich text.

No arbitrary fields persisted.

============================================================
10. VALIDATION REUSE
    ============================================================

Inspect whether Step 1.13 email/phone validators are currently private inside
siteService.js.

If Lead validation needs the exact same rules, evaluate whether extracting a
small reusable validation utility is now genuinely justified.

Do NOT duplicate subtly different email/phone validation.

Do NOT build a generic validation framework.

Possible location:

server/services or server/utils

but ground this in the actual repo.

============================================================
11. PUBLIC SUBMISSION ENDPOINT
    ============================================================

Plan an anonymous route conceptually:

POST /public/sites/:tenantId/leads

or another route consistent with the existing public API.

It must NOT require:

session auth
PLATFORM_ADMIN
tenant membership
CSRF token

because it is used by anonymous site visitors.

It must still use:

public-specific rate limiting
strict validation
tenant/site visibility checks

Do not mount it accidentally behind authenticated tenant middleware.

============================================================
12. SITE ELIGIBILITY FOR LEAD SUBMISSION
    ============================================================

This is important.

Determine whether a lead may be submitted only when:

the tenant site is currently PUBLISHED

Preferred:

YES.

A hidden/unpublished tenant should not expose an active public lead endpoint.

The endpoint should fail closed similarly to public site reads.

DEV preview must NOT automatically mean anonymous lead submission is enabled
against an unpublished site unless explicitly justified.

I prefer public lead submission to require actual PUBLISHED status even during
DEV preview.

Evaluate this.

============================================================
13. DO NOT TRUST RENDERER STATE
    ============================================================

The POST route must independently verify the tenant/site eligibility.

Do not assume:

"the visitor could see the form, therefore the tenant is valid."

A caller can invoke the endpoint directly.

============================================================
14. PUBLIC INFORMATION LEAKAGE
    ============================================================

For:

missing tenant
site not initialized
DRAFT/unpublished site
invalid public site state

prefer a consistent public-safe response such as:

404 Site not found

rather than exposing internal lifecycle details.

Follow the current getPublicSite fail-closed convention where practical.

============================================================
15. RATE LIMITING
    ============================================================

Inspect existing public/tenant limiters.

Anonymous lead creation needs a write-oriented limiter separate from normal
site reads.

Recommend a conservative initial policy.

Consider:

per-IP limits

without creating a system that accidentally blocks all users because Cloud Run
or proxy headers collapse IPs.

Inspect how Express/trust proxy/current deployment handles req.ip before
proposing exact behavior.

Do not blindly reuse tenant-authenticated rate limits.

============================================================
16. HONEYPOT
    ============================================================

Evaluate adding one invisible honeypot field to the form, for example:

website

Human users leave it blank.

Bots that populate it are rejected or silently accepted-without-persisting.

Recommend the safer UX/security behavior.

Important:

Do not make honeypot the only abuse defense.

Do not introduce CAPTCHA yet.

============================================================
17. RESPONSE CONTRACT
    ============================================================

A successful anonymous submission should return minimal data.

Prefer:

201

{
"success": true
}

Do NOT return:

lead ID
Firestore path
tenant metadata
internal status

unless there is a concrete client need.

Avoid exposing unnecessary internal identifiers.

============================================================
18. DUPLICATE SUBMISSIONS
    ============================================================

Do not build complex deduplication yet.

However, evaluate browser double-submit protection:

frontend disables Submit while pending

server remains idempotency-unaware for V1 unless a concrete reason exists.

Do not add idempotency keys unless justified.

============================================================
19. LEAD SERVICE
    ============================================================

Create a dedicated service responsibility.

Prefer something conceptually like:

createPublicLead(tenantId, input)

Do NOT put lead persistence into siteService.js if that mixes unrelated
concerns.

Inspect current service organization and propose the correct module.

This is the first non-site tenant business-data domain.

============================================================
20. PUBLIC ROUTE ORGANIZATION
    ============================================================

Determine whether:

publicSites.js

should own the POST route or whether a small:

publicLeads.js

router is cleaner.

Prefer domain clarity without creating excessive files.

Explain the choice.

============================================================
21. FIRESTORE ACCESS
    ============================================================

Only the Express backend writes leads.

Site renderer must remain Firestore-free.

Portal must not write lead records directly.

Public form:

browser
->
Express public API
->
Firestore

Preserve this boundary.

============================================================
22. PUBLIC FORM PAGE / COMPONENT
    ============================================================

Plan the public form UI.

Fields:

Name
Email
Phone
Message

Submit button

Simple confirmation after success.

No visual redesign phase yet; use existing neutral design primitives/tokens.

Accessibility:

labels
correct input types
autocomplete attributes
disabled pending state
clear error messages

No modal framework unless clearly warranted.

============================================================
23. CLIENT VALIDATION
    ============================================================

Client validation may mirror obvious limits for UX.

Server remains authoritative.

Do not rely on HTML validation alone.

Do not expose internal server errors.

Handle:

400 validation
429 rate limit
generic server failure

with user-appropriate messages.

============================================================
24. LEADFORM CONTACT ACTION
    ============================================================

Update Contact rendering:

email
-> mailto

phone
-> tel

url
-> canonical URL

leadForm
-> internal lead form route

The renderer should derive the lead-form href from routing context, not store a
URL in ContactAction.

Evaluate whether Contact needs tenantId/path passed into it or whether the
SectionRenderer/page can provide a derived href.

Do NOT pollute the shared ContactContent schema with tenant routing data.

============================================================
25. SHARED COMPONENT BOUNDARY
    ============================================================

Contact.tsx currently owns action rendering.

Determine the smallest clean change to support semantic leadForm.

Potentially:

Contact receives a resolvedLeadFormHref prop

or similar.

Do not make @bakerrang/site-components depend on Next.js routing.

The shared component package should remain framework-light/reusable.

============================================================
26. CONTACT EDITOR
    ============================================================

Portal ContactEditor should gain:

Lead Form

as an Action Type option.

When selected:

no Action Value input is required.

Do not show a meaningless empty action value field.

Existing Email / Phone / Website URL behavior remains unchanged.

No form customization here.

============================================================
27. PUBLISHING
    ============================================================

No publication architecture change expected.

The Contact action:

{ type: 'leadForm' }

is just part of Contact content and should enter the snapshot normally on
Publish/Republish.

Verify through tests.

============================================================
28. PUBLIC FORM AVAILABILITY
    ============================================================

The lead form page must only render/use a tenant whose PUBLIC published site is
eligible.

Evaluate whether the renderer should fetch:

GET /public/sites/:tenantId

and ensure the published Contact action includes leadForm

before rendering the form.

Preferred behavior:

A visitor should not be able to navigate to an active generic lead form for a
tenant that does not have a published leadForm CTA.

Evaluate this carefully.

Potential policy:

Form is available only if the currently published site contains a Contact
section whose action.type === 'leadForm'.

This ties form exposure directly to published configuration.

Recommend whether that is worthwhile or overly restrictive.

============================================================
29. FORM SUBMISSION AUTHORIZATION
    ============================================================

Likewise evaluate whether POST should require the currently published site to
contain:

Contact.action.type === 'leadForm'

rather than merely site.status === PUBLISHED.

My preference:

YES.

That means an old/stale/direct form URL stops accepting submissions if the
business changes Contact from leadForm to phone/email/url and republishes.

No hidden lead endpoint should remain active unintentionally.

============================================================
30. DEV PREVIEW SEMANTICS
    ============================================================

Do not let:

ALLOW_DRAFT_PUBLIC_SITES=true

implicitly enable lead creation on an unpublished site.

Preview is for viewing content, not enabling anonymous writes.

Public lead submission should depend on normal published state.

Clarify how preview behaves when the working copy has leadForm but the
published snapshot does not yet.

Expected:

preview may SHOW the working leadForm CTA

but POST should remain unavailable until Republish.

If this creates confusing DEV UX, surface a controlled form message rather
than weakening production semantics.

============================================================
31. SPAM / ABUSE LOGGING
    ============================================================

Do not store full rejected spam submissions.

Do not log sensitive form content unnecessarily.

Recommend minimal operational logging:

tenantId
result category
timestamp/request metadata if already standard

Avoid logging message/email/phone bodies by default.

============================================================
32. TESTS — LEAD VALIDATION
    ============================================================

Cover:

valid name/email/message
valid name/phone/message
both email+phone valid
missing name
missing both contact methods
invalid email
invalid phone
message missing
message too long
field trims
arbitrary fields dropped
client-supplied status ignored
client-supplied createdAt ignored
client-supplied id ignored

============================================================
33. TESTS — PUBLIC ELIGIBILITY
    ============================================================

Cover:

missing tenant/site -> fail closed
DRAFT site -> no lead submission
PUBLISHED site without leadForm action -> no lead submission
PUBLISHED site with email Contact -> no lead submission
PUBLISHED site with phone Contact -> no lead submission
PUBLISHED site with URL Contact -> no lead submission
PUBLISHED site with leadForm Contact -> submission allowed
working leadForm but published non-leadForm -> submission denied
preview flag does not override submission eligibility

============================================================
34. TESTS — PERSISTENCE
    ============================================================

Verify stored lead:

server-generated ID
tenant-scoped path
status = NEW
source = WEBSITE
trimmed name
optional normalized/validated contact values
message
createdAt
updatedAt if chosen

Verify unapproved request properties do not survive.

============================================================
35. TESTS — RATE LIMIT / ROUTE
    ============================================================

Test route behavior where practical:

anonymous access works
no CSRF required
no session required
published eligibility enforced
201 minimal response
validation 400
rate-limit 429 behavior if current test infrastructure supports it

Do not introduce brittle timer-heavy tests merely for rate limiting.

============================================================
36. TESTS — CONTACT LEADFORM ACTION
    ============================================================

Verify:

Contact validation accepts leadForm
leadForm requires no value
extra action fields discarded
existing email/phone/url remain unchanged
Contact renderer produces internal lead-form href through the chosen prop/API
published snapshot retains leadForm
working change does not affect public until republish

============================================================
37. MANUAL DEV E2E
    ============================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Use a PUBLISHED test site.

1. Edit Contact:
   Action Type = Lead Form

2. Save working copy.

3. With normal public mode:
   published site still has old action.

4. DEV preview:
   working CTA points to lead form.

5. Attempt submission BEFORE Republish.

Expected:
submission rejected because public published configuration does not yet enable
leadForm.

6. Republish.

7. Normal public Contact CTA now opens lead form.

8. Submit:

name
email or phone
message

9. Success shown.

10. Inspect DEV Firestore:

tenants/{tenantId}/leads/{leadId}

11. Verify:

status NEW
source WEBSITE
server timestamps
only allowed fields

12. Submit obvious invalid form -> validation feedback.

13. Test double-click Submit does not create accidental frontend duplicate from
    one click interaction.

14. Change Contact action back to phone/email, Save + Republish.

15. Direct old lead form URL should now no longer accept submissions.

16. Confirm only bakerrang-dev changed.

============================================================
38. OUT OF SCOPE
    ============================================================

Do not plan:

CRM UI
lead list
lead detail page
lead assignment
lead status editing
notes
follow-up reminders
email notifications
SMS notifications
CAPTCHA
reCAPTCHA
Turnstile
file upload
address capture
service selection
quote calculator
idempotency system
lead deduplication engine
analytics
custom domains
SEO
UI redesign

============================================================
39. FUTURE STEP 1.15
    ============================================================

Explain how this lead storage model cleanly supports a future authenticated:

Leads Inbox

without changing the public submission contract.

Likely future operations:

GET tenant leads
GET lead detail
PATCH lead status

Do NOT implement them now.

============================================================
DELIVERABLE
============================================================

Return:

1. Current public/API architecture relevant to anonymous lead submission.
2. ContactAction leadForm schema change.
3. Lead Firestore model.
4. Lead ID strategy.
5. Lead validation.
6. Reuse/extraction of email/phone validators.
7. Anonymous POST route.
8. Route/middleware placement.
9. Site eligibility rules.
10. Published leadForm eligibility rule.
11. Preview semantics.
12. Rate limiting recommendation.
13. Honeypot recommendation.
14. Logging/privacy recommendation.
15. Lead service/module placement.
16. Public form route/page design.
17. Contact shared-component integration.
18. Portal ContactEditor change.
19. Response/error contract.
20. Files to add.
21. Files to modify.
22. Tests.
23. Verification commands.
24. Manual DEV E2E.
25. Concrete security/abuse risks.
26. Future Leads Inbox compatibility.
27. Anything this teaches us about tenant business-data architecture.
28. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.