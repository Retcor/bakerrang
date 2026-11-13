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

- MAIN/live: `avian-cable-379805` (`307696703523`), region `us-west1`. The Cloud Run service set is `bakerrang-api` plus the consumer web apps `bakerrang-web-{launcher,storybook,polyglot,sign,budget,passwords,account}`. The web apps (other than the apex) use direct Cloud Run domain mappings (see each `docs/apps/*-Runbook.md`).
- **Retired 2026-11-12:** `bakerrang-client` (legacy SPA), `bakerrang-portal` and `bakerrang-site-renderer` (marketing-site platform). See [Retirement cutover](#retirement-cutover-2026-11) for the one-time manual teardown.
- Local data backing: `bakerrang-dev` retains only Firestore `(default)`, `bakerrang-dev-media-marketing`, and the developer IAM needed for ADC. Its former Cloud Run/LB/WIF deployment stack is historical inventory below.
- Live images use the `bakerrang` Artifact Registry repository. The global external Application Load Balancer uses static IPv4 `34.8.236.85` (`bakerrang-web-ip`).

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

## Global static IP

```powershell
gcloud compute addresses create bakerrang-web-ip --project $ProjectId --global --ip-version IPV4
gcloud compute addresses describe bakerrang-web-ip --project $ProjectId --global --format="value(address)"
```

The current address is `34.8.236.85`.

## MAIN global external Application Load Balancer

The MAIN load balancer is live on `34.8.236.85`. Target topology (after the 2026-11 retirement cutover) is two regional serverless NEGs and two global `EXTERNAL_MANAGED` backend services:

| Cloud Run service | Serverless NEG | Backend service |
|---|---|---|
| `bakerrang-api` | `bakerrang-api-neg` | `bakerrang-api-backend` |
| `bakerrang-web-launcher` | `bakerrang-launcher-neg` | `bakerrang-launcher-backend` |

The URL map `bakerrang-web-urlmap` routes `api.bakerrang.com` to API and `bakerrang.com` / `www.bakerrang.com` to the Launcher, whose nginx config (`web/nginx/apps/launcher.conf`) answers those two hosts with a 301 to `https://launch.bakerrang.com/` (old `/passwords`, `/budget`, … paths go to the matching subdomain). The default backend is the Launcher. `launch.bakerrang.com` itself keeps its direct Cloud Run domain mapping.

Reconstruction commands for the target topology. They are not idempotent; describe existing resources before using them and do not run them as an update procedure.

```powershell
$P = "avian-cable-379805"
$R = "us-west1"

foreach ($m in @(
  @{neg="bakerrang-api-neg";      svc="bakerrang-api"},
  @{neg="bakerrang-launcher-neg"; svc="bakerrang-web-launcher"})) {
  gcloud compute network-endpoint-groups create $($m.neg) `
    --project=$P --region=$R --network-endpoint-type=serverless `
    --cloud-run-service=$($m.svc)
}

foreach ($m in @(
  @{be="bakerrang-api-backend";      neg="bakerrang-api-neg"},
  @{be="bakerrang-launcher-backend"; neg="bakerrang-launcher-neg"})) {
  gcloud compute backend-services create $($m.be) `
    --project=$P --global --load-balancing-scheme=EXTERNAL_MANAGED
  gcloud compute backend-services add-backend $($m.be) `
    --project=$P --global --network-endpoint-group=$($m.neg) `
    --network-endpoint-group-region=$R
}

gcloud compute url-maps create bakerrang-web-urlmap `
  --project=$P --global --default-service=bakerrang-launcher-backend
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=apex-matcher --default-service=bakerrang-launcher-backend `
  --new-hosts="bakerrang.com,www.bakerrang.com"
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=api-matcher --default-service=bakerrang-api-backend `
  --new-hosts="api.bakerrang.com"
```

### Retirement cutover (2026-11)

Before the cutover the URL map sent the apex to `bakerrang-client-backend`, `portal.` to `bakerrang-portal-backend`, `sites.` to `bakerrang-renderer-backend`, and **unmatched hosts (customer domains) to the Renderer by default**. One-time, operator-run, live-impact order — deploy the Launcher image containing `launcher.conf` first:

```powershell
# 1. Launcher behind the LB.
gcloud compute network-endpoint-groups create bakerrang-launcher-neg --project=$P --region=$R `
  --network-endpoint-type=serverless --cloud-run-service=bakerrang-web-launcher
gcloud compute backend-services create bakerrang-launcher-backend --project=$P --global `
  --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute backend-services add-backend bakerrang-launcher-backend --project=$P --global `
  --network-endpoint-group=bakerrang-launcher-neg --network-endpoint-group-region=$R

# 2. Repoint the apex and the default away from the retired backends (edit, then import).
gcloud compute url-maps export bakerrang-web-urlmap --project=$P --global --destination=urlmap.yaml
#    In urlmap.yaml: defaultService and the client-matcher defaultService -> bakerrang-launcher-backend;
#    delete the portal-matcher and sites-matcher path matchers and their hostRules.
gcloud compute url-maps import bakerrang-web-urlmap --project=$P --global --source=urlmap.yaml
curl.exe -sI https://bakerrang.com/passwords   # expect 301 -> https://passwords.bakerrang.com/

