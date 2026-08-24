# BakerRang DEV deployment and smoke runbook

Use this runbook to build, deploy, and verify the existing BakerRang DEV services. It is DEV-only: do not adapt these commands for production.

## Environment

| Resource | Value |
|---|---|
| GCP project | `bakerrang-dev` |
| Region | `us-west1` |
| API service | `bakerrang-api-dev` |
| Portal service | `bakerrang-portal-dev` |
| Renderer service | `bakerrang-site-renderer-dev` |
| API URL | `https://api-dev.bakerrang.com` |
| Portal URL | `https://portal-dev.bakerrang.com` |
| Shared site URL | `https://sites-dev.bakerrang.com` |
| Permanent custom-domain test URL | `https://custom-dev.bakerrang.com` |

## Architecture

- `platform/apps/portal` is the operator/admin application.
- `platform/apps/site-renderer` is the public multi-tenant website renderer.
- `server` is the Express API and the only Firestore boundary used by these apps.
- Portal requests flow `Portal -> API -> Firestore`.
- Public requests flow `Renderer -> sanitized API -> Firestore`; the renderer never connects directly to Firestore.

Editors mutate the working site. Preview reads that working copy. Publish creates the public snapshot; later working edits remain unpublished until the next publish.

For deeper context, see [Step 1.23 DEV Platform Architecture](marketing-site/Step1.23-DevPlatform-Architecture.md).

## Prerequisites

- Node.js 24 and npm
- Docker running locally
- Google Cloud CLI authenticated to an account that can read the three services, push their current Artifact Registry repositories, and update Cloud Run revisions
- Application Default Credentials when running the API locally against DEV
- Existing runtime secrets/configuration already attached to the Cloud Run services

Confirm the active identity before deploying:

```powershell
gcloud auth list
gcloud config get-value project
```

The deploy helper pins `bakerrang-dev` itself and does not trust the active project setting.

## Build contexts and configuration

| Image | Build context | Dockerfile |
|---|---|---|
| API | `server/` | `server/Dockerfile` |
| Portal | `platform/` | `platform/apps/portal/Dockerfile` |
| Renderer | `platform/` | `platform/apps/site-renderer/Dockerfile` |

Portal build arguments:

| Variable | DEV value | Requirement |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api-dev.bakerrang.com` | Required |
| `NEXT_PUBLIC_SITE_PREVIEW_ORIGIN` | `https://sites-dev.bakerrang.com` | Required |
| `CUSTOM_DOMAIN_IPV4_ADDRESS` | `8.232.231.135` | Optional; currently used |
| `CUSTOM_DOMAIN_CNAME_TARGET` | — | Optional; not currently used |

Renderer build argument:

```text
NEXT_PUBLIC_SITE_API_BASE_URL=https://api-dev.bakerrang.com
```

`NEXT_PUBLIC_*` values are embedded in the Next.js bundles during the image build. Renderer runtime origins are separate and must not be substituted with build arguments.

## API runtime contract

Required in every deployed API revision:

```text
FIRESTORE_PROJECT_ID
MEDIA_BUCKET_NAME
SESSION_SECRET
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
SERVER_DOMAIN
PORTAL_DOMAIN
SITE_RENDERER_DOMAIN
```

`PREVIEW_TOKEN_SECRET` is additionally required when `NODE_ENV=production`, which is how the API container runs.

Optional:

```text
CLIENT_DOMAIN
CHATBOT_ORIGIN
```

`CLIENT_DOMAIN` grants API CORS access to the legacy learning-playground client when configured. It is not required by the DEV marketing platform. A supplied origin must still be a clean absolute HTTP/HTTPS origin.

> **Firestore safety:** `FIRESTORE_PROJECT_ID` must always be explicit. DEV must use `FIRESTORE_PROJECT_ID=bakerrang-dev`. There is no `NODE_ENV` or Google Cloud project-discovery fallback; a missing value stops API startup.

