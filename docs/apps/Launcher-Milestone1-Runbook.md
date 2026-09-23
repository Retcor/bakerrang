# Launcher Milestone 1 operator runbook

This runbook brings the Milestone 1 Launcher online at
`https://launch.bakerrang.com`. It does **not** change the `bakerrang.com`
apex; the legacy `bakerrang-client` remains the apex service.

Normal CI is deliberately image-only. An operator must complete and review the
Cloud Run bootstrap, IAM, domain mapping, DNS, API environment, and GitHub
Environment steps below before the first deployment.

## Fixed values

```powershell
$ProjectId = "avian-cable-379805"
$Region = "us-west1"
$LauncherService = "bakerrang-web-launcher"
$LauncherHost = "launch.bakerrang.com"
$FrontendSa = "bakerrang-frontend@$ProjectId.iam.gserviceaccount.com"
$DeployerSa = "bakerrang-github-deployer@$ProjectId.iam.gserviceaccount.com"
```

`web-launcher` is the logical CI/deployment key. Its physical Cloud Run service is
`bakerrang-web-launcher`. The production Environment variable
`WEB_LAUNCHER_SERVICE=bakerrang-web-launcher` is what resolves the logical key to
that physical service in the reusable forward-deployment workflow.

Use read-only inspection before mutation:

```powershell
gcloud run services describe $LauncherService --project $ProjectId --region $Region
gcloud beta run domain-mappings describe --domain $LauncherHost --project $ProjectId --region $Region
gcloud run services describe bakerrang-api --project $ProjectId --region $Region --format="yaml(spec.template.spec.containers[0].env)"
```

`NOT_FOUND` is expected before first bootstrap. Any existing resource requires a
reviewed update plan; do not recreate or overwrite it blindly.

## 1. Bootstrap the Cloud Run service

Create the service skeleton once so IAM can be resource-scoped before GitHub is
allowed to deploy. The placeholder is temporary and is replaced by the first
digest-pinned workflow deployment.

```powershell
$BootstrapImage = "us-docker.pkg.dev/cloudrun/container/hello"
gcloud run deploy $LauncherService `
  --project $ProjectId --region $Region --image $BootstrapImage `
  --service-account $FrontendSa --allow-unauthenticated --quiet
```

Confirm the runtime identity before continuing:

```powershell
gcloud run services describe $LauncherService --project $ProjectId --region $Region `
  --format="value(spec.template.spec.serviceAccountName,status.url)"
```

## 2. Extend production WIF permissions

The existing GitHub deployer already has short-lived WIF access and Artifact
Registry writer access. Add only the new service-scoped Cloud Run grant. The
existing `serviceAccountUser` grant on `$FrontendSa` is reused; add it only if a
read-only policy check shows it is absent.

```powershell
gcloud run services add-iam-policy-binding $LauncherService `
  --project $ProjectId --region $Region `
  --member="serviceAccount:$DeployerSa" --role="roles/run.developer"
```

Do not grant project-wide Cloud Run administration and do not add long-lived
GitHub credentials.

## 3. Configure the production GitHub Environment

Add these non-secret variables to the existing `production` Environment:

| Variable | Value |
|---|---|
| `WEB_LAUNCHER_SERVICE` | `bakerrang-web-launcher` |
| `LAUNCHER_BASE_URL` | `https://launch.bakerrang.com` |
| `VITE_API_BASE_URL` | `https://api.bakerrang.com` |

The workflow supplies the closed symbolic build target
`VITE_OAUTH_TARGET=launcher`; it is not operator input. Preserve every existing
Environment variable.

## 4. Add the API origin and OAuth target destination

The API resolves symbolic OAuth target `launcher` and the CORS allowlist from the
same `LAUNCHER_DOMAIN` value. Add it without replacing any existing API
environment variables:

```powershell
gcloud run services update bakerrang-api `
  --project $ProjectId --region $Region `
  --update-env-vars "LAUNCHER_DOMAIN=https://launch.bakerrang.com" --quiet
```

Verify the effective variable name and then smoke `/health`. Google OAuth still
returns through the existing API callback, so no new per-app Google redirect URI
is needed. The browser starts login at
`/auth/google?target=launcher`, and the API redirects only to the registered
`LAUNCHER_DOMAIN`.

## 5. Create the Cloud Run domain mapping and DNS record

Create the non-apex mapping. Do not delete, edit, or repoint the existing
`bakerrang.com` mapping.

```powershell
gcloud beta run domain-mappings create `
  --project $ProjectId --region $Region `
  --service $LauncherService --domain $LauncherHost

gcloud beta run domain-mappings describe `
  --project $ProjectId --region $Region --domain $LauncherHost `
  --format="yaml(status.resourceRecords,status.conditions)"
```

In the authoritative DNS zone, create exactly the record(s) returned in
`status.resourceRecords` (normally the returned CNAME for a subdomain). Use the
repository's reviewed DNS transaction procedure when the zone is Cloud DNS.
Never infer the target and never touch apex A/AAAA/CNAME records.

Wait for DNS and managed-certificate readiness:

```powershell
Resolve-DnsName $LauncherHost
gcloud beta run domain-mappings describe `
  --project $ProjectId --region $Region --domain $LauncherHost `
  --format="yaml(status.conditions,status.resourceRecords)"
```

## 6. Deploy and verify

From `main`, run **Deploy MAIN** with service `web-launcher`, or merge a change
classified to that service. The reusable workflow preserves the established
guarantees: write-once `git-<SHA>` image, stale-deploy guard, digest-pinned
update, unchanged runtime-service-account assertion, and SPA-shell smoke against
Cloud Run `status.url`.

After the mapping is ready, verify the public staging host:

```powershell
$response = Invoke-WebRequest "https://launch.bakerrang.com/"
if ($response.StatusCode -ne 200 -or $response.Content -notmatch '<div id="root"') {
  throw "Launcher public smoke failed."
}
```

Then verify sign-in returns to `launch.bakerrang.com`, authenticated API calls
include credentials successfully, theme persistence survives reload, and a
non-root route returns the SPA shell. The credential-free `Verify live public
ingress` workflow also checks the staging host after it exists.

## Rollback and boundary

Launcher is a normal target in **Actions → Rollback MAIN** under the logical key
`web-launcher`. The standard flow resolves it to `bakerrang-web-launcher`, validates
the `web-launcher` image package and `bakerrang-frontend@` runtime identity, and uses
the same image or historical-revision mechanisms and SPA-shell smoke checks as the
other services. Follow the [MAIN rollback runbook](../operations/rollback.md); do
not use a second Launcher-specific rollback procedure.

At no point in this runbook is `bakerrang.com` cut over. Apex migration is a
later milestone with its own reviewed plan.
