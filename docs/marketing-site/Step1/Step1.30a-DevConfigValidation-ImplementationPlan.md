# Implement Step 1.30a — DEV Configuration Safety & Validation

Implement ONLY Step 1.30a of BakerRang Step 1.30.

Step 1.30 is DEV Product Readiness.

Claude completed a repository-wide readiness review and found the product architecture/end-to-end workflow sound.

This slice addresses only configuration safety and fail-fast behavior.

Do NOT implement documentation, empty-state polish, favicon, Playwright, or final smoke work yet.

Those belong to Step 1.30b or later.

---

# 1. Primary Goal

Prevent a misconfigured Cloud Run service from:

```text
silently using the wrong Firestore project
```

and make critical missing service configuration fail clearly rather than surfacing later as confusing request-time 500s.

Keep this small.

---

# 2. Firestore Project Selection — CRITICAL

Current behavior in `resolveFirestoreProject` is approximately:

```text
if FIRESTORE_PROJECT_ID exists
    use it

else if NODE_ENV === production
    silently use production project

else
    throw
```

This is unsafe for DEV Cloud Run because DEV also runs with:

```text
NODE_ENV=production
```

A missing DEV environment variable could therefore send DEV traffic/data to production Firestore.

Remove this fallback.

---

# 3. New Firestore Contract

Require:

```text
FIRESTORE_PROJECT_ID
```

explicitly in ALL environments that use the real Firestore configuration.

Conceptually:

```js
function resolveFirestoreProject(env) {
  const value = normalize(env.FIRESTORE_PROJECT_ID)

  if (!value) {
    throw new Error(
      'FIRESTORE_PROJECT_ID is required. Set it explicitly for this environment.'
    )
  }

  return value
}
```

Use existing project conventions/error styles.

Do NOT infer the project from:

```text
NODE_ENV
GOOGLE_CLOUD_PROJECT
GCLOUD_PROJECT
hardcoded production id
service name
```

unless some existing local-test seam explicitly requires a different test-only mechanism.

The application data project must be intentional.

---

# 4. Production Compatibility

This source change intentionally means a future production deployment must explicitly configure:

```text
FIRESTORE_PROJECT_ID=<production project>
```

Do NOT:

- change production Cloud Run now
- deploy production
- modify production DNS
- create production data
- add a new hardcoded production fallback

Document/report this operational consequence clearly.

The currently deployed production environment, if any, is outside this DEV deployment task and must remain untouched.

---

# 5. DEV Expected Configuration

The DEV API must continue using:

```text
FIRESTORE_PROJECT_ID=bakerrang-dev
```

Do not change the DEV Firestore project.

Do not introduce automatic environment switching.

---

# 6. Startup Project Logging

At API startup, log the selected Firestore project once.

Example conceptual message:

```text
Firestore project: bakerrang-dev
```

Requirements:

- project id only
- no credentials
- no service-account token
- no secrets
- no excessive repeated logging per request

This is an operational safety/diagnostic line.

Place it where it accurately represents the project the server will actually use.

Avoid initializing multiple Firestore clients just to print it.

---

# 7. Firestore Resolver Tests

Add deterministic tests proving:

```text
explicit FIRESTORE_PROJECT_ID
  -> returned exactly

missing FIRESTORE_PROJECT_ID + NODE_ENV=development
  -> throws

missing FIRESTORE_PROJECT_ID + NODE_ENV=test
  -> throws, unless an existing explicit test seam deliberately supplies it

missing FIRESTORE_PROJECT_ID + NODE_ENV=production
  -> throws

production + explicit FIRESTORE_PROJECT_ID
  -> explicit value wins
```

Most importantly prove there is NO remaining:

```text
NODE_ENV=production -> hardcoded production project
```

behavior.

---

# 8. Preserve Test Isolation

Do not break FakeDb/unit tests that do not instantiate the real Firestore client.

Only code paths requiring the actual configured Firestore connection should require the environment variable.

Do not force every isolated domain unit test to export a fake environment variable unnecessarily.

Inspect current module-import timing carefully.

---

# 9. API Required Runtime Configuration

Audit the actual API startup/runtime requirements.

Claude identified at least:

```text
FIRESTORE_PROJECT_ID
SESSION_SECRET
PREVIEW_TOKEN_SECRET
MEDIA_BUCKET_NAME
```

and potentially existing OAuth/configuration values depending on route initialization.

`SESSION_SECRET` and `PREVIEW_TOKEN_SECRET` already have established fail-fast behavior.

Do not rewrite those mechanisms unless needed for consistency.

---

# 10. MEDIA_BUCKET_NAME Fail-Fast

Current media configuration reportedly throws only on first media use.

Move validation early enough that a deployed API with media enabled/current product architecture does not appear healthy and then fail only when an operator uploads media.

Required:

```text
missing/blank MEDIA_BUCKET_NAME
  -> actionable startup failure
```

