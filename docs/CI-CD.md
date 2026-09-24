# CI/CD operations

MAIN/live is the sole deployed environment and has six deployment targets: API, Portal, Site Renderer, Client, Web Launcher, and Web Story Book. Pull requests validate only, and pushes to `main` selectively deploy affected services to MAIN/live. DEV has no cloud deployment path; the `bakerrang-dev` project remains only as local-development data backing.

For routine release, verification, compatibility, and retention policy, see the [MAIN/live operations guide](operations/live-ops.md). For emergency recovery, see the [MAIN rollback runbook](operations/rollback.md).

## Pull requests to main

`.github/workflows/ci.yml` runs only for pull requests targeting `main`. There is no `production` branch.

`scripts/ci/classify-changes.mjs` is the single authoritative dependency graph. It classifies the PR's three-dot base-to-head diff and fails closed on unknown paths:

- `server/**` → API;
- `client/**` → Client only;
- `web/apps/launcher/**` → Web Launcher only;
- `web/apps/storybook/**` → Web Story Book only;
- `web/packages/**` and shared Web workspace/build inputs → both web apps;
- `platform/apps/portal/**` → Portal;
- `platform/apps/site-renderer/**` → Renderer;
- `platform/packages/site-schema/**` and `platform/packages/ui/**` → Portal and Renderer;
- `platform/packages/site-components/**` → Renderer only;
- shared Platform build/config inputs → Portal and Renderer as explicitly defined in the classifier.

Workflow YAML consumes classifier outputs and does not duplicate this map. API CI runs lint, tests, and Docker packaging. Platform CI runs lint, typecheck, tests, affected builds, and affected Docker packaging. Client CI uses its own lockfile/package root and Node 20, then runs lint, build, and `docker build client`. Docker checks neither push nor authenticate. `ci-passed` accepts unaffected jobs only when skipped and fails on an affected validation failure.

Branch protection for `main` must require **`ci-passed`** for pull-request merge. Do not require `live-deploy-passed`, `verify-live`/`live-public-ingress`, or any `rollback`/`Rollback MAIN` job: these are post-merge or operator signals and cannot serve as pre-merge gates.

PR CI has `contents: read` only: no `id-token: write`, registry login, GCP authentication, or long-lived credential.

## Automatic MAIN/live deployment

A push to `main` starts `.github/workflows/deploy.yml`. Its credential-free `changes` job validates the actual `github.event.before..github.sha` range, requires linear ancestry, rejects an empty/all-zero `before` SHA, and runs the authoritative classifier. Unknown paths fail closed.

Affected services validate and call `.github/workflows/_deploy-cloud-run.yml` independently:

```text
changes
  ├─ validate-api      → deploy-api
  ├─ validate-platform → deploy-portal
  │                    → deploy-renderer
  ├─ validate-client   → deploy-client
  └─ validate-web      → deploy-web-launcher
                         deploy-web-storybook
```

Every deployment caller uses GitHub Environment `production`, immutable `git-${{ github.sha }}` image identity, and `smoke_via_service_url: true`. Only deployment callers receive `id-token: write`; classification, validation, guards, and aggregate status have `contents: read` only. Each reusable call retains service-specific concurrency, so unrelated services can proceed independently while two deployments of the same environment/service serialize with `cancel-in-progress: false`.

Service selectors and classifier outputs use logical deployment keys. For Launcher,
the key is `web-launcher`; `WEB_LAUNCHER_SERVICE` in the `production` Environment
must contain the canonical physical Cloud Run service name
`bakerrang-web-launcher`. Story Book uses `web-storybook`,
`WEB_STORYBOOK_SERVICE`, and `bakerrang-web-storybook`. The reusable workflow performs that resolution before
the stale-deploy guard, digest-pinned update, and smoke check.

`live-deploy-passed` is the stable aggregate status. A classifier failure, affected validation failure, or affected deployment failure is red. Unaffected service jobs may be skipped. A no-service push is green without authenticating to Google Cloud or deploying anything.

Before OIDC authentication, each reusable deployment fetches current `origin/main`. An older job is skipped only when a newer main commit affects the same service; unknown paths and rewritten/non-linear history fail closed. This prevents an older relevant revision from winning during rapid pushes without unnecessarily blocking unrelated services.

## Manual MAIN/live deployment

The same `.github/workflows/deploy.yml` retains `workflow_dispatch`. The operator must select exactly one of `api`, `portal`, `renderer`, `client`, `web-launcher`, or `web-storybook`; there is intentionally no `all` option.

```text
guard-main → deploy-selected-service → live-deploy-passed
```

