# Passwords — Phase G Operator Deployment Runbook

This runbook provisions, deploys, accepts, and cuts over the extracted BakerRang Passwords application. Run it only from an approved, reviewed `main` commit. Commands are PowerShell and do not contain secrets.

## Targets

- Logical service: `web-passwords`
- Cloud Run service: `bakerrang-web-passwords`
- Public host: `https://passwords.bakerrang.com`
- API: `bakerrang-api`
- Project / region: `avian-cable-379805` / `us-west1`
- Runtime service account: `bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com`

Until final cutover, `passwords.liveUrl` remains `null`; Launcher and every app switcher still open `https://bakerrang.com/passwords`. The legacy page remains available and the apex host is unchanged.

## STEP 0 — Set variables and confirm identity

```powershell
$ProjectId = "avian-cable-379805"
$Region = "us-west1"
$ApiService = "bakerrang-api"
$PasswordsService = "bakerrang-web-passwords"
$PasswordsHost = "passwords.bakerrang.com"
$PasswordsBaseUrl = "https://passwords.bakerrang.com"
$FrontendRuntimeSa = "bakerrang-frontend@$ProjectId.iam.gserviceaccount.com"
$GitHubEnvironment = "production"
$GitHubRepo = gh repo view --json nameWithOwner --jq .nameWithOwner

gcloud config get-value project
gcloud auth list --filter=status:ACTIVE --format="value(account)"
gh auth status
```

Expected: the project is `avian-cable-379805`, exactly one intended operator identity is active, and `$GitHubRepo` names this repository. Stop if any value is unexpected.

### STEP 0b — Optional read-only storage counts

If a count baseline is useful, use Firestore **count aggregations only** for `vaults`, a collection-group `items` count, and `vault_shares`. Record the numbers without document fields. Do not read, export, or log vault documents or encrypted payloads during this check.

## STEP 1 — Add the production GitHub variables

```powershell
gh variable set WEB_PASSWORDS_SERVICE --env $GitHubEnvironment --body $PasswordsService --repo $GitHubRepo
gh variable set PASSWORDS_BASE_URL --env $GitHubEnvironment --body $PasswordsBaseUrl --repo $GitHubRepo
gh variable get WEB_PASSWORDS_SERVICE --env $GitHubEnvironment --repo $GitHubRepo
gh variable get PASSWORDS_BASE_URL --env $GitHubEnvironment --repo $GitHubRepo
```

Expected output:

```text
bakerrang-web-passwords
https://passwords.bakerrang.com
```

## STEP 2 — Add the API OAuth/CORS origin

PR 1 (the server implementation) must already be deployed. This additive update must not remove any existing environment variables.

```powershell
gcloud run services update $ApiService `
  --project $ProjectId `
  --region $Region `
  --update-env-vars "PASSWORDS_DOMAIN=$PasswordsBaseUrl"

gcloud run services describe $ApiService `
  --project $ProjectId `
  --region $Region `
  --format="yaml(spec.template.spec.containers[0].env)"
```

Expected: `PASSWORDS_DOMAIN` is present with the exact public HTTPS origin; all existing variables remain.

## STEP 3 — Bootstrap the Cloud Run service

Use the current Budget image only to create the correctly shaped service. Normal CI replaces it with the Passwords image in Step 6.

```powershell
$BootstrapImage = gcloud run services describe bakerrang-web-budget `
  --project $ProjectId --region $Region `
  --format="value(spec.template.spec.containers[0].image)"

gcloud run deploy $PasswordsService `
  --project $ProjectId `
  --region $Region `
  --image $BootstrapImage `
  --service-account $FrontendRuntimeSa `
  --port 8080 `
  --allow-unauthenticated `
  --quiet

gcloud run services describe $PasswordsService `
  --project $ProjectId --region $Region `
  --format="value(spec.template.spec.serviceAccountName)"