Store sensitive values in Secret Manager and attach them to Cloud Run as secret references. Never place secret values in source, image build arguments, command history, or this runbook.

## Renderer runtime contract

The renderer requires both clean absolute origins at every startup:

```text
SITE_API_BASE_URL=https://api-dev.bakerrang.com
SITE_PUBLIC_ORIGIN=https://sites-dev.bakerrang.com
```

DEV also uses:

```text
SITE_PUBLIC_INDEXING_ENABLED=false
```

Only the exact string `true` enables indexing. Missing, false, or unrecognized values disable it. The container preflight validates both required origins and exits before Next starts listening when either is absent or invalid.

## Inspect configuration safely

Review names, plain values, and Secret Manager references without printing secret contents:

```powershell
$Project = 'bakerrang-dev'
$Region = 'us-west1'

gcloud run services describe bakerrang-api-dev `
  --project $Project --region $Region `
  --format='yaml(spec.template.spec.containers[0].env)'

gcloud run services describe bakerrang-site-renderer-dev `
  --project $Project --region $Region `
  --format='yaml(spec.template.spec.containers[0].env)'
```

For intentional configuration maintenance, `--update-env-vars` and `--update-secrets` selectively update existing settings. Avoid casual use of replacement-style `--set-env-vars` or `--set-secrets`, which can remove settings omitted from the command.

Normal application deployment changes only the image:

```powershell
gcloud run services update <service> `
  --project bakerrang-dev `
  --region us-west1 `
  --image <new-image> `
  --quiet
```

This preserves the service's existing runtime environment, secrets, IAM, routing, and infrastructure configuration.

## Deploy DEV

From any working directory, run:

```powershell
& C:\path\to\bakerrang\scripts\deploy-dev.ps1
```

Or provide an immutable Docker-compatible tag:

```powershell
& C:\path\to\bakerrang\scripts\deploy-dev.ps1 -Tag dev-20260823-1
```

The helper:

1. Verifies the expected repository paths.
2. Reads each current image reference from its existing Cloud Run service and derives that Artifact Registry repository.
3. Authenticates Docker to the derived registry host(s).
4. Builds the API from `server/` and both Next images from `platform/` with the documented DEV build arguments.
5. Pushes all three images.
6. Updates only each service's image reference.

It does not change environment variables, secrets, IAM, DNS, load balancing, domains, or Firestore data.

### Rollback

List revisions and identify the previously healthy image:

```powershell
gcloud run revisions list --service bakerrang-api-dev --project bakerrang-dev --region us-west1
gcloud run revisions list --service bakerrang-portal-dev --project bakerrang-dev --region us-west1
gcloud run revisions list --service bakerrang-site-renderer-dev --project bakerrang-dev --region us-west1
```

Update the affected service back to its prior image using the image-only command above. Do not repair an application rollback by replacing the service's environment or secrets.

## Local development

### API

```powershell
Set-Location server
Copy-Item .env.example .env
npm install
npm run start
```

Fill `server/.env` locally without committing secrets. Authenticate ADC with `gcloud auth application-default login`, and explicitly use `FIRESTORE_PROJECT_ID=bakerrang-dev` only when DEV access is intended.

### Portal

Both `platform/apps/portal/.env.example` and `.env.local.example` exist. Copy the local example:

```powershell
Set-Location platform
Copy-Item apps/portal/.env.local.example apps/portal/.env.local
npm install
npm run dev:portal
```

### Renderer

Both `platform/apps/site-renderer/.env.example` and `.env.local.example` exist. Copy the local example:

```powershell
Set-Location platform
Copy-Item apps/site-renderer/.env.local.example apps/site-renderer/.env.local
npm install
npm run dev:sites
```

Google OAuth must allow the local callback and browser origins matching the configured `SERVER_DOMAIN` and `PORTAL_DOMAIN`. Consult the OAuth client configuration rather than inventing redirect URLs.

