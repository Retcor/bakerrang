# Planning Task — Step 2.1: CI/CD Architecture & Monorepo Dependency Graph

We are beginning Step 2 of the BakerRang platform.

Do NOT implement anything.

Inspect the actual current repository and produce the architecture/implementation plan for:

# Step 2.1 — CI/CD Architecture & Monorepo Dependency Graph

Step 1 — DEV Platform Foundation & Product Readiness — is COMPLETE.

The platform is working end-to-end in DEV and currently deploys to Google Cloud Run.

Step 2 begins the Production & Product Maturity phase.

The immediate objective is to design a safe CI/CD system from GitHub to Google Cloud while preserving normal local development.

---

# 1. Product / Repository Context

The repository is a monorepo.

Current major pieces include:

```text
server/
    Node/Express API
    Firestore boundary
    auth
    leads
    domains
    media
    site APIs

platform/
    apps/
        portal/
            Next.js operator/admin Portal

        site-renderer/
            Next.js public multi-tenant renderer

    packages/
        ui/
        site-components/
        site-schema/

client/
    legacy BakerRang application
```

There may be other packages/files/directories.

Inspect the repository and use the actual structure rather than this summary alone.

---

# 2. Current DEV Services

Current Google Cloud Run DEV services:

```text
bakerrang-api-dev
bakerrang-portal-dev
bakerrang-site-renderer-dev
```

Current stable DEV URLs:

```text
https://api-dev.bakerrang.com
https://portal-dev.bakerrang.com
https://sites-dev.bakerrang.com
```

Permanent DEV custom-domain test hostname:

```text
https://custom-dev.bakerrang.com
```

GCP project:

```text
bakerrang-dev
```

Region:

```text
us-west1
```

Step 1.30 also introduced:

```text
docs/DEV-DEPLOYMENT.md
scripts/deploy-dev.ps1
```

The PowerShell helper performs image-only DEV deployments and intentionally does not mutate environment variables or secrets.

Inspect these files.

---

# 3. Core CI/CD Goal

The intended branch/deployment model is:

```text
feature branch
      │
      ▼
PR into master
      │
      ├── CI only
      │
      └── no cloud deployment
      │
      ▼
merge to master
      │
      ▼
selective automatic DEV deployment
```

and later:

```text
master
      │
      ▼
PR into production
      │
      ├── CI
      │
      └── no production deployment until merge
      │
      ▼
merge to production
      │
      ▼
selective automatic PROD deployment
```

The proposed permanent branches are therefore:

```text
master
production
```

Evaluate this branch model and recommend adjustments only if there is a concrete reason.

---

# 4. Critical Monorepo Requirement

A change to one service should NOT automatically redeploy unrelated services.

Examples:

```text
Portal-only change
    -> Portal validation/deployment
    -> no API deployment
    -> no Renderer deployment

API-only change
    -> API validation/deployment
    -> no Portal deployment
    -> no Renderer deployment

Renderer-only change
    -> Renderer validation/deployment
```

However shared-package changes may legitimately affect multiple services.

The first major task of this plan is therefore to determine the ACTUAL dependency graph.

---

# 5. Build the Real Dependency Graph

Inspect:

```text
package.json
workspace definitions
imports
tsconfig references/aliases
Next config
Dockerfiles
package-lock
server imports
shared packages
```

Determine exactly which repository paths can affect:

```text
API
Portal
Renderer
Shared UI package
other build artifacts
```

Do not guess from directory names alone.

---

# 6. Produce a Path → Service Impact Matrix

Create a matrix such as:

| Changed path | API | Portal | Renderer | Reason |
|---|---:|---:|---:|---|
| server/** | ? | ? | ? | |
| platform/apps/portal/** | | | | |
| platform/apps/site-renderer/** | | | | |
| platform/packages/ui/** | | | | |
| platform/packages/site-components/** | | | | |
| platform/packages/site-schema/** | | | | |
| platform/package.json | | | | |
| platform/package-lock.json | | | | |
| root config files | | | | |

Include all actual meaningful paths discovered.

We specifically need to know which shared-package changes should trigger multiple services.

---

# 7. CI Impact vs Deployment Impact

Do not assume:

```text
must test
```

always means:

```text
must deploy
```

Distinguish:

```text
CI impact
```

from:

```text
runtime deployment impact
```

For example, a shared type/schema change may require tests across several workspaces even if only certain deployable images actually consume that code at runtime.

Produce separate recommendations for:

```text
what should be tested
what should be built
what should be deployed
```

for each change category.

---

# 8. Preserve Local Development

This is a NON-NEGOTIABLE requirement.

CI/CD must NOT become the only supported way to run BakerRang.

The desired modes remain:

## Local

```text
developer runs API / Portal / Renderer locally
.env / .env.local files
normal npm commands
no GitHub Actions required
no cloud dependency required just to build normal application code
```

## DEV Cloud

```text
merge to master
GitHub Actions
selective build/deploy
```

## Production

```text
merge to production
GitHub Actions
selective build/deploy
```

The application itself should not become GitHub-aware.

GitHub-specific environment/config should remain deployment infrastructure, not product application logic.

Audit any proposed CI/CD design against this requirement.

---

# 9. Existing Local Commands

Inspect the actual package scripts and document the current local workflow for:

```text
API
Portal
Renderer
```

Confirm that CI/CD can reuse the same underlying:

```text
test
lint
typecheck
build
```

commands rather than introducing special CI-only build logic where avoidable.

---

# 10. Pull Request CI Design

Design what should happen when a PR targets:

```text
master
```

or:

```text
production
```

No deployment should occur merely because a PR was opened or updated.

PR CI should:

```text
detect affected components
run appropriate deterministic validation
report failure before merge
```

Determine whether path-filtered workflows or a change-detection job is better for this repository.

---

# 11. CI Checks by Component

Determine the smallest correct validation set for each impact category.

Possible checks include:

```text
Backend tests
server lint

Portal tests

Renderer tests

Shared UI tests

platform typecheck
platform lint

Portal build
Renderer build

Docker image build
```

Do not automatically run everything for every PR if dependency-aware validation can safely reduce work.

But correctness matters more than saving a few CI minutes.

Recommend the balance.

---

# 12. Build Validation vs Docker Validation

Determine whether PR CI should:

```text
run npm production builds only
```

or also:

```text
docker build affected services
```

A Docker build can catch Dockerfile/standalone-output/config issues that npm build alone may not.

Recommend when Docker image validation is worthwhile.

Do not push deployable images from ordinary PR validation unless there is a concrete reason.

---

# 13. DEV Deployment Trigger

Desired:

```text
push/merge to master
    -> selectively deploy changed services to DEV
```

The workflow should:

1. determine affected deployable services
2. run/confirm required CI gates
3. build only affected images
4. tag images immutably
5. push to Artifact Registry
6. update only affected Cloud Run services
7. verify deployment health
8. report deployment result

Design this flow.

---

# 14. Production Deployment Trigger

Desired:

```text
push/merge to production
    -> selectively deploy changed services to PROD
```

Production should use the same core deployment architecture as DEV where practical.

Avoid completely separate handcrafted implementations that drift.

Recommend how to reuse workflow logic safely between environments.

---

# 15. Commit SHA Image Tagging

We want immutable traceability.

Evaluate using image tags based on:

```text
Git commit SHA
```

for example:

```text
api:<sha>
portal:<sha>
renderer:<sha>
```

Potentially include environment/short SHA if useful:

```text
dev-<sha>
prod-<sha>
```

but ensure the image is traceable to the source commit.

Do not rely on:

```text
latest
```

as the deployment identity.

Recommend exact tag conventions.

---

# 16. Artifact Registry Strategy

Inspect the current Artifact Registry usage from:

```text
current DEV Cloud Run image references
docs/DEV-DEPLOYMENT.md
deploy-dev.ps1
```

Determine:

```text
reuse one repository?
separate DEV/PROD repositories?
separate images by service?
```

Recommend the cleanest strategy.

Consider:

```text
security
cleanup
traceability
simplicity
production separation
```

Do not create extra repositories without value.

---

# 17. GitHub → Google Authentication

Plan GitHub Actions authentication using:

```text
GitHub OIDC
Google Workload Identity Federation
```

Prefer short-lived credentials.

Do NOT recommend storing a downloadable service-account JSON key in GitHub unless WIF is technically impossible.

Determine the required Google resources conceptually:

```text
Workload Identity Pool
Workload Identity Provider
service account(s)
IAM bindings
```

---

# 18. Separate DEV and PROD Deployment Identities

Evaluate using separate service accounts, conceptually:

```text
bakerrang-github-dev-deployer
bakerrang-github-prod-deployer
```

The DEV deployer must not be able to deploy PROD.

The PROD deployer must be appropriately scoped.

Recommend exact role responsibilities.

Apply least privilege.

---

# 19. GitHub Trust Restrictions

The Workload Identity trust should not accept arbitrary GitHub repositories/branches.

Plan appropriate restrictions around:

```text
repository identity
organization/user
branch/ref
environment if useful
```

Especially for PROD.

Explain how DEV and PROD trust should differ.

---

# 20. GitHub Environments

Evaluate using GitHub Environments:

```text
development
production
```

Potential uses:

```text
environment-specific variables
environment protection
deployment history
optional production approval
```

The current human approval model is:

```text
PR into production
review/merge = production approval
```

We do not necessarily need a SECOND manual approval after merge.

Recommend whether a GitHub production Environment is still valuable even without an additional required reviewer.

---

# 21. Branch Protection

Recommend branch-protection policy for:

```text
master
production
```

Potentially:

```text
PR required
CI required
no direct pushes
production only accepts controlled promotion from master
```

Do not over-engineer a large enterprise release process.

The user is currently the primary developer/operator.

---

# 22. Production Promotion Semantics

The expected model is:

```text
master contains what is running in DEV

production contains what is running in PROD
```

Production promotion typically becomes:

```text
PR master -> production
```

Evaluate whether this is a sound model.

Identify risk of:

```text
production branch divergence
hotfixes
merge-back behavior
```

Recommend a simple policy.

---

# 23. Hotfix Strategy

Define a lightweight strategy for an urgent production fix.

For example:

```text
branch from production
fix
PR to production
deploy
merge/cherry-pick fix back into master
```

or another approach.

Keep this practical for a small project.

---

# 24. Deployment Rollback Strategy

We already have immutable Cloud Run revisions/images.

Design rollback for:

```text
bad DEV deployment
bad PROD deployment
```

Possible options:

```text
redeploy previous image SHA
Cloud Run revision traffic rollback
Git revert + normal pipeline
```

Recommend which should be the emergency mechanism vs source-of-truth correction.

---

# 25. Health Verification

API already exposes:

```text
/health
```

Determine appropriate deployment verification for:

```text
API
Portal
Renderer
```

Potentially:

```text
Cloud Run revision ready
API health endpoint
HTTP smoke against Portal
HTTP smoke against Renderer/shared URL
```

Do not build an elaborate E2E suite in the deploy job.

Keep deployment verification fast and deterministic.

---

# 26. Failed Deployment Behavior

Define what should happen if:

```text
image builds but Cloud Run update fails
health check fails
```

DEV:

```text
workflow fails visibly
```

PROD:

should not silently leave an unknown deployment state.

Recommend whether automatic rollback is warranted or whether failure + manual rollback is safer initially.

---

# 27. Secrets and Runtime Environment

Current Cloud Run runtime configuration is managed separately from image deployment.

Step 1 established:

```text
normal deploy = image-only
```

CI/CD should preserve this.

Do NOT make GitHub Actions rewrite all Cloud Run env vars/secrets on every deploy unless there is a compelling reason.

Current runtime config includes sensitive values stored through GCP/Secret Manager.

Recommend the CI/CD boundary:

```text
GitHub builds/deploys images
Cloud Run retains runtime configuration
```

unless Terraform later explicitly manages service configuration.

---

# 28. Build Secrets

Audit whether Docker builds require any secrets.

`NEXT_PUBLIC_*` build args are not secret.

Do not inject:

```text
OAuth client secret
SESSION_SECRET
PREVIEW_TOKEN_SECRET
GCP credentials
```

into Docker builds.

Identify any existing build-time variable that might accidentally expose sensitive data.

---

# 29. GitHub Variables vs Secrets

Determine what GitHub Actions actually needs.

Potential non-secret variables:

```text
GCP project
region
service names
Artifact Registry location/repository
build-time public URLs
LB IP
```

Potential secrets should be minimized through WIF.

Recommend whether to use:

```text
repository variables
GitHub Environment variables
workflow constants
```

for each class.

---

# 30. Monorepo Workflow Structure

Evaluate possible structures.

### Model A — Independent deployment workflows

```text
deploy-api.yml
deploy-portal.yml
deploy-renderer.yml
```

each with branch/path filters.

### Model B — One monorepo orchestrator

```text
deploy.yml
    detect changes
    matrix jobs
```

### Model C — Thin service workflows + reusable workflows

```text
ci.yml
deploy-api.yml
deploy-portal.yml
deploy-renderer.yml
_reusable-deploy-cloud-run.yml
```

or similar.

Recommend the architecture that best balances:

```text
clarity
shared logic
selective deployment
testability
maintenance
```

Do not choose a pattern merely because it is fashionable.

---

# 31. GitHub Actions Path Filters

Evaluate whether native:

```yaml
paths:
```

filters alone are sufficient.

Potential complication:

shared paths may affect multiple workflows.

Example:

```text
platform/packages/site-schema/**
```

may trigger several services.

That is acceptable if explicitly defined.

Alternatively, a single change-detection job may avoid duplicated path maps.

Recommend which is less error-prone for this repo.

---

# 32. Docs-Only Changes

Expected behavior:

```text
README.md
docs/**
```

should generally:

```text
run lightweight CI if relevant
deploy nothing
```

Determine what should happen for:

```text
scripts/**
.github/**
Dockerfiles
package lockfiles
root config
```

and include them in the dependency/impact map.

---

# 33. Workflow Changes Themselves

Changing:

```text
.github/workflows/**
```

should not unexpectedly deploy application services just because the workflow changed.

Recommend safe behavior.

Likely:

```text
validate workflow on PR
new workflow takes effect after merge
```

but application deploys should remain tied to actual affected services where possible.

---

# 34. Dockerfile Changes

A change to:

```text
server/Dockerfile
```

must affect API deployment.

A change to:

```text
platform/apps/portal/Dockerfile
```

must affect Portal.

Renderer Dockerfile → Renderer.

Include these explicitly.

---

# 35. Lockfile / Dependency Changes

Inspect the actual dependency installation boundaries.

Determine what changing:

```text
server/package-lock.json

platform/package-lock.json
```

should trigger.

A platform lockfile change may potentially affect both Portal and Renderer even when the direct package edit looks isolated.

Recommend conservative behavior where appropriate.

---

# 36. Shared Package Build Effects

For each:

```text
ui
site-components
site-schema
```

trace actual consumers.

Do not assume based on package name.

Determine:

```text
Portal tests?
Renderer tests?
Portal deploy?
Renderer deploy?
```

for each.

---

# 37. API and Platform Coupling

Determine whether any shared source/config change outside:

```text
server/
platform/
```

affects both.

Examples might include:

```text
root scripts
shared schema
generated assets
config
```

Use actual repository findings.

---

# 38. Terraform — Decide Its Role

The user has heard of Terraform but is not committed to it.

Evaluate whether Terraform should be introduced in Step 2.

Do NOT use Terraform simply because production infrastructure exists.

Separate:

```text
infrastructure provisioning/configuration
```

from:

```text
application deployment
```

My current design hypothesis is:

```text
Terraform
    -> long-lived infrastructure

GitHub Actions
    -> CI + application image deployment
```

Evaluate this against the repo and current GCP setup.

---

# 39. What Terraform Might Manage

Potential future Terraform scope:

```text
production GCP project resources
Artifact Registry
service accounts
Workload Identity Federation
IAM bindings
Cloud Run service skeleton/config
Secret Manager secret resources/IAM
load balancer
serverless NEGs
certificate resources
DNS
```

But distinguish what SHOULD be managed initially from what would create unnecessary migration work.

---

# 40. Existing DEV Infrastructure

DEV already exists and works.

Do NOT assume we need to import all existing DEV resources into Terraform before CI/CD can proceed.

Evaluate three strategies:

### A

Terraform both DEV and PROD immediately, importing DEV.

### B

Leave existing DEV manually provisioned; Terraform new PROD + CI/CD infrastructure.

### C

No Terraform yet; use gcloud for production setup and revisit IaC later.

Recommend one and explain why.

Avoid turning DEV Terraform import into a side project unless clearly worthwhile.

---

# 41. Terraform State

If Terraform is recommended, plan:

```text
remote state location
environment separation
state security
locking implications
```

Do not store Terraform state directly in Git.

Keep this design-level; no implementation yet.

---

# 42. Production Infrastructure Discovery

We have not yet intentionally built the final production environment.

Identify what must be discovered before Step 2.4/2.5.

Potential questions:

```text
Does a production GCP project already exist?
Which resources currently use the historical production project?
What domain/DNS resources already exist?
Which existing BakerRang production resources must not be disturbed?
What Cloud Run services should be created?
What service accounts?
What Firestore project?
What bucket?
What LB/cert architecture?
```

Do NOT infer that existing historical infrastructure should automatically become the new production platform.

Produce a discovery checklist.

---

# 43. Production Naming

Recommend a consistent service/resource naming convention.

Likely:

```text
bakerrang-api-prod
bakerrang-portal-prod
bakerrang-site-renderer-prod
```

or perhaps non-suffixed production names.

Compare with current DEV naming.

Prefer explicitness.

---

# 44. Production URLs

We eventually need to decide production hostnames.

Current BakerRang main domain already exists.

Likely platform possibilities may include:

```text
portal.bakerrang.com
api.bakerrang.com
sites.bakerrang.com
```

but do NOT make DNS changes.

Identify hostname decisions needed for production.

`marketing.bakerrang.com` is a FUTURE step and should NOT be included in this CI/CD implementation.

---

# 45. Local Development Must Remain Stable After Terraform

If Terraform is introduced, local development must still require only the documented local env/config.

A local developer should not need:

```text
terraform apply
GitHub Actions
production IAM
```

to work on normal product code.

Explicitly verify this in the architecture.

---

# 46. Manual DEV Deployment

The existing:

```text
scripts/deploy-dev.ps1
```

should remain usable as:

```text
fallback / emergency / manual DEV deployment
```

after GitHub Actions becomes normal.

Do not delete or invalidate it.

Identify any updates it might eventually need to stay aligned with CI conventions such as image tag format.

---

# 47. CI Cost / Efficiency

We do not need extreme optimization.

Still evaluate:

```text
npm caching
Docker layer caching
concurrency cancellation for superseded DEV builds
```

especially for PRs.

Do not introduce a complicated remote build cache unless there is clear value.

---

# 48. GitHub Actions Concurrency

Consider:

```text
PR CI:
cancel older run for same PR

DEV deployment:
avoid two master deployments racing for the same service

PROD:
serialize deployments
```

Recommend concurrency groups.

---

# 49. GitHub Actions Permissions

Plan minimal workflow permissions.

Especially WIF will likely require:

```yaml
permissions:
  contents: read
  id-token: write
```

Do not grant broad repository write privileges unnecessarily.

Identify any additional permission only if needed.

---

# 50. Supply Chain / Action Pinning

Recommend whether third-party GitHub Actions should be:

```text
major-version pinned
full-SHA pinned
```

for this project's maturity level.

Prefer official:

```text
actions/*
google-github-actions/*
```

where possible.

Do not add unnecessary security tooling.

---

# 51. Deployment Metadata

Determine whether deployments should include useful metadata such as:

```text
commit SHA
GitHub run URL/id
service
environment
```

through image labels, Cloud Run revision suffix, or GitHub deployment status.

Recommend a simple traceability mechanism.

---

# 52. Database / Schema Migration Consideration

The current platform uses Firestore and intentionally avoids migrations where defaults/backcompat suffice.

CI/CD must NOT assume a SQL-style migration phase.

If future schema/data migration becomes necessary, it should be explicit.

Do not add a generic migration step now.

---

# 53. Failure Isolation

A Portal deployment failure should not prevent an unrelated API deployment from a commit that changes both, unless shared CI prerequisites genuinely fail.

Evaluate:

```text
independent service jobs
matrix strategy
fail-fast behavior
```

Recommend how multi-service commits should behave.

---

# 54. Deployment Ordering

Determine whether affected services need a deployment order.

Example:

```text
API contract change
Portal/Renderer consumer change
```

Could require:

```text
backward-compatible API first
then clients
```

or vice versa.

The platform generally uses backward-compatible changes, but production CI/CD needs a policy.

Recommend:

```text
compatible changes required
```

vs attempting complex coordinated atomic deployment.

Do not build distributed deployment orchestration unless needed.

---

# 55. Production Safety Gate

A production deployment should not happen from:

```text
feature branch
master push
random workflow_dispatch
```

unless explicitly authorized.

Design how production deployment is restricted to:

```text
production branch
```

and potentially GitHub `production` Environment.

---

# 56. Manual Deployment / workflow_dispatch

Evaluate whether to support:

```text
workflow_dispatch
```

for:

```text
redeploy
rollback
manual retry
```

If enabled, ensure environment/branch restrictions prevent arbitrary production deployment.

Recommend whether to include it initially.

---

# 57. CI/CD Documentation

Plan documentation to accompany implementation.

Potential:

```text
docs/CI-CD.md
```

covering:

```text
branch model
path impact map
PR CI
DEV deploy
PROD deploy
WIF
rollback
manual fallback
```

Determine whether to extend `DEV-DEPLOYMENT.md` or create a separate document.

My bias is a separate CI/CD document once implemented.

---

# 58. Step 2.1 Output Must Drive Later Steps

Do not implement GitHub workflows yet.

Instead propose the next implementation slices after analysis.

Likely something like:

```text
2.2 PR CI + change detection
2.3 GitHub/GCP Workload Identity
2.4 automatic DEV deployment
2.5 Terraform / production infrastructure
2.6 production deployment
2.7 release/rollback verification
```

But change these if actual repository findings suggest a better sequence.

---

# 59. Future Product Roadmap Context

After CI/CD + production deployment, current priorities are:

```text
Deferred Step 1 items
Product data lifecycle:
    delete leads
    delete uploaded media/images

Lead notifications
Revision history / rollback
Audit log
Templates / presets
Analytics
Production observability

marketing.bakerrang.com + signup/subscription
    comes AFTER the product is more mature
```

Do NOT plan or implement those in Step 2.1.

This context only explains why CI/CD should be reliable enough to support continued feature development.

---

# 60. Scope Discipline

Do NOT:

- write GitHub Actions workflows
- create production Cloud Run services
- create Workload Identity resources
- create Terraform files
- mutate GCP
- mutate GitHub branch settings
- create a production branch
- deploy anything
- modify product code
- change local development behavior

This is architecture/planning only.

---

# 61. Output

Return:

1. Executive CI/CD architecture recommendation
2. Actual repository/dependency findings
3. Complete path → CI impact matrix
4. Complete path → deployment impact matrix
5. API dependency graph
6. Portal dependency graph
7. Renderer dependency graph
8. Shared-package consumer analysis
9. Lockfile/config/Dockerfile impact rules
10. Recommended PR CI design
11. Recommended DEV deployment workflow
12. Recommended PROD deployment workflow
13. Recommended GitHub Actions workflow structure
14. Native path filters vs centralized change detection recommendation
15. Image tag/revision naming strategy
16. Artifact Registry strategy
17. GitHub Workload Identity architecture
18. DEV vs PROD deploy service-account/IAM plan
19. GitHub trust restrictions
20. GitHub Environment recommendation
21. Branch-protection recommendation
22. Production promotion model
23. Hotfix model
24. Rollback model
25. Deployment health-verification model
26. Concurrency/failure-isolation model
27. Runtime env/Secret Manager boundary
28. GitHub variables/secrets plan
29. Terraform recommendation: YES/NO/NOW/LATER and why
30. Exact initial Terraform scope if recommended
31. DEV Terraform-import recommendation
32. Terraform state strategy if applicable
33. Production infrastructure discovery checklist
34. Production naming/hostname decisions still required
35. Local-development compatibility analysis
36. Manual `deploy-dev.ps1` role after CI/CD
37. CI caching/efficiency recommendations
38. GitHub workflow permissions/action-pinning recommendations
39. CI/CD documentation plan
40. Ranked risks / design decisions
41. Exact proposed Step 2.2–2.x implementation sequence
42. Human decisions genuinely required before implementation
43. Definition of done for Step 2.1

Do NOT modify code.