Implement Step 1.6 — Business Management.

Claude Code has inspected the current repository and produced an approved
implementation plan.

Follow Claude's repository findings and implementation plan, with the
clarifications below taking precedence.

Do not expand scope.

============================================================
GOAL
============================================================

An authenticated PLATFORM_ADMIN using the BakerRang portal must be able to:

1. View every tenant as a user-facing "Business".
2. See loading / empty / success / forbidden / error states.
3. Create a Business by entering only its name.
4. Immediately see the created Business in the list.
5. Refresh and see the Business persisted from Firestore.

Use the existing backend tenant API.

No backend feature expansion is expected.

============================================================
DEV ENVIRONMENT
============================================================

All manual/local testing must use:

FIRESTORE_PROJECT_ID=bakerrang-dev

The developer's user in the bakerrang-dev Firestore database must contain:

platformRole = "PLATFORM_ADMIN"

Do not use or modify production Firestore data.

============================================================
TERMINOLOGY
============================================================

Backend:

Tenant

Portal:

Business

Do NOT rename:

/tenants

or:

tenants/{tenantId}

The UI translation is intentional.

============================================================
EXISTING API — USE AS-IS
============================================================

GET /tenants

Authorization:
PLATFORM_ADMIN

Success:
200 with a BARE JSON ARRAY:

[
{
id,
name,
status,
createdAt,
updatedAt,
createdByUserId
}
]

Empty:

[]

POST /tenants

Authorization:
PLATFORM_ADMIN

Body:

{
"name": "Business Name"
}

Success:
201 with the created tenant object.

Do not create a new /businesses API.

============================================================
1. SHARED PORTAL API CLIENT
   ============================================================

Add:

platform/apps/portal/lib/api.ts

Create the smallest reusable HTTP foundation needed by current and future
portal features.

It should provide concepts equivalent to:

ApiError

apiBaseUrl()

apiGet<T>(path)

apiSend<T>(
method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
path,
body?
)

Responsibilities:

- NEXT_PUBLIC_API_BASE_URL
- credentials: 'include'
- JSON request bodies
- JSON response parsing
- HTTP error representation
- CSRF handling for unsafe methods

Do not add Axios.

Do not add a server-state library.

============================================================
2. API ERRORS
   ============================================================

Provide a typed error concept such as:

ApiError

containing at minimum:

status
body

Its message may use:

body.error

when the returned body safely contains a string error message.

Do not expose raw HTML/server internals to the UI.

If a response is not JSON, handle it safely rather than allowing JSON parsing
to obscure the real HTTP status.

============================================================
3. CSRF
   ============================================================

Reuse:

GET /auth/csrf

for unsafe methods.

apiSend should:

1. Obtain/cache a CSRF token.
2. Include:

   x-csrf-token

3. Send session credentials.

If an unsafe request receives 403:

- invalidate the cached CSRF token
- fetch a fresh token
- retry the original request EXACTLY ONCE

If the retry also receives 403:

- stop
- throw ApiError

DO NOT recursively retry.
DO NOT loop.

This one-retry behavior exists because current backend 403 responses may
represent either stale CSRF or actual authorization denial.

============================================================
4. AUTH REFACTOR
   ============================================================

Refactor:

platform/apps/portal/lib/auth.ts

only enough to reuse:

apiBaseUrl()
apiSend()

Logout should use the shared apiSend logic.

Preserve all existing Step 1.5 behavior:

- login is browser navigation
- fetchAuth() treats 401 as anonymous
- auth states remain loading / anonymous / authenticated
- POST logout remains CSRF protected

Do not expose PLATFORM_ADMIN in auth state.

============================================================
5. BUSINESS API MODULE
   ============================================================

Add:

platform/apps/portal/lib/businesses.ts

or the equivalent small feature data module.

Define:

Business

matching the ACTUAL tenant response:

{
id: string
name: string
status: string
createdAt: number
updatedAt: number
createdByUserId: string
}

Provide:

listBusinesses()

using:

GET /tenants

and:

createBusiness(name)

using:

POST /tenants

Do not invent response envelopes.

============================================================
6. BUSINESS FEATURE COMPONENTS
   ============================================================

Use the small feature structure Claude proposed.

Approximately:

platform/apps/portal/app/businesses/
BusinessManager.tsx
BusinessList.tsx
CreateBusinessForm.tsx

Do not create unnecessary architecture.

Responsibilities:

BusinessManager
- owns list loading/state
- handles retry
- handles new-business insertion
- handles forbidden/error states

BusinessList
- presentational business list
- empty-state rendering

CreateBusinessForm
- controlled business name
- validation
- submit state
- creation errors

============================================================
7. BUSINESS LIST STATES
   ============================================================

Support:

LOADING
EMPTY
SUCCESS
FORBIDDEN
ERROR

LOADING:

Show a simple loading state.

EMPTY:

Show:

No businesses yet.

Create your first business to get started.

and the create form/action.

SUCCESS:

Display businesses.

At minimum display:

name
status
createdAt

The formatting may be simple.

FORBIDDEN:

