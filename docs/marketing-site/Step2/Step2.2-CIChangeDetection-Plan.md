# Implement Step 2.2 — PR CI + Centralized Monorepo Change Detection

Implement ONLY Step 2.2.

Step 2.1 — CI/CD Architecture & Monorepo Dependency Graph — is COMPLETE.

Do not configure Google Cloud, Workload Identity, Cloud Run deployment, Terraform, production infrastructure, or product code in this step.

The purpose of Step 2.2 is:

```text
Pull Request
    ↓
centralized repository change detection
    ↓
run only the validation required by affected services
    ↓
single ci-passed gate

NO DEPLOYMENT
```

This establishes the dependency-aware CI foundation that later DEV and PROD deployment workflows will reuse.

---

# 1. Branch Model

Use:

```text
main
production
```

PR CI should run for pull requests targeting:

```text
main
production
```

Do NOT deploy anything from PR CI.

There must be no:

```text
gcloud
Google authentication
Cloud Run mutation
Artifact Registry push
Terraform
```

in Step 2.2.

---

# 2. Repository Reality

The repository has independent install roots:

```text
server/
platform/
client/
extension/
```

There is no root `package.json`.

Deployable platform services are only:

```text
API
Portal
Renderer
```

Legacy:

```text
client/
extension/
addon/
```

are currently outside platform CI/CD scope.

---

# 3. Verified Dependency Graph

Use this as the authoritative starting point.

## API

Runtime/build inputs:

```text
server/**
server/package.json
server/package-lock.json
server/Dockerfile
server/.dockerignore
```

API imports nothing from `platform/`.

---

## Portal

Consumes:

```text
platform/apps/portal/**
platform/packages/ui/**
platform/packages/site-schema/**
platform/scripts/config-validation.mjs
platform/package.json
platform/package-lock.json
platform/tsconfig.base.json
```

Portal does NOT consume:

```text
platform/packages/site-components/**
```

---

## Renderer

Consumes:

```text
platform/apps/site-renderer/**
platform/packages/site-components/**
platform/packages/site-schema/**
platform/packages/ui/**
platform/scripts/config-validation.mjs
platform/package.json
platform/package-lock.json
platform/tsconfig.base.json
```

---

# 4. Shared Package Fan-Out

Required impact:

```text
platform/packages/site-schema/**
    → Portal + Renderer

platform/packages/ui/**
    → Portal + Renderer

platform/packages/site-components/**
    → Renderer only
```

Do not accidentally make `site-components` trigger Portal CI.

---

# 5. Centralized Change Detection

Create ONE central source of truth for repository-path classification.

Do not duplicate path maps separately across:

```text
ci.yml
future deploy-dev.yml
future deploy-prod.yml
```

Prefer a small repository-local classifier that later workflows can reuse.

A reasonable implementation would be something like:

```text
scripts/ci/classify-changes.mjs
```

plus focused tests.

The exact location/name may differ if there is a cleaner existing convention.

Avoid adding a third-party change-filter Action when a small local classifier is sufficient.

The graph is small and static enough to keep in-repo.

---

# 6. Classifier Outputs

At minimum expose:

```text
api
portal
renderer
```

for CI impact.

It is also acceptable — and preferable if clean — to expose deployment-impact outputs now for reuse by Step 2.4:

```text
deploy_api
deploy_portal
deploy_renderer
```

BUT Step 2.2 must not actually deploy.

If CI/deploy impact is represented in one structured classifier, keep the distinction explicit.

---

# 7. CI Classification Matrix

Implement these CI rules.

| Changed path | API CI | Portal CI | Renderer CI |
|---|---:|---:|---:|
| `server/**` | yes | no | no |
| `platform/apps/portal/**` | no | yes | no |
| `platform/apps/site-renderer/**` | no | no | yes |
| `platform/packages/site-schema/**` | no | yes | yes |
| `platform/packages/ui/**` | no | yes | yes |
| `platform/packages/site-components/**` | no | no | yes |
| `platform/package.json` | no | yes | yes |
| `platform/package-lock.json` | no | yes | yes |
| `platform/scripts/config-validation.mjs` | no | yes | yes |
| `platform/scripts/config-validation.d.mts` | no | yes | yes |
| `platform/tsconfig.base.json` | no | yes | yes |
| `platform/eslint.config.mjs` | no | yes | yes |
| `platform/.dockerignore` | no | yes | yes |
| `server/Dockerfile` | yes | no | no |
| `server/.dockerignore` | yes | no | no |
| Portal Dockerfile | no | yes | no |
| Renderer Dockerfile | no | no | yes |

