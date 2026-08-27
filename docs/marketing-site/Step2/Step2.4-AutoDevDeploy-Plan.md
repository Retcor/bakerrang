# Step 2.4 — Automatic Selective DEV Deployment from `main`

Implement Step 2.4.

Human bootstrap is COMPLETE.

Do NOT modify live GCP IAM, GitHub Environment settings, Cloud Run configuration, Artifact Registry permissions, WIF, DNS, secrets, or Terraform.

Do NOT deploy anything during implementation.

The human will merge and live-test afterward.

---

# 1. Goal

Implement:

```text
PR → main
    ↓
push event
    ↓
existing centralized classifier
    ↓
validate affected services
    ↓
build only affected Docker images
    ↓
push immutable images to DEV Artifact Registry
    ↓
update only affected Cloud Run services
    ↓
verify deployed digest/revision
    ↓
HTTP smoke
```

DEV only.

---

# 2. Completed external bootstrap

The following already exists and has been manually verified.

Project:

```text
bakerrang-dev
```

Region:

```text
us-west1
```

GitHub Environment:

```text
development
```

WIF deployer:

```text
bakerrang-github-dev-deployer@bakerrang-dev.iam.gserviceaccount.com
```

WIF provider trusts only:

```text
GitHub owner immutable ID:      2282360
GitHub repository immutable ID: 715929041
Git ref:                        refs/heads/main
```

The deployer now has:

```text
roles/artifactregistry.writer
    on Artifact Registry repo bakerrang-dev ONLY

roles/run.developer
    on:
      bakerrang-api-dev
      bakerrang-portal-dev
      bakerrang-site-renderer-dev
    ONLY

roles/iam.serviceAccountUser
    on:
      bakerrang-api-dev@bakerrang-dev.iam.gserviceaccount.com
      bakerrang-frontend-dev@bakerrang-dev.iam.gserviceaccount.com
    ONLY
```

The temporary Step 2.3 `roles/run.viewer` binding was removed.

Do not alter this IAM.

---

# 3. Existing GitHub Environment variables

Already configured in `development`:

```text
GCP_PROJECT_ID=bakerrang-dev
GCP_PROJECT_NUMBER=1006288410962
GCP_REGION=us-west1

WIF_PROVIDER=projects/1006288410962/locations/global/workloadIdentityPools/github/providers/bakerrang-dev

GCP_DEPLOYER_SA=bakerrang-github-dev-deployer@bakerrang-dev.iam.gserviceaccount.com

AR_REPOSITORY=bakerrang-dev

API_SERVICE=bakerrang-api-dev
PORTAL_SERVICE=bakerrang-portal-dev
RENDERER_SERVICE=bakerrang-site-renderer-dev

NEXT_PUBLIC_API_BASE_URL=https://api-dev.bakerrang.com
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=https://sites-dev.bakerrang.com
NEXT_PUBLIC_SITE_API_BASE_URL=https://api-dev.bakerrang.com

CUSTOM_DOMAIN_IPV4_ADDRESS=8.232.231.135

PORTAL_BASE_URL=https://portal-dev.bakerrang.com
```

`CUSTOM_DOMAIN_CNAME_TARGET` is not currently configured.

Do not require it.

Zero Google credential Secrets.

---

# 4. Locked Artifact Registry layout

Use only:

```text
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev
```

Images:

```text
api
portal
site-renderer
```

Full targets:

```text
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/api
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/portal
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/site-renderer
```

Do NOT write to:

```text
cloud-run-source-deploy
```

The API currently runs an older image from that repository.

Its first automatic deployment will intentionally migrate the existing Cloud Run service to:

```text
.../bakerrang-dev/api@sha256:...
```

Do not copy old images.
Do not delete the old repository.

---

# 5. Runtime identities — must remain untouched

```text
bakerrang-api-dev
→ bakerrang-api-dev@bakerrang-dev.iam.gserviceaccount.com

bakerrang-portal-dev
bakerrang-site-renderer-dev
→ bakerrang-frontend-dev@bakerrang-dev.iam.gserviceaccount.com
```

Deployment must be image-only.

Never send:

```text
--service-account
--set-env-vars
--update-env-vars
--set-secrets
--ingress
--network
--vpc-connector
--memory
--cpu
--min
--max
--concurrency
```

Use only the image plus project/region/quiet flags.

---

# 6. Create workflow architecture

Create:

```text
.github/workflows/deploy-dev.yml
.github/workflows/_deploy-cloud-run.yml
```

Architecture:

```text
deploy-dev.yml
    push: main
    changes
    validate-api
    validate-platform
    deploy-api ───────┐
    deploy-portal ────┼→ reusable _deploy-cloud-run.yml
    deploy-renderer ──┘
    dev-deploy-passed
```

Future PROD must be able to call the same reusable deployment workflow.

Do not create three duplicated deployment workflows.

---

# 7. Existing classifier is authoritative

Reuse:

```text
scripts/ci/classify-changes.mjs
scripts/ci/classify-changes.test.mjs
```

Do NOT duplicate path rules in YAML.

Do NOT use GitHub `paths:` as another service dependency map.

Do NOT alter the classifier unless implementation exposes a genuine bug.

Run classifier tests before classifying every deployment push.

Unknown paths fail closed.

---

# 8. Push diff semantics

For `push` to `main`, use:

```text
github.event.before
github.sha
```

with:

```text
BEFORE..AFTER
```

NOT PR three-dot semantics.

Checkout:

```text
fetch-depth: 0
```

Use null-delimited changed files:

```text
git diff --name-only --diff-filter=ACDMRTUXB -z
```

---

# 9. IMPORTANT — real ancestry validation

Do not merely check that the `before` commit exists.

Before classifying, require:

```bash
git cat-file -e "${BEFORE}^{commit}"
git cat-file -e "${AFTER}^{commit}"

git merge-base --is-ancestor "$BEFORE" "$AFTER"
```

Fail closed if:

```text
BEFORE empty
BEFORE all zeros
either SHA missing
BEFORE is not an ancestor of AFTER
classifier fails
unknown path encountered
```

Do NOT translate an invalid range into deploy-all or deploy-none.

Normal protected-main pushes should satisfy this.

---

# 10. Deployment outputs

Use the existing classifier's:

```text
deploy_api
deploy_portal
deploy_renderer
```

These are the only service fan-out decisions.

A known docs/infrastructure-only push with all three false must:

```text
perform no validation requiring that service
perform no GCP auth
perform no Docker push
perform no Cloud Run update
end dev-deploy-passed green
```

---

# 11. Validation jobs

## API

If `deploy_api=true`:

```text
working-directory: server
npm ci
npm run lint
npm test
```

Node 24.

No GCP auth.

## Platform

If either:

```text
deploy_portal=true
deploy_renderer=true
```

run one shared platform validation:

```text
working-directory: platform
npm ci
npm run lint
npm run typecheck
npm test
```

Node 24.

Do not install platform dependencies independently for Portal and Renderer validation.

No GCP auth.

---

# 12. PR CI Docker packaging validation

Modify:

```text
.github/workflows/ci.yml
```

minimally.

Preserve all existing PR CI behavior and `ci-passed`.

Add no-push Docker packaging validation gated by existing **deploy** classifier outputs.

Do NOT authenticate to GCP.

Do NOT push images.

## API Docker validation

If:

```text
deploy_api=true
```

run the equivalent of:

```text
docker build server
```

using the actual API Dockerfile/context.

No build args.

## Portal Docker validation

If:

```text
deploy_portal=true
```

build from context:

```text
platform
```

Dockerfile:

```text
apps/portal/Dockerfile
```

using CI-safe values:

```text
NEXT_PUBLIC_API_BASE_URL=https://api.ci.invalid
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=https://sites.ci.invalid
```

Use the currently supported CI value for:

```text
CUSTOM_DOMAIN_IPV4_ADDRESS
```

only if needed by the Dockerfile.

Do not invent a required CNAME value.

## Renderer Docker validation

If:

```text
deploy_renderer=true
```

context:

```text
platform
```

Dockerfile:

```text
apps/site-renderer/Dockerfile
```

with:

```text
NEXT_PUBLIC_SITE_API_BASE_URL=https://api.ci.invalid
```

Images are discarded.

No registry auth.

---

# 13. Reusable workflow inputs

`_deploy-cloud-run.yml` should accept a small explicit contract such as:

```text
service
environment
image_tag
```

Allowed service values:

```text
api
portal
renderer
```

Environment currently:

```text
development
```

Do not pass dozens of env-specific values as workflow inputs.

The reusable workflow's deployment job must declare:

```text
environment: ${{ inputs.environment }}
```

