# CI/CD operations

## Pull requests

`.github/workflows/ci.yml` classifies the PR's three-dot base-to-head diff with
`scripts/ci/classify-changes.mjs`. Unknown paths fail closed. It runs API and/or shared
Platform validation only when affected, and builds each affected deployable Docker image
without authenticating to Google Cloud or pushing it. `ci-passed` remains the aggregate PR
status.

## Automatic DEV deployment

A push to `main` starts `.github/workflows/deploy-dev.yml`. The workflow validates that
`github.event.before` is a real ancestor of `github.sha`, classifies the two-dot push diff,
and validates only services selected by the classifier's `deploy_*` outputs. A known
docs/operations-only push performs no Google authentication and finishes green.

Affected services call the shared `.github/workflows/_deploy-cloud-run.yml` workflow. Each
service has non-cancelling, environment-and-service-specific concurrency. Before obtaining
Google credentials, a stale-job guard fetches current `origin/main`: it skips an older job
only when newer commits affect that same service and fails closed for rewritten history or
unknown paths.

Deployment authentication uses GitHub OIDC and Google Workload Identity Federation. There
are no stored Google credential keys. Images use write-once `git-<commit SHA>` tags and are
resolved to immutable digests under:

```text
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/api
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/portal
us-west1-docker.pkg.dev/bakerrang-dev/bakerrang-dev/site-renderer
```

Cloud Run is updated by image digest only. The workflow captures the previous ready revision,
image, and runtime service account, then confirms the ready service uses the expected digest
and the same runtime identity. It does not alter traffic, environment variables, secrets,
resources, networking, or runtime service accounts.

DEV smoke checks are:

- API: `https://api-dev.bakerrang.com/health` returns HTTP 200 and `Healthy`.
- Portal: `https://portal-dev.bakerrang.com/` returns HTTP 200.
- Renderer: `https://sites-dev.bakerrang.com/robots.txt` returns HTTP 200 and contains
  `User-agent`.

Failures are visible and are not rolled back automatically. For a manual rollback, use the
previous revision/image recorded in the deployment job summary and perform an explicitly
reviewed image-only Cloud Run update.

## Manual DEV fallback

`scripts/deploy-dev.ps1` remains the emergency full-DEV deployment path. It builds and pushes
all three services to the same Artifact Registry repositories and performs image-only Cloud
Run updates while preserving the services' existing runtime configuration.

Production automation is not implemented. The reusable workflow contract is intentionally
small so a future production caller can reuse it with a separate GitHub Environment.
