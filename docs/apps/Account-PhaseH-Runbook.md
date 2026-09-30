# Account — Phase H Operator Deployment Runbook

This runbook provisions, deploys, accepts, and cuts over the extracted BakerRang Account application. Run it only from an approved, reviewed `main` commit. Commands are PowerShell and do not contain secrets. Nothing in this document has been executed; it is the operator's script.

## Targets

- Logical service: `web-account`
- Cloud Run service: `bakerrang-web-account`
- Public host: `https://account.bakerrang.com`
- OAuth target: `account` (API env `ACCOUNT_DOMAIN`); build env `VITE_ACCOUNT_URL` is the registry key only
- API: `bakerrang-api`
- Project / region: `avian-cable-379805` / `us-west1`
- Runtime service account: `bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com`

Until final cutover, `account.liveUrl` remains `null`. The avatar menus, app switchers, the Launcher "Your account" row and the Story Book / Polyglot voice links still open `https://bakerrang.com/account`. The legacy Account page remains available (voices only, plus a pointer to Passwords for vault settings) and the apex host is unchanged. The legacy `/supermarket` page and its `/supermarket/licenses` backend are untouched (they are removed at the final cleanup).

## Order of the three code changes

1. **Server (B1–B8)** and **legacy hotfix LH-1** are independent of each other and of the app; either order is safe. Both must be live before Step 12 (the app needs the hardened voice routes, the `account` OAuth target, and the `ACCOUNT_DOMAIN` CORS origin).
2. **App + shared fixes + CI + Launcher copy + this runbook** deploys `web-account` and fans the shared `web-theme` / `web-app-shell` changes out to all seven web apps.
3. **Registry flip** (a separate PR) happens only after direct-host acceptance (Step 15).

## STEP 0 — Set variables and confirm identity

```powershell
$ProjectId = "avian-cable-379805"
$Region = "us-west1"
$ApiService = "bakerrang-api"
$AccountService = "bakerrang-web-account"
$AccountHost = "account.bakerrang.com"
$AccountBaseUrl = "https://account.bakerrang.com"
$FrontendRuntimeSa = "bakerrang-frontend@$ProjectId.iam.gserviceaccount.com"
$GitHubEnvironment = "production"
$GitHubRepo = gh repo view --json nameWithOwner --jq .nameWithOwner

gcloud config get-value project
gcloud auth list --filter=status:ACTIVE --format="value(account)"
gh auth status
```

Expected: the project is `avian-cable-379805`, exactly one intended operator identity is active, and `$GitHubRepo` names this repository. Stop if any value is unexpected.

### STEP 0b — Optional read-only storage counts

If a baseline is useful, use Firestore **count aggregations only**: the `voices` collection (voices per environment) and the `licenses` collection (recorded once for the final-cleanup inventory; Account no longer reads or writes it). Record the numbers only. Do not read, export, or log voice names, descriptions, or user ids during this check.

## STEP 1 — Add the production GitHub variables

```powershell
gh variable set WEB_ACCOUNT_SERVICE --env $GitHubEnvironment --body $AccountService --repo $GitHubRepo
gh variable set ACCOUNT_BASE_URL --env $GitHubEnvironment --body $AccountBaseUrl --repo $GitHubRepo
gh variable get WEB_ACCOUNT_SERVICE --env $GitHubEnvironment --repo $GitHubRepo
gh variable get ACCOUNT_BASE_URL --env $GitHubEnvironment --repo $GitHubRepo
```

Expected output:

```text
bakerrang-web-account
https://account.bakerrang.com
```

## STEP 2 — Add the API OAuth/CORS origin

The server change must already be deployed. This additive update must not remove any existing environment variables.

```powershell
gcloud run services update $ApiService `
  --project $ProjectId `
  --region $Region `
  --update-env-vars "ACCOUNT_DOMAIN=$AccountBaseUrl"

gcloud run services describe $ApiService `
  --project $ProjectId `
  --region $Region `
  --format="yaml(spec.template.spec.containers[0].env)"
```