so `vars.*` resolve from the GitHub Environment.

---

# 14. GitHub permissions

Classification/validation:

```yaml
permissions:
  contents: read
```

Actual deployment reusable job:

```yaml
permissions:
  contents: read
  id-token: write
```

Nothing broader.

PR CI remains without OIDC access.

---

# 15. Auth placement

Inside each actual service deployment job:

```text
checkout
stale-job guard
google-github-actions/auth@v3
google-github-actions/setup-gcloud@v3
gcloud auth configure-docker us-west1-docker.pkg.dev --quiet
build
push
deploy
verify
smoke
```

Do not authenticate in an early shared job and pass credential files between jobs.

---

# 16. IMPORTANT — concurrency correction

Do NOT use:

```yaml
cancel-in-progress: true
```

for deployments.

Remote Cloud Run mutations are not transactional with GitHub runner cancellation.

Use per-service concurrency:

```yaml
concurrency:
  group: deploy-${{ inputs.environment }}-${{ inputs.service }}
  cancel-in-progress: false
```

Examples:

```text
deploy-development-api
deploy-development-portal
deploy-development-renderer
```

Different services remain independent.

DEV and future PROD remain independent.

Do NOT add a cancelling whole-workflow concurrency group.

---

# 17. IMPORTANT — stale-job guard

Because deployment jobs queue independently, ensure an older queued job cannot overwrite a newer relevant service version.

At the beginning of each reusable deployment job, BEFORE WIF auth:

```text
fetch current origin/main
```

The triggering commit is:

```text
GITHUB_SHA
```

Determine current `origin/main`.

Cases:

## Case A — origin/main == GITHUB_SHA

Proceed.

## Case B — origin/main is a descendant of GITHUB_SHA

There are newer commits on main.

Calculate:

```text
GITHUB_SHA..origin/main
```

with a null-delimited diff.

Run the EXISTING classifier over that range.

Do not duplicate path mapping.

For the current service:

```text
api      → examine deploy_api
portal   → examine deploy_portal
renderer → examine deploy_renderer
```

If a newer commit affects the same service:

```text
this job is superseded
```

Exit successfully WITHOUT:

```text
WIF authentication
Docker build
Docker push
Cloud Run mutation
```

Write a clear job summary such as:

```text
Skipped as superseded by newer main commit <sha>
```

If newer commits do NOT affect this service:

```text
this SHA is still the latest relevant change for that service
```

Proceed.

## Case C — origin/main is NOT a descendant of GITHUB_SHA

Fail closed.

Do not deploy across rewritten/non-linear history.

This guard exists in addition to non-cancelling concurrency.

---

# 18. Concurrency/race invariant

The intended invariant is:

```text
latest relevant main commit per service wins
```

Example:

```text
A changes API + Portal
B later changes Portal only
```

Correct final state:

```text
API    = A
Portal = B
```

If A Portal is already running, it may finish before B.

Then B runs and becomes final.

If A Portal is still queued when B reaches main, A's stale guard may skip because B supersedes it.

API from A must not be skipped merely because B exists, because B did not affect API.

Do not use whole-run cancellation.

---

# 19. Docker image identity

Image repository:

```text
${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPOSITORY}/${IMAGE_NAME}
```

Invariant image names:

```text
api
portal
site-renderer
```

Tag:

```text
git-${GITHUB_SHA}
```

Deploy by digest:

```text
.../image@sha256:...
```

never by `latest`.

---

# 20. Treat SHA tag as write-once

Avoid intentionally overwriting:

```text
git-${GITHUB_SHA}
```

with a different image.

Before pushing, inspect whether that exact tag already exists.

If it already exists:

```text
resolve its digest
reuse it
do not overwrite the tag
```

This makes retries after a partially successful workflow safe.

If it does not exist:

```text
build
push once
resolve resulting registry digest
```

Do not rely on a mutable `latest` tag.

If implementing safe write-once behavior is technically awkward with current gcloud/AR tooling, report it rather than silently making the SHA tag mutable.

---

# 21. Build configuration

## API

Context:

```text
server
```

Dockerfile:

```text
server/Dockerfile
```

No build args.

## Portal

Context:

```text
platform
```

Dockerfile:

```text
platform/apps/portal/Dockerfile
```

Build args:

