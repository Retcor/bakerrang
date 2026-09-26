# Polyglot Phase D — Operator Deployment Runbook

This is the operator-oriented deployment sequence for the extracted Polyglot application.

Production targets:

* Logical service: `web-polyglot`
* Cloud Run service: `bakerrang-web-polyglot`
* Public hostname: `https://polyglot.bakerrang.com`
* API service: `bakerrang-api`
* GCP project: `avian-cable-379805`
* Region: `us-west1`
* Frontend runtime service account:
  `bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com`

Until final cutover:

* `polyglot.liveUrl` remains `null`
* Launcher sends Polyglot users to:
  `https://bakerrang.com/polyglot/instant`
* legacy `/polyglot` and `/polyglot/instant` remain available
* apex `bakerrang.com` remains unchanged

---

## STEP 0 — Open PowerShell in the BakerRang repository

Run the following once to define the values used throughout this runbook.

```powershell
$ProjectId = "avian-cable-379805"
$Region = "us-west1"

$ApiService = "bakerrang-api"
$PolyglotService = "bakerrang-web-polyglot"
$StorybookService = "bakerrang-web-storybook"

$PolyglotHost = "polyglot.bakerrang.com"
$PolyglotBaseUrl = "https://polyglot.bakerrang.com"

$FrontendRuntimeSa = "bakerrang-frontend@$ProjectId.iam.gserviceaccount.com"

$GitHubRepo = "Retcor/bakerrang"
$GitHubEnvironment = "production"
```

Confirm your active gcloud project:

```powershell
gcloud config get-value project
```

If it is not:

```text
avian-cable-379805
```

set it:

```powershell
gcloud config set project $ProjectId
```

Confirm authentication:

```powershell
gcloud auth list
```

---

# STEP 1 — Set GitHub production variables

Polyglot's deployment workflow expects these production Environment variables:

```powershell
gh variable set WEB_POLYGLOT_SERVICE `
  --env $GitHubEnvironment `
  --repo $GitHubRepo `
  --body $PolyglotService
```

```powershell
gh variable set POLYGLOT_BASE_URL `
  --env $GitHubEnvironment `
  --repo $GitHubRepo `
  --body $PolyglotBaseUrl
```

Verify them:

```powershell
gh variable get WEB_POLYGLOT_SERVICE `
  --env $GitHubEnvironment `
  --repo $GitHubRepo
```

```powershell
gh variable get POLYGLOT_BASE_URL `
  --env $GitHubEnvironment `
  --repo $GitHubRepo
```

Expected:

```text
bakerrang-web-polyglot
https://polyglot.bakerrang.com
```

---

# STEP 2 — Add POLYGLOT_DOMAIN to the API runtime

This adds the new Polyglot origin without replacing the API's other environment variables.

Run:

```powershell
gcloud run services update $ApiService `
  --project $ProjectId `
  --region $Region `
  --update-env-vars "POLYGLOT_DOMAIN=$PolyglotBaseUrl"
```

This creates a new API revision. That is expected.

Verify it:

```powershell
gcloud run services describe $ApiService `
  --project $ProjectId `
  --region $Region `
  --format="yaml(spec.template.spec.containers[0].env)"
```

Look for:

```text
POLYGLOT_DOMAIN
https://polyglot.bakerrang.com
```

Do not remove or replace the existing environment variables.

---

# STEP 3 — Bootstrap the Polyglot Cloud Run service

The normal GitHub deployment workflow expects the Cloud Run service to already exist.

For the one-time bootstrap, reuse the currently deployed Story Book image. This is only a placeholder until GitHub deploys the real Polyglot image.

First retrieve Story Book's current image:

```powershell
$BootstrapImage = gcloud run services describe $StorybookService `
  --project $ProjectId `
  --region $Region `
  --format="value(spec.template.spec.containers[0].image)"
```

Display it:

```powershell
$BootstrapImage
```

It should be a Google Artifact Registry image.

Now create the Polyglot service:

```powershell
gcloud run deploy $PolyglotService `
  --project $ProjectId `
  --region $Region `
  --image $BootstrapImage `
  --service-account $FrontendRuntimeSa `
  --port 8080 `
  --allow-unauthenticated `
  --quiet
```

This is the **one-time bootstrap only**.

Normal deployments after this should happen through GitHub Actions.

Verify the service exists:

```powershell
gcloud run services describe $PolyglotService `
  --project $ProjectId `
  --region $Region `
  --format="table(metadata.name,status.url,spec.template.spec.serviceAccountName)"
```

Expected runtime service account:

```text
bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com
```

---

# STEP 4 — Grant the existing GitHub deployer access to Polyglot

Cloud Run deployment requires the deployer to have `roles/run.developer` on the Cloud Run resource. We do NOT want to grant project-wide Cloud Run Admin.

Rather than guessing the WIF principal, copy the existing scoped deployer binding from Story Book.

Read Story Book's IAM policy:

```powershell
$StorybookIam = gcloud run services get-iam-policy $StorybookService `
  --project $ProjectId `
  --region $Region `
  --format=json | ConvertFrom-Json
```

Extract the existing Cloud Run Developer member(s):

```powershell
$DeployerMembers = @(
  $StorybookIam.bindings |
    Where-Object { $_.role -eq "roles/run.developer" } |
    ForEach-Object { $_.members }
)
```

Display them:

```powershell
$DeployerMembers
```

You should see the existing GitHub/WIF deployer principal used for Story Book.

Now apply the same scoped binding to Polyglot:

```powershell
foreach ($Member in $DeployerMembers) {
  gcloud run services add-iam-policy-binding $PolyglotService `
    --project $ProjectId `
    --region $Region `
    --member $Member `
    --role "roles/run.developer"
}
```

Verify:

```powershell
gcloud run services get-iam-policy $PolyglotService `
  --project $ProjectId `
  --region $Region
```

## Runtime service-account permission

Polyglot uses the same frontend runtime service account as Launcher and Story Book.

Because the GitHub deployer already deploys those services using this same identity, its `roles/iam.serviceAccountUser` grant should already exist.

Verify:

```powershell
gcloud iam service-accounts get-iam-policy $FrontendRuntimeSa `
  --project $ProjectId
