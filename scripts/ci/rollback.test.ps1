$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'rollback.ps1')
$script:NativeMutation = ${function:Invoke-RollbackMutation}

# Every cloud and HTTP boundary is replaced. These tests never invoke gcloud,
# authenticate, access public endpoints, or write GitHub summaries.
$script:Passed = 0
function Assert-That {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}
function Assert-Throws {
    param([scriptblock]$Action, [string]$Pattern)
    try { & $Action } catch {
        if ($_.Exception.Message -notmatch $Pattern) { throw "Unexpected error: $($_.Exception.Message)" }
        return
    }
    throw "Expected failure matching $Pattern"
}
function Test-Case {
    param([string]$Name, [scriptblock]$Action)
    & $Action
    $script:Passed++
    Write-Host "PASS: $Name"
}
function Copy-Fixture {
    param($Value)
    return ConvertFrom-Json (ConvertTo-Json $Value -Depth 20)
}
function New-Revision {
    param([string]$Name, [string]$Image)
    return [pscustomobject]@{
        metadata = [pscustomobject]@{ name = $Name; labels = [pscustomobject]@{ 'serving.knative.dev/service' = 'bakerrang-api' } }
        spec = [pscustomobject]@{ containers = @([pscustomobject]@{ image = $Image }); serviceAccountName = $Services[0].ExpectedSa }
        status = [pscustomobject]@{ conditions = @([pscustomobject]@{ type = 'Ready'; status = 'True' }) }
    }
}
function Reset-Fixture {
    $script:Calls = [System.Collections.Generic.List[object]]::new()
    $script:Mutations = [System.Collections.Generic.List[object]]::new()
    $script:HttpCalls = [System.Collections.Generic.List[object]]::new()
    $script:Summaries = @{}
    $script:Warnings = @()
    $script:Mutated = $false
    $script:FailMutation = $false
    $script:FailAR = $false
    $script:FailPublic = $false
    $script:Sha = 'a' * 40
    $script:Digest = 'sha256:' + ('b' * 64)
    $script:Image = "$ArtifactRoot/api@$Digest"
    $script:PreviousName = 'bakerrang-api-00042-abc'
    $script:NewName = 'bakerrang-api-00043-new'
    $script:OldName = 'bakerrang-api-00041-old'
    $script:Before = [pscustomobject]@{
        metadata = [pscustomobject]@{ name = 'bakerrang-api' }
        spec = [pscustomobject]@{
            traffic = @([pscustomobject]@{ latestRevision = $true; percent = 100 })
            template = [pscustomobject]@{ spec = [pscustomobject]@{ serviceAccountName = $Services[0].ExpectedSa } }
        }
        status = [pscustomobject]@{
            latestReadyRevisionName = $PreviousName; latestCreatedRevisionName = $PreviousName
            traffic = @([pscustomobject]@{ revisionName = $PreviousName; percent = 100 })
            conditions = @([pscustomobject]@{ type = 'Ready'; status = 'True' })
            url = 'https://bakerrang-api-test-uw.a.run.app'
        }
    }
    $script:After = Copy-Fixture $Before
    $script:After.status.latestReadyRevisionName = $NewName
    $script:After.status.latestCreatedRevisionName = $NewName
    $script:After.status.traffic[0].revisionName = $NewName
    $script:Revisions = @{}
    $script:Revisions[$PreviousName] = New-Revision $PreviousName "$ArtifactRoot/api@sha256:$('c' * 64)"
    $script:Revisions[$NewName] = New-Revision $NewName $Image
    $script:Revisions[$OldName] = New-Revision $OldName $Image
    $script:RevisionList = @([pscustomobject]@{ metadata = [pscustomobject]@{ name = $OldName } })
    $script:AR = [pscustomobject]@{ image_summary = [pscustomobject]@{ digest = $Digest; fully_qualified_digest = $Image } }
    $env:GITHUB_REF = 'refs/heads/main'
    $env:GITHUB_EVENT_NAME = 'workflow_dispatch'
}
function Invoke-GcloudJson {
    param([string[]]$Arguments)
    $script:Calls.Add($Arguments)
    Assert-That ($Arguments -contains 'avian-cable-379805') 'Cloud request must use MAIN project.'
    switch ($Arguments[0..2] -join ' ') {
        'run services describe' {
            Assert-That ($Arguments[3] -ceq 'bakerrang-api') 'An unrelated service was inspected.'
            if ($script:Mutated) { return $script:After }
            return $script:Before
        }
        'run revisions describe' {
            if (-not $script:Revisions.ContainsKey($Arguments[3])) { throw 'Unknown fixture revision.' }
            return $script:Revisions[$Arguments[3]]
        }
        'run revisions list' {
            Assert-That ($Arguments[3] -ceq '--service' -and $Arguments[4] -ceq 'bakerrang-api') 'List must be service-scoped.'
            return $script:RevisionList
        }
        'artifacts docker images' {
            Assert-That ($Arguments[3] -ceq 'describe' -and $Arguments[4] -ceq "$ArtifactRoot/api`:git-$script:Sha") 'Only the selected exact git image tag may be resolved.'
            if ($script:FailAR) { throw 'Artifact Registry tag not found.' }
            return $script:AR
        }
        default { throw "Unexpected cloud read: $($Arguments -join ' ')" }
    }
}
function Invoke-RollbackMutation {
    param([string[]]$Arguments)
    $script:Mutations.Add($Arguments)
    Assert-That ($Arguments[0] -ceq 'run' -and $Arguments[1] -ceq 'services' -and $Arguments[3] -ceq 'bakerrang-api') 'Mutation escaped selected service.'
    $script:Mutated = $true
    if ($script:FailMutation) { throw 'Simulated uncertain mutation response.' }
    if ($Arguments[2] -ceq 'update') { return $script:NewName }
    if ($Arguments[2] -ceq 'update-traffic') { return $script:PreviousName }
    throw 'Unexpected mutation verb.'
}
function Test-PublicEndpoint {
    param([string]$Name, [string]$Url, [string]$Assertion)
    $script:HttpCalls.Add(@{ Name = $Name; Url = $Url; Assertion = $Assertion })
    return -not ($script:FailPublic -and $Name.EndsWith('public'))
}
function Write-RollbackSummary {
    param([string]$Heading, [System.Collections.IDictionary]$Fields)
    $script:Summaries[$Heading] = $Fields
}
function Write-RollbackPinWarning {
    param([string]$RevisionName)
    $script:Warnings += $RevisionName
}
function Invoke-ImageFixture { Invoke-MainRollback (Get-RollbackRequest 'api' 'image' $script:Sha) }
function Assert-NoMutation { Assert-That ($script:Mutations.Count -eq 0) 'Rejected request mutated Cloud Run.' }
function Set-RevisionPostState {
    $script:After = Copy-Fixture $script:Before
    $script:After.spec.traffic = @([pscustomobject]@{ revisionName = $script:OldName; percent = 100 })
    $script:After.status.traffic = @([pscustomobject]@{ revisionName = $script:OldName; percent = 100 })
}