```text
NEXT_PUBLIC_API_BASE_URL=${{ vars.NEXT_PUBLIC_API_BASE_URL }}
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=${{ vars.NEXT_PUBLIC_SITE_PREVIEW_ORIGIN }}
CUSTOM_DOMAIN_IPV4_ADDRESS=${{ vars.CUSTOM_DOMAIN_IPV4_ADDRESS }}
```

Only include:

```text
CUSTOM_DOMAIN_CNAME_TARGET
```

if the Environment variable exists and is nonblank.

## Renderer

Context:

```text
platform
```

Dockerfile:

```text
platform/apps/site-renderer/Dockerfile
```

Build arg:

```text
NEXT_PUBLIC_SITE_API_BASE_URL=${{ vars.NEXT_PUBLIC_SITE_API_BASE_URL }}
```

Do not pass runtime renderer environment variables into the Docker build.

---

# 22. OCI traceability

Add lightweight OCI labels if straightforward:

```text
org.opencontainers.image.revision=${GITHUB_SHA}
org.opencontainers.image.source=<GitHub repository URL>
```

Do not introduce signing/provenance infrastructure yet.

Step 2.7 handles release hardening.

---

# 23. Cloud Run update

Use:

```bash
gcloud run services update "$SERVICE" \
  --image "$IMAGE_WITH_DIGEST" \
  --project "$PROJECT" \
  --region "$REGION" \
  --quiet
```

Image only.

Do NOT use:

```text
gcloud run deploy --source
```

---

# 24. Capture previous state

Before updating, capture at least:

```text
previous ready revision
previous image
runtime service account
```

This is for:

```text
job summary
manual rollback
post-deploy safety verification
```

Do not mutate traffic manually.

---

# 25. Post-update verification

After `services update`:

Resolve:

```text
latestReadyRevisionName
deployed container image
runtime service account
```

Assert:

```text
deployed image == expected @sha256 digest
runtime service account == pre-deploy runtime service account
```

Failure means deployment job fails.

The workflow must not report success merely because `gcloud run services update` returned zero.

---

# 26. Smoke tests

Use stable DEV domains.

Retry briefly for revision/edge warm-up.

## API

```text
https://api-dev.bakerrang.com/health
```

Require:

```text
HTTP 200
body == Healthy
```

or preserve the exact currently verified health assertion if source uses line ending/format variation.

## Portal

```text
https://portal-dev.bakerrang.com/
```

Require:

```text
HTTP 200
```

Do not require authenticated content.

## Renderer

```text
https://sites-dev.bakerrang.com/robots.txt
```

Require:

```text
HTTP 200
body contains User-agent
```

Do NOT smoke:

```text
https://sites-dev.bakerrang.com/
```

because that correctly returns 404 without a tenant route.

---

# 27. Failure behavior

Any failure in:

```text
validation
stale-range classification
Docker build
Docker push
digest resolution
Cloud Run update
digest verification
runtime-SA verification
HTTP smoke
```

must fail visibly.

Do NOT automatically roll back in Step 2.4.

Formal rollback automation remains Step 2.7.

If smoke fails after Cloud Run becomes ready, DEV may temporarily be on the bad revision; record enough previous revision information for human rollback/fix-forward.

---

# 28. Job summary

Each actual deployment should write a compact summary containing:

```text
service
trigger SHA
image digest
previous revision
new ready revision
runtime SA unchanged?
smoke result
```

Superseded deployment jobs should clearly say:

```text
Skipped — newer main commit affects this service
```

Do not dump credentials, tokens, or excessive Cloud Run configuration.

---

# 29. Final status job

Add:

```text
dev-deploy-passed
```

with:

```yaml
if: always()
```

It should consider:

```text
changes
validate-api
validate-platform
deploy-api
deploy-portal
deploy-renderer
```

Success when:

```text
changes succeeded
and every relevant validation/deployment succeeded
or was legitimately skipped
```

Failure when:

```text
classification failed
validation failed
affected deployment failed
```

Docs-only push:

```text
green
```

This is operational visibility, not branch protection.

---

# 30. Manual fallback — INSPECT, do not assume

Inspect:

```text
scripts/deploy-dev.ps1
```

Claude believed no change was required.

Verify that independently.

In particular, inspect the API Artifact Registry destination.

The normal automated path is now:

```text
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/api
```

If `deploy-dev.ps1` would manually deploy the API back to:

```text
cloud-run-source-deploy
```

or another obsolete image path, update the script so the emergency/manual fallback follows the same image convention.

