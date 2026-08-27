# Planning Task — Step 2.4: Automatic Selective DEV Deployment from `main`

Do NOT modify code, GitHub settings, IAM, Artifact Registry, or Cloud Run.

This is a planning/discovery task only.

We are continuing BakerRang Step 2.

Completed and live-verified:

```text
2.1 CI/CD Architecture & Monorepo Dependency Graph
2.2 PR CI + Centralized Change Detection
2.2a Backend Lint Baseline Cleanup
2.3 GitHub → GCP Workload Identity Federation (DEV)
```

The next task is:

# 2.4 — Automatic Selective DEV Deployment from `main`

Goal:

```text
PR → main
    ↓
existing required PR CI
    ↓
merge
    ↓
push event on main
    ↓
centralized change classifier
    ↓
validate affected service(s)
    ↓
build only affected image(s)
    ↓
push immutable image(s)
    ↓
update only affected DEV Cloud Run service(s)
    ↓
read-only/smoke verification
```

No PROD work.

---

# 1. Locked branch model

```text
feature branch
    ↓ PR
main
    ↓ automatic DEV deployment

main
    ↓ future PR
production
    ↓ future PROD deployment
```

`main` is DEV truth.

Do not rename branches.

Existing PR CI targets:

```text
main
production
```

and has a stable required result:

```text
ci-passed
```

PR CI is already working in GitHub.

---

# 2. Existing centralized classifier

The classifier already exists:

```text
scripts/ci/classify-changes.mjs
scripts/ci/classify-changes.test.mjs
```

It is the **single source of truth** for both CI and deployment fan-out.

It emits separate CI and deployment outputs.

Do NOT introduce GitHub `paths:` filters or another independent service-change map.

The deployment workflow must reuse this classifier.

Current important deployment fan-out includes:

```text
server/**                        → API

platform/apps/portal/**          → Portal
platform/apps/site-renderer/**   → Renderer

platform/packages/site-schema/** → Portal + Renderer
platform/packages/ui/**          → Portal + Renderer
platform/packages/site-components/**
                                  → Renderer

platform/package.json
platform/package-lock.json
platform/.dockerignore
platform/scripts/config-validation.mjs
platform/tsconfig.base.json
                                  → Portal + Renderer

server/.dockerignore             → API
```

Unknown paths fail closed.

Preserve that property.

Inspect the actual current classifier rather than relying only on this summary.

---

# 3. Existing DEV project

```text
GCP project: bakerrang-dev
Project number: 1006288410962
Region: us-west1
```

Cloud Run:

```text
bakerrang-api-dev
bakerrang-portal-dev
bakerrang-site-renderer-dev
```

Stable public URLs:

```text
https://api-dev.bakerrang.com
https://portal-dev.bakerrang.com
https://sites-dev.bakerrang.com
```

LB IP:

```text
8.232.231.135
```

---

# 4. Existing runtime service accounts

Current Cloud Run runtime identities:

```text
bakerrang-api-dev
    → bakerrang-api-dev@bakerrang-dev.iam.gserviceaccount.com

bakerrang-portal-dev
bakerrang-site-renderer-dev
    → bakerrang-frontend-dev@bakerrang-dev.iam.gserviceaccount.com
```

These runtime identities must NOT change.

Deployment identity and runtime identity remain separate.

---

# 5. Existing GitHub WIF identity

Step 2.3 is live and verified.

GitHub:

```text
Owner: Retcor
Owner immutable ID: 2282360

Repository: Retcor/bakerrang
Repository immutable ID: 715929041
```

DEV WIF:

```text
Pool:
github

Provider:
bakerrang-dev

Deployer SA:
bakerrang-github-dev-deployer@bakerrang-dev.iam.gserviceaccount.com
```

Google trust condition requires:

```text
repository_owner_id == 2282360
repository_id       == 715929041
ref                 == refs/heads/main
```

The provider exists only in `bakerrang-dev`.

Future PROD will have its own WIF pool/provider in its own project.

