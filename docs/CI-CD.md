# CI/CD operations

MAIN/live is the sole deployed environment and has four services: API, Portal, Site Renderer, and Client. Pull requests validate only, and pushes to `main` selectively deploy affected services to MAIN/live. DEV has no cloud deployment path; the `bakerrang-dev` project remains only as local-development data backing.

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

## Automatic MAIN/live deployment

A push to `main` starts `.github/workflows/deploy.yml`. Its credential-free `changes` job validates the actual `github.event.before..github.sha` range, requires linear ancestry, rejects an empty/all-zero `before` SHA, and runs the authoritative classifier. Unknown paths fail closed.

Affected services validate and call `.github/workflows/_deploy-cloud-run.yml` independently:

```text
changes
  ├─ validate-api      → deploy-api
  ├─ validate-platform → deploy-portal
  │                    → deploy-renderer
  └─ validate-client   → deploy-client
```

Every deployment caller uses GitHub Environment `production`, immutable `git-${{ github.sha }}` image identity, and `smoke_via_service_url: true`. Only deployment callers receive `id-token: write`; classification, validation, guards, and aggregate status have `contents: read` only. Each reusable call retains service-specific concurrency, so unrelated services can proceed independently while two deployments of the same environment/service serialize with `cancel-in-progress: false`.

`live-deploy-passed` is the stable aggregate status. A classifier failure, affected validation failure, or affected deployment failure is red. Unaffected service jobs may be skipped. A no-service push is green without authenticating to Google Cloud or deploying anything.

Before OIDC authentication, each reusable deployment fetches current `origin/main`. An older job is skipped only when a newer main commit affects the same service; unknown paths and rewritten/non-linear history fail closed. This prevents an older relevant revision from winning during rapid pushes without unnecessarily blocking unrelated services.

## Manual MAIN/live deployment

The same `.github/workflows/deploy.yml` retains `workflow_dispatch`. The operator must select exactly one of `api`, `portal`, `renderer`, or `client`; there is intentionally no `all` option.

```text
guard-main → deploy-selected-service → live-deploy-passed
```

`guard-main` visibly fails unless `github.ref` is `refs/heads/main`. It has only `contents: read` and completes before the selected deploy caller can receive `id-token: write`. The production WIF provider independently restricts the immutable repository owner ID, repository ID, and main ref. The caller deploys the current SHA through the same production reusable workflow and remains image-only.

## Deployment mechanics and smoke

The reusable workflow authenticates through WIF, builds a missing write-once `git-<SHA>` image or reuses that exact existing tag/digest, and updates Cloud Run with `repository@sha256:...`. It records the previous revision/image/runtime service account, updates only the image, and asserts that the runtime identity did not change. It never deploys `latest` and does not alter traffic, environment variables, secrets, resources, networking, or service accounts.

MAIN deployment smoke resolves each deployed Cloud Run service's `status.url` after the update:

- API: `<status.url>/health` → HTTP 200 and body `Healthy`;
- Portal: `<status.url>/` → HTTP 200;
- Renderer: `<status.url>/robots.txt` → HTTP 200 and `User-agent`;
- Client: `<status.url>/` → HTTP 200 and the `<div id="root"` SPA shell.

This proves the revision, image, and runtime work. Public ingress verification for `portal.bakerrang.com`, `sites.bakerrang.com`, `api.bakerrang.com`, `bakerrang.com`, or a customer domain is separate because it proves DNS, load balancing, TLS, and host routing.

## Local development data backing

DEV deployment infrastructure was retired in Step 2.5e. There is no DEV deployment workflow, GitHub deployment path, WIF authentication path, Cloud Run service, or load balancer in the repository's active operating model.

Local processes run on the developer machine and use Application Default Credentials where Google access is required:

- Firestore: project `bakerrang-dev`, database `(default)`;
- media: `gs://bakerrang-dev-media-marketing`;
- API, Portal, Renderer, and Client: local processes and localhost origins;
- authentication: developer ADC, never GitHub WIF.

No public DEV DNS is required. Historical deployment details remain in [DEV-DEPLOYMENT.md](DEV-DEPLOYMENT.md), clearly marked retired, for audit and reconstruction only.

See [live-environment-bootstrap.md](infra/live-environment-bootstrap.md) for reconstruction, scoped IAM, MAIN ingress, and live-impact boundaries, [Step1.23-CustomDomains-OperatorRunbook.md](marketing-site/Step1/Step1.23-CustomDomains-OperatorRunbook.md) for customer-domain certificate onboarding, and [local-development.md](infra/local-development.md) for local configuration.