Expected: `ACCOUNT_DOMAIN` is present with the exact public HTTPS origin; all existing variables remain. (Local development uses `ACCOUNT_DOMAIN=http://localhost:3060`.)

## STEP 3 — Bootstrap the Cloud Run service

Use the current Passwords image only to create the correctly shaped service. Normal CI replaces it with the Account image in Step 6.

```powershell
$BootstrapImage = gcloud run services describe bakerrang-web-passwords `
  --project $ProjectId --region $Region `
  --format="value(spec.template.spec.containers[0].image)"

gcloud run deploy $AccountService `
  --project $ProjectId `
  --region $Region `
  --image $BootstrapImage `
  --service-account $FrontendRuntimeSa `
  --port 8080 `
  --allow-unauthenticated `
  --quiet

gcloud run services describe $AccountService `
  --project $ProjectId --region $Region `
  --format="value(spec.template.spec.serviceAccountName)"
```

Expected: the service account is exactly `$FrontendRuntimeSa`.

## STEP 4 — Copy only scoped deployer IAM

```powershell
$ExistingFrontendIam = gcloud run services get-iam-policy bakerrang-web-passwords `
  --project $ProjectId --region $Region --format=json | ConvertFrom-Json
$Deployers = @($ExistingFrontendIam.bindings | Where-Object role -ceq "roles/run.developer" | ForEach-Object members)

foreach ($Member in $Deployers) {
  gcloud run services add-iam-policy-binding $AccountService `
    --project $ProjectId --region $Region `
    --member $Member --role roles/run.developer --quiet
}

gcloud run services get-iam-policy $AccountService `
  --project $ProjectId --region $Region `
  --format="table(bindings.role,bindings.members)"
```

Expected: the same scoped `roles/run.developer` members as Passwords. Do not grant a project-wide role.

## STEP 5 — Verify runtime service-account use

```powershell
gcloud iam service-accounts get-iam-policy $FrontendRuntimeSa `
  --project $ProjectId `
  --format="table(bindings.role,bindings.members)"
```

Expected: the existing deployer identity retains `roles/iam.serviceAccountUser`. Do not add a broader role.

## STEP 6 — Merge the app PR and watch normal deployment

Push the app/CI PR through the normal reviewed path, then:

```powershell
gh run list --workflow deploy.yml --branch main --limit 5 --repo $GitHubRepo
$RunId = gh run list --workflow deploy.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId' --repo $GitHubRepo
gh run watch $RunId --repo $GitHubRepo --exit-status
```

Expected: because the PR changes `web/packages/web-theme` and `web/packages/web-app-shell`, the classifier names **all seven** web apps (`web-launcher`, `web-storybook`, `web-polyglot`, `web-sign`, `web-budget`, `web-passwords`, `web-account`) and each job finishes successfully with an immutable digest, unchanged runtime identity, and passing shell smoke. The `web-account` smoke also asserts the CSP `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and `Permissions-Policy` `microphone=(self)`. The API deploys only if server files changed in the same range.

## STEP 7 — Verify the unmapped `run.app` service

```powershell
$AccountRunUrl = gcloud run services describe $AccountService `
  --project $ProjectId --region $Region --format="value(status.url)"

$Shell = Invoke-WebRequest "$AccountRunUrl/"
$Nope = Invoke-WebRequest "$AccountRunUrl/nope"
$Manifest = Invoke-RestMethod "$AccountRunUrl/manifest.webmanifest"
$Sw = Invoke-WebRequest "$AccountRunUrl/sw.js"
$ThemeBoot = Invoke-WebRequest "$AccountRunUrl/theme-boot.js"
$HomeHeaders = Invoke-WebRequest "$AccountRunUrl/" -Method Head
$NopeHeaders = Invoke-WebRequest "$AccountRunUrl/nope" -Method Head

$Shell.StatusCode
$Shell.Content.Contains('<div id="root"')
$Nope.StatusCode
$Manifest.name
$Sw.StatusCode; $ThemeBoot.StatusCode
$HomeHeaders.Headers; $NopeHeaders.Headers
```

