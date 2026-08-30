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

- MAIN/live: `avian-cable-379805` (`307696703523`), region `us-west1`. Cloud Run services are `bakerrang-api`, `bakerrang-client`, `bakerrang-portal`, and `bakerrang-site-renderer`.
- DEV: `bakerrang-dev`. Its current Cloud Run/LB/WIF stack remains intact during Step 2.5b. After later decommissioning it will retain only Firestore, `bakerrang-dev-media-marketing`, and minimal developer IAM.
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

## Global static IP

```powershell
gcloud compute addresses create bakerrang-web-ip --project $ProjectId --global --ip-version IPV4
gcloud compute addresses describe bakerrang-web-ip --project $ProjectId --global --format="value(address)"
```

The current address is `34.8.236.85`. Reserve it before the Portal build because `CUSTOM_DOMAIN_IPV4_ADDRESS` is baked into that artifact.

## MAIN global external Application Load Balancer

The MAIN load balancer is live on `34.8.236.85`. It uses four regional serverless NEGs and four global `EXTERNAL_MANAGED` backend services:

| Cloud Run service | Serverless NEG | Backend service |
|---|---|---|
| `bakerrang-api` | `bakerrang-api-neg` | `bakerrang-api-backend` |
| `bakerrang-client` | `bakerrang-client-neg` | `bakerrang-client-backend` |
| `bakerrang-portal` | `bakerrang-portal-neg` | `bakerrang-portal-backend` |
| `bakerrang-site-renderer` | `bakerrang-renderer-neg` | `bakerrang-renderer-backend` |

The URL map `bakerrang-web-urlmap` routes `bakerrang.com` and `www.bakerrang.com` to Client, `api.bakerrang.com` to API, `portal.bakerrang.com` to Portal, and `sites.bakerrang.com` to Renderer. Its default backend is Renderer, so unmatched hosts—including verified customer domains—reach the multi-tenant renderer without a per-tenant URL-map rule.

These are the reconstruction commands for the NEG, backend, and host-routing topology. They are not idempotent; describe existing resources before using them and do not run them as an update procedure.

```powershell
$P = "avian-cable-379805"
$R = "us-west1"

foreach ($m in @(
  @{neg="bakerrang-api-neg";      svc="bakerrang-api"},
  @{neg="bakerrang-client-neg";   svc="bakerrang-client"},
  @{neg="bakerrang-portal-neg";   svc="bakerrang-portal"},
  @{neg="bakerrang-renderer-neg"; svc="bakerrang-site-renderer"})) {
  gcloud compute network-endpoint-groups create $($m.neg) `
    --project=$P --region=$R --network-endpoint-type=serverless `
    --cloud-run-service=$($m.svc)
}

foreach ($m in @(
  @{be="bakerrang-api-backend";      neg="bakerrang-api-neg"},
  @{be="bakerrang-client-backend";   neg="bakerrang-client-neg"},
  @{be="bakerrang-portal-backend";   neg="bakerrang-portal-neg"},
  @{be="bakerrang-renderer-backend"; neg="bakerrang-renderer-neg"})) {
  gcloud compute backend-services create $($m.be) `
    --project=$P --global --load-balancing-scheme=EXTERNAL_MANAGED
  gcloud compute backend-services add-backend $($m.be) `
    --project=$P --global --network-endpoint-group=$($m.neg) `
    --network-endpoint-group-region=$R
}

gcloud compute url-maps create bakerrang-web-urlmap `
  --project=$P --global --default-service=bakerrang-renderer-backend
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=client-matcher --default-service=bakerrang-client-backend `
  --new-hosts="bakerrang.com,www.bakerrang.com"
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=api-matcher --default-service=bakerrang-api-backend `
  --new-hosts="api.bakerrang.com"
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=portal-matcher --default-service=bakerrang-portal-backend `
  --new-hosts="portal.bakerrang.com"
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=sites-matcher --default-service=bakerrang-renderer-backend `
  --new-hosts="sites.bakerrang.com"
```

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

