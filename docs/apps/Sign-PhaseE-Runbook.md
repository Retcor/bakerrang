# Sign — Phase E Operator Deployment Runbook

This runbook provisions, deploys, accepts, and cuts over the extracted BakerRang Sign application.

Production targets:

- Logical service: `web-sign`
- Cloud Run service: `bakerrang-web-sign`
- Public hostname: `https://sign.bakerrang.com`
- API service: `bakerrang-api`
- GCP project: `avian-cable-379805`
- Region: `us-west1`
- Frontend runtime service account:
  `bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com`

Until final cutover:

- `sign.liveUrl` remains `null`
- Launcher continues sending Sign users to:
  `https://bakerrang.com/sign-language`
- legacy `/sign-language` remains available
- apex `bakerrang.com` remains unchanged

---

# STEP 0 — Open PowerShell in the BakerRang repository

From the repository root, define the values used throughout this runbook:

```powershell
$ProjectId = "avian-cable-379805"
$Region = "us-west1"

$ApiService = "bakerrang-api"

$SignService = "bakerrang-web-sign"
$SignHost = "sign.bakerrang.com"
$SignBaseUrl = "https://sign.bakerrang.com"

$FrontendRuntimeSa = "bakerrang-frontend@$ProjectId.iam.gserviceaccount.com"

$GitHubEnvironment = "production"
$GitHubRepo = gh repo view --json nameWithOwner -q ".nameWithOwner"
```

Show the detected GitHub repository:

```powershell
$GitHubRepo
```

Confirm the active GCP project:

```powershell
gcloud config get-value project
```

Expected:

```text
avian-cable-379805
```

If needed:

```powershell
gcloud config set project $ProjectId
```

Confirm authentication:

```powershell
gcloud auth list
```

---

# STEP 1 — Set GitHub production Environment variables

The Sign deploy workflow needs:

```text
WEB_SIGN_SERVICE=bakerrang-web-sign
SIGN_BASE_URL=https://sign.bakerrang.com
```

Set them:

```powershell
gh variable set WEB_SIGN_SERVICE `
  --env $GitHubEnvironment `
  --repo $GitHubRepo `
  --body $SignService
```

```powershell
gh variable set SIGN_BASE_URL `
  --env $GitHubEnvironment `
  --repo $GitHubRepo `
  --body $SignBaseUrl
```

Verify:

```powershell
gh variable get WEB_SIGN_SERVICE `
  --env $GitHubEnvironment `
  --repo $GitHubRepo
```

```powershell
gh variable get SIGN_BASE_URL `
  --env $GitHubEnvironment `
  --repo $GitHubRepo
```

Expected:

```text
bakerrang-web-sign
https://sign.bakerrang.com
```

---

# STEP 2 — Add SIGN_DOMAIN to the API runtime

Add Sign's origin without replacing the API's existing environment variables:

```powershell
gcloud run services update $ApiService `
  --project $ProjectId `
  --region $Region `
  --update-env-vars "SIGN_DOMAIN=$SignBaseUrl"
```

This creates a new API revision. That is expected.

Verify:

```powershell
gcloud run services describe $ApiService `
  --project $ProjectId `
  --region $Region `
  --format="yaml(spec.template.spec.containers[0].env)"
```

Look for:

```text
SIGN_DOMAIN
https://sign.bakerrang.com
```

Do not remove existing API environment variables.

---

# STEP 3 — Bootstrap the Sign Cloud Run service

The normal GitHub deployment expects the Cloud Run service to already exist.

Use an already-deployed BakerRang frontend image only as a temporary bootstrap image.

Polyglot is a convenient source because it uses the same frontend runtime pattern.

Define it:

```powershell
$BootstrapSourceService = "bakerrang-web-polyglot"
```

Get the currently deployed image:

```powershell
$BootstrapImage = gcloud run services describe $BootstrapSourceService `
  --project $ProjectId `
  --region $Region `
  --format="value(spec.template.spec.containers[0].image)"
