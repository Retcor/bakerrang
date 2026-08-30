param(
    [string]$Service,
    [string]$Mechanism,
    [string]$Target,
    [switch]$ValidateOnly
)

# Import pure traffic interpretation, fixed service identities and HTTP assertions.
# Dot-sourcing does NOT execute the all-service verification entrypoint.
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'verify-live.ps1')

function Get-RollbackRequest {
    param([string]$LogicalService, [string]$Method, [string]$Value)

    if (@('api', 'portal', 'renderer', 'client') -cnotcontains $LogicalService) {
        throw 'Select exactly one supported service: api, portal, renderer, client.'
    }
    if (@('image', 'revision') -cnotcontains $Method) { throw 'Mechanism must be image or revision.' }
    $config = $Services | Where-Object { $_.Logical -ceq $LogicalService }
    if ($Method -ceq 'image') {
        if ($Value -cnotmatch '\A[0-9a-f]{40}\z') { throw 'Image target must be an exact full lowercase 40-character git SHA.' }
    }
    else {
        $shape = '\A' + [regex]::Escape($config.Service) + '-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\z'
        if ($Value.Length -gt 63 -or $Value -cnotmatch $shape) {
            throw 'Revision target must be an exact revision name for the selected service (at most 63 characters).'
        }
    }
    return [pscustomobject]@{ Config = $config; Mechanism = $Method; Target = $Value }
}

function Read-RollbackService {
    param($Config)
    return Invoke-GcloudJson -Arguments @(
        'run', 'services', 'describe', $Config.Service, '--project', $Project, '--region', $Region,
        '--format=json(metadata.name,status.latestReadyRevisionName,status.latestCreatedRevisionName,status.conditions,status.traffic,status.url,spec.traffic,spec.template.spec.serviceAccountName)'
    )
}

