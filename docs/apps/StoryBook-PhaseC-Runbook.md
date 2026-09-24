# Story Book Phase C operator runbook

This runbook brings the independently deployed Story Book online at
`https://storybook.bakerrang.com` while preserving the legacy
`https://bakerrang.com/storybook` route. It does not change the `bakerrang.com`
apex and does not flip the shared destination registry before live acceptance.

Normal CI is image-only. An operator must review and complete the Cloud Run,
IAM, domain, DNS, API environment, and GitHub Environment steps below before
the first deployment.

## Fixed values

```powershell
$ProjectId = "avian-cable-379805"
$Region = "us-west1"
$StoryBookService = "bakerrang-web-storybook"
$StoryBookHost = "storybook.bakerrang.com"
$FrontendSa = "bakerrang-frontend@$ProjectId.iam.gserviceaccount.com"
$DeployerSa = "bakerrang-github-deployer@$ProjectId.iam.gserviceaccount.com"
```

`web-storybook` is the logical CI/deployment key. Its physical Cloud Run service
is `bakerrang-web-storybook`. The production Environment variable
`WEB_STORYBOOK_SERVICE=bakerrang-web-storybook` performs that mapping.

Inspect before mutation:

```powershell
gcloud run services describe $StoryBookService --project $ProjectId --region $Region
gcloud beta run domain-mappings describe --domain $StoryBookHost --project $ProjectId --region $Region
gcloud run services describe bakerrang-api --project $ProjectId --region $Region --format="yaml(spec.template.spec.containers[0].env)"
```

`NOT_FOUND` is expected before bootstrap. Stop and review any existing resource;
do not overwrite or recreate it blindly.

## 1. Bootstrap the Cloud Run service

```powershell
$BootstrapImage = "us-docker.pkg.dev/cloudrun/container/hello"
gcloud run deploy $StoryBookService `
  --project $ProjectId --region $Region --image $BootstrapImage `
  --service-account $FrontendSa --allow-unauthenticated --quiet

gcloud run services describe $StoryBookService --project $ProjectId --region $Region `
  --format="value(spec.template.spec.serviceAccountName,status.url)"
```

The placeholder is replaced by the first digest-pinned workflow deployment.

## 2. Extend production WIF permissions

Add only the resource-scoped Cloud Run grant to the existing GitHub deployer.
Reuse the existing `serviceAccountUser` grant on `$FrontendSa`; add it only if a
read-only policy check proves it absent.

```powershell
gcloud run services add-iam-policy-binding $StoryBookService `
  --project $ProjectId --region $Region `
  --member="serviceAccount:$DeployerSa" --role="roles/run.developer"
```

Do not grant project-wide Cloud Run administration or create long-lived keys.

## 3. Configure the production GitHub Environment

Add these non-secret variables to the existing `production` Environment while
preserving every current value:

| Variable | Value |
| --- | --- |
| `WEB_STORYBOOK_SERVICE` | `bakerrang-web-storybook` |
| `STORYBOOK_BASE_URL` | `https://storybook.bakerrang.com` |
| `VITE_API_BASE_URL` | `https://api.bakerrang.com` |

The workflow supplies the closed symbolic build target
`VITE_OAUTH_TARGET=storybook`; it is not operator input.

## 4. Add the API origin and OAuth target

The API uses the same `STORYBOOK_DOMAIN` value for explicit CORS and the
fail-closed symbolic OAuth target. Update without replacing existing variables:

```powershell
gcloud run services update bakerrang-api `
  --project $ProjectId --region $Region `
  --update-env-vars "STORYBOOK_DOMAIN=https://storybook.bakerrang.com" --quiet
```

Verify the effective variable and `/health`. Google OAuth still returns through
the existing API callback; no new per-app Google redirect URI is required.

## 5. Create the domain mapping and exact DNS records

Use the beta command surface required by the installed/current gcloud CLI:

```powershell
gcloud beta run domain-mappings create `
  --project $ProjectId --region $Region `
  --service $StoryBookService --domain $StoryBookHost

gcloud beta run domain-mappings describe `
  --project $ProjectId --region $Region --domain $StoryBookHost `
  --format="yaml(status.resourceRecords,status.conditions)"
```

Create exactly the DNS record or records returned in `status.resourceRecords`.
Do not infer the CNAME target and do not alter apex A, AAAA, or CNAME records.
Then wait for DNS and managed-certificate readiness:

```powershell
Resolve-DnsName $StoryBookHost
gcloud beta run domain-mappings describe `
  --project $ProjectId --region $Region --domain $StoryBookHost `
  --format="yaml(status.conditions,status.resourceRecords)"
```

## 6. First deployment and direct live verification

From `main`, run **Deploy MAIN** with service `web-storybook`, or merge a change
classified to that service. The shared workflow uses the write-once
`git-<SHA>` image, stale-deploy guard, digest-pinned update, unchanged runtime-SA
assertion, concurrency lock, and SPA-shell smoke against Cloud Run `status.url`.

After the mapping is ready, verify the public host directly:

```powershell
$response = Invoke-WebRequest "https://storybook.bakerrang.com/"
if ($response.StatusCode -ne 200 -or $response.Content -notmatch '<div id="root"') {
  throw "Story Book public smoke failed."
}
```

Also verify a non-root reader route returns the SPA shell, sign-in returns to
`storybook.bakerrang.com`, authenticated summary/read/rename/delete calls include
credentials, generation auto-saves, and narration stops when leaving a page.
Run `scripts/verify-live.ps1` or the credential-free **Verify live public ingress**
workflow for the fixed host checks.

## 7. Destination-registry flip only after acceptance

The implementation intentionally leaves Story Book's `liveUrl` as `null`, so
Launcher and all app switchers continue to use
`https://bakerrang.com/storybook`. After the independent host has passed direct
live acceptance:

1. Make a separate minimal change in `@bakerrang/web-app-shell` setting Story
   Book `liveUrl` to `https://storybook.bakerrang.com`.
2. Run normal CI and redeploy every consumer selected by shared-package fan-out.
3. Verify Launcher and Story Book switchers navigate directly to the extracted app.
4. Keep the legacy route available; do not add a redirect or cut over the apex.

## Rollback and boundaries

Story Book is a normal **Actions → Rollback MAIN** target under `web-storybook`.
It resolves to `bakerrang-web-storybook`, validates the `web-storybook` package
and frontend runtime identity, shares the production service concurrency lock,
and uses the standard image or historical-revision mechanisms plus SPA smoke.
Follow the [MAIN rollback runbook](../operations/rollback.md).

This runbook never changes the `bakerrang.com` mapping, removes the legacy Story
Book, deploys another product, or performs the registry flip before acceptance.