Expected: `/` and `/nope` return 200 and the SPA shell; the manifest name is `Account — BakerRang`; `sw.js` and `theme-boot.js` return 200. On both routes, headers include exactly the eight headers from `web/nginx/apps/account.conf`:

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; font-src 'self'; connect-src 'self' https://api.bakerrang.com; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=(), usb=(), clipboard-read=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

There is no `wasm-unsafe-eval`. Inspect `$Shell.Content`: no inline `<script>`; the theme boot is the external `/theme-boot.js`, and it is the first script in `<head>`.

## STEP 8 — Verify API CORS, auth, and privacy headers

```powershell
$Headers = @{ Origin = $AccountBaseUrl }
foreach ($Path in @("/account/preferences", "/text/to/speech/v1/voices", "/auth/check")) {
  try { $Response = Invoke-WebRequest "https://api.bakerrang.com$Path" -Headers $Headers } catch { $Response = $_.Exception.Response }
  "$Path -> $($Response.StatusCode.value__)"
  $Response.Headers['Access-Control-Allow-Origin']
  $Response.Headers['Access-Control-Allow-Credentials']
  $Response.Headers['Cache-Control']
}
```

Expected: each unauthenticated GET is 401; allow-origin echoes exactly `https://account.bakerrang.com`; credentials are allowed; and `Cache-Control` is `no-store` (the 401 included: `/account` and `/auth/check` are `no-store` at the mount, the voice routes at their router). Repeat as an OPTIONS preflight for `PATCH /text/to/speech/v1/voices/x` with `Access-Control-Request-Method: PATCH` and `Access-Control-Request-Headers: content-type,x-csrf-token`; confirm the same exact origin. Repeat the GET with `Origin: https://account.bakerrang.com.evil.example`: no allow-origin is returned.

## STEP 9 — Create only the Account domain mapping

```powershell
gcloud beta run domain-mappings create `
  --service $AccountService `
  --domain $AccountHost `
  --project $ProjectId `
  --region $Region
```

Expected: a mapping for `account.bakerrang.com` only. Never map the apex.

## STEP 10 — Read the required DNS records

```powershell
gcloud beta run domain-mappings describe `
  --domain $AccountHost --project $ProjectId --region $Region `
  --format="yaml(status.resourceRecords,status.conditions)"
```

Add or replace only the exact Account-host record shown by Google. Review the current DNS record before mutation; do not touch any sibling host.

## STEP 11 — Wait for certificate readiness

```powershell
do {
  $Ready = gcloud beta run domain-mappings describe `
    --domain $AccountHost --project $ProjectId --region $Region `
    --format="value(status.conditions[0].status)"
  Write-Host "Account mapping Ready: $Ready"
  if ($Ready -ne "True") { Start-Sleep -Seconds 20 }
} until ($Ready -eq "True")
```

Expected: `Account mapping Ready: True` and a valid browser certificate for the host.

## STEP 12 — Direct-host acceptance (checks 1–24)

**Evidence rule:** use a **disposable second Google account** and **synthetic voices** for every screenshot and recording. Never record, screenshot, or paste a real person's voice sample. The owner's real account is used only for checks 3, 11 and 17, recorded as pass/fail text against §25 of [the Phase H plan](PhaseH-Account.md).

