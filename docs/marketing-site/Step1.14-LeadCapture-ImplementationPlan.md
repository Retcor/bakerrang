Implement Step 1.14 — Lead Form + Secure Lead Capture.

Claude Code inspected the actual repository and produced an approved
implementation plan.

Follow Claude's repository findings and plan, with the corrections below
taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Implement the first anonymous visitor → tenant business-data flow:

Published Contact leadForm CTA
->
public lead-form page
->
anonymous submission
->
Express API
->
tenants/{tenantId}/leads/{leadId}

No CRM UI yet.

================================================================
1. CONTACT ACTION
   ================================================================

Extend ContactAction with:

{
type: 'leadForm'
}

No value.

Existing actions remain unchanged:

email
phone
url

Backend Contact validation must accept leadForm and normalize it to exactly:

{
type: 'leadForm'
}

Ignore/drop supplied value or arbitrary extra fields for leadForm.

Persist no tenant ID or URL in the action.

================================================================
2. PUBLISHED CONFIGURATION IS WRITE AUTHORITY
   ================================================================

Anonymous lead submission is allowed ONLY when the NORMAL PUBLISHED snapshot:

- is valid and currently PUBLISHED
- has Home
- has canonical Contact
- Contact.action.type === 'leadForm'

Do NOT authorize based merely on:

tenant existence
working copy
preview copy
config existence

All ineligible public states return:

404 Site not found

Do not expose lifecycle details.

================================================================
3. PREVIEW DOES NOT ENABLE WRITES
   ================================================================

ALLOW_DRAFT_PUBLIC_SITES may allow the admin to VIEW the working leadForm CTA
and lead-form page.

It must NEVER enable anonymous POST.

Expected:

working leadForm
published email/phone/url

DEV preview:
form can be viewed

POST:
404 until Republish

This must be covered by tests.

================================================================
4. PUBLISHED-SITE READER
   ================================================================

Extract/export a published-only helper only if it cleanly fits the actual
siteService implementation.

Expected concept:

getPublishedSiteDefinition(tenantId)

It must:

- ignore preview flags
- validate current PUBLISHED config
- read published/current
- fail closed consistently
- return sanitized published SiteDefinition

getPublicSite normal mode may delegate to it.

DEV preview behavior must remain unchanged.

Do not alter publish/unpublish architecture.

================================================================
5. LEAD FIRESTORE MODEL
   ================================================================

Store:

tenants/{tenantId}/leads/{leadId}

Document:

{
name,
email?,
phone?,
message,
status: 'NEW',
source: 'WEBSITE',
createdAt,
updatedAt
}

createdAt === updatedAt at creation.

Do NOT redundantly store tenantId.

Do NOT store:

client id
client status
client source
client timestamps
honeypot
IP address

No notes, assignment, history, or CRM fields yet.

================================================================
6. LEAD ID
   ================================================================

Server-generated only.

Use:

node:crypto randomUUID()

if consistent with the implemented repository.

Do not read client-supplied id.

Do not return the lead id publicly.

================================================================
7. LEAD SERVICE
   ================================================================

Add a dedicated:

server/services/leadService.js

Preferred public operation:

createPublicLead(tenantId, input)

NOT:

createPublicLead(tenantId, input, meta)

Do not pass req.ip into the lead service.

The service owns:

published leadForm eligibility
honeypot handling
lead validation
server-owned persistence

HTTP-only concerns remain outside.

Use the existing _setDb test style if appropriate.

================================================================
8. SHARED CONTACT-METHOD VALIDATION
   ================================================================

Email and phone rules now have a second backend consumer.

Extract the actual Step 1.13 backend validation rules into a small pure module,
conceptually:

server/validation/contactMethods.js

Expose only genuinely useful pieces such as:

EMAIL_MAX
PHONE_MAX
isValidEmail
dialDigits
isValidPhone

Refactor Contact validation to use them without changing Step 1.13 behavior.

Lead validation must use the SAME backend rules.

No generic validation framework.

Do not make frontend packages import a server module.

================================================================
9. LEAD VALIDATION
   ================================================================

Name:

required string
trim
1..120

Errors:

Lead name is required
Lead name must be 120 characters or fewer

Email:

optional
string
trim
max 254
same backend validation as Contact email

If supplied invalid:

Lead email is invalid

Phone:

optional
string
trim
max 50
same backend validation as Contact phone

If supplied invalid:

Lead phone is invalid

At least one valid:

email OR phone

required.

Error:

A phone number or email address is required

Message:

required string
trim
1..2000

Errors:

Lead message is required
Lead message must be 2000 characters or fewer

Reconstruct storage from approved fields only.