But inspect the actual local/test architecture first.

Do not make domain/unit tests that never initialize the real application require GCS configuration.

Prefer an application-startup configuration validation seam rather than eager module-global side effects that make tests brittle.

---

# 11. API Configuration Validation Seam

If useful, introduce one small startup validation function/module conceptually:

```text
validateServerRuntimeConfig()
```

It may validate required server runtime values in one place.

Keep it small.

Do not build a configuration framework.

Potential responsibilities:

```text
FIRESTORE_PROJECT_ID
SESSION_SECRET
PREVIEW_TOKEN_SECRET where required by current environment
MEDIA_BUCKET_NAME
```

Reuse existing validators where practical rather than duplicating rules.

---

# 12. Renderer Runtime Configuration

Audit the actual renderer use of:

```text
SITE_API_BASE_URL
SITE_PUBLIC_ORIGIN
SITE_PUBLIC_INDEXING_ENABLED
```

Claude found required values can fail lazily.

Add fail-fast validation only for values that are genuinely required by the current renderer architecture.

Do not blindly require optional features.

---

# 13. SITE_API_BASE_URL

The renderer requires the server-side API base URL to retrieve site data.

A missing/invalid:

```text
SITE_API_BASE_URL
```

should not produce a seemingly healthy deployment that fails only when a page is requested.

Validate:

```text
present
valid absolute HTTP/HTTPS origin according to existing URL policy
```

at the earliest practical runtime boundary.

Reuse any existing origin/url helper where appropriate.

---

# 14. SITE_PUBLIC_ORIGIN

Inspect its actual semantics before making it globally mandatory.

It is currently involved in shared public-origin/canonical/indexing behavior.

Only require it if the renderer's current deployed architecture genuinely requires it in all supported modes.

If:

```text
SITE_PUBLIC_ORIGIN
```

is optional when a specific mode/feature is disabled, preserve that valid configuration.

Do not tighten configuration based only on the variable name.

Report the decision and why.

---

# 15. SITE_PUBLIC_INDEXING_ENABLED

This is a feature gate.

Do NOT make:

```text
SITE_PUBLIC_INDEXING_ENABLED=true
```

required.

Existing fail-closed indexing behavior must remain:

```text
anything except explicit true
  -> indexing disabled
```

If indexing is enabled but its required origin is missing/invalid:

```text
fail clearly
```

rather than emitting contradictory metadata.

Preserve existing SEO semantics.

---

# 16. Next.js Runtime Validation — Do Not Build a Custom Server Casually

The Portal/Renderer use Next standalone output.

Do NOT introduce a custom Next server just to validate environment variables.

Do NOT redesign Docker execution.

Use the smallest reliable validation mechanism compatible with current standalone deployment.

Potential options to inspect:

```text
small preflight Node script invoked by Docker CMD before server.js

existing server-side configuration module that is guaranteed to load during startup

Docker entrypoint/preflight
```

Choose based on actual project structure.

If true process-start validation is disproportionately invasive for a particular frontend runtime variable, explain the constraint and use the earliest reliable server execution boundary instead.

Do not pretend request-time validation is startup validation.

---

# 17. Portal Build-Time Configuration

Audit the current build-time values:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN
CUSTOM_DOMAIN_IPV4_ADDRESS
CUSTOM_DOMAIN_CNAME_TARGET if used
```

Do not convert them to runtime configuration in this step.

Build-time embedding is intentional/current architecture.

The goal here is validation, not environment-model redesign.

---

# 18. Required vs Optional Portal Build Args

Determine which frontend build args are genuinely required for a functional current Portal.

For required values, make a missing value fail clearly during build rather than producing a broken deployed bundle where practical.

Do not require:

```text
CUSTOM_DOMAIN_CNAME_TARGET
```

if it is legitimately optional because A-record targeting is supported.

Preserve existing custom-domain modes.

---

# 19. Renderer Build-Time Configuration

Likewise audit:

```text
NEXT_PUBLIC_SITE_API_BASE_URL
```

and any other `NEXT_PUBLIC_*` renderer values.

Do not change the build-time/runtime split.

If the value is genuinely required by client code, fail build clearly when absent.

If it is legacy/redundant and server runtime configuration is authoritative, report that rather than introducing unnecessary validation.

Do not delete it casually in this slice.

---

# 20. Validation Error Quality

All configuration failures should identify the missing/invalid variable.

Good:

```text
FIRESTORE_PROJECT_ID is required.
MEDIA_BUCKET_NAME is required.
SITE_API_BASE_URL must be a valid absolute origin.
```

Bad:

```text
Configuration error.
Cannot read property X.
500 Internal Server Error.
```

Do not include secret values in errors.

---

# 21. Secrets

Do not log:

```text
SESSION_SECRET
PREVIEW_TOKEN_SECRET
OAuth client secret
credentials
tokens
```

Only safe configuration identifiers/origins may appear in startup diagnostics.

---

# 22. No New Environment Abstraction

Do NOT introduce:

```text
APP_ENV
BAKERRANG_ENV
DEPLOYMENT_ENV
```

merely to solve this.

Explicit project/config variables are simpler and safer.

The Firestore project choice should be explicit itself.

---

# 23. Health Endpoint Semantics

Evaluate whether startup validation occurs before the server begins accepting requests.

Desired:

```text
invalid required config
  -> process fails
  -> Cloud Run revision does not become healthy