function Get-RollbackTraffic {
    param($State)
    return Get-TrafficAnalysis -SpecTraffic @($State.spec.traffic) -StatusTraffic @($State.status.traffic) `
        -LatestReadyRevision $State.status.latestReadyRevisionName
}

function Assert-ImageTraffic {
    param($State, [switch]$AfterUpdate)
    $analysis = Get-RollbackTraffic $State
    if ($analysis.Mode -cne 'LATEST' -or @($State.spec.traffic).Count -ne 1) {
        $context = if ($AfterUpdate) { 'Image rollback post-check failed' } else { 'Image rollback was not performed' }
        throw "${context}: traffic is not in normal LATEST mode ($($analysis.Mode)). No automatic unpin; see docs/operations/rollback.md."
    }
}

function Read-RollbackRevision {
    param($Config, [string]$RevisionName)
    return Invoke-GcloudJson -Arguments @(
        'run', 'revisions', 'describe', $RevisionName, '--project', $Project, '--region', $Region,
        '--format=json(metadata.name,metadata.labels,spec.containers[0].image,spec.serviceAccountName,status.conditions)'
    )
}

function Assert-RollbackRevision {
    param($Config, $Revision, [string]$RevisionName, [switch]$AllowUnready)
    if ($Revision.metadata.name -cne $RevisionName -or
        (Get-PropertyValue $Revision.metadata.labels 'serving.knative.dev/service') -cne $Config.Service) {
        throw 'Revision does not belong to the selected service.'
    }
    if (-not $AllowUnready -and -not (Test-ReadyCondition @($Revision.status.conditions))) { throw "Revision $RevisionName is not Ready." }
    if ($Revision.spec.serviceAccountName -cne $Config.ExpectedSa) { throw "Revision $RevisionName runtime SA differs from expected." }
    if (@($Revision.spec.containers).Count -ne 1 -or -not $Revision.spec.containers[0].image) {
        throw "Revision $RevisionName must have one readable serving image."
    }
}

function Resolve-RollbackImage {
    param($Request)
    $package = "$ArtifactRoot/$($Request.Config.Package)"
    $taggedImage = "${package}:git-$($Request.Target)"
    $record = Invoke-GcloudJson -Arguments @(
        'artifacts', 'docker', 'images', 'describe', $taggedImage, '--project', $Project,
        '--format=json(image_summary.digest,image_summary.fully_qualified_digest)'
    )
    $digest = $record.image_summary.digest
    if ($digest -cnotmatch '\Asha256:[a-f0-9]{64}\z') { throw 'Rollback image digest is missing or malformed.' }
    $image = "${package}@${digest}"
    if ($record.image_summary.fully_qualified_digest -cne $image) {
        throw 'Resolved image package/digest does not match the selected service.'
    }
    return [pscustomobject]@{ Image = $image; Digest = $digest }
}

function Resolve-RollbackRevision {
    param($Request)
    $revisions = @(Invoke-GcloudJson -Arguments @(
        'run', 'revisions', 'list', '--service', $Request.Config.Service,
        '--project', $Project, '--region', $Region, '--format=json(metadata.name)'
    ))
    if (@($revisions | Where-Object { $_.metadata.name -ceq $Request.Target }).Count -ne 1) {
        throw 'Target revision was not found in the selected service revision list.'
    }
    $revision = Read-RollbackRevision $Request.Config $Request.Target
    Assert-RollbackRevision $Request.Config $revision $Request.Target
    return $revision
}

function Assert-RollbackPostState {
    param($Request, $State, $Revision, [string]$ExpectedRevision, [string]$ExpectedImage)
    $analysis = Get-RollbackTraffic $State
    if ($Request.Mechanism -ceq 'image') {
        if (-not (Test-ReadyCondition @($State.status.conditions))) { throw 'Service is not Ready after rollback.' }
        Assert-ImageTraffic $State -AfterUpdate
        if ($State.status.latestReadyRevisionName -cne $ExpectedRevision -or
            $State.status.latestCreatedRevisionName -cne $ExpectedRevision) {
            throw 'The revision returned by image update is not the latest created and ready revision.'
        }
    }
    elseif ($analysis.Mode -cne 'PINNED') { throw 'Revision rollback must leave a 100 percent explicit PINNED target.' }
    if (@($analysis.ServingRevisions).Count -ne 1 -or $analysis.ServingRevisions[0] -cne $ExpectedRevision) {
        throw 'Rollback target is not the sole actual serving revision.'
    }
    Assert-RollbackRevision $Request.Config $Revision $ExpectedRevision
    if ($Revision.spec.containers[0].image -cne $ExpectedImage) { throw 'Serving image differs from the expected rollback image/digest.' }
}

function Write-RollbackSummary {
    param([string]$Heading, [System.Collections.IDictionary]$Fields)
    $lines = @("## $Heading", '')
    foreach ($key in $Fields.Keys) { $lines += "- ${key}: $($Fields[$key])" }
    $lines += ''
    $text = $lines -join "`n"
    Write-Host $text
    if ($env:GITHUB_STEP_SUMMARY) { Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $text -Encoding utf8 }
}

function Invoke-RollbackMutation {
    param([string[]]$Arguments)
    # gcloud reports deployment progress on stderr even with --quiet. Keep it
    # separate from the projected stdout revision name; never parse merged output.
    $output = & $script:GcloudCommand @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Cloud Run mutation failed; inspect current serving state before retrying.' }
    return ($output -join [Environment]::NewLine).Trim()
}

function Write-RollbackPinWarning {
    param([string]$RevisionName)
    $warning = "REVISION ROLLBACK ACTIVE (if the traffic operation completed): traffic is explicitly pinned to $RevisionName. Normal future image deployments may create new revisions receiving 0% traffic. Explicitly restore traffic to latest only after corrective code/config is ready. See docs/operations/rollback.md."
    Write-Warning $warning
    Write-Host "::warning::$warning"
    if ($env:GITHUB_STEP_SUMMARY) {
        Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value "`n> **$warning**`n" -Encoding utf8
    }
}