Arbitrary input properties are ignored.

================================================================
10. HONEYPOT
    ================================================================

Form includes one visually-hidden text honeypot:

website

Use:

autocomplete="off"
tabIndex={-1}
aria-hidden

Do not use type="hidden".

Server check must be defensive:

typeof input?.website === 'string'
&& input.website.trim().length > 0

If filled:

- eligibility must already have been checked
- do NOT persist a lead
- return the normal success result
- skip normal lead validation

Do not call trim blindly on arbitrary runtime types.

Do not store honeypot content.

Do not use honeypot as the only defense.

================================================================
11. PRIVACY
    ================================================================

Do not log:

name
email
phone
message
honeypot contents

Do not store visitor IP.

If logging honeypot suppression:

tenantId
result category
timestamp

only.

PII lead data is intentionally stored as ordinary tenant business data, not
vault-style zero-knowledge data.

Do not introduce encryption architecture in this milestone.

================================================================
12. PUBLIC ROUTE
    ================================================================

Add:

POST /public/sites/:tenantId/leads

Anonymous.

No:

session requirement
tenant membership
PLATFORM_ADMIN
CSRF token

Use a dedicated public-lead router if consistent with Claude's inspected repo.

Do not mount behind authenticated tenant routes.

Response success:

201

{
"success": true
}

Do not return:

lead id
path
status
tenant details

================================================================
13. CSRF — OVERRIDE CLAUDE
    ================================================================

DO NOT add a blanket:

req.path.startsWith('/public/')

CSRF exemption.

The existing middleware already skips CSRF when:

req.isAuthenticated() === false

Keep that behavior.

The public LeadForm browser request must explicitly use:

credentials: 'omit'

so an API session cookie is never intentionally sent with public lead
submission.

This keeps the request anonymous and avoids weakening CSRF rules for any future
authenticated route accidentally placed under /public.

If actual repo behavior demonstrates an unavoidable problem with this, report
it before changing the global CSRF policy.

================================================================
14. BROWSER CORS — REQUIRED CORRECTION
    ================================================================

This milestone introduces the first browser-side request from the public site
renderer to the Express API.

Existing public-site reads are server-side and do not prove browser CORS.

Inspect the existing API CORS configuration.

Explicitly allow the current public renderer origin using the repository's
existing domain/env configuration pattern.

Preferred concept if no equivalent exists:

SITE_RENDERER_DOMAIN

Examples:

DEV:
http://localhost:3002

production later:
public renderer origin

Do NOT use '*' with credentials.

The public lead POST itself uses credentials:'omit'.

Because Content-Type application/json can trigger a browser preflight, ensure
OPTIONS/CORS behavior succeeds for the configured renderer origin.

Do not implement arbitrary future custom-domain CORS discovery yet.

Document that custom-domain work will later need to extend the public-origin
policy.

Add/update .env.example documentation as needed.

================================================================
15. PUBLIC LEAD RATE LIMITER
    ================================================================

Use a route-specific write limiter.

Do NOT put it on all /public site reads.

Target policy:

approximately 10 submissions
per hour
per client
per tenant

BUT:

inspect the installed express-rate-limit version before implementing the
keyGenerator.

Do NOT blindly key using raw:

`${req.ip}:${tenantId}`

if the installed library provides an IPv6-safe normalization/key helper.

Use the library-supported IP normalization mechanism where available and
combine it with tenantId safely.

If the installed version cannot safely support custom IP+tenant composition,
prefer a correct/default IP limiter over an unsafe IPv6-bypassable custom key.

Do not disable library safety validation merely to silence a warning.

The limiter must run before lead eligibility/persistence work.

================================================================
16. RATE LIMITER SCOPE / HONESTY
    ================================================================

If the limiter uses express-rate-limit's default in-memory store:

document/report that the quota is PER PROCESS / PER CLOUD RUN INSTANCE.

Do not describe 10/hour as a globally enforced distributed quota.

That best-effort limiter is acceptable for Step 1.14 together with:

strict validation
honeypot
published eligibility

Do not add Redis/Firestore rate-limit storage now.

A distributed limiter can be revisited when traffic/deployment warrants it.

================================================================
17. CLOUD RUN IP ASSUMPTION
    ================================================================

Current trust proxy behavior may be used only as supported by the actual repo.

Do not change trust proxy to a permissive value solely for this endpoint.

Do not claim local DEV testing proves Cloud Run req.ip behavior.

Report Cloud Run client-IP verification as a production/deployment check if it
cannot be proven locally.

Do not persist/log IP merely to verify this feature.

================================================================
18. REQUEST BODY SIZE — REQUIRED
    ================================================================

