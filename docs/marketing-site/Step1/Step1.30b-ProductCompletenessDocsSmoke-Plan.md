# Implement Step 1.30b — DEV Documentation, Safe Deploy Helper & Final Smoke Runbook

Implement ONLY Step 1.30b.

Step 1.30a is COMPLETE and live-verified.

Claude inspected the current product and found:

- no required Business UI fixes
- no required Leads UI fixes
- no required Domain UI fixes
- no required access-denied fixes
- no required Website fixes
- no remaining DEV product-code blocker

Therefore Step 1.30b is intentionally:

```text
documentation + safe DEV deployment helper
```

Do NOT modify product behavior.

---

# 1. Required Deliverables

Create:

```text
docs/DEV-DEPLOYMENT.md
scripts/deploy-dev.ps1
```

Modify:

```text
README.md
```

Do NOT modify Portal, API, Renderer, schema, or product components unless an actual documentation/tooling dependency requires it.

The optional Domain copy nicety from Claude's plan is explicitly NOT being implemented.

---

# 2. Important Final 1.30a Contract

Document the ACTUAL current implementation, including the two follow-up corrections made after Claude's initial 1.30b plan.

## API runtime

Required:

```text
FIRESTORE_PROJECT_ID
MEDIA_BUCKET_NAME
SESSION_SECRET
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
SERVER_DOMAIN
PORTAL_DOMAIN
SITE_RENDERER_DOMAIN
PREVIEW_TOKEN_SECRET when NODE_ENV=production
```

Optional:

```text
CLIENT_DOMAIN
CHATBOT_ORIGIN
```

`CLIENT_DOMAIN` is a legacy-client CORS origin and MUST NOT be documented as mandatory.

## Renderer runtime

Required unconditionally:

```text
SITE_API_BASE_URL
SITE_PUBLIC_ORIGIN
```

Optional/fail-closed:

```text
SITE_PUBLIC_INDEXING_ENABLED
```

Only exact:

```text
true
```

enables indexing.

Do NOT document the obsolete behavior where `SITE_PUBLIC_ORIGIN` is only required when indexing is enabled.

That behavior was corrected during 1.30a.

---

# 3. DEV Deployment Runbook

Create:

```text
docs/DEV-DEPLOYMENT.md
```

It should be concise but sufficient for another developer to deploy and verify DEV without relying on conversational history.

---

# 4. Environment Identity

Document:

```text
GCP project:
bakerrang-dev

Region:
us-west1
```

Cloud Run services:

```text
bakerrang-api-dev
bakerrang-portal-dev
bakerrang-site-renderer-dev
```

Stable DEV URLs:

```text
https://api-dev.bakerrang.com
https://portal-dev.bakerrang.com
https://sites-dev.bakerrang.com
```

Permanent DEV custom-domain test hostname:

```text
https://custom-dev.bakerrang.com
```

Do NOT include production deployment commands.

---

# 5. Application Architecture Summary

Briefly explain:

```text
Portal
  -> operator/admin application

Site Renderer
  -> public multi-tenant website renderer

API
  -> Express API and Firestore boundary

Renderer
  -> sanitized API
  -> Firestore

Renderer never directly connects to Firestore
```

Mention:

```text
working
preview
published
```

at a high level only.

This is a deploy runbook, not an architecture specification.

---

# 6. Build Contexts

Document:

API:

```text
working directory/context:
server/

Dockerfile:
server/Dockerfile
```

Portal + Renderer:

```text
working directory/context:
platform/

Portal Dockerfile:
platform/apps/portal/Dockerfile

Renderer Dockerfile:
platform/apps/site-renderer/Dockerfile
```

---

# 7. Build-Time Variables

Portal build args:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN
CUSTOM_DOMAIN_IPV4_ADDRESS       optional
CUSTOM_DOMAIN_CNAME_TARGET       optional
```

Current DEV values include:

```text
NEXT_PUBLIC_API_BASE_URL=https://api-dev.bakerrang.com
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=https://sites-dev.bakerrang.com
CUSTOM_DOMAIN_IPV4_ADDRESS=8.232.231.135
```

Do not invent a CNAME value if DEV does not use one.

Renderer build arg:

```text
NEXT_PUBLIC_SITE_API_BASE_URL=https://api-dev.bakerrang.com
```

Explain that `NEXT_PUBLIC_*` values are embedded during the Next.js build.

---

# 8. API Runtime Configuration

Document the final required/optional contract from §2.

Make this safety rule prominent:

```text
FIRESTORE_PROJECT_ID must always be set explicitly.