Public DNS now points `portal.bakerrang.com`, `sites.bakerrang.com`, `custom.bakerrang.com` (the BakerRang-owned custom-domain test path), `api.bakerrang.com`, and apex `bakerrang.com` to `34.8.236.85`. The API's former Cloud Run domain-mapping CNAME and the former apex target were replaced during controlled DNS transactions. The apex has no AAAA record because this frontend is IPv4-only.

For reconstruction in a fresh zone, the desired A records are:

```powershell
foreach ($HostName in @(
  "portal.bakerrang.com.",
  "sites.bakerrang.com.",
  "custom.bakerrang.com.",
  "api.bakerrang.com.",
  "bakerrang.com.")) {
  gcloud dns record-sets create $HostName --zone=bakerrang-client --project=$P `
    --type=A --ttl=300 --rrdatas="34.8.236.85"
}
```

Against an existing zone, use a reviewed `gcloud dns record-sets transaction` that removes the exact current record and adds the desired A record atomically; do not issue the fresh-zone commands blindly. Direct Cloud Run domain mappings are no longer the product ingress architecture. Retire a legacy mapping only after the corresponding LB path, certificate, DNS propagation, and rollback window have all been verified.

Deployment smoke intentionally uses each Cloud Run service's `status.url`. Public hostname smoke is a separate ingress check for DNS, load balancer, certificate, and routing health.

## Media bucket

```powershell
$MediaBucket = "gs://bakerrang-media-marketing"
gcloud storage buckets create $MediaBucket --project $ProjectId --location $Region --uniform-bucket-level-access
gcloud storage buckets update $MediaBucket --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding $MediaBucket --member="allUsers" --role="roles/storage.objectViewer"
gcloud storage buckets add-iam-policy-binding $MediaBucket --member="serviceAccount:$ApiSa" --role="roles/storage.objectAdmin"
```

UBLA is required. Public `objectViewer` is intentional for published marketing media; never place private application data in this bucket. The API runtime identity has `storage.objectAdmin` on this bucket only.

## Frontend runtime service account

`bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com` is intended for Client, Portal, and Site Renderer and deliberately has essentially no project permissions.

```powershell
gcloud iam service-accounts create bakerrang-frontend --project $ProjectId --display-name="BakerRang frontend runtime"
```

Client, Portal, and Site Renderer now use `bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com`. The Client migration from the default Compute service account is complete. Normal CI does not pass `--service-account`; its runtime-SA-unchanged assertion protects this state.

## Preview token

The Secret Manager resource is `bakerrang-preview-token-secret`. Generate a value without printing it, write it without a newline, and delete the temporary file:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$previewToken = [Convert]::ToBase64String($bytes)

$tokenFile = [System.IO.Path]::GetTempFileName()
try {
  [System.IO.File]::WriteAllBytes($tokenFile, [System.Text.Encoding]::UTF8.GetBytes($previewToken))
  gcloud secrets create bakerrang-preview-token-secret --project $ProjectId --replication-policy automatic
  gcloud secrets versions add bakerrang-preview-token-secret --project $ProjectId --data-file $tokenFile
}
finally {
  Remove-Item -LiteralPath $tokenFile -Force
  $previewToken = $null
  $bytes = $null
}

gcloud secrets add-iam-policy-binding bakerrang-preview-token-secret `
  --project $ProjectId `
  --member="serviceAccount:$ApiSa" `
  --role="roles/secretmanager.secretAccessor"
```

Never expose the value in source, logs, shell history, or GitHub variables. If an accidental bad version is created, disable and destroy that specific version after confirming a correct active version exists.

## Cloud Run bootstrap

Portal and Renderer were bootstrapped as service skeletons so IAM could be scoped before production CI. Placeholder images are temporary and later replaced by digest-pinned CI images. A reconstruction pattern is:

```powershell
$BootstrapImage = "us-docker.pkg.dev/cloudrun/container/hello"
gcloud run deploy bakerrang-portal `
  --project $ProjectId --region $Region --image $BootstrapImage `
  --service-account $FrontendSa `
  --set-env-vars "PORTAL_BASE_URL=https://portal.bakerrang.com" --quiet

gcloud run deploy bakerrang-site-renderer `
  --project $ProjectId --region $Region --image $BootstrapImage `
  --service-account $FrontendSa `
  --set-env-vars "SITE_API_BASE_URL=https://api.bakerrang.com,SITE_PUBLIC_ORIGIN=https://sites.bakerrang.com,SITE_PUBLIC_INDEXING_ENABLED=true" --quiet
