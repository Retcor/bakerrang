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
- Live images use the `bakerrang` Artifact Registry repository. The reserved future load-balancer IPv4 is `34.8.236.85`.

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

The live Client currently uses the default Compute service account. Moving it is a later controlled live operation, not Step 2.5b.

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

**LIVE IMPACT:** updating the API configuration/image; updating Client; swapping the Client runtime SA; API or apex DNS changes; and enabling automatic live deployment. Step 2.5b does none of these.

## DEV retention

Keep: `bakerrang-dev`, Firestore, `bakerrang-dev-media-marketing`, and minimal developer IAM.

Remove only during a later approved decommission: DEV Cloud Run; DEV LB/IP; DEV WIF; DEV deployer/runtime deployment SAs; deployment AR; deployment secrets; DEV domains; and the `development` GitHub Environment/workflows. Inventory dependencies and preserve recoverable backups first.