DEV:
FIRESTORE_PROJECT_ID=bakerrang-dev
```

There is intentionally NO:

```text
NODE_ENV -> Firestore project
```

fallback.

A missing project id causes startup failure.

Do not include secret values.

Explain that sensitive values should be supplied through Secret Manager references.

---

# 9. Renderer Runtime Configuration

Document:

```text
SITE_API_BASE_URL=https://api-dev.bakerrang.com
SITE_PUBLIC_ORIGIN=https://sites-dev.bakerrang.com
SITE_PUBLIC_INDEXING_ENABLED=false
```

Both origins are runtime requirements.

The renderer's startup preflight exits before Next starts if required configuration is absent/invalid.

DEV indexing remains disabled.

---

# 10. Environment / Secret Mutation Warning

Document the distinction clearly.

For existing Cloud Run services:

```text
--update-env-vars
--update-secrets
```

are the normal selective update mechanisms.

Warn against casually using:

```text
--set-env-vars
--set-secrets
```

because those are replacement-style operations and can remove existing configuration not included in the command.

The preferred normal BakerRang DEV application deploy is:

```text
update the image only
```

when runtime configuration has not changed.

Do not put real secret values in examples.

---

# 11. Image-Only Deployment

Document the safe normal pattern:

```powershell
gcloud run services update <service> `
  --project bakerrang-dev `
  --region us-west1 `
  --image <new-image> `
  --quiet
```

Explain that this preserves existing runtime environment/secrets.

Do not add unnecessary `--update-env-vars` to routine application deployments.

---

# 12. Create `scripts/deploy-dev.ps1`

Create a deliberately thin DEV-only PowerShell helper.

Primary goal:

```text
build all three images
push all three images
update only the Cloud Run image references
```

It must NEVER mutate:

```text
environment variables
secrets
IAM
DNS
load balancer
domains
Firestore data
```

---

# 13. DEV Safety Guardrails in Script

Hardcode:

```powershell
$Project = "bakerrang-dev"
$Region = "us-west1"
```

Do NOT make project configurable from a command-line parameter.

This script is intentionally DEV-only.

There should be no production target mode.

Parameterize only the image tag if useful.

Example conceptual signature:

```powershell
param(
    [string]$Tag = "dev-$(Get-Date -Format yyyyMMddHHmmss)"
)
```

Exact implementation may vary.

---

# 14. Repository Location Handling

The script should work regardless of the caller's current working directory.

Resolve repository paths relative to:

```powershell
$PSScriptRoot
```

rather than assuming the developer invoked it from repo root.

Use `Push-Location` / `Pop-Location` safely.

---

# 15. Determine Image Repositories Safely

Prefer deriving the current image repository from the existing Cloud Run services, using the pattern already used successfully during DEV deployment.

Conceptually:

```powershell
function Get-ImageRepository($Service) {
    $Current = gcloud run services describe ...
    return $Current -replace ...
}
```

This avoids duplicating Artifact Registry repository paths in another configuration location.

Fail clearly if:

```text
service cannot be read
image reference cannot be resolved
```

---

# 16. Docker Registry Authentication

The script may perform:

```powershell
gcloud auth configure-docker <registry-host> --quiet
```

using the registry host derived from the actual image reference.

Do not hardcode a different registry if it can be derived.

---

# 17. API Build

Build using:

```text
server/
```

as context.

Equivalent conceptual operation:

```powershell
docker build -t $ApiImage .
```

from `server/`.

No runtime env values should be baked into the API image.

---

# 18. Portal Build

Build from:

```text
platform/
```

with:

```text
apps/portal/Dockerfile
```

and the actual DEV build args:

```text
NEXT_PUBLIC_API_BASE_URL=https://api-dev.bakerrang.com
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=https://sites-dev.bakerrang.com
CUSTOM_DOMAIN_IPV4_ADDRESS=8.232.231.135
```

If `CUSTOM_DOMAIN_CNAME_TARGET` is not currently used, do not invent one.

---

# 19. Renderer Build

Build from:

```text
platform/
```

with:

```text
apps/site-renderer/Dockerfile
```

and:

```text
NEXT_PUBLIC_SITE_API_BASE_URL=https://api-dev.bakerrang.com
```

Runtime values must NOT be baked in as substitutes for:

```text
SITE_API_BASE_URL
SITE_PUBLIC_ORIGIN
```

Those remain Cloud Run runtime configuration.

---

# 20. Push + Deploy

Push all images.

Then update the three existing services using ONLY:

```text
--image
```

Use:

```text
gcloud run services update
```

rather than recreating service configuration.

Absolutely no:

```text
--set-env-vars
--update-env-vars
--set-secrets
--update-secrets
```

inside the normal deploy helper.

Runtime configuration is explicitly out-of-band.

---

# 21. Script Failure Behavior

Use normal PowerShell error discipline so a failed:

```text
build
push
gcloud operation
```

does not silently continue to subsequent deploys.

Do not create a huge deployment framework.

A clear non-zero failure is enough.

---

# 22. Script Output

At minimum print:

```text
tag
API image
Portal image
Renderer image
successful service updates
```

At the end provide the normal verification URLs/commands.

Do not automatically manipulate browser state or create data.

---

# 23. Script Validation

Do NOT actually deploy DEV while implementing/testing this script.

Validate:

- PowerShell syntax
- path handling by inspection/parser
- no prohibited config flags
- no production identifiers
- correct Docker contexts/build args
- correct service names

If a dry parsing command is available, use it.

Do not execute the deployment as part of Codex verification.

---

# 24. README Platform Section

Modify the root:

```text
README.md
```

without rewriting/removing the legacy project information.

Add a concise:

```text
Platform
```

section covering:

```text
platform/apps/portal
platform/apps/site-renderer
platform/packages/ui
platform/packages/site-components
platform/packages/site-schema
server/
```

Explain each briefly.

---

# 25. README Architecture Summary

Briefly describe:

```text
Portal -> API -> Firestore