Do NOT design a shared DEV/PROD pool.

---

# 6. Current deployer permissions

Step 2.3 intentionally granted almost nothing.

Current deployer has:

```text
roles/iam.workloadIdentityUser
```

through the repository-ID-scoped WIF principalSet.

It also has temporary read-only:

```text
roles/run.viewer
```

on:

```text
bakerrang-api-dev
```

only.

Step 2.4 will add actual deployment permissions.

Re-inspect current IAM read-only before proposing mutations.

---

# 7. Step 2.4 least-privilege target

Expected eventual permissions:

## Artifact Registry

Prefer:

```text
roles/artifactregistry.writer
```

on the single DEV repository actually used by CI.

Do NOT grant project-wide Artifact Registry writer unless technically required.

## Cloud Run

Strong preference:

```text
roles/run.developer
```

on only these three Cloud Run services:

```text
bakerrang-api-dev
bakerrang-portal-dev
bakerrang-site-renderer-dev
```

rather than project-wide.

Verify from current Google IAM documentation whether service-level binding supports every permission needed by:

```text
gcloud run services describe
gcloud run services update --image
```

If it does, use service-level bindings.

If it does not, explain exactly which required permission forces broader scope.

## Runtime service accounts

Expected resource-level:

```text
roles/iam.serviceAccountUser
```

on only:

```text
bakerrang-api-dev@bakerrang-dev.iam.gserviceaccount.com
bakerrang-frontend-dev@bakerrang-dev.iam.gserviceaccount.com
```

Do NOT grant project-level `serviceAccountUser`.

Verify whether `gcloud run services update --image` still requires `actAs` when the service account is not explicitly changed.

Return the evidence/recommendation.

---

# 8. Temporary `run.viewer`

Once `roles/run.developer` is correctly granted to the API service, determine whether the Step 2.3 service-level:

```text
roles/run.viewer
```

binding is redundant.

If `run.developer` includes the required read permissions, recommend removing the temporary viewer binding during 2.4 bootstrap.

Avoid unnecessary duplicate IAM.

---

# 9. Artifact Registry decision — LOCKED

Current discovery showed:

```text
API:
us-west1-docker.pkg.dev/bakerrang-dev/cloud-run-source-deploy/bakerrang-api-dev

Portal:
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/portal

Renderer:
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/site-renderer
```

The API currently lives in the auto-created:

```text
cloud-run-source-deploy
```

repository.

We are NOT keeping that architecture for GitHub deployments.

The target is the existing purpose-built repository:

```text
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev
```

with image names:

```text
api
portal
site-renderer
```

Therefore future image paths become:

```text
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/api
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/portal
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/site-renderer
```

The first automatic API deployment may simply update the existing Cloud Run service from its old image repository to:

```text
bakerrang-dev/api@sha256:...
```

Do NOT copy or migrate old API images unless there is a concrete rollback requirement.

Do NOT delete `cloud-run-source-deploy` in Step 2.4.

Do NOT grant the GitHub deployer writer access to `cloud-run-source-deploy` unless you discover a real need.

---

# 10. Immutable image policy

Do not deploy `latest`.

Build images from the merged commit.

Use an immutable commit-related tag, for example:

```text
git-<full-github-sha>
```

or another deterministic SHA tag.

Then determine the pushed image digest and deploy:

```text
IMAGE@sha256:...
```

not merely the mutable tag.

The Cloud Run revision should therefore record the exact image digest.

Return the exact mechanism for obtaining the pushed Artifact Registry digest reliably.

Prefer simple official Docker/gcloud tooling over unnecessary third-party Actions.

---

# 11. Docker authentication

Design the minimum clean path for:

```text
GitHub WIF
→ gcloud
→ Artifact Registry Docker authentication
```

Likely:

```text
google-github-actions/auth
google-github-actions/setup-gcloud
gcloud auth configure-docker us-west1-docker.pkg.dev
```

Verify current recommended behavior.

