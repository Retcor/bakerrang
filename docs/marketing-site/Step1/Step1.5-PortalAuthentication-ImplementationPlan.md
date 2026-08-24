Implement Step 1.5 — Portal Authentication.

Claude Code already inspected the repository and produced the Step 1.5
implementation plan.

Use Claude's repository findings and general implementation plan, BUT the
corrections in this assignment override Claude's plan wherever they differ.

Do not expand scope beyond portal authentication.

============================================================
GOAL
============================================================

Authenticate:

platform/apps/portal

against the existing:

server/

Express + Passport + Google OAuth + express-session + Firestore session
infrastructure.

Successful flow:

Portal anonymous
-> Sign in with Google
-> existing API OAuth
-> Google
-> API callback
-> return to portal
-> /auth/check
-> portal authenticated

Do not build tenant/business UI yet.

============================================================
CURRENT DOMAINS
============================================================

Conceptual production:

Portal:
https://app.bakerrang.com

API:
https://api.bakerrang.com

Local:

Portal:
http://localhost:3001

API:
http://localhost:8080

Do NOT broaden the session-cookie domain to .bakerrang.com.

The API continues to own the session cookie.

Portal browser requests to the API must use:

credentials: 'include'

============================================================
1. SERVER CONFIG
   ============================================================

Add:

PORTAL_DOMAIN

to the existing server environment example/config conventions.

Local:

PORTAL_DOMAIN=http://localhost:3001

Production concept:

PORTAL_DOMAIN=https://app.bakerrang.com

Do not introduce a generalized config framework.

============================================================
2. CORS
   ============================================================

Extend the existing CORS allowlist to include:

PORTAL_DOMAIN

Preserve:

CLIENT_DOMAIN
CHATBOT_ORIGIN
credentials: true
existing no-Origin behavior

Claude proposed small pure helpers such as:

server/config/origins.js

That approach is approved.

Tests must verify:

- CLIENT_DOMAIN allowed
- PORTAL_DOMAIN allowed
- CHATBOT_ORIGIN allowed
- unknown origin rejected
- requests without Origin retain existing behavior

============================================================
3. SYMBOLIC OAUTH TARGETS
   ============================================================

Support:

GET /auth/google
-> defaults to client

GET /auth/google?target=client
-> client

GET /auth/google?target=portal
-> portal

Do NOT accept arbitrary redirect URLs.

Allowed target values are exactly:

client
portal

Map them server-side:

client -> CLIENT_DOMAIN
portal -> PORTAL_DOMAIN

Invalid target at the login entry point:

return HTTP 400

Do not pass req.query values directly to res.redirect().

============================================================
4. IMPORTANT PASSPORT SESSION CORRECTION
   ============================================================

Claude planned to store the symbolic OAuth target in:

req.session.oauthTarget

This design is approved BUT must account for Passport login session
regeneration.

Inspect the installed Passport version.

For Passport versions where authentication regenerates/clears existing
session data, the successful callback authentication MUST preserve the
pre-authentication oauthTarget.

Use Passport's supported:

keepSessionInfo: true

on the authentication operation where login/session regeneration actually
occurs, expected to be the Google callback passport.authenticate middleware.

Do NOT assume the session field survives automatically.

The desired lifecycle is:

A. /auth/google?target=portal

Validate target.

Set:

req.session.oauthTarget = 'portal'

Then EXPLICITLY persist the session before redirecting away to Google.

Because the session store is Firestore/asynchronous, do not rely solely on
response completion for this load-bearing redirect state.

Conceptually:

req.session.save(err => {
if (err) return next(err)
next()
})

Only then allow passport.authenticate('google', ...) to redirect to Google.

B. Google callback

Passport authentication must preserve required pre-auth session data using
the supported keepSessionInfo mechanism where applicable.

After authentication succeeds:

read req.session.oauthTarget

resolve ONLY through the symbolic target mapping

delete req.session.oauthTarget