```

Do not add a new project-wide IAM role.

---

# STEP 5 — Add the legacy sensitive-URL Cloud Logging exclusion

The extracted apps now use private POST/token flows, but the legacy apex clients remain alive during migration.

Those legacy clients can put user content in request URLs.

The sensitive legacy route families are:

```text
GET /chat/gpt/translate
GET /text/to/speech/v1/convert/*
GET /chat/gpt/prompt/story
GET /chat/gpt/image/prompt
```

We want to exclude Cloud Run **request logs only for those legacy GET routes**.

This does NOT affect the new POST endpoints.

Before adding the exclusion, test whether the filter matches recent logs:

```powershell
gcloud logging read '
resource.type="cloud_run_revision"
AND resource.labels.service_name="bakerrang-api"
AND httpRequest.requestMethod="GET"
AND (
  httpRequest.requestUrl:"/chat/gpt/translate"
  OR httpRequest.requestUrl:"/text/to/speech/v1/convert/"
  OR httpRequest.requestUrl:"/chat/gpt/prompt/story"
  OR httpRequest.requestUrl:"/chat/gpt/image/prompt"
)
' `
  --project $ProjectId `
  --limit 10 `
  --format="table(timestamp,httpRequest.requestMethod,httpRequest.status)"
```

This intentionally does NOT print the request URL or its sensitive values.

If you get matching entries, the filter is finding the intended legacy traffic.

Now add the exclusion:

```powershell
gcloud logging sinks update _Default `
  --project $ProjectId `
  --add-exclusion 'name=legacy-sensitive-api-urls,description=Exclude legacy API GET request logs containing user content in URLs,filter=resource.type="cloud_run_revision" AND resource.labels.service_name="bakerrang-api" AND httpRequest.requestMethod="GET" AND (httpRequest.requestUrl:"/chat/gpt/translate" OR httpRequest.requestUrl:"/text/to/speech/v1/convert/" OR httpRequest.requestUrl:"/chat/gpt/prompt/story" OR httpRequest.requestUrl:"/chat/gpt/image/prompt")'
```

Verify the `_Default` sink:

```powershell
gcloud logging sinks describe _Default `
  --project $ProjectId `
  --format=json
```

Look for:

```text
legacy-sensitive-api-urls
```

Important:

This only affects FUTURE logs.

It does not delete historical logs.

---

# STEP 6 — Commit / push Phase D and let normal CI/CD deploy

At this point the infrastructure prerequisites should exist:

* GitHub production variables
* API `POLYGLOT_DOMAIN`
* `bakerrang-web-polyglot` service
* scoped deployer IAM
* legacy sensitive-log exclusion

Now commit and push/merge Phase D using the normal BakerRang workflow.

Do NOT manually deploy the Polyglot application from your workstation.

Watch the normal workflow:

```powershell
gh run list `
  --repo $GitHubRepo `
  --workflow deploy.yml `
  --limit 10
```

You can also open GitHub Actions:

```powershell
gh run list `
  --repo $GitHubRepo `
  --limit 10
```

Wait for the API and `web-polyglot` deployment jobs to succeed.

---

# STEP 7 — Verify the deployed Cloud Run service BEFORE domain mapping

Get Polyglot's direct Cloud Run URL:

```powershell
$PolyglotRunUrl = gcloud run services describe $PolyglotService `
  --project $ProjectId `
  --region $Region `
  --format="value(status.url)"
```

Display it:

```powershell
$PolyglotRunUrl
```

Open it:

```powershell
Start-Process $PolyglotRunUrl
```

Verify that it is now the **actual Polyglot app**, not the temporary Story Book bootstrap image.

Also verify the runtime service account did not change:

```powershell
gcloud run services describe $PolyglotService `
  --project $ProjectId `
  --region $Region `
  --format="table(metadata.name,status.latestReadyRevisionName,spec.template.spec.serviceAccountName,status.url)"
```

Expected service account:

```text
bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com
```

Do not continue to domain mapping until the direct `run.app` URL is serving Polyglot correctly.

---

# STEP 8 — Create the custom domain mapping

Now map:

```text
polyglot.bakerrang.com
```

to:

```text
bakerrang-web-polyglot
```

Use the beta command form that works with this project's region:

```powershell
gcloud beta run domain-mappings create `
  --service $PolyglotService `
  --domain $PolyglotHost `
  --region $Region `
  --project $ProjectId
```

Do NOT use `--force-override`.

If the domain is already unexpectedly mapped somewhere else, stop and inspect it rather than overwriting it.

---

# STEP 9 — Display the DNS records

Run:

```powershell
gcloud beta run domain-mappings describe `
  --domain $PolyglotHost `
  --region $Region `
  --project $ProjectId
```

For a cleaner DNS-focused view:

```powershell
gcloud beta run domain-mappings describe `
  --domain $PolyglotHost `
  --region $Region `
  --project $ProjectId `
  --format="yaml(status.resourceRecords)"
```

Add ONLY those returned records to DNS for:

```text
polyglot.bakerrang.com
```

Do not modify:

* `bakerrang.com`
* `launch.bakerrang.com`
* `storybook.bakerrang.com`
* `api.bakerrang.com`
* `portal.bakerrang.com`
* `sites.bakerrang.com`

DNS configuration is the one part of this sequence that depends on your DNS provider, so enter the returned values there manually.

---

# STEP 10 — Check domain-mapping status

After DNS is configured, rerun:

```powershell
gcloud beta run domain-mappings describe `
  --domain $PolyglotHost `
  --region $Region `
  --project $ProjectId
```

Then test HTTPS:

```powershell
Invoke-WebRequest `
  -Uri "https://polyglot.bakerrang.com" `
  -Method Head
```

Or simply open it:

```powershell
Start-Process "https://polyglot.bakerrang.com"
```

The certificate might not become ready immediately after DNS is first added.

Do not cut over Launcher navigation until the custom hostname works over HTTPS.

---

# STEP 11 — Phase D live acceptance

With:

```text
https://polyglot.bakerrang.com
```

working directly, test the new app while Launcher STILL routes users to legacy Instant.

At minimum verify:

### Authentication

* existing BakerRang session recognized
* Google OAuth returns to Polyglot
* logout/session behavior works

### Languages

* first-use default is English → Spanish
* language picker works
* swap works
* same-language pair is prevented
* language preference survives reload

### Voice input

* Talk starts microphone
* Stop releases microphone
* 60-second cap auto-stops
* microphone is released after completion
* microphone-denied state works

### Translation

* heard text appears
* translation appears
* same sentence can be translated twice
* translation failure exits loading state
* retry uses transcript rather than retained audio

### Voice

With a cloned voice:

* translated result plays automatically
* Replay works
* selected voice works

Without a cloned voice:

* translation remains useful
* final stage says `Shown`
* no TTS request is made
* Account link is available

### Exchange Log

* turns accumulate
* Copy works
* old-turn actions work on mobile
* Clear works
* reload clears conversation
* conversation is not restored from browser storage
* > 50 turns drops oldest entries correctly if practical to test

### Race/cancel behavior

* Cancel works
* starting a new turn doesn't get overwritten by an old response
* leaving the page stops recording/audio/network state cleanly

### Privacy

Browser/network inspection should show:

* translation text sent in POST body
* spoken text not present in playback URL
* Story Book's extracted client also uses the new private request/token flows
* no sensitive transcript or translation in new request URLs

### Themes / PWA / responsive UI

* light
* dark
* system
* desktop
* phone
* manifest
* service worker
* Polyglot app identity

Do NOT flip the registry yet if any release-blocking issue remains.

---

# STEP 12 — Rotate the ElevenLabs API key

Phase D fixed a pre-existing path where raw ElevenLabs provider errors could potentially expose provider information, including the API key.

After the safe backend code is deployed, rotate the ElevenLabs API key.

Do this in this order:

1. Create/rotate the key in ElevenLabs.
2. Update the existing BakerRang secret/configuration containing the ElevenLabs key.
3. Allow the API service to receive the updated secret according to the existing Secret Manager/runtime pattern.
4. Verify speech synthesis works.
5. Revoke the old ElevenLabs key.

Do NOT place the key directly in PowerShell history, Git, or the runbook.

The exact Secret Manager secret name is intentionally not guessed here. Use the same existing secret/configuration path already used by `bakerrang-api`.

---

# STEP 13 — Final registry cutover

Only after direct live acceptance passes should Polyglot move from:

```text
https://bakerrang.com/polyglot/instant
```

to:

```text
https://polyglot.bakerrang.com
```

The shared registry is in:

```text
web/packages/web-app-shell/src/index.jsx
```

The intended final Polyglot entry becomes conceptually:

```javascript
{
  id: 'polyglot',
  // ...
  legacyPath: '/polyglot/instant',
  liveUrl: 'https://polyglot.bakerrang.com'
}
```

Keep the legacy path.

Do NOT delete legacy `/polyglot` or `/polyglot/instant`.

Update the corresponding destination-registry test so:

* Polyglot resolves to `https://polyglot.bakerrang.com`
* Story Book remains `https://storybook.bakerrang.com`
* unmigrated products remain on the apex legacy routes
* generic `liveUrl: null` fallback behavior remains covered separately

Commit/push this as a small cutover change.

The shared-package classifier should fan it out to:

* Launcher
* Story Book
* Polyglot

---

# STEP 14 — Post-cutover smoke

After the cutover deployment:

Open:

```powershell
Start-Process "https://launch.bakerrang.com"
```

Verify the Polyglot tile navigates directly to:

```text
https://polyglot.bakerrang.com
```

Then verify:

```powershell
Start-Process "https://polyglot.bakerrang.com"
```

Check:

* authenticated session recognized
* one translation succeeds
* voice playback succeeds
* app switcher destinations are correct
* Story Book still works
* legacy Instant still loads directly

Legacy check:

```powershell
Start-Process "https://bakerrang.com/polyglot/instant"
```

It should still load.

Apex remains unchanged.

---

# STEP 15 — Rollback reference

If Polyglot itself needs rollback:

GitHub Actions → `Rollback MAIN`

Use:

```text
service = web-polyglot
```

and select the previously approved immutable SHA/revision.

Do not roll back a healthy service merely as a test.

If only the product-navigation cutover needs to be undone, revert the registry change:

```text
polyglot.liveUrl → null
```

That sends product navigation back to:

```text
https://bakerrang.com/polyglot/instant
```

without changing the Polyglot Cloud Run deployment or apex.

---

# FINAL EXPECTED STATE

After successful acceptance and cutover:

```text
Launcher:
https://launch.bakerrang.com

Story Book:
https://storybook.bakerrang.com

Polyglot:
https://polyglot.bakerrang.com

Legacy Polyglot:
https://bakerrang.com/polyglot

Legacy Polyglot Instant:
https://bakerrang.com/polyglot/instant

API:
https://api.bakerrang.com

Apex:
https://bakerrang.com
```

Apex remains legacy.

Story Book remains independently deployed.

Polyglot is independently deployed.

The next product extraction does not begin until Phase D is accepted.