Builds require the corresponding configured `NEXT_PUBLIC_*` values in the environment or app env files.

## Test commands

Backend:

```powershell
Set-Location server
npm test
npm run lint
```

Platform:

```powershell
Set-Location platform
npm test
npm run typecheck
npm run lint
npm run build
```

Focused workspace tests are also available through `npm test -w @bakerrang/portal`, `npm test -w @bakerrang/site-renderer`, and `npm test -w @bakerrang/ui` from `platform/`.

## Final DEV smoke checklist

Allow 15–30 minutes. Reuse the designated **Smoke Test** tenant; do not create a new business for every run.

### Configuration and health

- [ ] API startup logs contain `Firestore project: bakerrang-dev`.
- [ ] `GET https://api-dev.bakerrang.com/health` returns 200.

### Authentication

- [ ] Google sign-in completes and Portal loads.
- [ ] Refresh preserves the session.
- [ ] Sign out returns to login.
- [ ] An unauthenticated deep link returns to the intended location after login.

### Business workspace

- [ ] The business list loads and the Smoke Test business opens.
- [ ] Overview, Website, Leads, and Domain are reachable.

### Website lifecycle

- [ ] Edit Hero or one content section and Save.
- [ ] Make another edit; verify **Unsaved changes** appears.
- [ ] Attempt an editor/navigation switch; verify the discard guard.
- [ ] Preview opens the working copy.
- [ ] Publish or Republish; verify status becomes **Published**.
- [ ] Edit again; verify **Changes not published**.
- [ ] Republish and verify **Published** again.
- [ ] During this final Step 1.30 smoke, test Unpublish once, then restore the tenant to published.

### Domain and public site

- [ ] Domain shows `custom-dev.bakerrang.com` as ACTIVE; do not register another hostname.
- [ ] `https://custom-dev.bakerrang.com` serves the published site over HTTPS.
- [ ] The shared published URL redirects appropriately.
- [ ] Home, Contact, media, theme, Custom CSS, and configured social/footer content render correctly.
- [ ] At approximately 375px, the public site remains usable without horizontal overflow.

The TXT/DNS ownership lifecycle does not need repeating during routine smoke runs; it was already verified for the permanent hostname.

### Leads

- [ ] Submit one real lead from the published public site and see success.
- [ ] Verify it appears in Portal and its detail opens.
- [ ] Change its status and add a note.
- [ ] Verify Preview cannot create real leads.

Smoke leads may accumulate and can be removed manually from DEV Firestore if they become noisy; this runbook intentionally performs no automated cleanup.

### Responsive, console, and network

- [ ] At approximately 375px, 768px, and desktop, spot-check Business list, workspace navigation, Leads, and Domain.
- [ ] Check for horizontal overflow, unreachable controls, broken dialogs, or hidden critical content.
- [ ] Check the browser console/network for unexpected 404, 500, CORS, hydration, mixed-content, or media failures.
- [ ] Ignore browser-extension noise. The known tenant-site `/favicon.ico` 404 is acceptable for now.

### Restore the baseline

- [ ] Leave the Smoke Test tenant published.
- [ ] Leave `custom-dev.bakerrang.com` ACTIVE.
- [ ] Do not leave intentionally broken content or configuration behind.

## Known DEV deferrals

- **Tenant favicon:** `/favicon.ico` may return 404. The intended future implementation is tenant-configurable, media-backed, working/published-aware, and shared/custom-domain capable. Do not add a global favicon or 204 workaround.
- **Browser E2E:** Playwright remains deferred until a clean test-auth strategy exists. Manual DEV smoke is the final gate.
- **Production and operations:** production deployment, production DNS/OAuth, Terraform/IaC, distributed rate limiting, advanced monitoring, load testing, backup/restore, secret rotation, formal penetration testing, and formal WCAG certification are outside this runbook.