No Docker Hub credentials.

No Google JSON credentials.

---

# 12. Existing Dockerfiles

Inspect the actual current Dockerfiles and build contexts.

Expected conceptually:

```text
server/Dockerfile

platform/apps/portal/Dockerfile
platform/apps/site-renderer/Dockerfile
```

but inspect reality.

Confirm exact build commands and contexts.

Important:

```text
API context       = server
Portal context    = platform
Renderer context  = platform
```

or report corrections.

Do not modify them during planning.

---

# 13. Portal build arguments

Current Portal container contract includes build-time:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN
CUSTOM_DOMAIN_IPV4_ADDRESS
```

and possibly optional:

```text
CUSTOM_DOMAIN_CNAME_TARGET
```

Current DEV values are:

```text
NEXT_PUBLIC_API_BASE_URL=https://api-dev.bakerrang.com
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=https://sites-dev.bakerrang.com
CUSTOM_DOMAIN_IPV4_ADDRESS=8.232.231.135
```

Inspect the Dockerfile/config validation for the exact argument names.

Do not guess.

Determine whether optional CNAME should simply be omitted when unset.

---

# 14. Renderer build arguments

Renderer currently requires build-time:

```text
NEXT_PUBLIC_SITE_API_BASE_URL
```

Current DEV:

```text
https://api-dev.bakerrang.com
```

Inspect actual Dockerfile/config validation.

Runtime remains separately configured on Cloud Run with:

```text
SITE_API_BASE_URL
SITE_PUBLIC_ORIGIN
SITE_PUBLIC_INDEXING_ENABLED
```

The deployment workflow MUST NOT rewrite those runtime variables.

---

# 15. API build

Inspect the API Dockerfile.

Confirm:

```text
Node version
working directory
npm ci behavior
startup command
Docker context assumptions
```

No runtime env/secrets should be baked into the image.

---

# 16. Runtime configuration must remain untouched

This is a hard boundary.

Automatic deployment performs:

```text
gcloud run services update SERVICE --image IMAGE@DIGEST
```

or an equivalent image-only operation.

It must NOT send:

```text
--set-env-vars
--update-env-vars
--set-secrets
--service-account
--ingress
--network
--vpc-connector
--memory
--cpu
--min
--max
--concurrency
```

unless a technical discovery proves `--image` alone is insufficient.

The goal is:

```text
new application image
same service configuration
```

Verify that image-only update preserves current Cloud Run runtime settings.

---

# 17. GitHub Environment

Existing Environment:

```text
development
```

Existing non-secret variables:

```text
GCP_PROJECT_ID=bakerrang-dev
GCP_PROJECT_NUMBER=1006288410962
GCP_REGION=us-west1

WIF_PROVIDER=projects/1006288410962/locations/global/workloadIdentityPools/github/providers/bakerrang-dev

GCP_DEPLOYER_SA=bakerrang-github-dev-deployer@bakerrang-dev.iam.gserviceaccount.com
```

No Google credential Secrets.

Plan additional Step 2.4 Environment variables.

Candidates include:

```text
AR_REPOSITORY
API_SERVICE
PORTAL_SERVICE
RENDERER_SERVICE

NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN
NEXT_PUBLIC_SITE_API_BASE_URL
CUSTOM_DOMAIN_IPV4_ADDRESS
CUSTOM_DOMAIN_CNAME_TARGET
```

Use names that are understandable and reusable for future PROD.

Avoid putting environment-specific values directly in a reusable workflow when Environment vars are more appropriate.

At the same time, do not make simple invariant image names unnecessarily configurable.

Return a clean inventory.

---

# 18. Workflow architecture from Step 2.1

Step 2.1 recommended:

```text
deploy-dev.yml
shared reusable Cloud Run deployment workflow
```

Expected conceptually:

```text
.github/workflows/deploy-dev.yml
.github/workflows/_deploy-cloud-run.yml
```

Re-evaluate exact file names, but preserve the architecture:

```text
one DEV orchestration workflow
one reusable per-service build/deploy workflow
```

The future PROD workflow should be able to reuse the same deployment workflow.

Do NOT create three nearly-identical deploy workflows.

---

# 19. DEV workflow trigger

Automatic DEV deployment should trigger on:

```yaml
push:
  branches:
    - main
