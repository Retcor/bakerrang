# Step 2.5e Phase B — Retire DEV Deployment Entrypoints + Capture History

Implement ONLY repository-side Phase B of Step 2.5e.

Do NOT modify GCP.
Do NOT delete cloud resources.
Do NOT modify DNS.
Do NOT modify IAM.
Do NOT modify GitHub Environments/settings.
Do NOT deploy anything.

MAIN is now the sole deployed environment.

bakerrang-dev remains as LOCAL DATA BACKING ONLY:

- Firestore `(default)`
- gs://bakerrang-dev-media-marketing
- developer ADC

---

## 1. Remove obsolete DEV cloud-deployment entrypoints

Delete if they actually exist:

.github/workflows/deploy-dev.yml
.github/workflows/verify-gcp-auth-dev.yml
scripts/deploy-dev.ps1

Do NOT remove local-development assets.

Do NOT remove any MAIN workflow.

---

## 2. CRITICAL classifier tombstone

Claude suggested pruning the existing exact classifier rule for:

scripts/deploy-dev.ps1

DO NOT DO THAT in this change.

The commit that deletes scripts/deploy-dev.ps1 itself contains that path in the before..after range.

Automatic MAIN deployment uses the NEW classifier to classify that range.

If the exact rule is removed simultaneously, the deleted path could become unknown and the fail-closed classifier would make the activation push fail.

Therefore:

KEEP the exact no-service classification rule for:

scripts/deploy-dev.ps1

even though the file is now deleted.

Add a brief code comment if appropriate explaining that this is an intentional historical/tombstone path so deletion/historical ranges remain classifiable.

Do not broaden it to arbitrary scripts.

---

## 3. Update deployment workflow tests

`scripts/ci/deployment-workflows.test.mjs` currently references deploy-dev.yml.

Update tests for the new steady state:

- deploy-dev.yml does NOT exist
- verify-gcp-auth-dev.yml does NOT exist if removed
- MAIN deploy.yml remains:
    - push main automatic selective deployment
    - workflow_dispatch manual single-service deployment
- PR CI remains unchanged/no OIDC
- no workflow can deploy DEV
- no workflow references GitHub Environment `development`
- no DEV WIF/provider/service variables remain required by active workflows

Add an explicit deterministic test for the EXACT Phase B changed-path set:

.github/workflows/deploy-dev.yml          [deleted]
.github/workflows/verify-gcp-auth-dev.yml [deleted if present]
scripts/deploy-dev.ps1                   [deleted]
scripts/ci/deployment-workflows.test.mjs
docs/...

This set MUST classify as:

deploy_api=false
deploy_portal=false
deploy_renderer=false
deploy_client=false
unknown=[]

This proves merging Phase B will NOT deploy MAIN.

---

## 4. Preserve automatic MAIN

Do not change the existing proven MAIN deployment semantics.

push main
→ classifier
→ selective live deployment

workflow_dispatch
→ manual one-service MAIN deployment

Deployment smoke remains Cloud Run status.url.

No changes to:

.github/workflows/_deploy-cloud-run.yml

unless absolutely necessary; explain if you believe one is required before touching it.

---

## 5. Update CI/CD docs

Update:

docs/CI-CD.md

Final truth:

MAIN:
- sole deployed environment
- push main → automatic selective deployment
- workflow_dispatch → manual single-service deployment

DEV:
- NO cloud deployment workflow
- local-data backing only
- no GitHub deployment path

Local:
- processes run locally
- Firestore → bakerrang-dev
- media → bakerrang-dev-media-marketing
- ADC
- no WIF
- no Cloud Run
- no LB

---

## 6. Preserve DEV deployment history

Do NOT erase useful infrastructure history.

For:

docs/DEV-DEPLOYMENT.md

prefer marking it clearly:

RETIRED / HISTORICAL

State that the deployed DEV environment was retired in Step 2.5e.

Do not present its commands as the current deployment model.

---

## 7. Record actual DEV inventory BEFORE deletion

Update:

docs/infra/live-environment-bootstrap.md

Before any GCP resource is deleted, capture the actual verified DEV resources for historical/reconstruction purposes.

Record names only, never secret values.

Include:

Project:
bakerrang-dev

Cloud Run:
bakerrang-api-dev
bakerrang-portal-dev
bakerrang-site-renderer-dev

DEV LB:
bakerrang-web-dev-https-rule
bakerrang-web-dev-https-proxy
bakerrang-web-dev-map

Backends:
bakerrang-api-dev-backend
bakerrang-portal-dev-backend
bakerrang-renderer-dev-backend

NEGs:
bakerrang-api-dev-neg
bakerrang-portal-dev-neg
bakerrang-renderer-dev-neg

Static IP:
bakerrang-web-dev-ip
8.232.231.135

Certificate Manager:
bakerrang-dev-wildcard
bakerrang-web-dev-cert-map
bakerrang-dev-cert
bakerrang-dev-auth

WIF:
pool github
provider bakerrang-dev

DEV SAs:
bakerrang-api-dev@
bakerrang-frontend-dev@
bakerrang-github-dev-deployer@

Artifact Registry:
bakerrang-dev
cloud-run-source-deploy

Source staging bucket:
run-sources-bakerrang-dev-us-west1

Secret Manager NAMES ONLY:
the eight verified bakerrang-dev-* secret resources

Keep:
bakerrang-dev project
Firestore `(default)`
bakerrang-dev-media-marketing

State explicitly:

"DEV deployment infrastructure was retired in Step 2.5e.
The bakerrang-dev project remains as local-development data backing only."

---

## 8. Local-development docs

Update:

docs/infra/local-development.md

only if needed.

Claude found one documentation gap:

add an explicit Portal local-development subsection based on the actual:

platform/apps/portal/.env.local.example

and current source.

Preserve:

API:
FIRESTORE_PROJECT_ID=bakerrang-dev
MEDIA_BUCKET_NAME=bakerrang-dev-media-marketing

Client:
VITE_API_BASE_URL=http://localhost:8080

Renderer:
local API origins
SITE_PUBLIC_INDEXING_ENABLED=false

Custom host testing:
acme.local or test.localhost

No public DEV DNS required.

---

## 9. Do NOT touch

Do not change/delete:

bakerrang-dev Firestore
bakerrang-dev-media-marketing
developer IAM
MAIN workflows
MAIN infrastructure
MAIN DNS
MAIN Certificate Manager
MAIN service accounts
application feature code
dependencies
secret values

---

## 10. Verification

Run:

deployment workflow/static tests
classifier tests
stale guard tests

backend lint/tests
platform lint/typecheck/tests
client lint/build

YAML parse

git diff --check
credential scan

Also explicitly prove:

- no active workflow references development Environment
- no active workflow references DEV WIF
- no active workflow references DEV Cloud Run service names
- exact Phase B diff classifies as no-service
- merging this commit cannot deploy DEV
- merging this commit cannot deploy MAIN

---

## 11. Report

Return:

1. files deleted
2. files modified
3. classifier tombstone confirmation
4. exact Phase B merge classification
5. active workflow inventory after cleanup
6. DEV deployment references remaining intentionally as history
7. local-development contract
8. infrastructure history captured
9. tests/results
10. whether Phase B merge can deploy MAIN
11. whether any DEV deployment entrypoint remains
12. blockers
13. whether safe to merge

No deployment.
No external mutation.