# 3. Only then delete the retired backends, NEGs, and services.
foreach ($b in "client","portal","renderer") {
  gcloud compute backend-services delete "bakerrang-$b-backend" --project=$P --global
  gcloud compute network-endpoint-groups delete "bakerrang-$b-neg" --project=$P --region=$R
}
foreach ($svc in "bakerrang-client","bakerrang-portal","bakerrang-site-renderer") {
  gcloud run services delete $svc --project=$P --region=$R
}
```

Also retire: the media bucket `gs://bakerrang-media-marketing`, the Secret Manager secrets `bakerrang-preview-token-secret`, `bakerrang-resend-api-key`, `bakerrang-internal-drain-token` (and any Blizzard secret), the lead-notification Cloud Scheduler job, any customer-domain certificate-map entries, and the API env vars `PORTAL_DOMAIN`, `SITE_RENDERER_DOMAIN`, `CLIENT_DOMAIN`, `MEDIA_BUCKET_NAME`, `PREVIEW_TOKEN_SECRET`, `RESEND_API_KEY`, `LEAD_NOTIFICATION_FROM`, `INTERNAL_DRAIN_TOKEN`, `BLIZZARD_CLIENT_*` (remove with `--remove-env-vars` / `--remove-secrets`, never a replacing update). Optionally prune the deployed Firestore indexes with `firebase deploy --only firestore:indexes --force`.

### MAIN TLS and frontends

Certificate Manager uses one `PER_PROJECT_RECORD` DNS authorization, `bakerrang-main-auth`, for `bakerrang.com`. Its generated project-unique `_acme-challenge_<id>.bakerrang.com` CNAME coexists with DEV's fixed `_acme-challenge.bakerrang.com` record; never replace or hand-craft either authorization record.

The active managed certificate `bakerrang-web-cert` covers both `bakerrang.com` and `*.bakerrang.com`. Certificate map `bakerrang-web-cert-map` has explicit entries `bakerrang-apex-entry` and `bakerrang-wildcard-entry`. The HTTPS frontend is `bakerrang-web-https-proxy` plus global forwarding rule `bakerrang-web-https` on port 443. The HTTP frontend (`bakerrang-web-redirect`, `bakerrang-web-http-proxy`, and `bakerrang-web-http`) redirects port 80 requests to HTTPS.

```powershell
gcloud certificate-manager dns-authorizations create bakerrang-main-auth --project=$P `
  --domain="bakerrang.com" --type=PER_PROJECT_RECORD
gcloud certificate-manager dns-authorizations describe bakerrang-main-auth --project=$P `
  --format="value(dnsResourceRecord.name,dnsResourceRecord.type,dnsResourceRecord.data)"
# Add the exact printed CNAME to the authoritative zone before requesting the certificate.

gcloud certificate-manager certificates create bakerrang-web-cert --project=$P `
  --domains="bakerrang.com,*.bakerrang.com" --dns-authorizations="bakerrang-main-auth"
gcloud certificate-manager maps create bakerrang-web-cert-map --project=$P
gcloud certificate-manager maps entries create bakerrang-apex-entry --project=$P `
  --map=bakerrang-web-cert-map --certificates=bakerrang-web-cert --hostname="bakerrang.com"
gcloud certificate-manager maps entries create bakerrang-wildcard-entry --project=$P `
  --map=bakerrang-web-cert-map --certificates=bakerrang-web-cert --hostname="*.bakerrang.com"

gcloud compute target-https-proxies create bakerrang-web-https-proxy --project=$P `
  --url-map=bakerrang-web-urlmap --certificate-map=bakerrang-web-cert-map
gcloud compute forwarding-rules create bakerrang-web-https --project=$P --global `
  --load-balancing-scheme=EXTERNAL_MANAGED --network-tier=PREMIUM `
  --address=bakerrang-web-ip --target-https-proxy=bakerrang-web-https-proxy --ports=443
```

Use read-only descriptions to reconstruct the exact deployed HTTP redirect configuration rather than replacing it from memory:

```powershell
gcloud compute url-maps describe bakerrang-web-redirect --project=$P --global
gcloud compute target-http-proxies describe bakerrang-web-http-proxy --project=$P
gcloud compute forwarding-rules describe bakerrang-web-http --project=$P --global
```

### Public DNS cutover

Public DNS points `api.bakerrang.com` and apex `bakerrang.com` to `34.8.236.85`. (`portal.`, `sites.` and `custom.bakerrang.com` also pointed here until the 2026-11 retirement; delete those A records once their LB host rules are gone.) The API's former Cloud Run domain-mapping CNAME and the former apex target were replaced during controlled DNS transactions. The apex has no AAAA record because this frontend is IPv4-only.

For reconstruction in a fresh zone, the desired A records are:

```powershell
foreach ($HostName in @(
  "api.bakerrang.com.",
  "bakerrang.com.")) {
  gcloud dns record-sets create $HostName --zone=bakerrang-client --project=$P `
    --type=A --ttl=300 --rrdatas="34.8.236.85"
}
```

Against an existing zone, use a reviewed `gcloud dns record-sets transaction` that removes the exact current record and adds the desired A record atomically; do not issue the fresh-zone commands blindly. The apex and API use the LB; the consumer web subdomains use direct Cloud Run domain mappings.

Deployment smoke intentionally uses each Cloud Run service's `status.url`. Public hostname smoke is a separate ingress check for DNS, load balancer, certificate, and routing health.

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

**SAFE/FOUNDATION when deliberately created and verified:** Artifact Registry, WIF, service skeletons, and IP reservation. They are still infrastructure changes requiring operator review.

**CURRENT LIVE PATH:** the global load balancer, DNS/TLS, and selective automatic MAIN deployment are in place. Future changes to Cloud Run configuration, runtime identities, load-balancer resources, certificates, or public DNS remain live-impact operations requiring separate review. Normal CI changes only an affected service's image digest and verifies its runtime identity.

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