```

Expected: the service account is exactly `$FrontendRuntimeSa`.

## STEP 4 — Copy only scoped deployer IAM

```powershell
$ExistingFrontendIam = gcloud run services get-iam-policy bakerrang-web-budget `
  --project $ProjectId --region $Region --format=json | ConvertFrom-Json
$Deployers = @($ExistingFrontendIam.bindings | Where-Object role -ceq "roles/run.developer" | ForEach-Object members)

foreach ($Member in $Deployers) {
  gcloud run services add-iam-policy-binding $PasswordsService `
    --project $ProjectId --region $Region `
    --member $Member --role roles/run.developer --quiet
}

gcloud run services get-iam-policy $PasswordsService `
  --project $ProjectId --region $Region `
  --format="table(bindings.role,bindings.members)"
```

Expected: the same scoped `roles/run.developer` members as Budget. Do not grant a project-wide role.

## STEP 5 — Verify runtime service-account use

```powershell
gcloud iam service-accounts get-iam-policy $FrontendRuntimeSa `
  --project $ProjectId `
  --format="table(bindings.role,bindings.members)"
```

Expected: the existing deployer identity retains `roles/iam.serviceAccountUser`. Do not add a broader role.

## STEP 6 — Merge PR 2 and watch normal deployment

Push the app/CI PR through the normal reviewed path, then:

```powershell
gh run list --workflow deploy.yml --branch main --limit 5 --repo $GitHubRepo
$RunId = gh run list --workflow deploy.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId' --repo $GitHubRepo
gh run watch $RunId --repo $GitHubRepo --exit-status
```

Expected: API deploys only if server files changed; the classifier names the affected web services. The `web-passwords` job finishes successfully with an immutable digest, unchanged runtime identity, and passing shell smoke.

## STEP 7 — Verify the unmapped `run.app` service

```powershell
$PasswordsRunUrl = gcloud run services describe $PasswordsService `
  --project $ProjectId --region $Region --format="value(status.url)"

$Shell = Invoke-WebRequest "$PasswordsRunUrl/"
$Nope = Invoke-WebRequest "$PasswordsRunUrl/nope"
$Manifest = Invoke-RestMethod "$PasswordsRunUrl/manifest.webmanifest"
$Sw = Invoke-WebRequest "$PasswordsRunUrl/sw.js"
$ThemeBoot = Invoke-WebRequest "$PasswordsRunUrl/theme-boot.js"
$HomeHeaders = Invoke-WebRequest "$PasswordsRunUrl/" -Method Head
$NopeHeaders = Invoke-WebRequest "$PasswordsRunUrl/nope" -Method Head

$Shell.StatusCode
$Shell.Content.Contains('<div id="root"')
$Nope.StatusCode
$Manifest.name
$Sw.StatusCode; $ThemeBoot.StatusCode
$HomeHeaders.Headers; $NopeHeaders.Headers
```

Expected: `/` and `/nope` return 200 and the SPA shell; the manifest name is `Passwords — BakerRang`; `sw.js` and `theme-boot.js` return 200. On both routes, headers include the exact Passwords CSP from `web/nginx/apps/passwords.conf`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Strict-Transport-Security: max-age=31536000`. Inspect `$Shell.Content`: no inline `<script>`; theme boot is an external script.

## STEP 8 — Verify API CORS, auth, and privacy headers

```powershell
$Headers = @{ Origin = $PasswordsBaseUrl }
try { Invoke-WebRequest "https://api.bakerrang.com/vault" -Headers $Headers } catch { $Response = $_.Exception.Response }
$Response.StatusCode.value__
$Response.Headers['Access-Control-Allow-Origin']
$Response.Headers['Access-Control-Allow-Credentials']
$Response.Headers['Cache-Control']
```

Expected: unauthenticated GET is 401, allow-origin echoes `https://passwords.bakerrang.com`, credentials are allowed, and cache-control is `no-store`. Repeat as an OPTIONS preflight for `POST /vault/pubkey` with `Access-Control-Request-Method: POST` and `Access-Control-Request-Headers: content-type,x-csrf-token`; confirm the same exact origin.