Public renderer -> sanitized API -> Firestore
```

and the working/Preview/published model.

Do not duplicate the detailed implementation roadmap.

---

# 26. Local Development Instructions

Inspect the ACTUAL files currently present after 1.30a.

Do not blindly use Claude's proposed filenames.

Specifically verify whether the apps currently provide:

```text
.env.example
.env.local.example
or both
```

and document the real files.

Do not reference a nonexistent example file.

Document minimal local setup for:

```text
API
Portal
Renderer
```

using actual package scripts.

Do not expose secrets.

---

# 27. OAuth Local Development

At a pointer level, document that Google OAuth must allow the local callback/origins appropriate to the configured:

```text
SERVER_DOMAIN
PORTAL_DOMAIN
```

Do not create a full Google Cloud OAuth tutorial.

---

# 28. Actual Test Commands

Read the actual `package.json` scripts before documenting commands.

Expected from inspection, but verify:

Backend:

```text
cd server
npm test
npm run lint
```

Platform:

```text
cd platform
npm test
npm run typecheck
npm run lint
npm run build
```

Individual workspace tests may be documented if useful.

Do not invent scripts.

Also note that builds require their configured `NEXT_PUBLIC_*` values.

---

# 29. Known Deferrals

Document a small "Known DEV deferrals" section.

## Favicon

Current:

```text
/favicon.ico may return 404
```

Future desired capability:

```text
tenant-configurable
media-backed
working/published-aware
shared/custom-domain favicon
```

Do not implement it.

Do not add a 204 handler.

Do not add a global BakerRang favicon for tenant sites.

## Browser E2E

Playwright/browser E2E remains deferred until a clean test-auth strategy exists.

Manual DEV smoke is the current final gate.

## Production work

Explicitly out of this runbook/scope:

```text
production deploy
production DNS/OAuth
Terraform/IaC
distributed rate limiting
advanced monitoring
load testing
backup/restore
secret rotation
formal pentest
formal WCAG certification
```

---

# 30. Final DEV Smoke Checklist

Put the reusable 15–30 minute smoke checklist in the runbook.

Keep it practical.

Use a designated reusable:

```text
Smoke Test
```

DEV tenant.

Do not instruct the engineer to create a new business every smoke run.

---

# 31. Config Checks

Smoke:

```text
API logs contain:
Firestore project: bakerrang-dev