`guard-main` visibly fails unless `github.ref` is `refs/heads/main`. It has only `contents: read` and completes before the selected deploy caller can receive `id-token: write`. The production WIF provider independently restricts the immutable repository owner ID, repository ID, and main ref. The caller deploys the current SHA through the same production reusable workflow and remains image-only.

## Deployment mechanics and smoke

The reusable workflow authenticates through WIF, builds a missing write-once `git-<SHA>` image or reuses that exact existing tag/digest, and updates Cloud Run with `repository@sha256:...`. It records the previous revision/image/runtime service account, updates only the image, and asserts that the runtime identity did not change. It never deploys `latest` and does not alter traffic, environment variables, secrets, resources, networking, or service accounts.

Normal image deployments do **not** manage environment variables, secrets, Firestore indexes, Scheduler jobs, or Cloud Run timeout/memory. Those are operational prerequisites managed through the reviewed runbooks, including the [Step 3 release operations runbook](operations/step3-release.md), rather than through CI/CD workflows.

MAIN deployment smoke resolves each deployed Cloud Run service's `status.url` after the update:

- API: `<status.url>/health` → HTTP 200 and body `Healthy`;
- Portal: `<status.url>/` → HTTP 200;
- Renderer: `<status.url>/robots.txt` → HTTP 200 and `User-agent`;
- Client: `<status.url>/` → HTTP 200 and the `<div id="root"` SPA shell.
- Web Launcher: `<status.url>/` → HTTP 200 and the `<div id="root"` SPA shell.
- Web Story Book: `<status.url>/` → HTTP 200 and the `<div id="root"` SPA shell.

This proves the revision, image, and runtime work. Public ingress verification for `portal.bakerrang.com`, `sites.bakerrang.com`, `api.bakerrang.com`, `bakerrang.com`, `launch.bakerrang.com`, `storybook.bakerrang.com`, or a customer domain is separate because it proves DNS, load balancing or domain mapping, TLS, and host routing. The one-time prerequisites are in the [Milestone 1 Launcher runbook](apps/Launcher-Milestone1-Runbook.md) and [Phase C Story Book runbook](apps/StoryBook-PhaseC-Runbook.md).

## Read-only live verification

Run `scripts/verify-live.ps1` from an operator workstation with readable production gcloud credentials to inspect the six services without mutating them. It reports configured traffic intent, actual serving revisions, latest ready/created revisions, serving image and resolvable `git-<SHA>` tag, serving-revision runtime identity, readiness, and fixed public ingress health. `-Deep` additionally checks `custom.bakerrang.com`. Traffic is healthy only when one 100% `latestRevision: true` target resolves to the latest ready revision; PINNED, SPLIT, UNKNOWN, readiness failures, identity mismatches, and required public-check failures produce a non-zero exit.

`.github/workflows/verify-live.yml` performs only credential-free fixed-host HTTP checks. It runs manually, once daily, and after every completed `Deploy MAIN` workflow. It still runs after a failed deployment as diagnostic evidence and does not change or retroactively determine the deployment workflow's conclusion. The workflow has `contents: read` only and no OIDC permission.

## Manual rollback

For operator-initiated per-service recovery, see the [MAIN rollback runbook](operations/rollback.md).
`Rollback MAIN` is manual and main-only in `production`, authenticates with production WIF, shares the forward same-service deployment concurrency lock, and intentionally does not use the forward stale-deploy guard. Primary rollback is image-only: it requires LATEST traffic and preserves current config. Historical revision rollback pins traffic and requires explicit operator unpin recovery.
Launcher is selected with the same logical key `web-launcher` and resolves through
the rollback policy's fixed map to `bakerrang-web-launcher`.
Story Book likewise uses `web-storybook` and resolves to `bakerrang-web-storybook`.

## Local development data backing

DEV deployment infrastructure was retired in Step 2.5e. There is no DEV deployment workflow, GitHub deployment path, WIF authentication path, Cloud Run service, or load balancer in the repository's active operating model.

Local processes run on the developer machine and use Application Default Credentials where Google access is required:

- Firestore: project `bakerrang-dev`, database `(default)`;
- media: `gs://bakerrang-dev-media-marketing`;
- API, Portal, Renderer, and Client: local processes and localhost origins;
- authentication: developer ADC, never GitHub WIF.

No public DEV DNS is required. Historical deployment details remain in [DEV-DEPLOYMENT.md](DEV-DEPLOYMENT.md), clearly marked retired, for audit and reconstruction only.

See [live-environment-bootstrap.md](infra/live-environment-bootstrap.md) for reconstruction, scoped IAM, MAIN ingress, and live-impact boundaries, [Step1.23-CustomDomains-OperatorRunbook.md](marketing-site/Step1/Step1.23-CustomDomains-OperatorRunbook.md) for customer-domain certificate onboarding, and [local-development.md](infra/local-development.md) for local configuration.
