param(
    [switch]$Deep
)

$ErrorActionPreference = 'Stop'

$Project = 'avian-cable-379805'
$Region = 'us-west1'
$ArtifactRoot = 'us-west1-docker.pkg.dev/avian-cable-379805/bakerrang'
$Services = @(
    [pscustomobject]@{ Logical = 'api'; Service = 'bakerrang-api'; Package = 'api'; ExpectedSa = 'bakerrang-api@avian-cable-379805.iam.gserviceaccount.com' },
    [pscustomobject]@{ Logical = 'portal'; Service = 'bakerrang-portal'; Package = 'portal'; ExpectedSa = 'bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' },
    [pscustomobject]@{ Logical = 'renderer'; Service = 'bakerrang-site-renderer'; Package = 'site-renderer'; ExpectedSa = 'bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' },
    [pscustomobject]@{ Logical = 'client'; Service = 'bakerrang-client'; Package = 'client'; ExpectedSa = 'bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' }
)

function Get-PropertyValue {
    param(
        [object]$InputObject,
        [Parameter(Mandatory)][string]$Name
    )

    if ($null -eq $InputObject) { return $null }
    $property = $InputObject.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-TrafficPercent {
    param([object]$Entry)

    $value = Get-PropertyValue -InputObject $Entry -Name 'percent'
    if ($null -eq $value) { throw 'Traffic entry is missing percent.' }
    $percent = 0
    if (-not [int]::TryParse("$value", [ref]$percent) -or $percent -lt 0 -or $percent -gt 100) {
        throw "Traffic entry has invalid percent: $value"
    }
    return $percent
}

function Get-TrafficAnalysis {
    param(
        [object[]]$SpecTraffic,
        [object[]]$StatusTraffic,
        [string]$LatestReadyRevision
    )

    try {
        $specEntries = @($SpecTraffic | Where-Object { $null -ne $_ })
        $statusEntries = @($StatusTraffic | Where-Object { $null -ne $_ })
        if ($specEntries.Count -eq 0 -or $statusEntries.Count -eq 0) {
            throw 'Traffic entries are absent.'
        }

        $specBearing = @($specEntries | Where-Object { (Get-TrafficPercent $_) -gt 0 })
        $statusBearing = @($statusEntries | Where-Object { (Get-TrafficPercent $_) -gt 0 })
        if ($specBearing.Count -eq 0 -or $statusBearing.Count -eq 0) {
            throw 'No traffic-bearing target exists.'
        }

        if ($specBearing.Count -gt 1 -or $statusBearing.Count -gt 1) {
            return [pscustomobject]@{ Mode = 'SPLIT'; Reason = 'Multiple traffic-bearing targets.'; ServingRevisions = @($statusBearing | ForEach-Object { Get-PropertyValue $_ 'revisionName' } | Where-Object { $_ }) }
        }

        $specTarget = $specBearing[0]
        $statusTarget = $statusBearing[0]
        $specPercent = Get-TrafficPercent $specTarget
        $statusPercent = Get-TrafficPercent $statusTarget
        if ($specPercent -ne 100 -or $statusPercent -ne 100) {
            return [pscustomobject]@{ Mode = 'SPLIT'; Reason = 'Traffic distribution is not exactly 100 percent.'; ServingRevisions = @((Get-PropertyValue $statusTarget 'revisionName') | Where-Object { $_ }) }
        }

        $latestValue = Get-PropertyValue $specTarget 'latestRevision'
        $isLatest = $latestValue -is [bool] -and $latestValue
        $explicitRevision = "$(Get-PropertyValue $specTarget 'revisionName')".Trim()
        $servingRevision = "$(Get-PropertyValue $statusTarget 'revisionName')".Trim()
        if (-not $servingRevision) { throw 'Serving traffic entry has no revisionName.' }

        if ($isLatest -and $explicitRevision) {
            throw 'Traffic target contains both latestRevision and revisionName.'
        }
        if ($isLatest) {
            if (-not $LatestReadyRevision -or $servingRevision -ne $LatestReadyRevision) {
                throw 'Dynamic latest traffic does not resolve to latestReadyRevisionName.'
            }
            return [pscustomobject]@{ Mode = 'LATEST'; Reason = 'One 100 percent symbolic latest target.'; ServingRevisions = @($servingRevision) }
        }
        if ($explicitRevision) {
            if ($servingRevision -ne $explicitRevision) {
                throw 'Explicit traffic target does not match serving status.'
            }
            return [pscustomobject]@{ Mode = 'PINNED'; Reason = 'One explicit revision target receives 100 percent.'; ServingRevisions = @($servingRevision) }
        }

        throw 'Traffic target is neither symbolic latest nor an explicit revision.'
    }
    catch {
        return [pscustomobject]@{ Mode = 'UNKNOWN'; Reason = $_.Exception.Message; ServingRevisions = @() }
    }
}

function Invoke-GcloudText {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $output = & $script:GcloudCommand @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed: gcloud $($Arguments -join ' ')`n$($output -join [Environment]::NewLine)"
    }
    return ($output -join [Environment]::NewLine).Trim()
}

function Invoke-GcloudJson {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $text = Invoke-GcloudText -Arguments $Arguments
    if (-not $text) { throw "gcloud returned no JSON: gcloud $($Arguments -join ' ')" }
    try {
        return $text | ConvertFrom-Json
    }
    catch {
        throw "gcloud returned invalid JSON: gcloud $($Arguments -join ' ')"
    }
}

function Test-ReadyCondition {
    param([object[]]$Conditions)

    $ready = @($Conditions | Where-Object { (Get-PropertyValue $_ 'type') -eq 'Ready' })
    return $ready.Count -eq 1 -and "$(Get-PropertyValue $ready[0] 'status')" -eq 'True'
}

function Resolve-GitSha {
    param(
        [Parameter(Mandatory)][string]$Package,
        [Parameter(Mandatory)][string]$Image
    )

    $digestMatch = [regex]::Match($Image, '@(?<digest>sha256:[a-fA-F0-9]{64})$')
    if (-not $digestMatch.Success) {
        return [pscustomobject]@{ Sha = 'unknown'; Warning = 'Serving image is not digest-qualified.' }
    }

    $packageUri = "$ArtifactRoot/$Package"
    try {
        $records = @(Invoke-GcloudJson -Arguments @(
            'artifacts', 'docker', 'images', 'list', $packageUri,
            '--project', $Project,
            '--include-tags',
            '--format=json'
        ))
        $digest = $digestMatch.Groups['digest'].Value.ToLowerInvariant()
        $matchingRecords = @($records | Where-Object {
            "$(Get-PropertyValue $_ 'version')".ToLowerInvariant().EndsWith("@$digest")
        })
        $shas = @($matchingRecords | ForEach-Object {
            foreach ($tag in @((Get-PropertyValue $_ 'tags'))) {
                $tagMatch = [regex]::Match("$tag", '(?:^|:)git-(?<sha>[a-fA-F0-9]{40})$')
                if ($tagMatch.Success) { $tagMatch.Groups['sha'].Value.ToLowerInvariant() }
            }
        } | Sort-Object -Unique)
        if ($shas.Count -eq 1) {
            return [pscustomobject]@{ Sha = $shas[0]; Warning = $null }
        }
        if ($shas.Count -gt 1) {
            return [pscustomobject]@{ Sha = 'unknown'; Warning = "Multiple git SHA tags resolve to the serving digest in package $Package." }
        }
        return [pscustomobject]@{ Sha = 'unknown'; Warning = "No git-<SHA> tag resolves to the serving digest in package $Package." }
    }
    catch {
        return [pscustomobject]@{ Sha = 'unknown'; Warning = "Artifact Registry history could not be read for package ${Package}: $($_.Exception.Message)" }
    }
}

function Write-TrafficEntries {
    param(
        [object[]]$SpecTraffic,
        [object[]]$StatusTraffic
    )

    Write-Host '  Configured traffic entries:'
    foreach ($entry in @($SpecTraffic)) {
        $revision = "$(Get-PropertyValue $entry 'revisionName')".Trim()
        $isLatest = (Get-PropertyValue $entry 'latestRevision') -is [bool] -and (Get-PropertyValue $entry 'latestRevision')
        $tag = "$(Get-PropertyValue $entry 'tag')".Trim()
        $revisionDisplay = if ($revision) { $revision } else { '<resolved latest>' }
        $tagDisplay = if ($tag) { $tag } else { '-' }
        Write-Host "    revision=$revisionDisplay percent=$(Get-PropertyValue $entry 'percent') symbolicLatest=$isLatest tag=$tagDisplay"
    }
    Write-Host '  Actual traffic entries:'
    foreach ($entry in @($StatusTraffic)) {
        $tag = "$(Get-PropertyValue $entry 'tag')".Trim()
        $tagDisplay = if ($tag) { $tag } else { '-' }
        Write-Host "    revision=$(Get-PropertyValue $entry 'revisionName') percent=$(Get-PropertyValue $entry 'percent') tag=$tagDisplay"
    }
}

function Test-PublicEndpoint {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Url,
        [ValidateSet('Healthy', 'UserAgent', 'ClientRoot', 'StatusOnly')][string]$Assertion
    )

    try {
        # Windows PowerShell 5.1 does not load this assembly by default.
        Add-Type -AssemblyName System.Net.Http
        $handler = [System.Net.Http.HttpClientHandler]::new()
        $handler.AllowAutoRedirect = $true
        $client = [System.Net.Http.HttpClient]::new($handler)
        $client.Timeout = [TimeSpan]::FromSeconds(20)
        try {
            $response = $client.GetAsync($Url).GetAwaiter().GetResult()
            $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            $valid = [int]$response.StatusCode -eq 200
            if ($valid) {
                switch ($Assertion) {
                    'Healthy' { $valid = $body.Trim() -eq 'Healthy' }
                    'UserAgent' { $valid = $body -match '(?i)User-agent' }
                    'ClientRoot' { $valid = $body.Contains('<div id="root"') }
                }
            }
            $result = if ($valid) { 'PASS' } else { 'FAIL' }
            Write-Host ("  {0}: HTTP {1} {2}" -f $Name, [int]$response.StatusCode, $result)
            return $valid
        }
        finally {
            $client.Dispose()
            $handler.Dispose()
        }
    }
    catch {
        Write-Warning "$Name failed: $($_.Exception.Message)"
        return $false
    }
}

function Invoke-VerifyLive {
    param([switch]$DeepCheck)

    $script:GcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($null -eq $script:GcloudCommand) {
        Write-Error 'gcloud is required and was not found on PATH.'
        return 1
    }

    $failures = [System.Collections.Generic.List[string]]::new()
    try {
        $readProject = Invoke-GcloudText -Arguments @('projects', 'describe', $Project, '--format=value(projectId)')
        if ($readProject -ne $Project) { throw "Unexpected project response: $readProject" }
    }
    catch {
        Write-Error "Active gcloud credentials cannot read project ${Project}: $($_.Exception.Message)"
        return 1
    }

    Write-Host "BakerRang live serving-state verification ($Project / $Region)"
    foreach ($service in $Services) {
        Write-Host ''
        Write-Host "[$($service.Logical)] $($service.Service)"
        try {
            $serviceState = Invoke-GcloudJson -Arguments @(
                'run', 'services', 'describe', $service.Service,
                '--project', $Project,
                '--region', $Region,
                '--format=json(metadata.name,status.latestReadyRevisionName,status.latestCreatedRevisionName,status.conditions,status.traffic,spec.traffic)'
            )
            $latestReady = "$(Get-PropertyValue (Get-PropertyValue $serviceState 'status') 'latestReadyRevisionName')".Trim()
            $latestCreated = "$(Get-PropertyValue (Get-PropertyValue $serviceState 'status') 'latestCreatedRevisionName')".Trim()
            $conditions = @((Get-PropertyValue (Get-PropertyValue $serviceState 'status') 'conditions'))
            $specTraffic = @((Get-PropertyValue (Get-PropertyValue $serviceState 'spec') 'traffic'))
            $statusTraffic = @((Get-PropertyValue (Get-PropertyValue $serviceState 'status') 'traffic'))
            if (-not $latestReady) { throw 'latestReadyRevisionName is empty.' }
            if (-not (Test-ReadyCondition $conditions)) {
                $failures.Add("$($service.Service) is not Ready.")
            }

            $analysis = Get-TrafficAnalysis -SpecTraffic $specTraffic -StatusTraffic $statusTraffic -LatestReadyRevision $latestReady
            Write-Host "  latest ready:   $latestReady"
            Write-Host "  latest created: $latestCreated"
            Write-Host "  traffic mode:   $($analysis.Mode)"
            Write-TrafficEntries -SpecTraffic $specTraffic -StatusTraffic $statusTraffic

            switch ($analysis.Mode) {
                'PINNED' {
                    Write-Warning 'Traffic is explicitly pinned to a revision. Future image deployments may create a newer revision without moving traffic.'
                    $failures.Add("$($service.Service) traffic mode is PINNED.")
                }
                'SPLIT' {
                    Write-Warning 'Service uses a traffic split. Normal BakerRang deployment assumptions do not currently apply.'
                    $failures.Add("$($service.Service) traffic mode is SPLIT.")
                }
                'UNKNOWN' {
                    Write-Warning "Traffic cannot be safely interpreted: $($analysis.Reason)"
                    $failures.Add("$($service.Service) traffic mode is UNKNOWN.")
                }
            }

            foreach ($revisionName in @($analysis.ServingRevisions | Sort-Object -Unique)) {
                $revision = Invoke-GcloudJson -Arguments @(
                    'run', 'revisions', 'describe', $revisionName,
                    '--project', $Project,
                    '--region', $Region,
                    '--format=json(metadata.name,metadata.creationTimestamp,spec.containers[0].image,spec.serviceAccountName,status.conditions)'
                )
                $revisionSpec = Get-PropertyValue $revision 'spec'
                $containers = @((Get-PropertyValue $revisionSpec 'containers'))
                if ($containers.Count -ne 1) { throw "Revision $revisionName does not have exactly one container." }
                $image = "$(Get-PropertyValue $containers[0] 'image')".Trim()
                $runtimeSa = "$(Get-PropertyValue $revisionSpec 'serviceAccountName')".Trim()
                $created = "$(Get-PropertyValue (Get-PropertyValue $revision 'metadata') 'creationTimestamp')".Trim()
                $revisionReady = Test-ReadyCondition @((Get-PropertyValue (Get-PropertyValue $revision 'status') 'conditions'))
                $sha = Resolve-GitSha -Package $service.Package -Image $image
                $saMatches = $runtimeSa -eq $service.ExpectedSa

                Write-Host "  serving revision: $revisionName"
                Write-Host "    image:       $image"
                Write-Host "    SHA:         $($sha.Sha)"
                Write-Host "    runtime SA:  $runtimeSa"
                Write-Host "    expected SA: $($service.ExpectedSa)"
                Write-Host "    SA matches:  $saMatches"
                Write-Host "    created:     $created"
                Write-Host "    Ready:       $revisionReady"
                if ($sha.Warning) { Write-Warning $sha.Warning }
                if (-not $revisionReady) { $failures.Add("Serving revision $revisionName is not Ready.") }
                if (-not $saMatches) { $failures.Add("Serving revision $revisionName runtime service account differs from expected.") }
            }
        }
        catch {
            Write-Warning "$($service.Service) could not be verified: $($_.Exception.Message)"
            $failures.Add("$($service.Service) state could not be read.")
        }
    }

    Write-Host ''
    Write-Host 'Public ingress checks'
    $checks = @(
        @{ Name = 'API'; Url = 'https://api.bakerrang.com/health'; Assertion = 'Healthy' },
        @{ Name = 'Portal'; Url = 'https://portal.bakerrang.com/'; Assertion = 'StatusOnly' },
        @{ Name = 'Renderer'; Url = 'https://sites.bakerrang.com/robots.txt'; Assertion = 'UserAgent' },
        @{ Name = 'Client'; Url = 'https://bakerrang.com/'; Assertion = 'ClientRoot' }
    )
    if ($DeepCheck) {
        $checks += @{ Name = 'Custom domain'; Url = 'https://custom.bakerrang.com/'; Assertion = 'StatusOnly' }
    }
    foreach ($check in $checks) {
        if (-not (Test-PublicEndpoint @check)) { $failures.Add("$($check.Name) public check failed.") }
    }

    Write-Host ''
    if ($failures.Count -gt 0) {
        Write-Host 'LIVE VERIFICATION FAILED:' -ForegroundColor Red
        $failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        return 1
    }
    Write-Host 'LIVE VERIFICATION PASSED.' -ForegroundColor Green
    return 0
}

if ($MyInvocation.InvocationName -ne '.') {
    exit (Invoke-VerifyLive -DeepCheck:$Deep)
}