```

Confirm the placeholder image is still available. Do not run these against existing services without a reviewed plan: `gcloud run deploy` changes live state. Normal CI later updates only the image digest and asserts the runtime service account is unchanged.

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

@("bakerrang-api", "bakerrang-client", "bakerrang-portal", "bakerrang-site-renderer") | ForEach-Object {
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

There are **no project-level deployer roles**. Grants are `artifactregistry.writer` on AR repository `bakerrang`; `run.developer` on exactly the four services; `serviceAccountUser` on `bakerrang-api@` and `bakerrang-frontend@`; and `workloadIdentityUser` for the repository-ID principal set. Provider trust additionally fixes owner ID `2282360`, repository ID `715929041`, and `refs/heads/main`.

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
| `PORTAL_SERVICE` | `bakerrang-portal` |
| `RENDERER_SERVICE` | `bakerrang-site-renderer` |
| `CLIENT_SERVICE` | `bakerrang-client` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.bakerrang.com` |
| `NEXT_PUBLIC_SITE_PREVIEW_ORIGIN` | `https://sites.bakerrang.com` |
| `NEXT_PUBLIC_SITE_API_BASE_URL` | `https://api.bakerrang.com` |
| `CUSTOM_DOMAIN_IPV4_ADDRESS` | `34.8.236.85` |
| `PORTAL_BASE_URL` | `https://portal.bakerrang.com` |
| `CLIENT_BASE_URL` | `https://bakerrang.com` |

`CUSTOM_DOMAIN_CNAME_TARGET` is intentionally unset. There are no GitHub GCP credential secrets; authentication is short-lived OIDC/WIF.

## Existing live API audit

Use read-only inspection before the controlled API cutover. These commands do not fetch secret payloads:

```powershell
gcloud run services describe bakerrang-api --project $ProjectId --region $Region --format yaml
gcloud run services describe bakerrang-api --project $ProjectId --region $Region --format="value(spec.template.spec.serviceAccountName)"
gcloud run services describe bakerrang-api --project $ProjectId --region $Region --format="value(spec.template.spec.containers[0].env[].name)"
gcloud projects get-iam-policy $ProjectId --format="table(bindings.role,bindings.members)"
gcloud secrets list --project $ProjectId
gcloud secrets get-iam-policy bakerrang-preview-token-secret --project $ProjectId
```

Do not read secret version data during an audit. Do not blindly replace existing `bakerrang-api` environment variables. Preserve legacy configuration while adding platform-required configuration during a separately reviewed cutover.

## Live-impact boundary

**SAFE/FOUNDATION when deliberately created and verified:** Artifact Registry, bucket, WIF, service skeletons, and IP reservation. They are still infrastructure changes requiring operator review.

**CURRENT LIVE PATH:** the global load balancer, DNS/TLS cutover, Client runtime-SA migration, and selective automatic MAIN deployment are complete. Future changes to Cloud Run configuration, runtime identities, load-balancer resources, certificates, or public DNS remain live-impact operations requiring separate review. Normal CI changes only an affected service's image digest and verifies its runtime identity.

## DEV retention

Keep during the Step 2.5e decommission window: `bakerrang-dev`, Firestore, `bakerrang-dev-media-marketing`, retained DEV services, the `development` GitHub Environment, and minimal developer IAM. DEV deployment is manual-only; pushes to `main` no longer deploy DEV.

Remove only during a later approved decommission: DEV Cloud Run; DEV LB/IP; DEV WIF; DEV deployer/runtime deployment SAs; deployment AR; deployment secrets; DEV domains; and the `development` GitHub Environment/workflows. Inventory dependencies and preserve recoverable backups first.
