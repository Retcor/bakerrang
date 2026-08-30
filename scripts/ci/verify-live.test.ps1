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
$forbiddenGcloudMutation = "'(?:update|deploy|delete|create|replace|set|add|remove|update-traffic)'"
if ($source -match $forbiddenGcloudMutation) {
    throw "verify-live.ps1 contains a forbidden gcloud mutation verb: $($Matches[0])"
}

Write-Output 'verify-live traffic and read-only command tests passed.'