Inspect the current Express JSON-body parser configuration.

Anonymous lead requests must have a bounded JSON request size.

If the existing global parser already has a reasonable explicit/default bound:

reuse it and REPORT the effective bound.

If it is too large or unbounded:

add the smallest safe lead-specific bound possible without breaking unrelated
BakerRang endpoints.

A target around 16 KB is more than sufficient for legitimate lead input.

Do NOT lower a global body limit if that risks unrelated existing features.

Do not add complexity if the existing parser already provides an appropriate
bound.

================================================================
19. PUBLIC ROUTE SERVICE BOUNDARY
    ================================================================

HTTP layer owns:

tenant route param
rate limiting
CORS
req.ip use for limiter only
HTTP statuses

Lead service owns:

published eligibility
honeypot decision
validation
persistence

Renderer owns:

form UX

Firestore is accessed ONLY by Express.

Renderer remains Firestore-free.

================================================================
20. CONTACT SHARED COMPONENT
    ================================================================

Keep @bakerrang/site-components framework-light.

Contact should gain something conceptually like:

leadFormHref?: string

For:

email
phone
url

continue using existing contactHref behavior.

For:

leadForm

use leadFormHref if supplied.

If missing:

render no CTA link rather than constructing an invalid destination.

LeadForm internal link must NOT open a new tab.

Do not import Next routing into the shared package.

================================================================
21. SECTION RENDERER
    ================================================================

The renderer app may know route context.

For Contact leadForm:

derive:

/site/${encodeURIComponent(tenantId)}/contact

today.

Pass the derived href into the shared Contact component.

Do not persist this URL.

Future custom domain routing may derive:

/contact

instead without changing Contact content.

================================================================
22. PUBLIC LEAD-FORM PAGE
    ================================================================

Add a dedicated route:

/site/[tenantId]/contact

The server component:

- fetches public site through existing public-site API
- respects DEV preview for VIEWING
- finds Home
- finds canonical Contact
- requires action.type === 'leadForm'
- otherwise notFound()

Then render the client LeadForm.

Do not build a modal.

Do not build a general routing/page framework.

================================================================
23. LEAD FORM
    ================================================================

Fields:

Name
Email
Phone
Message

Honeypot:
website

Accessibility:

real labels
type=email
type=tel
autocomplete attributes
disabled Submit while pending
clear error state

Require:

name
message
email OR phone

Client validation mirrors obvious rules for UX.

Server remains authoritative.

No address/service/file upload yet.

================================================================
24. PUBLIC BROWSER API CLIENT
    ================================================================

Add the smallest browser-facing lead submission helper.

It may use:

NEXT_PUBLIC_SITE_API_BASE_URL

if direct browser → Express remains the cleanest implementation.

It MUST:

- POST JSON
- use credentials:'omit'
- handle 201
- handle 400
- handle 404
- handle 429
- handle generic failure

Do not expose raw internal server errors.

404 user message:

This form isn't accepting submissions yet.

429 user message:

Too many attempts. Please try again later.

Generic:

Something went wrong. Please try again.

Follow existing user-facing tone/style where appropriate.

================================================================
25. CORS TEST / VERIFICATION
    ================================================================

Because this is new browser behavior, verify configured renderer-origin CORS.

Where practical:

- configured renderer origin receives appropriate CORS response
- JSON POST preflight succeeds
- disallowed origin does not gain unintended privileged behavior

Do not add a huge CORS testing framework if current tests cannot express it.

The manual DEV E2E MUST exercise the browser submission rather than only
curl/server tests, because that is what will expose CORS mistakes.

================================================================
26. CONTACT EDITOR
    ================================================================

Add:

Lead Form

as a Contact Action Type.

When selected:

hide Action Value

Submit exactly:

{
type: 'leadForm'
}

Do not send:

value: ''

Existing Email / Phone / URL editing remains unchanged.

================================================================
27. PUBLISHING
    ================================================================

No publish-service changes expected.

leadForm is ordinary Contact content.

Working edit:

must not affect public action.

Republish:

publishes leadForm action.

Changing published Contact away from leadForm:

must disable old direct form submissions after Republish.

================================================================
28. TESTS — CONTACT ACTION
    ================================================================

Test:

leadForm accepted
leadForm requires no value
supplied value dropped
extra fields dropped
email unchanged
phone unchanged
url unchanged

Snapshot:

working leadForm does not affect public before Republish

Republish publishes leadForm.

================================================================
29. TESTS — LEAD VALIDATION
    ================================================================

Cover:

valid name + email + message

valid name + phone + message

both contact methods

missing name

missing both email and phone

invalid email

invalid phone

missing message

message too long

trimming

arbitrary fields dropped

