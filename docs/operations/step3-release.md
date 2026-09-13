# Step 3 release operations runbook

Use this runbook to prepare and verify the MAIN API release for lead notifications, tenant export, and synchronous resumable tenant deletion. It is an operator procedure, not authorization to run against production without the required change approval. Do not put secret values in source, commits, tickets, terminal output, or logs.

This runbook changes operational resources only when an approved operator runs its commands. It does not change application code, workflows, or image deployments.

## Scope and variables

MAIN uses project `avian-cable-379805`, region `us-west1`, API service `bakerrang-api`, and API runtime service account `bakerrang-api@avian-cable-379805.iam.gserviceaccount.com`. The existing media bucket is `gs://bakerrang-media-marketing`.

```powershell
$ProjectId = "avian-cable-379805"
$Region = "us-west1"
$ApiService = "bakerrang-api"
$ApiSa = "bakerrang-api@$ProjectId.iam.gserviceaccount.com"
$MediaBucket = "gs://bakerrang-media-marketing"
$ResendSecret = "bakerrang-resend-api-key"
$DrainSecret = "bakerrang-internal-drain-token"
$SchedulerJob = "bakerrang-lead-notification-drain"
gcloud config set project $ProjectId
```

Confirm the required service APIs are enabled before provisioning operational resources:

```powershell
gcloud services enable run.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com firestore.googleapis.com --project $ProjectId
```

Before changing anything, inspect the current API service, service account, and runtime-variable names. These commands do not read secret payloads:

```powershell
gcloud run services describe $ApiService --project $ProjectId --region $Region --format yaml
gcloud run services describe $ApiService --project $ProjectId --region $Region --format="value(spec.template.spec.serviceAccountName)"
gcloud run services describe $ApiService --project $ProjectId --region $Region --format="value(spec.template.spec.containers[0].env[].name)"
gcloud storage buckets get-iam-policy $MediaBucket --project $ProjectId
gcloud projects get-iam-policy $ProjectId --flatten="bindings[].members" --filter="bindings.members:serviceAccount:$ApiSa" --format="table(bindings.role)"
```

Confirm the runtime service account is `$ApiSa`, it retains `roles/storage.objectAdmin` on `$MediaBucket`, and its existing `roles/datastore.user` Firestore grant covers document deletion for `recursiveDelete`. Do not reduce or replace those grants as part of Step 3.

## 1. Resend setup

In Resend, verify a sender identity and choose the exact sender address for `LEAD_NOTIFICATION_FROM`. Use a sender that Resend has verified for the production account. Do not use a personal mailbox or an unverified address.

`NODE_ENV=production` is mandatory: in production the API refuses to start without `RESEND_API_KEY`, `LEAD_NOTIFICATION_FROM`, and `INTERNAL_DRAIN_TOKEN`. Outside production, the sender is deliberately inert.

## 2. Create Secret Manager secrets

Create the secret containers once. If one already exists, inspect its IAM and add a new version through the approved secret-entry process instead of recreating it.

```powershell
gcloud secrets create $ResendSecret --project $ProjectId --replication-policy automatic
gcloud secrets create $DrainSecret --project $ProjectId --replication-policy automatic
```

Store the Resend key from an approved protected local file that contains only the key and is deleted immediately afterward. Never echo the key or pass it on a command line.

```powershell
$ResendKeyFile = "<approved protected file containing only the Resend key>"
gcloud secrets versions add $ResendSecret --project $ProjectId --data-file $ResendKeyFile
```

Generate `INTERNAL_DRAIN_TOKEN` cryptographically, write it to a temporary file without a newline, add it as the secret version, and then remove the temporary file. Keep the in-memory value only long enough to configure the Scheduler header in section 5.

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$InternalDrainToken = [Convert]::ToBase64String($bytes)
$DrainTokenFile = [System.IO.Path]::GetTempFileName()
try {
  [System.IO.File]::WriteAllBytes($DrainTokenFile, [System.Text.Encoding]::UTF8.GetBytes($InternalDrainToken))
  gcloud secrets versions add $DrainSecret --project $ProjectId --data-file $DrainTokenFile
}
finally {
  Remove-Item -LiteralPath $DrainTokenFile -Force
  $bytes = $null
}
```

Do not commit, log, print, or share `$InternalDrainToken`. Do not use a command that reads a Secret Manager version back to the terminal.

## 3. Grant Secret Manager access

Grant the API runtime service account access to the two new secret resources only:

```powershell
gcloud secrets add-iam-policy-binding $ResendSecret `
  --project $ProjectId --member="serviceAccount:$ApiSa" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding $DrainSecret `
  --project $ProjectId --member="serviceAccount:$ApiSa" --role="roles/secretmanager.secretAccessor"

gcloud secrets get-iam-policy $ResendSecret --project $ProjectId
gcloud secrets get-iam-policy $DrainSecret --project $ProjectId
```

## 4. Deploy and verify Firestore indexes

The repository-managed index file is [firestore.indexes.json](../../firestore.indexes.json). Deploy it using the existing Firebase configuration:

```powershell
firebase deploy --only firestore:indexes --project $ProjectId
gcloud firestore indexes composite list --project $ProjectId --database "(default)"
```

Require all of these composites to report `READY` before deployment verification:

| Collection group | Fields |
|---|---|
| `leadNotifications` | `status` ASC, `nextAttemptAt` ASC |
| `leadNotifications` | `status` ASC, `leaseUntil` ASC |
| `auditEvents` | `occurredAt` DESC, `eventId` DESC |

Index creation is asynchronous. Do not proceed merely because the deploy command accepted the definition; wait for `READY` in the list command or Firebase console.

## 5. Apply the additive API configuration and Scheduler job

For the existing API service, preserve every existing runtime value. Use the additive flags below; do not replace the full environment or secret configuration.

```powershell
$LeadNotificationFrom = "<verified Resend sender address>"