explicitly save the updated session

then redirect to the resolved configured domain.

Do not redirect until the cleared session state has been persisted.

If no oauthTarget exists defensively default to CLIENT_DOMAIN.

============================================================
5. CONFIGURATION FAILURE BEHAVIOR
   ============================================================

An invalid symbolic target is a client error:

400

A VALID target whose configured environment value is missing is a server
configuration problem.

For example:

target=portal

but:

PORTAL_DOMAIN

is undefined.

Do NOT silently redirect to CLIENT_DOMAIN in that situation.

Fail safely and report/log a server configuration error.

The defensive CLIENT_DOMAIN fallback is only for a callback that has no
stored target, preserving historical/default behavior.

============================================================
6. OAUTH STATE / CSRF CHECK
   ============================================================

Inspect the actual Google Passport strategy configuration.

Determine whether OAuth state protection is currently enabled.

Do not replace Passport or the Google strategy.

If state protection is already enabled:

preserve it and report that fact.

If it is absent AND the installed Google OAuth strategy supports the standard
Passport state mechanism:

enable the appropriate state protection, such as the strategy-supported
state: true configuration.

Do not create a custom OAuth-state cryptography implementation.

Add or adjust tests where practical and verify the real Google flow manually.

Report exactly what was found and changed.

============================================================
7. EXISTING AUTH CHECK
   ============================================================

Continue using the actual existing endpoint:

GET /auth/check

Expected states based on the repository:

200:
{
isAuthenticated: true,
user: {
id,
displayName,
email,
photo
}
}

401:
{
isAuthenticated: false,
...
}

Portal authentication state must NEVER derive:

PLATFORM_ADMIN
tenant membership
tenant role

from req.user or the browser.

Those remain backend authorization concepts.

============================================================
8. LOGOUT — IMPORTANT SECURITY OVERRIDE
   ============================================================

Claude proposed using the existing:

GET /auth/logout

for the new portal.

DO NOT use GET logout from the portal.

Keep the existing GET endpoint temporarily for backward compatibility with the
existing BakerRang client.

Add:

POST /auth/logout

using the SAME underlying logout handler.

The POST route must be subject to the existing authenticated CSRF behavior.

Do not create a second logout implementation with different semantics.

Portal logout must use:

POST /auth/logout

with:

credentials: 'include'

and a valid:

x-csrf-token

============================================================
9. PORTAL CSRF FOR LOGOUT
   ============================================================

Reuse the existing:

GET /auth/csrf

endpoint.

Implement the minimum portal-side behavior necessary:

1. GET /auth/csrf with credentials included.
2. Receive csrfToken.
3. POST /auth/logout with credentials included.
4. Send:
   x-csrf-token: <token>
5. After successful logout, refresh auth status.
6. /auth/check should return 401.
7. Portal transitions to anonymous.

Keep this code small.

Do not build a large general API abstraction in Step 1.5.

However, structure it cleanly enough that Step 1.6 can later reuse/generalize
the CSRF request behavior for POST /tenants.

============================================================
10. PORTAL ENVIRONMENT
    ============================================================

Add the appropriate example environment file for:

NEXT_PUBLIC_API_BASE_URL

Local:

NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

Do not hardcode the API address into application logic.

Remember this value is browser-visible and intended only to contain the public
API origin.

============================================================
11. PORTAL AUTH LAYER
    ============================================================

Implement the small client-side auth layer Claude proposed.

Expected concepts:

lib/auth.ts

app/providers/AuthProvider.tsx

Auth states:

loading
anonymous
authenticated

On mount:

GET ${API_BASE}/auth/check
credentials: 'include'

200 -> authenticated

401 -> anonymous

Do not poll every 30 seconds.

Expose:

status
user
refresh
signOut

or equivalent minimal API.

============================================================
12. LOGIN
    ============================================================

Login must perform a full browser navigation, not fetch.

Navigate to:

${API_BASE}/auth/google?target=portal