client status ignored

client source ignored

client createdAt ignored

client updatedAt ignored

client id ignored

================================================================
30. TESTS — ELIGIBILITY
    ================================================================

Cover:

missing site -> 404

DRAFT -> 404

PUBLISHED no Contact -> 404

PUBLISHED Contact email -> 404

PUBLISHED Contact phone -> 404

PUBLISHED Contact url -> 404

PUBLISHED Contact leadForm -> allowed

working leadForm + published non-leadForm -> 404

preview=true does NOT authorize write

published leadForm + working changed away without republish:
still allowed because PUBLIC authority is the currently published snapshot

after Republish away from leadForm:
denied

That last pair is important: submission authority follows exactly what is
currently live, not what is currently being edited.

================================================================
31. TESTS — HONEYPOT
    ================================================================

Published leadForm site.

Filled string honeypot:

201 success
NO lead written

Blank/whitespace honeypot:

normal validation/persistence path

Malformed non-string honeypot:

must not throw

Do not accidentally persist honeypot.

================================================================
32. TESTS — PERSISTENCE
    ================================================================

Verify:

tenant-scoped path

server-generated UUID

name trimmed

email/phone optional

message trimmed

status NEW

source WEBSITE

createdAt

updatedAt === createdAt

no tenantId field

no IP

no arbitrary input fields

================================================================
33. TESTS — ROUTE
    ================================================================

Anonymous request works.

No session required.

No CSRF token required when anonymous.

201 returns only:

{ success: true }

Validation 400.

Eligibility 404.

Rate limiter wired route-only.

Do not create brittle timer-heavy tests.

================================================================
34. SNAPSHOT / WRITE AUTHORITY TEST
    ================================================================

Mandatory lifecycle:

1. Published Contact A = email.
2. Working Contact becomes leadForm.
3. Preview shows lead form.
4. POST denied.

5. Republish leadForm.
6. POST allowed.
7. Lead persisted.

8. Working Contact becomes phone.
9. POST remains allowed because published leadForm is still live.

10. Republish phone.
11. POST denied.

This explicitly proves write authority follows the PUBLISHED snapshot.

================================================================
35. VERIFY
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

Everything must remain green.

================================================================
36. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev

Use a PUBLISHED test site.

1. Edit Contact:
   Action Type = Lead Form

2. Save working.

3. Normal public:
   old published action.

4. DEV preview:
   leadForm CTA appears and opens the form page.

5. Submit BEFORE Republish.

Expected:
"This form isn't accepting submissions yet."

No lead written.

6. Republish.

7. Normal public CTA opens Lead Form.

8. Submit:

name
email or phone
message

Expected:
success confirmation.

9. Inspect:

tenants/{tenantId}/leads/{leadId}

Verify:

status NEW
source WEBSITE
createdAt == updatedAt
only approved fields
no tenantId
no IP

10. Submit invalid data.

Expected:
useful validation feedback.

11. Double-click Submit.

Expected:
pending disabled guard prevents duplicate from one interaction.

12. Verify browser network request succeeds with CORS/preflight from the
    configured renderer origin.

13. Edit published Contact away from leadForm but DO NOT Republish.

Old form should still submit because published leadForm is still live.

14. Republish the non-leadForm Contact.

Old form URL:
no longer accepts submissions.

15. Confirm only bakerrang-dev changed.

================================================================
37. OUT OF SCOPE
    ================================================================

Do not implement:

Leads Inbox

lead detail UI

status editing

assignment

notes

follow-up

notifications

email sending

SMS

CAPTCHA

Turnstile

reCAPTCHA

file upload

address

service selection

idempotency

deduplication

distributed rate-limit store

analytics

custom-domain CORS policy

custom domains

SEO

visual redesign

================================================================
38. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Contact leadForm schema.
4. Published eligibility implementation.
5. Preview/write-authority behavior.
6. Lead Firestore shape.
7. ID strategy.
8. Shared validator extraction.
9. Lead validation.
10. Honeypot behavior.
11. Public route.
12. CSRF behavior.
13. Browser credentials behavior.
14. CORS configuration/change.
15. Effective request body-size limit.
16. Rate-limit strategy.
17. Whether rate limiting is process-local or distributed.
18. Lead service boundary.
19. Public form page.
20. Shared Contact integration.
21. Portal ContactEditor changes.
22. Tests.
23. Backend results.
24. Platform typecheck/lint/build.
25. Manual DEV E2E if performed.
26. Any Cloud Run client-IP behavior that still requires deployment
    verification.
27. Deviations and why.
28. Anything influencing Step 1.15 Leads Inbox.

Do not implement beyond Step 1.14.