Per-workspace `package.json` files are already under their app/package paths, but account for the shared platform lockfile behavior.

---

# 8. Deployment Classification Matrix

Although Step 2.2 performs no deployment, encode/test the future deployment impact if the classifier supports it.

Use:

```text
server/**
    → API

portal/**
    → Portal

site-renderer/**
    → Renderer

site-schema/**
    → Portal + Renderer

ui/**
    → Portal + Renderer

site-components/**
    → Renderer

platform/package.json
platform/package-lock.json
platform/.dockerignore
    → Portal + Renderer

platform/scripts/config-validation.mjs
    → Portal + Renderer

platform/tsconfig.base.json
    → Portal + Renderer
```

IMPORTANT orchestration correction from the Step 2.1 plan:

```text
platform/tsconfig.base.json
```

is a build input and MUST be treated as:

```text
Portal + Renderer deploy impact
```

Do not classify it as CI-only.

`platform/eslint.config.mjs` remains:

```text
CI → Portal + Renderer
Deploy → none
```

`config-validation.d.mts` may remain CI-only if inspection confirms it is type declaration input only and not copied/emitted into deployable runtime/build output.

---

# 9. Explicit Known No-Deploy / No-Service Paths

Explicitly classify known non-platform-service paths.

Examples:

```text
docs/**
README.md
*.md
AGENTS.md
CLAUDE.md

client/**
extension/**
addon/**

scripts/deploy-dev.ps1

.github/**
firestore.indexes.json
firebase.json
.firebaserc
.gitignore
```

These should not accidentally trigger a platform deployment.

Some may still need specialized CI checks as described later.

---

# 10. UNKNOWN PATH POLICY — IMPORTANT

Do NOT silently treat an unrecognized repository path as:

```text
no service affected
```

An unknown path means the dependency map is incomplete.

Required behavior:

```text
unknown/unclassified path
    → classification reports it explicitly
    → PR CI FAILS
```

with a useful message such as:

```text
Unclassified repository path:
<path>

Update the CI/CD impact map before merging.
```

This forces future new repository areas to be intentionally classified.

Known docs/legacy/ops paths must therefore be explicitly represented as `none`.

Do not "test all and then allow merge" for an unknown path.

---

# 11. Change Detector Must Be Testable Locally

The actual path-classification logic should be a normal repository script/module, not logic buried entirely inside GitHub YAML.

It should be possible to test examples such as:

```text
server/routes/tenants.js
    → API

platform/apps/portal/app/page.tsx
    → Portal

platform/apps/site-renderer/app/page.tsx
    → Renderer

platform/packages/site-schema/src/index.ts
    → Portal + Renderer

platform/packages/ui/src/Button.tsx
    → Portal + Renderer

platform/packages/site-components/src/Hero.tsx
    → Renderer

README.md
    → none

some-new-unknown-root/file.txt
    → classification failure
```

Add deterministic tests.

Use Node if that fits the existing repository/tooling best.

Do not introduce Nx/Turborepo/Bazel/etc.

---

# 12. Git Diff Collection

`ci.yml` should determine the PR changed-file set reliably.

PR target branches:

```text
main
production
```

Use the PR base/head relationship rather than assuming the runner's previous commit is the correct comparison.

Ensure enough Git history is available.

A reasonable model is:

```text
base SHA ... head SHA
```

with `fetch-depth: 0` if required.

Do not rely on GitHub API write permissions.

---

# 13. Workflow

Create:

```text
.github/workflows/ci.yml
```

No deployment workflow yet.

Conceptual jobs:

```text
changes
api-ci
platform/portal-ci
platform/renderer-ci
workflow-validation if applicable
ci-passed
```

Exact job structure may be simplified if it avoids duplicate platform installs.

---

# 14. API CI

When API is affected:

Working directory:

```text
server/
```

Run:

```text
npm ci
npm run lint
npm test
```

Use Node 24.

Use npm caching keyed from:

```text
server/package-lock.json
```

No API Docker build is necessary for ordinary source changes.

---

# 15. Platform CI Strategy

Do not optimize CI so aggressively that workflow complexity exceeds its value.

`platform/` has:

```text
one npm install
one lockfile
small test suites
```

A good implementation may use one shared platform validation job whenever either Portal or Renderer is affected:

```text
npm ci
npm run lint
npm run typecheck
npm test
```

Then conditionally run the relevant Next build(s):

```text
Portal affected
    → portal build

Renderer affected
    → renderer build
```

This is acceptable even if a Portal-only change causes the small Renderer/unit package tests to run.

The primary optimization requirement is:

```text
UNRELATED SERVICES MUST NOT DEPLOY
```

not shaving every possible CI second.

Prefer simple/reliable over clever.

If instead separate Portal/Renderer CI jobs are cleaner, avoid running duplicate `npm ci` unnecessarily where practical.

---

# 16. Required Next Builds

For affected applications:

Portal:

```text
npm run build -w @bakerrang/portal
```

Renderer:

```text
npm run build -w @bakerrang/site-renderer
```

or the actual equivalent verified from `package.json`.

A Next production build is part of PR correctness.

---

# 17. CI Build-Time Public Configuration

Step 1.30 introduced build-time validation.

Portal builds require valid:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN
```

Renderer builds require:

```text
NEXT_PUBLIC_SITE_API_BASE_URL
```

PR CI must supply safe NON-SECRET CI values.

Do NOT put DEV or PROD secrets in CI.

Prefer fixed reserved/test origins if the builds do not require a live server, for example conceptually:

```text
https://api.ci.invalid
https://sites.ci.invalid
```

or another syntactically valid reserved/test value.

Inspect the validators and build behavior and choose values that:

```text
pass origin validation
do not point at production
do not require a live DEV environment
```

`CUSTOM_DOMAIN_IPV4_ADDRESS` / CNAME may remain absent in PR builds if optional.

Document the chosen CI-only values in the workflow.

---

# 18. Google Fonts / Network

Existing Next builds use Google Fonts and may require normal outbound network access during build.

Do not redesign fonts in this step.

GitHub-hosted runners normally have outbound network access.

If verification discovers a deterministic CI issue here, report it rather than changing product font architecture.

---

# 19. Docker Build CI

Do NOT Docker-build every PR by default.

Add affected-service Docker build validation only when Docker/build-container inputs change.

At minimum consider:

```text
server/Dockerfile
server/.dockerignore
server/package*.json

