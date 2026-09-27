# Budget — Phase F Operator Deployment Runbook

This runbook provisions, deploys, accepts, and cuts over the extracted BakerRang Budget application. Run it only from an approved, reviewed `main` commit. Commands are PowerShell and do not contain secrets.

## Targets

- Logical service: `web-budget`
- Cloud Run service: `bakerrang-web-budget`
- Public host: `https://budget.bakerrang.com`
- API: `bakerrang-api`
- Project / region: `avian-cable-379805` / `us-west1`
- Runtime service account: `bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com`

Until final cutover, `budget.liveUrl` remains `null`; Launcher and every app switcher still open `https://bakerrang.com/budget`. The legacy page remains available and the apex host is unchanged.

## STEP 0 — Set variables and confirm identity

```powershell
$ProjectId = "avian-cable-379805"
$Region = "us-west1"
$ApiService = "bakerrang-api"
$BudgetService = "bakerrang-web-budget"
$BudgetHost = "budget.bakerrang.com"
$BudgetBaseUrl = "https://budget.bakerrang.com"
$FrontendRuntimeSa = "bakerrang-frontend@$ProjectId.iam.gserviceaccount.com"
$GitHubEnvironment = "production"
$GitHubRepo = gh repo view --json nameWithOwner --jq .nameWithOwner

gcloud config get-value project
gcloud auth list --filter=status:ACTIVE --format="value(account)"
gh auth status
```

Expected: the project is `avian-cable-379805`, exactly one intended operator identity is active, and `$GitHubRepo` names this repository. Stop if any value is unexpected.

## STEP 1 — Add the production GitHub variables

```powershell
gh variable set WEB_BUDGET_SERVICE --env $GitHubEnvironment --body $BudgetService --repo $GitHubRepo
gh variable set BUDGET_BASE_URL --env $GitHubEnvironment --body $BudgetBaseUrl --repo $GitHubRepo
gh variable get WEB_BUDGET_SERVICE --env $GitHubEnvironment --repo $GitHubRepo
gh variable get BUDGET_BASE_URL --env $GitHubEnvironment --repo $GitHubRepo
```

Expected output:

```text
bakerrang-web-budget
https://budget.bakerrang.com
```

## STEP 2 — Add the API OAuth/CORS origin

PR 1 (the server implementation) must already be deployed. This additive update must not remove any existing environment variables.

```powershell
gcloud run services update $ApiService `
  --project $ProjectId `
  --region $Region `
  --update-env-vars "BUDGET_DOMAIN=$BudgetBaseUrl"

gcloud run services describe $ApiService `
  --project $ProjectId `
  --region $Region `
  --format="yaml(spec.template.spec.containers[0].env)"
```

Expected: `BUDGET_DOMAIN` is present with the exact public HTTPS origin; all existing variables remain.

## STEP 3 — Bootstrap the Cloud Run service

Use the current Sign image only to create the correctly shaped service. Normal CI replaces it with the Budget image in Step 6.

```powershell
$BootstrapImage = gcloud run services describe bakerrang-web-sign `
  --project $ProjectId --region $Region `
  --format="value(spec.template.spec.containers[0].image)"

gcloud run deploy $BudgetService `
  --project $ProjectId `
  --region $Region `
  --image $BootstrapImage `
  --service-account $FrontendRuntimeSa `
  --port 8080 `
  --allow-unauthenticated `
  --quiet

gcloud run services describe $BudgetService `
  --project $ProjectId --region $Region `
  --format="value(spec.template.spec.serviceAccountName)"
```

Expected: the service account is exactly `$FrontendRuntimeSa`.

## STEP 4 — Copy only scoped deployer IAM

```powershell
$ExistingFrontendIam = gcloud run services get-iam-policy bakerrang-web-sign `
  --project $ProjectId --region $Region --format=json | ConvertFrom-Json
$Deployers = @($ExistingFrontendIam.bindings | Where-Object role -ceq "roles/run.developer" | ForEach-Object members)

foreach ($Member in $Deployers) {
  gcloud run services add-iam-policy-binding $BudgetService `
    --project $ProjectId --region $Region `
    --member $Member --role roles/run.developer --quiet
}

gcloud run services get-iam-policy $BudgetService `
  --project $ProjectId --region $Region `
  --format="table(bindings.role,bindings.members)"
```

