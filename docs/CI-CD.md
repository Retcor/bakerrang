# CI/CD operations

Step 2.5b is a transitional four-service model. PR validation covers API, Portal, Site Renderer, and Client; DEV still deploys automatically; MAIN/live deployment is an explicit manual action.

## Pull requests to main

`.github/workflows/ci.yml` runs only for pull requests targeting `main`. There is no `production` branch.

`scripts/ci/classify-changes.mjs` is the single authoritative dependency graph. It classifies the PR's three-dot base-to-head diff and fails closed on unknown paths:

- `server/**` → API;
- `client/**` → Client only;
- `platform/apps/portal/**` → Portal;
- `platform/apps/site-renderer/**` → Renderer;
- `platform/packages/site-schema/**` and `platform/packages/ui/**` → Portal and Renderer;
- `platform/packages/site-components/**` → Renderer only;
- shared Platform build/config inputs → Portal and Renderer as explicitly defined in the classifier.

Workflow YAML consumes classifier outputs and does not duplicate this map. API CI runs lint, tests, and Docker packaging. Platform CI runs lint, typecheck, tests, affected builds, and affected Docker packaging. Client CI uses its own lockfile/package root and Node 20, then runs lint, build, and `docker build client`. Docker checks neither push nor authenticate. `ci-passed` accepts unaffected jobs only when skipped and fails on an affected validation failure.

PR CI has `contents: read` only: no `id-token: write`, registry login, GCP authentication, or long-lived credential.

## Temporary automatic DEV deployment

A push to `main` still starts the existing `.github/workflows/deploy-dev.yml` temporarily. It validates `before..after` ancestry and continues validating/deploying affected API, Portal, and Renderer services. A Client-only change is classified but does not expand the retained DEV deployment stack. A docs/operations-only push obtains no Google credentials.

`.github/workflows/_deploy-cloud-run.yml` supports `api`, `portal`, `renderer`, and `client`. Before OIDC authentication, its stale guard fetches current `origin/main`; it skips an old job only when a newer main commit affects that service. Unknown paths and rewritten/non-linear history fail closed.

Deployments use WIF, immutable `git-<SHA>` tags, existing digest reuse, and image-only Cloud Run updates. The workflow records the previous revision/image/runtime service account, deploys by digest, and asserts the runtime identity is unchanged. It does not alter traffic, environment variables, secrets, resources, networking, or runtime service accounts.

DEV smoke checks are API HTTP 200 plus `Healthy`, Portal HTTP 200, Renderer `robots.txt` HTTP 200 plus `User-agent`, and Client HTTP 200 plus the stable `<div id="root"` SPA shell. Failures are visible and not automatically rolled back; use the prior revision/image in the job summary for a separately reviewed image-only rollback.

## Manual MAIN/live deployment

`.github/workflows/deploy.yml` has `workflow_dispatch` only—no `push` or `pull_request`. The operator selects exactly one of `api`, `portal`, `renderer`, or `client`; there is intentionally no `all` option.

```text
guard-main -> deploy-selected-service -> live-deploy-passed
```

`guard-main` visibly fails unless `github.ref` is `refs/heads/main`. It has only `contents: read` and executes before the selected deploy caller receives `id-token: write`. The production WIF provider independently restricts immutable repository owner ID, repository ID, and main ref. The caller passes GitHub Environment `production` and `git-${{ github.sha }}`. Only the selected service authenticates or deploys.

The Environment name `production` is not a branch. Do not run live deployment while implementing or reviewing Step 2.5b.

## Next transition

Automatic `main` → live deployment is **not enabled**. Step 2.5d will remove DEV auto-deploy and may enable automatic live deployment after live cutover/audit.

## Manual DEV fallback

`scripts/deploy-dev.ps1` remains the emergency full-DEV path and requires an explicit operational decision.

See [live-environment-bootstrap.md](infra/live-environment-bootstrap.md) for reconstruction, scoped IAM, and live-impact boundaries, and [local-development.md](infra/local-development.md) for local configuration.