1. **Shell + headers.** HTTPS `/` and `/nope` serve the shell (`/nope` shows the in-app "That page isn't in Account."). The manifest reads "Account — BakerRang". All eight headers are present. No inline script. Keep the DevTools console open through checks 2–16: there must be **zero** CSP violations.
2. **Signed out.** Welcome shows. Change the theme: `br_theme` changes and the Network tab shows **no** `/account` request. The gold **Sign in with Google** returns to `account.bakerrang.com` (`?target=account`); an existing Google session needs no extra prompt.
3. **Identity** (owner account). Name and email match the Google account. No request to `googleusercontent.com`. No user id anywhere in the DOM (search the Elements pane for the id).
4. **Theme from Account.** Light / Dark / System repaint the sheet at once, the Relay tiles take the new ground left to right, the status reads "Saved to your account…", and `PUT /account/preferences` returns 200 with `cache-control: no-store`.
5. **Reflected in another app.** Open Story Book in another tab: it already has the new theme (boot from the cookie). Switch back with no flash.
6. **Changed elsewhere → Account.** With Account open, change the theme from Budget's avatar menu, then return to the Account tab: it adopts the new theme on focus with **no extra `PUT`** (check Network).
7. **Reload / cross-device.** Reload: the theme persists. Sign in on a second browser: it picks up the stored theme on load.
8. **Voices** (disposable account). Add one voice by uploading a file and one by recording (consent required both times). The first voice is PRIMARY. Rename one, make another primary, delete one, reload: everything persisted. Story Book and Polyglot list the renamed voice and mark the right one PRIMARY.
9. **Voice limits.** An 11 MB file, a `.txt` renamed to `.mp3` (wrong type), and a fourth file each give a clear error and create nothing. Confirm in Network that no `POST /text/to/speech/v1/voice` is sent for the client-blocked cases.
10. **Supermarket absent.** No Supermarket text, control or request in Account, and none in legacy Account after LH-1.
11. **Passwords separation** (owner account). No vault control and no `/vault` request in Account. Passwords → Vault settings still shows the owner's existing *Lock after* and extension values, unchanged by any Account action.
12. **Network inspection.** No query strings carrying personal data; voice uploads go only to `api.bakerrang.com`; every Account, voice and auth response carries `cache-control: no-store`.
13. **Storage inspection.** Local Storage, Session Storage and IndexedDB hold nothing from Account. Cache Storage holds shell assets only. Cookies are `br_theme` plus the API's own.
14. **CORS / CSRF.** `Access-Control-Allow-Origin` is exactly `https://account.bakerrang.com` with credentials. Replaying a `PATCH /text/to/speech/v1/voices/{id}` without `x-csrf-token` returns 403.
15. **Concurrency.** Two tabs: rapid theme toggles end on the last choice in both after focus. Make a different voice primary in each tab: after reload exactly one is PRIMARY. Delete a voice in tab A, rename it in tab B: B shows "This voice was deleted somewhere else."
16. **Sign out.** Session → **Sign out** → Welcome. Other open BakerRang tabs show signed out on their next focus or poll. Another browser stays signed in.
17. **Legacy coexistence** (owner account). See Step 14.
18. **Mobile** (real iOS Safari and Android Chrome, 390 px). No horizontal scroll; every control is at least 44 px; recording works (Safari MP4, Chrome WebM) and plays back; the on-screen keyboard does not hide **Create voice**.
19. **Keyboard + screen reader.** With NVDA or VoiceOver traverse the rail, the theme radio group, voice actions (each names its voice), editor errors, and the live messages. Focus returns to the control that opened an editor, and to the Welcome heading after sign-out.
20. **Themes + motion.** Light, dark and system with no flash; with reduced motion the Relay changes instantly.
21. **PWA.** Installable as "Account". An offline cold start shows the shell; offline while open shows the offline notice and disables **Add voice**.
22. **App switching.** Before the flip every Account link still opens legacy. After the flip PR they open `account.bakerrang.com` from every app, the Launcher row, and the Story Book / Polyglot voice links. The apex is unchanged.
23. **Deploy mechanics.** An Account-only commit deploys only `web-account`; a `web/packages/**` commit deploys all seven; rollback and verify-live cover `web-account`.
24. **Rollback drill.** `rollback.yml` to the previous `web-account` revision succeeds; reverting the flip PR restores the legacy destination.

## STEP 13 — Privacy and network inspection

