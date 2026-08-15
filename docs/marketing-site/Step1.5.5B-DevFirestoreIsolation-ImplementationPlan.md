Implement Step 1.5.5B — Development Firestore Isolation.

Claude Code has inspected the repository and produced an approved
implementation plan.

Follow Claude's implementation plan with the requirements below.

Do not expand scope.

============================================================
GOAL
============================================================

Local development must use:

Google Cloud project:
bakerrang-dev

Firestore database:
(default)

Production must continue using the existing production Firestore project:

avian-cable-379805

The purpose is to prevent local development from accidentally reading or
writing production Firestore data.

============================================================
CURRENT VERIFIED ARCHITECTURE
============================================================

There is exactly ONE runtime Firestore client:

server/client/firestoreClient.js

All application data uses this client.

The Express Firestore session store also imports and uses this SAME db
instance.

Therefore:

users
sessions
tenants
vaults
budget
licenses
and other Firestore-backed application data

must always point to the same selected GCP project.

Do not create additional Firestore clients.

============================================================
1. ENVIRONMENT-AWARE PROJECT RESOLUTION
   ============================================================

Add:

server/config/firestoreConfig.js

Implement a pure resolver equivalent to:

resolveFirestoreProject(env)

Rules:

A. If FIRESTORE_PROJECT_ID is explicitly provided:
return it.

This applies in any environment.

B. If FIRESTORE_PROJECT_ID is absent AND:

NODE_ENV === 'production'

return:

avian-cable-379805

This intentionally preserves today's production behavior exactly.

C. If FIRESTORE_PROJECT_ID is absent outside production:

THROW a clear startup/configuration error.

Local development must NEVER silently use project auto-discovery.

The error should clearly tell the developer to configure:

FIRESTORE_PROJECT_ID=bakerrang-dev

============================================================
2. FIRESTORE CLIENT
   ============================================================

Modify:

server/client/firestoreClient.js

Remove the current direct hardcoded project selection.

Use:

resolveFirestoreProject()

and construct Firestore explicitly using the resolved projectId.

Continue using Application Default Credentials.

Do NOT add:

keyFilename
service account JSON
embedded credentials
credential environment files
FIRESTORE_DATABASE_ID

Both environments use the default database.

Preserve existing exports such as:

db
FieldValue

and existing helper behavior.

============================================================
3. PRODUCTION SAFETY
   ============================================================

Do NOT switch production to automatic ADC project discovery in this step.

Production currently explicitly targets:

avian-cable-379805

Preserve that behavior through the production fallback in the resolver.

FIRESTORE_PROJECT_ID may override the production fallback if explicitly set,
but setting it is not required for the current deployed environment.

Add a clear code comment/TODO noting that the hardcoded production fallback
should eventually be replaced with explicit deployment environment
configuration once Cloud Run configuration is standardized.

Do not change Cloud Run in this milestone.

============================================================
4. LOCAL SAFETY
   ============================================================

With:

NODE_ENV != production

and no:

FIRESTORE_PROJECT_ID

the server must fail during startup/module initialization.

It must NOT attempt to infer a project from:

gcloud config
ADC metadata
GOOGLE_CLOUD_PROJECT
or another ambient project source.

The application configuration is the safety boundary.

============================================================
5. STARTUP LOGGING
   ============================================================

At Firestore initialization, log the selected target once.

Expected style:

Firestore configuration:
project: bakerrang-dev
database: (default)

The production log should similarly show:

project: avian-cable-379805

Do not log credentials, tokens, secrets, or account information.

Do not log this on every database request.

============================================================
6. SESSION STORE
   ============================================================

Do NOT create a separate client for the session store.

Verify:

server/client/firestoreSessionStore.js

continues using the exported shared db.

Local:

sessions/{...}

must therefore be written into bakerrang-dev along with all application data.

No changes to the session store are expected unless required to preserve this
shared-client invariant.

============================================================
7. ENVIRONMENT EXAMPLE
   ============================================================

Update:

server/.env.example

with a Firestore configuration section.

Document:

LOCAL DEVELOPMENT:

FIRESTORE_PROJECT_ID=bakerrang-dev

Required outside production.

PRODUCTION:

May currently remain unset because the application intentionally preserves
the existing production fallback:

avian-cable-379805

Do not modify or commit the developer's real server/.env.

============================================================
8. TESTING
   ============================================================

Reuse the existing dependency-free Node test infrastructure.

Add:

server/test/firestoreConfig.test.js

Test at minimum:

- non-production + missing FIRESTORE_PROJECT_ID throws
- explicit bakerrang-dev resolves to bakerrang-dev
- production + absent env resolves to avian-cable-379805
- production + explicit FIRESTORE_PROJECT_ID honors the explicit override

Also prove that the Firestore session store uses the same db instance as
application data.

Claude proposed using the CollectionReference back-reference or an equivalent
safe structural assertion.

Do not require live Firestore RPCs for unit tests.

============================================================
9. TEST PRELOAD
   ============================================================

Existing server tests transitively import the Firestore client.

Because local/non-production project configuration now fails fast, provide the
smallest safe test preload/seam so existing tests can import the application
without connecting to a real project.

Claude proposed:

server/test/setup.js

which sets:

FIRESTORE_PROJECT_ID=test-project

only for test execution.

Update the npm test script accordingly.

The test value must never be used in normal runtime.

Firestore client construction should remain lazy with respect to network
access; existing fake DB tests must not start making real RPC calls.

============================================================
10. DO NOT OVERDO SOURCE TESTING
    ============================================================

A lightweight assertion ensuring no key-file credential configuration has been
introduced is acceptable if clean and non-brittle.

Do NOT create fragile source-code tests that will fail merely because words
such as "credentials" appear in comments or documentation.

The meaningful behavioral assertions are:

- project resolution
- fail-fast safety
- explicit project selection
- shared db/session-store usage

============================================================
11. FIRESTORE INDEXES
    ============================================================

Do NOT deploy indexes.

Do NOT change:

.firebaserc

Current platform/auth/tenant workflows do not require new composite indexes.

Leave production index configuration untouched.

============================================================
12. NO DATA COPY
    ============================================================

Do NOT copy any production Firestore data into bakerrang-dev.

Development intentionally begins empty.

Do not create:

users
sessions
tenants

manually.

The application should create required documents naturally.

============================================================
13. VERIFICATION
    ============================================================

Run:

cd server
npm test

Run scoped/new StandardJS lint and syntax validation.

Do not fix unrelated existing lint violations.

Also test fail-fast behavior:

Temporarily execute the server without FIRESTORE_PROJECT_ID while
NODE_ENV is not production.

Verify it refuses to start with the intended configuration error.

Then restore:

FIRESTORE_PROJECT_ID=bakerrang-dev

and verify startup logging identifies:

bakerrang-dev
(default)

============================================================
14. OUT OF SCOPE
    ============================================================

Do not implement:

Step 1.6 business UI
Firestore emulator
GCS
media
site renderer changes
tenant configuration
Cloud Run changes
dev Cloud Run service
CI/CD
Secret Manager
production data copying
new OAuth credentials
multiple Firestore database IDs

============================================================
15. FINAL REPORT
    ============================================================

Report:

1. Files added.
2. Files modified.
3. Exact project-resolution behavior.
4. How production behavior remains unchanged.
5. How non-production fail-fast works.
6. Confirmation that sessions/app data share one db.
7. Startup logging behavior.
8. Tests added and results.
9. Lint/syntax results.
10. Fail-fast manual verification.
11. Any deviation and why.
12. Anything needed before the live bakerrang-dev verification.

Do not implement beyond Step 1.5.5B.