If it already uses the correct destination or derives it appropriately, leave it unchanged.

Do not remove manual deployment support.

If modified, preserve all existing runtime configuration behavior.

---

# 31. Documentation

Create/update:

```text
docs/CI-CD.md
```

Keep it operational and concise.

Document:

```text
PR CI
main → automatic DEV deploy
classifier-based fan-out
WIF/no credential keys
Artifact Registry image layout
image-only Cloud Run updates
manual deploy-dev.ps1 fallback
DEV smoke checks
manual rollback concept
```

Do not document nonexistent PROD automation as if it already exists.

You may describe PROD reuse as future work.

---

# 32. No product changes

Do not modify application functionality.

Existing:

```text
API /health
Renderer /robots.txt
Portal root
```

are sufficient.

No new health endpoints.

---

# 33. Local development remains unchanged

Do not modify local `.env` contracts or require:

```text
GCP
WIF
GitHub Actions
Artifact Registry
Cloud Run
```

for normal local startup.

---

# 34. No infrastructure management

Do NOT modify:

```text
IAM
WIF
Google APIs
Secret Manager
Firestore
Cloud Run runtime env
runtime service accounts
DNS
load balancer
certificates
Terraform
GitHub Environment variables/settings
```

Repository code only.

---

# 35. Action versions

Use the current Node-24-compatible versions already established:

```text
actions/checkout@v7
actions/setup-node@v7
google-github-actions/auth@v3
google-github-actions/setup-gcloud@v3
```

Prefer ordinary Docker CLI rather than adding Docker Actions unless there is a concrete technical reason.

If adding any new Action, verify its current runtime/major.

---

# 36. Static verification

Run at minimum:

```text
classifier tests
full tracked-path classifier audit
backend lint
backend tests
platform lint
platform typecheck
platform tests
PR-CI Docker builds for affected services where feasible
workflow YAML parsing
git diff --check
```

Verify:

```text
ci.yml still has NO id-token permission
deploy workflows have id-token only in actual deploy jobs
no credentials_json
no Google credential Secrets
no `latest` deployment
no gcloud run deploy --source
no runtime configuration flags
no Terraform
no PROD resources/config
```

---

# 37. Simulate classifier cases

Statically or with the existing classifier test harness verify:

```text
server-only
→ deploy API only

portal-only
→ deploy Portal only

renderer-only
→ deploy Renderer only

site-schema
→ Portal + Renderer

ui
→ Portal + Renderer

site-components
→ Renderer only

docs/workflow-only
→ zero services

unknown path
→ failure
```

---

# 38. Inspect stale-job logic carefully

Test/simulate at least these cases:

```text
GITHUB_SHA == origin/main
→ deploy

newer main commit affects same service
→ skip successfully before auth

newer main commit affects different service only
→ deploy current service

GITHUB_SHA not ancestor of origin/main
→ fail closed

unknown path in newer range
→ fail closed
```

Do not claim concurrency safety without demonstrating these cases against the implemented logic.

---

# 39. Expected files

Likely:

```text
.github/workflows/deploy-dev.yml
.github/workflows/_deploy-cloud-run.yml
.github/workflows/ci.yml
docs/CI-CD.md
```

Possibly:

```text
scripts/deploy-dev.ps1
```

only if its API image target needs alignment.

Expected unchanged:

```text
scripts/ci/classify-changes.mjs
```

unless a genuine defect is discovered.

No product files.

---

# 40. Return report

Return:

1. files created/modified
2. final job graph
3. push-range implementation
4. ancestry guard
5. classifier reuse
6. PR Docker-validation changes
7. reusable workflow inputs
8. per-service concurrency implementation
9. stale-job implementation
10. race-condition test results
11. Docker auth implementation
12. image repository/tag/digest implementation
13. SHA-tag write-once/retry behavior
14. Portal build args
15. Renderer build args
16. API build details
17. exact Cloud Run update command
18. runtime-SA preservation check
19. smoke assertions
20. failure behavior
21. final `dev-deploy-passed` logic
22. `deploy-dev.ps1` inspection/result
23. docs changes
24. classifier test/audit results
25. backend verification
26. platform verification
27. Docker verification
28. workflow YAML/static verification
29. `git diff --check`
30. confirmation no cloud/GitHub settings/Product/PROD/Terraform mutation occurred
31. anything blocking the first live DEV deployment