Expected: the same scoped `roles/run.developer` members as Sign. Do not grant a project-wide role.

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

Expected: API deploys only if server files changed; the classifier names the affected web services. The `web-budget` job finishes successfully with an immutable digest, unchanged runtime identity, and passing shell smoke.

## STEP 7 — Verify the unmapped `run.app` service

```powershell
$BudgetRunUrl = gcloud run services describe $BudgetService `
  --project $ProjectId --region $Region --format="value(status.url)"

$Shell = Invoke-WebRequest "$BudgetRunUrl/"
$Plan = Invoke-WebRequest "$BudgetRunUrl/plan"
$Month = Invoke-WebRequest "$BudgetRunUrl/month/2026-09"
$Nope = Invoke-WebRequest "$BudgetRunUrl/nope"
$Manifest = Invoke-RestMethod "$BudgetRunUrl/manifest.webmanifest"
$Sw = Invoke-WebRequest "$BudgetRunUrl/sw.js"

$Shell.StatusCode
$Shell.Content.Contains('<div id="root"')
$Plan.StatusCode; $Month.StatusCode; $Nope.StatusCode
$Manifest.name
$Sw.StatusCode
```

Expected: all routes return 200 and the SPA shell, the manifest name is `Budget — BakerRang`, and `sw.js` returns 200.

## STEP 8 — Verify API CORS, auth, and privacy headers

```powershell
$Headers = @{ Origin = $BudgetBaseUrl }
try { Invoke-WebRequest "https://api.bakerrang.com/budget/plan" -Headers $Headers } catch { $Response = $_.Exception.Response }
$Response.StatusCode.value__
$Response.Headers['Access-Control-Allow-Origin']
$Response.Headers['Access-Control-Allow-Credentials']
$Response.Headers['Cache-Control']
```

Expected: unauthenticated GET is 401, allow-origin echoes `https://budget.bakerrang.com`, credentials are allowed, and cache-control is `no-store`. Repeat as an OPTIONS preflight for a mutating route and confirm the same exact origin.

## STEP 9 — Create only the Budget domain mapping

```powershell
gcloud beta run domain-mappings create `
  --service $BudgetService `
  --domain $BudgetHost `
  --project $ProjectId `
  --region $Region
```

Expected: a mapping for `budget.bakerrang.com` only. Never map the apex.

## STEP 10 — Read the required DNS records

```powershell
gcloud beta run domain-mappings describe `
  --domain $BudgetHost --project $ProjectId --region $Region `
  --format="yaml(status.resourceRecords,status.conditions)"
```

Add or replace only the exact Budget-host record shown by Google. Review the current DNS record before mutation; do not touch any sibling host.

## STEP 11 — Wait for certificate readiness

```powershell
do {
  $Ready = gcloud beta run domain-mappings describe `
    --domain $BudgetHost --project $ProjectId --region $Region `
    --format="value(status.conditions[0].status)"
  Write-Host "Budget mapping Ready: $Ready"
  if ($Ready -ne "True") { Start-Sleep -Seconds 20 }
} until ($Ready -eq "True")
```

Expected: `Budget mapping Ready: True` and a valid browser certificate for the host.

## STEP 12 — Direct-host acceptance (checks 1–15)

