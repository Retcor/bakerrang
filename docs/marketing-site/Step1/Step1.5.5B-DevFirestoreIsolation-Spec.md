We are performing Step 1.5.5B — Development Firestore Isolation.

DO NOT modify code.

A separate Google Cloud development project has now been created:

DEV GCP PROJECT ID:
bakerrang-dev

DEV FIRESTORE DATABASE:
(default)

DEV FIRESTORE LOCATION:
us-west1

The existing deployed BakerRang environment remains the production
environment.

The objective is to make LOCAL development explicitly use bakerrang-dev
without accidentally changing or risking the deployed production database.

============================================================
ARCHITECTURE DECISION
============================================================

Local/non-production execution must explicitly select its Firestore project.

Introduce an environment setting conceptually named:

FIRESTORE_PROJECT_ID

Local:

FIRESTORE_PROJECT_ID=bakerrang-dev

Production Cloud Run should continue to use Google Cloud Application Default
Credentials / service identity and its deployed project unless there is a
concrete reason to configure FIRESTORE_PROJECT_ID there too.

IMPORTANT SAFETY REQUIREMENT:

When running outside production, if FIRESTORE_PROJECT_ID is absent, the server
should FAIL FAST rather than silently allow Firestore project auto-discovery.

We do not want a developer accidentally pointing local code at production
because their ADC/gcloud configuration happened to reference it.

Do NOT add FIRESTORE_DATABASE_ID yet.

Both environments use the `(default)` Firestore database.

============================================================
1. TRACE ALL FIRESTORE CLIENTS
   ============================================================

Inspect the repository and identify EVERY place a Firestore client/database
instance is created or configured.

Pay special attention to:

server/client/firestoreClient.js
server/client/firestoreSessionStore.js
server/app.js

and any direct:

new Firestore(...)
firebase-admin initialization
Firestore constructor
session-store Firestore client

elsewhere.

Report whether:

- application collections
- users
- tenants
- vault data
- sessions

all currently share the same Firestore client/project selection.

The result must ensure ALL locally persisted Firestore data, including
Express sessions, goes to bakerrang-dev.

============================================================
2. CURRENT HARDCODED PROJECT
   ============================================================

Locate the previously discovered hardcoded project:

avian-cable-379805

Identify every occurrence relevant to runtime Firestore access.

Do not perform a blind repository-wide replacement.

Determine what each occurrence means.

============================================================
3. FIRESTORE CLIENT DESIGN
   ============================================================

Plan the smallest safe change to the existing Firestore client.

Desired conceptual behavior:

const projectId = process.env.FIRESTORE_PROJECT_ID

if non-production and projectId is absent:
fail startup with a clear configuration error

if projectId exists:
construct Firestore explicitly for projectId

if production and projectId is absent:
allow Google Cloud ADC/project discovery so the existing Cloud Run
deployment can continue using its service project's Firestore database

Do not introduce credentials JSON files.

Do not read service-account keys from disk.

Continue using Application Default Credentials.

Determine the exact constructor/options supported by the currently installed
@google-cloud/firestore version rather than guessing.

============================================================
4. PRODUCTION SAFETY
   ============================================================

Analyze whether this proposed change can alter the existing deployed Cloud Run
database selection.

We want:

LOCAL:
explicit bakerrang-dev

PRODUCTION CLOUD RUN:
existing production project

If production currently depends on a hardcoded project ID rather than Cloud
Run project discovery, identify that clearly.

Recommend whether we should:

A. preserve an explicit production FIRESTORE_PROJECT_ID env variable

or

B. allow production ADC/project discovery

based on the actual deployment/code behavior.

Prefer the approach with the lowest risk of silently connecting to the wrong
database.

============================================================
5. CONFIGURATION
   ============================================================

Inspect server/.env.example and existing dotenv behavior.

Plan:

server/.env.example

FIRESTORE_PROJECT_ID=

with documentation explaining:

Local:
FIRESTORE_PROJECT_ID=bakerrang-dev

Production behavior as determined above.

Do not commit the developer's server/.env.

============================================================
6. SAFE STARTUP LOGGING
   ============================================================

Plan a startup/config log making the selected database target obvious.

For example:

Firestore configuration:
project: bakerrang-dev
database: (default)

Do not log:

credentials
access tokens
service-account secrets
session secrets

If production relies on auto-discovery and the project cannot synchronously be
known at initialization time, determine a clean alternative.

Avoid noisy logging on every Firestore request.

============================================================
7. LOCAL ADC
   ============================================================

Assume the developer will use:

gcloud auth application-default login

No key files should be required.

Determine whether any code changes are needed for ADC.

Expected answer should normally be NO.

============================================================
8. FIRESTORE SESSION STORE
   ============================================================

This is load-bearing.

Verify exactly how:

express-session
Firestore session store

selects its Firestore database.

Local sessions MUST be stored in bakerrang-dev.

If the session store already consumes the shared db/client, document that.

If it creates another Firestore client independently, plan the minimum change
required to make it use the exact same environment-aware project selection.

============================================================
9. EXISTING TESTS
   ============================================================

Review the Step 1.2 and Step 1.5 test infrastructure.

Plan tests proving:

- non-production + FIRESTORE_PROJECT_ID missing fails safely
- non-production + FIRESTORE_PROJECT_ID=bakerrang-dev selects bakerrang-dev
- explicit project configuration reaches the Firestore client
- production behavior matches the selected production strategy
- no credentials are hardcoded
- session-store project selection cannot diverge from application data project
  selection

Avoid requiring live Firestore for automated unit tests if a clean seam can
test configuration selection.

============================================================
10. LOCAL VERIFICATION PROCEDURE
    ============================================================

Plan a manual verification after implementation:

1. Set:
   FIRESTORE_PROJECT_ID=bakerrang-dev

2. Run:
   gcloud auth application-default login

3. Start server.

4. Confirm startup output identifies bakerrang-dev.

5. Start portal.

6. Log in with Google.

7. Verify the DEV Firestore database now contains development documents such
   as:
   users/{userId}
   sessions/{...}

8. Verify production Firestore was not modified.

9. Add:
   platformRole = PLATFORM_ADMIN
   to the DEV users/{userId} document.

10. Verify portal login remains functional.

11. Eventually use Step 1.6 to create the first DEV tenant.

============================================================
11. EXISTING FIRESTORE INDEXES
    ============================================================

Inspect whether current development work requires any composite indexes to be
copied/deployed into bakerrang-dev immediately.

Do NOT deploy indexes during this planning task.

If the current portal/auth/tenant workflows use only automatic indexes, say so.

If a required query will fail without a configured index, identify it.

Do not copy every production index merely because the file exists unless
necessary for current platform development.

============================================================
12. NO DATA COPY
    ============================================================

Do NOT propose copying production Firestore data into development.

The dev project should start isolated.

The Google login flow should naturally create the development user record.

Existing BakerRang production vault/budget/etc. data should NOT be copied.

============================================================
13. OUT OF SCOPE
    ============================================================

Do not plan:

- Step 1.6 business UI
- GCS
- media
- site renderer changes
- tenant configuration
- production deployment
- Cloud Run dev deployment
- CI/CD
- Secret Manager
- copying production data
- Firestore emulator migration
- new OAuth credentials
- multi-database IDs

============================================================
DELIVERABLE
============================================================

Return:

1. Every Firestore construction/configuration point found.
2. Exact current project-selection behavior.
3. Session-store Firestore behavior.
4. Hardcoded production project references relevant to runtime.
5. Proposed environment-aware Firestore design.
6. Production-safety analysis.
7. Files to add/modify.
8. Environment changes.
9. Startup logging approach.
10. Test plan.
11. Index implications.
12. Manual verification procedure.
13. Ordered Codex implementation plan.
14. Concrete risks.
15. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.