gcloud run services update $ApiService `
  --project $ProjectId --region $Region `
  --update-env-vars "NODE_ENV=production,LEAD_NOTIFICATION_FROM=$LeadNotificationFrom" `
  --update-secrets "RESEND_API_KEY=$ResendSecret:latest,INTERNAL_DRAIN_TOKEN=$DrainSecret:latest" `
  --timeout 300s --memory 512Mi
```

The notification drain is the current bearer-token implementation: the public API receives `POST /internal/lead-notifications/drain` and accepts only `Authorization: Bearer <exact INTERNAL_DRAIN_TOKEN>`. It is not OIDC-authenticated today. Create the one-minute Scheduler job while `$InternalDrainToken` is still held only in memory:

```powershell
$ApiUrl = gcloud run services describe $ApiService --project $ProjectId --region $Region --format="value(status.url)"

gcloud scheduler jobs create http $SchedulerJob `
  --project $ProjectId --location $Region `
  --schedule "*/1 * * * *" --time-zone "Etc/UTC" `
  --uri "$ApiUrl/internal/lead-notifications/drain" `
  --http-method POST `
  --headers "Authorization=Bearer $InternalDrainToken" `
  --message-body "{}"
```

If the job already exists, use the equivalent `gcloud scheduler jobs update http` command with the same schedule, URI, method, body, and Authorization header after reviewing the existing job. Do not put the token in a ticket, shell transcript, or repository file. Scheduler does not need Cloud Run invocation IAM for this current public-service/bearer-token design.

```powershell
gcloud scheduler jobs update http $SchedulerJob `
  --project $ProjectId --location $Region `
  --schedule "*/1 * * * *" --time-zone "Etc/UTC" `
  --uri "$ApiUrl/internal/lead-notifications/drain" `
  --http-method POST `
  --headers "Authorization=Bearer $InternalDrainToken" `
  --message-body "{}"
```

After exactly one of the create or update commands succeeds, clear the in-memory value:

```powershell
$InternalDrainToken = $null
```

OIDC is a **future hardening option**, not a replacement for the bearer token today. Because the API Cloud Run service is public, OIDC becomes meaningful only after the application adds server-side OIDC-token verification (audience, issuer, and identity); merely configuring Scheduler OIDC would not protect the current route.

## 6. Verify Cloud Run resources and merge/deploy

The API target is a 300-second timeout and at least 512 MiB memory. Verify the resulting revision before merging the image release:

```powershell
gcloud run services describe $ApiService --project $ProjectId --region $Region `
  --format="yaml(spec.template.spec.timeoutSeconds,spec.template.spec.containers[0].resources.limits,spec.template.spec.containers[0].env)"
gcloud scheduler jobs describe $SchedulerJob --project $ProjectId --location $Region
```

After the operational prerequisites are ready, merge the reviewed application change to `main`. Normal MAIN CI/CD deployment is image-only: it does not create or update the environment variables, secrets, indexes, Scheduler job, timeout, or memory. Follow [CI/CD operations](../CI-CD.md) for the image deployment and its service-URL smoke check.

## 7. Live verification

Use a production account with the appropriate application access. Verify the API health endpoint and Scheduler job configuration without reading secret payloads:

```powershell
Invoke-WebRequest "https://api.bakerrang.com/health" | Select-Object StatusCode, Content
gcloud scheduler jobs describe $SchedulerJob --project $ProjectId --location $Region
gcloud run services logs read $ApiService --project $ProjectId --region $Region --limit 50
```

Use **a test tenant only** for destructive lifecycle verification. Confirm all of the following in production:

- an export downloads as a streamed ZIP and includes the expected test-tenant data without requiring a background job;
- a deletion may complete synchronously, or a failed deletion can be resumed through the Portal without restarting it;
- after deletion, the test tenant and its Firestore subtree are absent, confirming the `recursiveDelete` path;
- `gcloud storage ls "$MediaBucket/tenants/<test-tenant-id>/media/"` returns no objects after the test tenant is deleted, confirming the tenant-scoped GCS prefix delete;
- the Scheduler drain returns a successful response for an authorized invocation and an unauthorized request is rejected.

Do not use a customer tenant for this verification. Keep a record of the test tenant ID and operator approval, but never record secrets.

## 8. Rollback considerations

First determine whether the incident is image behavior, runtime configuration, or a mail-delivery concern. The normal image rollback is documented in [the MAIN rollback runbook](rollback.md) and preserves the current configuration.

- Do not remove the new secrets or plain environment variable while the Step 3 image is serving; production startup requires them.
- If mail delivery must stop immediately, pause the Scheduler job, investigate, and retain the outbox for recovery: `gcloud scheduler jobs pause $SchedulerJob --project $ProjectId --location $Region`.
- If reverting runtime configuration after an image rollback, make an approved additive, narrowly scoped Cloud Run update and verify the old image's required configuration first.
- Do not roll back Firestore indexes, media-bucket IAM, or the existing Firestore role as an incident shortcut. They support safe reads/deletes and are not image-deployment state.

The runbook is complete when the three indexes are `READY`, the API revision reports the timeout/memory target and required configuration names, Scheduler is configured with the bearer header, and test-tenant verification has been recorded.
