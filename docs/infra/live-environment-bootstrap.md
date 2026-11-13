# Live environment bootstrap and reconstruction runbook

This runbook records the manually created MAIN/live foundation in Google Cloud and its GitHub deployment trust. It is for reconstruction and audit; it is **not** authorization to modify live services. Review every command and current resource before running it. Commands use Windows PowerShell syntax and contain no secret values.

## Variables and prerequisites

```powershell
$ProjectId = "avian-cable-379805"
$ProjectNumber = "307696703523"
$Region = "us-west1"
$Repository = "bakerrang"
$GitHubOwnerId = "2282360"
$GitHubRepositoryId = "715929041"
$DeployerSa = "bakerrang-github-deployer@$ProjectId.iam.gserviceaccount.com"
$ApiSa = "bakerrang-api@$ProjectId.iam.gserviceaccount.com"
$FrontendSa = "bakerrang-frontend@$ProjectId.iam.gserviceaccount.com"
gcloud config set project $ProjectId
```

Use `gcloud` authenticated as an operator with permission to create these resources. Setting the project is a safety aid, not a substitute for reviewing every target.

## Architecture

- MAIN/live: `avian-cable-379805` (`307696703523`), region `us-west1`. The Cloud Run service set is `bakerrang-api` plus the consumer web apps `bakerrang-web-{launcher,storybook,polyglot,sign,budget,passwords,account}`. **Every public host — including the apex `bakerrang.com` / `www.` and `api.` — uses a direct Cloud Run domain mapping** (see [Public ingress](#public-ingress-cloud-run-domain-mappings)).
- **Retired 2026-11-12:** `bakerrang-client` (legacy SPA), `bakerrang-portal` and `bakerrang-site-renderer` (marketing-site platform). See [Retirement cutover](#retirement-cutover-2026-11) for the one-time manual teardown.
- Local data backing: `bakerrang-dev` retains only Firestore `(default)`, `bakerrang-dev-media-marketing`, and the developer IAM needed for ADC. Its former Cloud Run/LB/WIF deployment stack is historical inventory below.
- Live images use the `bakerrang` Artifact Registry repository. The former global external Application Load Balancer (static IPv4 `34.8.236.85`, `bakerrang-web-ip`) has been **decommissioned**: no URL maps, backends, NEGs, forwarding rules, or reserved global addresses remain (verified 2026-11-12).

## APIs

Enable Compute Engine, IAM Credentials, and Security Token Service APIs:

```powershell
gcloud services enable compute.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project $ProjectId
```

Cloud Run, Artifact Registry, Secret Manager, and Cloud Storage APIs must also be enabled when using those products.

## Artifact Registry

Create an immutable-tag Docker repository:

```powershell
gcloud artifacts repositories create $Repository `
  --project $ProjectId `
  --location $Region `
  --repository-format docker `
  --immutable-tags `
  --description "BakerRang live deployment images"

gcloud artifacts repositories describe $Repository --project $ProjectId --location $Region
```

Immutable tags make each CI `git-<SHA>` identity write-once.
The steady-state policy keeps immutable tags enabled, intentionally retains tagged
`git-<SHA>` rollback images at the current scale, and configures no cleanup policy.
See the [MAIN/live operations guide](../operations/live-ops.md#artifact-registry-retention).

## Public ingress: Cloud Run domain mappings

All public hosts are Cloud Run domain mappings in `us-west1` (Google-managed certificates). Subdomains use a
`CNAME` to `ghs.googlehosted.com.`; the apex uses Cloud Run's fixed `A`/`AAAA` records
(`216.239.32/34/36/38.21`, `2001:4860:4802:32/34/36/38::15`) in the `bakerrang-client` Cloud DNS zone.

| Host | Cloud Run service |
|---|---|
| `api.bakerrang.com` | `bakerrang-api` |
| `bakerrang.com`, `www.bakerrang.com` | `bakerrang-web-launcher` (target; see below) — `web/nginx/apps/launcher.conf` answers these hosts with a 301 to `https://launch.bakerrang.com/`, old paths going to their subdomain |
| `launch.` / `storybook.` / `polyglot.` / `sign.` / `budget.` / `passwords.` / `account.bakerrang.com` | `bakerrang-web-<app>` |

Cloud Run domain mappings pass the original `Host` header to the container, which is what lets the Launcher's nginx tell the apex apart from `launch.`.

```powershell
gcloud beta run domain-mappings list --project $ProjectId --region $Region
```

Unrelated services share the project and zone (`danbaker.info`, `claude-exam.`, `plex-requests.`); leave them alone.

### Retirement cutover (2026-11)

Before the cutover `bakerrang.com` and `www.` were mapped to `bakerrang-client`, `portal.` to `bakerrang-portal`, and `sites.` / `custom.` to `bakerrang-site-renderer`. One-time, operator-run, live-impact order — **only after the merge has deployed the Launcher image containing `launcher.conf`**:

```powershell
$P = "avian-cable-379805"; $R = "us-west1"

# 1. Remap the apex and www to the Launcher. A mapping's target can't be edited in place, so delete and
#    recreate it. DNS records stay the same; expect a few minutes (occasionally longer) of TLS errors while
#    Cloud Run re-provisions the certificate.
foreach ($d in "bakerrang.com", "www.bakerrang.com") {
  gcloud beta run domain-mappings delete --domain $d --project $P --region $R --quiet
  gcloud beta run domain-mappings create --domain $d --service bakerrang-web-launcher --project $P --region $R
}
gcloud beta run domain-mappings describe --domain bakerrang.com --project $P --region $R --format="value(status.conditions)"
curl.exe -sI https://bakerrang.com/passwords   # expect 301 -> https://passwords.bakerrang.com/

# 2. Remove the retired mappings, their DNS records, and the services.
foreach ($d in "portal.bakerrang.com", "sites.bakerrang.com", "custom.bakerrang.com") {
  gcloud beta run domain-mappings delete --domain $d --project $P --region $R --quiet
}
#    Then delete the portal./sites./custom. CNAME records from the bakerrang-client zone
#    (gcloud dns record-sets delete <host>. --zone=bakerrang-client --type=CNAME).
foreach ($svc in "bakerrang-client", "bakerrang-portal", "bakerrang-site-renderer") {
  gcloud run services delete $svc --project $P --region $R --quiet
}
```

Also retire: the media bucket `gs://bakerrang-media-marketing`, the Secret Manager secrets for `PREVIEW_TOKEN_SECRET`, `RESEND_API_KEY`, `INTERNAL_DRAIN_TOKEN` and `BLIZZARD_CLIENT_SECRET`, any lead-notification Cloud Scheduler job, the now-unused API env vars (`CLIENT_DOMAIN`, `PORTAL_DOMAIN`, `SITE_RENDERER_DOMAIN`, `MEDIA_BUCKET_NAME`, `LEAD_NOTIFICATION_FROM`, `BLIZZARD_CLIENT_ID`, plus the secret-backed ones above — remove with `--remove-env-vars` / `--remove-secrets`, never a replacing update), and the GitHub `production` variables `CLIENT_*`, `PORTAL_*`, `RENDERER_SERVICE`, `NEXT_PUBLIC_SITE_*`, `CUSTOM_DOMAIN_IPV4_ADDRESS`. Optionally prune the deployed Firestore indexes with `firebase deploy --only firestore:indexes --force`.

## Frontend runtime service account

`bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com` is the runtime identity of every consumer web app and deliberately has essentially no project permissions.

```powershell
gcloud iam service-accounts create bakerrang-frontend --project $ProjectId --display-name="BakerRang frontend runtime"
```

Normal CI does not pass `--service-account`; its runtime-SA-unchanged assertion protects this state.

## MAIN WIF

MAIN uses pool `github`, provider `bakerrang`, issuer `https://token.actions.githubusercontent.com`, and deployer `bakerrang-github-deployer@avian-cable-379805.iam.gserviceaccount.com`.

```powershell
gcloud iam workload-identity-pools create github --project $ProjectId --location global --display-name="GitHub Actions"

$AttributeMapping = "google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref"
$AttributeCondition = "assertion.repository_owner_id == '$GitHubOwnerId' && assertion.repository_id == '$GitHubRepositoryId' && assertion.ref == 'refs/heads/main'"
gcloud iam workload-identity-pools providers create-oidc bakerrang `
  --project $ProjectId --location global --workload-identity-pool github `
  --issuer-uri "https://token.actions.githubusercontent.com" `
  --attribute-mapping $AttributeMapping --attribute-condition $AttributeCondition

gcloud iam service-accounts create bakerrang-github-deployer --project $ProjectId --display-name="BakerRang GitHub deployer"
```

Grant only resource-scoped deployment permissions:

```powershell
gcloud artifacts repositories add-iam-policy-binding $Repository `
  --project $ProjectId --location $Region `
  --member="serviceAccount:$DeployerSa" --role="roles/artifactregistry.writer"

@("bakerrang-api", "bakerrang-web-launcher", "bakerrang-web-storybook", "bakerrang-web-polyglot", "bakerrang-web-sign", "bakerrang-web-budget", "bakerrang-web-passwords", "bakerrang-web-account") | ForEach-Object {
  gcloud run services add-iam-policy-binding $_ --project $ProjectId --region $Region `
    --member="serviceAccount:$DeployerSa" --role="roles/run.developer"
}

@($ApiSa, $FrontendSa) | ForEach-Object {
  gcloud iam service-accounts add-iam-policy-binding $_ --project $ProjectId `
    --member="serviceAccount:$DeployerSa" --role="roles/iam.serviceAccountUser"
}

$RepoPrincipalSet = "principalSet://iam.googleapis.com/projects/$ProjectNumber/locations/global/workloadIdentityPools/github/attribute.repository_id/$GitHubRepositoryId"
gcloud iam service-accounts add-iam-policy-binding $DeployerSa --project $ProjectId `
  --member=$RepoPrincipalSet --role="roles/iam.workloadIdentityUser"
```

There are **no project-level deployer roles**. Grants are `artifactregistry.writer` on AR repository `bakerrang`; `run.developer` on exactly the API and web-app services (the retired Client/Portal/Renderer grants go away with those services); `serviceAccountUser` on `bakerrang-api@` and `bakerrang-frontend@`; and `workloadIdentityUser` for the repository-ID principal set. Provider trust additionally fixes owner ID `2282360`, repository ID `715929041`, and `refs/heads/main`.

## GitHub Environment

The Environment is `production`; there is no `production` branch. It contains only these non-secret variables:

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | `avian-cable-379805` |
| `GCP_PROJECT_NUMBER` | `307696703523` |
| `GCP_REGION` | `us-west1` |
| `WIF_PROVIDER` | `projects/307696703523/locations/global/workloadIdentityPools/github/providers/bakerrang` |
| `GCP_DEPLOYER_SA` | `bakerrang-github-deployer@avian-cable-379805.iam.gserviceaccount.com` |
| `AR_REPOSITORY` | `bakerrang` |
| `API_SERVICE` | `bakerrang-api` |
| `WEB_LAUNCHER_SERVICE` | `bakerrang-web-launcher` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.bakerrang.com` (API deployment smoke URL) |
| `LAUNCHER_BASE_URL` | `https://launch.bakerrang.com` |
| `VITE_API_BASE_URL` | `https://api.bakerrang.com` |

The logical CI/deployment key is `web-launcher`; the canonical physical Cloud Run
service is `bakerrang-web-launcher`. `WEB_LAUNCHER_SERVICE` carries that physical
name into the reusable deployment workflow, while classifier outputs, manual
deployment, concurrency, and rollback selectors retain the logical key.

There are no GitHub GCP credential secrets; authentication is short-lived OIDC/WIF.

The Launcher staging service, direct domain mapping, API `LAUNCHER_DOMAIN`, and
resource-scoped deployer grant are operator-controlled prerequisites documented
in the [Launcher Milestone 1 runbook](../apps/Launcher-Milestone1-Runbook.md).
They must not change the existing `bakerrang.com` apex mapping.

## Existing live API audit

Use read-only inspection before the controlled API cutover. These commands do not fetch secret payloads:

```powershell
gcloud run services describe bakerrang-api --project $ProjectId --region $Region --format yaml
gcloud run services describe bakerrang-api --project $ProjectId --region $Region --format="value(spec.template.spec.serviceAccountName)"
gcloud run services describe bakerrang-api --project $ProjectId --region $Region --format="value(spec.template.spec.containers[0].env[].name)"
gcloud projects get-iam-policy $ProjectId --format="table(bindings.role,bindings.members)"
gcloud secrets list --project $ProjectId
```

Do not read secret version data during an audit. Do not blindly replace existing `bakerrang-api` environment variables.

## Live-impact boundary

**SAFE/FOUNDATION when deliberately created and verified:** Artifact Registry, WIF, and service skeletons. They are still infrastructure changes requiring operator review.

**CURRENT LIVE PATH:** Cloud Run domain mappings, DNS/TLS, and selective automatic MAIN deployment are in place. Future changes to Cloud Run configuration, runtime identities, domain mappings, certificates, or public DNS remain live-impact operations requiring separate review. Normal CI changes only an affected service's image digest and verifies its runtime identity.

## Historical DEV deployment inventory

The following names were verified and captured before infrastructure deletion. They are retained for audit and reconstruction history only; their presence here does not mean the resources still exist and is not authorization to recreate them.

| Category | Historical DEV resources |
|---|---|
| Project | `bakerrang-dev` |
| Cloud Run | `bakerrang-api-dev`, `bakerrang-portal-dev`, `bakerrang-site-renderer-dev` |
| Load-balancer frontend | `bakerrang-web-dev-https-rule`, `bakerrang-web-dev-https-proxy`, `bakerrang-web-dev-map` |
| Backend services | `bakerrang-api-dev-backend`, `bakerrang-portal-dev-backend`, `bakerrang-renderer-dev-backend` |
| Serverless NEGs | `bakerrang-api-dev-neg`, `bakerrang-portal-dev-neg`, `bakerrang-renderer-dev-neg` |
| Static IPv4 | `bakerrang-web-dev-ip` → `8.232.231.135` |
| Certificate Manager | `bakerrang-dev-wildcard`, `bakerrang-web-dev-cert-map`, `bakerrang-dev-cert`, `bakerrang-dev-auth` |
| Workload Identity Federation | pool `github`, provider `bakerrang-dev` |
| Service accounts | `bakerrang-api-dev@bakerrang-dev.iam.gserviceaccount.com`, `bakerrang-frontend-dev@bakerrang-dev.iam.gserviceaccount.com`, `bakerrang-github-dev-deployer@bakerrang-dev.iam.gserviceaccount.com` |
| Artifact Registry | `bakerrang-dev`, `cloud-run-source-deploy` |
| Source staging bucket | `run-sources-bakerrang-dev-us-west1` |

The eight verified Secret Manager resource names were:

- `bakerrang-dev-blizzard-client-secret`
- `bakerrang-dev-chat-gpt-api-key`
- `bakerrang-dev-csrf-secret`
- `bakerrang-dev-deepgram-api-key`
- `bakerrang-dev-eleven-labs-api-key`
- `bakerrang-dev-google-oauth-client-secret`
- `bakerrang-dev-preview-token-secret`
- `bakerrang-dev-session-secret`

No secret values were read or recorded.

**DEV deployment infrastructure was retired in Step 2.5e. The `bakerrang-dev` project remains as local-development data backing only.** Retained state is Firestore `(default)`, `gs://bakerrang-dev-media-marketing`, and the developer IAM needed to access those resources through ADC. There is no repository or GitHub workflow path for deploying DEV.