GET:
https://api-dev.bakerrang.com/health
-> 200
```

---

# 32. Auth Checks

Smoke:

```text
Google sign-in
Portal loads

refresh
session remains valid

sign out
returns to login

deep link while unauthenticated
login
returns appropriately
```

Keep practical; session-expiration-after-seven-days does not need to be tested every smoke.

---

# 33. Business / Workspace Checks

Using the designated Smoke Test tenant:

```text
business list loads
business opens
Overview / Website / Leads / Domain work
```

No need to create a new tenant each run.

---

# 34. Website Checks

Keep this short:

```text
edit Hero or one content section
Save

make another edit
confirm Unsaved changes

attempt editor/navigation switch
discard guard works

Preview opens working copy

Publish or Republish as appropriate
status becomes Published

edit again
Changes not published appears

Republish
returns to Published
```

Test Unpublish periodically or during this final 1.30 smoke, but restore the Smoke Test tenant to a published state afterward.

Do not leave the permanent test tenant unpublished.

---

# 35. Domain Checks

Use the existing permanent DEV hostname:

```text
custom-dev.bakerrang.com
```

Do NOT register a new external hostname every smoke.

Confirm:

```text
Domain page shows ACTIVE
HTTPS works
custom domain serves published site
shared published URL redirects appropriately
```

DNS verification lifecycle does not need to be recreated on every smoke because that was already live-verified earlier.

---

# 36. Public Site Checks

Confirm:

```text
Home
Contact
media
theme
Custom CSS
social/footer if configured
```

Shared/public/custom-domain behavior remains correct.

At roughly 375px ensure the public site remains usable.

---

# 37. Lead Checks

Submit one real lead from the PUBLISHED public site.

Confirm:

```text
success shown
lead appears in Portal
detail opens
status change works
note can be added
```

Also Preview must not create real leads.

Do not add automated cleanup.

Mention that smoke leads accumulate and may be manually removed from DEV Firestore if they ever become noisy.

---

# 38. Responsive Spot Check

At approximately:

```text
375px
768px
desktop
```

spot-check only:

```text
Business list
workspace nav
Leads
Domain
```

Look for:

```text
horizontal overflow
unreachable control
broken dialog
hidden critical content
```

Do not repeat exhaustive Website editor testing.

---

# 39. Browser Console / Network

Check for unexpected:

```text
404
500
CORS
hydration warning
mixed content
failed media
```

Known:

```text
/favicon.ico 404
```

is acceptable and deferred.

Ignore browser-extension noise.

---

# 40. Restore Stable Smoke State

At the end of the smoke run, leave the permanent Smoke Test tenant in a useful baseline:

```text
published
custom-dev.bakerrang.com ACTIVE
```

Do not leave it intentionally broken/unpublished.

---

# 41. Documentation Accuracy

Before finishing:

- verify every service name
- verify every stable URL
- verify actual env-example filenames
- verify actual npm script names
- verify required vs optional variables against 1.30a code
- verify `SITE_PUBLIC_ORIGIN` is documented as REQUIRED
- verify `CLIENT_DOMAIN` is documented as OPTIONAL

Do not copy stale statements from Claude's plan.

---

# 42. Scope Discipline

No:

- product component changes
- API business-logic changes
- renderer behavior changes
- schema changes
- favicon implementation
- Playwright
- domain copy tweak
- production deploy code
- IaC

The PowerShell helper is DEV-only.

---

# 43. Verification

Since this is docs/tooling-only:

Run:

```text
git diff --check
```

Validate `deploy-dev.ps1` syntax without executing deployment.

Also run the existing standard suites if practical:

```text
Backend tests
Portal tests
Renderer tests
Shared UI tests
platform typecheck
platform lint
```

Production builds are optional for a docs/script-only diff unless the implementation unexpectedly touches build/config files.

If any product source is modified unexpectedly, run the full relevant gate set.

---

# 44. Return

Return a concise implementation report:

1. files created
2. files modified
3. runbook sections added
4. README platform section
5. deploy-dev.ps1 behavior/safety guardrails
6. actual env-example filenames documented
7. actual test commands documented
8. known deferrals documented
9. smoke checklist summary
10. verification results
11. confirmation no product code changed
12. anything preventing the final manual DEV smoke