Use only the disposable account. In DevTools **Network**, record a HAR through the voice create/rename/delete flow and search it for the test voice name and description: they appear only in `POST/PATCH` request bodies, never in a URL. Voice samples appear only in the `POST /text/to/speech/v1/voice` multipart body to `api.bakerrang.com`. In **Application**, Local/Session Storage and IndexedDB are empty of Account data, Cache Storage lists shell assets only (no `/account/*`, `/text/*` or `/auth/*` entries), and the Account host's only cookie is `br_theme`. In **Elements**, a voice named `<b>x</b>` renders as text.

## STEP 14 — Legacy coexistence

Open `https://bakerrang.com/account` and the new host as the same disposable account.

- Rename a voice in the new app, reload legacy: the new name is there (legacy shows voices only, plus "Vault settings moved to Passwords." and no Supermarket or vault controls).
- Add a voice in the new app, reload legacy: it is listed.
- Delete a voice in legacy, reload the new app: it is gone.
- Confirm `https://bakerrang.com/supermarket` still loads (owner decision 2; removed at final cleanup).
- Known and accepted (R2): legacy **Update All** is last-write-wins over whole voices, so a *stale* legacy tab can revert a new-app rename. Reload legacy before using it.

## STEP 15 — Registry cutover PR

After direct-host acceptance, make a separate reviewed PR changing only Account's registry record:

```js
export const ACCOUNT_DEFINITION = Object.freeze({
  id: 'account', /* unchanged fields */ legacyPath: '/account', liveUrl: 'https://account.bakerrang.com'
})
```

Update the registry test's expected Account URL. Do **not** remove `legacyPath:'/account'`; do **not** delete the legacy Account page; do not change any tool, the Launcher tile set, or the apex mapping. The flip redeploys all seven web apps with no other behavior change.

## STEP 16 — Post-cutover smoke

From every app's avatar menu, every app switcher's **Account** item, the Launcher "Your account" row, and the Story Book and Polyglot "Set up a voice in Account" / "Manage voices in Account" links, confirm the destination is `https://account.bakerrang.com`. Confirm sibling destinations are unchanged and `https://bakerrang.com/account` still works directly. Run the public verification workflow once:

```powershell
gh workflow run verify-live.yml --repo $GitHubRepo
```

## STEP 17 — Rollback

For a bad Account image, use the standard protected workflow with a reviewed exact target:

```powershell
gh workflow run rollback.yml --repo $GitHubRepo `
  -f service=web-account -f mechanism=image -f target=<full-lowercase-40-character-good-sha>
```

For a cutover problem, revert only the flip PR so the registry sends users back to legacy; legacy Account still manages voices. For a shared-package problem, revert the `web-theme` change independently (the fixes are additive and `persistence` is an extra context field). Revert the server change only after the flip PR is reverted and the new app is no longer in use; the extracted app depends on the hardened voice routes and the `account` OAuth target. **Data needs nothing:** `consentConfirmedAt`, `createdAt` and `updatedAt` on voice documents are additive and ignored by legacy; there is no data migration to undo.

## FINAL EXPECTED STATE

- `bakerrang-web-account` serves an immutable Account image under the frontend runtime identity, is independently verifiable and rollbackable, and is mapped and certified at `account.bakerrang.com`.
- `ACCOUNT_DOMAIN` is additive on the API; CORS is exact; every `/account`, `/auth/check`, `/auth/csrf` and voice-management response is `no-store`.
- Before the flip PR, `account.liveUrl` remains `null`; after it, every avatar menu, switcher, the Launcher row, and the Story Book / Polyglot voice links open the Account host.
- **Until the final cleanup:** the legacy Account page (voices) stays reachable by URL; the legacy `/supermarket` page and `/supermarket/licenses` backend remain; the Firestore `licenses` collection stays dormant; the legacy `PUT /text/to/speech/v1/voices` ("Update All"), the legacy `GET /auth/logout`, the legacy `ThemeProvider`'s `localStorage` key, and voice `consent` enforcement are removed at the final cleanup (R8). Account deletion and data export remain unavailable (R3) and "sign out everywhere" is deferred (R4).