```

No manual-only deployment as the primary path.

A manual `workflow_dispatch` can exist only if there is a clear safe use case, but avoid creating a second path that bypasses normal branch truth.

`main` remains deployment truth.

The existing:

```text
scripts/deploy-dev.ps1
```

remains the human emergency/manual fallback.

Do not remove it.

---

# 20. Push-diff calculation

PR CI currently uses base/head PR SHAs.

DEV deployment is different.

For:

```text
push to main
```

design the correct changed-file range using:

```text
github.event.before
github.sha
```

or an equivalent correct mechanism.

For an ordinary PR merge, we want all changes introduced to `main` by that push.

Do NOT reuse PR three-dot semantics blindly.

Evaluate:

```text
before..after
```

for push events.

Handle edge cases:

```text
all-zero before SHA
force push
manual push containing multiple commits
```

`main` is expected to be protected, but the workflow should fail safely rather than silently deploy everything based on a malformed range.

Use null-delimited filenames exactly like PR CI.

---

# 21. Classifier tests during deploy workflow

The classifier unit tests should run before actual change classification.

A broken classifier must prevent deployment.

Unknown paths must prevent deployment.

Do not silently translate classifier failure to:

```text
deploy everything
```

or:

```text
deploy nothing
```

Fail closed.

---

# 22. Validation before build/deploy

Even though PR CI already ran, the deployment workflow should independently validate the merged commit before deployment.

Expected:

## API affected

```text
npm ci
npm run lint
npm test
```

inside `server`.

Then Docker build.

## Portal and/or Renderer affected

One platform install:

```text
npm ci
lint
typecheck
test
```

Then only affected Docker image builds.

Avoid installing the same platform dependencies multiple times unnecessarily if orchestration can reasonably share validation.

However, do not sacrifice clean independent service deploy jobs solely to save a few minutes.

Return the best balance.

---

# 23. Docker validation gap from 2.2 audit

The Step 2.2 audit noted that PR CI did not yet perform Docker builds.

Now that automatic deployment is being added, explicitly decide how to address:

```text
PR green
merge
Docker build fails in DEV deploy
```

Options include:

A. Add conditional no-push Docker validation to PR CI.

B. Accept Docker build as deployment-stage validation because a failure prevents Cloud Run update.

C. Another minimal solution.

Given that we are building a reliable product, recommend one.

If modifying `ci.yml`, keep changes tightly scoped and preserve the existing classifier architecture.

Do not add expensive unconditional Docker builds without justification.

---

# 24. Per-service independence

If a merge affects:

```text
API
Portal
Renderer
```

they should not unnecessarily serialize.

Preferred behavior:

```text
shared classification/validation
        ↓
