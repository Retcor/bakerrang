$ErrorActionPreference = 'Stop'

. (Join-Path (Split-Path -Parent $PSScriptRoot) 'verify-live.ps1')

function Assert-Equal {
    param(
        [Parameter(Mandatory)]$Actual,
        [Parameter(Mandatory)]$Expected,
        [Parameter(Mandatory)][string]$Message
    )

    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected', received '$Actual'."
    }
}

function New-StatusTarget {
    param(
        [Parameter(Mandatory)][string]$Revision,
        [Parameter(Mandatory)][int]$Percent
    )
    return [pscustomobject]@{ revisionName = $Revision; percent = $Percent }
}

$latest = 'bakerrang-api-00042-abc'

$dynamicLatest = Get-TrafficAnalysis `
    -SpecTraffic @([pscustomobject]@{ latestRevision = $true; percent = 100 }) `
    -StatusTraffic @((New-StatusTarget -Revision $latest -Percent 100)) `
    -LatestReadyRevision $latest
Assert-Equal $dynamicLatest.Mode 'LATEST' 'A: symbolic latest at 100 percent must be LATEST.'

$explicitLatest = Get-TrafficAnalysis `
    -SpecTraffic @([pscustomobject]@{ revisionName = $latest; percent = 100 }) `
    -StatusTraffic @((New-StatusTarget -Revision $latest -Percent 100)) `
    -LatestReadyRevision $latest
Assert-Equal $explicitLatest.Mode 'PINNED' 'B: explicit latest-ready revision must still be PINNED.'

$older = 'bakerrang-api-00041-old'
$explicitOlder = Get-TrafficAnalysis `
    -SpecTraffic @([pscustomobject]@{ revisionName = $older; percent = 100 }) `
    -StatusTraffic @((New-StatusTarget -Revision $older -Percent 100)) `
    -LatestReadyRevision $latest
Assert-Equal $explicitOlder.Mode 'PINNED' 'C: explicit older revision must be PINNED.'

$split = Get-TrafficAnalysis `
    -SpecTraffic @(
        [pscustomobject]@{ revisionName = $older; percent = 50 },
        [pscustomobject]@{ revisionName = $latest; percent = 50 }
    ) `
    -StatusTraffic @(
        (New-StatusTarget -Revision $older -Percent 50),
        (New-StatusTarget -Revision $latest -Percent 50)
    ) `
    -LatestReadyRevision $latest
Assert-Equal $split.Mode 'SPLIT' 'D: two 50/50 targets must be SPLIT.'

$malformed = Get-TrafficAnalysis `
    -SpecTraffic @([pscustomobject]@{ latestRevision = $true }) `
    -StatusTraffic @((New-StatusTarget -Revision $latest -Percent 100)) `
    -LatestReadyRevision $latest
Assert-Equal $malformed.Mode 'UNKNOWN' 'E: malformed traffic must fail closed as UNKNOWN.'

$source = Get-Content -Raw (Join-Path (Split-Path -Parent $PSScriptRoot) 'verify-live.ps1')
$launcher = @($Services | Where-Object { $_.Logical -ceq 'web-launcher' })
$storybook = @($Services | Where-Object { $_.Logical -ceq 'web-storybook' })
$polyglot = @($Services | Where-Object { $_.Logical -ceq 'web-polyglot' })
$sign = @($Services | Where-Object { $_.Logical -ceq 'web-sign' })
$budget = @($Services | Where-Object { $_.Logical -ceq 'web-budget' })
$passwords = @($Services | Where-Object { $_.Logical -ceq 'web-passwords' })
Assert-Equal $Services.Count 10 'Live verification must cover every production deployment target.'
Assert-Equal $launcher.Count 1 'Web Launcher must have exactly one live-service mapping.'
Assert-Equal $launcher[0].Service 'bakerrang-web-launcher' 'Web Launcher physical service mapping is wrong.'
Assert-Equal $launcher[0].Package 'web-launcher' 'Web Launcher Artifact Registry package mapping is wrong.'
Assert-Equal $launcher[0].ExpectedSa 'bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' 'Web Launcher runtime identity mapping is wrong.'
Assert-Equal $storybook.Count 1 'Web Story Book must have exactly one live-service mapping.'
Assert-Equal $storybook[0].Service 'bakerrang-web-storybook' 'Web Story Book physical service mapping is wrong.'
Assert-Equal $storybook[0].Package 'web-storybook' 'Web Story Book Artifact Registry package mapping is wrong.'
Assert-Equal $storybook[0].ExpectedSa 'bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' 'Web Story Book runtime identity mapping is wrong.'
Assert-Equal $polyglot.Count 1 'Web Polyglot must have exactly one live-service mapping.'
Assert-Equal $polyglot[0].Service 'bakerrang-web-polyglot' 'Web Polyglot physical service mapping is wrong.'
Assert-Equal $polyglot[0].Package 'web-polyglot' 'Web Polyglot Artifact Registry package mapping is wrong.'
Assert-Equal $polyglot[0].ExpectedSa 'bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' 'Web Polyglot runtime identity mapping is wrong.'
Assert-Equal $sign.Count 1 'Web Sign must have exactly one live-service mapping.'
Assert-Equal $sign[0].Service 'bakerrang-web-sign' 'Web Sign physical service mapping is wrong.'
Assert-Equal $sign[0].Package 'web-sign' 'Web Sign Artifact Registry package mapping is wrong.'
Assert-Equal $sign[0].ExpectedSa 'bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' 'Web Sign runtime identity mapping is wrong.'
Assert-Equal $budget.Count 1 'Web Budget must have exactly one live-service mapping.'
Assert-Equal $budget[0].Service 'bakerrang-web-budget' 'Web Budget physical service mapping is wrong.'
Assert-Equal $budget[0].Package 'web-budget' 'Web Budget Artifact Registry package mapping is wrong.'
Assert-Equal $budget[0].ExpectedSa 'bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' 'Web Budget runtime identity mapping is wrong.'
Assert-Equal $passwords.Count 1 'Web Passwords must have exactly one live-service mapping.'
Assert-Equal $passwords[0].Service 'bakerrang-web-passwords' 'Web Passwords physical service mapping is wrong.'
Assert-Equal $passwords[0].Package 'web-passwords' 'Web Passwords Artifact Registry package mapping is wrong.'
Assert-Equal $passwords[0].ExpectedSa 'bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' 'Web Passwords runtime identity mapping is wrong.'
if ($source -notmatch "https://launch\.bakerrang\.com/'; Assertion = 'ClientRoot'") {
    throw 'verify-live.ps1 is missing the fixed Web Launcher public SPA-shell check.'
}
if ($source -notmatch "https://storybook\.bakerrang\.com/'; Assertion = 'ClientRoot'") {
    throw 'verify-live.ps1 is missing the fixed Web Story Book public SPA-shell check.'
}
if ($source -notmatch "https://polyglot\.bakerrang\.com/'; Assertion = 'ClientRoot'") {
    throw 'verify-live.ps1 is missing the fixed Web Polyglot public SPA-shell check.'
}
if ($source -notmatch "https://passwords\.bakerrang\.com/'; Assertion = 'PasswordsHeaders'") {
    throw 'verify-live.ps1 is missing the fixed Web Passwords header check.'
}
$forbiddenGcloudMutation = "'(?:update|deploy|delete|create|replace|set|add|remove|update-traffic)'"
if ($source -match $forbiddenGcloudMutation) {
    throw "verify-live.ps1 contains a forbidden gcloud mutation verb: $($Matches[0])"
}

Write-Output 'verify-live traffic and read-only command tests passed.'