1. Open `/`, `/plan`, `/month/2026-10`, and `/nope`; confirm the SPA shell and in-app not-found copy.
2. Signed out: confirm Welcome, labelled Example, ghost bar Sign in, and gold `Sign in with Google`; OAuth returns to Budget.
3. Signed in: compare every existing payday and bill count with the legacy page; issue rows remain visible in Plan.
4. Compare current and next-month Paychecks/Bills/Net with legacy, documenting only the four approved deliberate differences.
5. Add a biweekly payday, bill, debt with last payment, and one-off; edit `1,234.5`; delete the one-off and a pinned payday; reload.
6. Confirm `-5`, `1.234`, `1e3`, day 32, blank name, and `javascript:alert(1)` are blocked with field copy.
7. Reproduce the approved September 2026 fixture: $4,660.00 / $2,444.64 / +$2,215.36 and Tutoring Short $30.00.
8. At 1280–1600 px in Chrome, Firefox, and Safari, confirm aligned bands, rules, and the single money column.
9. At 360–430 px on real iOS Safari and Android Chrome, confirm no horizontal scroll, 44 px targets, reachable Save, and the hidden statement/Add bar while editing.
10. Check light, dark, and system themes with no flash. Gold is used only for Add.
11. Keyboard and screen-reader sanity: row/editor focus, Escape return, confirm delete, nav, listbox/radio keys, captions, Short and signed Net.
12. DevTools privacy/network check is Step 13.
13. In two tabs, confirm stale same-entry save produces the conflict copy and different-entry saves both survive.
14. Legacy coexistence is Step 14.
15. After a loaded session, go offline: reading remains, the offline notice appears, and Save is disabled. A cold offline start shows Welcome.

## STEP 13 — Privacy and network inspection

In DevTools Network, filter `budget`. Confirm every `/budget/*` request has no query string, mutations carry cents in JSON bodies, and every response including errors has `Cache-Control: no-store`. In Application, confirm Budget wrote no plan data to Local Storage, Session Storage, IndexedDB, or Cache Storage; the service worker cache contains shell assets only.

## STEP 14 — Legacy coexistence

Open `https://bakerrang.com/budget` and the new host as the same account. Edit an amount in legacy, then reload or return to Budget after at least 60 seconds and confirm it appears. Edit the same bill in both tabs: save legacy first, then confirm the new app gets the conflict message and `Use latest` loads the server version. Save a first/last-day bill in legacy and confirm it remains scheduled. Legacy Add must still work.

## STEP 15 — Registry cutover PR

After direct-host acceptance, make a separate reviewed PR changing only Budget's registry record:

```js
{ id: 'budget', /* unchanged fields */, legacyPath: '/budget', liveUrl: 'https://budget.bakerrang.com' }
```

Update the registry test's expected Budget URL. Do **not** remove `legacyPath:'/budget'`; do **not** delete the legacy page; do not change Story Book, Polyglot, Sign, or the apex mapping.

## STEP 16 — Post-cutover smoke

From Launcher and from the app switchers in Story Book, Polyglot, Sign, and Budget, open Budget and confirm the destination is `https://budget.bakerrang.com`. Confirm Story Book, Polyglot, and Sign destinations are unchanged, and `https://bakerrang.com/budget` still works directly.

## STEP 17 — Rollback

For a bad Budget image, use the standard protected workflow with a reviewed exact target:

```powershell
gh workflow run rollback.yml --repo $GitHubRepo `
  -f service=web-budget -f mechanism=image -f target=<full-lowercase-40-character-good-sha>
```

For a cutover problem, revert only PR 3 so the registry sends users back to legacy. Revert the server PR only after the cutover PR is reverted; the extracted app depends on `/budget/plan`. No data rollback or migration is required because storage stays legacy-shaped.

## FINAL EXPECTED STATE

- `bakerrang-web-budget` serves an immutable Budget image under the frontend runtime identity.
- `budget.bakerrang.com` is mapped, certified, accepted, and independently verifiable/rollbackable.
- `BUDGET_DOMAIN` is additive on the API; CORS is exact and Budget responses are `no-store`.
- Before the final registry PR, `budget.liveUrl` remains `null`; after it, Launcher and all switchers open the Budget host.
- The legacy `/budget` page and apex remain available; Story Book, Polyglot, and Sign remain unchanged.