## STEP 9 — Create only the Passwords domain mapping

```powershell
gcloud beta run domain-mappings create `
  --service $PasswordsService `
  --domain $PasswordsHost `
  --project $ProjectId `
  --region $Region
```

Expected: a mapping for `passwords.bakerrang.com` only. Never map the apex.

## STEP 10 — Read the required DNS records

```powershell
gcloud beta run domain-mappings describe `
  --domain $PasswordsHost --project $ProjectId --region $Region `
  --format="yaml(status.resourceRecords,status.conditions)"
```

Add or replace only the exact Passwords-host record shown by Google. Review the current DNS record before mutation; do not touch any sibling host.

## STEP 11 — Wait for certificate readiness

```powershell
do {
  $Ready = gcloud beta run domain-mappings describe `
    --domain $PasswordsHost --project $ProjectId --region $Region `
    --format="value(status.conditions[0].status)"
  Write-Host "Passwords mapping Ready: $Ready"
  if ($Ready -ne "True") { Start-Sleep -Seconds 20 }
} until ($Ready -eq "True")
```

Expected: `Passwords mapping Ready: True` and a valid browser certificate for the host.

## STEP 12 — Direct-host acceptance (checks 1–24)

Use a **disposable second Google account and test vault first**. Never enter a real secret in an acceptance script or screenshot. Use the owner's real vault only for checks 3 (counts and decryptability), 5 (unlock), and 14 (two-tab concurrency). Record pass/fail text against §28 of [the Phase G plan](PhaseG-Passwords.md).

1. HTTPS `/` and `/nope` serve the shell; `/nope` shows the in-app not-found page. Check the manifest, external theme script, CSP, frame, MIME, referrer and HSTS headers. Keep the DevTools console open through checks 2–9; there should be zero CSP violations.
2. Signed out, read the Welcome copy, use **Sign in with Google**, and confirm `?target=passwords` returns here. An existing Google session should need no extra prompt.
3. With the owner's real vault, compare only entry, folder and received-share counts with legacy. Confirm no entry that legacy opens appears as “Can't open”.
4. In the disposable account, create a vault: 11 characters fails; 12 plus the no-recovery acknowledgment succeeds. Confirm its KDF is the approved Argon2id default without reading or exporting the vault document's encrypted fields.
5. Wrong master password stays locked and clears the field; correct password unlocks. An offline unlock reports a load problem, never “wrong password”.
6. In the test vault, add, edit, replace/generate, save, and delete an entry. Empty Replace preserves the old password. Reload to confirm persistence.
7. Eight- and 30-character test passwords both show 12 bullets when hidden. Show reveals monospaced text; it hides at 30 seconds and immediately on tab switch.
8. Copy username and password; verify paste and the Copied state. Block clipboard permission and verify the error plus Show fallback.
9. Search must ignore notes. Reorder by drag and by “Move folder…”, use A–Z, bulk move and bulk delete.
10. Inspect the Elements and Accessibility panes as described in Step 13.
11. Inspect `/vault` request bodies and URLs as described in Step 13.
12. Inspect browser storage as described in Step 13.
13. Verify `no-store` and exact origin headers on 200, 401, and 409 responses.
14. In two tabs, save the same entry in both: the second gets conflict copy and **Use latest** shows the first. Different-entry saves both persist. Delete in A then save in B shows “deleted somewhere else”.
15. Check legacy coexistence in Step 14.
16. Unlock the Chrome/Edge extension and autofill a test login. Toggle the new setting, then unlock the extension again to confirm the change.
17. With two test accounts, share a folder with Can edit; recipient adds an entry and owner reads it. View only blocks editing. Revoke removes access. Repair access and recipient history work; history does not expose co-recipients.
18. Lock manually, by idle timeout, by browser back/forward cache return, and by sign-out. After lock, reveal/copy controls are gone.
19. On real iOS Safari and Android Chrome at 390 px, check no horizontal scroll, no keyboard on open, 44 px controls, reachable Save, A–Z and Back.
20. With NVDA or VoiceOver, traverse folder tree, list, sheet, reveal and copy status, and dialogs. Focus stays inside a dialog and returns on close.
21. Check light, dark and system without flash; reduced motion uses a static hint instead of a drain animation.
22. Install as “Passwords”. Offline after unlock is read only; cold offline start shows Welcome.
23. Before registry flip, all switchers still open `/passwords`. After a separate cutover PR, they open the new host. Sibling destinations and apex stay unchanged.
24. A Passwords-only change deploys only `web-passwords`; rollback and verify-live cover it; the other five apps keep the shared nginx config.