============================================================
13. UI
    ============================================================

Keep UI minimal.

Anonymous:

BakerRang Business Platform

Manage your businesses, websites, and leads.

[ Sign in with Google ]

Authenticated:

BakerRang Business Platform

Signed in as:
<displayName>
<email>

[ Sign Out ]

Use shared @bakerrang/ui primitives where appropriate.

Do not add dashboard/navigation/tenant UI.

============================================================
14. PORTAL FILES
    ============================================================

Claude proposed approximately:

platform/apps/portal/lib/auth.ts
platform/apps/portal/app/providers/AuthProvider.tsx
platform/apps/portal/.env.local.example

and modifications to:

app/layout.tsx
app/page.tsx

That structure is approved unless the actual code suggests a small cleaner
placement.

If .env*.local is not already ignored, update ONLY the platform-local ignore
rules needed.

============================================================
15. SERVER TESTS
    ============================================================

Reuse the existing dependency-free Node test setup.

Test at minimum:

OAUTH TARGETS

- absent target -> client
- target=client -> client
- target=portal -> portal
- invalid target -> 400
- arbitrary URL cannot become redirect
- portal target missing PORTAL_DOMAIN fails safely
- oauthTarget is placed in the session
- session save occurs before continuing to Google
- callback consumes target
- callback clears target
- clear is persisted before final redirect

PASSPORT SESSION PRESERVATION

Add an appropriate test or structural assertion around the selected
implementation proving the callback is configured to preserve the required
pre-login session target when using a Passport version that regenerates
sessions.

Do not leave the correctness of oauthTarget survival dependent only on a
comment.

CORS

- portal accepted
- client accepted
- chatbot accepted
- unrelated origin rejected
- no-origin behavior preserved

LOGOUT

- POST logout invokes the same logout semantics
- existing GET logout remains available for compatibility
- portal is designed to use POST
- authenticated POST is covered by existing CSRF middleware

============================================================
16. PORTAL VERIFICATION
    ============================================================

Run:

cd platform
npm run typecheck
npm run lint
npm run build

Run applicable server:

npm test
lint/syntax verification

Do not fix unrelated pre-existing server lint issues.

============================================================
17. MANUAL END-TO-END AUTH TEST
    ============================================================

Perform or provide steps for:

1. Configure server:
   PORTAL_DOMAIN=http://localhost:3001

2. Configure portal:
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

3. Start API on 8080.

4. Start portal on 3001.

5. Open portal.

6. Verify anonymous state.

7. Click Sign in with Google.

8. Complete Google login.

9. Verify redirect returns to:
   http://localhost:3001

10. Verify name/email displayed.

11. Refresh the portal.

12. Verify still authenticated.

13. Click Sign Out.

14. Verify POST logout succeeds using CSRF.

15. Verify portal returns to anonymous.

16. Refresh.

17. Verify it remains anonymous.

18. Regression test:
    initiate existing /auth/google with no target and verify the original
    BakerRang client remains the destination.

============================================================
18. DO NOT IMPLEMENT
    ============================================================

Do not implement:

tenant list UI
create business UI
role UI
membership UI
site renderer changes
Firestore from Next
CMS
media
leads
domains
analytics
Google Business Profile
Instagram
Cloud Run deployment
DNS
JWT
shared-domain cookies
email/password auth

============================================================
19. FINAL REPORT
    ============================================================

Report:

1. Files added.
2. Files modified.
3. Exact OAuth-target lifecycle implemented.
4. Installed Passport version and how session regeneration was handled.
5. Whether OAuth state protection existed and what was done.
6. CORS changes.
7. GET/POST logout behavior.
8. Portal auth-state implementation.
9. CSRF logout implementation.
10. Server test results.
11. Portal typecheck/lint/build results.
12. Manual E2E results, if performed.
13. Any deviations and why.
14. Anything that should influence Step 1.6.

Do not implement beyond Step 1.5.