platform/apps/portal/Dockerfile
platform/apps/site-renderer/Dockerfile
platform/.dockerignore
platform/package*.json
platform/scripts/config-validation.mjs
```

If adding conditional Docker validation makes Step 2.2 disproportionately complex, it is acceptable to defer the conditional Docker check to Step 2.4 provided:

```text
Next/API validation remains complete
```

State the decision explicitly.

Never push a Docker image in PR CI.

---

# 20. Workflow File Changes

Changes under:

```text
.github/**
```

must never cause an application deploy.

For PR CI, validate workflow syntax where practical.

Prefer:

```text
actionlint
```

or another lightweight approach only if it can be added without unnecessary setup/supply-chain complexity.

If not included now, classify `.github/**` as known non-service and document workflow validation as deferred to Step 2.4/2.7.

Do NOT invoke a deployment merely to test workflow YAML.

---

# 21. `ci-passed` Gate

Create one stable status check:

```text
ci-passed
```

This is intended to become the required branch-protection check later.

It must behave correctly when service jobs are skipped.

Examples:

## Docs-only PR

```text
changes         success
api             skipped
platform        skipped
ci-passed       SUCCESS
```

## API PR

```text
api             success
ci-passed       SUCCESS
```

## Portal PR with failed build

```text
platform/portal failure
ci-passed       FAILURE
```

## Unknown-path PR

```text
changes/classification failure
ci-passed       FAILURE
```

Do not make skipped jobs accidentally fail the final gate.

---

# 22. Concurrency

PR CI:

```text
cancel older runs for the same PR/ref
```

Use a workflow concurrency group appropriate to the PR.

No DEV/PROD deployment concurrency exists yet.

---

# 23. Permissions

Use least privilege.

PR CI should normally need only:

```yaml
permissions:
  contents: read
```

No:

```text
id-token
packages write
deployments write
Cloud permissions
```

Step 2.2 does not authenticate to GCP.

---

# 24. Action Selection / Pinning

Prefer official:

```text
actions/checkout
actions/setup-node
```

Do not add third-party Actions unless materially useful.

If a third-party action is used, pin it to an immutable commit SHA.

A local change-classifier is preferred over `dorny/paths-filter` for this small graph.

---

# 25. No Branch Protection Mutation Yet

Do NOT use GitHub CLI/API to modify:

```text
main protection
production protection
```

Step 2.2 only creates the CI capability.

We will enable protection after the check is observed working in GitHub.

---

# 26. No Production Branch Creation Yet

Do NOT create:

```text
production
```

as part of this implementation unless explicitly requested later.

The workflow may be configured to support PRs targeting it once the branch exists.

---

# 27. Local Development

Do not change product/local development behavior.

No developer should need GitHub Actions to run:

```text
server
Portal
Renderer
```

locally.

Do not modify application env contracts merely for CI.

Any CI-only build variables belong in workflow configuration.

---

# 28. Existing Manual DEV Deployment

Do not modify:

```text
scripts/deploy-dev.ps1
```

in Step 2.2.

It remains the manual DEV deployment method until Step 2.4.

---

# 29. No Terraform

No:

```text
Terraform files
Terraform install
Terraform CI
```

in Step 2.2.

Terraform begins later when we intentionally build PROD infrastructure.

---

# 30. Tests for Change Classification

Add focused deterministic tests covering at least:

```text
API-only
Portal-only
Renderer-only

site-schema
ui
site-components

platform lockfile
server lockfile

platform tsconfig
eslint config

docs-only
legacy client-only
.github-only

multiple changed paths:
    API + Portal
    Portal + Renderer
    all three

unknown path → failure
```

Also test deployment-impact outputs if implemented now.

These tests are important because the classifier becomes infrastructure policy.

---

# 31. CI Workflow Testing

Codex cannot fully prove GitHub-hosted execution locally.

Do what is practical:

```text
YAML parse / inspection
classifier tests
existing local suites
build commands with CI values
git diff --check
```

If `actionlint` is readily available, use it.

Do NOT mutate GitHub just to test the workflow.

---

# 32. Existing Product Verification

Since no product behavior should change, keep the existing suites green.

At minimum:

```text
Backend tests
Backend lint

Portal tests
Renderer tests
Shared UI tests
platform typecheck
platform lint

Portal production build using CI build values
Renderer production build using CI build values
```

No Cloud Run deployment.

---

# 33. Files Expected

Likely create:

```text
.github/workflows/ci.yml
scripts/ci/<change-classifier>
scripts/ci/<classifier-tests>
```

If a more natural location exists after inspection, use it.

Potentially update:

```text
docs/CI-CD.md
```

ONLY if a tiny Step 2.2 note is useful.

The full CI/CD document is planned for Step 2.7, so do not write a giant runbook now.

No product source should need modification.

---

# 34. Scope Discipline

Absolutely no:

```text
Google WIF
Google service accounts
gcloud deploy
Artifact Registry push
Cloud Run update
Terraform
production infrastructure
branch mutation
product-code changes
runtime-env changes
Secret Manager changes
```

---

# 35. Verification

Run/report:

```text
change-classifier tests

Backend tests
Backend lint

Portal tests
Renderer tests
Shared UI tests

platform typecheck
platform lint

Portal build with CI-only public build values
Renderer build with CI-only public build values

workflow YAML validation where practical
git diff --check
```

No deployment.

---

# 36. Return

Return a concise implementation report containing:

1. files created/modified
2. classifier architecture
3. exact path map implemented
4. CI vs deploy outputs
5. unknown-path behavior
6. PR workflow/job structure
7. API CI behavior
8. platform CI behavior
9. CI-only build variables used
10. `ci-passed` semantics
11. skipped/docs-only semantics
12. concurrency/permissions
13. Docker-validation decision
14. workflow-validation decision
15. classifier test coverage
16. full verification results
17. local-development impact
18. confirmation no cloud/GitHub settings were mutated
19. anything required before Step 2.3