## STEP 13 — Privacy and network inspection

Use only the disposable vault. In DevTools Elements, search the DOM and attributes for the test password: it is absent while hidden, and absent from attributes even during Edit. The Accessibility pane on the hidden password row has no value. In Network, search a saved HAR for the test master password, title and entry password: `/vault` bodies contain ciphertext and IDs only, and URLs have no query string except audit pagination. Recipient key lookup is POST. Check `cache-control: no-store` for 200, 401 and 409 and ACAO equal to the Passwords host, with credentials. In Application, Local/Session Storage, IndexedDB and Cache Storage have no vault data; service-worker cache holds shell assets only and the Passwords host has only the `br_theme` cookie.

**Evidence rule:** never screenshot or paste a real revealed password, note or username. Blur it, or use the test vault.

## STEP 14 — Legacy coexistence

Open `https://bakerrang.com/passwords` and the new host as the same test account. Edit a test entry in legacy; refresh the new app and confirm the change. Edit in new; confirm legacy reads it. Hold a stale new edit, save a legacy edit, then verify new Save gets a 409 conflict and **Use latest** loads the server version. Confirm existing browser extension autofill still reads the same test vault.

## STEP 15 — Registry cutover PR

After direct-host acceptance, make a separate reviewed PR changing only Passwords's registry record:

```js
{ id: 'passwords', /* unchanged fields */, legacyPath: '/passwords', liveUrl: 'https://passwords.bakerrang.com' }
```

Update the registry test's expected Passwords URL. Do **not** remove `legacyPath:'/passwords'`; do **not** delete the legacy page; do not change Story Book, Polyglot, Sign, or the apex mapping.

## STEP 16 — Post-cutover smoke

From Launcher and every app switcher, open Passwords and confirm the destination is `https://passwords.bakerrang.com`. Confirm sibling destinations are unchanged and `https://bakerrang.com/passwords` still works directly.

## STEP 17 — Rollback

For a bad Passwords image, use the standard protected workflow with a reviewed exact target:

```powershell
gh workflow run rollback.yml --repo $GitHubRepo `
  -f service=web-passwords -f mechanism=image -f target=<full-lowercase-40-character-good-sha>
```

For a cutover problem, revert only PR 3 so the registry sends users back to legacy. For a service problem, use the exact immutable-image rollback above. Revert the server PR only after the cutover PR is reverted and the new app is no longer in use; the extracted app depends on the hardened `/vault` routes. There is no key-rotation or data-migration rollback step.

## STEP 18 — Extension compatibility

No extension deployment is part of Phase G. Confirm its existing autofill reads the test vault and the setting takes effect after the extension's next unlock. If it fails, keep the registry on legacy while investigating.

## FINAL EXPECTED STATE

- `bakerrang-web-passwords` serves an immutable Passwords image under the frontend runtime identity.
- `passwords.bakerrang.com` is mapped, certified, accepted, and independently verifiable/rollbackable.
- `PASSWORDS_DOMAIN` is additive on the API; CORS is exact and `/vault` responses are `no-store`.
- Before the final registry PR, `passwords.liveUrl` remains `null`; after it, Launcher and all switchers open the Passwords host.
- The legacy `/passwords` page and apex remain available; sibling apps remain unchanged. There is no key-rotation step. The legacy `GET /vault/pubkey?email=` still puts a recipient email in Cloud Run request logs until legacy is decommissioned (R6); the new app uses POST.