API deploy       ┐
Portal deploy    ├ independently
Renderer deploy  ┘
```

One failing deployment should not prevent an unrelated affected service from attempting its deployment unless the failure is in a genuinely shared prerequisite.

Do NOT use fail-fast behavior across independent services.

Explain the job graph.

---

# 25. Same-service concurrency

Two merges to `main` can occur close together.

Prevent an older API deployment from racing a newer API deployment.

Likewise Portal and Renderer independently.

Design per-service concurrency such as conceptually:

```text
dev-deploy-api
dev-deploy-portal
dev-deploy-renderer
```

Evaluate:

```text
cancel-in-progress: true
```

vs:

```text
false
```

The desired invariant is:

```text
newer main commit must not be overwritten by an older deployment finishing later
```

Explain how your design guarantees that.

Be careful about reusable workflow concurrency semantics.

---

# 26. Partial multi-service deployment

Example:

Commit A changes API + Portal.

Then commit B changes Portal only while A is still running.

We must not accidentally end with:

```text
API from A
Portal from A
```

after B has already deployed newer Portal.

Work through this race explicitly.

The latest relevant `main` commit for each service should win.

---

# 27. Image build strategy

Prefer the simplest reliable approach.

Evaluate:

```text
docker build
docker push
```

using Docker preinstalled on GitHub-hosted Ubuntu

versus:

```text
docker/build-push-action
```

Do not add extra Actions merely for fashion.

If build caching materially improves this monorepo workflow, explain a safe cache strategy.

Correctness first.

---

# 28. Image metadata

At minimum retain traceability to:

```text
GitHub SHA
repository
workflow run
```

through image tag and/or OCI labels.

Do not over-engineer provenance in 2.4 if it belongs in later release-hardening.

No signing requirement yet unless existing infrastructure already supports it cheaply.

---

# 29. Deployment command

Strong preference:

```text
gcloud run services update <service> `
  --image <image>@sha256:<digest> `
  --project bakerrang-dev `
  --region us-west1
```

Use Linux shell syntax inside Actions, of course.

Do not use:

```text
gcloud run deploy --source
```

The GitHub workflow builds the container.

Inspect whether `services update --image` is the correct current command and whether it creates/activates a new revision as expected.

---

# 30. Cloud Run traffic

Step 2.4 is simple deployment, not canary release management.

Expected:

```text
new ready revision receives normal service traffic
```

using existing Cloud Run behavior.

Do not design traffic splitting yet.

Step 2.7 is release/rollback hardening.

Verify no existing manual traffic allocation would make `services update --image` behave unexpectedly.

Inspect current DEV traffic state read-only.

---

# 31. Smoke verification

Design a meaningful smoke test after each service deployment.

Do NOT merely check that `gcloud run services update` exited zero.

At minimum verify:

```text
latest ready revision uses expected digest
```

and perform an HTTP request where practical.

Known candidates:

## API

```text
https://api-dev.bakerrang.com/health
```

Expected 200.

## Portal

Investigate the actual stable unauthenticated behavior of:

```text
https://portal-dev.bakerrang.com/
```

or another safe route.

Determine expected status/content.

## Renderer

Investigate a stable host-level endpoint such as:

```text
https://sites-dev.bakerrang.com/robots.txt
```

or another route that does not depend on a specific mutable tenant record.

Determine a reliable smoke check from actual source/live DEV.

Do not invent a tenant ID.

Return exact status/content assertions.

---

# 32. Load balancer vs direct run.app verification

Evaluate whether smoke should hit:

```text
stable *.bakerrang.com DEV URLs
```

or:

```text
Cloud Run service run.app URL
```

or both.

The stable domains test the real user path including load balancer/routing.

The run.app URL may isolate Cloud Run from edge routing.

Recommend the minimum useful combination.

Do not make deployment success depend on fragile application data.

---

# 33. Revision/digest verification

After deployment, verify Cloud Run actually references the expected new image digest.

Return exact `gcloud` describe/query command.

A workflow should not say deployment succeeded if Cloud Run still points at another image.

---

# 34. Failure behavior

If:

```text
validation fails
build fails
push fails
Cloud Run update fails
smoke fails
```

the workflow must fail visibly.

For Step 2.4, determine whether a smoke failure should:

A. automatically roll traffic back

or

B. leave the failed workflow visible and rely on manual rollback / fix-forward, with automatic rollback deferred to Step 2.7.

The roadmap currently reserves formal rollback hardening for Step 2.7.

Recommend one and explain the operational consequence.

Do not silently swallow smoke failures.

---

# 35. Previous-revision information

Even if automatic rollback is deferred, consider recording in the GitHub job summary:

```text
service
previous revision
new revision
image digest
commit SHA
smoke result
```

This would make manual rollback much easier.

Keep it simple.

---

# 36. GitHub final status

Design a stable final job/result, conceptually:

```text
dev-deploy-passed
```

It should run with:

```text
if: always()
```