GET /tenants returns 403.

Show something equivalent to:

Your account does not have access to platform administration.

Do NOT render the create form.

Do NOT infer platformRole in the browser.

ERROR:

Show a generic useful error state and Retry action.

Do not expose backend internals.

============================================================
8. CREATE BUSINESS
   ============================================================

Business creation accepts only:

Business Name

Client validation:

- required
- trim whitespace
- 1..200 characters

Backend remains authoritative.

While submitting:

- disable input
- disable submit
- prevent duplicate submission
- show a creating state

Submit:

POST /tenants

{
"name": "<trimmed name>"
}

On success:

- use the returned tenant object
- add/prepend it to the existing list
- reset the form
- clear previous form errors

Do NOT refetch unless implementation simplicity clearly favors it.

A browser refresh must still retrieve the persisted record from GET /tenants.

============================================================
9. SHARED INPUT COMPONENT — REQUIRED
   ============================================================

Add:

platform/packages/ui/src/Input.tsx

and export it from:

platform/packages/ui/src/index.ts

Input must be:

- generic
- reusable
- neutral
- token-styled
- accessible
- unaware of tenants/businesses

It may accept normal React input attributes.

Use it from CreateBusinessForm.

Do NOT add:

Card
Dialog
Modal
Form framework

in this milestone.

============================================================
10. UI TOKENS
    ============================================================

Use only semantic design tokens/utilities that actually exist in the current
@bakerrang/ui token system.

Do not reference invented classes/tokens such as:

bg-surface
border-border

unless those semantic tokens genuinely already exist or are deliberately added
as GENERIC design-system tokens.

Avoid expanding the token system merely to style this feature.

Simple neutral markup is sufficient.

============================================================
11. PORTAL PAGE
    ============================================================

Preserve Step 1.5 behavior.

Conceptually:

AUTH LOADING
-> existing loading UI

ANONYMOUS
-> existing Google sign-in UI

AUTHENTICATED
-> signed-in identity
-> Sign Out
-> BusinessManager

Do not move business data into AuthProvider.

============================================================
12. AUTHORIZATION
    ============================================================

Never request or infer:

PLATFORM_ADMIN

on the client.

The authorization boundary is:

GET /tenants

200:
admin access

403:
access denied

POST /tenants also remains protected by the API.

Do not work around authorization failures client-side.

============================================================
13. BACKEND
    ============================================================

Expected backend changes:

NONE

Do not add:

business endpoints
tenant update
tenant delete
listMyTenants
role endpoints
membership endpoints

If a genuine existing backend defect prevents Step 1.6 from functioning,
make only the smallest necessary correction and clearly report it.

Otherwise leave server/ unchanged.

============================================================
14. STATE MANAGEMENT
    ============================================================

Use normal React state/effects.

Do NOT add:

Redux
Zustand
TanStack Query
SWR

for this milestone.

============================================================
15. TESTING / STATIC VERIFICATION
    ============================================================

Do not introduce a large frontend test framework.

Run from platform:

npm run typecheck
npm run lint
npm run build

Existing site-renderer build must remain healthy as part of the workspace
build.

If server/ is unexpectedly modified, run its existing test suite too.

============================================================
16. MANUAL E2E
    ============================================================

Use DEV only:

FIRESTORE_PROJECT_ID=bakerrang-dev

Verify:

1. Start API.
2. Confirm startup identifies bakerrang-dev.
3. Start portal.
4. Login via Google.
5. Confirm authenticated portal.
6. Confirm GET /tenants succeeds.
7. If no tenants exist, confirm EMPTY state.
8. Enter a Business name.
9. Submit.
10. Confirm Creating state appears.
11. Confirm new Business appears immediately.
12. Refresh browser.
13. Confirm Business remains present.
14. Open bakerrang-dev Firestore.
15. Confirm:

tenants/{generatedId}

contains:

name
status: ACTIVE
createdAt
updatedAt
createdByUserId

16. Confirm no corresponding tenant was created in production.
17. Attempt blank/whitespace business name.
18. Confirm client blocks it.
19. Sign out.
20. Confirm logout still works using POST + CSRF.

Optional:

Use a non-PLATFORM_ADMIN account and verify the access-denied state.

============================================================
17. SCOPE
    ============================================================

Do not implement:

business edit
business delete
membership UI
invites
business profile
logo
branding
phone
email
address
service areas
services
CMS
site config
site renderer integration
preview websites
media
leads
domains
analytics
Google Business Profile
Instagram
billing
deployment

============================================================
18. FINAL REPORT
    ============================================================

Report:

1. Files added.
2. Files modified.
3. Shared API-client implementation.
4. CSRF caching/retry behavior.
5. Auth refactor.
6. Shared Input implementation.
7. Business feature components.
8. Business list states.
9. Create flow.
10. Whether backend changes were required.
11. Typecheck result.
12. Lint result.
13. Build result.
14. Manual E2E results if performed.
15. Confirmation DEV Firestore was used.
16. Any deviations and why.
17. Anything that should influence Step 1.7.

Do not implement beyond Step 1.6.