```

rather than:

```text
/health 200
real feature request 500
```

Where technically practical, make this true.

Do not add an elaborate readiness-probe framework.

---

# 24. Existing Local Development

Do not unnecessarily damage local setup.

If current local development requires explicit:

```text
FIRESTORE_PROJECT_ID
MEDIA_BUCKET_NAME
```

that is acceptable and should later be documented in 1.30b.

Existing `.env.example` files may be updated in this slice if necessary to reflect new required variables.

Do not write real secrets into examples.

---

# 25. `.env.example` Accuracy

Inspect:

```text
server/.env.example
platform/apps/portal/.env.example
platform/apps/site-renderer/.env.example
```

or their actual equivalents.

Update them only as needed so required/optional status matches the new validation contract.

Use safe placeholders.

Full documentation belongs to 1.30b.

---

# 26. No Favicon Work

Do NOT:

```text
add /favicon.ico 204
add hardcoded favicon
add tenant favicon support
```

The real tenant-configurable favicon is explicitly deferred.

Keep the known 404 for now.

---

# 27. No Playwright

Do not add:

```text
Playwright
test auth
browser E2E infrastructure
```

Manual smoke remains the readiness approach for now.

---

# 28. No Empty-State Work Yet

Do NOT change:

```text
Leads empty state
Domain empty state
BusinessManager access-denied UI
```

in this slice.

Those will be manually inspected and addressed selectively in 1.30b.

---

# 29. No Deployment Docs Yet

Do NOT write the full DEV runbook in 1.30a.

Small `.env.example` corrections are okay.

The comprehensive:

```text
docs/DEV-DEPLOYMENT.md
README platform section
```

belong to 1.30b once the final config contract is known.

---

# 30. No Production Changes

Absolutely no:

```text
production deployment
production Cloud Run update
production environment mutation
production DNS
production Firestore writes
```

This is source-code + tests only.

The implementation report must call out:

```text
Future production deployments must explicitly set FIRESTORE_PROJECT_ID.
```

---

# 31. Security / Architecture Preservation

Preserve:

```text
DEV Firestore isolation
single renderer
renderer -> API -> Firestore
working/published isolation
tenant authorization
CSRF
Preview token security
lead security
Custom CSS security
custom-domain architecture
```

This slice should not need to touch those systems beyond configuration initialization.

---

# 32. Tests — Config Validation

Add focused tests for any new validation seam.

Materially cover:

```text
required value present
required value absent
blank/whitespace value
invalid URL/origin where relevant
optional value absent
secret value never included in output/log test where practical
```

Avoid excessive tests for trivial branches.

---

# 33. Tests — Startup Integration

Where practical, prove:

```text
server startup validation runs before listen
```

without spawning complicated real Cloud Run processes.

If a small unit test of the startup validator + app wiring proves the contract sufficiently, prefer that.

For Next preflight scripts, test the validator functions directly.

---

# 34. Existing Regression Gates

Keep all existing suites green:

```text
Backend
Portal
Renderer
Shared UI
```

No behavior changes to normal correctly-configured requests should occur.

---

# 35. Verification

Run:

```text
Backend tests
Portal tests
Renderer tests
Shared UI tests
platform-wide typecheck
platform lint
Portal production build
Renderer production build
touched-server StandardJS
git diff --check
```

Additionally run any focused new configuration tests.

---

# 36. Manual Post-Implementation Verification Recommendation

Do NOT deploy automatically.

Return exact commands for checking the DEV Cloud Run environment and then deploying 1.30a safely.

The manual verification should include:

```text
DEV API environment contains:
FIRESTORE_PROJECT_ID=bakerrang-dev

API startup logs explicitly name:
bakerrang-dev

/health returns 200

media upload still works

renderer starts with configured SITE_API_BASE_URL/SITE_PUBLIC_ORIGIN

Portal Preview still targets sites-dev.bakerrang.com
```

Do not include any production command.

---

# 37. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. old Firestore resolver behavior
4. new Firestore resolver contract
5. production compatibility consequence
6. startup logging behavior
7. server fail-fast variables
8. renderer fail-fast variables
9. frontend build-time validation
10. optional-variable handling
11. `.env.example` changes
12. tests added/updated
13. full verification results
14. deviations and why
15. exact safe DEV verification/deployment commands
16. anything that must be addressed before Step 1.30b