and distinguish:

```text
docs-only/no-service push       → success
all affected deployments green → success
classification failure          → failure
validation failure              → failure
affected deploy failure         → failure
```

This does not need to be a branch-protection check because it runs after merge.

It is primarily an operationally clear summary.

Recommend whether to include it.

---

# 37. Docs-only push

If a `main` push changes only known no-service files:

```text
classification succeeds
zero service builds
zero service deployments
workflow ends green
```

No WIF authentication should be required if nothing deploys unless there is a concrete reason.

Avoid unnecessary Google auth on docs-only changes.

---

# 38. GitHub permissions

Deploy jobs need:

```yaml
permissions:
  contents: read
  id-token: write
```

Do not add broad permissions.

Classification/validation jobs that do not authenticate should remain:

```yaml
contents: read
```

if job-level permissions allow this cleanly.

PR CI continues with no OIDC access.

---

# 39. GitHub Environment security

Deploy jobs use:

```text
environment: development
```

No required reviewer because DEV must deploy automatically.

Environment variables are non-secret.

Zero Google credential Secrets.

Do not introduce long-lived credentials.

---

# 40. WIF auth placement

Each actual deployment job/reusable workflow invocation should authenticate close to the operation that needs GCP.

Do not authenticate in an early shared job and attempt to pass Google credentials to later jobs.

Federated credentials are short-lived and job-local.

---

# 41. Temporary credential file

Step 2.3 already added:

```text
gha-creds-*.json
```

to:

```text
.gitignore
server/.dockerignore
platform/.dockerignore
```

Confirm this is sufficient for Docker build contexts.

Do not remove it.

---

# 42. Local development

This automation must have zero requirement for local developers to use:

```text
GitHub Actions
WIF
Terraform
Artifact Registry
Cloud Run
```

Normal local `.env` / `.env.local` workflows remain unchanged.

The CI/CD system must not become a prerequisite for local startup.

---

# 43. Manual DEV deployment fallback

Existing:

```text
scripts/deploy-dev.ps1
```

must remain available.

Evaluate whether Step 2.4 requires updating it so its image naming matches the new Artifact Registry convention.

Do NOT remove manual deployment capability.

Prefer GitHub automation as normal path and PowerShell script as emergency/manual path.

If the script currently uses different mechanisms, inspect and recommend whether to update now or defer.

---

# 44. No runtime configuration management in CI

Environment/secrets remain configured out-of-band.

The GitHub deploy workflow should not become infrastructure-as-code.

Do NOT manage:

```text
Secret Manager values
Cloud Run env vars
service accounts
load balancer
DNS
certificates
Firestore
buckets
```

from deploy jobs.

Step 2.5 handles Terraform/PROD infrastructure separately.

---

# 45. No Terraform yet

Step 2.4 does NOT introduce Terraform.

The locked strategy remains:

```text
DEV manually provisioned
do not import DEV into Terraform

Step 2.5:
Terraform for new PROD + CI/CD identity infrastructure
```

Do not change this.

---

# 46. No PROD resources

Absolutely no:

```text
bakerrang-prod
production GitHub Environment
prod service account
prod WIF
prod Artifact Registry
prod Cloud Run
prod DNS
```

in 2.4.

---

# 47. Bootstrap commands

After discovery, provide exact **PowerShell-friendly** human commands for the 2.4 IAM changes.

The operator uses Windows PowerShell.

Do not return Bash continuation syntax for human bootstrap.

Commands should:

1. verify current account/project
2. inspect before mutation
3. add Artifact Registry writer on only `bakerrang-dev` repo
4. add Cloud Run developer at the narrowest valid scope
5. add serviceAccountUser on the two runtime SAs
6. remove temporary API `run.viewer` if now redundant
7. verify resulting bindings

Every GCP mutation must explicitly target:

```text
bakerrang-dev
```

where possible.

No destructive replace/delete behavior.

---

# 48. GitHub Environment configuration

Return the exact additional variables to add to:

```text
development
```

Distinguish:

```text
already present
new for 2.4
optional
```

No secrets.

Prefer a manageable set, not dozens of tiny variables.

---

# 49. Expected repository changes

Likely candidates:

```text
.github/workflows/deploy-dev.yml
.github/workflows/_deploy-cloud-run.yml
possibly .github/workflows/ci.yml for Docker validation
possibly scripts/deploy-dev.ps1
possibly docs/CI-CD.md
```

Do not modify classifier unless discovery proves a genuine missing mapping.

No product code unless a reliable health endpoint absolutely requires one; if so, stop and justify it rather than silently adding application functionality.

---

# 50. First live deployment verification

Plan a safe first deployment.

Prefer deliberately changing a harmless service-specific file rather than forcing all three services if possible.

We need to prove:

```text
Portal-only change
→ Portal validates/builds/pushes/deploys
→ API skipped
→ Renderer skipped
```

Then naturally verify other services as changes occur, unless a tiny controlled verification is worth doing immediately.

Because API's first automated deployment changes its Artifact Registry image path, explicitly plan how to verify that transition safely.

---

# 51. Existing DEV state must survive

After an automated deployment, confirm:

```text
runtime service account unchanged
env vars unchanged
Secret Manager bindings unchanged
domains/routes still work
```

Design a concise verification rather than dumping every service setting.

---

# 52. Security review

Evaluate:

```text
PR/fork cannot deploy
feature branch cannot deploy
copied workflow on feature branch cannot pass WIF
docs-only push gets no credentials
deployer cannot edit arbitrary Cloud Run services
deployer cannot act as default compute SA
deployer cannot write another Artifact Registry repo
deployer cannot read Firestore/app secrets
deployer has no PROD access
```

Explicitly show how IAM/WIF/workflow architecture enforces each.

---

# 53. Action versions

Use current Node-24-compatible official Actions.

Current known working actions include:

```text
actions/checkout@v7
google-github-actions/auth@v3
google-github-actions/setup-gcloud@v3
```

If adding any Docker Actions, verify their current supported majors/runtime before recommending them.

Prefer fewer Actions where standard Docker/gcloud CLI works cleanly.

---

# 54. Definition of done

Step 2.4 is complete when:

```text
merge to main automatically invokes DEV deploy workflow

classifier determines affected services

only affected services validate/build

images go to:
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/{api|portal|site-renderer}

images receive immutable SHA identity

Cloud Run is updated using immutable image digest

runtime config is untouched

affected service smoke check passes

unaffected services are not redeployed

docs-only changes perform no GCP auth/deployment

GitHub stores zero Google credential secrets

local development remains unchanged

manual deploy-dev.ps1 fallback still exists
```

---

# 55. Output

Return:

1. Executive Step 2.4 architecture
2. Read-only discovery findings
3. Exact Dockerfile/context findings
4. Current DEV Cloud Run traffic/revision findings
5. Exact deployer IAM required
6. Resource scope for each IAM role
7. Whether temporary `run.viewer` should be removed
8. Artifact Registry final layout
9. Image tag + digest strategy
10. Docker auth strategy
11. GitHub Environment variable inventory
12. Push diff/classification design
13. Validation job graph
14. Docker PR-validation decision
15. Reusable workflow architecture
16. Per-service concurrency design
17. Multi-commit/race analysis
18. Portal build args
19. Renderer build args
20. API build details
21. Exact image-only Cloud Run command
22. Smoke test per service
23. Digest/revision verification
24. Failure/rollback behavior
25. Final `dev-deploy-passed` behavior
26. Manual deploy-dev.ps1 recommendation
27. PowerShell IAM/bootstrap commands
28. GitHub configuration steps
29. Expected repo files changed
30. Security attack-case analysis
31. First live deployment plan
32. Human verification checklist
33. Definition of done
34. Whether anything should be split into a 2.4a prerequisite
35. Safe to hand implementation to Codex?

Do NOT modify anything.