$originalRef = $env:GITHUB_REF
$originalEvent = $env:GITHUB_EVENT_NAME
try {
    Test-Case 'mutation transport separates native progress from revision output and checks exit status' {
        # Exercise the real transport using only local Node, never gcloud.
        $script:GcloudCommand = Get-Command node -ErrorAction Stop
        $revision = & $script:NativeMutation -Arguments @('-e', "process.stderr.write('simulated progress\n'); process.stdout.write('bakerrang-api-00043-new\n')")
        Assert-That ($revision -ceq 'bakerrang-api-00043-new') 'Progress contaminated the returned revision.'
        Assert-Throws { & $script:NativeMutation -Arguments @('-e', 'process.exit(1)') } 'mutation failed'
        # The expected native failure must not fail GitHub's pwsh exit-code trailer.
        $global:LASTEXITCODE = 0
    }
    Test-Case 'fixed service/package/identity mappings and lowercase full SHA' {
        Reset-Fixture
        foreach ($logical in @('api', 'portal', 'renderer', 'client')) {
            $request = Get-RollbackRequest $logical 'image' $Sha
            $package = if ($logical -ceq 'renderer') { 'site-renderer' } else { $logical }
            Assert-That ($request.Config.Package -ceq $package) 'Wrong package mapping.'
            Assert-That ($request.Config.Service -ceq "bakerrang-$package") 'Wrong service mapping.'
            $identity = if ($logical -ceq 'api') { 'api' } else { 'frontend' }
            Assert-That ($request.Config.ExpectedSa -ceq "bakerrang-$identity@avian-cable-379805.iam.gserviceaccount.com") 'Wrong identity mapping.'
        }
    }
    foreach ($bad in @(('a' * 7), ('a' * 39), ('a' * 41), ('g' * 40), ('A' * 40), 'latest', 'main', "git-$('a' * 40)", 'https://example.test/', "$('a' * 40)`n")) {
        Test-Case "reject invalid image target [$($bad.Trim())]" {
            Assert-Throws { Get-RollbackRequest 'api' 'image' $bad } '40-character'
        }
    }
    Test-Case 'reject unsupported service/mechanism and foreign or malformed revision names' {
        Assert-Throws { Get-RollbackRequest 'all' 'image' $Sha } 'supported service'
        Assert-Throws { Get-RollbackRequest 'API' 'image' $Sha } 'supported service'
        Assert-Throws { Get-RollbackRequest 'api' 'latest' $Sha } 'Mechanism'
        foreach ($bad in @('bakerrang-client-00001-abc', 'latest', 'bakerrang-api-', "$OldName`n", ('bakerrang-api-' + ('a' * 60)))) {
            Assert-Throws { Get-RollbackRequest 'api' 'revision' $bad } 'exact revision'
        }
    }
    foreach ($mode in @('PINNED', 'SPLIT', 'UNKNOWN')) {
        Test-Case "image preflight rejects $mode without mutation (including pinned latest)" {
            Reset-Fixture
            switch ($mode) {
                'PINNED' { $Before.spec.traffic = @([pscustomobject]@{ revisionName = $PreviousName; percent = 100 }) }
                'SPLIT' {
                    $Before.spec.traffic = @([pscustomobject]@{ revisionName = $PreviousName; percent = 50 }, [pscustomobject]@{ revisionName = $OldName; percent = 50 })
                    $Before.status.traffic = @($Before.spec.traffic | ForEach-Object { [pscustomobject]@{ revisionName = $_.revisionName; percent = $_.percent } })
                }
                'UNKNOWN' { $Before.spec.traffic = @([pscustomobject]@{ latestRevision = $true }) }
            }
            Assert-Throws { Invoke-ImageFixture } 'not in normal LATEST mode'
            Assert-NoMutation
        }
    }
    Test-Case 'branch and event guards reject before any cloud call' {
        Reset-Fixture
        $env:GITHUB_REF = 'refs/heads/feature'
        Assert-Throws { Invoke-ImageFixture } 'workflow_dispatch on refs/heads/main'
        $env:GITHUB_REF = 'refs/heads/main'
        $env:GITHUB_EVENT_NAME = 'pull_request'
        Assert-Throws { Invoke-ImageFixture } 'workflow_dispatch on refs/heads/main'
        Assert-That ($Calls.Count -eq 0) 'Guard allowed cloud access.'
        Assert-NoMutation
    }
    foreach ($location in @('serving', 'template')) {
        Test-Case "image rejects wrong $location SA before mutation" {
            Reset-Fixture
            if ($location -ceq 'serving') { $Revisions[$PreviousName].spec.serviceAccountName = 'wrong' }
            else { $Before.spec.template.spec.serviceAccountName = 'wrong' }
            Assert-Throws { Invoke-ImageFixture } 'runtime SA differs'
            Assert-NoMutation
        }
    }
    foreach ($fault in @('missing tag', 'malformed digest', 'wrong package')) {
        Test-Case "image resolution rejects $fault before mutation" {
            Reset-Fixture
            switch ($fault) {
                'missing tag' { $script:FailAR = $true }
                'malformed digest' { $AR.image_summary.digest = 'sha256:short' }
                'wrong package' { $AR.image_summary.fully_qualified_digest = "$ArtifactRoot/client@$Digest" }
            }
            Assert-Throws { Invoke-ImageFixture } 'not found|malformed|does not match'
            Assert-NoMutation
        }
    }
    Test-Case 'successful image rollback is digest-only, LATEST, scoped and summarized' {
        Reset-Fixture
        Invoke-ImageFixture
        Assert-That ($Mutations.Count -eq 1) 'Expected one image-only mutation.'
        $expected = @('run', 'services', 'update', 'bakerrang-api', '--image', $Image, '--project', $Project, '--region', $Region, '--quiet', '--format=value(status.latestCreatedRevisionName)')
        Assert-That (($Mutations[0] -join '|') -ceq ($expected -join '|')) 'Mutation includes unexpected configuration.'
        Assert-That ($HttpCalls.Count -eq 2) 'Rollback must check only selected Cloud Run and public URLs.'
        Assert-That ($HttpCalls[0].Url -ceq ($Before.status.url + '/health')) 'Wrong Cloud Run smoke URL.'
        Assert-That ($HttpCalls[1].Url -ceq 'https://api.bakerrang.com/health') 'Wrong public smoke URL.'
        Assert-That ($Summaries['ROLLBACK RESULT'].Outcome -ceq 'PASSED') 'Missing success summary.'
        Assert-That ($Summaries['ROLLBACK REQUEST']['Current serving revision'] -ceq $PreviousName) 'Summary omitted previous serving revision.'
    }
    foreach ($fault in @('pinned', 'digest', 'identity', 'readiness', 'not created', 'not latest', 'wrong serving')) {
        Test-Case "image post-check rejects $fault without second mutation" {
            Reset-Fixture
            switch ($fault) {
                'pinned' { $After.spec.traffic = @([pscustomobject]@{ revisionName = $NewName; percent = 100 }) }
                'digest' { $Revisions[$NewName].spec.containers[0].image = "$ArtifactRoot/api@sha256:$('d' * 64)" }
                'identity' { $Revisions[$NewName].spec.serviceAccountName = 'wrong' }
                'readiness' { $After.status.conditions[0].status = 'False' }
                'not created' { $script:NewName = $PreviousName }
                'not latest' { $After.status.latestCreatedRevisionName = $PreviousName }
                'wrong serving' { $After.status.traffic[0].revisionName = $PreviousName }
            }
            Assert-Throws { Invoke-ImageFixture } 'LATEST|image|runtime SA|not Ready|new revision|latest created'
            Assert-That ($Mutations.Count -eq 1) 'Post-check failure must not issue recovery mutations.'
            Assert-That ($Summaries['ROLLBACK RESULT'].Outcome -ceq 'FAILED') 'Post failure was not recorded.'
        }
    }
    foreach ($fault in @('not listed', 'wrong service label', 'wrong name', 'unready', 'wrong SA', 'missing image')) {
        Test-Case "revision target rejects $fault before mutation" {
            Reset-Fixture
            switch ($fault) {
                'not listed' { $script:RevisionList = @() }
                'wrong service label' { $Revisions[$OldName].metadata.labels.'serving.knative.dev/service' = 'bakerrang-client' }
                'wrong name' { $Revisions[$OldName].metadata.name = $PreviousName }
                'unready' { $Revisions[$OldName].status.conditions[0].status = 'False' }
                'wrong SA' { $Revisions[$OldName].spec.serviceAccountName = 'wrong' }
                'missing image' { $Revisions[$OldName].spec.containers[0].image = '' }
            }
            Assert-Throws { Invoke-MainRollback (Get-RollbackRequest 'api' 'revision' $OldName) } 'not found|does not belong|not Ready|runtime SA|readable serving image'
            Assert-NoMutation
        }
    }
    Test-Case 'historical revision rollback works without AR and changes traffic only' {
        Reset-Fixture
        $Before.status.conditions[0].status = 'False'
        $Revisions[$PreviousName].status.conditions[0].status = 'False'
        Set-RevisionPostState
        $script:FailAR = $true
        # A broken current template must not prevent restoring a healthy historical revision.
        $Before.spec.template.spec.serviceAccountName = 'bad-current-template'
        Invoke-MainRollback (Get-RollbackRequest 'api' 'revision' $OldName)
        Assert-That ($Mutations.Count -eq 1) 'Expected one traffic-only mutation.'
        $expected = @('run', 'services', 'update-traffic', 'bakerrang-api', '--to-revisions', "${OldName}=100", '--project', $Project, '--region', $Region, '--quiet', '--format=value(status.latestReadyRevisionName)')
        Assert-That (($Mutations[0] -join '|') -ceq ($expected -join '|')) 'Unexpected revision mutation arguments.'
        Assert-That (@($Calls | Where-Object { $_[0] -eq 'artifacts' }).Count -eq 0) 'Revision rollback queried AR.'
        Assert-That ($Warnings.Count -ge 2) 'Sticky traffic warning was not preserved.'
        Assert-That ($Summaries['ROLLBACK RESULT']['Traffic mode'] -ceq 'PINNED') 'Revision rollback must remain PINNED.'
        Assert-That ($Summaries['ROLLBACK RESULT']['Service Ready condition'] -eq $false) 'Current template readiness must remain visible.'
    }
    foreach ($mode in @('PINNED', 'SPLIT')) {
        Test-Case "revision recovery accepts known $mode traffic without automatic unpin" {
            Reset-Fixture
            $Before.spec.traffic = @([pscustomobject]@{ revisionName = $PreviousName; percent = 100 })
            if ($mode -ceq 'SPLIT') {
                $Before.spec.traffic[0].percent = 50
                $Before.spec.traffic += [pscustomobject]@{ revisionName = $OldName; percent = 50 }
            }
            $Before.status.traffic = @($Before.spec.traffic | ForEach-Object { [pscustomobject]@{ revisionName = $_.revisionName; percent = $_.percent } })
            Set-RevisionPostState
            $After.status.traffic = @([pscustomobject]@{ revisionName = $OldName; percent = 100 })
            Invoke-MainRollback (Get-RollbackRequest 'api' 'revision' $OldName)
            Assert-That ($Mutations.Count -eq 1 -and $Summaries['ROLLBACK RESULT']['Traffic mode'] -ceq 'PINNED') 'Recovery did not pin only the target.'
        }
    }
    foreach ($fault in @('LATEST', 'SPLIT', 'wrong revision', 'wrong image')) {
        Test-Case "revision post-check rejects $fault" {
            Reset-Fixture
            Set-RevisionPostState
            $request = Get-RollbackRequest 'api' 'revision' $OldName
            $targetRevision = Copy-Fixture $Revisions[$OldName]
            switch ($fault) {
                'LATEST' { $After.spec.traffic = @([pscustomobject]@{ latestRevision = $true; percent = 100 }); $After.status.latestReadyRevisionName = $OldName }
                'SPLIT' { $After.spec.traffic[0].percent = 50; $After.status.traffic[0].percent = 50 }
                'wrong revision' { $After.spec.traffic[0].revisionName = $PreviousName; $After.status.traffic[0].revisionName = $PreviousName }
                'wrong image' { $targetRevision.spec.containers[0].image = 'unexpected-image' }
            }
            Assert-Throws { Assert-RollbackPostState $request $After $targetRevision $OldName $Image } 'PINNED|sole actual serving|image differs'
        }
    }
    Test-Case 'failed public check preserves pin warning and does not auto-unpin' {
        Reset-Fixture
        Set-RevisionPostState
        $script:FailPublic = $true
        Assert-Throws { Invoke-MainRollback (Get-RollbackRequest 'api' 'revision' $OldName) } 'Selected-service smoke failed'
        Assert-That ($Mutations.Count -eq 1 -and $Warnings.Count -ge 2) 'Must warn, never auto-unpin.'
        Assert-That ($Summaries['ROLLBACK RESULT']['Public smoke'] -ceq 'FAIL') 'Missing failed public smoke result.'
    }
    Test-Case 'uncertain traffic mutation emits failure summary and pin warning without retrying' {
        Reset-Fixture
        $script:FailMutation = $true
        Assert-Throws { Invoke-MainRollback (Get-RollbackRequest 'api' 'revision' $OldName) } 'uncertain mutation'
        Assert-That ($Mutations.Count -eq 1 -and $Warnings.Count -ge 2) 'Uncertain mutation must not trigger another mutation.'
        Assert-That ($Summaries['ROLLBACK RESULT'].Mutation -match 'attempted') 'Uncertainty must be visible.'
    }
    Test-Case 'fixed smoke paths/markers for every service and invalid status URL rejected' {
        Reset-Fixture
        $paths = @('/health', '/', '/robots.txt', '/')
        $assertions = @('Healthy', 'StatusOnly', 'UserAgent', 'ClientRoot')
        $publicUrls = @('https://api.bakerrang.com/health', 'https://portal.bakerrang.com/', 'https://sites.bakerrang.com/robots.txt', 'https://bakerrang.com/')
        for ($i = 0; $i -lt $Services.Count; $i++) {
            $script:HttpCalls.Clear()
            $null = Invoke-RollbackSmoke $Services[$i] 'https://service.a.run.app'
            Assert-That ($HttpCalls.Count -eq 2) 'Unrelated hosts were checked.'
            Assert-That ($HttpCalls[0].Url -ceq ('https://service.a.run.app' + $paths[$i])) 'Wrong path.'
            Assert-That ($HttpCalls[1].Url -ceq $publicUrls[$i]) 'Wrong public host.'
            Assert-That ($HttpCalls[0].Assertion -ceq $assertions[$i] -and $HttpCalls[1].Assertion -ceq $assertions[$i]) 'Wrong assertion.'
        }
        $script:HttpCalls.Clear()
        Assert-Throws { Invoke-RollbackSmoke $Services[0] 'http://service.a.run.app' } 'status.url'
        Assert-That ($HttpCalls.Count -eq 0) 'Invalid URL was requested.'
    }
}
finally {
    $env:GITHUB_REF = $originalRef
    $env:GITHUB_EVENT_NAME = $originalEvent
}
Write-Host "Rollback deterministic tests passed: $script:Passed (all cloud/HTTP calls mocked)."