```

Display it:

```powershell
$BootstrapImage
```

It should point to the existing Artifact Registry image.

Create the Sign service:

```powershell
gcloud run deploy $SignService `
  --project $ProjectId `
  --region $Region `
  --image $BootstrapImage `
  --service-account $FrontendRuntimeSa `
  --port 8080 `
  --allow-unauthenticated `
  --quiet
```

This is a **one-time service bootstrap only**.

Normal Sign deployments after this should occur through GitHub Actions.

Verify:

```powershell
gcloud run services describe $SignService `
  --project $ProjectId `
  --region $Region `
  --format="table(metadata.name,status.url,spec.template.spec.serviceAccountName)"
```

Expected runtime service account:

```text
bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com
```

---

# STEP 4 — Give the existing GitHub deployer scoped access to Sign

Do not guess the WIF principal and do not grant project-wide Cloud Run Admin.

Copy the existing `roles/run.developer` member from a working extracted frontend service.

Use Polyglot:

```powershell
$ExistingFrontendIam = gcloud run services get-iam-policy $BootstrapSourceService `
  --project $ProjectId `
  --region $Region `
  --format=json | ConvertFrom-Json
```

Extract the existing deployer member(s):

```powershell
$DeployerMembers = @(
  $ExistingFrontendIam.bindings |
    Where-Object { $_.role -eq "roles/run.developer" } |
    ForEach-Object { $_.members }
)
```

Display them:

```powershell
$DeployerMembers
```

You should see the existing GitHub/WIF principal used for frontend deployment.

Apply the same scoped permission to Sign:

```powershell
foreach ($Member in $DeployerMembers) {
  gcloud run services add-iam-policy-binding $SignService `
    --project $ProjectId `
    --region $Region `
    --member $Member `
    --role "roles/run.developer"
}
```

Verify:

```powershell
gcloud run services get-iam-policy $SignService `
  --project $ProjectId `
  --region $Region
```

---

# STEP 5 — Verify service-account-user permission

The frontend deployer should already be able to deploy services using:

```text
bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com
```

because Launcher, Story Book and Polyglot already use it.

Verify:

```powershell
gcloud iam service-accounts get-iam-policy $FrontendRuntimeSa `
  --project $ProjectId
```

Do not add a broad new project-level role unless the existing deploy workflow actually fails due to a missing permission.

---

# STEP 6 — Commit / push Phase E and let normal CI/CD deploy

At this point the prerequisites should exist:

- GitHub Sign variables
- API `SIGN_DOMAIN`
- `bakerrang-web-sign`
- scoped WIF deployer access

Commit and push/merge Phase E through the normal BakerRang workflow.

Do NOT manually deploy the real Sign image from your workstation.

Watch GitHub Actions:

```powershell
gh run list `
  --repo $GitHubRepo `
  --limit 10
```

Wait for the API and `web-sign` jobs to finish successfully.

---

# STEP 7 — Get the direct Cloud Run URL

After CI deploys Sign, retrieve the service URL:

```powershell
$SignRunUrl = gcloud run services describe $SignService `
  --project $ProjectId `
  --region $Region `
  --format="value(status.url)"
```

Display it:

```powershell
$SignRunUrl
```

Open it:

```powershell
Start-Process $SignRunUrl
```

Confirm it is now the actual Sign application and not the temporary Polyglot bootstrap image.

Verify runtime identity:

```powershell
gcloud run services describe $SignService `
  --project $ProjectId `
  --region $Region `
  --format="table(metadata.name,status.latestReadyRevisionName,spec.template.spec.serviceAccountName,status.url)"
```

Expected service account:

```text
bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com
```

---

# STEP 8 — Verify Sign's self-hosted vision assets

The Sign build self-hosts the MediaPipe runtime and hand-landmarker model.

## Model

Check:

```powershell
Invoke-WebRequest `
  -Uri "$SignRunUrl/vendor/hand_landmarker-f16-v1.task" `
  -Method Head