function Invoke-RollbackSmoke {
    param($Config, [string]$ServiceUrl)
    $checks = @{
        api = @{ Path = '/health'; Public = 'https://api.bakerrang.com/health'; Assertion = 'Healthy' }
        portal = @{ Path = '/'; Public = 'https://portal.bakerrang.com/'; Assertion = 'StatusOnly' }
        renderer = @{ Path = '/robots.txt'; Public = 'https://sites.bakerrang.com/robots.txt'; Assertion = 'UserAgent' }
        client = @{ Path = '/'; Public = 'https://bakerrang.com/'; Assertion = 'ClientRoot' }
    }
    $uri = $null
    if (-not [uri]::TryCreate($ServiceUrl, [UriKind]::Absolute, [ref]$uri) -or
        $uri.Scheme -cne 'https' -or -not $uri.Host -or $uri.UserInfo -or $uri.Query -or $uri.Fragment) {
        throw 'Cloud Run status.url is empty, malformed or not HTTPS.'
    }
    $check = $checks[$Config.Logical]
    # Shared assertions from verify-live.ps1 match normal deployment's markers.
    $cloud = Test-PublicEndpoint -Name "$($Config.Logical) Cloud Run" -Url ($ServiceUrl.TrimEnd('/') + $check.Path) -Assertion $check.Assertion
    $public = Test-PublicEndpoint -Name "$($Config.Logical) public" -Url $check.Public -Assertion $check.Assertion
    return [pscustomobject]@{ Cloud = $cloud; Public = $public }
}