```

Expected:

```text
200
```

The headers should include immutable caching.

For a concise view:

```powershell
$response = Invoke-WebRequest `
  -Uri "$SignRunUrl/vendor/hand_landmarker-f16-v1.task" `
  -Method Head

$response.StatusCode
$response.Headers["Content-Type"]
$response.Headers["Cache-Control"]
```

Expected status:

```text
200
```

and a long-lived immutable cache policy.

---

## MediaPipe WASM

Check:

```powershell
$response = Invoke-WebRequest `
  -Uri "$SignRunUrl/vendor/tasks-vision-0.10.34/vision_wasm_internal.wasm" `
  -Method Head

$response.StatusCode
$response.Headers["Content-Type"]
$response.Headers["Cache-Control"]
```

Expected:

```text
200
```

The content type should be appropriate for WASM, normally:

```text
application/wasm
```

---

## Missing vendor asset MUST be a real 404

Run:

```powershell
try {
  Invoke-WebRequest `
    -Uri "$SignRunUrl/vendor/does-not-exist.task" `
    -Method Get `
    -ErrorAction Stop
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected:

```text
404
```

This must NOT return the Sign SPA's `index.html`.

Do not continue if `/vendor/missing-file` falls through to the application shell.

---

# STEP 9 — Create the custom domain mapping

Once the direct Cloud Run deployment is correct, create the mapping:

```powershell
gcloud beta run domain-mappings create `
  --service $SignService `
  --domain $SignHost `
  --region $Region `
  --project $ProjectId
```

Do NOT use:

```text
--force-override
```

If the hostname is unexpectedly mapped elsewhere, stop and inspect rather than replacing it.

---

# STEP 10 — Display the required DNS records

Run:

```powershell
gcloud beta run domain-mappings describe `
  --domain $SignHost `
  --region $Region `
  --project $ProjectId
```

For just the records:

```powershell
gcloud beta run domain-mappings describe `
  --domain $SignHost `
  --region $Region `
  --project $ProjectId `
  --format="yaml(status.resourceRecords)"
```

Add ONLY the returned records for:

```text
sign.bakerrang.com
```

to your DNS provider.

Do not change:

- `bakerrang.com`
- `launch.bakerrang.com`
- `storybook.bakerrang.com`
- `polyglot.bakerrang.com`
- `api.bakerrang.com`
- portal/renderer mappings

---

# STEP 11 — Wait for the custom domain to become ready

Check:

```powershell
gcloud beta run domain-mappings describe `
  --domain $SignHost `
  --region $Region `
  --project $ProjectId
```

Then:

```powershell
Start-Process $SignBaseUrl
```

You can also test:

```powershell
Invoke-WebRequest `
  -Uri $SignBaseUrl `
  -Method Head
```

The TLS certificate may take some time after DNS propagation.

Do not perform the registry cutover until:

```text
https://sign.bakerrang.com
```

works correctly over HTTPS.

---

# STEP 12 — Verify vendor assets through the REAL hostname

Repeat the important asset checks through the public host.

## Model

```powershell
$response = Invoke-WebRequest `
  -Uri "$SignBaseUrl/vendor/hand_landmarker-f16-v1.task" `
  -Method Head

$response.StatusCode
$response.Headers["Cache-Control"]
```

Expected:

```text
200
```

---

## WASM

```powershell
$response = Invoke-WebRequest `
  -Uri "$SignBaseUrl/vendor/tasks-vision-0.10.34/vision_wasm_internal.wasm" `
  -Method Head

$response.StatusCode
$response.Headers["Content-Type"]
$response.Headers["Cache-Control"]
```

Expected:

```text
200
```

---

## Missing file

```powershell
try {
  Invoke-WebRequest `
    -Uri "$SignBaseUrl/vendor/does-not-exist.task" `
    -Method Get `
    -ErrorAction Stop
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected:

```text
404
```

---

# STEP 13 — Direct-host live acceptance

Keep Launcher pointing to the legacy Sign route while you test:

```text
https://sign.bakerrang.com
```

directly.

## Signed-out welcome

Verify:

- desktop layout looks like approved Viewfinder comp
- mobile layout stacks correctly
- example hand remains contained
- dark theme
- light theme
- Sign language is described as a practice aid, not an interpreter

---

## Authentication

Verify:

- Google sign-in works
- OAuth returns to Sign
- existing BakerRang session is recognized
- sign-out works

---

## Camera startup

After authentication:

- camera is OFF initially
- browser does not ask for permission until Start Camera is clicked
- Start Camera begins loading reader
- permission state appears
- live camera starts only after permission is granted
- preview is mirrored

---

## Static handshape recognition

Test several supported shapes, including:

```text
A
B
L
V
Y
1
5
I love you
```

Verify:

- recognized shape appears as real text
- overlay tracks the hand
- caption reflects the reading
- label does not flicker uncontrollably
- unsupported shapes do not produce false supported labels

---

## Practice mode

Choose a static target such as:

```text
L
```

Verify:

- correct formation instructions appear
- matching hand starts progress
- breaking the pose resets progress
- approximately 1.2 seconds produces `Held`
- crop marks perform the focus-lock confirmation
- tally updates
- Next Handshape works

---

## Motion shapes

Test:

```text
J
Z
```

Verify:

- they do not show the static hold-progress behavior
- successful motion causes Held
- failed/incomplete motion does not falsely mark Held

---

## Target picker

Desktop:

- mouse works
- arrow keys work
- Home / End work
- typing a supported letter jumps correctly
- Enter/Space selects
- Escape closes
- focus returns correctly

Mobile:

- picker becomes bottom sheet
- no horizontal overflow
- controls remain touchable

---

# STEP 14 — Camera lifecycle acceptance

This is especially important.

Start the camera.

Then test:

## Stop button

Click Stop Camera.

Confirm the browser camera indicator disappears.

---

## Background tab

Start the camera again.

Switch to another browser tab or application.

Confirm the camera turns off.

Return to Sign.

Confirm it does NOT automatically restart.

Explicitly Start Camera again.

---

## App navigation

With the camera running, navigate to another BakerRang app through the switcher.

Confirm the camera shuts off.

---

## Sign out

With the camera running, sign out.

Confirm the camera shuts off.

---

# STEP 15 — Geometry / overlay acceptance

Test at least:

- desktop webcam / 16:9
- 4:3 camera if available
- phone portrait

Verify:

- hand landmarks remain aligned
- recognition label stays attached to the hand
- camera is not stretched
- mirrored presentation remains correct
- crop/finder framing makes sense
- no overlay drifts as viewport changes

If orientation can change on the phone, test portrait → landscape → portrait.

---

# STEP 16 — Accessibility sanity check

At minimum verify:

- keyboard can reach every interactive control
- target picker operates without mouse
- focus is visibly indicated
- Escape behaves correctly
- recognized result exists in DOM text
- recognition changes do not produce nonstop screen-reader chatter
- Held is communicated with text, not just animation/color

Turn on reduced motion in the OS/browser if practical.

Verify Held confirmation no longer moves the crop marks and instead uses the approved static treatment.

---

# STEP 17 — Privacy / Network verification

Open browser DevTools → Network.

Start the camera and perform several handshapes.

You should NOT see:

- camera frames being uploaded
- images being uploaded
- landmarks being uploaded
- Sign interpretation API requests
- recognition text sent to BakerRang

You SHOULD see local requests such as:

```text
/vendor/hand_landmarker-f16-v1.task
/vendor/tasks-vision-0.10.34/...
```

Those requests should go to:

```text
sign.bakerrang.com
```

There should be no runtime MediaPipe CDN request.

There should be no request to:

```text
/sign-language/interpret
```

---

# STEP 18 — Verify retired interpretation API

The old endpoint should now be gone.

A GET request is not meaningful because the old endpoint was POST, so test POST:

```powershell
try {
  Invoke-WebRequest `
    -Uri "https://api.bakerrang.com/sign-language/interpret" `
    -Method Post `
    -ContentType "application/json" `
    -Body "{}" `
    -ErrorAction Stop
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected:

```text
404
```

Do not expect a successful interpretation response.

---

# STEP 19 — Verify coexistence before cutover

Legacy Sign must still work:

```powershell
Start-Process "https://bakerrang.com/sign-language"
```

Also smoke the already extracted apps:

```powershell
Start-Process "https://launch.bakerrang.com"
Start-Process "https://storybook.bakerrang.com"
Start-Process "https://polyglot.bakerrang.com"
```

At this point Launcher should STILL send Sign to:

```text
https://bakerrang.com/sign-language
```

That is intentional.

---

# STEP 20 — Final registry cutover

Only after direct-host acceptance passes should Sign move from:

```text
https://bakerrang.com/sign-language
```

to:

```text
https://sign.bakerrang.com
```

Update the shared consumer app registry.

The Sign definition should retain its legacy route but gain:

```text
liveUrl: 'https://sign.bakerrang.com'
```

Conceptually:

```javascript
{
  id: 'sign',
  // ...
  legacyPath: '/sign-language',
  liveUrl: 'https://sign.bakerrang.com'
}
```

Do NOT remove:

```text
legacyPath: '/sign-language'
```

Do NOT delete the legacy page.

Update the registry tests accordingly.

Expected destinations after cutover:

```text
Launcher:
https://launch.bakerrang.com

Story Book:
https://storybook.bakerrang.com

Polyglot:
https://polyglot.bakerrang.com

Sign:
https://sign.bakerrang.com
```

Unmigrated apps continue using legacy apex routes.

Commit/push this as a small cutover change.

Because this is a shared package change, CI should fan out to:

- `web-launcher`
- `web-storybook`
- `web-polyglot`
- `web-sign`

---

# STEP 21 — Post-cutover smoke

After the shared registry deployment finishes:

Open Launcher:

```powershell
Start-Process "https://launch.bakerrang.com"
```

Click Sign.

It should navigate directly to:

```text
https://sign.bakerrang.com
```

Then verify app switching among:

```text
Launcher
Story Book
Polyglot
Sign
```

Verify legacy Sign still loads directly:

```powershell
Start-Process "https://bakerrang.com/sign-language"
```

Apex remains unchanged.

---

# STEP 22 — Rollback

## Roll back the Sign service

If the isolated Sign deployment itself is bad:

Use GitHub Actions:

```text
Rollback MAIN
```

with:

```text
service = web-sign
```

and select the previously approved immutable SHA/revision.

Do not test rollback against a healthy production service solely for this runbook.

---

## Roll back only the product cutover

If Sign itself is healthy but navigation should return to legacy Sign:

Revert:

```text
sign.liveUrl
```

from:

```text
https://sign.bakerrang.com
```

back to:

```text
null
```

The shared registry will again resolve Sign to:

```text
https://bakerrang.com/sign-language
```

This does not require deleting or rolling back the `bakerrang-web-sign` service.

---

# FINAL EXPECTED STATE

After successful direct acceptance and registry cutover:

```text
Launcher
https://launch.bakerrang.com

Story Book
https://storybook.bakerrang.com

Polyglot
https://polyglot.bakerrang.com

Sign
https://sign.bakerrang.com

Legacy Sign
https://bakerrang.com/sign-language

API
https://api.bakerrang.com

Apex
https://bakerrang.com
```

The legacy Sign route remains available.

The apex remains legacy.

Sign is independently deployed.

The camera/recognition pipeline remains fully local to the user's browser.

Once post-cutover smoke passes:

**PHASE E — SIGN: CLOSED**