function Invoke-MainRollback {
    param($Request)
    if ($env:GITHUB_REF -cne 'refs/heads/main' -or $env:GITHUB_EVENT_NAME -cne 'workflow_dispatch') {
        throw 'Rollback requires a workflow_dispatch on refs/heads/main.'
    }
    $config = $Request.Config
    $result = [ordered]@{
        Service = $config.Service; Mechanism = $Request.Mechanism; Target = $Request.Target
        'Previous serving revision' = 'unavailable'; 'New/current serving revision' = 'unverified'
        'Expected digest/revision' = 'unresolved'; 'Runtime SA' = 'unverified'; 'Traffic mode' = 'unverified'
        'Service Ready condition' = 'unverified'
        'Cloud Run smoke' = 'not run'; 'Public smoke' = 'not run'; Mutation = 'not attempted'; Outcome = 'FAILED'
    }
    $pinAttempted = $false
    try {
        $before = Read-RollbackService $config
        if ($before.metadata.name -cne $config.Service) { throw 'Described service does not match the rollback request.' }
        $traffic = Get-RollbackTraffic $before
        $previous = @($traffic.ServingRevisions | Sort-Object -Unique)
        $result['Previous serving revision'] = $previous -join ', '
        $currentRevisions = @($previous | ForEach-Object { Read-RollbackRevision $config $_ })
        Write-RollbackSummary 'ROLLBACK REQUEST' ([ordered]@{
            Service = $config.Service; Mechanism = $Request.Mechanism; Target = $Request.Target
            'Current serving revision' = $previous -join ', '
            'Current latest ready revision' = $before.status.latestReadyRevisionName
            'Current latest created revision' = $before.status.latestCreatedRevisionName
            'Traffic mode' = $traffic.Mode
            'Configured traffic' = ConvertTo-Json -InputObject @($before.spec.traffic) -Compress
            'Actual traffic' = ConvertTo-Json -InputObject @($before.status.traffic) -Compress
            'Current image' = ($currentRevisions | ForEach-Object { $_.spec.containers[0].image }) -join ', '
            'Current runtime SA' = ($currentRevisions | ForEach-Object { $_.spec.serviceAccountName }) -join ', '
            'Expected runtime SA' = $config.ExpectedSa
        })
        if ($Request.Mechanism -ceq 'image') { Assert-ImageTraffic $before }
        if ($traffic.Mode -ceq 'UNKNOWN' -or $previous.Count -eq 0) { throw 'Current traffic cannot be safely interpreted; rollback not performed.' }
        foreach ($entry in @($before.status.traffic)) {
            if ((Get-TrafficPercent $entry) -gt 0 -and -not $entry.revisionName) {
                throw 'A traffic-bearing entry has no resolved revision; rollback not performed.'
            }
        }
        # Recovery may be needed precisely because current serving code/config
        # is unhealthy. Require its identity, but require Ready on the target/post-state.
        for ($i = 0; $i -lt $previous.Count; $i++) {
            Assert-RollbackRevision $config $currentRevisions[$i] $previous[$i] -AllowUnready
        }

        if ($Request.Mechanism -ceq 'image') {
            # The image update retains the current template, so validate its identity too.
            if ($before.spec.template.spec.serviceAccountName -cne $config.ExpectedSa) {
                throw 'Current template runtime SA differs from expected; image rollback not performed.'
            }
            $resolved = Resolve-RollbackImage $Request
            $expectedImage = $resolved.Image
            $result['Expected digest/revision'] = $resolved.Digest
            $result.Mutation = 'image update attempted; verify state if the command fails'
            $expectedRevision = Invoke-RollbackMutation -Arguments @(
                'run', 'services', 'update', $config.Service, '--image', $expectedImage,
                '--project', $Project, '--region', $Region, '--quiet', '--format=value(status.latestCreatedRevisionName)'
            )
            # Capture the operation's revision, not whichever revision a later read happens to find.
            $null = Get-RollbackRequest $config.Logical 'revision' $expectedRevision
            if ($expectedRevision -ceq $before.status.latestCreatedRevisionName) {
                throw 'Image update did not create a new revision (possibly an unchanged image/template); inspect serving state.'
            }
        }
        else {
            $targetRevision = Resolve-RollbackRevision $Request
            $expectedImage = $targetRevision.spec.containers[0].image
            $expectedRevision = $Request.Target
            $result['Expected digest/revision'] = $expectedRevision
            $pinAttempted = $true
            Write-RollbackPinWarning $expectedRevision
            $result.Mutation = 'traffic pin attempted; verify state if the command fails'
            $null = Invoke-RollbackMutation -Arguments @(
                'run', 'services', 'update-traffic', $config.Service, '--to-revisions', "${expectedRevision}=100",
                '--project', $Project, '--region', $Region, '--quiet', '--format=value(status.latestReadyRevisionName)'
            )
        }
        $result.Mutation = 'completed'
        $after = Read-RollbackService $config
        if ($after.metadata.name -cne $config.Service) { throw 'Post-check described a different service.' }
        $postTraffic = Get-RollbackTraffic $after
        $result['Service Ready condition'] = Test-ReadyCondition @($after.status.conditions)
        $result['New/current serving revision'] = $postTraffic.ServingRevisions -join ', '
        $result['Traffic mode'] = $postTraffic.Mode
        $serving = Read-RollbackRevision $config $expectedRevision
        $result['Runtime SA'] = $serving.spec.serviceAccountName
        Assert-RollbackPostState $Request $after $serving $expectedRevision $expectedImage
        if ($Request.Mechanism -ceq 'revision' -and -not $result['Service Ready condition']) {
            Write-Warning 'Historical target is Ready, but the current service template/latest revision is not Ready. Repair it before unpinning.'
        }
        $smoke = Invoke-RollbackSmoke $config $after.status.url
        $result['Cloud Run smoke'] = if ($smoke.Cloud) { 'PASS' } else { 'FAIL' }
        $result['Public smoke'] = if ($smoke.Public) { 'PASS' } else { 'FAIL' }
        if (-not $smoke.Cloud -or -not $smoke.Public) { throw 'Selected-service smoke failed; inspect state before taking further action.' }
        $result.Outcome = 'PASSED'
    }
    finally {
        Write-RollbackSummary 'ROLLBACK RESULT' $result
        # Keep the sticky-state warning visible even if post-checks or HTTP checks fail.
        if ($pinAttempted) { Write-RollbackPinWarning $Request.Target }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    $request = Get-RollbackRequest $Service $Mechanism $Target
    if ($ValidateOnly) { Write-Host 'Rollback input validation passed (no cloud calls).'; exit 0 }
    $script:GcloudCommand = Get-Command gcloud -ErrorAction Stop
    Invoke-MainRollback $request
}
